import { requireAuth, initBodyFade } from './app.js'
import { getMembersByScore, STATUS_LABELS } from './members.js'
import { store } from './store.js'
import {
  partitionByGeoReach, getRemainingMatchQuota, recordMatchDelivery,
  lockedMatchCard, currentTier,
} from './membership-guard.js'
import { requiredTierForGeo, getTierMeta } from './membership.js'

requireAuth()
initBodyFade()

/* ─── Verification badge glyphs (line-style, restrained) ─── */
const BADGE_SVG = {
  id: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2"/><path d="M14 11h4M14 14h3"/></svg>`,
  career: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v12H3z"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>`,
  photo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="3"/><path d="M5 7h3l2-3h4l2 3h3v12H5z"/></svg>`,
  premium: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.4 5 5.6.8-4 3.9 1 5.5L12 21l-5-2.8 1-5.5-4-3.9 5.6-.8z"/></svg>`,
}
const BADGE_LABEL = { id: 'ID', career: 'Career', photo: 'Photo', premium: 'Premium' }

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

function cardTemplate(m) {
  const bg = m.photo
    ? `<img class="match-card-bg" src="${m.photo}" alt="${escapeHtml(m.name)}" loading="lazy">`
    : `<div class="match-card-bg" style="background:${m.fallback};"></div>`

  return `
    <article class="match-card" data-id="${m.id}" data-status="${m.status}" data-score="${m.score}"
             role="button" tabindex="0" aria-label="View ${escapeHtml(m.name)}'s profile">
      ${bg}
      <div class="match-overlay"></div>
      <div class="match-status-pill ${m.status}">${STATUS_LABELS[m.status] || ''}</div>

      <div class="match-card-content">
        <div class="match-name">${escapeHtml(m.name)}</div>
        <div class="match-details">${escapeHtml(m.profession)} · ${escapeHtml(m.location)}</div>

        <div class="match-align">
          <span class="match-align-score">${m.score}%</span> Compatibility Alignment
        </div>
        <div class="match-summary">${escapeHtml(m.alignmentSummary)}</div>

        <div class="lvl-vbadge-cluster match-badges">${badgeCluster(m.badges)}</div>
      </div>
    </article>`
}

const grid = document.getElementById('matchesGrid')

/* ─── Intent Guardrail (respectful) ─────────────────────────────
   The matching network is reserved for serious, long-term intent.
   When the protected policy marks a member ineligible, we replace the
   curated grid with a respectful explanation and constructive options —
   never a punitive "you're banned" message. */
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
        <a class="btn btn-outline-dark" href="restaurants.html">Continue exploring LEVEL</a>
      </div>
    </div>`
}

if (!store.isMatchingEligible()) {
  // Ineligible: show the respectful gate; hide filters + stats.
  grid.innerHTML = intentGate()
  document.getElementById('matchFilters')?.style.setProperty('display', 'none')
  document.querySelector('.quick-stats')?.style.setProperty('display', 'none')
  const sub = document.querySelector('.section-card-sub')
  if (sub) sub.textContent = 'Curated introductions resume once your relationship goals reflect long-term intent.'
} else {
  const allMembers = getMembersByScore()

  /* ─ Tier-based access: geo filter + daily quota ─────────────
     1. Split curated set into geo-accessible vs geo-locked.
     2. For Base tier, cap accessible profiles by today's quota.
     3. Filter out any members the user has already requested.
     4. If no actionable profiles remain, show the subscription gate.
     ─────────────────────────────────────────────────────────── */
  const { accessible, locked: geoLocked } = partitionByGeoReach(allMembers)
  const quota       = getRemainingMatchQuota()
  const withinQuota = isFinite(quota) ? accessible.slice(0, quota) : accessible
  const quotaLocked = isFinite(quota) ? accessible.slice(quota) : []

  // Strip members who already received a connection request this session
  const sentIds  = store.getSentRequestIds()
  const shown    = withinQuota.filter(m => !sentIds.includes(m.id))
  const pending  = withinQuota.filter(m =>  sentIds.includes(m.id))

  // Record delivery only for newly surfaced profiles
  if (isFinite(quota) && shown.length > 0) recordMatchDelivery(shown.length)

  /* ─ Exhausted gate: show when no actionable matches remain ── */
  function exhaustedGate() {
    const tier     = currentTier()
    const meta     = getTierMeta(tier)
    const isBase   = tier === 'base'
    const isPlus   = tier === 'plus'
    const upgTitle = isBase
      ? 'Upgrade to see more matches'
      : 'Your next curated set is on its way'
    const upgBody  = isBase
      ? 'LEVEL Plus unlocks expanded national reach, unlimited profile delivery, and in-app reservations — ₱499/month.'
      : isPlus
        ? 'Upgrade to Prime for global reach, real-time priority ranking, and personal concierge assistance.'
        : 'New curated introductions are prepared every 24 hours. Check back tomorrow.'
    const upgCta   = tier === 'prime'
      ? `<a href="dashboard.html" class="btn btn-gold btn-sm">Back to dashboard</a>`
      : `<a href="membership.html" class="btn btn-gold btn-sm">See upgrade options</a>`

    return `
      <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;text-align:center;
                  padding:var(--s-16) var(--s-8);gap:var(--s-4);">
        <div style="font-size:36px;opacity:0.35;">✦</div>
        <div style="font-family:var(--font-sans);font-size:0.7rem;letter-spacing:0.2em;text-transform:uppercase;
                    color:var(--gold-400);font-weight:500;">Queue complete</div>
        <h3 style="font-family:var(--font-serif);font-size:1.9rem;font-weight:300;color:var(--cream-50);
                   letter-spacing:-0.02em;line-height:1.1;max-width:480px;">${upgTitle}</h3>
        <p style="font-family:var(--font-sans);font-size:0.92rem;font-weight:300;color:rgba(255,255,255,0.55);
                  line-height:1.7;max-width:440px;">${upgBody}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:var(--s-2);">
          ${upgCta}
          <a href="chat.html" class="btn btn-outline-dark btn-sm">View pending requests</a>
        </div>
      </div>`
  }

  grid.innerHTML = [
    ...shown.map(cardTemplate),
    shown.length === 0 ? exhaustedGate() : '',
    ...quotaLocked.map(() => lockedMatchCard({ reason: 'quota', requiredTier: 'plus' })),
    ...geoLocked.map(m => lockedMatchCard({ reason: 'geo', requiredTier: requiredTierForGeo(m.geoTier) })),
  ].join('')

  /* Open a profile — locked and exhausted cards have no data-id so do nothing. */
  const openProfile = id => { if (id) window.location = `profile.html?id=${encodeURIComponent(id)}` }

  grid.addEventListener('click', e => {
    const card = e.target.closest('.match-card:not(.match-card--locked)')
    if (card) openProfile(card.dataset.id)
  })
  grid.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const card = e.target.closest('.match-card:not(.match-card--locked)')
    if (card) { e.preventDefault(); openProfile(card.dataset.id) }
  })

  /* Filters */
  const filters = document.querySelectorAll('#matchFilters .filter-tab')
  filters.forEach(tab => {
    tab.addEventListener('click', () => {
      filters.forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      const f = tab.dataset.filter
      document.querySelectorAll('#matchesGrid .match-card').forEach(card => {
        if (card.classList.contains('match-card--locked')) return
        const status = card.dataset.status
        const score  = +card.dataset.score
        const show   = f === 'all' || (f === 'high' ? score >= 90 : status === f)
        card.classList.toggle('is-hidden', !show)
      })
    })
  })
}
