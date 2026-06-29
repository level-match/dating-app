/* ============================================================
   LEVEL — Matching Policy (Intent Guardrail)
   --------------------------------------------------------------
   PROTECTED BUSINESS RULE. This module is the single, authoritative
   source of truth for whether a member is eligible for the curated
   matching network, based on their primary relationship intent.

   LEVEL is built for serious, long-term, intentional partnerships.
   Members whose primary intent is casual / short-term / undefined are
   not admitted into the core matching ecosystem — respectfully, never
   punitively (see the messaging in the UI layer).

   ┌─ Backend migration seam ───────────────────────────────────┐
   │ In production this decision MUST be enforced server-side —  │
   │ the frontend only DISPLAYS the eligibility state returned   │
   │ here. To move it server-side, replace evaluateEligibility() │
   │ with a call to your matching service and keep the SAME       │
   │ return shape:                                               │
   │   { intent, category, tier, canReceiveMatches,              │
   │     matchingEligibility, compatibilityScore, alignmentStatus }│
   │ The UI and store helpers need no changes.                   │
   └─────────────────────────────────────────────────────────────┘
   ============================================================ */

/* Intent category → matching tier.
   preferred → the alignment paths LEVEL actively prioritizes
   aligned   → serious, long-term intent; fully eligible
   casual    → short-term / undefined; excluded from the core network */
export const INTENT_CATEGORY_TIER = {
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

/* Categories that fail the guardrail. */
const CASUAL_CATEGORIES = new Set(['casual', 'short_term', 'exploring', 'undefined'])

/* Fallback map from human labels (as stored from onboarding) → category, used
   only when an explicit data-intent category wasn't captured. Lower-cased,
   matched leniently so copy tweaks don't silently break classification. */
const LABEL_HINTS = [
  [/legacy/, 'legacy_builder'],
  [/intentional/, 'intentional_partner'],
  [/marriage|family/, 'family'],
  [/life partner/, 'life_partnership'],
  [/non-?monogamy|\benm\b|poly/, 'enm'],
  [/long-?term/, 'long_term'],
  [/casual/, 'casual'],
  [/short-?term/, 'short_term'],
  [/explor|undefined|not seeking|no long-?term/, 'exploring'],
]

/**
 * Normalize any intent input (category id OR a stored label) to a category.
 */
export function classifyIntent(intent) {
  if (!intent) return 'undefined'
  const raw = String(intent).trim()
  if (INTENT_CATEGORY_TIER[raw]) return raw            // already a category id
  const lower = raw.toLowerCase()
  for (const [re, cat] of LABEL_HINTS) {
    if (re.test(lower)) return cat
  }
  return 'undefined'
}

export function isCasualIntent(intent) {
  return CASUAL_CATEGORIES.has(classifyIntent(intent))
}

/**
 * The authoritative eligibility decision for a member's primary intent.
 * @param {string} intent - category id or stored intent label
 * @returns canonical eligibility object (stable contract).
 */
export function evaluateEligibility(intent) {
  const category = classifyIntent(intent)
  const tier = INTENT_CATEGORY_TIER[category] || 'casual'

  if (CASUAL_CATEGORIES.has(category)) {
    return {
      intent,
      category,
      tier,
      canReceiveMatches: false,
      matchingEligibility: false,
      compatibilityScore: 0,
      alignmentStatus: 'Intent Mismatch',
    }
  }

  return {
    intent,
    category,
    tier,
    canReceiveMatches: true,
    matchingEligibility: true,
    // Per-pair score is computed by the alignment engine; null = "not gated".
    compatibilityScore: null,
    alignmentStatus: tier === 'preferred' ? 'Preferred Alignment' : 'Aligned',
  }
}
