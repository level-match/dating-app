require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS alignment_answers JSONB,
  ADD COLUMN IF NOT EXISTS alignment_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_alignment_completed
  ON profiles (alignment_completed_at)
  WHERE alignment_answers IS NOT NULL;
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260713_019] profile alignment_answers columns ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260713_019] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
