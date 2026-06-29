/**
 * ⚠️  DATABASE RESET — drops ALL tables and data.
 * Use only in development. Never run against production.
 *
 *   node db/reset.js
 *
 * After this, run:  npm run db:fresh
 * which re-runs every migration and seed in order.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const pool = require('./pool')

// Drop order respects FK constraints (children before parents)
const DROP_SQL = `
DROP TABLE IF EXISTS profile_lifestyle_values   CASCADE;
DROP TABLE IF EXISTS profile_preferred_genders  CASCADE;
DROP TABLE IF EXISTS profile_pronouns           CASCADE;
DROP TABLE IF EXISTS ref_preferred_genders      CASCADE;

DROP TABLE IF EXISTS profiles                   CASCADE;

DROP TABLE IF EXISTS ref_lifestyle_values       CASCADE;
DROP TABLE IF EXISTS ref_emotional_styles       CASCADE;
DROP TABLE IF EXISTS ref_mobility_profiles      CASCADE;
DROP TABLE IF EXISTS ref_life_integrations      CASCADE;
DROP TABLE IF EXISTS ref_career_chapters        CASCADE;
DROP TABLE IF EXISTS ref_long_term_visions      CASCADE;
DROP TABLE IF EXISTS ref_intents                CASCADE;
DROP TABLE IF EXISTS ref_orientations           CASCADE;
DROP TABLE IF EXISTS ref_pronouns               CASCADE;
DROP TABLE IF EXISTS ref_genders                CASCADE;

DROP TABLE IF EXISTS subscriptions              CASCADE;
DROP TABLE IF EXISTS payments                   CASCADE;
DROP TABLE IF EXISTS users                      CASCADE;

DROP TABLE IF EXISTS admin_sessions             CASCADE;
DROP TABLE IF EXISTS admin_users                CASCADE;

DROP FUNCTION IF EXISTS touch_profiles_updated_at CASCADE;
`

async function reset() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(DROP_SQL)
    await client.query('COMMIT')
    console.log('[reset] ✓ All tables dropped. Run "npm run db:fresh" to rebuild.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[reset] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

reset()
