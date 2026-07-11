const pool = require('../db/pool')
const subscriptionSvc = require('./subscription.service')
const { createSignedUrl, BUCKET } = require('./storage.service')
const { evaluateEligibility, isEligibleIntentCategory } = require('../utils/matching-policy')
const { classifyRelativeGeoTier } = require('../utils/geo-matching')
const {
  getEntitlements,
  canAccessGeo,
  requiredTierForGeo,
  getDailyMatchLimit,
} = require('../utils/entitlements')

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
    p.legacy_vision,
    p.career_chapter_id,
    p.life_integration_id,
    p.emotional_style_id,
    p.long_term_vision_id,
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

function buildSharedIndicators(viewer, candidate) {
  const items = []
  if (viewer.intent_category && viewer.intent_category === candidate.intent_category) {
    items.push({ label: 'Relationship intent', note: 'Aligned on what you are both seeking' })
  }
  if (viewer.career_chapter_id && viewer.career_chapter_id === candidate.career_chapter_id) {
    items.push({ label: 'Career chapter', note: 'In a similar professional season' })
  }
  if (classifyRelativeGeoTier(viewer, candidate) === 'local') {
    items.push({ label: 'Shared region', note: 'Based in the same part of the country' })
  }
  if (viewer.long_term_vision_id && viewer.long_term_vision_id === candidate.long_term_vision_id) {
    items.push({ label: 'Long-term vision', note: 'Similar picture of the future' })
  }
  return items
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
    `SELECT * FROM connection_requests
     WHERE status IN ('pending', 'accepted')
       AND (
         (from_user_id = $1 AND to_user_id = ANY($2::uuid[]))
         OR (to_user_id = $1 AND from_user_id = ANY($2::uuid[]))
       )`,
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

async function mapCandidateRow(viewer, row, connection = null) {
  const geoTier = classifyRelativeGeoTier(viewer, row)
  const score = computeCompatibilityScore(viewer, row)
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
    score,
    alignmentSummary: buildAlignmentSummary(viewer, row, score),
    status: conn.status,
    connectionStatus: conn.connectionStatus,
    photo,
    memberTier: row.member_tier || 'base',
    intentShort: row.primary_intent || null,
  }
}

async function mapPublicProfile(viewer, row, { connection, score, geoTier, geoAccessible }) {
  const extras = await loadProfileExtras(row.id)
  const conn = mapConnectionStatus(connection, viewer.user_id)
  const photo = await resolvePhotoUrl(row)
  const legacy = row.legacy_vision || ''

  const badges = []
  if (photo) badges.push('photo')
  if (row.member_tier === 'prime' || row.member_tier === 'plus') badges.push('premium')

  return {
    id: row.id,
    userId: row.user_id,
    name: formatDisplayName(row.first_name, row.last_name),
    age: row.age,
    pronouns: extras.pronouns,
    photo,
    fallback: 'linear-gradient(160deg,#1A2F4A,#0D1E35,#1E1008)',
    score,
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
    alignmentSummary: buildAlignmentSummary(viewer, row, score),
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
    shared: buildSharedIndicators(viewer, row),
  }
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
  const dailyLimit = getDailyMatchLimit(tier)

  const candidateRes = await pool.query(CANDIDATE_SQL, [userId])
  const connections = await loadConnectionsForViewer(
    userId,
    candidateRes.rows.map(r => r.user_id),
  )

  const scored = []
  for (const row of candidateRes.rows) {
    const geoTier = classifyRelativeGeoTier(viewer, row)
    if (!geoTier) continue
    scored.push({
      row,
      geoTier,
      score: computeCompatibilityScore(viewer, row),
      connection: connections.get(row.user_id) || null,
    })
  }

  scored.sort((a, b) => b.score - a.score)

  const accessible = []
  const locked = []

  for (const item of scored) {
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
    matches.push(await mapCandidateRow(viewer, item.row, item.connection))
  }

  if (newlyDeliveredIds.length) {
    await recordDeliveries(userId, newlyDeliveredIds)
  }

  const usedToday = dailyLimit == null
    ? null
    : Math.min(dailyLimit, deliveredIds.length + newlyDeliveredIds.length)

  const curatedMatches = matches
  const connectionMatches = await loadConnectionFeedProfiles(userId, viewer)
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
      totalCandidates: scored.length,
      accessibleCount: accessible.length,
      lockedCount: locked.length,
      connectionCount: connectionMatches.length,
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

async function loadConnectionFeedProfiles(viewerUserId, viewer) {
  const { rows } = await pool.query(CONNECTION_PROFILES_SQL, [viewerUserId])
  const connections = await loadConnectionsForViewer(
    viewerUserId,
    rows.map(r => r.user_id),
  )

  const items = []
  for (const row of rows) {
    items.push(await mapCandidateRow(
      viewer,
      row,
      connections.get(row.user_id) || null,
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
  const { geoTier, geoAccessible } = await assertGeoAccess(
    viewerUserId, tier, viewer, candidate, connection,
  )
  const score = computeCompatibilityScore(viewer, candidate)
  const profile = await mapPublicProfile(viewer, candidate, {
    connection,
    score,
    geoTier,
    geoAccessible,
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
          score: computeCompatibilityScore(viewer, candidate),
          geoTier: classifyRelativeGeoTier(viewer, candidate),
          geoAccessible: true,
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
    return {
      connection,
      mutual: false,
      profile: await mapPublicProfile(viewer, candidate, {
        connection,
        score: computeCompatibilityScore(viewer, candidate),
        geoTier: classifyRelativeGeoTier(viewer, candidate),
        geoAccessible: true,
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
  return {
    connection: rows[0],
    mutual: true,
    profile: await mapPublicProfile(viewer, candidate, {
      connection: rows[0],
      score: computeCompatibilityScore(viewer, candidate),
      geoTier: classifyRelativeGeoTier(viewer, candidate),
      geoAccessible: true,
    }),
  }
}

module.exports = {
  getMatchesForUser,
  getMatchProfile,
  sendConnectionRequest,
  acceptConnectionRequest,
}
