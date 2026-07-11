/* ============================================================
   LEVEL — Canonical Member Dataset
   --------------------------------------------------------------
   Single source of truth for curated introductions. Powers the
   Match Dashboard grid (matches.html), the expanded professional
   profile (profile.html), and the dashboard hub previews.

   Each member carries both the compact card fields and the
   structured content for the ten profile sections:
     1. Overview              6. Relationship Intent
     2. Legacy & Vision       7. Mobility Profile
     3. Career Journey        8. Compatibility Breakdown
     4. Values & Principles   9. Verification & Trust
     5. Lifestyle Alignment  10. Shared Alignment Indicators
   ============================================================ */

export const MEMBERS = []

/* Status → display label/class used by the dashboard grid pills. */
export const STATUS_LABELS = {
  new:     'New',
  mutual:  'Mutual',
  pending: 'Pending',
  request: 'Request',
  viewed:  'Viewed',
}

export const PRESENCE_LABELS = {
  online:  'Online now',
  busy:    'Busy',
  offline: 'Offline',
}

/* The six standing compatibility dimensions shown on every profile. */
const COMPAT_DIMENSIONS = [
  'Career Alignment',
  'Relationship Goals',
  'Emotional Maturity',
  'Life Vision',
  'Lifestyle Match',
  'Communication',
]

export function getMembers() {
  return MEMBERS
}

export function getMembersByScore() {
  return MEMBERS.slice().sort((a, b) => b.score - a.score)
}

export function getMember(id) {
  return MEMBERS.find(m => m.id === id) || null
}

/* Derive a tailored-looking compatibility breakdown from the overall score.
   Deterministic per member (seeded by id) so it's stable across renders and
   never needs hand-maintained numbers. Values cluster around the headline
   score and are clamped to a believable 70–99 range. */
export function compatBreakdown(member) {
  const seed = (member.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const offsets = [2, -3, 1, -1, -4, 0]
  return COMPAT_DIMENSIONS.map((label, i) => {
    const jitter = ((seed * (i + 3)) % 5) - 2
    const pct = Math.max(70, Math.min(99, member.score + offsets[i] + jitter))
    return { label, pct }
  })
}
