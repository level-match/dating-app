const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { applyRecommendationBoost } = require('../utils/match-recommendations')

describe('match-recommendations', () => {
  it('boosts candidates matching preferred intent history', () => {
    const item = {
      row: { intent_category: 'legacy_builder' },
      rankScore: 80,
      result: { breakdown: [{ score: 90 }, { score: 88 }] },
    }
    const signals = {
      preferredIntentSlugs: new Set(['legacy_builder']),
      engagementCount: 2,
    }
    assert.ok(applyRecommendationBoost(80, item, signals) > 80)
  })

  it('returns unchanged score when no engagement history', () => {
    const item = { row: { intent_category: 'family' }, rankScore: 82, result: { breakdown: [] } }
    assert.equal(applyRecommendationBoost(82, item, { engagementCount: 0 }), 82)
  })
})
