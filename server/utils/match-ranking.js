/**
 * Phase 3 — tier-specific match queue ranking.
 *
 *   base  (fifo)      — compatibility score, stable FIFO tie-break
 *   plus  (enhanced)  — preferred-intent boost + recency
 *   prime (realtime)  — stronger boosts + profile freshness priority
 */

const { INTENT_CATEGORY_TIER } = require('./matching-policy')
const { applyRecommendationBoost } = require('./match-recommendations')

const ALGORITHMS = ['fifo', 'enhanced', 'realtime']

function isPreferredIntent(category) {
  return INTENT_CATEGORY_TIER[category] === 'preferred'
}

function profileTimestamp(row) {
  const raw = row.updated_at || row.created_at
  if (!raw) return 0
  const ms = new Date(raw).getTime()
  return Number.isFinite(ms) ? ms : 0
}

/** @returns {number} 0–1 where 1 = updated within window */
function recencyFactor(row, windowDays) {
  const ts = profileTimestamp(row)
  if (!ts) return 0
  const ageMs = Date.now() - ts
  const windowMs = windowDays * 86400000
  if (ageMs <= 0) return 1
  if (ageMs >= windowMs) return 0
  return 1 - ageMs / windowMs
}

function computeRankScore(item, viewer, algorithm) {
  const { row, score, result } = item
  const base = Number(score) || 0

  if (algorithm === 'fifo') {
    return base
  }

  let rank = base

  if (algorithm === 'enhanced') {
    if (isPreferredIntent(viewer.intent_category) && isPreferredIntent(row.intent_category)) {
      rank += 8
    } else if (viewer.intent_category && viewer.intent_category === row.intent_category) {
      rank += 4
    }
    rank += recencyFactor(row, 14) * 5
    if (row.alignment_completed_at) rank += 2
    return rank
  }

  if (algorithm === 'realtime') {
    if (isPreferredIntent(viewer.intent_category) && isPreferredIntent(row.intent_category)) {
      rank += 10
    } else if (viewer.intent_category && viewer.intent_category === row.intent_category) {
      rank += 5
    }
    rank += recencyFactor(row, 7) * 12
    if (row.alignment_completed_at) rank += 3
    const intention = result?.breakdown?.find(b => b.id === 'intention')
    if (intention?.score >= 90) rank += 4
    const questionnaireDims = (result?.breakdown || []).filter(b => b.source === 'questionnaire').length
    rank += Math.min(questionnaireDims, 5) * 0.5
    return rank
  }

  return base
}

function compareRankedItems(a, b, algorithm) {
  if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore
  if (b.score !== a.score) return b.score - a.score

  const aTs = profileTimestamp(a.row)
  const bTs = profileTimestamp(b.row)
  if (algorithm === 'fifo') {
    if (aTs !== bTs) return aTs - bTs
  } else if (bTs !== aTs) {
    return bTs - aTs
  }

  return String(a.row.id).localeCompare(String(b.row.id))
}

function rankMatchItems(items, viewer, algorithm = 'fifo', recommendationSignals = null) {
  const mode = ALGORITHMS.includes(algorithm) ? algorithm : 'fifo'
  return items
    .map(item => {
      let rankScore = computeRankScore(item, viewer, mode)
      if (recommendationSignals && mode !== 'fifo') {
        rankScore = applyRecommendationBoost(rankScore, item, recommendationSignals)
      }
      return { ...item, rankScore }
    })
    .sort((a, b) => compareRankedItems(a, b, mode))
}

module.exports = {
  ALGORITHMS,
  rankMatchItems,
  computeRankScore,
  recencyFactor,
  isPreferredIntent,
  profileTimestamp,
}
