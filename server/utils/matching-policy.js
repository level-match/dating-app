/** Intent guardrail — mirrors client/js/matching-policy.js */

const INTENT_CATEGORY_TIER = {
  legacy_builder:      'preferred',
  intentional_partner: 'preferred',
  family:              'aligned',
  life_partnership:    'aligned',
  enm:                 'aligned',
  long_term:           'aligned',
  casual:              'casual',
  short_term:          'casual',
  exploring:           'casual',
  undefined:           'casual',
}

const CASUAL_CATEGORIES = new Set(['casual', 'short_term', 'exploring', 'undefined'])

function evaluateEligibility(intentCategory) {
  const category = intentCategory || 'undefined'
  const tier = INTENT_CATEGORY_TIER[category] || 'casual'

  if (CASUAL_CATEGORIES.has(category)) {
    return {
      category,
      tier,
      canReceiveMatches: false,
      matchingEligibility: false,
      alignmentStatus: 'Intent Mismatch',
    }
  }

  return {
    category,
    tier,
    canReceiveMatches: true,
    matchingEligibility: true,
    alignmentStatus: tier === 'preferred' ? 'Preferred Alignment' : 'Aligned',
  }
}

function isEligibleIntentCategory(category) {
  return !CASUAL_CATEGORIES.has(category || 'undefined')
}

module.exports = {
  INTENT_CATEGORY_TIER,
  CASUAL_CATEGORIES,
  evaluateEligibility,
  isEligibleIntentCategory,
}
