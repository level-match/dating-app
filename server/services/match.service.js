const pool = require('../db/pool')
const subscriptionSvc = require('./subscription.service')
const { createSignedUrl, BUCKET } = require('./storage.service')
const { evaluateEligibility, isEligibleIntentCategory } = require('../utils/matching-policy')
const { classifyRelativeGeoTier } = require('../utils/geo-matching')
const { passesHardFilters } = require('../utils/match-filters')
const { rankMatchItems } = require('../utils/match-ranking')
const { loadViewerRecommendationSignals } = require('../utils/match-recommendations')
const { isAlignmentComplete } = require('../utils/alignment-answers')
const {
  scoreAlignment,
  buildAlignmentSummaryFromBreakdown,
  buildSharedIndicatorsFromScores,
  qualifiesForMatchQueue,
} = require('../utils/alignment-scoring')
const {
  getEntitlements,
  canAccessGeo,
  requiredTierForGeo,
  getDailyMatchLimit,
} = require('../utils/entitlements')
const {
  shouldBlockColleaguePair,
  applyMutualOnlyVisibility,
} = require('../utils/privacy')

const PROFILE_SELECT = `
  SELECT
    p.id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.professional_title,
    p.industry,
    p.education,
    p.location,
    p.country_code,
    p.country_name,
    p.region_code,
    p.region_name,
    p.city,
    p.age,
    p.age_range_min,
    p.age_range_max,
    p.block_colleagues,
    p.discretion_mode,
    p.mutual_only_visibility,
    p.read_receipts,
    p.legacy_vision,
    p.career_chapter_id,
    p.life_integration_id,
    p.emotional_style_id,
    p.long_term_vision_id,
    p.mobility_profile_id,
    p.alignment_answers,
    p.alignment_completed_at,
    p.created_at,
    p.updated_at,
    p.gender_identity_custom,
    p.orientation_custom,
    g.id    AS gender_identity_id,
    g.label AS gender_identity,
    o.label AS orientation,
    i.category_slug  AS intent_category,
    i.label          AS primary_intent,
    v.label          AS long_term_vision,
    c.label          AS career_chapter,
    li.label         AS life_integration,
    e.label          AS emotional_style,
    m.label          AS mobility_profile,
    sub.tier         AS member_tier,
    ph.storage_path  AS primary_photo_path
  FROM profiles p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN ref_genders g ON g.id = p.gender_identity_id
  LEFT JOIN ref_orientations o ON o.id = p.orientation_id
  LEFT JOIN ref_intents i ON i.id = p.intent_id
  LEFT JOIN ref_long_term_visions v ON v.id = p.long_term_vision_id
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
`

