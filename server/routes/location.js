const express = require('express')
const { Country, State, City } = require('country-state-city')

const router = express.Router()

/* ─── GET /api/ref/location/countries ─────────────────────────── */
router.get('/countries', (_req, res) => {
  const countries = Country.getAllCountries()
    .map(c => ({ code: c.isoCode, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  res.json({ countries })
})

/* ─── GET /api/ref/location/regions?country=PH ────────────────── */
router.get('/regions', (req, res) => {
  const country = (req.query.country || '').trim().toUpperCase()
  if (!country) {
    return res.status(400).json({ error: 'MISSING_COUNTRY', message: 'country query param is required (ISO code).' })
  }

  const countryRow = Country.getCountryByCode(country)
  if (!countryRow) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Unknown country code.' })
  }

  const regions = State.getStatesOfCountry(country)
    .map(s => ({ code: s.isoCode, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  res.json({ country: { code: countryRow.isoCode, name: countryRow.name }, regions })
})

/* ─── GET /api/ref/location/cities?country=PH&region=00 ─────────── */
router.get('/cities', (req, res) => {
  const country = (req.query.country || '').trim().toUpperCase()
  const region  = (req.query.region || '').trim().toUpperCase()

  if (!country || !region) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'country and region query params are required (ISO codes).',
    })
  }

  const cities = City.getCitiesOfState(country, region)
    .map(c => ({ name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  res.json({ cities })
})

module.exports = router
