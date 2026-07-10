/** Build a human-readable location label from structured parts. */
function formatLocationLabel({ city, regionName, countryName } = {}) {
  return [city, regionName, countryName].filter(Boolean).join(', ')
}

module.exports = { formatLocationLabel }
