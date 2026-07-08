import { store } from './store.js'
import { evaluateEligibility } from './matching-policy.js'
import { requireAuth, initBodyFade, showToast, hydrateFromProfile } from './app.js'
import { firstLabel, labelsFromAnswers } from './ref-ui.js'
import { apiFetch } from './sso.js'
import { supabase } from './supabase.js'

requireAuth()
initBodyFade()

bootProfileSetup().catch(err => console.error('[profile-setup] init failed:', err))

window.updatePreview = function() {
  const first = document.getElementById('firstNameInput')?.value.trim() || ''
  const last = document.getElementById('lastNameInput')?.value.trim() || ''
  const age = document.getElementById('ageInput')?.value.trim() || ''
  const title = document.getElementById('titleInput')?.value.trim() || ''
  const location = document.getElementById('locationInput')?.value.trim() || ''

  const previewName = document.getElementById('previewName')
  if (previewName) {
    const lastInitial = last ? ` ${last.charAt(0)}.` : ''
    previewName.textContent = (first + lastInitial) || 'Your Name'
  }

  // Title · Age
  const previewRole = document.getElementById('previewRole')
  if (previewRole) {
    if (title && age) previewRole.textContent = title + ' · ' + age
    else if (title)   previewRole.textContent = title
    else if (age)     previewRole.textContent = 'Age ' + age
    else              previewRole.textContent = 'Your title will appear here'
  }

  // Location badge — show only when filled
  const locBadge = document.getElementById('previewLocation')
  if (locBadge) {
    if (location) {
      locBadge.textContent = location.split(',')[0].trim()
      locBadge.style.display = ''
    } else {
      locBadge.style.display = 'none'
    }
  }
}

window.updatePreviewRole = window.updatePreview   // keep old callers working

window.updatePreviewBio = function(el) {
  const bio = document.getElementById('previewBio')
  if (bio) bio.textContent = el.value || 'Your bio will appear here. Share what makes you remarkable — your passions, your perspective, what you\'re building.'
  const count = document.getElementById('bioCount')
  if (count) count.textContent = el.value.length
}

/* ════════════════════════════════════════════════════════════
   Photo uploader — frontend-only with mock upload.
   Up to 5 photos · slot 0 is always Main Photo.
   Validation: type (JPG/PNG/WEBP) + size (max 5MB).
   Persists to `level_user.photos` so the structure is ready
   for a real backend upload swap later.
   ════════════════════════════════════════════════════════════ */

const PHOTO_MAX_SLOTS  = 5
const PHOTO_MAX_BYTES  = 5 * 1024 * 1024
const PHOTO_TYPES      = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

// In-memory photo state — array of { src, name, size } indexed 0..4
const photoState = new Array(PHOTO_MAX_SLOTS).fill(null)
let activeSlotIndex = null

/**
 * Converts the file to a base64 data URL so the photo survives page
 * navigation and localStorage round-trips. Blob URLs are session-scoped
 * and break as soon as the user leaves the upload page.
 *
 * Swap this out for a real signed-upload endpoint when a backend exists.
 */
async function uploadPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function showPhotoError(msg) {
  const banner = document.getElementById('photoError')
  const text   = document.getElementById('photoErrorText')
  if (!banner) return
  text.textContent = msg
  banner.classList.add('active')
  clearTimeout(showPhotoError._t)
  showPhotoError._t = setTimeout(() => banner.classList.remove('active'), 4500)
}

function clearPhotoError() {
  document.getElementById('photoError')?.classList.remove('active')
}

function validateFile(file) {
  if (!file) return 'No file selected.'
  const type = (file.type || '').toLowerCase()
  if (!PHOTO_TYPES.includes(type)) {
    return 'Only JPG, PNG, or WEBP images are allowed.'
  }
  if (file.size > PHOTO_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return `Image too large (${mb}MB). Max 5MB per photo.`
  }
  return null
}

