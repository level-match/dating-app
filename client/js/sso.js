/* ════════════════════════════════════════════════════════════════
   LEVEL — Real Supabase SSO (registration + login)

   Replaces the mocked OAuth in js/auth.js with the real Supabase flow:

     1. startOAuth(provider, intent) → Supabase redirects to the provider and
        back to auth.html?sso=return&intent=<intent>.
     2. handleOAuthReturn() picks up the real session, bridges the identity into
        the app `store`, and routes straight to the destination.

   After OAuth, users pass through mfa.html for email + phone OTP before
   protected routes open.
   ════════════════════════════════════════════════════════════════ */

import { supabase } from './supabase.js'
import { store } from './store.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

// Capture initial URL params NOW, at module load time, before Supabase's
// PKCE code exchange cleans the URL via history.replaceState.
const _initialParams = new URLSearchParams(window.location.search)

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
  const params = _initialParams
  if (params.get('sso') !== 'return') return false

  // Supabase (detectSessionInUrl) has already parsed the code/hash by now.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    console.warn('[sso] returned from OAuth but no session was established')
    return false
  }

  const user     = session.user
  const provider = user.app_metadata?.provider || 'oauth'
  const { firstName, lastName } = splitName(user.user_metadata)
  const avatar   = user.user_metadata?.avatar_url || user.user_metadata?.picture || ''

  // ── Check if this is a RETURNING user (already in our DB) ─────────────────
  // We probe without syncing — if they already exist, skip the consent modal.
  let isReturning = false
  try {
    const res = await apiFetch('/api/auth/me')
    if (res.ok) {
      const { user: dbUser } = await res.json()
      isReturning = !!dbUser
    }
  } catch (e) {
    console.warn('[sso] /api/auth/me check skipped:', e)
  }

  if (isReturning) {
    let dest = 'dashboard.html'
    try {
      const res = await apiFetch('/api/auth/sync', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName }),
      })
      if (res.ok) {
        const { needsOnboarding } = await res.json()
        dest = needsOnboarding ? 'onboarding.html' : 'dashboard.html'
      }
    } catch (e) {
      console.warn('[sso] sync skipped:', e)
    }

    store.startMfaSession({
      ...store.getDefaultUser(),
      firstName, lastName,
      email: user.email || '',
      avatarUrl: avatar,
      authProvider: provider,
      oauthFields: {
        firstName: !!firstName,
        lastName: !!lastName,
        email: !!(user.email),
        avatarUrl: !!avatar,
      },
    }, dest)
    window.location.replace('mfa.html')
    return true
  }

  // ── New user — show consent modal BEFORE touching the DB ──────────────────
  showOAuthConsentModal({ firstName, lastName, email: user.email || '', avatar, provider })
  return true
}

/**
 * Consent modal shown to NEW users only — BEFORE any DB write.
 * On "Agree": syncs to backend, saves to store, proceeds to onboarding.
 * On "Decline": signs out of Supabase, no DB record created, back to sign-up.
 */
