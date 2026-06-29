require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

/* ═══════════════════════════════════════════════════════════════════════
   Replaces VARCHAR columns in `profiles` with small-integer foreign keys
   pointing at reference (lookup) tables.
   Integer FK comparisons are significantly faster for matching queries.

   Depends on: 20260629_003_profiles_table.js
   Then run:   db/seeds/20260629_002_lookup_values.js
   ═══════════════════════════════════════════════════════════════════════ */

const SQL = `

/* ── Reference tables ──────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS ref_genders (
  id    SMALLINT PRIMARY KEY,
  label TEXT     NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ref_pronouns (
  id    SMALLINT PRIMARY KEY,
  label TEXT     NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ref_orientations (
  id    SMALLINT PRIMARY KEY,
  label TEXT     NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ref_intents (
  id            SMALLINT PRIMARY KEY,
  label         TEXT     NOT NULL UNIQUE,
  category_slug TEXT     NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_long_term_visions (
  id    SMALLINT PRIMARY KEY,
  label TEXT     NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ref_career_chapters (
  id    SMALLINT PRIMARY KEY,
  label TEXT     NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ref_life_integrations (
  id    SMALLINT PRIMARY KEY,
  label TEXT     NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ref_mobility_profiles (
  id    SMALLINT PRIMARY KEY,
  label TEXT     NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ref_emotional_styles (
  id    SMALLINT PRIMARY KEY,
  label TEXT     NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ref_lifestyle_values (
  id    SMALLINT PRIMARY KEY,
  label TEXT     NOT NULL UNIQUE
);

/* ── Drop old VARCHAR / array columns from profiles ────────────────── */

ALTER TABLE profiles
  DROP COLUMN IF EXISTS gender_identity,
  DROP COLUMN IF EXISTS pronouns,
  DROP COLUMN IF EXISTS orientation,
  DROP COLUMN IF EXISTS preferred_genders,
  DROP COLUMN IF EXISTS primary_intent,
  DROP COLUMN IF EXISTS intent_category,
  DROP COLUMN IF EXISTS long_term_vision,
  DROP COLUMN IF EXISTS career_chapter,
  DROP COLUMN IF EXISTS life_integration,
  DROP COLUMN IF EXISTS mobility_profile,
  DROP COLUMN IF EXISTS emotional_compatibility,
  DROP COLUMN IF EXISTS lifestyle_values;

/* ── Add FK columns to profiles ────────────────────────────────────── */

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gender_identity_id     SMALLINT REFERENCES ref_genders(id),
  ADD COLUMN IF NOT EXISTS gender_identity_custom VARCHAR(150),
  ADD COLUMN IF NOT EXISTS orientation_id         SMALLINT REFERENCES ref_orientations(id),
  ADD COLUMN IF NOT EXISTS orientation_custom     VARCHAR(150),
  ADD COLUMN IF NOT EXISTS intent_id              SMALLINT REFERENCES ref_intents(id),
  ADD COLUMN IF NOT EXISTS long_term_vision_id    SMALLINT REFERENCES ref_long_term_visions(id),
  ADD COLUMN IF NOT EXISTS career_chapter_id      SMALLINT REFERENCES ref_career_chapters(id),
  ADD COLUMN IF NOT EXISTS life_integration_id    SMALLINT REFERENCES ref_life_integrations(id),
  ADD COLUMN IF NOT EXISTS mobility_profile_id    SMALLINT REFERENCES ref_mobility_profiles(id),
  ADD COLUMN IF NOT EXISTS emotional_style_id     SMALLINT REFERENCES ref_emotional_styles(id);

/* ── Junction tables for multi-select fields ───────────────────────── */

CREATE TABLE IF NOT EXISTS profile_pronouns (
  profile_id UUID     NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pronoun_id SMALLINT NOT NULL REFERENCES ref_pronouns(id),
  PRIMARY KEY (profile_id, pronoun_id)
);

CREATE TABLE IF NOT EXISTS profile_preferred_genders (
  profile_id UUID     NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gender_id  SMALLINT NOT NULL REFERENCES ref_genders(id),
  PRIMARY KEY (profile_id, gender_id)
);

CREATE TABLE IF NOT EXISTS profile_lifestyle_values (
  profile_id   UUID     NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lifestyle_id SMALLINT NOT NULL REFERENCES ref_lifestyle_values(id),
  PRIMARY KEY (profile_id, lifestyle_id)
);

/* ── Indexes for matching queries ──────────────────────────────────── */

CREATE INDEX IF NOT EXISTS idx_profiles_gender      ON profiles (gender_identity_id);
CREATE INDEX IF NOT EXISTS idx_profiles_orientation ON profiles (orientation_id);
CREATE INDEX IF NOT EXISTS idx_profiles_intent      ON profiles (intent_id);
CREATE INDEX IF NOT EXISTS idx_profiles_mobility    ON profiles (mobility_profile_id);
CREATE INDEX IF NOT EXISTS idx_profiles_career      ON profiles (career_chapter_id);

CREATE INDEX IF NOT EXISTS idx_ppg_gender    ON profile_preferred_genders (gender_id);
CREATE INDEX IF NOT EXISTS idx_plv_lifestyle ON profile_lifestyle_values  (lifestyle_id);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260629_004] Lookup tables and FK columns ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260629_004] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
