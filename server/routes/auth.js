const express = require('express')
const jwt     = require('jsonwebtoken')
const pool    = require('../db/pool')

const router = express.Router()

/* ─── Helpers ───────────────────────────────────────────────────*/

/**
 * Verify a Supabase-issued JWT and return the decoded payload.
 * Supabase's JWT secret is base64-encoded — we decode it to raw
 * bytes before passing to jsonwebtoken so HMAC verification works.
 */
function verifySupabaseToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) {
    const err = new Error('Missing or malformed Authorization header.')
    err.code = 'INVALID_TOKEN'
    throw err
  }
  const token     = authHeader.slice(7)
  const rawSecret = process.env.SUPABASE_JWT_SECRET
  if (!rawSecret) {
    const err = new Error('SUPABASE_JWT_SECRET is not configured on the server.')
    err.code = 'SERVER_MISCONFIGURED'
    throw err
  }
  // Supabase signs JWTs with the raw secret string bytes (no base64 decode needed)
  try {
    return jwt.verify(token, rawSecret)
  } catch (e) {
    console.error('[auth] JWT verify failed:', e.message)
    const err = new Error('Invalid or expired token.')
    err.code = 'INVALID_TOKEN'
    throw err
  }
}

/* ─── POST /api/auth/sync ───────────────────────────────────────
   Called after every successful auth (OAuth or email OTP).
   - Upserts the user row into `users`
   - Returns { needsOnboarding: boolean } so the client can route:
       true  → onboarding.html  (new user OR onboarding not done)
       false → dashboard.html   (returning user, onboarding done)
*/
router.post('/sync', async (req, res) => {
  const payload = verifySupabaseToken(req.headers.authorization)

  const supabaseId = payload.sub
  const email      = payload.email || ''

  const client = await pool.connect()
  try {
    // Upsert — insert on first login, do nothing on subsequent logins
    await client.query(
      `INSERT INTO users (external_id, email)
       VALUES ($1, $2)
       ON CONFLICT (external_id) DO NOTHING`,
      [supabaseId, email]
    )

    // Fetch current row — onboarding_complete drives the routing decision
    const { rows } = await client.query(
      'SELECT id, external_id, email, onboarding_complete, created_at FROM users WHERE external_id = $1',
      [supabaseId]
    )

    const user           = rows[0] || null
    const needsOnboarding = !user?.onboarding_complete

    res.json({ needsOnboarding, user })
  } finally {
    client.release()
  }
})

/* ─── POST /api/auth/onboarding-complete ────────────────────────
   Called by onboarding.html when the user finishes onboarding.
   Marks the user so subsequent logins go straight to dashboard.
*/
router.post('/onboarding-complete', async (req, res) => {
  const payload = verifySupabaseToken(req.headers.authorization)

  await pool.query(
    'UPDATE users SET onboarding_complete = TRUE WHERE external_id = $1',
    [payload.sub]
  )

  res.json({ ok: true })
})

/* ─── Label → ID helper ─────────────────────────────────────────
   Looks up a ref table by label. Returns the matching row id, or
   null if the label is blank. For unknown/custom values, returns
   the sentinel id 99 so callers can store the raw text separately.
*/
async function lookupId(client, table, label) {
  if (!label) return null
  const { rows } = await client.query(
    `SELECT id FROM ${table} WHERE label = $1`,
    [label]
  )
  if (rows.length) return rows[0].id
  // Unknown label → treat as custom (id 99 exists in ref table for genders/orientations)
  const { rows: custom } = await client.query(
    `SELECT id FROM ${table} WHERE id = 99`
  )
  return custom.length ? 99 : null
}

/** Resolve an array of labels to their ref-table IDs (skips unknowns). */
async function lookupIds(client, table, labels) {
  if (!Array.isArray(labels) || !labels.length) return []
  const ids = []
  for (const label of labels) {
    const id = await lookupId(client, table, label)
    if (id !== null) ids.push(id)
  }
  return ids
}

