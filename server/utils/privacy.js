/** Shared privacy rules for matching, profiles, and messaging. */

function normalizeIndustry(value) {
  const v = String(value || '').trim().toLowerCase()
  return v || null
}

function sharesIndustry(a, b) {
  const left = normalizeIndustry(a?.industry)
  const right = normalizeIndustry(b?.industry)
  return !!(left && right && left === right)
}

/** Hide a candidate when either party blocks colleagues and industries match. */
function shouldBlockColleaguePair(viewer, candidate) {
  if (!sharesIndustry(viewer, candidate)) return false
  const viewerBlocks = viewer?.block_colleagues !== false
  const candidateBlocks = candidate?.block_colleagues !== false
  return viewerBlocks || candidateBlocks
}

function isAcceptedConnection(connection) {
  return connection?.status === 'accepted'
}

function isMutualConnection(connection) {
  return isAcceptedConnection(connection)
}

/** Strip full profile details when the member limits visibility to connections. */
function applyMutualOnlyVisibility(profile, targetRow, connection) {
  if (!targetRow?.mutual_only_visibility) return profile
  if (isMutualConnection(connection)) return profile

  return {
    ...profile,
    limited: true,
    legacy: null,
    overview: { quote: '', paragraphs: [] },
    career: [],
    values: [],
    principles: [],
    lifestyle: [],
    relationship: [],
    shared: [],
    alignmentSummary: 'Connect to view their full profile.',
    intentLong: '',
    company: '',
    mobility: '',
  }
}

module.exports = {
  normalizeIndustry,
  sharesIndustry,
  shouldBlockColleaguePair,
  isAcceptedConnection,
  isMutualConnection,
  applyMutualOnlyVisibility,
}
