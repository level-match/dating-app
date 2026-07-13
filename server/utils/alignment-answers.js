/**
 * Persisted alignment questionnaire answers — validation, merge, and profile inference.
 * Onboarding profile fields are the source of truth; alignment_answers is derived on save.
 */

const { QUESTIONNAIRE_CATEGORIES, CATEGORY_BY_ID } = require('./alignment-questions')

const INTENT_OBJECTIVE_BY_SLUG = {
  legacy_builder: 4,
  intentional_partner: 3,
  family: 3,
  life_partnership: 3,
  enm: 2,
  long_term: 2,
  casual: 1,
  exploring: 1,
}

/** ref_intents.id → alignment intention.objective */
const INTENT_ID_TO_OBJECTIVE = {
  1: 4,
  2: 3,
  3: 3,
  4: 3,
  5: 2,
  6: 1,
  7: 1,
}

/** ref_intents.id → category_slug */
const INTENT_ID_TO_SLUG = {
  1: 'legacy_builder',
  2: 'intentional_partner',
  3: 'family',
  4: 'life_partnership',
  5: 'enm',
  6: 'casual',
  7: 'exploring',
}

/** ref_career_chapters.id → alignment lifestage.chapter value */
const CAREER_CHAPTER_TO_ANSWER = {
  1: 3, // Scaling
  2: 2, // Established
  3: 1, // Transitioning
}

/** ref_life_integrations.id → alignment lifestyle.integration value */
const LIFE_INTEGRATION_TO_ANSWER = {
  1: 3, // Blended
  2: 2, // Segmented
}

/** ref_long_term_visions.id → alignment intention.timeline proxy */
const VISION_TO_TIMELINE = {
  1: 3,
  2: 2,
  3: 1,
  4: 2,
  5: 2,
}

/** ref_career_chapters.id → alignment mindset.success proxy */
const CAREER_TO_SUCCESS = {
  1: 1, // Scaling → Achievement
  2: 2, // Established → Influence
  3: 3, // Transitioning → Quality of Life
}

/** ref_long_term_visions.id → mindset.success fallback */
const VISION_TO_SUCCESS = {
  1: 4, // Stability
  2: 1, // Achievement
  3: 3, // Quality of Life
  4: 4,
  5: 2,
}

/** intent category → alignment mindset.pillar proxy */
const INTENT_TO_PILLAR = {
  legacy_builder: 3,
  intentional_partner: 3,
  family: 3,
  life_partnership: 2,
  enm: 1,
  long_term: 2,
  casual: 1,
  exploring: 1,
}

const FAMILY_FIRST_INTENTS = new Set(['family', 'exploring', 'casual'])

function allowedValues(question) {
  return new Set(question.options.map(o => o.value))
}

function normalizeAlignmentAnswers(raw) {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return normalizeAlignmentAnswers(JSON.parse(raw))
    } catch {
      return null
    }
  }
  if (typeof raw !== 'object') return null

  const normalized = {}
  for (const cat of QUESTIONNAIRE_CATEGORIES) {
    const src = raw[cat.id]
    if (!src || typeof src !== 'object') continue
    for (const q of cat.questions) {
      const value = src[q.id]
      if (value == null) continue
      const num = Number(value)
      if (!allowedValues(q).has(num)) continue
      if (!normalized[cat.id]) normalized[cat.id] = {}
      normalized[cat.id][q.id] = num
    }
  }
  return Object.keys(normalized).length ? normalized : null
}

function isCategoryComplete(answers, categoryId) {
  const cat = CATEGORY_BY_ID[categoryId]
  if (!cat || !answers) return false
  return cat.questions.every(q => answers[categoryId]?.[q.id] != null)
}

function isAlignmentComplete(answers) {
  const normalized = normalizeAlignmentAnswers(answers)
  if (!normalized) return false
  return QUESTIONNAIRE_CATEGORIES.every(cat => isCategoryComplete(normalized, cat.id))
}

/**
 * Validate a client payload and return normalized answers or throw with message.
 */
function validateAlignmentPayload(body) {
  const normalized = normalizeAlignmentAnswers(body?.answers ?? body)
  if (!normalized) {
    const err = new Error('Invalid alignment answers payload.')
    err.code = 'VALIDATION_ERROR'
    throw err
  }
  return normalized
}

function resolveIntentCategory(profile) {
  if (profile?.intent_category) return profile.intent_category
  if (profile?.intent_id != null) return INTENT_ID_TO_SLUG[profile.intent_id] || null
  return null
}

function resolveIntentObjective(profile) {
  const category = resolveIntentCategory(profile)
  if (category && INTENT_OBJECTIVE_BY_SLUG[category]) {
    return INTENT_OBJECTIVE_BY_SLUG[category]
  }
  if (profile?.intent_id != null && INTENT_ID_TO_OBJECTIVE[profile.intent_id]) {
    return INTENT_ID_TO_OBJECTIVE[profile.intent_id]
  }
  return null
}

function lifestyleValueIds(profile) {
  if (Array.isArray(profile?.lifestyle_value_ids)) return profile.lifestyle_value_ids
  if (Array.isArray(profile?.lifestyle_values)) {
    return profile.lifestyle_values.map(v => (typeof v === 'object' ? v.id : v)).filter(Boolean)
  }
  return []
}

