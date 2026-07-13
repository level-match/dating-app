/* ============================================================
   LEVEL — Membership Guard
   Strict gatekeeper for every tier-bound surface.
   Reads the active session tier, enforces quota / geo / thread /
   exec-layer limits, and renders upgrade prompts when blocked.
   ============================================================ */

import { store } from './store.js'
import {
  getEntitlements, getTierMeta,
  canAccessGeo, canAccessExecFeature, canAccessCommunityLevel,
  requiredTierForGeo, requiredTierForExec,
} from './membership.js'

const CYCLE_KEY = 'level_match_cycle'

/** Cached quota from GET /api/matches — server is source of truth. */
let _serverMatchQuota = null

export function setMatchQuotaFromServer(quota) {
  _serverMatchQuota = quota || null
}

/* ── Active session tier ────────────────────────────────────── */

export function currentTier() {
  return store.getUser()?.tier || 'base'
}

/* ── Daily match delivery quota (server-backed) ───────────────
   Base tier cap is enforced by GET /api/matches + match_deliveries.
   Local cycle storage is deprecated — kept only for legacy cleanup.
   ─────────────────────────────────────────────────────────── */

function clearLegacyMatchCycle() {
  try { localStorage.removeItem(CYCLE_KEY) } catch {}
}

clearLegacyMatchCycle()

export function recordMatchDelivery() {
  // No-op: delivery ledger lives on the server.
}

export function getRemainingMatchQuota() {
  const e = getEntitlements(currentTier())
  if (e.matchDelivery.type === 'unlimited') return Infinity
  if (_serverMatchQuota?.type === 'capped') {
    return Math.max(0, _serverMatchQuota.remaining ?? 0)
  }
  const cached = store.getMatchQuota?.()
  if (cached?.type === 'capped') {
    return Math.max(0, cached.remaining ?? 0)
  }
  return e.matchDelivery.dailyLimit
}

export function getDailyMatchLimit() {
  const e = getEntitlements(currentTier())
  return e.matchDelivery.type === 'unlimited' ? Infinity : e.matchDelivery.dailyLimit
}

/* ── Geographic access filter ───────────────────────────────── */

export function isGeoAccessible(memberGeoTier) {
  return canAccessGeo(currentTier(), memberGeoTier || 'local')
}

/** Returns only the members the current tier can access */
export function filterByGeoReach(members) {
  return members.filter(m => isGeoAccessible(m.geoTier))
}

/** Splits members into { accessible, locked } by geo reach */
export function partitionByGeoReach(members) {
  const accessible = []
  const locked     = []
  members.forEach(m => (isGeoAccessible(m.geoTier) ? accessible : locked).push(m))
  return { accessible, locked }
}

/* ── Messaging thread gate ──────────────────────────────────── */

let _activeThreadCount = null

/** Set active thread count from the chat inbox API (preferred). */
export function setActiveThreadCount(count) {
  _activeThreadCount = Number.isFinite(count) ? count : null
}

export function getActiveThreadCount() {
  if (_activeThreadCount !== null) return _activeThreadCount
  return 0
}

export function canOpenNewThread() {
  const limit = getEntitlements(currentTier()).messaging.maxThreads
  return !isFinite(limit) || getActiveThreadCount() < limit
}

export function getThreadLimit() {
  return getEntitlements(currentTier()).messaging.maxThreads
}

/* ── Execution layer gate ───────────────────────────────────── */

export function canUseExecution(feature) {
  return canAccessExecFeature(currentTier(), feature)
}

/* ── Community access ───────────────────────────────────────── */

export function communityAccessLevel() {
  return getEntitlements(currentTier()).communityAccess
}

/* ── Upgrade modal ──────────────────────────────────────────
   Renders a dismissible modal anchored above all other content.
   ─────────────────────────────────────────────────────────── */

export function showUpgradeModal({ requiredTier = 'plus', title = '', body = '' } = {}) {
  document.getElementById('levelUpgradeModal')?.remove()

  const meta     = getTierMeta(requiredTier)
  const priceStr = meta.price > 0 ? `₱${meta.price.toLocaleString()}/month` : 'Free'

  const el = document.createElement('div')
  el.id = 'levelUpgradeModal'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.setAttribute('aria-label', 'Upgrade required')

  el.innerHTML = `
    <div class="upg-backdrop"></div>
    <div class="upg-dialog">
      <button class="upg-close" aria-label="Close"
        onclick="document.getElementById('levelUpgradeModal')?.remove()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="6" y1="6" x2="18" y2="18"/>
          <line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
      <div class="upg-icon">✦</div>
      <div class="upg-eyebrow">${meta.name}</div>
      <h3 class="upg-title">${title || `Unlock with ${meta.name}`}</h3>
      <p class="upg-body">${
        body ||
        `This feature is available on <strong>${meta.name}</strong> (${priceStr}) and above.`
      }</p>
      <div class="upg-actions">
        <a href="membership.html" class="btn btn-gold"
           style="width:100%;justify-content:center;margin-bottom:10px;">
          Upgrade to ${meta.shortName} &nbsp;·&nbsp; ${priceStr}
        </a>
        <button class="btn btn-outline-dark"
          style="width:100%;justify-content:center;"
          onclick="document.getElementById('levelUpgradeModal')?.remove()">
          Maybe later
        </button>
      </div>
    </div>`

  el.querySelector('.upg-backdrop').addEventListener('click', () => el.remove())
  document.body.appendChild(el)
  return el
}

/* ── Inline locked-feature banner ───────────────────────────
   Returns an HTML string ready to inject into the page.
   ─────────────────────────────────────────────────────────── */

export function lockedBanner({ requiredTier = 'plus', message = '', icon = '✦' } = {}) {
  const meta     = getTierMeta(requiredTier)
  const priceStr = meta.price > 0 ? `₱${meta.price.toLocaleString()}/month` : 'Free'
  return `
    <div class="tier-lock-banner">
      <div class="tier-lock-icon">${icon}</div>
      <div class="tier-lock-text">
        <div class="tier-lock-title">${message || `${meta.name} feature`}</div>
        <div class="tier-lock-sub">${meta.name} · ${priceStr}</div>
      </div>
      <a href="membership.html" class="btn btn-gold btn-sm">Upgrade</a>
    </div>`
}

/* ── Locked match card placeholder ─────────────────────────── */

export function lockedMatchCard({ reason = 'geo', requiredTier = 'plus', name = '' } = {}) {
  const meta  = getTierMeta(requiredTier)
  const label = reason === 'geo'
    ? `${meta.shortName} expands your geographic reach`
    : `Your ${meta.shortName} quota resets tomorrow`
  const sub = reason === 'geo'
    ? `Upgrade to access members outside your local region`
    : `You've reached today's match delivery limit (Base plan)`
  return `
    <article class="match-card match-card--locked" aria-hidden="true">
      <div class="match-card-bg" style="background:linear-gradient(160deg,#0C0C18,#080812);"></div>
      <div class="match-overlay"></div>
      <div class="match-card-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:32px 20px;">
        <div style="font-size:28px;opacity:0.4;">✦</div>
        <div style="font-family:var(--font-serif);font-size:1.1rem;font-weight:300;color:var(--cream-50);line-height:1.4;">${label}</div>
        <div style="font-family:var(--font-sans);font-size:0.78rem;font-weight:300;color:rgba(255,255,255,0.45);line-height:1.5;">${sub}</div>
        <a href="membership.html" class="btn btn-gold btn-sm" style="margin-top:4px;">Upgrade</a>
      </div>
    </article>`
}
