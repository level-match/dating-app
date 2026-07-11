/* ============================================================
   LEVEL — Chat API client
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

/** Load inbox: connections, requests, and message previews. */
export async function fetchChatInbox() {
  const res = await apiFetch('/api/chat/inbox')
  return parseJson(res)
}

/** Load messages for a connection thread. */
export async function fetchConnectionMessages(connectionId) {
  const res = await apiFetch(`/api/chat/connections/${encodeURIComponent(connectionId)}/messages`)
  return parseJson(res)
}

/** Send a message on an accepted connection. */
export async function sendChatMessage(connectionId, body) {
  const res = await apiFetch(`/api/chat/connections/${encodeURIComponent(connectionId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
  return parseJson(res)
}

/** Decline an incoming connection request. */
export async function declineConnectionRequest(profileId) {
  const res = await apiFetch(`/api/matches/${encodeURIComponent(profileId)}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return parseJson(res)
}

export { acceptConnectionRequest } from './matches-api.js'
