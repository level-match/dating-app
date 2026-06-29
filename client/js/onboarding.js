import { store } from './store.js'
import { requireAuth, initBodyFade } from './app.js'
import { evaluateEligibility } from './matching-policy.js'

// Onboarding is a protected route — only reachable after MFA is complete.
requireAuth()
initBodyFade()

/**
 * Step IDs in display order.
 *
 * Using named IDs instead of sequential step{N} keeps insertion stable —
 * adding a new step (Identity Verification, Life Integration, Mobility) doesn't
 * force renumbering of every existing panel element.
 */
const STEP_IDS = [
  'stepVerify',     //  1. Identity verification (Gov ID + Selfie)
  'step0',          //  2. Gender identity
  'step1',          //  3. Pronouns
  'step2',          //  4. Orientation
  'step3',          //  5. Preferred genders
  'step4',          //  6. Age range
  'step5',          //  7. Primary intent
  'step6',          //  8. Long-term vision
  'step7',          //  9. Career chapter
  'stepLifeInt',    // 10. Life integration style
  'stepMobility',   // 11. Mobility profile
  'step8',          // 12. Emotional compatibility
  // 'stepReligion',   // Faith & religion — temporarily hidden (re-add to restore)
  'step9',          // 13. Lifestyle & values
  'step10',         // 14. Legacy & vision
]

let currentStep = 0
const totalSteps = STEP_IDS.length
const answers = {}

function panelEl(i) {
  return document.getElementById(STEP_IDS[i])
}

function updateUI() {
  const pct = Math.round(((currentStep + 1) / totalSteps) * 100)
  document.getElementById('progressFill').style.width = pct + '%'
  document.getElementById('progressPercent').textContent = pct + '%'
  document.getElementById('currentStepNum').textContent = currentStep + 1
  document.querySelectorAll('.ob-step-item').forEach((el, i) => {
    el.classList.remove('active', 'completed')
    if (i === currentStep) el.classList.add('active')
    else if (i < currentStep) el.classList.add('completed')
  })
}

function saveCurrentStep() {
  const panel = panelEl(currentStep)
  if (!panel) return
  const key = STEP_IDS[currentStep]

  // Verification step is handled via mock state on each card; no fields to save.
  if (key === 'stepVerify') return

  const textarea = panel.querySelector('textarea')
  if (textarea) {
    answers[key] = textarea.value
    return
  }

  // Range step (age)
  const ageMin = panel.querySelector('#rangeMin')
  const ageMax = panel.querySelector('#rangeMax')
  if (ageMin && ageMax) {
    answers[key] = { min: +ageMin.value, max: +ageMax.value }
    return
  }

  // Options / chips
  const selected = panel.querySelectorAll('.ob-option.selected, .ob-chip.selected')
  answers[key] = Array.from(selected).map(el => {
    if (el.classList.contains('custom')) {
      const input = el.querySelector('.ob-custom-input')
      return input?.value?.trim() || 'Custom'
    }
    return el.querySelector('.ob-option-label')?.textContent || el.textContent.trim()
  })

  // Relationship Goals → Intent Guardrail. Capture the selected intent
  // category and refresh matching eligibility right away, so "update goals"
  // takes effect even without re-completing the entire flow.
  if (key === 'step5') {
    const sel = panel.querySelector('.ob-option.selected')
    const category = sel?.dataset.intent || answers[key]?.[0]
    answers.intentCategory = category
    store.setMatchingEligibility(evaluateEligibility(category))
  }
}

window.nextStep = function () {
  saveCurrentStep()
  if (currentStep < totalSteps - 1) {
    panelEl(currentStep).classList.add('hidden')
    currentStep++
    const next = panelEl(currentStep)
    next.classList.remove('hidden')
    next.style.animation = 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both'
    updateUI()
  } else {
    showCompletion()
  }
}

window.prevStep = function () {
  if (currentStep > 0) {
    panelEl(currentStep).classList.add('hidden')
    currentStep--
    panelEl(currentStep).classList.remove('hidden')
    updateUI()
  } else {
    window.history.back()
  }
}

