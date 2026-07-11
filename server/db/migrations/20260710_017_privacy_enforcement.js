require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS mutual_only_visibility BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_receipts           BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS profile_views (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_profile_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_profile
  ON profile_views (viewed_profile_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS chat_message_reads (
  message_id       UUID        NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  reader_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, reader_user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message
  ON chat_message_reads (message_id);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260710_017] privacy fields + views + message reads ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260710_017] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
