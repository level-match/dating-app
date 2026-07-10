/* ============================================================
   LEVEL — Subscription API client
   Syncs membership tier with the authoritative server state.
   ============================================================ */

import { apiFetch } from './sso.js'
import { supabase } from './supabase.js'

function idempotencyHeaders(extra = {}) {
  return {
    ...extra,
    'Idempotency-Key': crypto.randomUUID(),
  }
}

/** Supabase auth identity for payment endpoints. */
export async function getSessionIdentity() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  return {
    externalUserId: session.user.id,
    email: session.user.email || '',
  }
}

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

/** Fetch authoritative tier + subscription from the database. */
export async function fetchSubscription() {
  const res = await apiFetch('/api/subscription')
  return parseJson(res)
}

/** Start a new Plus or Prime subscription (pending until payment confirms). */
export async function subscribe(tier) {
  const res = await apiFetch('/api/subscribe', {
    method: 'POST',
    headers: idempotencyHeaders(),
    body: JSON.stringify({ tier }),
  })
  return parseJson(res)
}

/** Upgrade an active Plus subscription to Prime mid-cycle. */
export async function upgradeSubscription() {
  const res = await apiFetch('/api/upgrade', {
    method: 'POST',
    headers: idempotencyHeaders(),
    body: JSON.stringify({}),
  })
  return parseJson(res)
}

/** Cancel the active subscription (access policy follows server rules). */
export async function cancelSubscription(subscriptionId) {
  const res = await apiFetch('/api/subscription', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionId }),
  })
  return parseJson(res)
}

/** Persist a downgrade to base or plus in the database. */
export async function downgradeSubscription(targetTier) {
  const res = await apiFetch('/api/subscription/downgrade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetTier }),
  })
  return parseJson(res)
}

/**
 * Development helper: simulates a PayMongo webhook confirming payment.
 * Only available when the server allows dev payment confirmation.
 */
export async function confirmPendingPayment() {
  const res = await apiFetch('/api/subscription/confirm', {
    method: 'POST',
    headers: idempotencyHeaders(),
    body: JSON.stringify({}),
  })
  return parseJson(res)
}

/** Poll until subscription reaches the expected tier as active, or timeout. */
export async function pollUntilActive(expectedTier, {
  maxAttempts = 20,
  intervalMs = 750,
} = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await fetchSubscription()
    if (
      data.tier === expectedTier
      && data.subscription?.status === 'active'
    ) {
      return data
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error('Payment confirmation timed out. Please refresh and try again.')
}
