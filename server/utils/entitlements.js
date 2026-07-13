/** Membership entitlements — mirrors client/js/membership.js ENTITLEMENTS. */

const TIERS = { BASE: 'base', PLUS: 'plus', PRIME: 'prime' }

const ENTITLEMENTS = {
  base: {
    matchDelivery: { type: 'capped', dailyLimit: 6 },
    geoReach: 'local',
    algorithmPriority: 'fifo',
  },
  plus: {
    matchDelivery: { type: 'unlimited' },
    geoReach: 'national',
    algorithmPriority: 'enhanced',
  },
  prime: {
    matchDelivery: { type: 'unlimited' },
    geoReach: 'global',
    algorithmPriority: 'realtime',
  },
}

const GEO_RANK = { local: 0, national: 1, global: 2 }

function getEntitlements(tier) {
  return ENTITLEMENTS[tier] || ENTITLEMENTS.base
}

function canAccessGeo(userTier, memberGeoTier) {
  const e = getEntitlements(userTier)
  return (GEO_RANK[memberGeoTier] ?? 0) <= (GEO_RANK[e.geoReach] ?? 0)
}

function requiredTierForGeo(geoTier) {
  const r = GEO_RANK[geoTier] ?? 0
  if (r === 0) return 'base'
  if (r === 1) return 'plus'
  return 'prime'
}

function getDailyMatchLimit(tier) {
  const e = getEntitlements(tier)
  return e.matchDelivery.type === 'unlimited' ? null : e.matchDelivery.dailyLimit
}

module.exports = {
  TIERS,
  ENTITLEMENTS,
  getEntitlements,
  canAccessGeo,
  requiredTierForGeo,
  getDailyMatchLimit,
}
