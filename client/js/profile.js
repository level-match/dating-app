import { requireAuth, initBodyFade, initNav, showToast, hydrateFromProfile } from './app.js'
import { store } from './store.js'
import { syncPhotosToStore } from './profile-photos.js'
import {
  fetchMatchProfile,
  sendConnectionRequest,
  acceptConnectionRequest,
  isProfileUuid,
} from './matches-api.js'
import { bootPageLoader, finishPageLoader } from './loading.js'

requireAuth()
initBodyFade()
initNav()

/* ─── Resolve which member to show ─── */
const params = new URLSearchParams(window.location.search)
const isSelfView =
  params.has('me') ||
  params.has('m') ||
  params.get('me') === 'true' ||
  params.get('me') === '1'
const requestedId = params.get('id')
let member = null
let memberFromApi = false

function chatHref(connectionId) {
  const id = connectionId || member?.connectionId
  return id ? `chat.html?connection=${encodeURIComponent(id)}` : 'chat.html'
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]))
}

function hasText(v) {
  if (v == null) return false
  if (Array.isArray(v)) return v.filter(Boolean).length > 0
  return String(v).trim() !== ''
}

function displayText(v, emptyLabel = 'Not added yet') {
  if (!hasText(v)) return { text: emptyLabel, empty: true }
  if (Array.isArray(v)) return { text: v.filter(Boolean).join(', '), empty: false }
  return { text: String(v).trim(), empty: false }
}

function fieldItem(label, value, emptyLabel) {
  const d = displayText(value, emptyLabel)
  return `<div class="pf-field-item">
    <div class="pf-field-label">${esc(label)}</div>
    <div class="pf-field-value${d.empty ? ' is-empty' : ''}">${esc(d.text)}</div>
  </div>`
}

function fieldGrid(fields) {
  return `<div class="pf-field-grid">${fields.map(f => fieldItem(f.label, f.value, f.emptyLabel)).join('')}</div>`
}

function chipList(items, emptyLabel = 'Not added yet') {
  const list = (items || []).map(x => (typeof x === 'string' ? x : x?.label)).filter(Boolean)
  if (!list.length) return `<p class="pf-empty-value">${esc(emptyLabel)}</p>`
  return `<div class="values-grid">${list.map(v => `<span class="chip">${esc(v)}</span>`).join('')}</div>`
}

function ageRangeLabel(min, max) {
  if (min != null && max != null) return `${min}–${max}`
  if (min != null) return `${min}+`
  if (max != null) return `Up to ${max}`
  return null
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

    <div class="portrait-actions" id="portraitActions">
      <button type="button" class="btn btn-gold" id="connectBtn" style="flex:1;justify-content:center;">Send Connection Request</button>
      <a href="restaurants.html" class="btn btn-outline" title="Suggest a dinner" style="width:48px;height:48px;padding:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;">🍽</a>
    </div>`
}

function connectActionsFooter() {
  return `<div id="profileConnectFooter" style="display:flex;gap:var(--s-4);margin-top:var(--s-4);">
      <button type="button" class="btn btn-primary btn-lg" id="connectBtnFooter" style="flex:1;justify-content:center;">Send Connection Request</button>
      <a href="restaurants.html" class="btn btn-gold btn-lg" style="justify-content:center;">Suggest a Dinner</a>
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
  const quote = m.overview?.quote
  const paras = (m.overview?.paragraphs || []).filter(Boolean)
  if (!hasText(quote) && !paras.length) {
    return section('Overview', `<p class="pf-empty-value">Not provided</p>`)
  }
  const parasHtml = paras.map(p => `<p class="pf-para">${esc(p)}</p>`).join('')
  return section('Overview', `
    ${hasText(quote) ? `<p class="pf-quote">“${esc(quote)}”</p>` : ''}
    ${parasHtml}`)
}

