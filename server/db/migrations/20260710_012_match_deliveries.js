require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
CREATE TABLE IF NOT EXISTS match_deliveries (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_profile_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delivered_on         DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, candidate_profile_id, delivered_on)
);

CREATE INDEX IF NOT EXISTS idx_match_deliveries_user_date
  ON match_deliveries (user_id, delivered_on);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260710_012] match_deliveries table ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260710_012] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