function renderSlot(slot, idx) {
  // Clear previous content
  slot.innerHTML = ''
  slot.classList.remove('filled', 'loading')

  const photo = photoState[idx]
  if (photo) {
    slot.classList.add('filled')
    if (idx === 0) {
      const badge = document.createElement('div')
      badge.className = 'primary-badge'
      badge.textContent = 'Main Photo'
      slot.appendChild(badge)
    }
    const img = document.createElement('img')
    img.className = 'photo-img'
    img.src = photo.src
    img.alt = `Profile photo ${idx + 1}`
    slot.appendChild(img)

    const overlay = document.createElement('div')
    overlay.className = 'photo-overlay'
    slot.appendChild(overlay)

    const actions = document.createElement('div')
    actions.className = 'photo-actions'
    actions.innerHTML = `
      <button type="button" class="photo-action-btn" data-act="change" aria-label="Change photo">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5"/></svg>
        Change
      </button>
      <button type="button" class="photo-action-btn danger" data-act="remove" aria-label="Remove photo">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        Remove
      </button>
    `
    slot.appendChild(actions)
  } else {
    const plus = document.createElement('div')
    plus.className = 'plus-icon'
    plus.textContent = '＋'
    slot.appendChild(plus)
    const hint = document.createElement('div')
    hint.className = 'photo-hint'
    hint.textContent = idx === 0 ? 'Add main photo' : 'Add photo'
    slot.appendChild(hint)
  }
}

function renderAllSlots() {
  document.querySelectorAll('.photo-slot').forEach((slot, idx) => {
    renderSlot(slot, idx)
  })
  // Reflect main photo in the live preview card (full-cover, no arch)
  const mainSrc = photoState[0]?.src || null
  const previewBg     = document.querySelector('.preview-portrait-bg')
  const previewLight  = document.querySelector('.preview-light')
  const previewFigure = document.querySelector('.preview-figure')
  if (previewBg) {
    if (mainSrc) {
      previewBg.style.cssText = `
        background-image: url(${mainSrc});
        background-size: cover;
        background-position: center top;
        width: 100%; height: 100%;
      `
      if (previewLight)  previewLight.style.display  = 'none'
      if (previewFigure) previewFigure.style.display = 'none'
    } else {
      previewBg.style.cssText = ''
      if (previewLight)  previewLight.style.display  = ''
      if (previewFigure) previewFigure.style.display = ''
    }
  }
  persistPhotos()
  // Re-hydrate the topbar avatar if sidebar.js exposed the helper
  if (typeof window.__hydrateTopbarAvatars === 'function') window.__hydrateTopbarAvatars()
}

function persistPhotos() {
  const user = store.getUser() || store.getDefaultUser()
  const photos = photoState
    .map(p => p ? { src: p.src, name: p.name } : null)
    .filter(Boolean)
  store.setUser({ ...user, photos, mainPhoto: photos[0]?.src || null })
}

function openPickerForSlot(idx) {
  activeSlotIndex = idx
  clearPhotoError()
  const input = document.getElementById('photoFileInput')
  if (input) {
    input.value = '' // allow re-selecting the same file
    input.click()
  }
}

async function handleFile(file, idx) {
  const err = validateFile(file)
  if (err) {
    showPhotoError(err)
    return
  }
  const slot = document.querySelector(`.photo-slot[data-index="${idx}"]`)
  if (!slot) return
  slot.classList.add('loading')

  try {
    const src = await uploadPhoto(file)
    photoState[idx] = { src, name: file.name, size: file.size }
    renderAllSlots()
  } catch (e) {
    showPhotoError('Upload failed. Please try again.')
    slot.classList.remove('loading')
  }
}

function removePhoto(idx) {
  if (!photoState[idx]) return
  photoState[idx] = null

  // If main photo (slot 0) was removed, promote the first remaining photo
  if (idx === 0) {
    const next = photoState.findIndex(p => p)
    if (next > 0) {
      photoState[0] = photoState[next]
      photoState[next] = null
    }
  }
  renderAllSlots()
}

/* ─── Wire up slots, actions, file input, drag-drop ─── */

