/**
 * Persisted alignment questionnaire answers — validation, merge, and profile inference.
 */

const { QUESTIONNAIRE_CATEGORIES, CATEGORY_BY_ID } = require('./alignment-questions')

const INTENT_OBJECTIVE_BY_SLUG = {
  legacy_builder: 4,
  intentional_partner: 3,
  family: 3,
  life_partnership: 3,
  enm: 2,
  long_term: 2,
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

function inferPartialAnswersFromProfile(profile) {
  if (!profile) return null
  const inferred = {}

  if (profile.intent_category && INTENT_OBJECTIVE_BY_SLUG[profile.intent_category]) {
    inferred.intention = {
      objective: INTENT_OBJECTIVE_BY_SLUG[profile.intent_category],
    }
    if (profile.long_term_vision_id && VISION_TO_TIMELINE[profile.long_term_vision_id]) {
      inferred.intention.timeline = VISION_TO_TIMELINE[profile.long_term_vision_id]
    }
  }

  if (profile.career_chapter_id && CAREER_CHAPTER_TO_ANSWER[profile.career_chapter_id]) {
    inferred.lifestage = {
      chapter: CAREER_CHAPTER_TO_ANSWER[profile.career_chapter_id],
    }
  }

  if (profile.life_integration_id && LIFE_INTEGRATION_TO_ANSWER[profile.life_integration_id]) {
    inferred.lifestyle = {
      integration: LIFE_INTEGRATION_TO_ANSWER[profile.life_integration_id],
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

function usesQuestionnaireForCategory(answersA, answersB, categoryId) {
  return isCategoryComplete(answersA, categoryId) && isCategoryComplete(answersB, categoryId)
}

module.exports = {
  INTENT_OBJECTIVE_BY_SLUG,
  normalizeAlignmentAnswers,
  validateAlignmentPayload,
  isCategoryComplete,
  isAlignmentComplete,
  inferPartialAnswersFromProfile,
  mergeAlignmentAnswers,
  resolveAlignmentAnswers,
  usesQuestionnaireForCategory,
}
