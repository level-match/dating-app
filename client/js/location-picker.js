/* ============================================================
   LEVEL — Location picker (country → region → city)
   Data from GET /api/ref/location/* (country-state-city dataset).
   ============================================================ */

import { apiFetch } from './sso.js'

export function formatLocationLabel({ city, regionName, countryName } = {}) {
  return [city, regionName, countryName].filter(Boolean).join(', ')
}

async function parseJson(res) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.message || body.error || `Location request failed (${res.status})`)
  }
  return body
}

export async function fetchCountries() {
  const res = await apiFetch('/api/ref/location/countries')
  const { countries } = await parseJson(res)
  return countries
}

export async function fetchRegions(countryCode) {
  const res = await apiFetch(`/api/ref/location/regions?country=${encodeURIComponent(countryCode)}`)
  const { regions } = await parseJson(res)
  return regions
}

export async function fetchCities(countryCode, regionCode) {
  const q = new URLSearchParams({ country: countryCode, region: regionCode })
  const res = await apiFetch(`/api/ref/location/cities?${q}`)
  const { cities } = await parseJson(res)
  return cities
}

function fillSelect(select, items, {
  placeholder,
  valueKey = 'code',
  labelKey = 'name',
  disabled = false,
} = {}) {
  if (!select) return
  select.innerHTML = ''
  const ph = document.createElement('option')
  ph.value = ''
  ph.textContent = placeholder
  ph.disabled = true
  ph.selected = !select.dataset.value
  select.appendChild(ph)

  for (const item of items) {
    const opt = document.createElement('option')
    opt.value = item[valueKey] ?? item.name
    opt.textContent = item[labelKey] ?? item.name
    opt.dataset.label = item[labelKey] ?? item.name ?? ''
    select.appendChild(opt)
  }

  select.disabled = disabled
  if (typeof window.lvlSelectRefresh === 'function') {
    window.lvlSelectRefresh(select)
  }
}

function selectedOptionLabel(select) {
  const opt = select?.selectedOptions?.[0]
  return opt?.dataset?.label || opt?.textContent?.trim() || ''
}

/**
 * Wire cascading country / region / city selects.
 * Returns helpers to read values and set initial state.
 */
export async function initLocationPicker({
  countrySelect,
  regionSelect,
  citySelect,
  initial = {},
  onChange,
} = {}) {
  if (!countrySelect || !regionSelect || !citySelect) {
    throw new Error('initLocationPicker requires country, region, and city selects.')
  }

  let countriesCache = null

  async function loadCountries() {
    if (!countriesCache) countriesCache = await fetchCountries()
    fillSelect(countrySelect, countriesCache, { placeholder: 'Select country' })
  }

  async function loadRegions(countryCode, selectedRegion) {
    if (!countryCode) {
      fillSelect(regionSelect, [], { placeholder: 'Select region / state', disabled: true })
      fillSelect(citySelect, [], { placeholder: 'Select city (optional)', disabled: true })
      return
    }
    const regions = await fetchRegions(countryCode)
    if (!regions.length) {
      fillSelect(regionSelect, [{ code: '—', name: 'Nationwide' }], { placeholder: 'Nationwide' })
      regionSelect.value = '—'
      regionSelect.disabled = true
      await loadCities(countryCode, '—')
      return
    }
    fillSelect(regionSelect, regions, { placeholder: 'Select region / state' })
    regionSelect.disabled = false
    if (selectedRegion) {
      regionSelect.value = selectedRegion
    }
    if (typeof window.lvlSelectRefresh === 'function') {
      window.lvlSelectRefresh(regionSelect)
    }
    fillSelect(citySelect, [], { placeholder: 'Select city (optional)', disabled: true })
  }

  async function loadCities(countryCode, regionCode, selectedCity) {
    if (!countryCode || !regionCode) {
      fillSelect(citySelect, [], { placeholder: 'Select city (optional)', disabled: true })
      return
    }
    const cities = await fetchCities(countryCode, regionCode)
    fillSelect(citySelect, cities, { placeholder: 'Select city (optional)', valueKey: 'name', labelKey: 'name' })
    citySelect.disabled = cities.length === 0
    if (selectedCity && cities.some(c => c.name === selectedCity)) {
      citySelect.value = selectedCity
    }
    if (typeof window.lvlSelectRefresh === 'function') {
      window.lvlSelectRefresh(citySelect)
    }
  }

  function getValues() {
    const countryCode = countrySelect.value || ''
    let regionCode = regionSelect.value || ''
    const city = citySelect.value || ''
    const countryName = selectedOptionLabel(countrySelect)
    let regionName = selectedOptionLabel(regionSelect)
    if (regionCode === '—') {
      regionCode = ''
      regionName = ''
    }
    return {
      countryCode,
      countryName,
      regionCode,
      regionName,
      city,
      location: formatLocationLabel({ city, regionName, countryName }),
    }
  }

  function notifyChange() {
    onChange?.(getValues())
  }

  countrySelect.addEventListener('change', async () => {
    await loadRegions(countrySelect.value)
    notifyChange()
  })

  regionSelect.addEventListener('change', async () => {
    await loadCities(countrySelect.value, regionSelect.value)
    notifyChange()
  })

  citySelect.addEventListener('change', notifyChange)

  await loadCountries()

  if (initial.countryCode) {
    countrySelect.value = initial.countryCode
    if (typeof window.lvlSelectRefresh === 'function') {
      window.lvlSelectRefresh(countrySelect)
    }
    await loadRegions(initial.countryCode, initial.regionCode)
    if (initial.regionCode) {
      await loadCities(initial.countryCode, initial.regionCode, initial.city)
    }
  } else if (initial.countryName && countriesCache) {
    const hit = countriesCache.find(c => c.name === initial.countryName)
    if (hit) {
      countrySelect.value = hit.code
      await loadRegions(hit.code, initial.regionCode)
      if (initial.regionCode) {
        await loadCities(hit.code, initial.regionCode, initial.city)
      }
    }
  }

  notifyChange()

  return { getValues, reload: loadCountries }
}