/* ─── POST /api/auth/profile ────────────────────────────────────
   Called by onboarding.js on completion. Upserts the profile using
   integer FK references (fast matching) and junction tables for
   multi-select fields (pronouns, preferred genders, lifestyle values).
*/
router.post('/profile', async (req, res) => {
  const payload = verifySupabaseToken(req.headers.authorization)

  const {
    firstName, lastName, avatarUrl,
    genderIdentity, pronouns, orientation, preferredGenders,
    ageRangeMin, ageRangeMax,
    primaryIntent,
    longTermVision, careerChapter,
    lifeIntegration, mobilityProfile,
    emotionalCompatibility, lifestyleValues,
    legacyVision,
  } = req.body || {}

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Resolve internal user id
    const { rows: userRows } = await client.query(
      'SELECT id FROM users WHERE external_id = $1',
      [payload.sub]
    )
    if (!userRows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found. Call /api/auth/sync first.' })
    }
    const userId = userRows[0].id

    // 2. Resolve single-select labels → integer IDs
    const genderIdRes    = await lookupId(client, 'ref_genders',           genderIdentity)
    const orientationRes = await lookupId(client, 'ref_orientations',      orientation)
    const intentRes      = await lookupId(client, 'ref_intents',           primaryIntent)
    const visionRes      = await lookupId(client, 'ref_long_term_visions', longTermVision)
    const careerRes      = await lookupId(client, 'ref_career_chapters',   careerChapter)
    const integrationRes = await lookupId(client, 'ref_life_integrations', lifeIntegration)
    const mobilityRes    = await lookupId(client, 'ref_mobility_profiles', mobilityProfile)
    const emotionRes     = await lookupId(client, 'ref_emotional_styles',  emotionalCompatibility)

    // Custom text — only stored when the sentinel id 99 was returned
    const genderCustom      = genderIdRes    === 99 ? (genderIdentity || null)  : null
    const orientationCustom = orientationRes === 99 ? (orientation    || null)  : null

    // 3. Upsert profile row
    const { rows: profRows } = await client.query(
      `INSERT INTO profiles (
         user_id, first_name, last_name, avatar_url,
         gender_identity_id, gender_identity_custom,
         orientation_id, orientation_custom,
         intent_id,
         age_range_min, age_range_max,
         long_term_vision_id, career_chapter_id,
         life_integration_id, mobility_profile_id,
         emotional_style_id, legacy_vision
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
       )
       ON CONFLICT (user_id) DO UPDATE SET
         first_name              = EXCLUDED.first_name,
         last_name               = EXCLUDED.last_name,
         avatar_url              = EXCLUDED.avatar_url,
         gender_identity_id      = EXCLUDED.gender_identity_id,
         gender_identity_custom  = EXCLUDED.gender_identity_custom,
         orientation_id          = EXCLUDED.orientation_id,
         orientation_custom      = EXCLUDED.orientation_custom,
         intent_id               = EXCLUDED.intent_id,
         age_range_min           = EXCLUDED.age_range_min,
         age_range_max           = EXCLUDED.age_range_max,
         long_term_vision_id     = EXCLUDED.long_term_vision_id,
         career_chapter_id       = EXCLUDED.career_chapter_id,
         life_integration_id     = EXCLUDED.life_integration_id,
         mobility_profile_id     = EXCLUDED.mobility_profile_id,
         emotional_style_id      = EXCLUDED.emotional_style_id,
         legacy_vision           = EXCLUDED.legacy_vision
       RETURNING id`,
      [
        userId,
        firstName  || null,
        lastName   || null,
        avatarUrl  || null,
        genderIdRes,
        genderCustom,
        orientationRes,
        orientationCustom,
        intentRes,
        ageRangeMin  || null,
        ageRangeMax  || null,
        visionRes,
        careerRes,
        integrationRes,
        mobilityRes,
        emotionRes,
        legacyVision || null,
      ]
    )
    const profileId = profRows[0].id

    // 4. Resolve multi-select labels → IDs
    const pronounIds    = await lookupIds(client, 'ref_pronouns',           pronouns         || [])
    const prefGenderIds = await lookupIds(client, 'ref_preferred_genders', preferredGenders || [])
    const lifestyleIds  = await lookupIds(client, 'ref_lifestyle_values',  lifestyleValues  || [])

    // 5. Replace junction rows (delete-then-insert is safe inside a transaction)
    await client.query('DELETE FROM profile_pronouns          WHERE profile_id = $1', [profileId])
    await client.query('DELETE FROM profile_preferred_genders WHERE profile_id = $1', [profileId])
    await client.query('DELETE FROM profile_lifestyle_values  WHERE profile_id = $1', [profileId])

    for (const id of pronounIds) {
      await client.query(
        'INSERT INTO profile_pronouns (profile_id, pronoun_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [profileId, id]
      )
    }
    for (const id of prefGenderIds) {
      await client.query(
        'INSERT INTO profile_preferred_genders (profile_id, preferred_gender_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [profileId, id]
      )
    }
    for (const id of lifestyleIds) {
      await client.query(
        'INSERT INTO profile_lifestyle_values (profile_id, lifestyle_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [profileId, id]
      )
    }

    // 6. Mark onboarding complete
    await client.query(
      'UPDATE users SET onboarding_complete = TRUE WHERE id = $1',
      [userId]
    )

    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[profile] save failed:', err.message)
    res.status(500).json({ error: 'DB_ERROR', message: err.message })
  } finally {
    client.release()
  }
})

