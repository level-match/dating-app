const { createClient } = require('@supabase/supabase-js')

const BUCKET = 'profile-images'

let _client = null

function getSupabaseAdmin() {
  if (_client) return _client

  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    const err = new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.')
    err.code = 'SERVER_MISCONFIGURED'
    throw err
  }

  _client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _client
}

module.exports = { getSupabaseAdmin, BUCKET }
