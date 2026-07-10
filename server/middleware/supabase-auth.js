const jwt = require('jsonwebtoken')
const { createRemoteJWKSet, jwtVerify } = require('jose')
const pool = require('../db/pool')

function authError(message, code) {
  const err = new Error(message)
  err.code = code
  return err
}

let _jwks = null

function getSupabaseJwks() {
  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
  if (!base) {
    throw authError(
      'SUPABASE_URL is not configured on the server (required for ES256 tokens).',
      'SERVER_MISCONFIGURED',
    )
  }
  if (!_jwks) {
    _jwks = createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`))
  }
  return _jwks
}

async function verifySupabaseToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw authError('Missing or malformed Authorization header.', 'INVALID_TOKEN')
  }

  const token = authHeader.slice(7)
  const decoded = jwt.decode(token, { complete: true })
  if (!decoded?.header) {
    throw authError('Invalid or expired token.', 'INVALID_TOKEN')
  }

  const alg = decoded.header.alg || ''

  if (alg.startsWith('HS')) {
    const rawSecret = process.env.SUPABASE_JWT_SECRET
    if (!rawSecret) {
      throw authError('SUPABASE_JWT_SECRET is not configured on the server.', 'SERVER_MISCONFIGURED')
    }
    try {
      return jwt.verify(token, rawSecret)
    } catch (e) {
      console.error('[auth] JWT verify failed (HS):', e.message)
      throw authError('Invalid or expired token.', 'INVALID_TOKEN')
    }
  }

  try {
    const { payload } = await jwtVerify(token, getSupabaseJwks())
    return payload
  } catch (e) {
    console.error('[auth] JWT verify failed (JWKS):', e.message)
    throw authError('Invalid or expired token.', 'INVALID_TOKEN')
  }
}

async function authenticateSupabase(req, _res, next) {
  const payload = await verifySupabaseToken(req.headers.authorization)

  const { rows } = await pool.query(
    'SELECT id FROM users WHERE external_id = $1',
    [payload.sub],
  )
  if (!rows.length) {
    throw authError('User not found.', 'NOT_FOUND')
  }

  req.auth = {
    externalId: payload.sub,
    userId: rows[0].id,
    email: payload.email || '',
  }
  next()
}

module.exports = { verifySupabaseToken, authenticateSupabase, authError }
