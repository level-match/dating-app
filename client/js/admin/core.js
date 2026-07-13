import { api } from './api.js'

/* ── Auth guard ───────────────────────────────────────────────── */
const token = sessionStorage.getItem('adm_token')
if (!token) { window.location.href = 'admin-login.html'; throw new Error('unauthenticated') }

const admData  = JSON.parse(sessionStorage.getItem('adm_admin') || '{}')
const ROLE_RANK = { support: 0, moderator: 1, super_admin: 2 }

/* ── Nav config ───────────────────────────────────────────────── */
const NAV = [
  {
    section: 'Analytics',
    items: [
      { key: 'overview',       label: 'Overview',      minRole: 'support',
        icon: '<path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 3l3.5-3.5L21 17l-3.5 3.5z" stroke-linecap="round" stroke-linejoin="round"/>' },
      { key: 'matching',       label: 'Matching',      minRole: 'support',
        icon: '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke-linecap="round" stroke-linejoin="round"/>' },
    ],
  },
  {
    section: 'Members',
    items: [
      { key: 'users',          label: 'User Management',    minRole: 'support',
        icon: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="7" r="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 21v-2a4 4 0 00-3-3.87" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 3.13a4 4 0 010 7.75" stroke-linecap="round" stroke-linejoin="round"/>' },
      { key: 'subscriptions',  label: 'Subscriptions',      minRole: 'support',
        icon: '<rect x="2" y="5" width="20" height="14" rx="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 10h20" stroke-linecap="round" stroke-linejoin="round"/>' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { key: 'moderation',     label: 'Moderation',         minRole: 'moderator',
        icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/>' },
      { key: 'events',         label: 'Events',             minRole: 'moderator',
        icon: '<rect x="3" y="4" width="18" height="18" rx="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 2v4M8 2v4M3 10h18" stroke-linecap="round" stroke-linejoin="round"/>' },
      { key: 'messaging',      label: 'Messaging',          minRole: 'moderator',
        icon: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/>' },
      { key: 'concierge',      label: 'Concierge',          minRole: 'moderator',
        icon: '<path d="M12 3a9 9 0 109 9M12 3v9l4 4" stroke-linecap="round" stroke-linejoin="round"/>' },
    ],
  },
  {
    section: 'Configuration',
    items: [
      { key: 'settings',       label: 'Settings',           minRole: 'super_admin',
        icon: '<circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke-linecap="round" stroke-linejoin="round"/>' },
    ],
  },
]

/* ── Sidebar builder ──────────────────────────────────────────── */
function buildNav(activeKey) {
  const nav    = document.getElementById('admNav')
  const myRank = ROLE_RANK[admData.role] ?? 0
  nav.innerHTML = ''

  NAV.forEach(group => {
    const visibleItems = group.items.filter(i => myRank >= (ROLE_RANK[i.minRole] ?? 0))
    if (!visibleItems.length) return

    const sec = document.createElement('div')
    sec.className = 'adm-nav-section'
    sec.textContent = group.section
    nav.appendChild(sec)

    visibleItems.forEach(item => {
      const btn = document.createElement('button')
      btn.className = 'adm-nav-item' + (item.key === activeKey ? ' active' : '')
      btn.dataset.panel = item.key
      btn.innerHTML = `
        <svg class="adm-nav-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24">${item.icon}</svg>
        <span>${item.label}</span>`
      btn.addEventListener('click', () => navigate(item.key))
      nav.appendChild(btn)
    })
  })
}

/* ── Panel router ─────────────────────────────────────────────── */
const PANELS = {
  overview:      () => import('./panels/overview.js'),
  matching:      () => import('./panels/matching.js'),
  users:         () => import('./panels/users.js'),
  subscriptions: () => import('./panels/subscriptions.js'),
  moderation:    () => import('./panels/moderation.js'),
  events:        () => import('./panels/events.js'),
  messaging:     () => import('./panels/messaging.js'),
  concierge:     () => import('./panels/concierge.js'),
  settings:      () => import('./panels/settings.js'),
}

let currentPanel = null

async function navigate(key) {
  if (!(key in PANELS)) key = 'overview'
  buildNav(key)

  const panelEl = document.getElementById('admPanel')
  const loader  = document.createElement('div')
  loader.className = 'adm-loading'
  loader.innerHTML = '<div class="adm-spinner"></div>'
  panelEl.innerHTML = ''
  panelEl.appendChild(loader)

  const label = NAV.flatMap(g => g.items).find(i => i.key === key)?.label || key
  document.getElementById('admBreadcrumb').textContent = label
  document.title = `${label} — LEVEL Admin`
  history.replaceState({}, '', `?p=${key}`)

  try {
    const mod = await PANELS[key]()
    await mod.render(panelEl, api)
    currentPanel = key
  } catch (e) {
    console.error('Panel load error', e)
    panelEl.innerHTML = `<div style="padding:40px;color:var(--adm-text-dim)">Failed to load panel: ${e.message}</div>`
  }
}

/* ── Topbar ───────────────────────────────────────────────────── */
function buildTopbar() {
  const chip = document.getElementById('admAdminChip')
  const roleLabel = { super_admin: 'Super Admin', moderator: 'Moderator', support: 'Support' }
  chip.innerHTML = `
    <span>${admData.email || 'Admin'}</span>
    <span class="adm-role-badge ${admData.role}">${roleLabel[admData.role] || admData.role}</span>`

  document.getElementById('admLogoutBtn').addEventListener('click', logout)
}

async function logout() {
  try { await api.post('/admin/auth/logout') } catch {}
  sessionStorage.removeItem('adm_token')
  sessionStorage.removeItem('adm_admin')
  window.location.href = 'admin-login.html'
}

/* ── Session timeout ──────────────────────────────────────────── */
const TIMEOUT_MS  = (Number(admData.sessionTimeout) || 30) * 60 * 1000
const WARNING_MS  = 2 * 60 * 1000
let   idleTimer, warnTimer, countdownInterval

function resetIdle() {
  clearTimeout(idleTimer)
  clearTimeout(warnTimer)
  document.getElementById('admTimeoutWarning').style.display = 'none'
  clearInterval(countdownInterval)

  warnTimer = setTimeout(showWarning, TIMEOUT_MS - WARNING_MS)
  idleTimer = setTimeout(autoLogout, TIMEOUT_MS)
}

function showWarning() {
  const overlay   = document.getElementById('admTimeoutWarning')
  const countdown = document.getElementById('admTimeoutCountdown')
  overlay.style.display = 'flex'
  let secs = Math.floor(WARNING_MS / 1000)
  countdown.textContent = fmt(secs)
  countdownInterval = setInterval(() => {
    secs--
    countdown.textContent = fmt(secs)
  }, 1000)
}

function fmt(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` }

function autoLogout() {
  clearInterval(countdownInterval)
  logout()
}

function startSessionTimer() {
  const timerEl = document.getElementById('admTimer')
  const start = Date.now()
  setInterval(() => {
    const elapsed = Date.now() - start
    const remaining = Math.max(0, TIMEOUT_MS - elapsed)
    timerEl.textContent = `Session: ${fmt(Math.floor(remaining / 1000))}`
  }, 1000)
}

;['mousemove','keydown','click','scroll'].forEach(ev => document.addEventListener(ev, resetIdle))
document.getElementById('admExtendBtn').addEventListener('click', resetIdle)

/* ── Sidebar collapse ─────────────────────────────────────────── */
document.getElementById('admCollapseBtn').addEventListener('click', () => {
  document.getElementById('adm').classList.toggle('collapsed')
})

/* ── Bootstrap ────────────────────────────────────────────────── */
;(async () => {
  try {
    // Verify token is still valid
    await api.get('/admin/auth/me')
  } catch (e) {
    if (e.status === 401) {
      sessionStorage.removeItem('adm_token')
      window.location.href = 'admin-login.html'
      return
    }
  }

  document.getElementById('adm').style.display = ''
  buildTopbar()
  resetIdle()
  startSessionTimer()

  const startPanel = new URLSearchParams(location.search).get('p') || 'overview'
  await navigate(startPanel)
})()
