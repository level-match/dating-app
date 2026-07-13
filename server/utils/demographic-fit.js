/**
 * Demographic Fit scoring (10% of alignment engine).
 * Age range overlap, gender preference match, location proximity.
 */

const DEMOGRAPHIC_WEIGHT = 10

/** ref_preferred_genders.id → ref_genders.id values that satisfy the preference */
const PREFERRED_TO_IDENTITY = {
  1: [1],
  2: [2],
  3: [3],
  4: [4],
  5: [1, 4],
  6: [3, 99],
  7: null,
}

function normalizeDemographicProfile(raw) {
  if (!raw) return null
  return {
    age: raw.age ?? null,
    ageRangeMin: raw.age_range_min ?? raw.ageRangeMin ?? null,
    ageRangeMax: raw.age_range_max ?? raw.ageRangeMax ?? null,
    genderIdentityId: raw.gender_identity_id ?? raw.genderIdentityId ?? null,
    preferredGenderIds: raw.preferred_gender_ids ?? raw.preferredGenderIds ?? [],
    countryCode: raw.country_code ?? raw.countryCode ?? null,
    regionCode: raw.region_code ?? raw.regionCode ?? null,
    city: raw.city ?? null,
  }
}

function normalizeCode(value) {
  if (!value) return null
  return String(value).trim().toUpperCase()
}

function ageInRangeScore(age, min, max) {
  if (age == null) return 0.5
  if (min == null && max == null) return 0.5
  const lo = min ?? 18
  const hi = max ?? 99
  if (age >= lo && age <= hi) return 1
  const dist = age < lo ? lo - age : age - hi
  if (dist >= 8) return 0
  return 1 - dist / 8
}

function scoreAgeRangeOverlap(profileA, profileB) {
  const a = normalizeDemographicProfile(profileA)
  const b = normalizeDemographicProfile(profileB)
  if (!a || !b) return 0
  return (
    ageInRangeScore(b.age, a.ageRangeMin, a.ageRangeMax) +
    ageInRangeScore(a.age, b.ageRangeMin, b.ageRangeMax)
  ) / 2
}

function genderMatchesPreference(viewerPrefs, candidateGenderId) {
  const prefs = (viewerPrefs || []).map(Number)
  if (!prefs.length) return 0.5
  if (prefs.includes(7)) return 1
  if (candidateGenderId == null) return 0.5
  const genderId = Number(candidateGenderId)
  return prefs.some(prefId => {
    const allowed = PREFERRED_TO_IDENTITY[prefId]
    if (allowed == null) return true
    return allowed.includes(genderId)
  }) ? 1 : 0
}

function scoreGenderPreferenceMatch(profileA, profileB) {
  const a = normalizeDemographicProfile(profileA)
  const b = normalizeDemographicProfile(profileB)
  if (!a || !b) return 0
  return (
    genderMatchesPreference(a.preferredGenderIds, b.genderIdentityId) +
    genderMatchesPreference(b.preferredGenderIds, a.genderIdentityId)
  ) / 2
}

function scoreLocationProximity(profileA, profileB) {
  const a = normalizeDemographicProfile(profileA)
  const b = normalizeDemographicProfile(profileB)
  if (!a || !b) return 0
  const aCountry = normalizeCode(a.countryCode)
  const bCountry = normalizeCode(b.countryCode)
  if (!aCountry || !bCountry) return 0.5
  if (aCountry !== bCountry) return 0.15

  const aRegion = normalizeCode(a.regionCode)
  const bRegion = normalizeCode(b.regionCode)
  if (aRegion && bRegion && aRegion === bRegion) {
    const aCity = (a.city || '').trim().toLowerCase()
    const bCity = (b.city || '').trim().toLowerCase()
    if (aCity && bCity && aCity === bCity) return 1
    return 0.75
  }
  return 0.45
}

function scoreDemographicFit(profileA, profileB) {
  const ageScore = scoreAgeRangeOverlap(profileA, profileB)
  const genderScore = scoreGenderPreferenceMatch(profileA, profileB)
  const locationScore = scoreLocationProximity(profileA, profileB)
  const combined = (ageScore + genderScore + locationScore) / 3
  return {
    overall: Math.round(combined * 100),
    weight: DEMOGRAPHIC_WEIGHT,
    components: {
      ageRange: Math.round(ageScore * 100),
      gender: Math.round(genderScore * 100),
      location: Math.round(locationScore * 100),
    },
  }
}

module.exports = {
  DEMOGRAPHIC_WEIGHT,
  scoreDemographicFit,
  scoreAgeRangeOverlap,
  scoreGenderPreferenceMatch,
  scoreLocationProximity,
  normalizeDemographicProfile,
}
