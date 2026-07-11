import {
  requireAuth,
  hydrateUser,
  hydrateFromProfile,
  hydrateSubscription,
  initBodyFade,
  initNav,
  initScrollReveal,
  initCompatBars,
} from './app.js'
import { store } from './store.js'
import { fetchMatches } from './matches-api.js'
import { fetchChatInbox } from './chat-api.js'
import { bootPageLoader, finishPageLoader, showSectionLoader, hideSectionLoader } from './loading.js'

const FALLBACK_GRADIENT = 'linear-gradient(160deg,#1A2F4A,#0D1E35,#1E1008)'

requireAuth()
initBodyFade()
initNav()
initScrollReveal()

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function refreshTopbarAvatars() {
  if (typeof window.__hydrateTopbarAvatars === 'function') window.__hydrateTopbarAvatars()
}

function greetingForHour() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatWelcomeDate(matchCount = 0, profileComplete = false) {
  const now = new Date()
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const datePart = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`
  if (!profileComplete) return `${datePart} · Complete your profile to unlock curated matches`
  if (matchCount > 0) return `${datePart} · ${matchCount} profile${matchCount === 1 ? '' : 's'} in your queue`
  return `${datePart} · Your queue refreshes daily`
}

function computeProfileStrength(user) {
  let score = 0
  const checks = []

  const photoCount = (user.photos || []).filter(p => {
    const src = typeof p === 'string' ? p : p?.src
    return src && !src.startsWith('blob:')
  }).length

  const photoPct = Math.min(100, Math.round((photoCount / 5) * 100))
  score += photoPct * 0.35
  checks.push({ label: `Photos (${photoCount}/5)`, pct: photoPct })

  const hasBio = !!(user.bio || user.legacyVision || '').trim()
  const bioPct = hasBio ? 100 : 0
  score += bioPct * 0.25
  checks.push({ label: 'Bio & vision', pct: bioPct })

  const hasCareer = !!(user.professionalTitle || user.role || user.careerChapter)
  const careerPct = hasCareer ? 100 : 60
  score += careerPct * 0.2
  checks.push({ label: 'Career story', pct: careerPct })

  const hasLocation = !!(user.countryCode || user.location || user.city)
  const locPct = hasLocation ? 100 : 0
  score += locPct * 0.2
  checks.push({ label: 'Location', pct: locPct })

  const total = Math.round(score)
  const tip = total >= 85
    ? 'Your profile is in great shape for matching.'
    : photoCount < 3
      ? 'Add more photos to improve your match quality.'
      : !hasBio
        ? 'Complete your bio and long-term vision to stand out.'
        : 'Fill in any remaining profile details to improve match quality.'

  return { total, checks, tip }
}

function buildDashboardStats(matchPayload, inboxPayload) {
  const matchStats = matchPayload?.stats || {}
  const inboxStats = inboxPayload?.stats || {}

  return {
    newMatches: matchStats.new ?? 0,
    activeChats: inboxStats.active ?? matchStats.mutual ?? 0,
    incomingRequests: inboxStats.incoming ?? matchStats.incoming ?? 0,
    pendingSent: inboxStats.pendingSent ?? 0,
  }
}

function renderStats(stats) {
  const cards = [
    { icon: '💫', cls: 'navy', value: stats.newMatches, label: 'New Introductions' },
    { icon: '✉️', cls: 'gold', value: stats.activeChats, label: 'Active Chats' },
    { icon: '✉', cls: 'ocean', value: stats.incomingRequests, label: 'Incoming Requests' },
    { icon: '🤝', cls: 'green', value: stats.pendingSent, label: 'Awaiting Response' },
  ]

  const grid = document.querySelector('.quick-stats')
  if (!grid) return

  grid.innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-icon ${c.cls}">${c.icon}</div>
      <div>
        <div class="stat-value">${c.value}</div>
        <div class="stat-label">${esc(c.label)}</div>
      </div>
    </div>`).join('')
}

function renderWelcome(user, matchPayload) {
  const topbarTitle = document.querySelector('.topbar-title')
  if (topbarTitle) {
    topbarTitle.textContent = `${greetingForHour()}, ${user.firstName || 'there'}.`
  }

  const greeting = document.querySelector('.welcome-greeting')
  if (greeting) {
    greeting.textContent = user.profileSavedToDb
      ? 'Your curated matches are ready.'
      : 'Welcome to LEVEL.'
  }

  const welcomeDate = document.querySelector('.welcome-date')
  if (welcomeDate) {
    const count = matchPayload?.stats?.new ?? matchPayload?.matches?.filter(m => m.status === 'new').length ?? 0
    welcomeDate.textContent = formatWelcomeDate(count, !!user.profileSavedToDb)
  }
}

