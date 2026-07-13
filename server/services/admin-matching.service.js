const pool = require('../db/pool')
const { getDailyMatchLimit } = require('../utils/entitlements')

const TIER_SUBQUERY = `
  LEFT JOIN LATERAL (
    SELECT s.tier
    FROM subscriptions s
    WHERE s.user_id = u.id
      AND s.status IN ('active', 'pending', 'past_due')
    ORDER BY s.created_at DESC, s.id DESC
    LIMIT 1
  ) sub ON TRUE
`

function tierExpr(alias = 'sub') {
  return `COALESCE(${alias}.tier, 'base')`
}

function pct(num, den) {
  if (!den) return 0
  return Math.round((num / den) * 1000) / 10
}

async function getOverview() {
  const [
    deliveriesToday,
    deliveriesByTier,
    alignmentReady,
    baseAtCap,
    feedback,
    connections,
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n FROM match_deliveries WHERE delivered_on = CURRENT_DATE`),
    pool.query(`
      SELECT ${tierExpr()} AS tier, COUNT(*)::int AS count
      FROM match_deliveries md
      JOIN users u ON u.id = md.user_id
      ${TIER_SUBQUERY}
      WHERE md.delivered_on = CURRENT_DATE
      GROUP BY 1
    `),
    pool.query(`
      SELECT COUNT(*)::int AS n
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      WHERE u.onboarding_complete = TRUE
        AND p.alignment_completed_at IS NOT NULL
    `),
    pool.query(`
      SELECT COUNT(*)::int AS n
      FROM (
        SELECT md.user_id
        FROM match_deliveries md
        WHERE md.delivered_on = CURRENT_DATE
        GROUP BY md.user_id
        HAVING COUNT(*) >= ${getDailyMatchLimit('base')}
      ) capped
      WHERE NOT EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.user_id = capped.user_id
          AND s.tier IN ('plus', 'prime')
          AND s.status IN ('active', 'pending', 'past_due')
      )
    `),
    pool.query(`
      SELECT action, COUNT(*)::int AS count
      FROM match_feedback
      GROUP BY action
    `),
    pool.query(`
      SELECT status, COUNT(*)::int AS count
      FROM connection_requests
      GROUP BY status
    `),
  ])

  const tierMap = { base: 0, plus: 0, prime: 0 }
  for (const row of deliveriesByTier.rows) {
    if (row.tier in tierMap) tierMap[row.tier] = row.count
  }

  const fb = { pass: 0, decline: 0, connect: 0 }
  for (const row of feedback.rows) fb[row.action] = row.count
  const feedbackTotal = fb.pass + fb.decline + fb.connect

  const conn = { pending: 0, accepted: 0, declined: 0, withdrawn: 0 }
  for (const row of connections.rows) conn[row.status] = row.count
  const requestsResolved = conn.accepted + conn.declined

  return {
    deliveriesToday: deliveriesToday.rows[0]?.n ?? 0,
    deliveriesByTier: tierMap,
    alignmentReady: alignmentReady.rows[0]?.n ?? 0,
    baseAtCap: baseAtCap.rows[0]?.n ?? 0,
    feedback: fb,
    connections: conn,
    connectRate: pct(fb.connect, feedbackTotal),
    acceptRate: pct(conn.accepted, requestsResolved),
    passRate: pct(fb.pass, feedbackTotal),
  }
}

async function getDeliveriesChart(days = 7) {
  const span = Math.min(Math.max(Number(days) || 7, 1), 30)
  const { rows } = await pool.query(
    `
    SELECT
      md.delivered_on::text AS day,
      ${tierExpr()} AS tier,
      COUNT(*)::int AS count
    FROM match_deliveries md
    JOIN users u ON u.id = md.user_id
    ${TIER_SUBQUERY}
    WHERE md.delivered_on >= CURRENT_DATE - ($1::int - 1)
    GROUP BY md.delivered_on, 2
    ORDER BY md.delivered_on
    `,
    [span]
  )

  const labels = []
  const base = []
  const plus = []
  const prime = []
  const byDay = new Map()

  for (let i = span - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    labels.push(d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }))
    byDay.set(key, { base: 0, plus: 0, prime: 0 })
  }

  for (const row of rows) {
    const bucket = byDay.get(row.day)
    if (bucket && row.tier in bucket) bucket[row.tier] = row.count
  }

  for (const [, v] of byDay) {
    base.push(v.base)
    plus.push(v.plus)
    prime.push(v.prime)
  }

  return { labels, base, plus, prime }
}

async function getRecentDeliveries(limit = 20) {
  const { rows } = await pool.query(
    `
    SELECT
      md.id,
      md.delivered_on,
      md.created_at,
      ${tierExpr()} AS viewer_tier,
      TRIM(CONCAT(vp.first_name, ' ', vp.last_name)) AS viewer_name,
      TRIM(CONCAT(cp.first_name, ' ', cp.last_name)) AS candidate_name
    FROM match_deliveries md
    JOIN users u ON u.id = md.user_id
    JOIN profiles vp ON vp.user_id = md.user_id
    JOIN profiles cp ON cp.id = md.candidate_profile_id
    ${TIER_SUBQUERY}
    ORDER BY md.created_at DESC
    LIMIT $1
    `,
    [Math.min(Math.max(Number(limit) || 20, 1), 100)]
  )

  return rows.map(r => ({
    id: r.id,
    deliveredOn: r.delivered_on,
    createdAt: r.created_at,
    viewerTier: r.viewer_tier,
    viewerName: r.viewer_name || 'Member',
    candidateName: r.candidate_name || 'Member',
  }))
}

async function getDashboard({ days = 7, recentLimit = 15 } = {}) {
  const [overview, chart, deliveries] = await Promise.all([
    getOverview(),
    getDeliveriesChart(days),
    getRecentDeliveries(recentLimit),
  ])
  return { overview, chart, deliveries }
}

module.exports = {
  getOverview,
  getDeliveriesChart,
  getRecentDeliveries,
  getDashboard,
}
