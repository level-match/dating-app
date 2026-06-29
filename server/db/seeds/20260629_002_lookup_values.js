/**
 * Seeds all reference (lookup) table values from onboarding.html.
 * IDs are stable — never change existing ones in production; only append.
 * Run after: db/migrations/20260629_004_lookup_tables.js
 *   node db/seeds/20260629_002_lookup_values.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

// ── Data ──────────────────────────────────────────────────────────────

const GENDERS = [
  [1,  'Male'],
  [2,  'Female'],
  [3,  'Non-binary'],
  [4,  'Transgender'],
  [99, 'Custom'],   // sentinel for "Add your own"
]

const PRONOUNS = [
  [1, 'she / her'],
  [2, 'he / him'],
  [3, 'they / them'],
  [4, 'she / they'],
  [5, 'he / they'],
  [6, 'ze / zir'],
  [7, 'xe / xem'],
  [8, 'Just my name'],
]

const ORIENTATIONS = [
  [1,  'Straight'],
  [2,  'Gay'],
  [3,  'Lesbian'],
  [4,  'Bisexual'],
  [5,  'Pansexual'],
  [6,  'Asexual'],
  [7,  'Queer'],
  [99, 'Custom'],   // sentinel for "Add your own"
]

// label, category_slug  — category_slug matches data-intent in onboarding.html
const INTENTS = [
  [1, 'Legacy Builder',              'legacy_builder'],
  [2, 'Intentional Partner',         'intentional_partner'],
  [3, 'Marriage & family',           'family'],
  [4, 'Life partnership',            'life_partnership'],
  [5, 'Ethical non-monogamy',        'enm'],
  [6, 'Casual dating',               'casual'],
  [7, 'Short-term & still exploring','exploring'],
]

const LONG_TERM_VISIONS = [
  [1, 'Settled, building a family — possibly relocating'],
  [2, 'Peak career alongside a serious partner'],
  [3, 'Exploring and growing together'],
  [4, 'Scaled back, focused on what matters'],
  [5, 'Chosen family — by design, not default'],
]

const CAREER_CHAPTERS = [
  [1, 'Scaling'],
  [2, 'Established'],
  [3, 'Transitioning'],
]

const LIFE_INTEGRATIONS = [
  [1, 'Blended'],
  [2, 'Segmented'],
]

const MOBILITY_PROFILES = [
  [1, 'Rooted'],
  [2, 'Frequent traveller'],
  [3, 'Global citizen'],
]

const EMOTIONAL_STYLES = [
  [1, 'I address it directly but calmly'],
  [2, 'I need space to process first'],
  [3, 'I seek to understand first'],
  [4, 'I step back and de-escalate'],
]

const LIFESTYLE_VALUES = [
  [1,  'Fine dining'],
  [2,  'International travel'],
  [3,  'Art & culture'],
  [4,  'Fitness & wellness'],
  [5,  'Live music & theatre'],
  [6,  'Outdoor adventures'],
  [7,  'Wine & spirits'],
  [8,  'Philosophy & ideas'],
  [9,  'Philanthropy'],
  [10, 'Cooking'],
  [11, 'Meditation'],
  [12, 'Sober & curious'],
  [13, 'Reading & literature'],
  [14, 'Architecture'],
  [15, 'Fashion & style'],
  [16, 'Sailing & water'],
  [17, 'Single-parent life'],
  [18, 'LGBTQIA+ community'],
  [19, 'Faith & spirituality'],
  [20, 'Collecting'],
]

// ── Helper ────────────────────────────────────────────────────────────

async function upsertRows(client, table, columns, rows) {
  for (const row of rows) {
    const placeholders = row.map((_, i) => `$${i + 1}`).join(', ')
    const updateCols   = columns.slice(1).map(c => `${c} = EXCLUDED.${c}`).join(', ')
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
       ON CONFLICT (id) DO UPDATE SET ${updateCols}`,
      row,
    )
  }
  console.log(`  [20260629_002] ${table}: ${rows.length} rows upserted.`)
}

// ── Main ──────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await upsertRows(client, 'ref_genders',           ['id', 'label'],                  GENDERS)
    await upsertRows(client, 'ref_pronouns',          ['id', 'label'],                  PRONOUNS)
    await upsertRows(client, 'ref_orientations',      ['id', 'label'],                  ORIENTATIONS)
    await upsertRows(client, 'ref_intents',           ['id', 'label', 'category_slug'], INTENTS)
    await upsertRows(client, 'ref_long_term_visions', ['id', 'label'],                  LONG_TERM_VISIONS)
    await upsertRows(client, 'ref_career_chapters',   ['id', 'label'],                  CAREER_CHAPTERS)
    await upsertRows(client, 'ref_life_integrations', ['id', 'label'],                  LIFE_INTEGRATIONS)
    await upsertRows(client, 'ref_mobility_profiles', ['id', 'label'],                  MOBILITY_PROFILES)
    await upsertRows(client, 'ref_emotional_styles',  ['id', 'label'],                  EMOTIONAL_STYLES)
    await upsertRows(client, 'ref_lifestyle_values',  ['id', 'label'],                  LIFESTYLE_VALUES)

    await client.query('COMMIT')
    console.log('[20260629_002] All reference tables seeded successfully.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260629_002] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