function wirePhotoSlot(slot) {
  const idx = +slot.dataset.index

  // Click / keyboard: only open picker if the slot is empty.
  // If filled, action buttons handle change/remove.
  slot.addEventListener('click', (e) => {
    const actBtn = e.target.closest('.photo-action-btn')
    if (actBtn) {
      const act = actBtn.dataset.act
      if (act === 'remove') removePhoto(idx)
      else if (act === 'change') openPickerForSlot(idx)
      return
    }
    if (!photoState[idx]) openPickerForSlot(idx)
  })

  slot.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!photoState[idx]) openPickerForSlot(idx)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (photoState[idx]) removePhoto(idx)
    }
  })

  // Drag & drop
  slot.addEventListener('dragover', (e) => {
    e.preventDefault()
    slot.classList.add('dragging')
  })
  slot.addEventListener('dragleave', () => slot.classList.remove('dragging'))
  slot.addEventListener('drop', (e) => {
    e.preventDefault()
    slot.classList.remove('dragging')
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file, idx)
  })
}

document.querySelectorAll('.photo-slot').forEach(wirePhotoSlot)

document.getElementById('photoFileInput')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0]
  if (file && activeSlotIndex != null) handleFile(file, activeSlotIndex)
})

/* Hydrate from previously saved photos (e.g. user returns to page).
   Blob URLs are session-scoped and will be dead if the user navigated
   away — only restore data URLs (base64) which are persistent strings. */
;(function hydratePhotos() {
  const user = store.getUser()
  if (!user?.photos?.length) return

  let cleaned = false
  user.photos.slice(0, PHOTO_MAX_SLOTS).forEach((p, i) => {
    if (!p?.src) return
    if (p.src.startsWith('blob:')) { cleaned = true; return } // discard dead blob
    photoState[i] = { src: p.src, name: p.name || `photo-${i + 1}` }
  })

  // If we found stale blobs, scrub them from the stored user object now
  if (cleaned) {
    const validPhotos = photoState.filter(Boolean).map(p => ({ src: p.src, name: p.name }))
    store.setUser({ ...user, photos: validPhotos, mainPhoto: validPhotos[0]?.src || null })
  }

  renderAllSlots()
})()

// Keep the old API alive for any inline onclick still referencing it
window.triggerUpload = openPickerForSlot

function partnerAgeLabel(user, ob) {
  const min = user.ageRangeMin ?? ob.step4?.min
  const max = user.ageRangeMax ?? ob.step4?.max
  if (min == null || max == null) return ''
  return `${min} – ${max}`
}

function setSelectByText(selectEl, text) {
  if (!selectEl || !text) return
  const target = text.trim().toLowerCase()
  for (let i = 0; i < selectEl.options.length; i++) {
    const opt = selectEl.options[i]
    if (opt.text.trim().toLowerCase() === target || opt.value.trim().toLowerCase() === target) {
      selectEl.selectedIndex = i
      return
    }
  }
  const opt = document.createElement('option')
  opt.value = text
  opt.textContent = text
  selectEl.appendChild(opt)
  selectEl.value = text
}

function setReviewText(id, value) {
  const el = document.getElementById(id)
  if (!el) return
  const text = (value || '').toString().trim()
  if (text) {
    el.textContent = text
    el.classList.remove('is-empty')
  } else {
    el.textContent = 'Not set yet'
    el.classList.add('is-empty')
  }
}

function setReviewChips(id, values) {
  const el = document.getElementById(id)
  if (!el) return
  const labels = labelsFromAnswers(values)
  el.innerHTML = ''
  if (!labels.length) {
    el.innerHTML = '<span class="review-value is-empty">Not set yet</span>'
    return
  }
  labels.forEach(label => {
    const chip = document.createElement('span')
    chip.className = 'review-chip'
    chip.textContent = label
    el.appendChild(chip)
  })
}

