/* ════════════════════════════════════════════════════════════════
   LEVEL — Real Supabase SSO (registration + login)

   Replaces the mocked OAuth in js/auth.js with the real Supabase flow:

     1. startOAuth(provider, intent) → Supabase redirects to the provider and
        back to auth.html?sso=return&intent=<intent>.
     2. handleOAuthReturn() picks up the real session, bridges the identity into
        the app `store`, and routes straight to the destination.

   OAuth is the SOLE factor — the second factor (email/phone OTP via mfa.html +
   otp-service.js) is currently skipped. Those files remain in place so the gate
   can be re-enabled later (see the note in handleOAuthReturn).
   ════════════════════════════════════════════════════════════════ */

import { supabase } from './supabase.js'
import { store } from './store.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

// Supabase provider ids. LinkedIn uses the OIDC provider id.
const PROVIDER_ID = { google: 'google', apple: 'apple', linkedin: 'linkedin_oidc' }

/** Where to send the user after MFA completes, by intent. */
const DESTINATION = { apply: 'onboarding.html', signin: 'dashboard.html' }

/**
 * Begin the OAuth flow. Redirects away to the provider; control returns to
 * auth.html where handleOAuthReturn() finishes the job.
 * @param {'google'|'linkedin'|'apple'} provider
 * @param {'signin'|'apply'} intent
 */
export async function startOAuth(provider, intent) {
  const redirectTo = `${window.location.origin}/auth.html?sso=return&intent=${intent}`
  const { error } = await supabase.auth.signInWithOAuth({
    provider: PROVIDER_ID[provider] || provider,
    options: { redirectTo },
  })
  if (error) {
    console.error('[sso] signInWithOAuth failed:', error.message)
    alert(`Sign-in failed: ${error.message}`)
  }
}

/** Split a provider "full name" into first / last. */
function splitName(meta = {}) {
  const first = meta.given_name || meta.first_name || ''
  const last = meta.family_name || meta.last_name || ''
  if (first || last) return { firstName: first, lastName: last }
  const full = (meta.full_name || meta.name || '').trim()
  if (!full) return { firstName: '', lastName: '' }
  const parts = full.split(/\s+/)
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/**
 * Authenticated fetch against the Next.js backend. Attaches the current
 * Supabase access token as a Bearer header.
 */
export async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(options.headers || {})
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(`${API_BASE}${path}`, { ...options, headers })
}

/** Sign the user out of both Supabase and the local app store. */
export async function signOut() {
  try { await supabase.auth.signOut() } catch (e) { console.warn('[sso] signOut:', e) }
  store.logout()
}

/**
 * Call once on auth.html load. If we're returning from an OAuth redirect,
 * finalize: bridge the identity into the store and hand off to mfa.html.
 * Returns true if it handled an OAuth return (so the caller can skip wiring
 * the buttons).
 */
export async function handleOAuthReturn() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('sso') !== 'return') return false

  // Supabase (detectSessionInUrl) has already parsed the code/hash by now.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    console.warn('[sso] returned from OAuth but no session was established')
    return false
  }

  const user = session.user
  const intent = params.get('intent') === 'apply' ? 'apply' : 'signin'
  const provider = user.app_metadata?.provider || 'oauth'
  const { firstName, lastName } = splitName(user.user_metadata)

  // Best-effort: backfill the profiles row in the backend DB.
  try {
    await apiFetch('/api/auth/sync', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName }),
    })
  } catch (e) {
    console.warn('[sso] profile sync skipped:', e)
  }

  // Bridge the real identity into the app store. The second factor (email +
  // phone OTP) is intentionally SKIPPED — OAuth is the sole factor — so we mark
  // the session MFA-cleared (getDefaultUser carries mfa:{required:false,
  // complete:true}) and route straight to the destination. To re-enable the
  // gate later, swap setUser(...) back to store.startMfaSession(..., dest) and
  // redirect to 'mfa.html' (mfa.js + otp-service.js still implement it).
  store.setUser({
    ...store.getDefaultUser(),
    firstName: firstName || store.getDefaultUser().firstName,
    lastName: lastName || '',
    email: user.email || '',
    profession: user.user_metadata?.profession || '',
    authProvider: provider,
    oauthPrefilled: true,
  })

  window.location.replace(DESTINATION[intent])
  return true
}

// Window handlers matching the names auth.html's buttons already call.
export function installRealHandlers() {
  window.handleSocialAuth = (provider) => startOAuth(provider, 'signin')
  window.handleApplyAuth = (provider) => startOAuth(provider, 'apply')
}
