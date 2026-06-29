require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
CREATE TABLE IF NOT EXISTS profiles (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Identity (from OAuth + onboarding)
  first_name              VARCHAR(100),
  last_name               VARCHAR(100),
  avatar_url              TEXT,

  -- Single-select onboarding answers (populated as VARCHAR initially;
  --   migration 004 converts these to integer FK columns)
  gender_identity         VARCHAR(150),
  pronouns                TEXT[],
  orientation             VARCHAR(150),
  preferred_genders       TEXT[],
  age_range_min           INTEGER,
  age_range_max           INTEGER,
  primary_intent          VARCHAR(200),
  intent_category         VARCHAR(100),
  long_term_vision        VARCHAR(200),
  career_chapter          VARCHAR(150),
  life_integration        VARCHAR(150),
  mobility_profile        VARCHAR(150),
  emotional_compatibility VARCHAR(150),
  lifestyle_values        TEXT[],
  legacy_vision           TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id)
);

CREATE OR REPLACE FUNCTION touch_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_profiles_updated_at();

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260629_003] profiles table ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260629_003] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