function matchCardHtml(m) {
  const bg = m.photo
    ? `<img class="match-card-bg" src="${esc(m.photo)}" alt="${esc(m.name)}" loading="lazy">`
    : `<div class="match-card-bg" style="background:${FALLBACK_GRADIENT};"></div>`

  return `
    <div class="match-card" role="button" tabindex="0" data-id="${esc(m.id)}">
      ${bg}
      <div class="match-overlay"></div>
      <div class="match-card-content">
        <div class="match-name">${esc(m.name)}</div>
        <div class="match-details">${esc(m.profession)} · ${esc(m.location)}</div>
        <div class="match-align"><span class="match-align-score">${m.score}%</span> Compatibility Alignment</div>
        <div class="match-summary">${esc(m.alignmentSummary || '')}</div>
      </div>
    </div>`
}

function wireMatchCards(container) {
  const open = id => {
    if (id) window.location = `profile.html?id=${encodeURIComponent(id)}&from=dashboard`
  }
  container.addEventListener('click', e => {
    const card = e.target.closest('.match-card')
    if (card) open(card.dataset.id)
  })
  container.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const card = e.target.closest('.match-card')
    if (card) { e.preventDefault(); open(card.dataset.id) }
  })
}

function renderMatchGrid(matches, { isNewAccount, matchingEligible }) {
  const dashGrid = document.getElementById('dashMatches')
  if (!dashGrid) return

  if (isNewAccount) {
    dashGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:var(--s-10) var(--s-6);background:rgba(255,255,255,0.03);border:1px solid var(--border-light);border-radius:var(--radius-2xl);">
        <div style="font-family:var(--font-sans);font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-400);margin-bottom:var(--s-3);">Welcome to LEVEL</div>
        <div style="font-family:var(--font-serif);font-size:var(--text-2xl);font-weight:300;color:var(--text-primary);">Your curated matches will appear here</div>
        <p style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;line-height:1.7;color:var(--text-secondary);max-width:460px;margin:var(--s-3) auto var(--s-6);">
          Complete your profile and set your relationship goals so LEVEL can find your most compatible connections.
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:var(--s-3);justify-content:center;">
          <a class="btn btn-gold btn-sm" href="profile-setup.html">Complete your profile</a>
        </div>
      </div>`
    return
  }

  if (!matchingEligible) {
    dashGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:var(--s-10) var(--s-6);background:rgba(255,255,255,0.03);border:1px solid var(--border-light);border-radius:var(--radius-2xl);">
        <div style="font-family:var(--font-sans);font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-400);margin-bottom:var(--s-3);">Built for intentional partnership</div>
        <div style="font-family:var(--font-serif);font-size:var(--text-2xl);font-weight:300;color:var(--text-primary);">Your matching network is on hold</div>
        <p style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;line-height:1.7;color:var(--text-secondary);max-width:460px;margin:var(--s-3) auto var(--s-6);">
          LEVEL is designed for individuals seeking intentional, long-term partnerships. Update your relationship goals to rejoin the matching network.
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:var(--s-3);justify-content:center;">
          <a class="btn btn-gold btn-sm" href="onboarding.html?goals">Update relationship goals</a>
        </div>
      </div>`
    return
  }

  const top = matches
    .filter(m => m.status === 'new' || m.connectionStatus === 'none' || !m.connectionStatus)
    .slice(0, 3)

  if (!top.length) {
    dashGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:var(--s-10) var(--s-6);background:rgba(255,255,255,0.03);border:1px solid var(--border-light);border-radius:var(--radius-2xl);">
        <div style="font-family:var(--font-sans);font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-400);margin-bottom:var(--s-3);">Queue complete</div>
        <div style="font-family:var(--font-serif);font-size:var(--text-2xl);font-weight:300;color:var(--text-primary);">You're caught up for now</div>
        <p style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;line-height:1.7;color:var(--text-secondary);max-width:420px;margin:var(--s-3) auto var(--s-6);">
          Check messages for replies, or browse your full match queue for more introductions.
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:var(--s-3);justify-content:center;">
          <a class="btn btn-gold btn-sm" href="chat.html">Open messages</a>
          <a class="btn btn-outline-dark btn-sm" href="matches.html">View all matches</a>
        </div>
      </div>`
    return
  }

  dashGrid.innerHTML = top.map(matchCardHtml).join('')
  wireMatchCards(dashGrid)
}

function activityIcon(type) {
  if (type === 'message') return { badge: '✉', bg: '' }
  if (type === 'request') return { badge: '↗', bg: 'background:var(--gold-400);' }
  if (type === 'mutual') return { badge: '✦', bg: 'background:var(--ocean-500);' }
  return { badge: '·', bg: '' }
}

function renderActivity(inboxPayload) {
  const list = document.getElementById('activityList')
  if (!list) return

  const conversations = (inboxPayload?.conversations || [])
    .filter(c => c.connectionStatus !== 'pending_sent')
    .slice(0, 6)

  if (!conversations.length) {
    list.innerHTML = `
      <div style="text-align:center;padding:var(--s-8) var(--s-6);">
        <div style="font-family:var(--font-sans);font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-400);margin-bottom:var(--s-3);">No activity yet</div>
        <div style="font-family:var(--font-serif);font-size:var(--text-xl);font-weight:300;color:var(--text-primary);margin-bottom:var(--s-3);">Start connecting to see engagement</div>
        <p style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;line-height:1.7;color:var(--text-secondary);max-width:360px;margin:0 auto var(--s-5);">
          Connection requests and messages from members will appear here.
        </p>
        <a class="btn btn-outline-dark btn-sm" href="matches.html">Find connections</a>
      </div>`
    return
  }

  list.innerHTML = conversations.map(c => {
    let type = 'mutual'
    if (c.connectionStatus === 'pending_received') type = 'request'
    else if (c.preview?.startsWith('You:')) type = 'message'
    else if (c.connectionStatus === 'mutual' && c.preview && !c.preview.startsWith('Say hello')) type = 'message'

    const icon = activityIcon(type)
    const href = `chat.html?connection=${encodeURIComponent(c.connectionId)}`

    let action = c.preview || 'Updated recently'
    if (c.connectionStatus === 'pending_received') {
      action = `Sent you a connection request${c.score ? ` · ${c.score}% match` : ''}`
    } else if (c.connectionStatus === 'mutual' && c.preview?.startsWith('Say hello')) {
      action = `You're connected${c.score ? ` · ${c.score}% match` : ''}`
    }

    const avatar = c.photo
      ? `<img src="${esc(c.photo)}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center top;border-radius:50%;">`
      : `<div style="width:100%;height:100%;border-radius:50%;background:${c.fallback || FALLBACK_GRADIENT};"></div>`

    return `
      <a class="activity-item" href="${href}" style="text-decoration:none;color:inherit;">
        <div class="activity-avatar">
          ${avatar}
          <div class="activity-avatar-badge" style="${icon.bg}">${icon.badge}</div>
        </div>
        <div class="activity-body">
          <div class="activity-name">${esc(c.name)}</div>
          <div class="activity-action">${esc(action)}</div>
        </div>
        <div class="activity-time">${esc(c.previewLabel || '')}</div>
      </a>`
  }).join('')
}