function showOAuthConsentModal({ firstName, lastName, email, avatar, provider }) {
  const overlay = document.createElement('div')
  overlay.id = 'oauthConsentOverlay'
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;' +
    'background:rgba(1,15,36,0.94);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);'

  const avatarHtml = avatar
    ? `<img src="${avatar}" alt="Profile photo" style="width:68px;height:68px;border-radius:50%;object-fit:cover;border:2px solid rgba(201,168,76,0.4);margin-bottom:20px;">`
    : `<div style="width:68px;height:68px;border-radius:50%;background:rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:20px;">👤</div>`

  const providerLabel = { google: 'Google', apple: 'Apple', linkedin_oidc: 'LinkedIn' }[provider] || provider

  overlay.innerHTML = `
    <div style="width:100%;max-width:460px;background:rgba(6,12,26,0.97);border:1px solid rgba(255,255,255,0.09);
                border-radius:22px;padding:40px 36px 32px;box-shadow:0 28px 72px rgba(0,0,0,0.7);text-align:center;">
      ${avatarHtml}

      <div style="font-family:var(--font-serif,serif);font-size:1.45rem;font-weight:300;color:#FDFCF8;margin-bottom:8px;letter-spacing:0.01em;">
        Hi, ${firstName || 'there'} — welcome to LEVEL
      </div>
      <p style="font-family:var(--font-sans,sans-serif);font-size:0.83rem;color:rgba(255,255,255,0.45);margin-bottom:22px;line-height:1.6;">
        We received the following from your ${providerLabel} account.<br>
        Before we create your profile, please review and agree.
      </p>

      <!-- Identity card -->
      <div style="background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);border-radius:13px;padding:16px 20px;margin-bottom:22px;text-align:left;box-sizing:border-box;width:100%;overflow:hidden;">
        <div style="display:flex;flex-direction:column;gap:11px;">
          <div>
            <div style="font-size:0.68rem;color:rgba(255,255,255,0.35);font-family:var(--font-sans,sans-serif);text-transform:uppercase;letter-spacing:0.09em;margin-bottom:4px;">Name</div>
            <div style="display:flex;gap:8px;width:100%;box-sizing:border-box;">
              <input id="ocFirstName" value="${firstName}" placeholder="First name"
                style="flex:1;min-width:0;width:0;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:7px 10px;outline:none;color:#FDFCF8;font-family:var(--font-sans,sans-serif);font-size:0.9rem;">
              <input id="ocLastName" value="${lastName}" placeholder="Last name"
                style="flex:1;min-width:0;width:0;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:7px 10px;outline:none;color:#FDFCF8;font-family:var(--font-sans,sans-serif);font-size:0.9rem;">
            </div>
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:11px;">
            <div style="font-size:0.68rem;color:rgba(255,255,255,0.35);font-family:var(--font-sans,sans-serif);text-transform:uppercase;letter-spacing:0.09em;margin-bottom:4px;">Email</div>
            <div style="color:rgba(255,255,255,0.65);font-family:var(--font-sans,sans-serif);font-size:0.88rem;">${email}</div>
          </div>
        </div>
      </div>

      <!-- Consent text -->
      <p style="font-family:var(--font-sans,sans-serif);font-size:0.78rem;color:rgba(255,255,255,0.35);margin-bottom:22px;line-height:1.65;text-align:left;padding:0 2px;">
        By continuing, you agree to LEVEL's
        <a href="/terms.html" target="_blank" style="color:rgba(201,168,76,0.8);text-decoration:none;">Terms of Service</a>
        and
        <a href="/privacy.html" target="_blank" style="color:rgba(201,168,76,0.8);text-decoration:none;">Privacy Policy</a>.
        Your data will be used to create and manage your dating profile.
      </p>

      <!-- Actions -->
      <button id="ocAgree" style="width:100%;padding:14px;background:linear-gradient(135deg,#C9A84C,#A8843C);border:none;border-radius:12px;
        color:#0A0F20;font-family:var(--font-sans,sans-serif);font-weight:700;font-size:0.95rem;cursor:pointer;margin-bottom:10px;letter-spacing:0.02em;">
        I Agree &amp; Continue
      </button>
      <button id="ocDecline" style="width:100%;padding:11px;background:none;border:1px solid rgba(255,255,255,0.1);border-radius:12px;
        color:rgba(255,255,255,0.4);font-family:var(--font-sans,sans-serif);font-size:0.85rem;cursor:pointer;">
        Decline — go back to sign-up
      </button>
      <div id="ocSpinner" style="display:none;margin-top:14px;font-family:var(--font-sans,sans-serif);font-size:0.8rem;color:rgba(255,255,255,0.35);">
        Creating your account…
      </div>
    </div>`

  document.body.appendChild(overlay)

  // ── Agree ──────────────────────────────────────────────────────────────────
  overlay.querySelector('#ocAgree').addEventListener('click', async () => {
    const fn = overlay.querySelector('#ocFirstName').value.trim() || firstName
    const ln = overlay.querySelector('#ocLastName').value.trim()  || lastName

    // Disable buttons & show spinner while we sync
    overlay.querySelector('#ocAgree').disabled   = true
    overlay.querySelector('#ocDecline').disabled = true
    overlay.querySelector('#ocSpinner').style.display = 'block'

    // NOW sync to backend — user explicitly agreed
    let dest = 'onboarding.html'
    try {
      const res = await apiFetch('/api/auth/sync', {
        method: 'POST',
        body: JSON.stringify({ firstName: fn, lastName: ln }),
      })
      if (res.ok) {
        const { needsOnboarding } = await res.json()
        dest = needsOnboarding ? 'onboarding.html' : 'dashboard.html'
      }
    } catch (e) {
      console.warn('[sso] sync error during consent:', e)
    }

    store.startMfaSession({
      ...store.getDefaultUser(),
      firstName: fn,
      lastName: ln,
      email,
      avatarUrl: avatar,
      authProvider: provider,
      oauthPrefilled: true,
      oauthFields: {
        firstName: !!firstName,
        lastName: !!lastName,
        email: !!email,
        avatarUrl: !!avatar,
      },
    }, dest)

    overlay.remove()
    window.location.replace('mfa.html')
  })

  // ── Decline ─────────────────────────────────────────────────────────────────
  overlay.querySelector('#ocDecline').addEventListener('click', async () => {
    overlay.querySelector('#ocAgree').disabled   = true
    overlay.querySelector('#ocDecline').disabled = true
    overlay.querySelector('#ocSpinner').style.display = 'block'
    overlay.querySelector('#ocSpinner').textContent = 'Cancelling…'

    // Sign out from Supabase — no DB record was ever created
    await signOut()
    overlay.remove()
    window.location.replace('auth.html')
  })
}

// Window handlers matching the names auth.html's buttons already call.
export function installRealHandlers() {
  window.handleSocialAuth = (provider) => startOAuth(provider, 'signin')
  window.handleApplyAuth = (provider) => startOAuth(provider, 'apply')
}