function inferMindsetPillar(profile) {
  const category = resolveIntentCategory(profile)
  if (category && INTENT_TO_PILLAR[category]) return INTENT_TO_PILLAR[category]
  return null
}

function inferMindsetSuccess(profile) {
  if (profile?.career_chapter_id && CAREER_TO_SUCCESS[profile.career_chapter_id]) {
    return CAREER_TO_SUCCESS[profile.career_chapter_id]
  }
  if (profile?.long_term_vision_id && VISION_TO_SUCCESS[profile.long_term_vision_id]) {
    return VISION_TO_SUCCESS[profile.long_term_vision_id]
  }
  return null
}

function inferPartnerDrive(profile) {
  const category = resolveIntentCategory(profile)
  const chapter = profile?.career_chapter_id

  if (category && FAMILY_FIRST_INTENTS.has(category)) return 1
  if (chapter === 1) return 3 // Scaling → power couple
  if (chapter === 2) return 2 // Established → grounded contrast
  if (chapter === 3) return 1 // Transitioning → family-first cadence
  return 2
}

function inferSocialPreference(profile) {
  const integrationId = profile?.life_integration_id
  let social = null

  if (integrationId === 1) social = 3
  else if (integrationId === 2) social = 1

  const tagCount = lifestyleValueIds(profile).length
  if (tagCount >= 6) social = 3
  else if (tagCount <= 2 && social == null) social = 1
  else if (social == null) social = 2

  return social
}

/** Minimum onboarding fields required to derive a complete alignment payload. */
function hasOnboardingAlignmentFields(profile) {
  if (!profile) return false
  return Boolean(
    resolveIntentObjective(profile)
    && profile.long_term_vision_id
    && profile.career_chapter_id
    && profile.life_integration_id
    && profile.mobility_profile_id
    && profile.emotional_style_id,
  )
}

function inferPartialAnswersFromProfile(profile) {
  if (!profile) return null
  const inferred = {}

  const objective = resolveIntentObjective(profile)
  if (objective != null) {
    inferred.intention = { objective }
    if (profile.long_term_vision_id && VISION_TO_TIMELINE[profile.long_term_vision_id]) {
      inferred.intention.timeline = VISION_TO_TIMELINE[profile.long_term_vision_id]
    }
  }

  const pillar = inferMindsetPillar(profile)
  const success = inferMindsetSuccess(profile)
  if (pillar != null || success != null) {
    inferred.mindset = {}
    if (pillar != null) inferred.mindset.pillar = pillar
    if (success != null) inferred.mindset.success = success
  }

  if (profile.career_chapter_id && CAREER_CHAPTER_TO_ANSWER[profile.career_chapter_id]) {
    inferred.lifestage = {
      chapter: CAREER_CHAPTER_TO_ANSWER[profile.career_chapter_id],
      partner_drive: inferPartnerDrive(profile),
    }
  }

  if (profile.life_integration_id && LIFE_INTEGRATION_TO_ANSWER[profile.life_integration_id]) {
    inferred.lifestyle = {
      integration: LIFE_INTEGRATION_TO_ANSWER[profile.life_integration_id],
      social: inferSocialPreference(profile),
    }
  }

  if (profile.mobility_profile_id != null) {
    const mobility = Number(profile.mobility_profile_id)
    if (mobility >= 1 && mobility <= 3) {
      inferred.mobility = { profile: mobility }
    }
  }

  return Object.keys(inferred).length ? inferred : null
}

/**
 * Build normalized alignment answers from onboarding profile fields.
 * Returns null when required onboarding signals are missing.
 */
function buildAlignmentAnswersFromProfile(profile) {
  if (!hasOnboardingAlignmentFields(profile)) return null
  const inferred = inferPartialAnswersFromProfile(profile)
  const normalized = normalizeAlignmentAnswers(inferred)
  return isAlignmentComplete(normalized) ? normalized : null
}

function mergeAlignmentAnswers(inferred, stored) {
  const base = inferred ? JSON.parse(JSON.stringify(inferred)) : {}
  if (!stored) return Object.keys(base).length ? base : null

  for (const [catId, questions] of Object.entries(stored)) {
    base[catId] = { ...(base[catId] || {}), ...questions }
  }
  return Object.keys(base).length ? base : null
}

/** Stored answers override inferred profile signals. */
function resolveAlignmentAnswers(profile) {
  const stored = normalizeAlignmentAnswers(profile?.alignment_answers)
  const inferred = inferPartialAnswersFromProfile(profile)
  return mergeAlignmentAnswers(inferred, stored)
}

/** Whether the viewer has enough onboarding data for curated matching. */
function isViewerAlignmentComplete(profile) {
  return isAlignmentComplete(resolveAlignmentAnswers(profile))
}

function usesQuestionnaireForCategory(answersA, answersB, categoryId) {
  return isCategoryComplete(answersA, categoryId) && isCategoryComplete(answersB, categoryId)
}

module.exports = {
  INTENT_OBJECTIVE_BY_SLUG,
  normalizeAlignmentAnswers,
  validateAlignmentPayload,
  isCategoryComplete,
  isAlignmentComplete,
  hasOnboardingAlignmentFields,
  inferPartialAnswersFromProfile,
  buildAlignmentAnswersFromProfile,
  mergeAlignmentAnswers,
  resolveAlignmentAnswers,
  isViewerAlignmentComplete,
  usesQuestionnaireForCategory,
}
