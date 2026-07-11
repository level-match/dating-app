import { initBodyFade } from './app.js'
import { installRealHandlers, handleOAuthReturn } from './sso.js'
import { installDemoHandlers } from './demo-mode.js'
import { maintenanceUrl } from './maintenance.js'

const isOAuthReturn = new URLSearchParams(window.location.search).get('sso') === 'return'

function clearOAuthLoader() {
  window.__clearAuthOAuthLoader?.()
}

if (!isOAuthReturn) initBodyFade()

window.goToSignupMaintenance = () => {
  window.location.href = maintenanceUrl('signup')
}

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

   Real Supabase OAuth hands off to mfa.html for email OTP.
   ════════════════════════════════════════════════════════════════ */

const params = new URLSearchParams(window.location.search)

if (params.get('mode') === 'register' && !isOAuthReturn) {
  window.location.replace(maintenanceUrl('signup'))
}

handleOAuthReturn().then(handled => {
  if (!handled) {
    clearOAuthLoader()
    initBodyFade()
    installRealHandlers()
    installDemoHandlers()

    if (params.get('signup') === 'google') {
      window.handleApplyAuth('google')
    }
  }
})

function showAuthNotice() {
  const notice = params.get('notice')
  if (notice !== 'account_exists') return

  const banner = document.createElement('div')
  banner.className = 'auth-notice'
  banner.setAttribute('role', 'status')
  banner.innerHTML =
    'An account with this email already exists. Please <strong>sign in</strong> to continue.'

  const panel = document.getElementById('loginPanel')
  panel?.insertBefore(banner, panel.firstChild)

  // Drop query params so refresh does not repeat the banner.
  const clean = new URL(window.location.href)
  clean.searchParams.delete('notice')
  window.history.replaceState({}, '', clean)
}

showAuthNotice()
