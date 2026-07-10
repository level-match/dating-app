/**
 * Classify how far a candidate is from the viewer's location.
 * Returns: 'local' | 'national' | 'global'
 */
function classifyRelativeGeoTier(viewer, candidate) {
  const viewerCountry = normalizeCode(viewer?.country_code)
  const candidateCountry = normalizeCode(candidate?.country_code)

  if (!viewerCountry || !candidateCountry) return null
  if (viewerCountry !== candidateCountry) return 'global'

  const viewerRegion = normalizeCode(viewer?.region_code)
  const candidateRegion = normalizeCode(candidate?.region_code)

  if (viewerRegion && candidateRegion && viewerRegion === candidateRegion) {
    return 'local'
  }

  return 'national'
}

function normalizeCode(value) {
  if (!value) return null
  return String(value).trim().toUpperCase()
}

module.exports = { classifyRelativeGeoTier, normalizeCode }