function fillOnboardingReview(user, ob) {
  setReviewText('reviewGender', user.genderIdentity || firstLabel(ob.step0))
  setReviewText(
    'reviewPronouns',
    (typeof user.pronouns === 'string' && user.pronouns) || firstLabel(ob.step1),
  )
  setReviewText('reviewOrientation', user.sexualOrientation || firstLabel(ob.step2))
  setReviewText('reviewAgeRange', partnerAgeLabel(user, ob))
  setReviewChips(
    'reviewPreferredGenders',
    user.preferredGenders?.length ? user.preferredGenders : labelsFromAnswers(ob.step3),
  )
  setReviewText('reviewIntent', user.primaryIntent || firstLabel(ob.step5))
  setReviewText('reviewCareer', user.careerChapter || firstLabel(ob.step7))
  setReviewText('reviewLifeInt', user.lifeIntegration || firstLabel(ob.stepLifeInt))
  setReviewText('reviewMobility', user.mobilityProfile || firstLabel(ob.stepMobility))
  setReviewText('reviewVision', user.longTermVision || firstLabel(ob.step6))
  setReviewText('reviewEmotional', user.emotionalStyle || firstLabel(ob.step8))
  setReviewChips(
    'reviewLifestyle',
    user.lifestyleValues?.length ? user.lifestyleValues : labelsFromAnswers(ob.step9),
  )
}

async function bootProfileSetup() {
  await hydrateFromProfile().catch(() => {})
  const ob = store.getOnboarding() || {}
  const user = store.getUser() || {}

  // Visibility is a profile-setup concern (public card), not onboarding.
  setSelectByText(
    document.getElementById('orientationVisibilitySelect'),
    user.orientationVisibility || 'Only on mutual matches',
  )

  fillOnboardingReview(user, ob)
  applyUserFieldsToForm(user, ob)
  window.updatePreview()
  updateCompletionRing()
}

function applyUserFieldsToForm(user, ob) {
  const fn = document.getElementById('firstNameInput')
  const ln = document.getElementById('lastNameInput')
  const email = document.getElementById('emailInput')
  if (fn) fn.value = user.firstName || ''
  if (ln) ln.value = user.lastName || ''
  if (email) email.value = user.email || ''

  const title = document.getElementById('titleInput')
  if (title) title.value = user.professionalTitle || user.role || ''

  const loc = document.getElementById('locationInput')
  if (loc) loc.value = user.location || ''

  const edu = document.getElementById('educationInput')
  if (edu) edu.value = user.education || ''

  const industry = document.getElementById('industrySelect')
  if (industry && user.industry) industry.value = user.industry

  const bio = document.getElementById('bioInput')
  const legacy = user.legacyVision || user.bio || ob.step10 || ''
  if (bio && legacy) {
    bio.value = legacy
    window.updatePreviewBio(bio)
  }
}

