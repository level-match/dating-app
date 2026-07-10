require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
  ADD COLUMN IF NOT EXISTS country_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS region_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS region_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS city         VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_profiles_country_code ON profiles (country_code);
CREATE INDEX IF NOT EXISTS idx_profiles_region_code  ON profiles (country_code, region_code);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260710_011] profile location fields ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260710_011] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
