require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
CREATE TABLE IF NOT EXISTS user_profile_photos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path   TEXT        NOT NULL,
  bucket         VARCHAR(100) NOT NULL DEFAULT 'profile-images',
  file_name      VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(50)  NOT NULL,
  file_size      INTEGER     NOT NULL,
  width          INTEGER     NOT NULL,
  height         INTEGER     NOT NULL,
  display_order  SMALLINT    NOT NULL,
  is_primary     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profile_photos_primary
  ON user_profile_photos (user_id)
  WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_profile_photos_user_order
  ON user_profile_photos (user_id, display_order);

CREATE OR REPLACE FUNCTION update_user_profile_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_profile_photos_updated_at ON user_profile_photos;
CREATE TRIGGER trg_user_profile_photos_updated_at
  BEFORE UPDATE ON user_profile_photos
  FOR EACH ROW EXECUTE FUNCTION update_user_profile_photos_updated_at();
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260710_009] user_profile_photos table ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260710_009] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