/* ─── GET /api/auth/profile ─────────────────────────────────────
   Returns the authenticated user's full profile with all FK columns
   resolved to their human-readable labels.
*/
router.get('/profile', async (req, res) => {
  const payload = verifySupabaseToken(req.headers.authorization)

  const client = await pool.connect()
  try {
    // Main profile row with all single-select labels joined
    const { rows } = await client.query(
      `SELECT
         p.id,
         p.first_name,
         p.last_name,
         p.avatar_url,
         p.age_range_min,
         p.age_range_max,
         p.legacy_vision,
         p.gender_identity_custom,
         p.orientation_custom,
         p.created_at,
         p.updated_at,

         g.id    AS gender_identity_id,
         g.label AS gender_identity,

         o.id    AS orientation_id,
         o.label AS orientation,

         i.id             AS intent_id,
         i.label          AS primary_intent,
         i.category_slug  AS intent_category,

         v.id    AS long_term_vision_id,
         v.label AS long_term_vision,

         c.id    AS career_chapter_id,
         c.label AS career_chapter,

         li.id    AS life_integration_id,
         li.label AS life_integration,

         m.id    AS mobility_profile_id,
         m.label AS mobility_profile,

         e.id    AS emotional_style_id,
         e.label AS emotional_style

       FROM profiles p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN ref_genders           g  ON g.id  = p.gender_identity_id
       LEFT JOIN ref_orientations      o  ON o.id  = p.orientation_id
       LEFT JOIN ref_intents           i  ON i.id  = p.intent_id
       LEFT JOIN ref_long_term_visions v  ON v.id  = p.long_term_vision_id
       LEFT JOIN ref_career_chapters   c  ON c.id  = p.career_chapter_id
       LEFT JOIN ref_life_integrations li ON li.id = p.life_integration_id
       LEFT JOIN ref_mobility_profiles m  ON m.id  = p.mobility_profile_id
       LEFT JOIN ref_emotional_styles  e  ON e.id  = p.emotional_style_id
       WHERE u.external_id = $1`,
      [payload.sub]
    )

    if (!rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Profile not found.' })
    }

    const profile = rows[0]

    // Multi-select: pronouns
    const { rows: pronounRows } = await client.query(
      `SELECT r.id, r.label FROM profile_pronouns pp
       JOIN ref_pronouns r ON r.id = pp.pronoun_id
       WHERE pp.profile_id = $1 ORDER BY r.id`,
      [profile.id]
    )

    // Multi-select: preferred genders
    const { rows: prefGenderRows } = await client.query(
      `SELECT r.id, r.label FROM profile_preferred_genders ppg
       JOIN ref_preferred_genders r ON r.id = ppg.preferred_gender_id
       WHERE ppg.profile_id = $1 ORDER BY r.id`,
      [profile.id]
    )

    // Multi-select: lifestyle values
    const { rows: lifestyleRows } = await client.query(
      `SELECT r.id, r.label FROM profile_lifestyle_values plv
       JOIN ref_lifestyle_values r ON r.id = plv.lifestyle_id
       WHERE plv.profile_id = $1 ORDER BY r.id`,
      [profile.id]
    )

    res.json({
      profile: {
        ...profile,
        // Override gender/orientation label with custom text when applicable
        gender_identity: profile.gender_identity_id === 99
          ? profile.gender_identity_custom
          : profile.gender_identity,
        orientation: profile.orientation_id === 99
          ? profile.orientation_custom
          : profile.orientation,
        pronouns:          pronounRows,
        preferred_genders: prefGenderRows,
        lifestyle_values:  lifestyleRows,
      }
    })
  } finally {
    client.release()
  }
})

/* ─── GET /api/me ───────────────────────────────────────────────
   Returns the authenticated user's row from the users table.
*/
router.get('/me', async (req, res) => {
  const payload = verifySupabaseToken(req.headers.authorization)

  const { rows } = await pool.query(
    'SELECT id, external_id, email, onboarding_complete, created_at FROM users WHERE external_id = $1',
    [payload.sub]
  )

  if (!rows.length) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found. Call /api/auth/sync first.' })
  }

  res.json({ user: rows[0] })
})

module.exports = router