function legacySection(m) {
  if (!hasText(m.legacy)) {
    return section('Legacy & Vision', `<p class="pf-empty-value">Not provided</p>`)
  }
  return section('Legacy & Vision', `<p class="pf-lead">${esc(m.legacy)}</p>`)
}

function careerSection(m) {
  const items = (m.career || []).filter(c => hasText(c.role) || hasText(c.org))
  if (!items.length) {
    return section('Career Journey', `<p class="pf-empty-value">Not provided</p>`)
  }
  const html = items.map(c => `
    <div class="pf-tl-item">
      <div class="pf-tl-marker"><div class="pf-tl-dot"></div><div class="pf-tl-line"></div></div>
      <div>
        <div class="pf-tl-role">${esc(c.role)}</div>
        <div class="pf-tl-org">${esc(c.org)}</div>
        <div class="pf-tl-period">${esc(c.period)}</div>
        ${c.note ? `<div class="pf-tl-note">${esc(c.note)}</div>` : ''}
      </div>
    </div>`).join('')
  return section('Career Journey', `<div class="pf-timeline">${html}</div>`)
}

function valuesSection(m) {
  const values = (m.values || []).filter(Boolean)
  const principles = (m.principles || []).filter(Boolean)
  if (!values.length && !principles.length) {
    return section('Values & Principles', `<p class="pf-empty-value">Not provided</p>`)
  }
  const chips = values.map(v => `<span class="chip">${esc(v)}</span>`).join('')
  const principlesHtml = principles.map(p => `<div class="pf-principle">${esc(p)}</div>`).join('')
  return section('Values & Principles', `
    ${values.length ? `<div class="values-grid">${chips}</div>` : ''}
    ${principles.length ? `<div class="pf-principles">${principlesHtml}</div>` : ''}`)
}

function rowList(rows) {
  const valid = (rows || []).filter(r => hasText(r.value))
  if (!valid.length) return `<p class="pf-empty-value">Not provided</p>`
  return `<div class="pf-rows">${valid.map(r => `
    <div class="pf-row">
      <div class="pf-row-label">${esc(r.label)}</div>
      <div class="pf-row-value">${esc(r.value)}</div>
    </div>`).join('')}</div>`
}

function lifestyleSection(m) {
  return section('Lifestyle Alignment', rowList(m.lifestyle || []))
}

function relationshipSection(m) {
  const relRows = (m.relationship || []).filter(r => hasText(r.value))
  const lead = hasText(m.intentLong)
    ? `<p class="pf-lead">${esc(m.intentLong)}</p>`
    : ''
  if (!lead && !relRows.length) {
    return section('Relationship Intent', `<p class="pf-empty-value">Not provided</p>`)
  }
  return section('Relationship Intent', `
    ${lead}
    <div style="margin-top:var(--s-5);">${rowList(m.relationship || [])}</div>`)
}

function mobilitySection(m) {
  if (!hasText(m.mobility) && !hasText(m.location)) {
    return section('Mobility Profile', `<p class="pf-empty-value">Not provided</p>`)
  }
  return section('Mobility Profile', `
    ${hasText(m.mobility) ? `<p class="pf-lead">${esc(m.mobility)}</p>` : ''}
    ${hasText(m.location) ? `<p class="pf-lead-sub">Primary base: ${esc(m.location)}. Mobility is part of how compatibility is scored — schedules and anchors are matched, not just cities.</p>` : ''}`)
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
  const badges = m.badges || []
  if (!badges.length) {
    return section('Verification & Trust', `<p class="pf-empty-value">Not provided</p>`)
  }
  const notes = badges.map(b => `
    <div class="pf-verify-note">${CHECK_SVG}<span>${esc(VERIFY_NOTE[b])}</span></div>`).join('')
  return section('Verification & Trust', `
    <div class="lvl-vbadge-cluster">${badgeCluster(m.badges)}</div>
    <div class="pf-verify-notes">${notes}</div>`)
}

