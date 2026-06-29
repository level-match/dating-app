import { store } from './store.js'
import { requireAuth, initBodyFade, initNav, showToast } from './app.js'
import {
  partitionByGeoReach, getRemainingMatchQuota, getDailyMatchLimit,
  recordMatchDelivery, currentTier, showUpgradeModal,
} from './membership-guard.js'
import { getTierMeta } from './membership.js'

requireAuth()
initBodyFade()
initNav()

/* ─── The candidate pool ──────────────────────────────────────
   A curated set of members shown one card at a time. We use real
   image assets where available and fall back to gradients.
   ─────────────────────────────────────────────────────────── */
const POOL = [
  {
    id: 'james-t',
    name: 'James T.',
    age: 38,
    pronouns: 'he/they',
    role: 'Founder & CEO · Climate tech',
    location: 'New York City',
    geoTier: 'local',
    score: 96,
    photo: '/assets/james.jpg',
    fallback: 'linear-gradient(160deg,#1A2F4A,#0D1E35,#1E1008)',
    tags: ['Founder', 'NYC', 'Travel', 'Wine'],
    presence: 'online',
    intent: 'Looking for an intentional partner ready for long-term partnership',
    bio: '"I built my company so I could one day step back from it — not the other way around. Looking for someone who sees ambition as a means, not the meaning."',
    about: 'Founded Apex Ventures in 2018. Series B last year. Off-hours I cook, read history, and try to spend Sundays away from a screen. I want a real partnership — equal, ambitious, kind.',
    highlights: [
      { label: 'Pace', value: 'High intensity · scaling chapter' },
      { label: 'Timeline', value: 'Open within 12 months' },
      { label: 'Family', value: 'Wants children eventually' },
      { label: 'Mobility', value: 'NYC anchored · frequent traveller' },
    ],
  },
  {
    id: 'mia-santos',
    name: 'Mia Santos',
    age: 36,
    pronouns: 'she/her',
    role: 'Pediatric surgeon',
    location: 'Madrid',
    geoTier: 'global',
    score: 94,
    photo: '/assets/mia.jpg',
    fallback: 'linear-gradient(160deg,#1A1330,#1F1340,#0F0820)',
    tags: ['Medicine', 'Bicoastal', 'Art', 'Family-oriented'],
    presence: 'busy',
    intent: 'Seeking a serious partner — ready to commit when the right person appears',
    bio: '"Surgery taught me that the steadiest hands belong to the most settled minds. I lead a full life — I\'d like to share it with someone who leads theirs."',
    about: 'Pediatric surgeon at La Paz. Madrid base, NYC ten times a year for a research collaboration. Art collector, quiet weekends, very close to my family.',
    highlights: [
      { label: 'Pace', value: 'Established · structured days' },
      { label: 'Timeline', value: 'Ready when the right person appears' },
      { label: 'Family', value: 'Open — not on a deadline' },
      { label: 'Mobility', value: 'Madrid · bicoastal w/ NYC' },
    ],
  },
  {
    id: 'sarah-m',
    name: 'Sarah M.',
    age: 32,
    pronouns: 'she/they',
    role: 'IP Partner · Law firm',
    location: 'London',
    geoTier: 'global',
    score: 91,
    photo: '/assets/sarah.jpg',
    fallback: 'linear-gradient(160deg,#101A2A,#0A1424,#1A1018)',
    tags: ['Lawyer', 'LGBTQIA+', 'Theatre', 'Long-term seeking'],
    presence: 'online',
    intent: 'Long-term seeking — building a partnership that grows over decades',
    bio: '"I argue for a living, but I don\'t want to argue at home. What I want is a partner who listens with the same care I bring to a closing argument."',
    about: 'IP Partner at a London firm. Trained as a barrister before going in-house. Theatre most Thursdays. I want children eventually — not as an assumption, as a decision.',
    highlights: [
      { label: 'Pace', value: 'Established · senior partner' },
      { label: 'Timeline', value: '12–24 months to serious' },
      { label: 'Family', value: 'Children: yes, deliberately' },
      { label: 'Mobility', value: 'London anchored' },
    ],
  },
  {
    id: 'adrian-reyes',
    name: 'Adrian Reyes',
    age: 39,
    pronouns: 'he/him',
    role: 'Cardiothoracic surgeon',
    location: 'Toronto',
    geoTier: 'national',
    score: 92,
    photo: '/assets/adrian.jpg',
    fallback: 'linear-gradient(160deg,#161024,#1A0F28,#0A0814)',
    tags: ['Surgeon', 'Family-oriented', 'Travel', 'Wellness'],
    presence: 'offline',
    intent: 'Ready for a permanent partnership — done dating casually',
    bio: '"I hold lives in my hands for a living. I\'m looking for someone I can put my own life in the hands of."',
    about: 'Cardiothoracic surgeon. Long days, careful evenings. I run early, cook Sundays, and protect the people I love with everything I have. Family is the project I take most seriously.',
    highlights: [
      { label: 'Pace', value: 'Established · disciplined cadence' },
      { label: 'Timeline', value: 'Ready now for the right person' },
      { label: 'Family', value: 'Children: absolutely' },
      { label: 'Mobility', value: 'Toronto · settled' },
    ],
  },
  {
    id: 'daniel-cruz',
    name: 'Daniel Cruz',
    age: 34,
    pronouns: 'he/him',
    role: 'Creative director',
    location: 'Mexico City',
    geoTier: 'national',
    score: 89,
    photo: '/assets/daniel.jpg',
    fallback: 'linear-gradient(160deg,#1A1230,#100C24,#0A0816)',
    tags: ['Design', 'Photography', 'Cooking', 'Open to anywhere'],
    presence: 'online',
    intent: 'Open to where it leads — but only with someone present',
    bio: '"Design taught me that the best things are made slowly. I don\'t want a fast romance. I want a considered one."',
    about: 'Creative director for a global brand. Spend half my time in Mexico City, half in transit. Long-distance pen pals turned partners would be perfect — until they shouldn\'t be.',
    highlights: [
      { label: 'Pace', value: 'Fluid · unconventional schedule' },
      { label: 'Timeline', value: 'No timeline — but serious' },
      { label: 'Family', value: 'Open to either path' },
      { label: 'Mobility', value: 'CDMX base · global citizen' },
    ],
  },
  {
    id: 'oliver-h',
    name: 'Oliver H.',
    age: 37,
    pronouns: 'he/him',
    role: 'Investment director',
    location: 'London',
    geoTier: 'global',
    score: 86,
    photo: '/assets/oliver.jpg',
    fallback: 'linear-gradient(160deg,#1A2030,#101520,#070E18)',
    tags: ['Finance', 'Sailing', 'Architecture', 'Quietly ambitious'],
    presence: 'busy',
    intent: 'Quietly serious — looking for the same in return',
    bio: '"I don\'t need a public life. I need a private one that\'s actually mine."',
    about: 'Investment director, mostly private credit. Sail on weekends. I read more than I speak, and I prefer dinner at home to dinner at the restaurant everyone is posting about.',
    highlights: [
      { label: 'Pace', value: 'Established · low-profile' },
      { label: 'Timeline', value: '12 months for the right person' },
      { label: 'Family', value: 'Open' },
      { label: 'Mobility', value: 'London · sails the Med summers' },
    ],
  },
  {
    id: 'marcus-l',
    name: 'Marcus L.',
    age: 40,
    pronouns: 'he/him',
    role: 'Senior Partner · Attorney',
    location: 'New York City',
    geoTier: 'local',
    score: 91,
    photo: '/assets/Marcus.jpg',
    fallback: 'linear-gradient(160deg,#12180A,#0A1005,#1A1208)',
    tags: ['Law', 'Marriage-focused', 'Reader', 'NYC'],
    presence: 'offline',
    intent: 'Marriage-focused — looking for a life partner',
    bio: '"At forty, I know exactly what I\'m looking for. I\'ve also learned to recognise it slowly."',
    about: 'Senior partner, litigation. Spend more time on books than on screens. I\'ve been single by choice the last three years — I\'d like that to change for the right reason, not the right timing.',
    highlights: [
      { label: 'Pace', value: 'Established · deliberate' },
      { label: 'Timeline', value: 'Ready now — won\'t rush' },
      { label: 'Family', value: 'Wants children · prepared to' },
      { label: 'Mobility', value: 'NYC anchored' },
    ],
  },
]

