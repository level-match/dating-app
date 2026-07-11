require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
CREATE TABLE IF NOT EXISTS connection_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_user_id <> to_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_connection_requests_active_pair
  ON connection_requests (
    LEAST(from_user_id, to_user_id),
    GREATEST(from_user_id, to_user_id)
  )
  WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS idx_connection_requests_from
  ON connection_requests (from_user_id, status);

CREATE INDEX IF NOT EXISTS idx_connection_requests_to
  ON connection_requests (to_user_id, status);

CREATE OR REPLACE FUNCTION touch_connection_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_connection_requests_updated_at ON connection_requests;
CREATE TRIGGER trg_connection_requests_updated_at
  BEFORE UPDATE ON connection_requests
  FOR EACH ROW EXECUTE FUNCTION touch_connection_requests_updated_at();
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260710_013] connection_requests table ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260710_013] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