function sharedSection(m) {
  const items = (m.shared || []).filter(s => hasText(s.label) || hasText(s.note))
  if (!items.length) {
    return section('Shared Alignment Indicators', `<p class="pf-empty-value">Not provided</p>`)
  }
  const html = items.map(s => `
    <div class="pf-shared-item">
      <div class="pf-shared-label"><span class="pf-shared-check">${CHECK_SVG}</span>${esc(s.label)}</div>
      <div class="pf-shared-note">${esc(s.note)}</div>
    </div>`).join('')
  return section('Shared Alignment Indicators', `<div class="pf-shared">${html}</div>`)
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
    connectActionsFooter(),
  ].join('')
  document.getElementById('profileDetail').innerHTML = html
}

/* ─── Connection request ─── */
let requestSent = false
let connectionStatus = 'none'

function applyConnectionUi() {
  const sent = connectionStatus === 'pending_sent' || requestSent
  const received = connectionStatus === 'pending_received'
  const mutual = connectionStatus === 'mutual'

  document.querySelectorAll('#connectBtn, #connectBtnFooter').forEach(btn => {
    if (!btn) return
    if (mutual) {
      btn.textContent = 'Message'
      btn.disabled = false
      btn.style.opacity = ''
      btn.style.cursor = ''
      btn.classList.remove('btn-gold')
      btn.classList.add('btn-primary')
      return
    }
    if (received) {
      btn.textContent = 'Accept Connection'
      btn.disabled = false
      btn.style.opacity = ''
      btn.style.cursor = ''
      return
    }
    if (sent) {
      btn.textContent = 'Request Sent ✓'
      btn.disabled = true
      btn.style.opacity = '0.7'
      btn.style.cursor = 'default'
    }
  })
}

function markButtonsSent() {
  requestSent = true
  connectionStatus = 'pending_sent'
  applyConnectionUi()
}

function markButtonsMutual() {
  connectionStatus = 'mutual'
  requestSent = false
  applyConnectionUi()
}

function persistSentRequest() {
  if (!member) return
  store.addSentRequest({
    id: member.id,
    name: member.name,
    role: member.profession || member.role || '',
    location: member.location || '',
    score: member.score || 0,
    fallback: member.fallback || 'linear-gradient(135deg,#0A0F20,#060C18)',
  })
}

async function sendConnection() {
  if (!member || requestSent || connectionStatus === 'mutual') return

  if (connectionStatus === 'pending_received') {
    try {
      const result = await acceptConnectionRequest(member.id)
      member = result.profile || member
      connectionStatus = 'mutual'
      markButtonsMutual()
      store.addNotification({
        type: 'match',
        title: `Connected with ${member.name}`,
        body: 'Messaging is unlocked — say hello when you are ready.',
        href: chatHref(result.connection?.id),
      })
      showToast(`You're connected with ${member.name.split(' ')[0]}.`, '✦', 2500)
      setTimeout(() => { window.location.href = chatHref(result.connection?.id) }, 1400)
    } catch (err) {
      showToast(err.message || 'Could not accept the request.', '⚠', 3500)
    }
    return
  }

  if (memberFromApi) {
    try {
      const result = await sendConnectionRequest(member.id)
      member = result.profile || member
      connectionStatus = result.connection?.mutual ? 'mutual' : 'pending_sent'

      if (result.connection?.mutual) {
        markButtonsMutual()
        showToast(`You're connected with ${member.name.split(' ')[0]}.`, '✦', 2500)
        setTimeout(() => { window.location.href = chatHref(result.connection?.id) }, 1400)
        return
      }

      persistSentRequest()
      markButtonsSent()
      showToast(`Your interest has been sent to ${member.name.split(' ')[0]}.`, '✦', 2000)
      setTimeout(() => {
        window.location.href = `chat.html?pending=${encodeURIComponent(member.id)}`
      }, 1600)
    } catch (err) {
      showToast(err.message || 'Could not send the request.', '⚠', 3500)
    }
    return
  }

  requestSent = true
  persistSentRequest()
  store.addNotification({
    type: 'request',
    title: `Request sent to ${member.name}`,
    body: `${member.profession} · ${member.location} · ${member.score}% match. Awaiting their reply.`,
    href: 'chat.html',
  })
  markButtonsSent()
  showToast(`Your interest has been sent to ${member.name.split(' ')[0]}. Taking you to messages…`, '✦', 2000)
  setTimeout(() => {
    window.location.href = `chat.html?pending=${encodeURIComponent(member.id)}`
  }, 1600)
}

