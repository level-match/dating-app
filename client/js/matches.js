import { requireAuth, initBodyFade, showToast, hydrateFromProfile } from './app.js'
import { STATUS_LABELS } from './members.js'
import { store } from './store.js'
import {
  fetchMatches,
  sendConnectionRequest,
  acceptConnectionRequest,
} from './matches-api.js'
import { lockedMatchCard, currentTier } from './membership-guard.js'
import { requiredTierForGeo } from './membership.js'

requireAuth()
initBodyFade()

const FALLBACK_GRADIENT = 'linear-gradient(160deg,#1A2F4A,#0D1E35,#1E1008)'

const BADGE_SVG = {
  id: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2"/><path d="M14 11h4M14 14h3"/></svg>`,
  career: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v12H3z"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>`,
  photo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="3"/><path d="M5 7h3l2-3h4l2 3h3v12H5z"/></svg>`,
  premium: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.4 5 5.6.8-4 3.9 1 5.5L12 21l-5-2.8 1-5.5-4-3.9 5.6-.8z"/></svg>`,
}
const BADGE_LABEL = { id: 'ID', career: 'Career', photo: 'Photo', premium: 'Premium' }

let liveMatches = []
let liveLocked = []
let liveTier = 'base'
let actionBusy = false

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]))
}

function badgeCluster(badges) {
  return (badges || []).map(b => `
    <span class="lvl-vbadge lvl-vbadge--${b} lvl-vbadge--sm" title="${BADGE_LABEL[b] || ''} Verified">
      ${BADGE_SVG[b] || ''}${BADGE_LABEL[b] || ''}
    </span>`).join('')
}

function enrichApiMatch(m) {
  const badges = []
  if (m.photo) badges.push('photo')
  if (m.memberTier === 'prime' || m.memberTier === 'plus') badges.push('premium')
  return { ...m, badges, fallback: FALLBACK_GRADIENT }
}

function ctaForMatch(m) {
  const status = m.connectionStatus || m.status

  if (status === 'mutual' || m.status === 'mutual') {
    return `<button type="button" class="btn btn-gold btn-sm match-card-cta-btn" data-action="message">Message</button>`
  }
  if (status === 'pending_received' || m.status === 'request') {
    return `
      <button type="button" class="btn btn-gold btn-sm match-card-cta-btn" data-action="accept">Accept</button>
      <button type="button" class="btn btn-outline-dark btn-sm match-card-cta-btn" data-action="view">View profile</button>`
  }
  if (status === 'pending_sent' || m.status === 'pending') {
    return `<button type="button" class="btn btn-outline-dark btn-sm match-card-cta-btn" disabled>Request sent</button>`
  }
  return `
    <button type="button" class="btn btn-gold btn-sm match-card-cta-btn" data-action="connect">Connect</button>
    <button type="button" class="btn btn-outline-dark btn-sm match-card-cta-btn" data-action="view">View profile</button>`
}

function cardTemplate(m) {
  const bg = m.photo
    ? `<img class="match-card-bg" src="${m.photo}" alt="${escapeHtml(m.name)}" loading="lazy">`
    : `<div class="match-card-bg" style="background:${m.fallback || FALLBACK_GRADIENT};"></div>`

  return `
    <article class="match-card" data-id="${m.id}" data-status="${m.status}" data-score="${m.score}"
             tabindex="0" aria-label="View ${escapeHtml(m.name)}'s profile">
      ${bg}
      <div class="match-overlay"></div>
      <div class="match-status-pill ${m.status}">${STATUS_LABELS[m.status] || m.status}</div>

      <div class="match-card-content">
        <div class="match-name">${escapeHtml(m.name)}</div>
        <div class="match-details">${escapeHtml(m.profession)} · ${escapeHtml(m.location)}</div>

        <div class="match-align">
          <span class="match-align-score">${m.score}%</span> Compatibility Alignment
        </div>
        <div class="match-summary">${escapeHtml(m.alignmentSummary)}</div>

        <div class="lvl-vbadge-cluster match-badges">${badgeCluster(m.badges)}</div>

        <div class="match-card-cta" data-stop-nav="true">
          ${ctaForMatch(m)}
        </div>
      </div>
    </article>`
}

const grid = document.getElementById('matchesGrid')

