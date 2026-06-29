const TIER_PRICE_CENTAVOS = {
  base:  0,
  plus:  49_900,   // PHP 499.00
  prime: 199_000,  // PHP 1,990.00
}

const BILLING_DAYS = 30

/**
 * Calculates the pro-rata credit for unused days on the current tier and the
 * resulting net charge for an immediate upgrade.
 *
 * Formula:
 *   credit  = (remaining_days / 30) × from_tier_price
 *   charge  = to_tier_price − credit          (clamped to 0 minimum)
 *
 * Amounts are in PHP centavos (integers) to avoid floating-point rounding errors
 * when passed to the payment gateway.
 *
 * @param {string} fromTier   'plus' — the only mid-cycle upgradeable source tier
 * @param {string} toTier     'prime'
 * @param {Date|string} periodEnd  Current billing period end timestamp
 * @returns {{
 *   creditCentavos:   number,
 *   chargeCentavos:   number,
 *   remainingDays:    number,
 *   fromPriceCentavos: number,
 *   toPriceCentavos:   number,
 * }}
 */
function calculateProRata(fromTier, toTier, periodEnd) {
  const nowMs        = Date.now()
  const periodEndMs  = new Date(periodEnd).getTime()
  const remainingMs  = Math.max(0, periodEndMs - nowMs)
  const remainingDays = remainingMs / (1000 * 60 * 60 * 24)

  const fromDailyRate  = TIER_PRICE_CENTAVOS[fromTier] / BILLING_DAYS
  const creditCentavos = Math.round(remainingDays * fromDailyRate)
  const chargeCentavos = Math.max(0, TIER_PRICE_CENTAVOS[toTier] - creditCentavos)

  return {
    creditCentavos,
    chargeCentavos,
    remainingDays:     parseFloat(remainingDays.toFixed(4)),
    fromPriceCentavos: TIER_PRICE_CENTAVOS[fromTier],
    toPriceCentavos:   TIER_PRICE_CENTAVOS[toTier],
  }
}

module.exports = { calculateProRata, TIER_PRICE_CENTAVOS, BILLING_DAYS }