/* ─── Self-view photo helpers ─── */
function normalizeSelfPhotos(user) {
  const raw = (user.photos || [])
    .filter(p => {
      const src = typeof p === 'string' ? p : p?.src
      return src && !src.startsWith('blob:')
    })
    .map(p => {
      if (typeof p === 'string') {
        return { src: p, displayOrder: 999, isPrimary: false }
      }
      return {
        id: p.id,
        src: p.src,
        displayOrder: p.displayOrder ?? 999,
        isPrimary: !!p.isPrimary,
      }
    })

  const seen = new Set()
  const ordered = raw
    .filter(p => {
      if (!p.id) return true
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
    .sort((a, b) => a.displayOrder - b.displayOrder)

  if (!ordered.length && user.mainPhoto && !user.mainPhoto.startsWith('blob:')) {
    ordered.push({ src: user.mainPhoto, isPrimary: true, displayOrder: 1 })
  }

  const mainEntry = ordered.find(p => p.isPrimary) || ordered[0] || null
  const mainPhoto = mainEntry?.src || null
  const additional = ordered
    .filter(p => p !== mainEntry)
    .sort((a, b) => a.displayOrder - b.displayOrder)

  const lightboxPhotos = mainPhoto
    ? [mainPhoto, ...additional.map(p => p.src)]
    : additional.map(p => p.src)

  return { mainPhoto, additional, lightboxPhotos }
}

/* ─── Lightbox (self-view photos) ─── */
let _lbPhotos = []
let _lbIndex  = 0

window.openLightbox = function (indexOrSrc) {
  if (typeof indexOrSrc === 'number') {
    _lbIndex = indexOrSrc
  } else {
    _lbIndex = _lbPhotos.indexOf(indexOrSrc)
    if (_lbIndex < 0) _lbIndex = 0
  }
  document.getElementById('pfLightboxImg').src = _lbPhotos[_lbIndex]
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
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Your Profile'
  const title = u.role || u.professionalTitle || ''
  const location = u.location || u.city || ''
  const { mainPhoto, additional, lightboxPhotos } = normalizeSelfPhotos(u)

  _lbPhotos = lightboxPhotos

  document.title = 'LEVEL — My Profile'

  const back = document.getElementById('navBack')
  const backLabel = document.getElementById('navBackLabel')
  if (back) back.setAttribute('href', 'dashboard.html')
  if (backLabel) backLabel.textContent = 'Dashboard'

  // Portrait column — main photo only (additional photos live in the gallery below)
  const photoEl = document.getElementById('portraitPhoto')
  if (photoEl) {
    if (mainPhoto) {
      photoEl.style.background = ''
      photoEl.style.backgroundImage = `url('${mainPhoto.replace(/'/g, '%27')}')`
      photoEl.style.backgroundSize = 'cover'
      photoEl.style.backgroundPosition = 'center top'
      photoEl.style.cursor = 'pointer'
      photoEl.onclick = () => window.openLightbox(0)
    } else {
      photoEl.style.backgroundImage = ''
      photoEl.style.background = 'linear-gradient(135deg,#1A2F4A,#0D1E35)'
      photoEl.style.cursor = ''
      photoEl.onclick = null
    }
  }

  document.getElementById('portraitScore').innerHTML = `
    <div class="portrait-score-num" style="font-size:1rem;letter-spacing:0.1em;">MY</div>
    <div class="portrait-score-label">Profile</div>`

  const metaItems = []
  if (hasText(location)) metaItems.push(`<div class="portrait-meta-item">📍 ${esc(location)}</div>`)
  if (u.age != null && u.age !== '') metaItems.push(`<div class="portrait-meta-item">· ${esc(String(u.age))} years</div>`)
  if (hasText(u.pronouns)) metaItems.push(`<div class="portrait-meta-item">· ${esc(u.pronouns)}</div>`)

  document.getElementById('portraitInfo').innerHTML = `
    <div class="portrait-name">${esc(name)}</div>
    ${hasText(title)
      ? `<div class="portrait-role">${esc(title)}</div>`
      : `<div class="portrait-role" style="opacity:0.45;font-style:italic;">Add your professional title</div>`}
    ${metaItems.length
      ? `<div class="portrait-meta">${metaItems.join('')}</div>`
      : `<div class="portrait-meta"><div class="portrait-meta-item" style="opacity:0.45;font-style:italic;">Location & details not added yet</div></div>`}
    <div class="portrait-actions" style="margin-top:var(--s-5);">
      <a href="profile-setup.html" class="btn btn-gold" style="flex:1;justify-content:center;">Edit Profile</a>
    </div>`

  const sections = []

  // Additional photos only — main photo is already in the portrait column
  if (additional.length) {
    const items = additional.map((photo, i) => `
      <div class="pf-photo-item" onclick="openLightbox(${i + 1})">
        <img src="${esc(photo.src)}" alt="Profile photo ${i + 2}" loading="lazy" />
      </div>`).join('')
    sections.push(section('Photos', `<div class="pf-photo-gallery pf-photo-gallery--additional">${items}</div>`))
  } else if (!mainPhoto) {
    sections.push(section('Photos', `
      <div class="pf-empty-block">
        <p>No photos yet. Use <strong>Edit Profile</strong> on the left to add up to five images.</p>
      </div>`))
  }

  // About — always show all fields with empty placeholders
  sections.push(section('About You', fieldGrid([
    { label: 'Professional title', value: title },
    { label: 'Industry', value: u.industry },
    { label: 'Location', value: location },
    { label: 'Age', value: u.age },
    { label: 'Education', value: u.education },
    { label: 'Email', value: u.email, emptyLabel: 'Not linked' },
  ])))

  // Legacy & Vision
  sections.push(section('Legacy & Vision',
    hasText(u.bio || u.legacyVision)
      ? `<p class="pf-lead">${esc(u.bio || u.legacyVision)}</p>`
      : `<p class="pf-empty-value">Share what you're building and what partnership means in your next chapter.</p>`))

  // Screening answers — show grid with empty placeholders per field
  sections.push(section('Screening & Matching', fieldGrid([
    { label: 'Gender identity', value: u.genderIdentity },
    { label: 'Pronouns', value: u.pronouns },
    { label: 'Orientation', value: u.sexualOrientation },
    { label: 'Partner age range', value: ageRangeLabel(u.ageRangeMin, u.ageRangeMax) },
    { label: 'Primary intent', value: u.primaryIntent },
    { label: 'Career chapter', value: u.careerChapter },
    { label: 'Life integration', value: u.lifeIntegration },
    { label: 'Mobility', value: u.mobilityProfile },
    { label: 'Long-term vision', value: u.longTermVision, emptyLabel: 'Not answered' },
    { label: 'Emotional style', value: u.emotionalStyle, emptyLabel: 'Not answered' },
  ]) + `
    <div style="margin-top:var(--s-5);">
      <div class="pf-field-label" style="margin-bottom:10px;">Looking to meet</div>
      ${chipList(u.preferredGenders, 'Not answered')}
    </div>
    <div style="margin-top:var(--s-5);">
      <div class="pf-field-label" style="margin-bottom:10px;">Lifestyle & values</div>
      ${chipList(u.lifestyleValues || u.interests, 'Not answered')}
    </div>`))

  // Visibility
  sections.push(section('Profile Visibility', fieldGrid([
    { label: 'Show orientation publicly', value: u.orientationVisibility, emptyLabel: 'Not set' },
    { label: 'Block colleagues', value: u.blockColleagues == null ? null : (u.blockColleagues ? 'On' : 'Off') },
    { label: 'Discretion mode', value: u.discretionMode == null ? null : (u.discretionMode ? 'On' : 'Off') },
  ])))

  const hasAnyContent = lightboxPhotos.length || [
    title, location, u.bio, u.legacyVision, u.education, u.industry,
    u.genderIdentity, u.primaryIntent, u.longTermVision,
  ].some(hasText)

  if (!hasAnyContent) {
    sections.unshift(`<div class="pf-empty-block" style="margin-bottom:var(--s-8);">
      <p style="font-family:var(--font-serif);font-size:1.35rem;color:var(--cream-50);">Your profile is waiting.</p>
      <p>Complete the details on the left with <strong>Edit Profile</strong> so matches can see what makes you remarkable.</p>
    </div>`)
  }

  document.getElementById('profileDetail').innerHTML = sections.join('')
}

async function loadMemberProfile() {
  if (isSelfView) return null

  if (requestedId && isProfileUuid(requestedId)) {
    const data = await fetchMatchProfile(requestedId)
    memberFromApi = true
    return data.profile
  }

  return null
}

function renderProfileNotFound(message) {
  document.title = 'LEVEL — Profile'
  document.getElementById('portraitPhoto').style.background = 'linear-gradient(160deg,#1A2F4A,#0D1E35)'
  document.getElementById('portraitScore').innerHTML = ''
  document.getElementById('portraitInfo').innerHTML = `
    <div class="portrait-name">Profile unavailable</div>
    <p style="font-family:var(--font-sans);font-size:0.92rem;font-weight:300;color:rgba(255,255,255,0.55);line-height:1.65;margin-top:12px;">
      ${esc(message || 'This profile could not be loaded.')}
    </p>
    <div class="portrait-actions" style="margin-top:var(--s-5);">
      <a href="matches.html" class="btn btn-gold" style="flex:1;justify-content:center;">Back to matches</a>
    </div>`
  document.getElementById('profileDetail').innerHTML = ''
}

async function bootProfile() {
  bootPageLoader('Loading profile')
  try {
    if (isSelfView) {
      await hydrateFromProfile().catch(() => {})
      await syncPhotosToStore().catch(() => {})
      renderSelfProfile()
      return
    }

    try {
      member = await loadMemberProfile()
    } catch (err) {
      renderProfileNotFound(err.message)
      return
    }

    if (!member) {
      renderProfileNotFound('Profile not found.')
      return
    }

    document.title = `LEVEL — ${member.name}`
    connectionStatus = member.connectionStatus || 'none'
    requestSent = connectionStatus === 'pending_sent' || store.hasSentRequest(member.id)

    const from = params.get('from')
    if (from === 'dashboard') {
      const back = document.getElementById('navBack')
      const label = document.getElementById('navBackLabel')
      if (back) back.setAttribute('href', 'dashboard.html')
      if (label) label.textContent = 'Dashboard'
    } else if (from === 'matches') {
      const back = document.getElementById('navBack')
      const label = document.getElementById('navBackLabel')
      if (back) back.setAttribute('href', 'matches.html')
      if (label) label.textContent = 'Matches'
    }

    renderPortrait(member)
    renderDetail(member)
    applyConnectionUi()

    document.addEventListener('click', e => {
      const btn = e.target.closest('#connectBtn, #connectBtnFooter')
      if (!btn) return
      if (connectionStatus === 'mutual') {
        window.location.href = chatHref()
        return
      }
      sendConnection()
    })
  } finally {
    finishPageLoader()
  }
}

bootProfile().catch(err => {
  console.error('[profile] init failed:', err)
  finishPageLoader()
})
