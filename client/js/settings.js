import { store } from './store.js'
import { requireAuth, initBodyFade, initNav } from './app.js'

requireAuth()
initBodyFade()
initNav()

const toastEl = document.getElementById('setToast')
let toastTimer = null

function flashToast(text) {
  if (!toastEl) return
  toastEl.textContent = text || 'Saved'
  toastEl.classList.add('visible')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 1600)
}

/* ─── Populate account meta from the signed-in user ─── */
function populateAccount() {
  const user = store.getUser() || store.getDefaultUser()
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member'
  document.getElementById('setName').textContent = fullName
  document.getElementById('setEmail').textContent = user.email || 'alexandra@level.app'
  document.getElementById('setTier').textContent = user.tier || 'Select'
}

/* ─── Hydrate every toggle from stored settings ─── */
function hydrateToggles() {
  const settings = store.getSettings()
  document.querySelectorAll('input[data-setting]').forEach(input => {
    const [group, key] = input.dataset.setting.split('.')
    input.checked = !!settings?.[group]?.[key]
  })
}

/* ─── Persist any change ─── */
document.querySelectorAll('input[data-setting]').forEach(input => {
  input.addEventListener('change', () => {
    const [group, key] = input.dataset.setting.split('.')
    store.updateSetting(group, key, input.checked)
    flashToast(input.checked ? `${pretty(key)} on` : `${pretty(key)} off`)
  })
})

function pretty(key) {
  // mutualOnlyVisibility → Mutual only visibility
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim()
}

/* ─── Sign out ─── */
window.signOut = function () {
  if (!confirm('Sign out of LEVEL on this device?')) return
  store.logout()
  window.location.href = 'auth.html'
}

/* ─── Delete account (demo: clears local state and routes home) ─── */
window.deleteAccount = function () {
  const ok = confirm(
    'Delete your LEVEL account?\n\n' +
    'Your profile, matches, and messages will be removed and this cannot be undone.'
  )
  if (!ok) return
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('level_'))
      .forEach(k => localStorage.removeItem(k))
  } catch {}
  window.location.href = 'index.html'
}

populateAccount()
hydrateToggles()
