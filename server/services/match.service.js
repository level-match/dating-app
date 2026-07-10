const pool = require('../db/pool')
const subscriptionSvc = require('./subscription.service')
const { createSignedUrl, BUCKET } = require('./storage.service')
const { evaluateEligibility } = require('../utils/matching-policy')
const { classifyRelativeGeoTier } = require('../utils/geo-matching')
const {
  getEntitlements,
  canAccessGeo,
  requiredTierForGeo,
  getDailyMatchLimit,
} = require('../utils/entitlements')

const CANDIDATE_SQL = `
  SELECT
    p.id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.professional_title,
    p.location,
    p.country_code,
    p.country_name,
    p.region_code,
    p.region_name,
    p.city,
    p.age,
    p.legacy_vision,
    p.career_chapter_id,
    p.life_integration_id,
    p.emotional_style_id,
    i.category_slug  AS intent_category,
    i.label          AS primary_intent,
    c.label          AS career_chapter,
    li.label         AS life_integration,
    e.label          AS emotional_style,
    m.label          AS mobility_profile,
    sub.tier         AS member_tier,
    ph.storage_path  AS primary_photo_path
  FROM profiles p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN ref_intents i ON i.id = p.intent_id
  LEFT JOIN ref_career_chapters c ON c.id = p.career_chapter_id
  LEFT JOIN ref_life_integrations li ON li.id = p.life_integration_id
  LEFT JOIN ref_emotional_styles e ON e.id = p.emotional_style_id
  LEFT JOIN ref_mobility_profiles m ON m.id = p.mobility_profile_id
  LEFT JOIN LATERAL (
    SELECT s.tier
    FROM subscriptions s
    WHERE s.user_id = p.user_id
      AND s.status IN ('active', 'pending', 'past_due')
    ORDER BY s.created_at DESC, s.id DESC
    LIMIT 1
  ) sub ON TRUE
  LEFT JOIN user_profile_photos ph
    ON ph.user_id = p.user_id AND ph.is_primary = TRUE
  WHERE p.user_id <> $1
    AND u.onboarding_complete = TRUE
    AND p.country_code IS NOT NULL
    AND i.category_slug IS NOT NULL
    AND i.category_slug NOT IN ('casual', 'short_term', 'exploring', 'undefined')
`

const VIEWER_SQL = `
  SELECT
    p.*,
    i.category_slug AS intent_category
  FROM profiles p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN ref_intents i ON i.id = p.intent_id
  WHERE p.user_id = $1
`

function formatDisplayName(first, last) {
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (!f) return 'Member'
  if (!l) return f
  return `${f} ${l.charAt(0).toUpperCase()}.`
}

function computeCompatibilityScore(viewer, candidate) {
  let score = 62

  if (viewer.intent_category && viewer.intent_category === candidate.intent_category) {
    score += 12
  }
  if (viewer.career_chapter_id && viewer.career_chapter_id === candidate.career_chapter_id) {
    score += 8
  }
  if (viewer.life_integration_id && viewer.life_integration_id === candidate.life_integration_id) {
    score += 8
  }
  if (viewer.emotional_style_id && viewer.emotional_style_id === candidate.emotional_style_id) {
    score += 6
  }
  if (classifyRelativeGeoTier(viewer, candidate) === 'local') {
    score += 6
  }

  const seed = String(candidate.id).split('').reduce((n, ch) => n + ch.charCodeAt(0), 0)
  score += seed % 9

  return Math.min(99, score)
}

function buildAlignmentSummary(viewer, candidate, score) {
  const parts = []
  if (viewer.career_chapter_id && viewer.career_chapter_id === candidate.career_chapter_id) {
    parts.push('career chapter')
  }
  if (viewer.intent_category && viewer.intent_category === candidate.intent_category) {
    parts.push('relationship intent')
  }
  if (classifyRelativeGeoTier(viewer, candidate) === 'local') {
    parts.push('shared region')
  }
  if (!parts.length) {
    return `Curated introduction · ${score}% alignment based on your profile signals.`
  }
  return `Strong overlap in ${parts.join(', ')}.`
}

async function resolvePhotoUrl(row) {
  if (row.primary_photo_path) {
    const objectPath = row.primary_photo_path.replace(`${BUCKET}/`, '')
    const signed = await createSignedUrl(objectPath, 3600)
    if (signed) return signed
  }
  return row.avatar_url || null
}