const CANDIDATE_SQL = `
  ${PROFILE_SELECT}
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

async function loadPreferredGenderIdsByProfile(profileIds) {
  if (!profileIds.length) return new Map()
  const { rows } = await pool.query(
    `SELECT profile_id, preferred_gender_id
     FROM profile_preferred_genders
     WHERE profile_id = ANY($1::uuid[])`,
    [profileIds],
  )
  const map = new Map()
  for (const row of rows) {
    const key = String(row.profile_id)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row.preferred_gender_id)
  }
  return map
}

async function loadLifestyleValueIdsByProfile(profileIds) {
  if (!profileIds.length) return new Map()
  const { rows } = await pool.query(
    `SELECT profile_id, lifestyle_id
     FROM profile_lifestyle_values
     WHERE profile_id = ANY($1::uuid[])`,
    [profileIds],
  )
  const map = new Map()
  for (const row of rows) {
    const key = String(row.profile_id)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row.lifestyle_id)
  }
  return map
}

function buildScoringContext(preferredGendersMap, lifestyleValuesMap) {
  return { preferredGendersMap, lifestyleValuesMap }
}

function scoreMatchPair(viewer, candidate, scoringContext = {}) {
  return scoreAlignment(viewer, candidate, scoringContext)
}

function computeCompatibilityScore(viewer, candidate, scoringContext = {}) {
  return scoreMatchPair(viewer, candidate, scoringContext).overall
}

function mapConnectionStatus(connection, viewerUserId) {
  if (!connection) return { status: 'new', connectionStatus: 'none' }

  if (connection.status === 'accepted') {
    return { status: 'mutual', connectionStatus: 'mutual' }
  }

  if (connection.status === 'pending') {
    if (connection.from_user_id === viewerUserId) {
      return { status: 'pending', connectionStatus: 'pending_sent' }
    }
    return { status: 'request', connectionStatus: 'pending_received' }
  }

  return { status: 'new', connectionStatus: connection.status }
}

async function resolvePhotoUrl(row) {
  if (row.primary_photo_path) {
    const objectPath = row.primary_photo_path.replace(`${BUCKET}/`, '')
    const signed = await createSignedUrl(objectPath, 3600)
    if (signed) return signed
  }
  return row.avatar_url || null
}

async function loadProfileExtras(profileId) {
  const [pronouns, lifestyle] = await Promise.all([
    pool.query(
      `SELECT r.label FROM profile_pronouns pp
       JOIN ref_pronouns r ON r.id = pp.pronoun_id
       WHERE pp.profile_id = $1 ORDER BY r.id`,
      [profileId],
    ),
    pool.query(
      `SELECT r.label FROM profile_lifestyle_values plv
       JOIN ref_lifestyle_values r ON r.id = plv.lifestyle_id
       WHERE plv.profile_id = $1 ORDER BY r.id`,
      [profileId],
    ),
  ])

  return {
    pronouns: pronouns.rows.map(r => r.label).join(' · ') || '—',
    lifestyleValues: lifestyle.rows.map(r => r.label),
  }
}

async function getConnectionBetween(userA, userB) {
  const { rows } = await pool.query(
    `SELECT * FROM connection_requests
     WHERE status IN ('pending', 'accepted')
       AND (
         (from_user_id = $1 AND to_user_id = $2)
         OR (from_user_id = $2 AND to_user_id = $1)
       )
     ORDER BY created_at DESC
     LIMIT 1`,
    [userA, userB],
  )
  return rows[0] || null
}

async function loadConnectionsForViewer(viewerUserId, candidateUserIds) {
  if (!candidateUserIds.length) return new Map()

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (other_id) *
     FROM (
       SELECT cr.*,
         CASE WHEN cr.from_user_id = $1 THEN cr.to_user_id ELSE cr.from_user_id END AS other_id
       FROM connection_requests cr
       WHERE (cr.from_user_id = $1 AND cr.to_user_id = ANY($2::uuid[]))
          OR (cr.to_user_id = $1 AND cr.from_user_id = ANY($2::uuid[]))
     ) pairs
     ORDER BY other_id, created_at DESC`,
    [viewerUserId, candidateUserIds],
  )

  const map = new Map()
  for (const row of rows) {
    const otherId = row.from_user_id === viewerUserId ? row.to_user_id : row.from_user_id
    if (!map.has(otherId)) map.set(otherId, row)
  }
  return map
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