function intentGate() {
  return `
    <div class="intent-gate">
      <div class="intent-gate-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 21s-7-4.5-9.5-9C1.1 9.7 2.6 6 6 6c2 0 3.3 1.2 4 2.4C10.7 7.2 12 6 14 6c3.4 0 4.9 3.7 3.5 6-2.5 4.5-9.5 9-9.5 9z"/>
        </svg>
      </div>
      <div class="intent-gate-eyebrow">Built for intentional partnership</div>
      <h2 class="intent-gate-title">Your matching network is on hold</h2>
      <p class="intent-gate-body">
        LEVEL is designed for individuals seeking intentional, long-term partnerships.
        Your current relationship preferences may not align with the core matching
        network at this time.
      </p>
      <div class="intent-gate-actions">
        <a class="btn btn-gold" href="onboarding.html?goals">Update relationship goals</a>
        <a class="btn btn-outline" href="onboarding.html">Revisit onboarding preferences</a>
      </div>
    </div>`
}

function locationGate(message) {
  return `
    <div class="intent-gate">
      <div class="intent-gate-eyebrow">Location required</div>
      <h2 class="intent-gate-title">Set your location to unlock matches</h2>
      <p class="intent-gate-body">${escapeHtml(message)}</p>
      <div class="intent-gate-actions">
        <a class="btn btn-gold" href="profile-setup.html">Complete profile setup</a>
      </div>
    </div>`
}

function emptyGate() {
  return `
    <div class="intent-gate" style="grid-column:1/-1;">
      <div class="intent-gate-eyebrow">Curated network</div>
      <h2 class="intent-gate-title">No introductions yet</h2>
      <p class="intent-gate-body">
        Your profile is live. New curated introductions appear as eligible members join
        your region — or when someone sends you a connection request.
      </p>
      <div class="intent-gate-actions">
        <a class="btn btn-gold" href="profile-setup.html">Review your profile</a>
        <a class="btn btn-outline-dark" href="membership.html">Expand your reach</a>
      </div>
    </div>`
}

function showIntentGate() {
  grid.innerHTML = intentGate()
  document.getElementById('matchFilters')?.style.setProperty('display', 'none')
  document.querySelector('.quick-stats')?.style.setProperty('display', 'none')
}

function exhaustedGate(tierOverride) {
  const tier = tierOverride || currentTier()
  const isBase = tier === 'base'
  const upgTitle = isBase ? 'Daily queue complete' : 'Your next curated set is on its way'
  const upgBody = isBase
    ? 'LEVEL Plus unlocks unlimited profile delivery and expanded national reach — ₱499/month.'
    : 'New curated introductions refresh daily. Incoming requests still appear here.'

  return `
    <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;text-align:center;
                padding:var(--s-12) var(--s-6);gap:var(--s-4);">
      <div style="font-size:36px;opacity:0.35;">✦</div>
      <h3 style="font-family:var(--font-serif);font-size:1.6rem;font-weight:300;color:var(--cream-50);">${upgTitle}</h3>
      <p style="font-family:var(--font-sans);font-size:0.92rem;font-weight:300;color:rgba(255,255,255,0.55);max-width:440px;line-height:1.7;">${upgBody}</p>
      <a href="membership.html" class="btn btn-gold btn-sm">See upgrade options</a>
    </div>`
}

function updateStats(stats = {}) {
  const set = (id, val) => {
    const el = document.getElementById(id)
    if (el) el.textContent = val ?? '0'
  }
  set('statTotal', stats.total)
  set('statNew', stats.new)
  set('statMutual', stats.mutual)
  set('statPending', stats.pending)
}

function openProfile(id) {
  if (id) window.location = `profile.html?id=${encodeURIComponent(id)}&from=matches`
}

function applyMatchUpdate(profile) {
  if (!profile?.id) return
  const idx = liveMatches.findIndex(m => String(m.id) === String(profile.id))
  const enriched = enrichApiMatch(profile)
  if (idx >= 0) liveMatches[idx] = enriched
  else liveMatches.unshift(enriched)
  renderMatchGrid()
}

function persistSentRequest(match) {
  store.addSentRequest({
    id: match.id,
    name: match.name,
    role: match.profession || '',
    location: match.location || '',
    score: match.score || 0,
    fallback: match.fallback || FALLBACK_GRADIENT,
  })
}

