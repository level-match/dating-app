const express = require('express')
const pool    = require('../db/pool')
const { verifySupabaseToken } = require('../middleware/supabase-auth')
const subscriptionSvc = require('../services/subscription.service')
const { formatLocationLabel } = require('../utils/location')
const {
  validateAlignmentPayload,
  normalizeAlignmentAnswers,
  isAlignmentComplete,
  buildAlignmentAnswersFromProfile,
  isViewerAlignmentComplete,
} = require('../utils/alignment-answers')

const router = express.Router()

/* ─── Helpers ───────────────────────────────────────────────────*/

function authError(message, code) {
  const err = new Error(message)
  err.code = code
  return err
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Look up a user by email and whether they have a saved profile row. */
async function lookupEmailAccount(client, email) {
  const { rows } = await client.query(
    `SELECT u.external_id,
            EXISTS(SELECT 1 FROM profiles p WHERE p.user_id = u.id) AS has_profile
     FROM users u
     WHERE lower(u.email) = lower($1)
     LIMIT 1`,
    [email]
  )
  if (!rows.length) return null
  return { externalId: rows[0].external_id, hasProfile: !!rows[0].has_profile }
}

/* ─── GET /api/auth/check-email ─────────────────────────────────
   Public pre-check before sign-up. Returns whether the email is
   already registered and linked to a profile.
*/
router.get('/check-email', async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Enter a valid email address.' })
  }

  const client = await pool.connect()
  try {
    const account = await lookupEmailAccount(client, email)
    res.json({
      exists: !!account,
      hasProfile: !!account?.hasProfile,
    })
  } finally {
    client.release()
  }
})

/* ─── POST /api/auth/sync ───────────────────────────────────────
   Called after every successful auth (OAuth or email OTP).
   - Upserts the user row into `users`
   - Returns { needsOnboarding: boolean } so the client can route:
       true  → onboarding.html  (new user OR onboarding not done)
       false → dashboard.html   (returning user, onboarding done)
*/
router.post('/sync', async (req, res) => {
  const payload = await verifySupabaseToken(req.headers.authorization)

  const supabaseId = payload.sub
  const email      = payload.email || ''

  const client = await pool.connect()
  try {
    const existing = email ? await lookupEmailAccount(client, email) : null
    if (existing?.hasProfile && existing.externalId !== supabaseId) {
      return res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'An account with this email already exists. Please sign in.',
        redirectToSignIn: true,
      })
    }

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
  const payload = await verifySupabaseToken(req.headers.authorization)

  const { rows } = await pool.query(
    'SELECT id FROM users WHERE external_id = $1',
    [payload.sub]
  )
  if (!rows.length) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found. Call /api/auth/sync first.' })
  }

  await pool.query(
    'UPDATE users SET onboarding_complete = TRUE WHERE external_id = $1',
    [payload.sub]
  )

  const sub = await subscriptionSvc.ensureBaseSubscription(rows[0].id)

  res.json({
    ok: true,
    tier: sub.tier,
    subscription: {
      id:     sub.id,
      status: sub.status,
    },
  })
})

