/**
 * ref-data.js
 * ─────────────────────────────────────────────────────────────────────────
 * Fetches all reference (lookup) tables from the backend in a single call
 * and caches them for the session.
 *
 * Usage:
 *   import { getRefData, getLabelById } from './ref-data.js'
 *
 *   const ref = await getRefData()
 *   ref.genders          // [{ id, label }, ...]
 *   ref.intents          // [{ id, label, category_slug }, ...]
 *
 *   getLabelById(ref.genders, 2)   // "Female"
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

/** In-memory cache — survives for the page lifetime. */
let _cache = null
let _fetchPromise = null

/**
 * Returns all reference tables. Fetches once per page load, then returns
 * the cached result on every subsequent call.
 * @returns {Promise<RefData>}
 */
export async function getRefData() {
  if (_cache) return _cache

  // Deduplicate concurrent calls — only one in-flight request at a time
  if (_fetchPromise) return _fetchPromise

  _fetchPromise = fetch(`${API_BASE}/api/ref/all`)
    .then(res => {
      if (!res.ok) throw new Error(`[ref-data] /api/ref/all returned ${res.status}`)
      return res.json()
    })
    .then(data => {
      _cache = data
      _fetchPromise = null
      return data
    })
    .catch(err => {
      _fetchPromise = null
      console.error('[ref-data] Failed to load ref data:', err.message)
      throw err
    })

  return _fetchPromise
}

/**
 * Look up a human-readable label from a ref array by id.
 * @param {Array<{id: number, label: string}>} refArray
 * @param {number|null} id
 * @returns {string|null}
 */
export function getLabelById(refArray, id) {
  if (!id || !refArray) return null
  return refArray.find(r => r.id === id)?.label ?? null
}

/**
 * Look up a ref entry by label (case-insensitive).
 * @param {Array<{id: number, label: string}>} refArray
 * @param {string} label
 * @returns {{ id: number, label: string } | null}
 */
export function getByLabel(refArray, label) {
  if (!label || !refArray) return null
  const lower = label.toLowerCase()
  return refArray.find(r => r.label.toLowerCase() === lower) ?? null
}

/**
 * Fetches the current user's full profile from the backend.
 * Requires a valid Supabase session (uses apiFetch from sso.js).
 * @param {Function} apiFetch  — the apiFetch helper from sso.js
 * @returns {Promise<object|null>}
 */
export async function fetchMyProfile(apiFetch) {
  try {
    const res = await apiFetch('/api/auth/profile')
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`[ref-data] profile fetch returned ${res.status}`)
    const { profile } = await res.json()
    return profile
  } catch (err) {
    console.error('[ref-data] fetchMyProfile error:', err.message)
    return null
  }
}

/**
 * Pre-warm the ref data cache. Call early (e.g. on DOMContentLoaded) on
 * pages that will need it, so it's ready before the user interacts.
 */
export function warmRefData() {
  getRefData().catch(() => {})
}
