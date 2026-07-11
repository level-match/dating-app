require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   UUID        NOT NULL REFERENCES connection_requests(id) ON DELETE CASCADE,
  sender_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT        NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_connection_created
  ON chat_messages (connection_id, created_at);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260710_014] chat_messages table ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260710_014] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
