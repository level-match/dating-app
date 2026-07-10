const pool = require('../db/pool')
const { verifySupabaseToken } = require('./supabase-auth')

/**
 * Verifies the Supabase JWT and attaches identity to req.auth.
 * userId is null when the user row does not exist yet (subscribe creates it).
 */
async function attachSupabaseIdentity(req, _res, next) {
  try {
    const payload = await verifySupabaseToken(req.headers.authorization)
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE external_id = $1',
      [payload.sub],
    )
    req.auth = {
      externalId: payload.sub,
      email: payload.email || '',
      userId: rows[0]?.id || null,
    }
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = { attachSupabaseIdentity }
