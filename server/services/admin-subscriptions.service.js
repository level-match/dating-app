const pool = require('../db/pool')
const { TIER_PRICE_CENTAVOS } = require('../utils/prorate')
const { toUiTier } = require('./admin-users.service')

function displayName(first, last, email) {
  const name = [first, last].filter(Boolean).join(' ').trim()
  return name || email || 'Member'
}

async function listSubscriptions({ status, tier, page = 1, limit = 50 } = {}) {
  const params = []
  const where = ['1=1']

  if (status && status !== 'all') {
    params.push(status)
    where.push(`s.status = $${params.length}`)
  }

  if (tier) {
    const norm = tier.replace(/^level_/, '')
    params.push(norm)
    where.push(`s.tier = $${params.length}`)
  }

  const pageNum = Math.max(1, Number(page) || 1)
  const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 100)
  const offset = (pageNum - 1) * pageSize

  const baseFrom = `
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE ${where.join(' AND ')}
  `

  const [{ rows: countRows }, { rows }] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n ${baseFrom}`, params),
    pool.query(
      `
      SELECT
        s.id,
        s.user_id,
        s.tier,
        s.status,
        s.current_period_start,
        s.current_period_end,
        s.retry_count,
        s.provider,
        u.email,
        p.first_name,
        p.last_name
      ${baseFrom}
      ORDER BY s.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, pageSize, offset]
    ),
  ])

  const subscriptions = rows.map(r => ({
    id:               r.id,
    user_id:          r.user_id,
    user_name:        displayName(r.first_name, r.last_name, r.email),
    tier:             toUiTier(r.tier),
    status:           r.status,
    started_at:       r.current_period_start,
    next_billing_at:  r.current_period_end,
    amount_centavos:  TIER_PRICE_CENTAVOS[r.tier] ?? 0,
    retries:          r.retry_count,
    provider:         r.provider,
  }))

  const total = countRows[0]?.n ?? 0
  return { subscriptions, total, page: pageNum, pages: Math.ceil(total / pageSize) || 1 }
}

async function updateSubscriptionStatus(id, status) {
  const allowed = ['active', 'past_due', 'cancelled', 'expired', 'pending']
  if (!allowed.includes(status)) {
    const err = new Error('Invalid subscription status.')
    err.code = 'INVALID_STATUS'
    throw err
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: existing } = await client.query(
      'SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE',
      [id]
    )
    if (!existing.length) return null

    const sub = existing[0]
    const { rows } = await client.query(
      `UPDATE subscriptions
       SET status = $1,
           cancelled_at = CASE WHEN $1 = 'cancelled' THEN NOW() ELSE cancelled_at END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, status`,
      [status, id]
    )

    await client.query(
      `INSERT INTO subscription_history
         (subscription_id, user_id, from_tier, to_tier, from_status, to_status, reason, triggered_by)
       VALUES ($1, $2, $3, $3, $4, $5, 'admin_status_override', 'admin')`,
      [sub.id, sub.user_id, sub.tier, sub.status, status]
    )

    await client.query('COMMIT')
    return rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function flagRefund(id, reason) {
  const { rows } = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [id])
  if (!rows.length) return null

  const sub = rows[0]
  await pool.query(
    `INSERT INTO subscription_history
       (subscription_id, user_id, from_tier, to_tier, from_status, to_status, reason, triggered_by)
     VALUES ($1, $2, $3, $3, $4, $4, $5, 'admin')`,
    [sub.id, sub.user_id, sub.tier, sub.status, `refund_flag: ${reason || 'no reason given'}`]
  )

  return { id: sub.id, refundFlagged: true, flaggedAt: new Date().toISOString() }
}

module.exports = {
  listSubscriptions,
  updateSubscriptionStatus,
  flagRefund,
}
