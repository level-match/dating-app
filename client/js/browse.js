import { store } from './store.js'
import { requireAuth, initBodyFade, initNav, showToast } from './app.js'
import { currentTier } from './membership-guard.js'
import { getTierMeta } from './membership.js'
import { fetchMatches, fetchMatchProfile, sendConnectionRequest as apiSendRequest } from './matches-api.js'

requireAuth()
initBodyFade()
initNav()

const FALLBACK_GRADIENT = 'linear-gradient(160deg,#1A2F4A,#0D1E35,#1E1008)'
const VISIBLE_COUNT = 3

let deck = []
let connectedToday = 0

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]))
}

function updateStats() {
  document.getElementById('brRemaining').textContent  = deck.length
  document.getElementById('brConnected').textContent  = connectedToday
}

function cardTemplate(p) {
  const photoStyle = p.photo
    ? `background-image:url('${p.photo}');`
    : `background:${p.fallback || FALLBACK_GRADIENT};`

  const badgeHtml = (p.badges || []).map(b => {
    const icons = {
      photo:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="3"/><path d="M5 7h3l2-3h4l2 3h3v12H5z"/></svg>`,
      career:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v12H3z"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>`,
      premium: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.4 5 5.6.8-4 3.9 1 5.5L12 21l-5-2.8 1-5.5-4-3.9 5.6-.8z"/></svg>`,
    }
    const labels = { photo: 'Photo', career: 'Career', premium: 'Premium' }
    if (!icons[b]) return ''
    return `<span class="lvl-vbadge lvl-vbadge--${b} lvl-vbadge--sm" title="${labels[b] || ''} Verified">${icons[b]}${labels[b] || ''}</span>`
  }).join('')

  const intentTag = p.intentShort
    ? `<span class="br-card-tag">${escapeHtml(p.intentShort)}</span>` : ''

  return `
    <article class="br-card" data-id="${p.id}">
      <div class="br-card-photo" style="${photoStyle}"></div>
      <div class="br-card-gradient"></div>

      <div class="br-card-top">
        <span class="br-card-score">${p.score}% match</span>
      </div>

      <div class="br-card-body">
        <div class="br-card-name">${escapeHtml(p.name)}${p.age ? ` <span class="age">· ${p.age}</span>` : ''}</div>
        <div class="br-card-role">${escapeHtml(p.profession || '')}</div>
        <div class="br-card-loc">${escapeHtml(p.location || '')}</div>

        ${badgeHtml ? `<div class="lvl-vbadge-cluster" style="margin-top:12px;">${badgeHtml}</div>` : ''}

        <div class="br-card-tags">${intentTag}</div>

        <div class="br-card-actions">
          <div class="br-action-wrap">
            <button type="button" class="br-action pass" data-action="pass" title="Not connected" aria-label="Not connected">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <line x1="6" y1="6" x2="18" y2="18"/>
                <line x1="18" y1="6" x2="6" y2="18"/>
              </svg>
            </button>
            <div class="br-action-label">Not connected</div>
          </div>
          <div class="br-action-wrap">
            <button type="button" class="br-action profile" data-action="profile" title="View profile" aria-label="View profile">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </button>
            <div class="br-action-label">View profile</div>
          </div>
          <div class="br-action-wrap">
            <button type="button" class="br-action connect" data-action="connect" title="Connect" aria-label="Connect">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21s-7-4.5-9.5-9C1.1 9.7 2.6 6 6 6c2 0 3.3 1.2 4 2.4C10.7 7.2 12 6 14 6c3.4 0 4.9 3.7 3.5 6-2.5 4.5-9.5 9-9.5 9z"/>
              </svg>
            </button>
            <div class="br-action-label gold">Connect</div>
          </div>
        </div>
      </div>
    </article>
  `
}

function renderEmpty() {
  document.getElementById('brStack').innerHTML = `
    <div class="br-empty">
      <div class="br-empty-orb">✦</div>
      <h3>That's everyone for now.</h3>
      <p>You've worked through today's curated queue. We'll prepare your next set of introductions overnight — usually 4 to 6 fresh profiles by morning.</p>
      <a href="dashboard.html" class="btn btn-gold">Back to dashboard</a>
    </div>
  `
  updateStats()
}