async function handleCardAction(profileId, action) {
  if (actionBusy) return
  const match = liveMatches.find(m => String(m.id) === String(profileId))
  if (!match) return

  if (action === 'view') {
    openProfile(profileId)
    return
  }

  if (action === 'message') {
    if (match.connectionStatus !== 'mutual' && match.status !== 'mutual') {
      showToast('Messaging unlocks once you both accept the connection.', '⚠', 3000)
      return
    }
    const qs = match.connectionId
      ? `?connection=${encodeURIComponent(match.connectionId)}`
      : ''
    window.location.href = `chat.html${qs}`
    return
  }

  actionBusy = true
  try {
    if (action === 'connect') {
      const result = await sendConnectionRequest(profileId)
      applyMatchUpdate(result.profile)
      if (result.connection?.mutual) {
        showToast(`Connected with ${match.name.split(' ')[0]} — messaging unlocked.`, '✦', 2800)
      } else {
        persistSentRequest(result.profile || match)
        showToast(`Request sent to ${match.name.split(' ')[0]}.`, '✦', 2600)
      }
      updateStatsFromLive()
      return
    }

    if (action === 'accept') {
      const result = await acceptConnectionRequest(profileId)
      applyMatchUpdate(result.profile)
      showToast(`Connected with ${match.name.split(' ')[0]}.`, '✦', 2800)
      updateStatsFromLive()
    }
  } catch (err) {
    showToast(err.message || 'Something went wrong. Please try again.', '⚠', 3500)
  } finally {
    actionBusy = false
  }
}

function updateStatsFromLive() {
  updateStats({
    total: liveMatches.length,
    new: liveMatches.filter(m => m.status === 'new').length,
    mutual: liveMatches.filter(m => m.status === 'mutual').length,
    pending: liveMatches.filter(m => m.status === 'pending' || m.status === 'request').length,
  })
}

function wireGridInteractions() {
  grid.onclick = e => {
    const actionBtn = e.target.closest('[data-action]')
    if (actionBtn) {
      e.preventDefault()
      e.stopPropagation()
      const card = actionBtn.closest('.match-card')
      handleCardAction(card?.dataset.id, actionBtn.dataset.action)
      return
    }

    if (e.target.closest('[data-stop-nav]')) return

    const card = e.target.closest('.match-card:not(.match-card--locked)')
    if (card) openProfile(card.dataset.id)
  }

  grid.onkeydown = e => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const card = e.target.closest('.match-card:not(.match-card--locked)')
    if (card) { e.preventDefault(); openProfile(card.dataset.id) }
  }

  document.querySelectorAll('#matchFilters .filter-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('#matchFilters .filter-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      const f = tab.dataset.filter
      document.querySelectorAll('#matchesGrid .match-card').forEach(card => {
        if (card.classList.contains('match-card--locked')) return
        const status = card.dataset.status
        const score = +card.dataset.score
        let show = f === 'all'
        if (f === 'high') show = score >= 90
        else if (f === 'request') show = status === 'request'
        else if (f !== 'all') show = status === f
        card.classList.toggle('is-hidden', !show)
      })
    }
  })
}

function renderMatchGrid() {
  const hasCards = liveMatches.length > 0

  grid.innerHTML = [
    ...liveMatches.map(cardTemplate),
    !hasCards && liveLocked.length === 0 ? emptyGate() : '',
    !hasCards && liveLocked.length > 0 ? exhaustedGate(liveTier) : '',
    ...liveLocked.map(m => lockedMatchCard({
      reason: 'geo',
      requiredTier: m.requiredTier || requiredTierForGeo(m.geoTier),
    })),
  ].join('')

  wireGridInteractions()
}

function renderFromApi(payload) {
  if (!payload.matchingEligible) {
    showIntentGate()
    return
  }

  if (payload.tier) {
    const user = store.getUser()
    if (user) store.setUser({ ...user, tier: payload.tier })
  }

  liveTier = payload.tier || 'base'
  liveMatches = (payload.matches || []).map(enrichApiMatch)
  liveLocked = (payload.locked || []).filter(l => l.reason === 'geo')

  updateStats(payload.stats)
  renderMatchGrid()

  const sub = document.querySelector('.section-card-sub')
  if (sub) {
    sub.textContent = liveMatches.length
      ? 'Connect directly from a card, or open a full profile to review background and values.'
      : 'Complete your profile — introductions appear as members join your matching network.'
  }
}

async function bootMatchesPage() {
  await hydrateFromProfile().catch(() => {})

  try {
    const payload = await fetchMatches()
    renderFromApi(payload)
  } catch (err) {
    if (err.code === 'LOCATION_REQUIRED') {
      grid.innerHTML = locationGate(err.message)
      document.getElementById('matchFilters')?.style.setProperty('display', 'none')
      document.querySelector('.quick-stats')?.style.setProperty('display', 'none')
      return
    }

    grid.innerHTML = `
      <div class="intent-gate" style="grid-column:1/-1;">
        <h2 class="intent-gate-title">Could not load matches</h2>
        <p class="intent-gate-body">${escapeHtml(err.message || 'Check that you are signed in and the server is running.')}</p>
        <div class="intent-gate-actions">
          <button type="button" class="btn btn-gold" onclick="location.reload()">Retry</button>
        </div>
      </div>`
    console.error('[matches] load failed:', err)
  }
}

bootMatchesPage()
