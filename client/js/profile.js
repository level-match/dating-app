import { requireAuth, initBodyFade, initNav, showToast } from './app.js'
import { store } from './store.js'
import { getMember, getMembersByScore } from './members.js'

requireAuth()
initBodyFade()
initNav()

/* ─── Resolve which member to show ─── */
const params = new URLSearchParams(window.location.search)
const requestedId = params.get('id')
const member = getMember(requestedId) || getMembersByScore()[0]

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]))
}

/* ─── Verification badges ─── */
const BADGE_SVG = {
  id: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.2"/><path d="M14 10h4M14 13h3"/></svg>`,
  career: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v12H3z"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>`,
  photo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="3"/><path d="M5 7h3l2-3h4l2 3h3v12H5z"/></svg>`,
  premium: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.4 5 5.6.8-4 3.9 1 5.5L12 21l-5-2.8 1-5.5-4-3.9 5.6-.8z"/></svg>`,
}
const BADGE_LABEL = { id: 'ID Verified', career: 'Career Verified', photo: 'Photo Verified', premium: 'Premium Member' }
const VERIFY_NOTE = {
  id: 'Government ID confirmed by the LEVEL membership team',
  career: 'Employment & title verified against public record',
  photo: 'Selfie matched against verified ID',
  premium: 'Premium-tier member in good standing',
}
const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`

function badgeCluster(badges, sizeClass = '') {
  return (badges || []).map(b => `
    <span class="lvl-vbadge lvl-vbadge--${b} ${sizeClass}" title="${esc(VERIFY_NOTE[b])}">
      ${BADGE_SVG[b] || ''}${BADGE_LABEL[b] || ''}
    </span>`).join('')
}

/* ─── Portrait (left column) ─── */
function renderPortrait(m) {
  const photoEl = document.getElementById('portraitPhoto')
  if (m.photo) {
    photoEl.style.backgroundImage = `url('${m.photo}')`
  } else {
    photoEl.style.background = m.fallback
  }

  document.getElementById('portraitScore').innerHTML = `
    <div class="portrait-score-num">${m.score}%</div>
    <div class="portrait-score-label">Alignment</div>`

  document.getElementById('portraitInfo').innerHTML = `
    <div class="portrait-name">${esc(m.name)}</div>
    <div class="portrait-role">${esc(m.profession)}${m.company ? ' · ' + esc(m.company) : ''}</div>
    <div class="portrait-meta">
      <div class="portrait-meta-item">📍 ${esc(m.location)}</div>
      <div class="portrait-meta-item">· ${m.age} years</div>
      <div class="portrait-meta-item">· ${esc(m.pronouns)}</div>
    </div>

    <div class="lvl-vbadge-cluster" style="margin-top:14px;">
      ${badgeCluster(m.badges)}
    </div>

    <div class="portrait-actions">
      <button type="button" class="btn btn-gold" id="connectBtn" style="flex:1;justify-content:center;">Send Connection Request</button>
      <a href="restaurants.html" class="btn btn-outline" title="Suggest a dinner" style="width:48px;height:48px;padding:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;">🍽</a>
    </div>`
}

/* ─── Section builders ─── */
function section(label, inner) {
  return `<div class="profile-section">
    <div class="profile-section-label">${esc(label)}</div>
    ${inner}
  </div>`
}

function overviewSection(m) {
  const paras = (m.overview.paragraphs || []).map(p => `<p class="pf-para">${esc(p)}</p>`).join('')
  return section('Overview', `
    <p class="pf-quote">“${esc(m.overview.quote)}”</p>
    ${paras}`)
}

function legacySection(m) {
  return section('Legacy & Vision', `<p class="pf-lead">${esc(m.legacy)}</p>`)
}

function careerSection(m) {
  const items = (m.career || []).map(c => `
    <div class="pf-tl-item">
      <div class="pf-tl-marker"><div class="pf-tl-dot"></div><div class="pf-tl-line"></div></div>
      <div>
        <div class="pf-tl-role">${esc(c.role)}</div>
        <div class="pf-tl-org">${esc(c.org)}</div>
        <div class="pf-tl-period">${esc(c.period)}</div>
        ${c.note ? `<div class="pf-tl-note">${esc(c.note)}</div>` : ''}
      </div>
    </div>`).join('')
  return section('Career Journey', `<div class="pf-timeline">${items}</div>`)
}

function valuesSection(m) {
  const chips = (m.values || []).map(v => `<span class="chip">${esc(v)}</span>`).join('')
  const principles = (m.principles || []).map(p => `<div class="pf-principle">${esc(p)}</div>`).join('')
  return section('Values & Principles', `
    <div class="values-grid">${chips}</div>
    <div class="pf-principles">${principles}</div>`)
}

function rowList(rows) {
  return `<div class="pf-rows">${rows.map(r => `
    <div class="pf-row">
      <div class="pf-row-label">${esc(r.label)}</div>
      <div class="pf-row-value">${esc(r.value)}</div>
    </div>`).join('')}</div>`
}

function lifestyleSection(m) {
  return section('Lifestyle Alignment', rowList(m.lifestyle || []))
}

function relationshipSection(m) {
  return section('Relationship Intent', `
    <p class="pf-lead">${esc(m.intentLong)}</p>
    <div style="margin-top:var(--s-5);">${rowList(m.relationship || [])}</div>`)
}

function mobilitySection(m) {
  return section('Mobility Profile', `
    <p class="pf-lead">${esc(m.mobility)}</p>
    <p class="pf-lead-sub">Primary base: ${esc(m.location)}. Mobility is part of how compatibility is scored — schedules and anchors are matched, not just cities.</p>`)
}

function compatibilitySection(m) {
  // Only the polished, final result is shown — never the internal scoring,
  // weights, or per-dimension breakdown. Members experience the outcome.
  return section('Compatibility Alignment', `
    <div class="compat-breakdown" style="text-align:center;">
      <div class="compat-big-num">${m.score}<span>%</span></div>
      <div style="font-family:var(--font-sans);font-size:var(--text-xs);font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-gold);margin-top:var(--s-2);">Compatibility Alignment</div>
      <p style="font-family:var(--font-sans);font-size:var(--text-md);font-weight:300;line-height:1.7;color:var(--text-secondary);max-width:440px;margin:var(--s-4) auto 0;">${esc(m.alignmentSummary)}</p>
    </div>`)
}

function verificationSection(m) {
  const notes = (m.badges || []).map(b => `
    <div class="pf-verify-note">${CHECK_SVG}<span>${esc(VERIFY_NOTE[b])}</span></div>`).join('')
  return section('Verification & Trust', `
    <div class="lvl-vbadge-cluster">${badgeCluster(m.badges)}</div>
    <div class="pf-verify-notes">${notes}</div>`)
}

function sharedSection(m) {
  const items = (m.shared || []).map(s => `
    <div class="pf-shared-item">
      <div class="pf-shared-label"><span class="pf-shared-check">${CHECK_SVG}</span>${esc(s.label)}</div>
      <div class="pf-shared-note">${esc(s.note)}</div>
    </div>`).join('')
  return section('Shared Alignment Indicators', `<div class="pf-shared">${items}</div>`)
}

/* ─── Render detail column in the requested order ─── */
function renderDetail(m) {
  const html = [
    overviewSection(m),
    legacySection(m),
    careerSection(m),
    valuesSection(m),
    lifestyleSection(m),
    relationshipSection(m),
    mobilitySection(m),
    compatibilitySection(m),
    verificationSection(m),
    sharedSection(m),
    `<div style="display:flex;gap:var(--s-4);margin-top:var(--s-4);">
      <button type="button" class="btn btn-primary btn-lg" id="connectBtnFooter" style="flex:1;justify-content:center;">Send Connection Request</button>
      <a href="restaurants.html" class="btn btn-gold btn-lg" style="justify-content:center;">Suggest a Dinner</a>
    </div>`,
  ].join('')
  document.getElementById('profileDetail').innerHTML = html
}

/* ─── Connection request ─── */
let requestSent = false

function markButtonsSent() {
  document.querySelectorAll('#connectBtn, #connectBtnFooter').forEach(btn => {
    if (!btn) return
    btn.textContent = 'Request Sent ✓'
    btn.disabled = true
    btn.style.opacity = '0.7'
    btn.style.cursor = 'default'
  })
}

function sendConnection() {
  if (requestSent) return
  requestSent = true

  // Persist to store — this also mirrors the pending_other status on MOCK_MATCHES
  store.addSentRequest(member)

  store.addNotification({
    type: 'request',
    title: `Request sent to ${member.name}`,
    body: `${member.profession} · ${member.location} · ${member.score}% match. Awaiting their reply.`,
    href: 'chat.html',
  })

  markButtonsSent()
  showToast(`Your interest has been sent to ${member.name.split(' ')[0]}. Taking you to messages…`, '✦', 2000)

  // Redirect to chat with the pending conversation open
  setTimeout(() => {
    window.location.href = `chat.html?pending=${encodeURIComponent(member.id)}`
  }, 1600)
}

/* ─── Boot ─── */
document.title = `LEVEL — ${member.name}`

// Back link: return to wherever the member arrived from when it's one of ours
const from = params.get('from')
if (from === 'dashboard') {
  const back = document.getElementById('navBack')
  const label = document.getElementById('navBackLabel')
  if (back) back.setAttribute('href', 'dashboard.html')
  if (label) label.textContent = 'Dashboard'
}

renderPortrait(member)
renderDetail(member)

// If this member was already requested in a prior session, restore sent state
if (store.hasSentRequest(member.id)) {
  requestSent = true
  markButtonsSent()
}

document.addEventListener('click', e => {
  if (e.target.closest('#connectBtn') || e.target.closest('#connectBtnFooter')) sendConnection()
})