function lockedCardTemplate(p) {
  const tier  = currentTier()
  const isGeo = !!p.__geoLocked
  const reqTier = isGeo ? 'plus' : 'plus'
  const meta    = getTierMeta(reqTier)
  const label   = isGeo
    ? `${meta.shortName} · ${p.location}`
    : `Quota reached for today`
  const sub = isGeo
    ? `Upgrade to access members outside your local region`
    : `Your daily limit resets at midnight — or upgrade for unlimited access`
  const photoStyle = p.photo
    ? `background-image:url('${p.photo}');filter:brightness(0.18) blur(3px);`
    : `background:${p.fallback};opacity:0.25;`
  return `
    <article class="br-card br-card--locked" data-id="${p.id}" aria-label="Locked profile">
      <div class="br-card-photo" style="${photoStyle}"></div>
      <div class="br-card-gradient"></div>
      <div class="br-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;padding:40px 24px;">
        <div style="font-size:32px;opacity:0.5;">✦</div>
        <div style="font-family:var(--font-serif);font-size:1.15rem;font-weight:300;color:var(--cream-50);line-height:1.4;">${label}</div>
        <div style="font-family:var(--font-sans);font-size:0.8rem;font-weight:300;color:rgba(255,255,255,0.5);line-height:1.55;max-width:220px;">${sub}</div>
        <a href="membership.html" class="btn btn-gold btn-sm" style="margin-top:4px;">Upgrade to ${meta.shortName}</a>
      </div>
    </article>`
}

function renderStack() {
  const stack = document.getElementById('brStack')
  if (!deck.length) return renderEmpty()

  const visible = deck.slice(0, VISIBLE_COUNT)
  stack.innerHTML = visible.map(p =>
    (p.__geoLocked || p.__quotaLocked) ? lockedCardTemplate(p) : cardTemplate(p)
  ).join('')
  updateStats()
}

/* ─── Remove a specific card with a quick fade ─── */
function advance(action, id) {
  const card   = document.querySelector(`.br-card[data-id="${id}"]`)
  const person = deck.find(p => p.id === id)
  if (!person) return

  // Locked cards redirect to the upgrade page instead of advancing the deck.
  if (person.__geoLocked || person.__quotaLocked) {
    window.location.href = 'membership.html'
    return
  }

  if (card) card.classList.add('br-card--leaving')
  setTimeout(() => {
    deck = deck.filter(p => p.id !== id)
    if (action === 'connect') onConnect(person)
    else                      onPass(person)
    renderStack()
  }, 260)
}

/* ─── Actions ─────────────────────────────────────────────── */

function onPass(person) {
  // No notification, no toast — quiet pass
}

async function onConnect(person) {
  connectedToday++

  try {
    const result = await apiSendRequest(person.id)
    const mutual = result.connection?.mutual

    store.addNotification({
      type: 'request',
      title: `Request sent to ${person.name}`,
      body: `${person.profession || ''} · ${person.location || ''} · ${person.score}% match. Waiting for them to accept.`,
      href: 'chat.html',
    })

    if (mutual) {
      showToast(`Connected with ${person.name.split(' ')[0]} — messaging unlocked.`, '✦', 2800)
    } else {
      document.getElementById('brMatchName').textContent = person.name
      document.getElementById('brMatchSub').textContent =
        `We've notified ${person.name.split(' ')[0]} — they'll see your interest right away. The moment they accept, your conversation unlocks.`
      document.getElementById('brMatchOverlay').classList.add('active')
    }
  } catch (err) {
    showToast(err.message || 'Could not send request. Please try again.', '⚠', 3500)
  }
}

window.closeMatchOverlay = function () {
  document.getElementById('brMatchOverlay').classList.remove('active')
}

