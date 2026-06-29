require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS professional_title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS location          VARCHAR(200),
  ADD COLUMN IF NOT EXISTS education           TEXT,
  ADD COLUMN IF NOT EXISTS industry            VARCHAR(150);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260629_006] profile setup fields ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260629_006] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