function showCompletion() {
  saveCurrentStep()
  store.setOnboarding(answers)
  // Final eligibility decision from the protected matching policy.
  store.setMatchingEligibility(evaluateEligibility(answers.intentCategory || answers['step5']?.[0]))
  panelEl(totalSteps - 1).classList.add('hidden')
  document.getElementById('completionScreen').style.display = 'flex'
  document.getElementById('obFooter').style.display = 'none'
  document.querySelectorAll('.ob-step-item').forEach(el => {
    el.classList.remove('active'); el.classList.add('completed')
  })
  document.getElementById('progressFill').style.width = '100%'
  document.getElementById('progressPercent').textContent = '100%'
}

window.selectOption = function (el) { el.classList.toggle('selected') }

window.selectSingle = function (el) {
  el.parentNode.querySelectorAll('.ob-option').forEach(s => s.classList.remove('selected'))
  el.classList.add('selected')
}

window.selectCustom = function (el) {
  el.parentNode.querySelectorAll('.ob-option').forEach(s => s.classList.remove('selected'))
  el.classList.add('selected')
  const input = el.querySelector('.ob-custom-input')
  if (input) {
    input.style.display = 'block'
    setTimeout(() => input.focus(), 60)
  }
}

window.openCustom = function (key) {
  alert('Tap "Add your own" on the previous step to enter a custom ' + key + '.')
}

window.toggleChip = function (el) { el.classList.toggle('selected') }

window.syncAge = function (which) {
  const minEl = document.getElementById('rangeMin')
  const maxEl = document.getElementById('rangeMax')
  let min = +minEl.value
  let max = +maxEl.value
  if (which === 'min' && min > max - 2) min = max - 2
  if (which === 'max' && max < min + 2) max = min + 2
  minEl.value = min
  maxEl.value = max
  document.getElementById('ageMin').textContent = min
  document.getElementById('ageMax').textContent = max
}

/* ────────────────────────────────────────────────────────────
   Step 1 — Verification flow
   Two cards: government ID, selfie.
   Each transitions idle → pending → verified.
   Demo uses mock states (no real KYC integration here).
   ──────────────────────────────────────────────────────────── */

function setVerifyState(cardId, state, label) {
  const card = document.getElementById(cardId)
  if (!card) return
  card.dataset.state = state
  const pill = card.querySelector('.ob-verify-status')
  if (pill) {
    pill.dataset.state = state
    pill.textContent = label || (state === 'verified' ? 'Verified' : state === 'pending' ? 'Pending review' : 'Not started')
  }
}

window.selectIdType = function (btn, typeName) {
  document.querySelectorAll('.ob-id-type-btn').forEach(b => b.classList.remove('selected'))
  btn.classList.add('selected')
  document.getElementById('idTypeLabel').textContent = `Uploading: ${typeName} — official document only`
  document.getElementById('idTypeSelector').style.display = 'none'
  document.getElementById('idUploadZone').style.display = 'block'
  document.getElementById('verifyIdDropTitle').textContent = `Drag your ${typeName} here, or browse`
}

window.resetIdType = function () {
  document.querySelectorAll('.ob-id-type-btn').forEach(b => b.classList.remove('selected'))
  document.getElementById('idUploadZone').style.display = 'none'
  document.getElementById('idTypeSelector').style.display = 'block'
  const input = document.getElementById('verifyIdFile')
  if (input) input.value = ''
  document.getElementById('verifyIdDropTitle').textContent = 'Drag your document here, or browse'
  setVerifyState('vcID', 'idle', 'Not started')
}

window.onVerifyIdFile = function (ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  const drop = document.getElementById('verifyIdDrop')
  const title = document.getElementById('verifyIdDropTitle')
  if (title) title.textContent = file.name + ' · uploaded'
  setVerifyState('vcID', 'pending', 'Reviewing')
  if (drop) drop.classList.remove('is-dragging')
  // Mock review: flips to verified after a beat
  setTimeout(() => setVerifyState('vcID', 'verified'), 1200)
}

