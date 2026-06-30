import { store } from './store.js'
import { initBodyFade } from './app.js'
import { installRealHandlers, handleOAuthReturn } from './sso.js'
import { installDemoHandlers } from './demo-mode.js'

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

   Real Supabase OAuth hands off to mfa.html for email + phone OTP.
   ════════════════════════════════════════════════════════════════ */

handleOAuthReturn().then(handled => {
  if (!handled) {
    installRealHandlers()
    installDemoHandlers()
  }
})

/* Deep-link: ?mode=register opens the Apply panel. */
const params = new URLSearchParams(window.location.search)
if (params.get('mode') === 'register') window.switchTab('register')
