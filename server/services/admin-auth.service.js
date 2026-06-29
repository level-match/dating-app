const bcrypt  = require('bcrypt')
const jwt     = require('jsonwebtoken')
const crypto  = require('crypto')

const ACCESS_SECRET  = process.env.ADMIN_JWT_SECRET
const REFRESH_SECRET = process.env.ADMIN_REFRESH_SECRET
const ACCESS_EXPIRY  = '15m'
const REFRESH_EXPIRY = '7d'
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

const MAX_ATTEMPTS      = Number(process.env.ADMIN_MAX_LOGIN_ATTEMPTS || 5)
const LOCKOUT_MINUTES   = Number(process.env.ADMIN_LOCKOUT_MINUTES    || 30)
const WINDOW_MINUTES    = 15

/* ─── Passwords ─────────────────────────────────────────────────*/
async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

/* ─── Brute-force protection ────────────────────────────────────
   Counts failures for this email OR IP within the rolling window.
   Throws ACCOUNT_LOCKED before credentials are even checked. */
async function checkBruteForce(pool, email, ip) {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000)
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM admin_login_attempts
     WHERE (email = $1 OR ip_address = $2) AND success = false AND attempted_at > $3`,
    [email, ip, since]
  )
  if (Number(rows[0].cnt) >= MAX_ATTEMPTS) {
    const err = new Error(
      `Account locked after ${MAX_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`
    )
    err.code = 'ACCOUNT_LOCKED'
    err.retryAfterSeconds = LOCKOUT_MINUTES * 60
    throw err
  }
}

async function recordAttempt(pool, email, ip, success) {
  await pool.query(
    'INSERT INTO admin_login_attempts (email, ip_address, success) VALUES ($1, $2, $3)',
    [email, ip, success]
  )
}

/* ─── JWT tokens ────────────────────────────────────────────────
   Access token:  15 min, contains full identity for middleware use.
   Refresh token: 7 days, stored as SHA-256 hash in DB. */
function generateTokens(admin) {
  const payload = {
    sub:  admin.id,
    email: admin.email,
    role:  admin.role,
    name:  [admin.first_name, admin.last_name].filter(Boolean).join(' '),
  }
  const accessToken  = jwt.sign(payload, ACCESS_SECRET,  { expiresIn: ACCESS_EXPIRY  })
  const refreshToken = jwt.sign({ sub: admin.id },       REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY })
  return { accessToken, refreshToken }
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET)
}

function verifyRefreshTokenJwt(token) {
  return jwt.verify(token, REFRESH_SECRET)
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/* ─── Refresh token persistence ─────────────────────────────────*/
async function storeRefreshToken(pool, adminId, refreshToken, ip, userAgent) {
  const hash      = hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS)
  await pool.query(
    `INSERT INTO admin_refresh_tokens (admin_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminId, hash, expiresAt, ip || null, userAgent || null]
  )
}

/* Atomic rotation: revoke old, issue new pair. Detects token reuse (revoked token = breach signal). */
async function rotateRefreshToken(pool, oldToken, ip, userAgent) {
  const oldHash = hashToken(oldToken)

  const { rows } = await pool.query(
    `SELECT rt.*, au.id AS uid, au.email, au.role, au.first_name, au.last_name, au.is_active
     FROM admin_refresh_tokens rt
     JOIN admin_users au ON au.id = rt.admin_id
     WHERE rt.token_hash = $1`,
    [oldHash]
  )

  if (!rows.length) {
    const err = new Error('Refresh token not found.')
    err.code = 'INVALID_REFRESH_TOKEN'
    throw err
  }

  const record = rows[0]

  if (record.revoked_at) {
    // Token reuse detected — revoke ALL tokens for this admin (potential theft)
    await pool.query(
      'UPDATE admin_refresh_tokens SET revoked_at = NOW() WHERE admin_id = $1 AND revoked_at IS NULL',
      [record.admin_id]
    )
    const err = new Error('Refresh token already revoked. All sessions invalidated.')
    err.code = 'TOKEN_REUSE_DETECTED'
    throw err
  }

  if (new Date(record.expires_at) < new Date()) {
    const err = new Error('Refresh token expired.')
    err.code = 'INVALID_REFRESH_TOKEN'
    throw err
  }

  if (!record.is_active) {
    const err = new Error('Admin account is inactive.')
    err.code = 'ACCOUNT_INACTIVE'
    throw err
  }

  // Revoke consumed token
  await pool.query(
    'UPDATE admin_refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
    [oldHash]
  )

  const admin  = { id: record.uid, email: record.email, role: record.role, first_name: record.first_name, last_name: record.last_name }
  const tokens = generateTokens(admin)
  await storeRefreshToken(pool, admin.id, tokens.refreshToken, ip, userAgent)

  return { tokens, admin }
}

async function revokeAllTokens(pool, adminId) {
  await pool.query(
    'UPDATE admin_refresh_tokens SET revoked_at = NOW() WHERE admin_id = $1 AND revoked_at IS NULL',
    [adminId]
  )
}

/* ─── Activity audit log ────────────────────────────────────────*/
async function logActivity(pool, adminId, adminEmail, action, resourceType, resourceId, details, ip) {
  try {
    await pool.query(
      `INSERT INTO admin_activity_logs
         (admin_id, admin_email, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [adminId, adminEmail, action, resourceType || null, resourceId || null,
       JSON.stringify(details || {}), ip || null]
    )
  } catch (err) {
    // Never let logging failure crash a request
    console.error('[admin-log] Failed to write activity:', err.message)
  }
}

module.exports = {
  hashPassword, verifyPassword,
  checkBruteForce, recordAttempt,
  generateTokens, verifyAccessToken, verifyRefreshTokenJwt,
  storeRefreshToken, rotateRefreshToken, revokeAllTokens,
  logActivity,
}
