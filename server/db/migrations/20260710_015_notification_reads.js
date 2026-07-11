require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
CREATE TABLE IF NOT EXISTS notification_reads (
  user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id VARCHAR(120) NOT NULL,
  read_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user
  ON notification_reads (user_id, read_at DESC);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260710_015] notification_reads table ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260710_015] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
