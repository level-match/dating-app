import { store } from './store.js'
import { initBodyFade } from './app.js'

initBodyFade()
store.getAccounts()

/* ─── Login / Apply tab switch ─── */
window.switchTab = function (tab) {
  const tabs = document.querySelectorAll('.auth-tab')
  const loginPanel = document.getElementById('loginPanel')
  const registerPanel = document.getElementById('registerPanel')
  if (tab === 'login') {
    tabs[0]?.classList.add('active'); tabs[1]?.classList.remove('active')
    loginPanel.classList.add('active'); registerPanel.classList.remove('active')
  } else {
    tabs[0]?.classList.remove('active'); tabs[1]?.classList.add('active')
    loginPanel.classList.remove('active'); registerPanel.classList.add('active')
  }
}

/* ════════════════════════════════════════════════════════════════
   LEVEL Identity Gateway — OAuth → mandatory MFA

   Social sign-in (Google / LinkedIn / Apple) authenticates the user
   and PRE-FILLS basic profile data, but it does NOT grant access.
   Every OAuth completion routes to mfa.html, where email + phone OTP
   must both be verified before any protected route opens.
   ════════════════════════════════════════════════════════════════ */

const PROVIDER_LABELS = { google: 'Google', linkedin: 'LinkedIn', apple: 'Apple' }

/**
 * Mock OAuth profile resolution.
 *
 * PRODUCTION: exchange the OAuth authorization code on your server, then
 * read the verified identity the provider returns (name, email, picture,
 * and — for LinkedIn — headline/position). Replace this function's body
 * with that lookup; the rest of the flow is unchanged.
 */
function resolveOAuthProfile(provider, intent) {
  if (intent === 'signin') {
    // Returning member — hydrate from the seeded sample account so the
    // post-MFA dashboard is populated.
    const sample = store.findAccount('alexandra@level.app')
    return {
      firstName: sample?.firstName || 'Alexandra',
      lastName:  sample?.lastName  || 'R.',
      email:     sample?.email     || 'alexandra@level.app',
      profession: sample?.profession || 'Finance',
      photo: null,
    }
  }
  // New applicant — synthesize a provider-flavored identity.
  const domain = { google: 'gmail.com', linkedin: 'outlook.com', apple: 'icloud.com' }[provider] || 'gmail.com'
  return {
    firstName: 'Jordan',
    lastName:  'M.',
    email:     `jordan.maxwell@${domain}`,
    profession: provider === 'linkedin' ? 'Management Consulting' : '',
    headline:   provider === 'linkedin' ? 'Principal · Strategy' : '',
    photo: null,
  }
}

/* Lightweight "connecting to provider" overlay for the OAuth round-trip. */
function showConnecting(provider) {
  const label = PROVIDER_LABELS[provider] || provider
  const el = document.createElement('div')
  el.id = 'oauthConnecting'
  el.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:rgba(1,15,36,0.88);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);'
  el.innerHTML = `
    <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:300;color:#FDFCF8;">Connecting to ${label}…</div>
    <div style="font-family:var(--font-sans);font-size:0.85rem;color:rgba(255,255,255,0.55);">Securely confirming your identity</div>
    <div class="loading-bar" style="width:220px;margin-top:6px;"><span></span></div>`
  document.body.appendChild(el)
}

/**
 * Begin the social-auth flow for a provider.
 * @param {'google'|'linkedin'|'apple'} provider
 * @param {'signin'|'apply'} intent
 */
function beginOAuth(provider, intent) {
  showConnecting(provider)

  // Simulate the OAuth redirect/callback latency, then start an
  // authenticated-but-ungated session and hand off to MFA.
  setTimeout(() => {
    const profile = resolveOAuthProfile(provider, intent)
    const destination = intent === 'apply' ? 'onboarding.html' : 'dashboard.html'

    store.startMfaSession({
      ...store.getDefaultUser(),         // base session shape (stats, tier, …)
      firstName:  profile.firstName,
      lastName:   profile.lastName,
      email:      profile.email,
      profession: profile.profession || '',
      headline:   profile.headline || '',
      photo:      profile.photo || null,
      authProvider: provider,
      oauthPrefilled: true,
    }, destination)

    window.location.href = 'mfa.html'
  }, 750)
}

// Public handlers wired from auth.html buttons (names preserved — no duplication).
window.handleSocialAuth = provider => beginOAuth(provider, 'signin')  // Login panel
window.handleApplyAuth  = provider => beginOAuth(provider, 'apply')   // Apply panel

/* Deep-link: ?mode=register opens the Apply panel. */
const params = new URLSearchParams(window.location.search)
if (params.get('mode') === 'register') window.switchTab('register')
