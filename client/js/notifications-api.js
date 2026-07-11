/* ============================================================
   LEVEL — Notifications API
   ============================================================ */

import { apiFetch } from './sso.js'

async function parseJson(res) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.message || body.error || `Request failed (${res.status})`)
    err.code = body.error
    err.status = res.status
    throw err
  }
  return body
}

export async function fetchNotificationFeed() {
  const res = await apiFetch('/api/notifications/feed')
  return parseJson(res)
}

export async function markNotificationRead(notificationId) {
  const res = await apiFetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return parseJson(res)
}

export async function markAllNotificationsRead() {
  const res = await apiFetch('/api/notifications/read-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return parseJson(res)
}
