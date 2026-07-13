const pool = require('../db/pool')
const subscriptionSvc = require('./subscription.service')
const { TIER_PRICE_CENTAVOS } = require('../utils/prorate')

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

function normalizeTier(tier) {
  if (!tier) return null
  return tier.replace(/^level_/, '')
}

function toUiTier(tier) {
  const t = normalizeTier(tier) || 'base'
  return `level_${t}`
}

function displayName(first, last, email) {
  const name = [first, last].filter(Boolean).join(' ').trim()
  return name || email || 'Member'
}

function displayRegion(profile) {
  if (!profile) return '—'
  const cityRegion = [profile.city, profile.region_name].filter(Boolean).join(', ')
  return cityRegion || profile.country_name || '—'
}

async function listUsers({ search, tier, status, page = 1, limit = 15 } = {}) {
  const params = []
  const where = ['1=1']

  if (search) {
    params.push(`%${search.trim().toLowerCase()}%`)
    const i = params.length
    where.push(`(
      LOWER(u.email) LIKE $${i}
      OR LOWER(COALESCE(p.first_name, '')) LIKE $${i}
      OR LOWER(COALESCE(p.last_name, '')) LIKE $${i}
      OR LOWER(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')))) LIKE $${i}
    )`)
  }

  const normTier = normalizeTier(tier)
  if (normTier) {
    params.push(normTier)
    where.push(`COALESCE(sub.tier, 'base') = $${params.length}`)
  }

  if (status) {
    params.push(status)
    where.push(`COALESCE(u.account_status, 'active') = $${params.length}`)
  }

  const pageNum = Math.max(1, Number(page) || 1)
  const pageSize = Math.min(Math.max(Number(limit) || 15, 1), 100)
  const offset = (pageNum - 1) * pageSize

  const baseFrom = `
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    ${TIER_SUBQUERY}
    WHERE ${where.join(' AND ')}
  `

  const [{ rows: countRows }, { rows }] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n ${baseFrom}`, params),
    pool.query(
      `
      SELECT
        u.id,
        u.email,
        u.created_at,
        COALESCE(u.account_status, 'active') AS status,
        p.first_name,
        p.last_name,
        p.city,
        p.region_name,
        p.country_name,
        COALESCE(sub.tier, 'base') AS tier
      ${baseFrom}
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, pageSize, offset]
    ),
  ])

  const total = countRows[0]?.n ?? 0
  const users = rows.map(r => ({
    id:         r.id,
    email:      r.email,
    name:       displayName(r.first_name, r.last_name, r.email),
    region:     displayRegion(r),
    status:     r.status,
    tier:       toUiTier(r.tier),
    created_at: r.created_at,
  }))

  return { users, total, page: pageNum, pages: Math.ceil(total / pageSize) || 1 }
}

async function getUserById(id) {
  const { rows } = await pool.query(
    `
    SELECT
      u.id,
      u.email,
      u.created_at,
      COALESCE(u.account_status, 'active') AS status,
      p.first_name,
      p.last_name,
      p.city,
      p.region_name,
      p.country_name,
      COALESCE(sub.tier, 'base') AS tier
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    ${TIER_SUBQUERY}
    WHERE u.id = $1
    `,
    [id]
  )
  if (!rows.length) return null

  const r = rows[0]
  const stats = await pool.query(
    `
    SELECT
      (SELECT COUNT(*)::int FROM match_deliveries WHERE user_id = $1) AS matches,
      (SELECT COUNT(*)::int FROM connection_requests
        WHERE status = 'accepted' AND (from_user_id = $1 OR to_user_id = $1)) AS threads
    `,
    [id]
  )

  return {
    id:         r.id,
    email:      r.email,
    name:       displayName(r.first_name, r.last_name, r.email),
    region:     displayRegion(r),
    status:     r.status,
    tier:       toUiTier(r.tier),
    created_at: r.created_at,
    stats: {
      matches: stats.rows[0]?.matches ?? 0,
      threads: stats.rows[0]?.threads ?? 0,
    },
  }
}

async function setUserTier(userId, tier, reason) {
  const target = normalizeTier(tier)
  if (!['base', 'plus', 'prime'].includes(target)) {
    const err = new Error('Invalid tier.')
    err.code = 'INVALID_TIER'
    throw err
  }

  if (target === 'base') {
    await subscriptionSvc.downgradeSubscription({ userId, targetTier: 'base' })
    return { id: userId, tier: toUiTier('base') }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const sub = await subscriptionSvc.ensureBaseSubscription(userId, client)

    const { rows } = await client.query(
      `UPDATE subscriptions
       SET tier = $1,
           status = 'active',
           provider = 'manual',
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, tier`,
      [target, sub.id]
    )

    await client.query(
      `INSERT INTO subscription_history
         (subscription_id, user_id, from_tier, to_tier, from_status, to_status, reason, triggered_by)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, 'admin')`,
      [sub.id, userId, sub.tier, target, sub.status, reason ? `admin_override: ${reason}` : 'admin_override']
    )

    await client.query('COMMIT')
    return { id: userId, tier: toUiTier(rows[0].tier) }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function setUserStatus(userId, status) {
  if (!['active', 'suspended', 'banned'].includes(status)) {
    const err = new Error('Invalid status.')
    err.code = 'INVALID_STATUS'
    throw err
  }

  const { rows } = await pool.query(
    `UPDATE users
     SET account_status = $1
     WHERE id = $2
     RETURNING id, account_status`,
    [status, userId]
  )
  if (!rows.length) return null
  return { id: rows[0].id, status: rows[0].account_status }
}

module.exports = {
  listUsers,
  getUserById,
  setUserTier,
  setUserStatus,
  toUiTier,
}
