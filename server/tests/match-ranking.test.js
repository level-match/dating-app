const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  rankMatchItems,
  computeRankScore,
  recencyFactor,
} = require('../utils/match-ranking')

const viewer = { intent_category: 'legacy_builder' }

function item(overrides = {}) {
  return {
    row: {
      id: overrides.id || 'profile-1',
      intent_category: overrides.intent || 'intentional_partner',
      updated_at: overrides.updated_at || new Date().toISOString(),
      alignment_completed_at: overrides.alignment_completed_at || null,
    },
    score: overrides.score ?? 80,
    result: overrides.result || { breakdown: [{ id: 'intention', score: 95, source: 'questionnaire' }] },
  }
}

describe('match-ranking', () => {
  it('ranks fifo tier by compatibility score only', () => {
    const ranked = rankMatchItems([
      item({ id: 'a', score: 78 }),
      item({ id: 'b', score: 92 }),
    ], viewer, 'fifo')

    assert.equal(ranked[0].row.id, 'b')
    assert.equal(ranked[0].rankScore, 92)
  })

  it('boosts preferred-intent pairs for enhanced tier', () => {
    const preferred = item({
      id: 'preferred',
      intent: 'intentional_partner',
      score: 80,
    })
    const aligned = item({
      id: 'aligned',
      intent: 'family',
      score: 80,
    })

    assert.ok(
      computeRankScore(preferred, viewer, 'enhanced')
      > computeRankScore(aligned, viewer, 'enhanced'),
    )
  })

  it('prioritises fresher profiles for realtime tier ties', () => {
    const older = item({
      id: 'older',
      score: 85,
      updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    })
    const newer = item({
      id: 'newer',
      score: 85,
      updated_at: new Date().toISOString(),
      alignment_completed_at: new Date().toISOString(),
    })

    const ranked = rankMatchItems([older, newer], viewer, 'realtime')
    assert.equal(ranked[0].row.id, 'newer')
    assert.ok(ranked[0].rankScore > ranked[1].rankScore)
  })

  it('computes recency factor within window', () => {
    const fresh = recencyFactor({ updated_at: new Date().toISOString() }, 7)
    const stale = recencyFactor(
      { updated_at: new Date(Date.now() - 8 * 86400000).toISOString() },
      7,
    )
    assert.ok(fresh > stale)
    assert.equal(stale, 0)
  })
})