window.captureSelfie = async function () {
  const modal   = document.getElementById('cameraModal')
  const video   = document.getElementById('cameraVideo')
  const preview = document.getElementById('selfiePreview')
  const capBtn  = document.getElementById('cameraCaptureBtn')
  const retakeBtn = document.getElementById('cameraRetakeBtn')
  const useBtn  = document.getElementById('cameraUseBtn')
  const guide   = document.getElementById('cameraGuide')
  const status  = document.getElementById('cameraStatus')
  const closeBtn = document.getElementById('cameraCloseBtn')
  const canvas  = document.createElement('canvas')
  let stream    = null

  function stopStream() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
  }

  function closeCamera() {
    stopStream()
    modal.style.display = 'none'
    video.srcObject = null
  }

  async function startCamera() {
    preview.style.display   = 'none'
    video.style.display     = 'block'
    capBtn.style.display    = 'inline-flex'
    retakeBtn.style.display = 'none'
    useBtn.style.display    = 'none'
    guide.style.display     = 'flex'
    capBtn.disabled         = true
    status.textContent      = 'Requesting camera access…'

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      video.srcObject = stream
      await video.play()
      status.textContent = 'Center your face in the oval, then tap Capture photo.'
      capBtn.disabled = false
    } catch (err) {
      status.textContent = err.name === 'NotAllowedError'
        ? 'Camera access was denied. Please allow camera access in your browser settings and try again.'
        : 'Unable to access your camera. Make sure it is connected and not in use by another app.'
    }
  }

  // Open modal
  modal.style.display = 'flex'
  await startCamera()

  capBtn.onclick = function () {
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    // Mirror to match the mirrored video feed
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    preview.src             = canvas.toDataURL('image/jpeg', 0.92)
    preview.style.display   = 'block'
    video.style.display     = 'none'
    capBtn.style.display    = 'none'
    retakeBtn.style.display = 'inline-flex'
    useBtn.style.display    = 'inline-flex'
    guide.style.display     = 'none'
    status.textContent      = 'Looking good? Confirm or retake.'
    stopStream()
  }

  retakeBtn.onclick = startCamera

  useBtn.onclick = function () {
    closeCamera()
    setVerifyState('vcSelfie', 'pending', 'Reviewing')
    setTimeout(() => setVerifyState('vcSelfie', 'verified'), 1800)
  }

  closeBtn.onclick = closeCamera
}

// Drag-drop handlers for the ID zone
document.addEventListener('dragover', (e) => {
  const drop = e.target.closest?.('#verifyIdDrop')
  if (drop) { e.preventDefault(); drop.classList.add('is-dragging') }
})
document.addEventListener('dragleave', (e) => {
  const drop = e.target.closest?.('#verifyIdDrop')
  if (drop) drop.classList.remove('is-dragging')
})
document.addEventListener('drop', (e) => {
  const drop = e.target.closest?.('#verifyIdDrop')
  if (!drop) return
  e.preventDefault()
  drop.classList.remove('is-dragging')
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    const input = document.getElementById('verifyIdFile')
    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    window.onVerifyIdFile({ target: input })
  }
})

// Character counter for textarea step
document.querySelectorAll('.ob-textarea').forEach(ta => {
  ta.addEventListener('input', () => {
    const count = ta.nextElementSibling
    if (count && count.classList.contains('ob-char-count')) {
      count.textContent = ta.value.length + ' / 500 characters'
    }
  })
})

// Allow clicking sidebar steps to jump backwards (prevents skipping ahead)
document.querySelectorAll('.ob-step-item').forEach((el, i) => {
  el.addEventListener('click', () => {
    if (i === currentStep) return
    if (i < currentStep) {
      panelEl(currentStep).classList.add('hidden')
      currentStep = i
      panelEl(currentStep).classList.remove('hidden')
      updateUI()
    }
  })
})

// Deep-link: ?goals jumps straight to the Relationship Goals step so members
// can update their intent (used by the Intent Mismatch panel's CTA).
const obParams = new URLSearchParams(window.location.search)
if (obParams.has('goals')) {
  const idx = STEP_IDS.indexOf('step5')
  if (idx >= 0) {
    panelEl(currentStep).classList.add('hidden')
    currentStep = idx
    panelEl(currentStep).classList.remove('hidden')
  }
}

updateUI()