const PRESENCE_LABELS = { online: 'Online now', busy: 'Busy', offline: 'Offline' }

const VISIBLE_COUNT = 3

/* ─── Entitlement-filtered deck ──────────────────────────────
   1. Partition the full pool into geo-accessible vs geo-locked.
   2. For Base tier, cap accessible profiles by the daily quota.
      Geo-locked and quota-locked profiles surface at the end of
      the deck as upgrade prompts, not hard errors.
   ─────────────────────────────────────────────────────────── */
const sorted = POOL.slice().sort((a, b) => b.score - a.score)
const { accessible: geoAccessible, locked: geoLocked } = partitionByGeoReach(sorted)

const quota           = getRemainingMatchQuota()
const accessibleSlice = isFinite(quota) ? geoAccessible.slice(0, quota) : geoAccessible
const quotaLocked     = isFinite(quota) ? geoAccessible.slice(quota) : []

/* Record the profiles being delivered to the Base user this session. */
if (isFinite(quota) && accessibleSlice.length > 0) {
  recordMatchDelivery(accessibleSlice.length)
}

/* Build the active deck: accessible first, then upgrade-prompt sentinels */
const LOCKED_SENTINEL = { __locked: true }
let deck = [
  ...accessibleSlice,
  ...quotaLocked.map(p => ({ ...p, __quotaLocked: true })),
  ...geoLocked.map(p => ({ ...p, __geoLocked: true })),
]

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
    : `background:${p.fallback};`

  return `
    <article class="br-card" data-id="${p.id}">
      <div class="br-card-photo" style="${photoStyle}"></div>
      <div class="br-card-gradient"></div>

      <div class="br-card-top">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="br-card-pronouns">${escapeHtml(p.pronouns)}</span>
          <span class="br-presence-pill" data-state="${p.presence}" title="${PRESENCE_LABELS[p.presence] || ''}">
            <span class="br-presence-dot"></span>${PRESENCE_LABELS[p.presence] || ''}
          </span>
        </div>
        <span class="br-card-score">${p.score}% match</span>
      </div>

      <div class="br-card-body">
        <div class="br-card-name">${escapeHtml(p.name)} <span class="age">· ${p.age}</span></div>
        <div class="br-card-role">${escapeHtml(p.role)}</div>
        <div class="br-card-loc">${escapeHtml(p.location)}</div>

        <!-- Verification trust strip -->
        <div class="lvl-vbadge-cluster" style="margin-top:12px;">
          <span class="lvl-vbadge lvl-vbadge--id lvl-vbadge--sm" title="ID Verified">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2"/>
              <circle cx="9" cy="12" r="2"/>
              <path d="M14 11h4M14 14h3"/>
            </svg>
            ID
          </span>
          <span class="lvl-vbadge lvl-vbadge--career lvl-vbadge--sm" title="Career Verified">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7h18v12H3z"/>
              <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/>
            </svg>
            Career
          </span>
          <span class="lvl-vbadge lvl-vbadge--photo lvl-vbadge--sm" title="Photo Verified">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="13" r="3"/>
              <path d="M5 7h3l2-3h4l2 3h3v12H5z"/>
            </svg>
            Photo
          </span>
        </div>

        <div class="br-card-tags">
          ${p.tags.map(t => `<span class="br-card-tag">${escapeHtml(t)}</span>`).join('')}
        </div>

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

function onConnect(person) {
  connectedToday++

  // Record the connection in the store as a request status update
  try {
    // Best-effort: match by name in MOCK_MATCHES if present
    const candidate = store.getMatches().find(m =>
      m.name.toLowerCase().startsWith(person.name.toLowerCase().split(' ')[0])
    )
    if (candidate) store.updateMatchStatus(candidate.id, 'pending_other')
  } catch {}

  // Add a notification logging the outgoing request
  store.addNotification({
    type: 'request',
    title: `Request sent to ${person.name}`,
    body: `${person.role} · ${person.location} · ${person.score}% match. Waiting for them to accept.`,
    href: 'chat.html',
  })

  // Match overlay
  document.getElementById('brMatchName').textContent = person.name
  document.getElementById('brMatchSub').textContent =
    `We've notified ${person.name.split(' ')[0]} — they'll see your interest right away. The moment they accept, your conversation unlocks.`
  document.getElementById('brMatchOverlay').classList.add('active')
}

window.closeMatchOverlay = function () {
  document.getElementById('brMatchOverlay').classList.remove('active')
}

/* View profile — opens a modal. Views are private: no notification is sent. */
window.viewProfile = function (ev, id) {
  if (ev) { ev.stopPropagation(); ev.preventDefault() }
  const person = POOL.find(p => p.id === id) || deck[0]
  if (!person) return

  const overlay = document.getElementById('brProfileModal')
  if (!overlay) return

  const photoStyle = person.photo
    ? `background-image:url('${person.photo}');`
    : `background:${person.fallback};`

  overlay.querySelector('[data-pm-photo]').setAttribute('style', photoStyle)
  overlay.querySelector('[data-pm-name]').textContent = person.name
  overlay.querySelector('[data-pm-age]').textContent = `· ${person.age}`
  overlay.querySelector('[data-pm-pronouns]').textContent = person.pronouns
  overlay.querySelector('[data-pm-role]').textContent = person.role
  overlay.querySelector('[data-pm-loc]').textContent = person.location
  overlay.querySelector('[data-pm-score]').textContent = `${person.score}% match`

  const presenceEl = overlay.querySelector('[data-pm-presence]')
  presenceEl.dataset.state = person.presence
  presenceEl.querySelector('[data-pm-presence-label]').textContent = PRESENCE_LABELS[person.presence] || ''

  overlay.querySelector('[data-pm-tags]').innerHTML = person.tags
    .map(t => `<span class="br-card-tag">${escapeHtml(t)}</span>`).join('')

  overlay.querySelector('[data-pm-intent]').textContent = person.intent || ''
  overlay.querySelector('[data-pm-bio]').textContent = person.bio || ''
  overlay.querySelector('[data-pm-about]').textContent = person.about || ''

  const highlightsHtml = (person.highlights || []).map(h => `
    <div class="br-pm-highlight">
      <div class="br-pm-highlight-label">${escapeHtml(h.label)}</div>
      <div class="br-pm-highlight-value">${escapeHtml(h.value)}</div>
    </div>
  `).join('')
  overlay.querySelector('[data-pm-highlights]').innerHTML = highlightsHtml

  overlay.querySelector('.br-pm-body').scrollTop = 0
  overlay.dataset.personId = person.id
  overlay.classList.add('active')
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

renderStack()
