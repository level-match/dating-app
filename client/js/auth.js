import { store } from './store.js'
import { initBodyFade } from './app.js'
import { installRealHandlers, handleOAuthReturn } from './sso.js'
import './email-auth.js'   // registers window.handleEmailAuth (email-code login/apply)

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
   LEVEL Identity Gateway — real Supabase SSO (single factor)

   Social sign-in (Google / LinkedIn / Apple) authenticates via Supabase and
   pre-fills profile data. On completion the user is routed straight to the
   dashboard (sign in) or onboarding (apply). The second-factor MFA step is
   currently disabled; the OAuth plumbing lives in js/sso.js.
   ════════════════════════════════════════════════════════════════ */

// If we're returning from a provider redirect, finish the handoff to mfa.html;
// otherwise wire the Google/LinkedIn/Apple buttons to start real OAuth.
handleOAuthReturn().then((handled) => {
  if (!handled) installRealHandlers()
})

/* Deep-link: ?mode=register opens the Apply panel. */
const params = new URLSearchParams(window.location.search)
if (params.get('mode') === 'register') window.switchTab('register')
