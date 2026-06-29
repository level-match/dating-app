const express = require('express')
const pool    = require('../db/pool')

const router = express.Router()

/* ═══════════════════════════════════════════════════════════════════════
   Reference (lookup) data routes — all public, no auth required.
   These return the stable option lists stored in the ref_* tables.

   GET /api/ref/all          → every table in one payload (preferred)
   GET /api/ref/:table       → single table by name
   ═══════════════════════════════════════════════════════════════════════ */

// Map of URL slugs → DB table names
const REF_TABLES = {
  genders:              'ref_genders',
  pronouns:             'ref_pronouns',
  orientations:         'ref_orientations',
  intents:              'ref_intents',
  'preferred-genders':  'ref_preferred_genders',
  'long-term-visions':  'ref_long_term_visions',
  'career-chapters':    'ref_career_chapters',
  'life-integrations':  'ref_life_integrations',
  'mobility-profiles':  'ref_mobility_profiles',
  'emotional-styles':   'ref_emotional_styles',
  'lifestyle-values':   'ref_lifestyle_values',
}

/* ── GET /api/ref/all ───────────────────────────────────────────────────
   Returns every reference table in a single request.
   The frontend caches this on load to avoid per-field round-trips.

   Response shape:
   {
     genders:          [{ id, label }],
     pronouns:         [{ id, label }],
     orientations:     [{ id, label }],
     intents:          [{ id, label, category_slug }],
     longTermVisions:  [{ id, label }],
     careerChapters:   [{ id, label }],
     lifeIntegrations: [{ id, label }],
     mobilityProfiles: [{ id, label }],
     emotionalStyles:  [{ id, label }],
     lifestyleValues:  [{ id, label }],
   }
*/
router.get('/all', async (req, res) => {
  const client = await pool.connect()
  try {
    const [
      genders, pronouns, orientations, intents, preferredGenders,
      longTermVisions, careerChapters, lifeIntegrations,
      mobilityProfiles, emotionalStyles, lifestyleValues,
    ] = await Promise.all(
      Object.values(REF_TABLES).map(t =>
        client.query(`SELECT * FROM ${t} ORDER BY id`)
      )
    )

    res.json({
      genders:          genders.rows,
      pronouns:         pronouns.rows,
      orientations:     orientations.rows,
      intents:          intents.rows,
      preferredGenders: preferredGenders.rows,
      longTermVisions:  longTermVisions.rows,
      careerChapters:   careerChapters.rows,
      lifeIntegrations: lifeIntegrations.rows,
      mobilityProfiles: mobilityProfiles.rows,
      emotionalStyles:  emotionalStyles.rows,
      lifestyleValues:  lifestyleValues.rows,
    })
  } finally {
    client.release()
  }
})

/* ── GET /api/ref/:table ────────────────────────────────────────────────
   Returns a single reference table by slug.
   e.g. GET /api/ref/genders  →  [{ id: 1, label: "Male" }, ...]
*/
router.get('/:table', async (req, res) => {
  const dbTable = REF_TABLES[req.params.table]
  if (!dbTable) {
    return res.status(404).json({ error: 'NOT_FOUND', message: `Unknown ref table: ${req.params.table}` })
  }
  const { rows } = await pool.query(`SELECT * FROM ${dbTable} ORDER BY id`)
  res.json(rows)
})

module.exports = router