async function wasDeliveredToday(userId, profileId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM match_deliveries
     WHERE user_id = $1 AND candidate_profile_id = $2 AND delivered_on = CURRENT_DATE
     LIMIT 1`,
    [userId, profileId],
  )
  return rows.length > 0
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

async function mapCandidateRow(viewer, row, connection = null, scoringContext = {}) {
  const geoTier = classifyRelativeGeoTier(viewer, row)
  const result = scoreMatchPair(viewer, row, scoringContext)
  const conn = mapConnectionStatus(connection, viewer.user_id || viewer.id)
  const photo = await resolvePhotoUrl(row)

  return {
    id: row.id,
    userId: row.user_id,
    name: formatDisplayName(row.first_name, row.last_name),
    age: row.age,
    profession: row.professional_title || 'Member',
    location: row.location || [row.city, row.region_name, row.country_name].filter(Boolean).join(', '),
    geoTier,
    score: result.overall,
    alignmentSummary: buildAlignmentSummaryFromBreakdown(result.breakdown, result.overall),
    compatibilityBreakdown: result.breakdown.map(({ id, label, score, source }) => ({
      id,
      label,
      score,
      source: source || null,
    })),
    status: conn.status,
    connectionStatus: conn.connectionStatus,
    connectionId: connection?.id || null,
    photo,
    memberTier: row.member_tier || 'base',
    intentShort: row.primary_intent || null,
  }
}

async function recordProfileView(viewerUserId, profileId, viewerRow) {
  if (viewerRow?.discretion_mode) return
  await pool.query(
    `INSERT INTO profile_views (viewer_user_id, viewed_profile_id)
     VALUES ($1, $2)`,
    [viewerUserId, profileId],
  )
}

async function mapPublicProfile(viewer, row, {
  connection, score, geoTier, geoAccessible, scoringContext = {}, compatibilityResult = null,
}) {
  const extras = await loadProfileExtras(row.id)
  const conn = mapConnectionStatus(connection, viewer.user_id)
  const photo = await resolvePhotoUrl(row)
  const legacy = row.legacy_vision || ''
  const result = compatibilityResult || scoreMatchPair(viewer, row, scoringContext)
  const resolvedScore = score ?? result.overall

  const badges = []
  if (photo) badges.push('photo')
  if (row.member_tier === 'prime' || row.member_tier === 'plus') badges.push('premium')

  const fullProfile = {
    id: row.id,
    userId: row.user_id,
    name: formatDisplayName(row.first_name, row.last_name),
    age: row.age,
    pronouns: extras.pronouns,
    photo,
    fallback: 'linear-gradient(160deg,#1A2F4A,#0D1E35,#1E1008)',
    score: resolvedScore,
    compatibilityBreakdown: result.breakdown,
    profession: row.professional_title || 'Member',
    company: row.industry || '',
    location: row.location || [row.city, row.region_name, row.country_name].filter(Boolean).join(', '),
    mobility: row.mobility_profile || '',
    geoTier,
    geoAccessible,
    status: conn.status,
    connectionStatus: conn.connectionStatus,
    connectionId: connection?.id || null,
    memberTier: row.member_tier || 'base',
    intentShort: row.primary_intent || null,
    intentLong: row.primary_intent
      ? `Looking for ${String(row.primary_intent).toLowerCase()}.`
      : '',
    alignmentSummary: buildAlignmentSummaryFromBreakdown(result.breakdown, resolvedScore),
    badges,
    overview: {
      quote: legacy ? legacy.split(/[.!?]/)[0]?.trim() : '',
      paragraphs: legacy ? [legacy] : [],
    },
    legacy,
    career: [],
    values: extras.lifestyleValues,
    principles: [],
    lifestyle: [
      { label: 'Career chapter', value: row.career_chapter || '—' },
      { label: 'Life integration', value: row.life_integration || '—' },
      { label: 'Emotional style', value: row.emotional_style || '—' },
    ].filter(r => r.value && r.value !== '—'),
    relationship: [
      { label: 'Primary intent', value: row.primary_intent || '—' },
      { label: 'Long-term vision', value: row.long_term_vision || '—' },
    ].filter(r => r.value && r.value !== '—'),
    shared: buildSharedIndicatorsFromScores(
      viewer,
      row,
      result.categoryScores,
      scoringContext.lifestyleValuesMap,
    ),
  }

  return applyMutualOnlyVisibility(fullProfile, row, connection)
}

async function loadScoringContextForProfiles(profileIds) {
  const [preferredGendersMap, lifestyleValuesMap] = await Promise.all([
    loadPreferredGenderIdsByProfile(profileIds),
    loadLifestyleValueIdsByProfile(profileIds),
  ])
  return buildScoringContext(preferredGendersMap, lifestyleValuesMap)
}

async function scoringContextForPair(viewer, candidate) {
  return loadScoringContextForProfiles([viewer.id, candidate.id])
}

async function loadViewer(userId) {
  const viewerRes = await pool.query(VIEWER_SQL, [userId])
  const viewer = viewerRes.rows[0]
  if (!viewer) {
    const err = new Error('Complete your profile before browsing matches.')
    err.code = 'PROFILE_NOT_FOUND'
    throw err
  }
  viewer.user_id = viewer.user_id || userId
  return viewer
}

async function loadCandidateByProfileId(profileId) {
  const { rows } = await pool.query(
    `${PROFILE_SELECT}
     WHERE p.id = $1
       AND u.onboarding_complete = TRUE`,
    [profileId],
  )
  return rows[0] || null
}

async function assertViewerCanBrowse(viewer) {
  const eligibility = evaluateEligibility(viewer.intent_category)
  if (!eligibility.matchingEligibility) {
    const err = new Error('Your relationship goals are not eligible for the matching network.')
    err.code = 'INTENT_INELIGIBLE'
    throw err
  }
  if (!viewer.country_code) {
    const err = new Error('Add your country and region in profile setup to enable geo matching.')
    err.code = 'LOCATION_REQUIRED'
    throw err
  }
  return eligibility
}

async function getViewerTier(userId) {
  let sub = await subscriptionSvc.getActiveSubscription(userId)
  if (!sub) sub = await subscriptionSvc.ensureBaseSubscription(userId)
  return sub.tier || 'base'
}

async function assertGeoAccess(viewerUserId, tier, viewer, candidate, connection) {
  const geoTier = classifyRelativeGeoTier(viewer, candidate)
  if (!geoTier) return { geoTier, geoAccessible: false }

  const geoAccessible = canAccessGeo(tier, geoTier)
  if (geoAccessible) return { geoTier, geoAccessible: true }

  if (connection) return { geoTier, geoAccessible: true }

  const delivered = await wasDeliveredToday(viewerUserId, candidate.id)
  if (delivered) return { geoTier, geoAccessible: true }

  const err = new Error(`This profile requires ${requiredTierForGeo(geoTier)} membership to view.`)
  err.code = 'GEO_LOCKED'
  err.requiredTier = requiredTierForGeo(geoTier)
  err.geoTier = geoTier
  throw err
}

/**
 * Returns curated matches for the authenticated user, gated by subscription tier.
 */
async function getMatchesForUser(userId) {
  const viewer = await loadViewer(userId)
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

  const tier = await getViewerTier(userId)
  const entitlements = getEntitlements(tier)

  if (!isAlignmentComplete(viewer.alignment_answers)) {
    return {
      matchingEligible: true,
      alignmentRequired: true,
      eligibility,
      tier,
      geoReach: entitlements.geoReach,
      algorithmPriority: entitlements.algorithmPriority,
      quota: null,
      matches: [],
      locked: [],
      stats: { total: 0, new: 0, mutual: 0, pending: 0 },
      meta: { reason: 'alignment_incomplete' },
    }
  }

  const dailyLimit = getDailyMatchLimit(tier)

  const candidateRes = await pool.query(CANDIDATE_SQL, [userId])
  const connections = await loadConnectionsForViewer(
    userId,
    candidateRes.rows.map(r => r.user_id),
  )

  const scoringContext = await loadScoringContextForProfiles([
    viewer.id,
    ...candidateRes.rows.map(r => r.id),
  ])

  const recommendationSignals = await loadViewerRecommendationSignals(userId)

  const scored = []
  let filteredCount = 0
  let belowThresholdCount = 0
  for (const row of candidateRes.rows) {
    const connection = connections.get(row.user_id) || null
    const isActiveConnection = connection
      && (connection.status === 'pending' || connection.status === 'accepted')

    if (!isActiveConnection) {
      if (shouldBlockColleaguePair(viewer, row)) continue
      if (recommendationSignals.passedProfileIds.has(String(row.id))) {
        filteredCount++
        continue
      }
      const gate = passesHardFilters(viewer, row, {
        preferredGendersMap: scoringContext.preferredGendersMap,
        connection,
      })
      if (!gate.pass) {
        filteredCount++
        continue
      }
    } else if (connection.status === 'declined' || connection.status === 'withdrawn') {
      continue
    }

    const geoTier = classifyRelativeGeoTier(viewer, row)
    if (!geoTier) continue
    const result = scoreMatchPair(viewer, row, scoringContext)
    if (!isActiveConnection && !qualifiesForMatchQueue(result.overall)) {
      belowThresholdCount++
      continue
    }
    scored.push({
      row,
      geoTier,
      score: result.overall,
      connection,
      result,
    })
  }

  const ranked = rankMatchItems(scored, viewer, entitlements.algorithmPriority, recommendationSignals)

  const accessible = []
  const locked = []

  for (const item of ranked) {
    if (canAccessGeo(tier, item.geoTier) || item.connection) {
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
    matches.push(await mapCandidateRow(viewer, item.row, item.connection, scoringContext))
  }

  if (newlyDeliveredIds.length) {
    await recordDeliveries(userId, newlyDeliveredIds)
  }

  const usedToday = dailyLimit == null
    ? null
    : Math.min(dailyLimit, deliveredIds.length + newlyDeliveredIds.length)

  const curatedMatches = matches
  const connectionMatches = await loadConnectionFeedProfiles(userId, viewer, scoringContext)
  const merged = mergeMatchLists(curatedMatches, connectionMatches)
  const stats = buildMatchStats(merged)

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
    matches: merged,
    locked,
    stats,
    meta: {
      totalCandidates: candidateRes.rows.length,
      scoredCount: scored.length,
      filteredCount,
      belowThresholdCount,
      accessibleCount: accessible.length,
      lockedCount: locked.length,
      connectionCount: connectionMatches.length,
      rankingAlgorithm: entitlements.algorithmPriority,
    },
  }
}

const CONNECTION_PROFILES_SQL = `
  ${PROFILE_SELECT}
  JOIN connection_requests cr ON (
    (cr.from_user_id = $1 AND cr.to_user_id = p.user_id)
    OR (cr.to_user_id = $1 AND cr.from_user_id = p.user_id)
  )
  WHERE cr.status IN ('pending', 'accepted')
    AND p.user_id <> $1
    AND u.onboarding_complete = TRUE
`

async function loadConnectionFeedProfiles(viewerUserId, viewer, scoringContext = null) {
  const { rows } = await pool.query(CONNECTION_PROFILES_SQL, [viewerUserId])
  const connections = await loadConnectionsForViewer(
    viewerUserId,
    rows.map(r => r.user_id),
  )

  const context = scoringContext || await loadScoringContextForProfiles([
    viewer.id,
    ...rows.map(r => r.id),
  ])

  const items = []
  for (const row of rows) {
    items.push(await mapCandidateRow(
      viewer,
      row,
      connections.get(row.user_id) || null,
      context,
    ))
  }
  return items
}

function mergeMatchLists(curated, connected) {
  const map = new Map()

  for (const match of curated) {
    map.set(String(match.id), match)
  }

  for (const match of connected) {
    map.set(String(match.id), match)
  }

  const list = Array.from(map.values())
  const rank = { request: 0, mutual: 1, pending: 2, new: 3 }

  list.sort((a, b) => {
    const ra = rank[a.status] ?? 4
    const rb = rank[b.status] ?? 4
    if (ra !== rb) return ra - rb
    return (b.score || 0) - (a.score || 0)
  })

  return list
}

function buildMatchStats(matches) {
  const mutual = matches.filter(m => m.status === 'mutual').length
  const pendingSent = matches.filter(m => m.status === 'pending').length
  const incoming = matches.filter(m => m.status === 'request').length

  return {
    total: matches.length,
    new: matches.filter(m => m.status === 'new').length,
    mutual,
    pending: pendingSent + incoming,
    incoming,
  }
}

/**
 * Public match profile for profile.html.
 */
async function getMatchProfile(viewerUserId, profileId) {
  const viewer = await loadViewer(viewerUserId)
  await assertViewerCanBrowse(viewer)

  const candidate = await loadCandidateByProfileId(profileId)

  if (!candidate) {
    const err = new Error('Profile not found.')
    err.code = 'NOT_FOUND'
    throw err
  }

  if (candidate.user_id === viewerUserId) {
    const err = new Error('Use profile setup to view your own profile.')
    err.code = 'FORBIDDEN'
    throw err
  }

  if (!isEligibleIntentCategory(candidate.intent_category) || !candidate.country_code) {
    const err = new Error('Profile not available.')
    err.code = 'NOT_FOUND'
    throw err
  }

  const tier = await getViewerTier(viewerUserId)
  const connection = await getConnectionBetween(viewerUserId, candidate.user_id)

  if (!connection && shouldBlockColleaguePair(viewer, candidate)) {
    const err = new Error('Profile not available.')
    err.code = 'NOT_FOUND'
    throw err
  }

  const scoringContext = await scoringContextForPair(viewer, candidate)
  const isActiveConnection = connection
    && (connection.status === 'pending' || connection.status === 'accepted')

  if (!isActiveConnection) {
    const gate = passesHardFilters(viewer, candidate, {
      preferredGendersMap: scoringContext.preferredGendersMap,
      connection,
    })
    if (!gate.pass) {
      const err = new Error('Profile not available.')
      err.code = 'NOT_FOUND'
      throw err
    }
  }

  const { geoTier, geoAccessible } = await assertGeoAccess(
    viewerUserId, tier, viewer, candidate, connection,
  )
  const compatibilityResult = scoreMatchPair(viewer, candidate, scoringContext)
  if (!isActiveConnection && !qualifiesForMatchQueue(compatibilityResult.overall)) {
    const err = new Error('Profile not available.')
    err.code = 'NOT_FOUND'
    throw err
  }
  await recordProfileView(viewerUserId, profileId, viewer)
  const profile = await mapPublicProfile(viewer, candidate, {
    connection,
    score: compatibilityResult.overall,
    geoTier,
    geoAccessible,
    scoringContext,
    compatibilityResult,
  })

  return { profile, tier, geoReach: getEntitlements(tier).geoReach }
}

/**
 * Send a connection request. Auto-mutual when the other party already requested you.
 */
async function sendConnectionRequest(viewerUserId, profileId) {
  const viewer = await loadViewer(viewerUserId)
  await assertViewerCanBrowse(viewer)

  const candidate = await loadCandidateByProfileId(profileId)
  if (!candidate || candidate.user_id === viewerUserId) {
    const err = new Error('Profile not found.')
    err.code = 'NOT_FOUND'
    throw err
  }

  const tier = await getViewerTier(viewerUserId)
  const existing = await getConnectionBetween(viewerUserId, candidate.user_id)

  if (!existing && shouldBlockColleaguePair(viewer, candidate)) {
    const err = new Error('Profile not available.')
    err.code = 'NOT_FOUND'
    throw err
  }

  if (existing?.status === 'accepted') {
    const err = new Error('You are already connected with this member.')
    err.code = 'ALREADY_CONNECTED'
    throw err
  }

  if (existing?.status === 'pending' && existing.from_user_id === viewerUserId) {
    const err = new Error('Connection request already sent.')
    err.code = 'CONNECTION_EXISTS'
    throw err
  }

  await assertGeoAccess(viewerUserId, tier, viewer, candidate, existing)

  const scoringContext = await scoringContextForPair(viewer, candidate)
  const compatibilityScore = scoreMatchPair(viewer, candidate, scoringContext).overall
  const isActiveConnection = existing
    && (existing.status === 'pending' || existing.status === 'accepted')
  if (!isActiveConnection && !qualifiesForMatchQueue(compatibilityScore)) {
    const err = new Error('This profile does not meet the compatibility threshold for curated matching.')
    err.code = 'BELOW_MATCH_THRESHOLD'
    throw err
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (existing?.status === 'pending' && existing.to_user_id === viewerUserId) {
      const updated = await client.query(
        `UPDATE connection_requests
         SET status = 'accepted', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.id],
      )

      await client.query('COMMIT')
      return {
        connection: updated.rows[0],
        mutual: true,
        profile: await mapPublicProfile(viewer, candidate, {
          connection: updated.rows[0],
          score: compatibilityScore,
          geoTier: classifyRelativeGeoTier(viewer, candidate),
          geoAccessible: true,
          scoringContext,
        }),
      }
    }

    const inserted = await client.query(
      `INSERT INTO connection_requests (from_user_id, to_user_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [viewerUserId, candidate.user_id],
    )

    await client.query('COMMIT')

    const connection = inserted.rows[0]
    await recordMatchFeedback(viewerUserId, profileId, 'connect')
    return {
      connection,
      mutual: false,
      profile: await mapPublicProfile(viewer, candidate, {
        connection,
        score: compatibilityScore,
        geoTier: classifyRelativeGeoTier(viewer, candidate),
        geoAccessible: true,
        scoringContext,
      }),
    }
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      const dup = new Error('A connection request already exists for this pair.')
      dup.code = 'CONNECTION_EXISTS'
      throw dup
    }
    throw err
  } finally {
    client.release()
  }
}

/**
 * Accept an incoming connection request.
 */
async function acceptConnectionRequest(viewerUserId, profileId) {
  const candidate = await loadCandidateByProfileId(profileId)
  if (!candidate) {
    const err = new Error('Profile not found.')
    err.code = 'NOT_FOUND'
    throw err
  }

  const existing = await getConnectionBetween(viewerUserId, candidate.user_id)
  if (!existing || existing.status !== 'pending' || existing.to_user_id !== viewerUserId) {
    const err = new Error('No incoming connection request found.')
    err.code = 'NOT_FOUND'
    throw err
  }

  const { rows } = await pool.query(
    `UPDATE connection_requests
     SET status = 'accepted', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [existing.id],
  )

  const viewer = await loadViewer(viewerUserId)
  const scoringContext = await scoringContextForPair(viewer, candidate)
  return {
    connection: rows[0],
    mutual: true,
    profile: await mapPublicProfile(viewer, candidate, {
      connection: rows[0],
      score: scoreMatchPair(viewer, candidate, scoringContext).overall,
      geoTier: classifyRelativeGeoTier(viewer, candidate),
      geoAccessible: true,
      scoringContext,
    }),
  }
}

