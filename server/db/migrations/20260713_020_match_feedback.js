require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
CREATE TABLE IF NOT EXISTS match_feedback (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_profile_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action               VARCHAR(16) NOT NULL CHECK (action IN ('pass', 'decline', 'connect')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, candidate_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_match_feedback_user
  ON match_feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_feedback_candidate
  ON match_feedback (candidate_profile_id);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260713_020] match_feedback table ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260713_020] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