window.saveProfile = async function(e) {
  if (e) e.preventDefault()

  const user = store.getUser() || {}
  const ob = store.getOnboarding() || {}
  const bioInput = document.getElementById('bioInput')
  const orientationVisibility = document.getElementById('orientationVisibilitySelect')?.value || ''

  // Alignment / identity fields come from onboarding (or previously saved
  // profile) — profile setup no longer re-edits them.
  const payload = {
    firstName: document.getElementById('firstNameInput')?.value?.trim() || user.firstName || '',
    lastName: document.getElementById('lastNameInput')?.value?.trim() || user.lastName || '',
    avatarUrl: user.avatarUrl || user.mainPhoto || '',
    professionalTitle: document.getElementById('titleInput')?.value?.trim() || '',
    location: document.getElementById('locationInput')?.value?.trim() || '',
    education: document.getElementById('educationInput')?.value?.trim() || '',
    industry: document.getElementById('industrySelect')?.value || '',
    legacyVision: bioInput?.value?.trim() || ob.step10 || '',
    genderIdentity: user.genderIdentity || firstLabel(ob.step0) || null,
    pronouns: user.pronouns
      ? (Array.isArray(user.pronouns) ? user.pronouns : [user.pronouns])
      : labelsFromAnswers(ob.step1),
    orientation: user.sexualOrientation || firstLabel(ob.step2) || null,
    preferredGenders: user.preferredGenders?.length
      ? user.preferredGenders
      : labelsFromAnswers(ob.step3),
    ageRangeMin: user.ageRangeMin ?? ob.step4?.min ?? null,
    ageRangeMax: user.ageRangeMax ?? ob.step4?.max ?? null,
    primaryIntent: user.primaryIntent || firstLabel(ob.step5) || null,
    intentCategory: ob.intentCategory || user.relationshipGoals || null,
    longTermVision: user.longTermVision || firstLabel(ob.step6) || null,
    careerChapter: user.careerChapter || firstLabel(ob.step7) || null,
    lifeIntegration: user.lifeIntegration || firstLabel(ob.stepLifeInt) || null,
    mobilityProfile: user.mobilityProfile || firstLabel(ob.stepMobility) || null,
    emotionalCompatibility: user.emotionalStyle || firstLabel(ob.step8) || null,
    lifestyleValues: user.lifestyleValues?.length
      ? user.lifestyleValues
      : labelsFromAnswers(ob.step9),
  }

  const btn = document.getElementById('saveProfileBtn')
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…' }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      showToast('Your session expired. Sign in again to save your profile.', '✕')
      return
    }

    const res = await apiFetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (err.error === 'INVALID_TOKEN') {
        showToast('Your session expired. Sign in again to save your profile.', '✕')
        return
      }
      showToast(err.message || 'Could not save your profile.', '✕')
      return
    }

    const intentForEligibility = payload.intentCategory || payload.primaryIntent
    store.setUser({
      ...user,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: user.email,
      role: payload.professionalTitle,
      professionalTitle: payload.professionalTitle,
      bio: payload.legacyVision,
      legacyVision: payload.legacyVision,
      location: payload.location,
      education: payload.education,
      industry: payload.industry,
      genderIdentity: payload.genderIdentity,
      pronouns: Array.isArray(payload.pronouns) ? payload.pronouns[0] || '' : payload.pronouns,
      sexualOrientation: payload.orientation,
      orientationVisibility,
      preferredGenders: payload.preferredGenders,
      ageRangeMin: payload.ageRangeMin,
      ageRangeMax: payload.ageRangeMax,
      primaryIntent: payload.primaryIntent,
      longTermVision: payload.longTermVision,
      careerChapter: payload.careerChapter,
      lifeIntegration: payload.lifeIntegration,
      mobilityProfile: payload.mobilityProfile,
      emotionalStyle: payload.emotionalCompatibility,
      lifestyleValues: payload.lifestyleValues,
      relationshipGoals: intentForEligibility || user.relationshipGoals || null,
      profileSavedToDb: true,
      profileComplete: 100,
    })
    if (intentForEligibility) store.setMatchingEligibility(evaluateEligibility(intentForEligibility))

    window.location.href = 'profile.html?me=1'
  } catch (err) {
    console.error('[profile-setup] save failed:', err)
    showToast('Could not save your profile. Check your connection.', '✕')
  } finally {
    if (btn) {
      btn.disabled = false
      btn.textContent = 'Save & View Profile'
    }
  }
}

// Update completion ring based on filled public-profile fields
function updateCompletionRing() {
  const fields = [
    document.getElementById('firstNameInput')?.value?.trim(),
    document.getElementById('titleInput')?.value?.trim(),
    document.getElementById('locationInput')?.value?.trim(),
    document.getElementById('industrySelect')?.value?.trim(),
    document.getElementById('bioInput')?.value?.trim(),
    store.getUser()?.photos?.length || photoState[0]?.src,
  ]
  const filled = fields.filter(Boolean).length
  const pct = Math.min(100, Math.round((filled / fields.length) * 100))
  const ring = document.getElementById('completionRingFill')
  const text = document.getElementById('completionText')
  if (ring) {
    const circumference = 213.6
    ring.style.strokeDashoffset = circumference - (circumference * pct / 100)
  }
  if (text) text.textContent = pct + '%'
}

document.querySelectorAll('.form-input').forEach(el => {
  el.addEventListener('input', updateCompletionRing)
  el.addEventListener('change', updateCompletionRing)
})

const bioInput = document.getElementById('bioInput')
if (bioInput && bioInput.value) {
  const count = document.getElementById('bioCount')
  if (count) count.textContent = bioInput.value.length
}

updateCompletionRing()