/**
 * Decline an incoming connection request.
 */
async function declineConnectionRequest(viewerUserId, profileId) {
  const candidate = await loadCandidateByProfileId(profileId)
  if (!candidate) {
    const err = new Error('Profile not found.')
    err.code = 'NOT_FOUND'
    throw err
  }

  const existing = await getConnectionBetween(viewerUserId, candidate.user_id)
  if (!existing || existing.status !== 'pending' || existing.to_user_id !== viewerUserId) {
    const err = new Error('No incoming connection request found.')
    err.code = 'NOT_FOUND'
    throw err
  }

  const { rows } = await pool.query(
    `UPDATE connection_requests
     SET status = 'declined', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [existing.id],
  )

  await recordMatchFeedback(viewerUserId, profileId, 'decline')

  return { connection: rows[0] }
}

async function recordMatchFeedback(userId, profileId, action) {
  await pool.query(
    `INSERT INTO match_feedback (user_id, candidate_profile_id, action)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, candidate_profile_id)
     DO UPDATE SET action = EXCLUDED.action, created_at = NOW()`,
    [userId, profileId, action],
  )
}

/**
 * Pass on a curated match — removes the profile from future discovery.
 */
async function passMatchProfile(viewerUserId, profileId) {
  const viewer = await loadViewer(viewerUserId)
  await assertViewerCanBrowse(viewer)

  const candidate = await loadCandidateByProfileId(profileId)
  if (!candidate || candidate.user_id === viewerUserId) {
    const err = new Error('Profile not found.')
    err.code = 'NOT_FOUND'
    throw err
  }

  await recordMatchFeedback(viewerUserId, profileId, 'pass')
  return { ok: true, profileId }
}

/**
 * Withdraw a connection request you previously sent.
 */
async function withdrawConnectionRequest(viewerUserId, profileId) {
  const candidate = await loadCandidateByProfileId(profileId)
  if (!candidate) {
    const err = new Error('Profile not found.')
    err.code = 'NOT_FOUND'
    throw err
  }

  const existing = await getConnectionBetween(viewerUserId, candidate.user_id)
  if (!existing || existing.status !== 'pending' || existing.from_user_id !== viewerUserId) {
    const err = new Error('No outgoing connection request found.')
    err.code = 'NOT_FOUND'
    throw err
  }

  const { rows } = await pool.query(
    `UPDATE connection_requests
     SET status = 'withdrawn', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [existing.id],
  )

  await recordMatchFeedback(viewerUserId, profileId, 'pass')
  return { connection: rows[0] }
}

/**
 * Server-authoritative matching eligibility for the authenticated viewer.
 */
async function getMatchingEligibility(userId) {
  const viewer = await loadViewer(userId)
  const eligibility = evaluateEligibility(viewer.intent_category)
  const tier = await getViewerTier(userId)
  const entitlements = getEntitlements(tier)

  return {
    matchingEligible: eligibility.matchingEligibility,
    alignmentRequired: eligibility.matchingEligibility && !isAlignmentComplete(viewer.alignment_answers),
    alignmentComplete: isAlignmentComplete(viewer.alignment_answers),
    eligibility,
    tier,
    geoReach: entitlements.geoReach,
    algorithmPriority: entitlements.algorithmPriority,
    locationRequired: !viewer.country_code,
  }
}

module.exports = {
  getMatchesForUser,
  getMatchProfile,
  getMatchingEligibility,
  sendConnectionRequest,
  acceptConnectionRequest,
  declineConnectionRequest,
  withdrawConnectionRequest,
  passMatchProfile,
  loadViewer,
  computeCompatibilityScore,
  scoreMatchPair,
}
