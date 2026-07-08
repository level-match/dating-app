import { requireAuth, initBodyFade, initNav, showToast } from './app.js'
import { store } from './store.js'
import { getMember, getMembersByScore } from './members.js'

requireAuth()
initBodyFade()
initNav()

/* ─── Resolve which member to show ─── */
const params = new URLSearchParams(window.location.search)
const isSelfView = params.get('me') === 'true' || params.get('me') === '1'
const requestedId = params.get('id')
const member = isSelfView ? null : (getMember(requestedId) || getMembersByScore()[0])

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

/* ─── Lightbox (self-view photos) ─── */
let _lbPhotos = []
let _lbIndex  = 0

window.openLightbox = function (src) {
  _lbIndex = _lbPhotos.indexOf(src)
  if (_lbIndex < 0) _lbIndex = 0
  document.getElementById('pfLightboxImg').src = src
  document.getElementById('pfLightbox').classList.add('active')
  document.body.style.overflow = 'hidden'
}

window.closeLightbox = function () {
  document.getElementById('pfLightbox').classList.remove('active')
  document.body.style.overflow = ''
}

window.shiftLightbox = function (dir) {
  if (!_lbPhotos.length) return
  _lbIndex = (_lbIndex + dir + _lbPhotos.length) % _lbPhotos.length
  const img = document.getElementById('pfLightboxImg')
  img.style.animation = 'none'
  requestAnimationFrame(() => {
    img.style.animation = ''
    img.src = _lbPhotos[_lbIndex]
  })
}

document.addEventListener('keydown', e => {
  const lb = document.getElementById('pfLightbox')
  if (!lb?.classList.contains('active')) return
  if (e.key === 'Escape') window.closeLightbox()
  if (e.key === 'ArrowLeft')  window.shiftLightbox(-1)
  if (e.key === 'ArrowRight') window.shiftLightbox(1)
})

/* ─── Self-view renderer ─── */
function renderSelfProfile() {
  const u = store.getUser() || store.getDefaultUser()
  const name  = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Your Profile'
  // Blob URLs are session-scoped and break after page navigation — skip them
  const photos = (u.photos || [])
    .filter(p => p?.src && !p.src.startsWith('blob:'))
    .map(p => p.src)
  if (u.mainPhoto && !u.mainPhoto.startsWith('blob:') && !photos.includes(u.mainPhoto)) {
    photos.unshift(u.mainPhoto)
  }
  _lbPhotos = photos
  const mainPhoto = photos[0] || null

  document.title = 'LEVEL — My Profile'

  // Portrait
  const photoEl = document.getElementById('portraitPhoto')
  if (photoEl) {
    if (mainPhoto) {
      photoEl.style.backgroundImage = `url('${mainPhoto}')`
    } else {
      photoEl.style.background = 'linear-gradient(135deg,#1A2F4A,#0D1E35)'
    }
  }

  document.getElementById('portraitScore').innerHTML = `
    <div class="portrait-score-num" style="font-size:1rem;letter-spacing:0.1em;">MY</div>
    <div class="portrait-score-label">Profile</div>`

  document.getElementById('portraitInfo').innerHTML = `
    <div class="portrait-name">${esc(name)}</div>
    <div class="portrait-role">${esc(u.role || '')}</div>
    ${u.location || u.city ? `<div class="portrait-meta"><div class="portrait-meta-item">📍 ${esc(u.location || u.city)}</div>${u.age ? `<div class="portrait-meta-item">· ${esc(String(u.age))} years</div>` : ''}</div>` : ''}
    <div class="portrait-actions" style="margin-top:var(--s-5);">
      <a href="profile-setup.html" class="btn btn-gold" style="flex:1;justify-content:center;">Edit Profile</a>
    </div>`

  // Detail sections
  const sections = []

  // ── Photos gallery ──
  if (photos.length) {
    const [first, ...rest] = photos
    const mainHTML = `
      <div class="pf-photo-item pf-photo-main" onclick="openLightbox('${first}')">
        <img src="${first}" alt="Main photo" />
        <span class="pf-photo-badge">Main Photo</span>
      </div>`
    const restHTML = rest.map(src => `
      <div class="pf-photo-item" onclick="openLightbox('${src}')">
        <img src="${src}" alt="Profile photo" />
      </div>`).join('')
    sections.push(section('Photos', `<div class="pf-photo-gallery">${mainHTML}${restHTML}</div>`))
  }

  // ── Bio / Legacy ──
  if (u.bio) {
    sections.push(section('Legacy & Vision', `<p class="pf-lead">${esc(u.bio)}</p>`))
  }

  // ── Education ──
  if (u.education) {
    sections.push(section('Education', `<p class="pf-lead">${esc(u.education)}</p>`))
  }

  // ── Interests ──
  const interests = u.interests || u.lifestyleValues || []
  if (interests.length) {
    const chips = interests.map(v => `<span class="chip">${esc(v)}</span>`).join('')
    sections.push(section('Lifestyle & Values', `<div class="values-grid">${chips}</div>`))
  }

  if (!sections.length) {
    sections.push(`<div style="padding:var(--s-8) 0;text-align:center;">
      <p style="font-family:var(--font-serif);font-size:1.5rem;font-weight:300;color:var(--cream-50);margin-bottom:12px;">Your profile is waiting.</p>
      <p style="font-size:0.9rem;line-height:1.7;color:var(--text-secondary);max-width:360px;margin:0 auto 24px;">Complete your profile so your matches can see what makes you remarkable.</p>
      <a href="profile-setup.html" class="btn btn-gold">Complete Profile</a>
    </div>`)
  } else {
    sections.push(`<div style="margin-top:var(--s-6);">
      <a href="profile-setup.html" class="btn btn-outline btn-lg" style="display:inline-flex;align-items:center;gap:10px;">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        Edit Profile
      </a>
    </div>`)
  }

  document.getElementById('profileDetail').innerHTML = sections.join('')
}

/* ─── Boot ─── */
if (isSelfView) {
  renderSelfProfile()
} else {
  document.title = `LEVEL — ${member.name}`

  const from = params.get('from')
  if (from === 'dashboard') {
    const back = document.getElementById('navBack')
    const label = document.getElementById('navBackLabel')
    if (back) back.setAttribute('href', 'dashboard.html')
    if (label) label.textContent = 'Dashboard'
  }

  renderPortrait(member)
  renderDetail(member)

  if (store.hasSentRequest(member.id)) {
    requestSent = true
    markButtonsSent()
  }

  document.addEventListener('click', e => {
    if (e.target.closest('#connectBtn') || e.target.closest('#connectBtnFooter')) sendConnection()
  })
}