/* View profile — opens a modal, fetching the full live profile first. */
window.viewProfile = async function (ev, id) {
  if (ev) { ev.stopPropagation(); ev.preventDefault() }
  const overlay = document.getElementById('brProfileModal')
  if (!overlay) return

  const deckPerson = deck.find(p => p.id === id)

  // Show skeleton while loading
  overlay.querySelector('[data-pm-name]').textContent = deckPerson?.name || '—'
  overlay.querySelector('[data-pm-age]').textContent = deckPerson?.age ? `· ${deckPerson.age}` : ''
  overlay.querySelector('[data-pm-pronouns]').textContent = '—'
  overlay.querySelector('[data-pm-role]').textContent = deckPerson?.profession || '—'
  overlay.querySelector('[data-pm-loc]').textContent = deckPerson?.location || '—'
  overlay.querySelector('[data-pm-score]').textContent = deckPerson ? `${deckPerson.score}% match` : ''
  overlay.querySelector('[data-pm-intent]').textContent = deckPerson?.intentShort || ''
  overlay.querySelector('[data-pm-bio]').textContent = ''
  overlay.querySelector('[data-pm-about]').textContent = 'Loading…'
  overlay.querySelector('[data-pm-tags]').innerHTML = ''
  overlay.querySelector('[data-pm-highlights]').innerHTML = ''
  if (deckPerson?.photo) {
    overlay.querySelector('[data-pm-photo]').setAttribute('style', `background-image:url('${deckPerson.photo}')`)
  } else {
    overlay.querySelector('[data-pm-photo]').setAttribute('style', `background:${deckPerson?.fallback || FALLBACK_GRADIENT}`)
  }
  const presenceEl = overlay.querySelector('[data-pm-presence]')
  if (presenceEl) { presenceEl.dataset.state = 'offline'; presenceEl.querySelector('[data-pm-presence-label]').textContent = '' }
  overlay.querySelector('.br-pm-body').scrollTop = 0
  overlay.dataset.personId = id
  overlay.classList.add('active')

  try {
    const data = await fetchMatchProfile(id)
    const p = data.profile
    if (!p) return

    const photoStyle = p.photo ? `background-image:url('${p.photo}');` : `background:${FALLBACK_GRADIENT};`
    overlay.querySelector('[data-pm-photo]').setAttribute('style', photoStyle)
    overlay.querySelector('[data-pm-name]').textContent = p.name || '—'
    overlay.querySelector('[data-pm-age]').textContent = p.age ? `· ${p.age}` : ''
    overlay.querySelector('[data-pm-pronouns]').textContent = p.pronouns || ''
    overlay.querySelector('[data-pm-role]').textContent = p.profession || ''
    overlay.querySelector('[data-pm-loc]').textContent = p.location || ''
    overlay.querySelector('[data-pm-score]').textContent = `${p.score}% match`
    overlay.querySelector('[data-pm-intent]').textContent = p.intentLong || p.intentShort || ''
    overlay.querySelector('[data-pm-bio]').textContent = p.overview?.quote ? `"${p.overview.quote}"` : ''
    overlay.querySelector('[data-pm-about]').textContent = (p.overview?.paragraphs || []).join(' ')
    overlay.querySelector('[data-pm-tags]').innerHTML = (p.values || [])
      .map(t => `<span class="br-card-tag">${escapeHtml(t)}</span>`).join('')
    const highlightsHtml = [...(p.lifestyle || []), ...(p.relationship || [])].map(h => `
      <div class="br-pm-highlight">
        <div class="br-pm-highlight-label">${escapeHtml(h.label)}</div>
        <div class="br-pm-highlight-value">${escapeHtml(h.value)}</div>
      </div>`).join('')
    overlay.querySelector('[data-pm-highlights]').innerHTML = highlightsHtml
  } catch (err) {
    overlay.querySelector('[data-pm-about]').textContent = 'Could not load full profile.'
  }
}

window.closeProfileModal = function () {
  document.getElementById('brProfileModal')?.classList.remove('active')
}

window.connectFromModal = function () {
  const overlay = document.getElementById('brProfileModal')
  if (!overlay) return
  const id = overlay.dataset.personId
  overlay.classList.remove('active')
  if (deck.some(p => p.id === id)) advance('connect', id)
}

/* In-card action buttons — delegated since the cards re-render */
document.getElementById('brStack')?.addEventListener('click', (e) => {
  const btn = e.target.closest?.('.br-action[data-action]')
  if (!btn) return
  const cardEl = btn.closest('.br-card')
  const id = cardEl?.dataset.id
  if (!id) return
  const action = btn.dataset.action
  if (action === 'profile')      window.viewProfile(null, id)
  else if (action === 'connect') advance('connect', id)
  else if (action === 'pass')    advance('pass', id)
})

async function bootBrowse() {
  const stack = document.getElementById('brStack')
  if (stack) {
    stack.innerHTML = `
      <div class="br-empty" style="opacity:0.6;">
        <div class="br-empty-orb" style="animation:none;">✦</div>
        <p style="margin-top:16px;">Curating your matches…</p>
      </div>`
  }

  try {
    const payload = await fetchMatches()
    deck = payload.matches || []

    // Append locked profiles to deck (blurred upgrade prompts)
    const locked = (payload.locked || []).map(p => ({ ...p, __geoLocked: true }))
    deck = [...deck, ...locked]

    renderStack()
  } catch (err) {
    if (stack) {
      stack.innerHTML = `
        <div class="br-empty">
          <div class="br-empty-orb">✦</div>
          <h3>Unable to load matches.</h3>
          <p>${err.message || 'Please check your connection and try again.'}</p>
          <button class="btn btn-gold" onclick="bootBrowse()">Retry</button>
        </div>`
    }
  }
}

bootBrowse()
