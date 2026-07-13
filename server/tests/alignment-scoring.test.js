const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  scoreAlignment,
  scoreIntentionAlignment,
  scoreMindsetValues,
  scoreLifestyleCompatibility,
  jaccardSimilarity,
  WEIGHTS,
  MATCH_QUEUE_THRESHOLD,
  qualifiesForMatchQueue,
  buildAlignmentSummaryFromBreakdown,
} = require('../utils/alignment-scoring')
const { passesHardFilters, passesAgeHardFilter } = require('../utils/match-filters')

const baseViewer = {
  id: 'viewer-1',
  intent_category: 'legacy_builder',
  career_chapter_id: 2,
  life_integration_id: 1,
  emotional_style_id: 1,
  long_term_vision_id: 2,
  mobility_profile_id: 1,
  age: 34,
  age_range_min: 28,
  age_range_max: 42,
  gender_identity_id: 1,
  country_code: 'US',
  region_code: 'NY',
  city: 'New York',
}

const baseCandidate = {
  id: 'candidate-1',
  intent_category: 'legacy_builder',
  career_chapter_id: 2,
  life_integration_id: 1,
  emotional_style_id: 1,
  long_term_vision_id: 2,
  mobility_profile_id: 2,
  age: 32,
  age_range_min: 30,
  age_range_max: 45,
  gender_identity_id: 2,
  country_code: 'US',
  region_code: 'NY',
  city: 'New York',
  primary_photo_path: 'profile-images/u1/photo.jpg',
  avatar_url: null,
}

describe('alignment-scoring', () => {
  it('weights sum to 100', () => {
    const total = Object.values(WEIGHTS).reduce((s, w) => s + w, 0)
    assert.equal(total, 100)
  })

  it('scores identical profiles highly and deterministically', () => {
    const preferredGendersMap = new Map([
      [String(baseViewer.id), [2]],
      [String(baseCandidate.id), [1]],
    ])
    const lifestyleValuesMap = new Map([
      [String(baseViewer.id), [1, 2, 4]],
      [String(baseCandidate.id), [1, 2, 8]],
    ])

    const first = scoreAlignment(baseViewer, baseCandidate, { preferredGendersMap, lifestyleValuesMap })
    const second = scoreAlignment(baseViewer, baseCandidate, { preferredGendersMap, lifestyleValuesMap })

    assert.equal(first.overall, second.overall)
    assert.ok(first.overall >= 75)
    assert.equal(first.breakdown.length, 6)
    assert.equal(first.breakdown.find(b => b.id === 'intention').score, 100)
  })

  it('gives preferred-tier bonus for different preferred intents', () => {
    const legacy = scoreIntentionAlignment(
      { intent_category: 'legacy_builder' },
      { intent_category: 'intentional_partner' },
    )
    const crossAligned = scoreIntentionAlignment(
      { intent_category: 'legacy_builder' },
      { intent_category: 'family' },
    )
    assert.ok(legacy > crossAligned)
    assert.equal(legacy, 0.9)
    assert.equal(crossAligned, 0.7)
  })

  it('computes lifestyle overlap via jaccard', () => {
    assert.equal(jaccardSimilarity([1, 2], [2, 3]), 1 / 3)
    const score = scoreLifestyleCompatibility(
      { id: 'a', life_integration_id: 1 },
      { id: 'b', life_integration_id: 1 },
      new Map([['a', [1, 2, 3]], ['b', [1, 2, 4]]]),
    )
    assert.ok(score > 0.5)
  })

  it('averages mindset from emotional style and long-term vision', () => {
    const perfect = scoreMindsetValues(baseViewer, baseCandidate)
    const partial = scoreMindsetValues(baseViewer, { ...baseCandidate, long_term_vision_id: 5 })
    assert.equal(perfect, 1)
    assert.ok(partial < perfect)
  })

  it('builds alignment summary from breakdown', () => {
    const { breakdown, overall } = scoreAlignment(baseViewer, baseCandidate, {
      preferredGendersMap: new Map([
        [String(baseViewer.id), [2]],
        [String(baseCandidate.id), [1]],
      ]),
    })
    const summary = buildAlignmentSummaryFromBreakdown(breakdown, overall)
    assert.match(summary, /relationship intent/)
  })

  it('defines a 75% match queue threshold', () => {
    assert.equal(MATCH_QUEUE_THRESHOLD, 75)
    assert.equal(qualifiesForMatchQueue(75), true)
    assert.equal(qualifiesForMatchQueue(74), false)
    assert.equal(qualifiesForMatchQueue(90), true)
  })
})

describe('match-filters', () => {
  it('rejects age outside mutual ranges', () => {
    assert.equal(passesAgeHardFilter(baseViewer, baseCandidate), true)
    assert.equal(
      passesAgeHardFilter(baseViewer, { ...baseCandidate, age: 50 }),
      false,
    )
  })

  it('rejects gender mismatch when preferences are set', () => {
    const prefs = new Map([
      [String(baseViewer.id), [2]],
      [String(baseCandidate.id), [1]],
    ])
    const pass = passesHardFilters(baseViewer, baseCandidate, { preferredGendersMap: prefs })
    assert.equal(pass.pass, true)

    const fail = passesHardFilters(
      baseViewer,
      { ...baseCandidate, gender_identity_id: 1 },
      { preferredGendersMap: prefs },
    )
    assert.equal(fail.pass, false)
    assert.equal(fail.reason, 'gender')
  })

  it('excludes declined connections', () => {
    const result = passesHardFilters(baseViewer, baseCandidate, {
      connection: { status: 'declined' },
    })
    assert.equal(result.pass, false)
    assert.equal(result.reason, 'declined')
  })

  it('hides discretion-mode candidates without a connection', () => {
    const result = passesHardFilters(
      baseViewer,
      { ...baseCandidate, discretion_mode: true },
    )
    assert.equal(result.pass, false)
    assert.equal(result.reason, 'discretion')
  })
})
