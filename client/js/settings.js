import { store } from './store.js'
import { requireAuth, initBodyFade, initNav, hydrateFromServer } from './app.js'
import { wireMaintenanceLinks } from './maintenance.js'

requireAuth()
initBodyFade()
initNav()
wireMaintenanceLinks()

const toastEl = document.getElementById('setToast')
let toastTimer = null

/** All privacy toggles live on `profiles` (shared with profile setup). */
const PROFILE_PRIVACY_KEYS = new Set([
  'blockColleagues',
  'discretionMode',
  'mutualOnlyVisibility',
  'readReceipts',
])

function flashToast(text) {
  if (!toastEl) return
  toastEl.textContent = text || 'Saved'
  toastEl.classList.add('visible')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 1600)
}

function syncPrivacyFromUser(user) {
  if (!user) return
  const map = [
    ['blockColleagues', user.blockColleagues],
    ['discretionMode', user.discretionMode],
    ['mutualOnlyVisibility', user.mutualOnlyVisibility],
    ['readReceipts', user.readReceipts],
  ]
  map.forEach(([key, value]) => {
    if (value != null) store.updateSetting('privacy', key, !!value)
  })
}

async function isEmailVerified(user) {
  if (user?.mfa?.email?.verified) return true
  if (store.isMfaComplete()) return true
  try {
    const { supabase } = await import('./supabase.js')
    const { data: { user: sbUser } } = await supabase.auth.getUser()
    return !!(sbUser?.email_confirmed_at || sbUser?.confirmed_at)
  } catch {
    return false
  }
}

function renderEmailStatus(verified) {
  const statusEl = document.getElementById('setEmailStatus')
  const changeBtn = document.getElementById('setEmailChangeBtn')
  if (!statusEl) return

  if (verified) {
    statusEl.hidden = false
    statusEl.textContent = 'Verified'
    if (changeBtn) {
      changeBtn.textContent = 'Change'
      changeBtn.style.display = ''
    }
  } else {
    statusEl.hidden = true
    if (changeBtn) {
      changeBtn.textContent = 'Verify'
      changeBtn.style.display = ''
    }
  }
}

async function populateAccount() {
  const user = store.getUser() || store.getDefaultUser()
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member'

  document.getElementById('setName').textContent = fullName
  document.getElementById('setEmail').textContent = user.email || '—'
  document.getElementById('setTier').textContent = user.tier || 'Select'

  renderEmailStatus(await isEmailVerified(user))
}

function hydrateToggles() {
  const settings = store.getSettings()
  document.querySelectorAll('input[data-setting]').forEach(input => {
    const [group, key] = input.dataset.setting.split('.')
    input.checked = !!settings?.[group]?.[key]
  })
}

async function persistProfilePrivacy(key, value) {
  const { apiFetch } = await import('./sso.js')
  const res = await apiFetch('/api/auth/profile/privacy', {
    method: 'PATCH',
    body: JSON.stringify({ [key]: value }),
  })
  if (!res.ok) throw new Error('profile privacy save failed')

  const data = await res.json()
  const user = store.getUser() || store.getDefaultUser()
  store.setUser({
    ...user,
    blockColleagues: data.blockColleagues,
    discretionMode: data.discretionMode,
    mutualOnlyVisibility: data.mutualOnlyVisibility,
    readReceipts: data.readReceipts,
  })
  syncPrivacyFromUser(data)
}

async function persistSetting(group, key, value) {
  if (group === 'privacy' && PROFILE_PRIVACY_KEYS.has(key)) {
    await persistProfilePrivacy(key, value)
    return true
  }
  // Notifications, appearance, account — device preferences (localStorage).
  store.updateSetting(group, key, value)
  return true
}

document.querySelectorAll('input[data-setting]').forEach(input => {
  input.addEventListener('change', async () => {
    const [group, key] = input.dataset.setting.split('.')
    const value = input.checked
    const previous = !value

    if (!(group === 'privacy' && PROFILE_PRIVACY_KEYS.has(key))) {
      store.updateSetting(group, key, value)
    }

    try {
      await persistSetting(group, key, value)
      flashToast(value ? `${pretty(key)} on` : `${pretty(key)} off`)
    } catch (e) {
      console.warn('[settings] save failed:', e.message)
      if (group === 'privacy' && PROFILE_PRIVACY_KEYS.has(key)) {
        const user = store.getUser()
        if (user) {
          input.checked = user[key] ?? previous
          store.updateSetting('privacy', key, input.checked)
        } else {
          input.checked = previous
          store.updateSetting(group, key, previous)
        }
      } else {
        input.checked = previous
        store.updateSetting(group, key, previous)
      }
      flashToast('Could not save — try again')
    }
  })
})

function pretty(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim()
}

window.signOut = async function () {
  if (!confirm('Sign out of LEVEL on this device?')) return
  try {
    const { signOut } = await import('./sso.js')
    await signOut()
  } catch {
    store.logout()
  }
  window.location.href = 'auth.html'
}

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

async function loadSettings() {
  const user = await hydrateFromServer({ force: true }).catch(() => store.getUser())
  syncPrivacyFromUser(user)
  await populateAccount()
  hydrateToggles()
}

loadSettings()
