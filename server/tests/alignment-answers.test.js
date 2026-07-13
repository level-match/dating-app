const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  normalizeAlignmentAnswers,
  isAlignmentComplete,
  inferPartialAnswersFromProfile,
  buildAlignmentAnswersFromProfile,
  resolveAlignmentAnswers,
  isViewerAlignmentComplete,
  usesQuestionnaireForCategory,
} = require('../utils/alignment-answers')
const { isZeroOutPair, scoreCategoryFromAnswers } = require('../utils/alignment-questions')
const { scoreAlignment } = require('../utils/alignment-scoring')

const fullAnswers = {
  intention: { objective: 4, timeline: 2 },
  mindset: { pillar: 3, success: 2 },
  lifestage: { chapter: 3, partner_drive: 3 },
  lifestyle: { integration: 3, social: 3 },
  mobility: { profile: 2 },
}

const fullAnswersPeer = {
  intention: { objective: 4, timeline: 2 },
  mindset: { pillar: 3, success: 2 },
  lifestage: { chapter: 2, partner_drive: 2 },
  lifestyle: { integration: 2, social: 2 },
  mobility: { profile: 2 },
}

describe('alignment-answers', () => {
  it('normalizes and validates stored answers', () => {
    const normalized = normalizeAlignmentAnswers(fullAnswers)
    assert.equal(normalized.intention.objective, 4)
    assert.equal(isAlignmentComplete(normalized), true)
  })

  it('rejects invalid option values', () => {
    const normalized = normalizeAlignmentAnswers({
      intention: { objective: 99, timeline: 2 },
    })
    assert.equal(normalized?.intention?.objective, undefined)
  })

  it('infers partial answers from onboarding profile fields', () => {
    const inferred = inferPartialAnswersFromProfile({
      intent_category: 'legacy_builder',
      long_term_vision_id: 2,
      career_chapter_id: 1,
      life_integration_id: 1,
      mobility_profile_id: 2,
      emotional_style_id: 1,
    })
    assert.equal(inferred.intention.objective, 4)
    assert.equal(inferred.lifestage.chapter, 3)
    assert.equal(inferred.lifestyle.integration, 3)
    assert.equal(inferred.mobility.profile, 2)
    assert.equal(inferred.mindset.pillar, 3)
    assert.equal(inferred.mindset.success, 1)
    assert.equal(inferred.lifestage.partner_drive, 3)
    assert.equal(inferred.lifestyle.social, 3)
  })

  it('builds complete alignment answers from onboarding profile fields', () => {
    const built = buildAlignmentAnswersFromProfile({
      intent_category: 'legacy_builder',
      long_term_vision_id: 2,
      career_chapter_id: 1,
      life_integration_id: 1,
      mobility_profile_id: 2,
      emotional_style_id: 1,
      lifestyle_value_ids: [1, 2, 3, 4, 5, 6],
    })
    assert.equal(isAlignmentComplete(built), true)
  })

  it('treats onboarding-complete profiles as alignment-complete for matching', () => {
    const profile = {
      intent_category: 'legacy_builder',
      long_term_vision_id: 2,
      career_chapter_id: 1,
      life_integration_id: 1,
      mobility_profile_id: 2,
      emotional_style_id: 1,
    }
    assert.equal(isViewerAlignmentComplete(profile), true)
  })

  it('merges stored answers over inferred profile signals', () => {
    const resolved = resolveAlignmentAnswers({
      intent_category: 'legacy_builder',
      career_chapter_id: 1,
      alignment_answers: {
        mindset: { pillar: 2, success: 3 },
      },
    })
    assert.equal(resolved.intention.objective, 4)
    assert.equal(resolved.mindset.pillar, 2)
    assert.equal(resolved.lifestage.chapter, 3)
  })

  it('detects category completeness for questionnaire scoring', () => {
    const partial = resolveAlignmentAnswers({
      intent_category: 'legacy_builder',
      long_term_vision_id: 2,
      career_chapter_id: 1,
      life_integration_id: 1,
      mobility_profile_id: 2,
      emotional_style_id: 1,
    })
    assert.equal(usesQuestionnaireForCategory(partial, partial, 'intention'), true)
    assert.equal(usesQuestionnaireForCategory(partial, partial, 'mindset'), true)
  })
})

describe('alignment questionnaire scoring', () => {
  it('zeroes out Legacy Builder vs Exploring pairings', () => {
    const legacy = { intention: { objective: 4, timeline: 2 } }
    const exploring = { intention: { objective: 1, timeline: 2 } }
    assert.equal(isZeroOutPair(legacy, exploring), true)

    const result = scoreAlignment(
      { id: 'a', alignment_answers: legacy },
      { id: 'b', alignment_answers: exploring },
    )
    assert.equal(result.overall, 0)
    assert.equal(result.zeroedOut, true)
  })

  it('scores mindset from questionnaire when both users are complete', () => {
    const viewer = { id: 'v', alignment_answers: fullAnswers }
    const candidate = { id: 'c', alignment_answers: fullAnswersPeer }
    const result = scoreAlignment(viewer, candidate, {
      preferredGendersMap: new Map([
        [String(viewer.id), [2]],
        [String(candidate.id), [1]],
      ]),
    })

    assert.equal(result.zeroedOut, false)
    assert.equal(result.breakdown.find(b => b.id === 'mindset').source, 'questionnaire')
    assert.equal(result.breakdown.find(b => b.id === 'lifestage').source, 'questionnaire')
    assert.ok(result.overall >= 75)
  })

  it('uses profile fallback for mindset when onboarding fields are incomplete', () => {
    const viewer = {
      id: 'v',
      emotional_style_id: 1,
      long_term_vision_id: 2,
      alignment_answers: { intention: fullAnswers.intention },
    }
    const candidate = {
      id: 'c',
      emotional_style_id: 1,
      long_term_vision_id: 2,
      alignment_answers: { intention: fullAnswers.intention },
    }
    const result = scoreAlignment(viewer, candidate)
    assert.equal(result.breakdown.find(b => b.id === 'mindset').source, 'profile')
    assert.equal(result.breakdown.find(b => b.id === 'intention').source, 'questionnaire')
  })

  it('scores category similarity from questionnaire answers', () => {
    const score = scoreCategoryFromAnswers('mindset', fullAnswers, fullAnswers)
    assert.equal(score, 1)
  })
})
