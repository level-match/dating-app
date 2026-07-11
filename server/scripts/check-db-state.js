require('../config/load-env')
const pool = require('../db/pool')

const EXPECTED_TABLES = [
  'users',
  'profiles',
  'subscriptions',
  'match_deliveries',
  'connection_requests',
  'chat_messages',
  'notification_reads',
  'profile_views',
  'chat_message_reads',
  'user_profile_photos',
  'admin_users',
  'ref_genders',
  'ref_preferred_genders',
]

async function main() {
  const tables = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `)
  const names = new Set(tables.rows.map((r) => r.table_name))

  console.log('=== LEVEL database status ===\n')
  console.log(`Tables: ${names.size}`)

  const missing = EXPECTED_TABLES.filter((t) => !names.has(t))
  if (missing.length) {
    console.log('Missing expected tables:', missing.join(', '))
  } else {
    console.log('Core tables: OK')
  }

  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name IN ('country_code', 'region_code', 'mutual_only_visibility', 'read_receipts')
    ORDER BY column_name
  `)
  console.log('Latest profile fields:', cols.rows.map((r) => r.column_name).join(', ') || '(incomplete)')

  const usersCol = await pool.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'onboarding_complete'
  `)
  console.log('users.onboarding_complete:', usersCol.rows.length ? 'yes' : 'no')

  const seeds = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM ref_genders) AS ref_genders,
      (SELECT COUNT(*)::int FROM ref_intents) AS ref_intents,
      (SELECT COUNT(*)::int FROM ref_preferred_genders) AS ref_preferred_genders,
      (SELECT COUNT(*)::int FROM admin_users) AS admin_users
  `)
  console.log('Seed data:', seeds.rows[0])

  await pool.end()
}

main().catch((e) => {
  console.error('ERR:', e.message)
  pool.end()
  process.exit(1)
})
