/**
 * Phase 2 — weighted alignment scoring engine.
 *
 * Weights (total 100):
 *   Intention Alignment     25
 *   Mindset & Values        20
 *   Life Stage & Career     20
 *   Lifestyle Compatibility 15
 *   Demographic Fit         10
 *   Geographic Mobility     10
 */

const { INTENT_CATEGORY_TIER } = require('./matching-policy')
const { scoreDemographicFit } = require('./demographic-fit')

const WEIGHTS = {
  intention: 25,
  mindset: 20,
  lifestage: 20,
  lifestyle: 15,
  demographic: 10,
  mobility: 10,
}

const DIMENSIONS = [
  { id: 'intention', label: 'Intention Alignment', weight: WEIGHTS.intention },
  { id: 'mindset', label: 'Mindset & Values', weight: WEIGHTS.mindset },
  { id: 'lifestage', label: 'Life Stage & Career', weight: WEIGHTS.lifestage },
  { id: 'lifestyle', label: 'Lifestyle Compatibility', weight: WEIGHTS.lifestyle },
  { id: 'demographic', label: 'Demographic Fit', weight: WEIGHTS.demographic },
  { id: 'mobility', label: 'Geographic Mobility', weight: WEIGHTS.mobility },
]

function exactOrNeutral(a, b, neutral = 0.5) {
  if (a == null || b == null) return neutral
  return a === b ? 1 : 0
}

function ordinalSimilarity(a, b, maxDist) {
  if (a == null || b == null) return 0.5
  if (a === b) return 1
  const dist = Math.abs(Number(a) - Number(b))
  return Math.max(0, 1 - dist / maxDist)
}

function jaccardSimilarity(setA, setB) {
  const a = setA || []
  const b = setB || []
  if (!a.length && !b.length) return 0.5
  if (!a.length || !b.length) return 0.2
  const bSet = new Set(b.map(Number))
  const intersection = a.filter(id => bSet.has(Number(id))).length
  const union = new Set([...a.map(Number), ...b.map(Number)]).size
  return union === 0 ? 0.5 : intersection / union
}

/**
 * Intent category overlap with preferred-tier bonus.
 * Same category = 100%; both preferred = 90%; cross-aligned = 70%.
 */
function scoreIntentionAlignment(viewer, candidate) {
  const vCat = viewer.intent_category
  const cCat = candidate.intent_category
  if (!vCat || !cCat) return 0.5
  if (vCat === cCat) return 1

  const vTier = INTENT_CATEGORY_TIER[vCat] || 'casual'
  const cTier = INTENT_CATEGORY_TIER[cCat] || 'casual'
  if (vTier === 'preferred' && cTier === 'preferred') return 0.9
  if (vTier !== 'casual' && cTier !== 'casual') return 0.7
  return 0.25
}

/** Emotional style + long-term vision (equal split). */
function scoreMindsetValues(viewer, candidate) {
  const emotional = exactOrNeutral(viewer.emotional_style_id, candidate.emotional_style_id, 0.45)
  const vision = ordinalSimilarity(viewer.long_term_vision_id, candidate.long_term_vision_id, 4)
  return (emotional + vision) / 2
}

function scoreLifeStageCareer(viewer, candidate) {
  return exactOrNeutral(viewer.career_chapter_id, candidate.career_chapter_id, 0.45)
}

/** Life integration style + shared lifestyle value tags. */
function scoreLifestyleCompatibility(viewer, candidate, lifestyleValuesMap = new Map()) {
  const integration = exactOrNeutral(viewer.life_integration_id, candidate.life_integration_id, 0.45)
  const viewerTags = lifestyleValuesMap.get(String(viewer.id)) || []
  const candidateTags = lifestyleValuesMap.get(String(candidate.id)) || []
  const overlap = jaccardSimilarity(viewerTags, candidateTags)
  return (integration + overlap) / 2
}

function scoreMobilityProfile(viewer, candidate) {
  return ordinalSimilarity(viewer.mobility_profile_id, candidate.mobility_profile_id, 2)
}

function toDemographicInput(row, preferredGenderIds = []) {
  return {
    ...row,
    preferred_gender_ids: preferredGenderIds,
  }
}

