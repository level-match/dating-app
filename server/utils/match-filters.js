/**
 * Phase 1 — hard gates for the candidate pool.
 * Excludes pairs that fail age, gender, connection, privacy, or completeness rules.
 */

/** ref_preferred_genders.id → ref_genders.id */
const PREFERRED_TO_IDENTITY = {
  1: [1],
  2: [2],
  3: [3],
  4: [4],
  5: [1, 4],
  6: [3, 99],
  7: null,
}

function genderMatchesPreferenceHard(viewerPrefs, candidateGenderId) {
  const prefs = (viewerPrefs || []).map(Number)
  if (!prefs.length) return true
  if (prefs.includes(7)) return true
  if (candidateGenderId == null) return false
  const genderId = Number(candidateGenderId)
  return prefs.some(prefId => {
    const allowed = PREFERRED_TO_IDENTITY[prefId]
    if (allowed == null) return true
    return allowed.includes(genderId)
  })
}

function ageInHardRange(age, min, max) {
  if (age == null) return false
  if (min == null && max == null) return true
  const lo = min ?? 18
  const hi = max ?? 99
  return age >= lo && age <= hi
}

/**
 * Mutual age-range hard gate: each side's age must fall in the other's range
 * when that side has stated a preference.
 */
function passesAgeHardFilter(viewer, candidate) {
  const viewerHasRange = viewer.age_range_min != null || viewer.age_range_max != null
  const candidateHasRange = candidate.age_range_min != null || candidate.age_range_max != null

  if (viewerHasRange && !ageInHardRange(candidate.age, viewer.age_range_min, viewer.age_range_max)) {
    return false
  }
  if (candidateHasRange && !ageInHardRange(viewer.age, candidate.age_range_min, candidate.age_range_max)) {
    return false
  }
  return true
}

function passesGenderHardFilter(viewer, candidate, preferredGendersMap = new Map()) {
  const viewerPrefs = preferredGendersMap.get(String(viewer.id)) || []
  const candidatePrefs = preferredGendersMap.get(String(candidate.id)) || []

  if (!genderMatchesPreferenceHard(viewerPrefs, candidate.gender_identity_id)) return false
  if (!genderMatchesPreferenceHard(candidatePrefs, viewer.gender_identity_id)) return false
  return true
}

/** Declined or withdrawn pairs stay out of the discovery pool. */
function isDeclinedConnection(connection) {
  return connection?.status === 'declined' || connection?.status === 'withdrawn'
}

/**
 * Members with discretion mode enabled are hidden from discovery unless
 * there is already an active connection (pending or accepted).
 */
function passesDiscretionFilter(candidate, connection) {
  if (!candidate?.discretion_mode) return true
  if (!connection) return false
  return connection.status === 'pending' || connection.status === 'accepted'
}

/** Minimum signals required before a profile enters the match pool. */
function hasMinimumProfileCompleteness(row) {
  if (!row) return false
  const hasPhoto = !!(row.primary_photo_path || row.avatar_url)
  const hasLocation = !!row.country_code
  const hasIntent = !!row.intent_category
  const hasAge = row.age != null
  const hasGender = row.gender_identity_id != null
  return hasPhoto && hasLocation && hasIntent && hasAge && hasGender
}

/**
 * Run all Phase-1 hard gates for a viewer ↔ candidate pair.
 * @returns {{ pass: boolean, reason?: string }}
 */
function passesHardFilters(viewer, candidate, {
  preferredGendersMap = new Map(),
  connection = null,
} = {}) {
  if (!hasMinimumProfileCompleteness(candidate)) {
    return { pass: false, reason: 'incomplete_profile' }
  }
  if (isDeclinedConnection(connection)) {
    return { pass: false, reason: 'declined' }
  }
  if (!passesDiscretionFilter(candidate, connection)) {
    return { pass: false, reason: 'discretion' }
  }
  if (!passesAgeHardFilter(viewer, candidate)) {
    return { pass: false, reason: 'age' }
  }
  if (!passesGenderHardFilter(viewer, candidate, preferredGendersMap)) {
    return { pass: false, reason: 'gender' }
  }
  return { pass: true }
}

module.exports = {
  passesAgeHardFilter,
  passesGenderHardFilter,
  passesDiscretionFilter,
  hasMinimumProfileCompleteness,
  isDeclinedConnection,
  passesHardFilters,
  genderMatchesPreferenceHard,
}
