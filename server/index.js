require('dotenv').config()
require('express-async-errors')

const express      = require('express')
const helmet       = require('helmet')
const cors         = require('cors')
const cookieParser = require('cookie-parser')
const rateLimit    = require('express-rate-limit')

const authRoutes         = require('./routes/auth')
const refRoutes          = require('./routes/ref')
const locationRoutes     = require('./routes/location')
const profilePhotoRoutes = require('./routes/profile-photos')
const subscriptionRoutes = require('./routes/subscriptions')
const matchRoutes          = require('./routes/matches')
const chatRoutes           = require('./routes/chat')
const notificationRoutes   = require('./routes/notifications')
const webhookRoutes      = require('./routes/webhooks')
const adminAuthRoutes    = require('./routes/admin-auth')
const adminApiRoutes     = require('./routes/admin-api')
const { authenticateAdmin } = require('./middleware/admin-auth')

const app  = express()
const PORT = Number(process.env.PORT || 4000)

/* ─── Security headers ──────────────────────────────────────────*/
app.use(helmet())
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
      process.env.ADMIN_ORIGIN    || 'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:5173',
    ]
    if (!origin || allowed.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
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
  // Profile saves can include a photo data-URL; keep headroom above 64kb.
  express.json({ limit: '6mb' })(req, res, next)
})

/* ─── Routes ────────────────────────────────────────────────────*/
app.use('/api/auth',                         authRoutes)
app.use('/api/ref/location',                 locationRoutes)
app.use('/api/ref',                          refRoutes)
app.use('/api/profile',                      profilePhotoRoutes)
app.use('/api',                              matchRoutes)
app.use('/api',                              chatRoutes)
app.use('/api',                              notificationRoutes)
app.use('/api',           paymentLimiter,    subscriptionRoutes)
app.use('/webhooks',                         webhookRoutes)
app.use('/admin/auth',    adminLoginLimiter,  adminAuthRoutes)
app.use('/admin/api',     authenticateAdmin,  adminApiRoutes)

/* ─── Health check ──────────────────────────────────────────────*/
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

/* ─── Error handler ─────────────────────────────────────────────*/
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled error:', err.message)

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'FILE_TOO_LARGE',
      message: 'Image must be 10 MB or smaller.',
    })
  }

  const statusMap = {
    DUPLICATE_SUBSCRIPTION:  409,
    NO_SUBSCRIPTION:         404,
    NOT_FOUND:               404,
    INVALID_UPGRADE_PATH:    400,
    INVALID_DOWNGRADE_PATH:  400,
    INVALID_TIER:            400,
    MISSING_IDEMPOTENCY_KEY: 400,
    INVALID_IDEMPOTENCY_KEY: 400,
    INVALID_FILE_TYPE:       400,
    FILE_TOO_LARGE:          400,
    PHOTO_LIMIT_REACHED:     400,
    MISSING_FILE:            400,
    ACCOUNT_LOCKED:          429,
    INVALID_CREDENTIALS:     401,
    INVALID_TOKEN:           401,
    INVALID_REFRESH_TOKEN:   401,
    TOKEN_REUSE_DETECTED:    401,
    ACCOUNT_INACTIVE:        403,
    FORBIDDEN:               403,
    STORAGE_UPLOAD_FAILED:   502,
    STORAGE_DELETE_FAILED:   502,
    SERVER_MISCONFIGURED:    500,
    PROFILE_NOT_FOUND:       404,
    LOCATION_REQUIRED:       400,
    INTENT_INELIGIBLE:       403,
    GEO_LOCKED:              403,
    ALREADY_CONNECTED:       409,
    CONNECTION_EXISTS:       409,
    INVALID_PROFILE_ID:      400,
    INVALID_CONNECTION_ID:   400,
    INVALID_MESSAGE:         400,
    MESSAGING_LOCKED:        403,
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
