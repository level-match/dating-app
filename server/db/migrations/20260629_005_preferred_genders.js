require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

/* ═══════════════════════════════════════════════════════════════════════
   "Who do you want to meet?" uses different labels from gender identity.
   This migration creates a dedicated ref_preferred_genders table and
   updates the profile_preferred_genders junction to reference it.

   Depends on: 20260629_004_lookup_tables.js
   ═══════════════════════════════════════════════════════════════════════ */

const SQL = `
CREATE TABLE IF NOT EXISTS ref_preferred_genders (
  id    SMALLINT PRIMARY KEY,
  label TEXT     NOT NULL UNIQUE
);

-- Recreate the junction table with the correct FK
DROP TABLE IF EXISTS profile_preferred_genders;
CREATE TABLE profile_preferred_genders (
  profile_id         UUID     NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  preferred_gender_id SMALLINT NOT NULL REFERENCES ref_preferred_genders(id),
  PRIMARY KEY (profile_id, preferred_gender_id)
);

CREATE INDEX IF NOT EXISTS idx_ppg_preferred_gender ON profile_preferred_genders (preferred_gender_id);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260629_005] ref_preferred_genders ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260629_005] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
