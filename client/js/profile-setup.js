import { store } from './store.js'
import { evaluateEligibility } from './matching-policy.js'
import { requireAuth, initBodyFade } from './app.js'

requireAuth()
initBodyFade()

window.updatePreview = function() {
  const nameInput = document.querySelector('input[placeholder="Alexandra"]')
  const name = nameInput?.value || 'Your Name'
  const previewName = document.getElementById('previewName')
  if (previewName) previewName.textContent = name + ' R.'
}

window.updatePreviewRole = function() {
  const roleInput = document.querySelector('input[placeholder="e.g. Partner, McKinsey & Company"]')
  const role = roleInput?.value || 'Your Title'
  const previewRole = document.getElementById('previewRole')
  if (previewRole) previewRole.textContent = role + ' · 34'
}

window.updatePreviewBio = function(el) {
  const bio = document.getElementById('previewBio')
  if (bio) bio.textContent = el.value || 'Your bio will appear here.'
  const count = document.getElementById('bioCount')
  if (count) count.textContent = el.value.length
}

window.toggleInterest = function(el) { el.classList.toggle('selected') }

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
 * Hook this in place of a real backend upload later. Resolves with
 * the persistent URL we should store. For now it just returns the
 * blob URL after a brief simulated network delay.
 */
async function uploadPhoto(file) {
  const localUrl = URL.createObjectURL(file)
  // Simulate network upload
  await new Promise(r => setTimeout(r, 450 + Math.random() * 350))
  return localUrl
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
  persistPhotos()
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
  // Revoke the object URL to free memory
  try {
    if (photoState[idx].src?.startsWith('blob:')) URL.revokeObjectURL(photoState[idx].src)
  } catch {}
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

/* Hydrate from previously saved photos (e.g. user returns to page) */
;(function hydratePhotos() {
  const user = store.getUser()
  if (!user?.photos?.length) return
  user.photos.slice(0, PHOTO_MAX_SLOTS).forEach((p, i) => {
    if (p?.src) photoState[i] = { src: p.src, name: p.name || `photo-${i + 1}` }
  })
  renderAllSlots()
})()

// Keep the old API alive for any inline onclick still referencing it
window.triggerUpload = openPickerForSlot

window.saveProfile = function(e) {
  const user = store.getUser() || store.getDefaultUser()
  const nameInput = document.querySelector('input[placeholder="Alexandra"]')
  const roleInput = document.querySelector('input[placeholder="e.g. Partner, McKinsey & Company"]')
  const bioInput = document.getElementById('bioInput')
  const interests = Array.from(document.querySelectorAll('.interest-chip.selected')).map(el => el.textContent)

  const goals = document.getElementById('relationshipGoals')?.value

  store.setUser({
    ...user,
    firstName: nameInput?.value || user.firstName,
    role: roleInput?.value || user.role,
    bio: bioInput?.value || '',
    interests,
    relationshipGoals: goals || user.relationshipGoals || null,
    profileComplete: Math.min(100, (user.profileComplete || 72) + 15),
  })

  // Keep matching eligibility in sync with the same protected policy used by
  // onboarding — editing goals here is a valid way to update intent.
  if (goals) store.setMatchingEligibility(evaluateEligibility(goals))
}

// Update completion ring based on filled fields
function updateCompletionRing() {
  let filled = 0
  const total = 5
  document.querySelectorAll('.form-input:not(select)').forEach(input => {
    if (input.value.trim()) filled++
  })
  const pct = Math.min(100, Math.round((filled / total) * 100) + 30)
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
})

// Init bio count
const bioInput = document.getElementById('bioInput')
if (bioInput) {
  const count = document.getElementById('bioCount')
  if (count) count.textContent = bioInput.value.length
}

updateCompletionRing()