function scoreCategoryScores(viewer, candidate, extras = {}) {
  const {
    preferredGendersMap = new Map(),
    lifestyleValuesMap = new Map(),
  } = extras

  const viewerPrefs = preferredGendersMap.get(String(viewer.id)) || []
  const candidatePrefs = preferredGendersMap.get(String(candidate.id)) || []

  const demographic = scoreDemographicFit(
    toDemographicInput(viewer, viewerPrefs),
    toDemographicInput(candidate, candidatePrefs),
  )

  return {
    intention: scoreIntentionAlignment(viewer, candidate),
    mindset: scoreMindsetValues(viewer, candidate),
    lifestage: scoreLifeStageCareer(viewer, candidate),
    lifestyle: scoreLifestyleCompatibility(viewer, candidate, lifestyleValuesMap),
    demographic: demographic.overall / 100,
    mobility: scoreMobilityProfile(viewer, candidate),
    demographicComponents: demographic.components,
  }
}

/**
 * Full weighted compatibility result.
 * @returns {{ overall: number, breakdown: Array, categoryScores: Object }}
 */
function scoreAlignment(viewer, candidate, extras = {}) {
  const scores = scoreCategoryScores(viewer, candidate, extras)
  let weightedTotal = 0
  const breakdown = DIMENSIONS.map(dim => {
    const raw = dim.id === 'demographic'
      ? scores.demographic
      : scores[dim.id]
    const score = Math.round(raw * 100)
    weightedTotal += raw * dim.weight
    const entry = {
      id: dim.id,
      label: dim.label,
      score,
      weight: dim.weight,
    }
    if (dim.id === 'demographic' && scores.demographicComponents) {
      entry.components = scores.demographicComponents
    }
    return entry
  })

  return {
    overall: Math.round(weightedTotal),
    breakdown,
    categoryScores: scores,
  }
}

/** Top overlap labels for alignment summary copy. */
function buildAlignmentSummaryFromBreakdown(breakdown, score) {
  const parts = []
  const byId = Object.fromEntries(breakdown.map(b => [b.id, b]))

  if (byId.intention?.score >= 90) parts.push('relationship intent')
  if (byId.lifestage?.score >= 100) parts.push('career chapter')
  if (byId.mindset?.score >= 85) parts.push('values')
  if (byId.lifestyle?.score >= 75) parts.push('lifestyle')
  if (byId.demographic?.components?.location >= 75) parts.push('shared region')
  if (byId.demographic?.components?.ageRange >= 100) parts.push('age preferences')
  if (byId.mobility?.score >= 85) parts.push('mobility profile')

  if (!parts.length) {
    return `Curated introduction · ${score}% alignment based on your profile signals.`
  }
  return `Strong overlap in ${parts.join(', ')}.`
}

function buildSharedIndicatorsFromScores(viewer, candidate, scores, lifestyleValuesMap = new Map()) {
  const items = []
  if (scores.intention >= 0.9) {
    items.push({ label: 'Relationship intent', note: 'Aligned on what you are both seeking' })
  }
  if (scores.lifestage >= 1) {
    items.push({ label: 'Career chapter', note: 'In a similar professional season' })
  }
  if (scores.mindset >= 0.85) {
    items.push({ label: 'Values & vision', note: 'Compatible emotional style and long-term outlook' })
  }
  const viewerTags = lifestyleValuesMap.get(String(viewer.id)) || []
  const candidateTags = lifestyleValuesMap.get(String(candidate.id)) || []
  const sharedTags = viewerTags.filter(id => candidateTags.includes(id))
  if (sharedTags.length >= 2) {
    items.push({ label: 'Shared interests', note: `${sharedTags.length} lifestyle values in common` })
  }
  if (scores.demographicComponents?.location >= 75) {
    items.push({ label: 'Shared region', note: 'Based in the same part of the country' })
  }
  if (viewer.long_term_vision_id && viewer.long_term_vision_id === candidate.long_term_vision_id) {
    items.push({ label: 'Long-term vision', note: 'Similar picture of the future' })
  }
  return items
}

module.exports = {
  WEIGHTS,
  DIMENSIONS,
  scoreAlignment,
  scoreCategoryScores,
  scoreIntentionAlignment,
  scoreMindsetValues,
  scoreLifeStageCareer,
  scoreLifestyleCompatibility,
  scoreMobilityProfile,
  buildAlignmentSummaryFromBreakdown,
  buildSharedIndicatorsFromScores,
  jaccardSimilarity,
  ordinalSimilarity,
}
