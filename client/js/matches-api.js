/* ============================================================
   LEVEL — Matches API client
   ============================================================ */

import { apiFetch } from './sso.js'

async function parseJson(res) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.message || body.error || `Request failed (${res.status})`)
    err.code = body.error
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

/** Fetch curated matches from the server (subscription-tier gated). */
export async function fetchMatches() {
  const res = await apiFetch('/api/matches')
  return parseJson(res)
}