/* ─── Label → ID helper ─────────────────────────────────────────
   Looks up a ref table by label. Returns the matching row id, or
   null if the label is blank. For unknown/custom values, returns
   the sentinel id 99 so callers can store the raw text separately.
*/
async function lookupId(client, table, label) {
  if (!label) return null
  const { rows } = await client.query(
    `SELECT id FROM ${table} WHERE lower(label) = lower($1) LIMIT 1`,
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
  const payload = await verifySupabaseToken(req.headers.authorization)

  const {
    firstName, lastName, avatarUrl,
    professionalTitle, location, education, industry,
    countryCode, countryName, regionCode, regionName, city,
    age, orientationVisibility, blockColleagues, discretionMode,
    mutualOnlyVisibility, readReceipts,
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

    const displayLocation = location || formatLocationLabel({
      city: city || null,
      regionName: regionName || null,
      countryName: countryName || null,
    })

    // 3. Upsert profile row
    const { rows: profRows } = await client.query(
      `INSERT INTO profiles (
         user_id, first_name, last_name, avatar_url,
         professional_title, location, education, industry,
         country_code, country_name, region_code, region_name, city,
         age, orientation_visibility, block_colleagues, discretion_mode,
         mutual_only_visibility, read_receipts,
         gender_identity_id, gender_identity_custom,
         orientation_id, orientation_custom,
         intent_id,
         age_range_min, age_range_max,
         long_term_vision_id, career_chapter_id,
         life_integration_id, mobility_profile_id,
         emotional_style_id, legacy_vision
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
       )
       ON CONFLICT (user_id) DO UPDATE SET
         first_name              = EXCLUDED.first_name,
         last_name               = EXCLUDED.last_name,
         avatar_url              = EXCLUDED.avatar_url,
         professional_title      = EXCLUDED.professional_title,
         location                = EXCLUDED.location,
         education               = EXCLUDED.education,
         industry                = EXCLUDED.industry,
         country_code            = EXCLUDED.country_code,
         country_name            = EXCLUDED.country_name,
         region_code             = EXCLUDED.region_code,
         region_name             = EXCLUDED.region_name,
         city                    = EXCLUDED.city,
         age                     = EXCLUDED.age,
         orientation_visibility  = EXCLUDED.orientation_visibility,
         block_colleagues        = EXCLUDED.block_colleagues,
         discretion_mode         = EXCLUDED.discretion_mode,
         mutual_only_visibility  = EXCLUDED.mutual_only_visibility,
         read_receipts           = EXCLUDED.read_receipts,
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
        professionalTitle || null,
        displayLocation || null,
        education  || null,
        industry   || null,
        countryCode ? String(countryCode).toUpperCase().slice(0, 2) : null,
        countryName || null,
        regionCode  ? String(regionCode).toUpperCase().slice(0, 20) : null,
        regionName  || null,
        city        || null,
        age != null && age !== '' ? Number(age) : null,
        orientationVisibility || null,
        blockColleagues != null ? !!blockColleagues : true,
        discretionMode != null ? !!discretionMode : false,
        mutualOnlyVisibility != null ? !!mutualOnlyVisibility : false,
        readReceipts != null ? !!readReceipts : true,
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

    let intentCategory = null
    if (intentRes) {
      const { rows: intentRows } = await client.query(
        'SELECT category_slug FROM ref_intents WHERE id = $1',
        [intentRes],
      )
      intentCategory = intentRows[0]?.category_slug || null
    }

    const derivedAlignment = buildAlignmentAnswersFromProfile({
      intent_id: intentRes,
      intent_category: intentCategory,
      long_term_vision_id: visionRes,
      career_chapter_id: careerRes,
      life_integration_id: integrationRes,
      mobility_profile_id: mobilityRes,
      emotional_style_id: emotionRes,
      lifestyle_value_ids: lifestyleIds,
    })

    if (derivedAlignment) {
      await client.query(
        `UPDATE profiles
         SET alignment_answers = $2,
             alignment_completed_at = COALESCE(alignment_completed_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [profileId, JSON.stringify(derivedAlignment)],
      )
    }

    // 6. Mark onboarding complete + ensure starting Base subscription
    await client.query(
      'UPDATE users SET onboarding_complete = TRUE WHERE id = $1',
      [userId]
    )

    const subscription = await subscriptionSvc.ensureBaseSubscription(userId, client)

    await client.query('COMMIT')
    res.json({
      ok: true,
      tier: subscription.tier,
      subscription: {
        id:     subscription.id,
        status: subscription.status,
      },
    })
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
  const payload = await verifySupabaseToken(req.headers.authorization)

  const client = await pool.connect()
  try {
    // Main profile row with all single-select labels joined
    const { rows } = await client.query(
      `SELECT
         p.id,
         p.first_name,
         p.last_name,
         p.avatar_url,
         p.professional_title,
         p.location,
         p.country_code,
         p.country_name,
         p.region_code,
         p.region_name,
         p.city,
         p.education,
         p.industry,
         p.age,
         p.orientation_visibility,
         p.block_colleagues,
         p.discretion_mode,
         p.mutual_only_visibility,
         p.read_receipts,
         p.age_range_min,
         p.age_range_max,
         p.legacy_vision,
         p.alignment_answers,
         p.alignment_completed_at,
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
        lifestyle_value_ids: lifestyleRows.map(r => r.id),
        alignment_answers: normalizeAlignmentAnswers(
          profile.alignment_answers
          || buildAlignmentAnswersFromProfile({
            ...profile,
            lifestyle_value_ids: lifestyleRows.map(r => r.id),
          }),
        ),
        alignment_complete: isViewerAlignmentComplete({
          ...profile,
          lifestyle_value_ids: lifestyleRows.map(r => r.id),
        }),
        alignment_completed_at: profile.alignment_completed_at,
      }
    })
  } finally {
    client.release()
  }
})

/* ─── PUT /api/auth/profile/alignment ───────────────────────────
   Persist alignment questionnaire answers for matching.
*/
router.put('/profile/alignment', async (req, res) => {
  const payload = await verifySupabaseToken(req.headers.authorization)

  let answers
  try {
    answers = validateAlignmentPayload(req.body)
  } catch (err) {
    return res.status(400).json({
      error: err.code || 'VALIDATION_ERROR',
      message: err.message,
    })
  }

  const complete = isAlignmentComplete(answers)
  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      `UPDATE profiles p
       SET alignment_answers = $2,
           alignment_completed_at = CASE
             WHEN $3 THEN COALESCE(p.alignment_completed_at, NOW())
             ELSE NULL
           END,
           updated_at = NOW()
       FROM users u
       WHERE p.user_id = u.id AND u.external_id = $1
       RETURNING p.id, p.alignment_answers, p.alignment_completed_at`,
      [payload.sub, JSON.stringify(answers), complete],
    )

    if (!rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Profile not found.' })
    }

    res.json({
      ok: true,
      alignment_answers: normalizeAlignmentAnswers(rows[0].alignment_answers),
      alignment_complete: complete,
      alignment_completed_at: rows[0].alignment_completed_at,
    })
  } catch (err) {
    console.error('[profile/alignment] save failed:', err.message)
    res.status(500).json({ error: 'DB_ERROR', message: err.message })
  } finally {
    client.release()
  }
})

/* ─── GET /api/me ───────────────────────────────────────────────
   Returns the authenticated user's row from the users table.
*/
router.get('/me', async (req, res) => {
  const payload = await verifySupabaseToken(req.headers.authorization)

  const { rows } = await pool.query(
    'SELECT id, external_id, email, onboarding_complete, created_at FROM users WHERE external_id = $1',
    [payload.sub]
  )

  if (!rows.length) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found. Call /api/auth/sync first.' })
  }

  res.json({ user: rows[0] })
})

/* ─── PATCH /api/auth/profile/privacy ─────────────────────────────
   Partial update for privacy fields already stored on profiles.
   Used by Settings (and kept in sync with profile setup).
*/
router.patch('/profile/privacy', async (req, res) => {
  const payload = await verifySupabaseToken(req.headers.authorization)
  const {
    blockColleagues,
    discretionMode,
    mutualOnlyVisibility,
    readReceipts,
  } = req.body || {}

  if (
    blockColleagues == null
    && discretionMode == null
    && mutualOnlyVisibility == null
    && readReceipts == null
  ) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: 'Send at least one privacy field to update.',
    })
  }

  const client = await pool.connect()
  try {
    const { rows: userRows } = await client.query(
      'SELECT id FROM users WHERE external_id = $1',
      [payload.sub]
    )
    if (!userRows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found. Call /api/auth/sync first.' })
    }
    const userId = userRows[0].id

    const blockVal = blockColleagues != null ? !!blockColleagues : null
    const discVal = discretionMode != null ? !!discretionMode : null
    const mutualVal = mutualOnlyVisibility != null ? !!mutualOnlyVisibility : null
    const readVal = readReceipts != null ? !!readReceipts : null

    const { rows } = await client.query(
      `INSERT INTO profiles (
         user_id, block_colleagues, discretion_mode, mutual_only_visibility, read_receipts
       ) VALUES ($1, COALESCE($2, TRUE), COALESCE($3, FALSE), COALESCE($4, FALSE), COALESCE($5, TRUE))
       ON CONFLICT (user_id) DO UPDATE SET
         block_colleagues       = COALESCE($2, profiles.block_colleagues),
         discretion_mode        = COALESCE($3, profiles.discretion_mode),
         mutual_only_visibility = COALESCE($4, profiles.mutual_only_visibility),
         read_receipts          = COALESCE($5, profiles.read_receipts)
       RETURNING block_colleagues, discretion_mode, mutual_only_visibility, read_receipts`,
      [userId, blockVal, discVal, mutualVal, readVal]
    )

    res.json({
      ok: true,
      blockColleagues: !!rows[0].block_colleagues,
      discretionMode: !!rows[0].discretion_mode,
      mutualOnlyVisibility: !!rows[0].mutual_only_visibility,
      readReceipts: !!rows[0].read_receipts,
    })
  } finally {
    client.release()
  }
})

module.exports = router
