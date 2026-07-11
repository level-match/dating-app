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

/** Fetch a single match profile by profile UUID. */
export async function fetchMatchProfile(profileId) {
  const res = await apiFetch(`/api/matches/${encodeURIComponent(profileId)}`)
  return parseJson(res)
}

/** Send a connection request to a match profile. */
export async function sendConnectionRequest(profileId) {
  const res = await apiFetch(`/api/matches/${encodeURIComponent(profileId)}/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return parseJson(res)
}

/** Accept an incoming connection request. */
export async function acceptConnectionRequest(profileId) {
  const res = await apiFetch(`/api/matches/${encodeURIComponent(profileId)}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return parseJson(res)
}

export function isProfileUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}