function renderFeaturedMatch(topMatch) {
  const el = document.getElementById('featuredMatch')
  if (!el) return

  if (!topMatch) {
    el.style.display = 'none'
    return
  }

  el.style.display = ''
  const visual = topMatch.photo
    ? `<img src="${esc(topMatch.photo)}" alt="${esc(topMatch.name)}" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;">`
    : `<div style="width:100%;height:100%;background:${FALLBACK_GRADIENT};"></div>`

  el.innerHTML = `
    <div class="featured-match-visual">
      ${visual}
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(9,18,42,0.95) 100%);"></div>
      <div style="position:absolute;top:var(--s-4);left:var(--s-4);">
        <div class="badge badge-gold">⭐ Top match today</div>
      </div>
    </div>
    <div class="featured-match-content">
      <div class="featured-match-name">${esc(topMatch.name)}</div>
      <div class="featured-match-role">${esc([topMatch.profession, topMatch.location, topMatch.age].filter(Boolean).join(' · '))}</div>
      <div class="featured-score">
        <div class="featured-score-num">${topMatch.score}</div>
        <div style="font-family:var(--font-serif);font-size:var(--text-xl);font-weight:300;color:var(--gold-400);align-self:flex-start;margin-top:2px;">%</div>
        <div class="featured-score-details">
          <div class="featured-score-label">Compatibility Alignment</div>
          <div style="font-family:var(--font-sans);font-size:var(--text-xs);font-weight:300;line-height:1.55;color:rgba(255,255,255,0.55);margin-top:6px;">${esc(topMatch.alignmentSummary || 'Curated based on your profile signals.')}</div>
        </div>
      </div>
      <div class="featured-actions">
        <a href="profile.html?id=${encodeURIComponent(topMatch.id)}&from=dashboard" class="btn btn-gold" style="flex:1;justify-content:center;">View Profile</a>
        <a href="matches.html" class="btn btn-outline" style="flex:1;justify-content:center;">All Matches</a>
      </div>
    </div>`

  initCompatBars()
}

