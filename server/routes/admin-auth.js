const express  = require('express')
const pool     = require('../db/pool')
const svc      = require('../services/admin-auth.service')
const { authenticateAdmin } = require('../middleware/admin-auth')

const router = express.Router()
const COOKIE = 'adm_rt'
const COOKIE_OPTS = {
  httpOnly:  true,
  secure:    process.env.NODE_ENV === 'production',
  sameSite:  'strict',
  maxAge:    7 * 24 * 60 * 60 * 1000,
  path:      '/admin/auth/refresh',
}

/* ─── POST /admin/auth/login ────────────────────────────────────
   Email + password. Brute-force checked before credential lookup.
   Returns access token in JSON; refresh token in httpOnly cookie. */
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const ip = req.ip || req.socket.remoteAddress

  if (!email || !password) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Email and password are required.' })
  }

  // Brute-force gate — checked before any DB user lookup to prevent timing oracle
  try {
    await svc.checkBruteForce(pool, email.toLowerCase(), ip)
  } catch (err) {
    if (err.code === 'ACCOUNT_LOCKED') {
      return res.status(429).json({
        error:            'ACCOUNT_LOCKED',
        message:          err.message,
        retryAfterSeconds: err.retryAfterSeconds,
      })
    }
    throw err
  }

  // Look up admin
  const { rows } = await pool.query(
    'SELECT * FROM admin_users WHERE email = $1',
    [email.toLowerCase()]
  )

  const admin = rows[0]
  const valid = admin && admin.is_active
    ? await svc.verifyPassword(password, admin.password_hash)
    : false

  // Always record attempt (success or fail) — keeps the brute-force counter accurate
  await svc.recordAttempt(pool, email.toLowerCase(), ip, valid)

  if (!valid) {
    return res.status(401).json({
      error:   'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect.',
    })
  }

  if (!admin.is_active) {
    return res.status(403).json({ error: 'ACCOUNT_INACTIVE', message: 'This admin account is disabled.' })
  }

  // Update last_login_at
  await pool.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [admin.id])

  const { accessToken, refreshToken } = svc.generateTokens(admin)
  await svc.storeRefreshToken(pool, admin.id, refreshToken, ip, req.headers['user-agent'])

  await svc.logActivity(pool, admin.id, admin.email, 'admin.login', null, null, { ip }, ip)

  res.cookie(COOKIE, refreshToken, COOKIE_OPTS)
  res.json({
    accessToken,
    admin: {
      id:        admin.id,
      email:     admin.email,
      role:      admin.role,
      name:      [admin.first_name, admin.last_name].filter(Boolean).join(' '),
    },
  })
})

/* ─── POST /admin/auth/refresh ──────────────────────────────────
   Reads refresh token from httpOnly cookie, rotates it, returns new access token. */
router.post('/refresh', async (req, res) => {
  const oldToken = req.cookies?.[COOKIE]
  if (!oldToken) {
    return res.status(401).json({ error: 'NO_REFRESH_TOKEN', message: 'No refresh token.' })
  }

  const ip = req.ip || req.socket.remoteAddress

  try {
    const { tokens, admin } = await svc.rotateRefreshToken(
      pool, oldToken, ip, req.headers['user-agent']
    )

    res.cookie(COOKIE, tokens.refreshToken, COOKIE_OPTS)
    res.json({ accessToken: tokens.accessToken, admin })
  } catch (err) {
    res.clearCookie(COOKIE, { path: '/admin/auth/refresh' })
    const status = err.code === 'TOKEN_REUSE_DETECTED' ? 401 : 401
    res.status(status).json({ error: err.code || 'INVALID_REFRESH_TOKEN', message: err.message })
  }
})

/* ─── POST /admin/auth/logout ───────────────────────────────────
   Revokes all refresh tokens for this admin and clears the cookie. */
router.post('/logout', authenticateAdmin, async (req, res) => {
  await svc.revokeAllTokens(pool, req.admin.sub)
  await svc.logActivity(pool, req.admin.sub, req.admin.email, 'admin.logout', null, null, {}, req.ip)
  res.clearCookie(COOKIE, { path: '/admin/auth/refresh' })
  res.json({ message: 'Logged out.' })
})

/* ─── GET /admin/auth/me ────────────────────────────────────────
   Returns current admin identity from the verified access token. */
router.get('/me', authenticateAdmin, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, role, first_name, last_name, last_login_at FROM admin_users WHERE id = $1',
    [req.admin.sub]
  )
  if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' })
  res.json(rows[0])
})

module.exports = router