async function getTodayDeliveries(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT candidate_profile_id
     FROM match_deliveries
     WHERE user_id = $1 AND delivered_on = CURRENT_DATE`,
    [userId],
  )
  return rows.map(r => r.candidate_profile_id)
}

async function recordDeliveries(userId, profileIds, client = pool) {
  if (!profileIds.length) return
  await client.query(
    `INSERT INTO match_deliveries (user_id, candidate_profile_id, delivered_on)
     SELECT $1, unnest($2::uuid[]), CURRENT_DATE
     ON CONFLICT (user_id, candidate_profile_id, delivered_on) DO NOTHING`,
    [userId, profileIds],
  )
}

async function mapCandidateRow(viewer, row) {
  const geoTier = classifyRelativeGeoTier(viewer, row)
  const score = computeCompatibilityScore(viewer, row)
  return {
    id: row.id,
    userId: row.user_id,
    name: formatDisplayName(row.first_name, row.last_name),
    age: row.age,
    profession: row.professional_title || 'Member',
    location: row.location || [row.city, row.region_name, row.country_name].filter(Boolean).join(', '),
    geoTier,
    score,
    alignmentSummary: buildAlignmentSummary(viewer, row, score),
    status: 'new',
    photo: await resolvePhotoUrl(row),
    memberTier: row.member_tier || 'base',
    intentShort: row.primary_intent || null,
  }
}

/**
 * Returns curated matches for the authenticated user, gated by subscription tier.
 */
async function getMatchesForUser(userId) {
  const viewerRes = await pool.query(VIEWER_SQL, [userId])
  const viewer = viewerRes.rows[0]
  if (!viewer) {
    const err = new Error('Complete your profile before browsing matches.')
    err.code = 'PROFILE_NOT_FOUND'
    throw err
  }

  const eligibility = evaluateEligibility(viewer.intent_category)
  if (!eligibility.matchingEligibility) {
    return {
      matchingEligible: false,
      eligibility,
      tier: 'base',
      geoReach: 'local',
      quota: null,
      matches: [],
      locked: [],
    }
  }

  if (!viewer.country_code) {
    const err = new Error('Add your country and region in profile setup to enable geo matching.')
    err.code = 'LOCATION_REQUIRED'
    throw err
  }

  let sub = await subscriptionSvc.getActiveSubscription(userId)
  if (!sub) {
    sub = await subscriptionSvc.ensureBaseSubscription(userId)
  }

  const tier = sub.tier || 'base'
  const entitlements = getEntitlements(tier)
  const dailyLimit = getDailyMatchLimit(tier)

  const candidateRes = await pool.query(CANDIDATE_SQL, [userId])
  const scored = []

  for (const row of candidateRes.rows) {
    const geoTier = classifyRelativeGeoTier(viewer, row)
    if (!geoTier) continue
    scored.push({ row, geoTier, score: computeCompatibilityScore(viewer, row) })
  }

  scored.sort((a, b) => b.score - a.score)

  const accessible = []
  const locked = []

  for (const item of scored) {
    if (canAccessGeo(tier, item.geoTier)) {
      accessible.push(item)
    } else {
      locked.push({
        id: item.row.id,
        geoTier: item.geoTier,
        requiredTier: requiredTierForGeo(item.geoTier),
        reason: 'geo',
      })
    }
  }

  const deliveredIds = dailyLimit != null ? await getTodayDeliveries(userId) : []
  const deliveredSet = new Set(deliveredIds.map(String))

  let selected = accessible
  let newlyDeliveredIds = []

  if (dailyLimit != null) {
    const alreadyDelivered = accessible.filter(item => deliveredSet.has(String(item.row.id)))
    const fresh = accessible.filter(item => !deliveredSet.has(String(item.row.id)))
    const slotsLeft = Math.max(0, dailyLimit - alreadyDelivered.length)
    selected = [...alreadyDelivered, ...fresh.slice(0, slotsLeft)]
    newlyDeliveredIds = fresh.slice(0, slotsLeft).map(item => item.row.id)
  }

  const matches = []
  for (const item of selected) {
    matches.push(await mapCandidateRow(viewer, item.row))
  }

  if (newlyDeliveredIds.length) {
    await recordDeliveries(userId, newlyDeliveredIds)
  }

  const usedToday = dailyLimit == null
    ? null
    : Math.min(dailyLimit, deliveredIds.length + newlyDeliveredIds.length)

  return {
    matchingEligible: true,
    eligibility,
    tier,
    geoReach: entitlements.geoReach,
    algorithmPriority: entitlements.algorithmPriority,
    quota: dailyLimit == null
      ? { type: 'unlimited' }
      : {
          type: 'capped',
          dailyLimit,
          used: usedToday,
          remaining: Math.max(0, dailyLimit - usedToday),
        },
    matches,
    locked,
    meta: {
      totalCandidates: scored.length,
      accessibleCount: accessible.length,
      lockedCount: locked.length,
    },
  }
}

module.exports = { getMatchesForUser }