function renderProfileStrength(user) {
  const el = document.getElementById('profileStrength')
  if (!el) return

  const { total, checks, tip } = computeProfileStrength(user)

  el.innerHTML = `
    <div class="insight-header">
      <div class="insight-title">Profile Strength</div>
      <span class="badge badge-gold">${total}%</span>
    </div>
    <div style="font-family:var(--font-sans);font-size:var(--text-xs);font-weight:300;color:var(--text-muted);line-height:1.7;margin-bottom:var(--s-5);">${esc(tip)}</div>
    <div style="display:flex;flex-direction:column;gap:var(--s-3);">
      ${checks.map(c => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--s-3);">
          <span style="font-family:var(--font-sans);font-size:var(--text-xs);color:var(--text-muted);min-width:100px;">${esc(c.label)}</span>
          <div style="flex:1;height:3px;background:rgba(255,255,255,0.08);border-radius:var(--radius-full);overflow:hidden;">
            <div style="height:100%;width:${c.pct}%;background:linear-gradient(to right,var(--ocean-700),var(--ocean-300));border-radius:var(--radius-full);"></div>
          </div>
        </div>`).join('')}
    </div>
    <a href="profile-setup.html" class="btn btn-outline-dark btn-sm" style="width:100%;justify-content:center;margin-top:var(--s-5);">
      ${total >= 85 ? 'Edit profile' : 'Complete profile'}
    </a>`
}

function updateChatBadge(inboxPayload) {
  const incoming = inboxPayload?.stats?.incoming || 0
  document.querySelectorAll('.app-topbar a[href="chat.html"] .notif-dot').forEach(dot => {
    dot.style.display = incoming > 0 ? '' : 'none'
  })
}

async function bootDashboard() {
  bootPageLoader('Loading dashboard')
  hydrateUser()
  refreshTopbarAvatars()

  try { await hydrateFromProfile() } catch {}
  try { await hydrateSubscription() } catch {}
  try { await import('./profile-photos.js').then(m => m.syncPhotosToStore()) } catch {}

  const user = hydrateUser()
  refreshTopbarAvatars()

  const isNewAccount = !user.profileSavedToDb
  let matchPayload = null
  let inboxPayload = null

  if (!isNewAccount) {
    const tasks = []
    if (store.isMatchingEligible()) {
      tasks.push(fetchMatches().then(p => { matchPayload = p }).catch(() => {}))
    }
    tasks.push(fetchChatInbox().then(p => { inboxPayload = p }).catch(() => {}))
    await Promise.all(tasks)
  }

  renderWelcome(user, matchPayload)
  renderStats(buildDashboardStats(matchPayload, inboxPayload))
  renderMatchGrid(matchPayload?.matches || [], {
    isNewAccount,
    matchingEligible: store.isMatchingEligible() && matchPayload?.matchingEligible !== false,
  })
  renderActivity(inboxPayload)
  renderFeaturedMatch(
    (matchPayload?.matches || [])
      .filter(m => m.status === 'new')
      .sort((a, b) => (b.score || 0) - (a.score || 0))[0]
      || (matchPayload?.matches || []).sort((a, b) => (b.score || 0) - (a.score || 0))[0]
      || null,
  )
  renderProfileStrength(user)
  updateChatBadge(inboxPayload)
  finishPageLoader()
}

bootDashboard().catch(err => {
  console.error('[dashboard] init failed:', err)
  finishPageLoader()
})
