/* ============================================================
   LEVEL — Membership Entitlement Service
   Single source of truth for tier definitions and access checks.
   No DOM dependencies — safe to import from any module.
   ============================================================ */

export const TIERS = { BASE: 'base', PLUS: 'plus', PRIME: 'prime' }

export const TIER_META = {
  base:  { id: 'base',  name: 'LEVEL Base',  shortName: 'Base',  price: 0,    currency: 'PHP', interval: null    },
  plus:  { id: 'plus',  name: 'LEVEL Plus',  shortName: 'Plus',  price: 499,  currency: 'PHP', interval: 'month' },
  prime: { id: 'prime', name: 'LEVEL Prime', shortName: 'Prime', price: 1990, currency: 'PHP', interval: 'month' },
}

/* ── Canonical entitlement matrix ──────────────────────────────
   Every feature gate resolves against this object.
   ─────────────────────────────────────────────────────────── */
export const ENTITLEMENTS = {
  base: {
    matchDelivery:     { type: 'capped', dailyLimit: 10 },
    geoReach:          'local',           // primary local region only
    algorithmPriority: 'fifo',            // standard FIFO batch queue
    messaging:         { maxThreads: 3, historyAccess: false, threadPinning: false },
    executionLayer:    'venue_suggestions',
    communityAccess:   'none',
  },
  plus: {
    matchDelivery:     { type: 'unlimited' },
    geoReach:          'national',        // expanded national / cross-island hubs
    algorithmPriority: 'enhanced',        // enhanced visibility in the matrix
    messaging:         { maxThreads: Infinity, historyAccess: true, threadPinning: false },
    executionLayer:    'scheduling',
    communityAccess:   'mixers',
  },
  prime: {
    matchDelivery:     { type: 'unlimited' },
    geoReach:          'global',          // unlimited / high-travel mobility
    algorithmPriority: 'realtime',        // real-time queue placement & priority ranking
    messaging:         { maxThreads: Infinity, historyAccess: true, threadPinning: true },
    executionLayer:    'concierge',
    communityAccess:   'vip',
  },
}

/* Ordinal ranks for range comparisons */
const GEO_RANK  = { local: 0, national: 1, global: 2 }
const EXEC_RANK = { venue_suggestions: 0, scheduling: 1, concierge: 2 }
const COMM_RANK = { none: 0, mixers: 1, vip: 2 }

/* ── Entitlement accessors ──────────────────────────────────── */

export function getEntitlements(tier) {
  return ENTITLEMENTS[tier] || ENTITLEMENTS.base
}

export function getTierMeta(tier) {
  return TIER_META[tier] || TIER_META.base
}

/* ── Access predicates ──────────────────────────────────────── */

export function canAccessGeo(userTier, memberGeoTier) {
  const e = getEntitlements(userTier)
  return (GEO_RANK[memberGeoTier] ?? 0) <= (GEO_RANK[e.geoReach] ?? 0)
}

export function canAccessExecFeature(userTier, feature) {
  const e = getEntitlements(userTier)
  return (EXEC_RANK[feature] ?? 0) <= (EXEC_RANK[e.executionLayer] ?? 0)
}

export function canAccessCommunityLevel(userTier, level) {
  const e = getEntitlements(userTier)
  return (COMM_RANK[level] ?? 0) <= (COMM_RANK[e.communityAccess] ?? 0)
}

/* ── Required-tier lookups (for upgrade prompts) ─────────────── */

export function requiredTierForGeo(geoTier) {
  const r = GEO_RANK[geoTier] ?? 0
  return r === 0 ? 'base' : r === 1 ? 'plus' : 'prime'
}

export function requiredTierForExec(feature) {
  const r = EXEC_RANK[feature] ?? 0
  return r === 0 ? 'base' : r === 1 ? 'plus' : 'prime'
}

/** Returns the next tier above the given one, or null for Prime */
export function getUpgradePath(tier) {
  return tier === 'base' ? 'plus' : tier === 'plus' ? 'prime' : null
}
