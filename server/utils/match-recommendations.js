/**
 * Lightweight recommendation signals from connect / pass / decline behaviour.
 * Boosts candidates that resemble profiles the viewer previously engaged with.
 */

const pool = require('../db/pool')

async function loadViewerRecommendationSignals(userId) {
  const { rows } = await pool.query(
    `SELECT i.category_slug, COUNT(*)::int AS cnt
     FROM (
       SELECT CASE WHEN cr.from_user_id = $1 THEN cr.to_user_id ELSE cr.from_user_id END AS other_user_id
       FROM connection_requests cr
       WHERE cr.status = 'accepted'
         AND (cr.from_user_id = $1 OR cr.to_user_id = $1)
       UNION ALL
       SELECT p.user_id
       FROM match_feedback mf
       JOIN profiles p ON p.id = mf.candidate_profile_id
       WHERE mf.user_id = $1 AND mf.action = 'connect'
     ) engaged
     JOIN profiles p ON p.user_id = engaged.other_user_id
     JOIN ref_intents i ON i.id = p.intent_id
     WHERE i.category_slug IS NOT NULL
     GROUP BY i.category_slug
     ORDER BY cnt DESC`,
    [userId],
  )

  const preferredIntentSlugs = new Set()
  let topCount = 0
  for (const row of rows) {
    if (row.cnt >= topCount) {
      if (row.cnt > topCount) {
        preferredIntentSlugs.clear()
        topCount = row.cnt
      }
      preferredIntentSlugs.add(row.category_slug)
    }
  }

  const passed = await pool.query(
    `SELECT candidate_profile_id FROM match_feedback
     WHERE user_id = $1 AND action IN ('pass', 'decline')`,
    [userId],
  )

  return {
    preferredIntentSlugs,
    passedProfileIds: new Set(passed.rows.map(r => String(r.candidate_profile_id))),
    engagementCount: rows.reduce((n, r) => n + r.cnt, 0),
  }
}

function applyRecommendationBoost(rankScore, item, signals) {
  if (!signals || signals.engagementCount < 1) return rankScore
  let boost = 0
  if (signals.preferredIntentSlugs.has(item.row.intent_category)) {
    boost += 3
  }
  if (item.result?.breakdown) {
    const highDims = item.result.breakdown.filter(b => b.score >= 85).length
    boost += Math.min(highDims, 3) * 0.5
  }
  return rankScore + boost
}

module.exports = {
  loadViewerRecommendationSignals,
  applyRecommendationBoost,
}
