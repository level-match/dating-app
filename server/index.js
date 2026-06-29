require('dotenv').config()
require('express-async-errors')

const express      = require('express')
const helmet       = require('helmet')
const cors         = require('cors')
const cookieParser = require('cookie-parser')
const rateLimit    = require('express-rate-limit')

const subscriptionRoutes = require('./routes/subscriptions')
const webhookRoutes      = require('./routes/webhooks')
const adminAuthRoutes    = require('./routes/admin-auth')
const adminApiRoutes     = require('./routes/admin-api')
const { authenticateAdmin } = require('./middleware/admin-auth')

const app  = express()
const PORT = Number(process.env.PORT || 4000)

/* ─── Security headers ──────────────────────────────────────────*/
app.use(helmet())
app.use(cors({
  origin:      [
    process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    process.env.ADMIN_ORIGIN    || 'http://localhost:3000',
  ],
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}))
app.use(cookieParser())

/* ─── Rate limiters ─────────────────────────────────────────────*/
const paymentLimiter = rateLimit({ windowMs: 60_000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests.' } })

const adminLoginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many login attempts.' } })

/* ─── Body parsing ──────────────────────────────────────────────
   Webhook routes capture raw body for HMAC verification. */
app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks')) return next()
  express.json({ limit: '64kb' })(req, res, next)
})

/* ─── Routes ────────────────────────────────────────────────────*/
app.use('/api',           paymentLimiter,    subscriptionRoutes)
app.use('/webhooks',                         webhookRoutes)
app.use('/admin/auth',    adminLoginLimiter,  adminAuthRoutes)
app.use('/admin/api',     authenticateAdmin,  adminApiRoutes)

/* ─── Health check ──────────────────────────────────────────────*/
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

/* ─── Error handler ─────────────────────────────────────────────*/
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled error:', err.message)

  const statusMap = {
    DUPLICATE_SUBSCRIPTION:  409,
    NO_SUBSCRIPTION:         404,
    NOT_FOUND:               404,
    INVALID_UPGRADE_PATH:    400,
    INVALID_TIER:            400,
    ACCOUNT_LOCKED:          429,
    INVALID_CREDENTIALS:     401,
    INVALID_REFRESH_TOKEN:   401,
    TOKEN_REUSE_DETECTED:    401,
    ACCOUNT_INACTIVE:        403,
  }
  if (statusMap[err.code]) {
    return res.status(statusMap[err.code]).json({ error: err.code, message: err.message })
  }
  if (err.code === '23505' && err.constraint === 'uq_subscriptions_single_active') {
    return res.status(409).json({ error: 'DUPLICATE_SUBSCRIPTION', message: 'Only one active subscription per user.' })
  }
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' })
})

app.listen(PORT, () => console.log(`[server] LEVEL backend :${PORT}`))
module.exports = app
