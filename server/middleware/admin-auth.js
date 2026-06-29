const { verifyAccessToken, logActivity } = require('../services/admin-auth.service')

const ROLE_RANK = { support: 0, moderator: 1, super_admin: 2 }

/* ─── JWT authentication ────────────────────────────────────────
   Verifies the Bearer access token in the Authorization header.
   Attaches decoded admin identity to req.admin. */
function authenticateAdmin(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'No admin token provided.' })
  }

  try {
    const token = header.slice(7)
    req.admin   = verifyAccessToken(token)
    next()
  } catch (err) {
    const expired = err.name === 'TokenExpiredError'
    return res.status(401).json({
      error:   expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      message: expired ? 'Admin session expired. Please refresh.' : 'Invalid admin token.',
    })
  }
}

/* ─── Role guard factory ────────────────────────────────────────
   Usage:  router.use(requireRole('super_admin'))
           router.patch('/...', requireRole('moderator', 'super_admin'), handler) */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'UNAUTHORIZED' })
    }
    const adminRank   = ROLE_RANK[req.admin.role] ?? -1
    const minRequired = Math.min(...allowedRoles.map(r => ROLE_RANK[r] ?? 99))
    if (adminRank < minRequired) {
      return res.status(403).json({
        error:   'FORBIDDEN',
        message: `This action requires one of: ${allowedRoles.join(', ')}.`,
      })
    }
    next()
  }
}

/* ─── Activity logger middleware factory ────────────────────────
   Auto-writes an audit log entry for every route it wraps.
   Usage:  router.delete('/:id', activityLogger('user.deleted', 'user'), handler) */
function activityLogger(action, resourceType, getResourceId) {
  const pool = require('../db/pool')
  return async (req, res, next) => {
    const originalJson = res.json.bind(res)
    res.json = function (body) {
      // Only log on success (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.admin) {
        const resourceId = getResourceId
          ? getResourceId(req, body)
          : (req.params.id || body?.id || null)

        logActivity(
          pool,
          req.admin.sub,
          req.admin.email,
          action,
          resourceType,
          resourceId,
          { method: req.method, body: req.body, result: body?.id ? { id: body.id } : undefined },
          req.ip
        ).catch(() => {})
      }
      return originalJson(body)
    }
    next()
  }
}

module.exports = { authenticateAdmin, requireRole, activityLogger }
