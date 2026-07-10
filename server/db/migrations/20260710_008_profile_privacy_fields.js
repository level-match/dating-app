require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS age                    INTEGER,
  ADD COLUMN IF NOT EXISTS orientation_visibility VARCHAR(80),
  ADD COLUMN IF NOT EXISTS block_colleagues       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS discretion_mode        BOOLEAN NOT NULL DEFAULT FALSE;
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260710_008] profile privacy fields ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260710_008] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
