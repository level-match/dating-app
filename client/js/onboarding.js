import { store } from './store.js'
import { requireAuth, initBodyFade, hydrateSubscription } from './app.js'
import { evaluateEligibility } from './matching-policy.js'
import { getRefData, warmRefData } from './ref-data.js'
import { renderOptionGrid, renderChipGrid } from './ref-ui.js'
import { apiFetch } from './sso.js'

requireAuth()
initBodyFade()
warmRefData()

const STEP_IDS = [
  'stepVerify',
  'step0', 'step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7',
  'stepLifeInt', 'stepMobility', 'step8', 'step9', 'step10',
]

let currentStep = 0
const totalSteps = STEP_IDS.length
const answers = store.getOnboarding() || {}
let refData = null

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

function showPanel(index) {
  panelEl(currentStep)?.classList.add('hidden')
  currentStep = index
  panelEl(currentStep)?.classList.remove('hidden')
  restorePanelSelections()
  updateUI()
}

function saveCurrentStep() {
  const panel = panelEl(currentStep)
  if (!panel) return
  const key = STEP_IDS[currentStep]
  if (key === 'stepVerify') return

  const textarea = panel.querySelector('textarea')
  if (textarea) {
    answers[key] = textarea.value
    return
  }

  const ageMin = panel.querySelector('#rangeMin')
  const ageMax = panel.querySelector('#rangeMax')
  if (ageMin && ageMax) {
    answers[key] = { min: +ageMin.value, max: +ageMax.value }
    return
  }

  const selected = panel.querySelectorAll('.ob-option.selected, .ob-chip.selected')
  answers[key] = Array.from(selected).map(el => {
    if (el.classList.contains('custom')) {
      const input = el.querySelector('.ob-custom-input')
      return input?.value?.trim() || 'Custom'
    }
    return el.querySelector('.ob-option-label')?.textContent?.trim()
      || el.dataset.label
      || el.textContent.trim()
  })

  if (key === 'step5') {
    const sel = panel.querySelector('.ob-option.selected')
    answers.intentCategory = sel?.dataset.intent || answers[key]?.[0]
    store.setMatchingEligibility(evaluateEligibility(answers.intentCategory))
  }
}

function restorePanelSelections() {
  const key = STEP_IDS[currentStep]
  const panel = panelEl(currentStep)
  if (!panel || key === 'stepVerify' || key === 'step4') return

  const saved = answers[key]
  if (!saved) return

  if (key === 'step10' && typeof saved === 'string') {
    const ta = panel.querySelector('textarea')
    if (ta) ta.value = saved
    return
  }

  const labels = Array.isArray(saved) ? saved : [saved]
  const norm = labels.map(l => String(l).trim().toLowerCase())

  panel.querySelectorAll('.ob-option, .ob-chip').forEach(el => {
    const label = (
      el.querySelector('.ob-option-label')?.textContent
      || el.dataset.label
      || el.textContent
    ).trim().toLowerCase()
    el.classList.toggle('selected', norm.includes(label))
  })
}

async function renderAllOptions() {
  refData = await getRefData()

  renderOptionGrid(document.getElementById('step0-options'), refData.genders, { withCustom: true, customKey: 'identity' })
  renderChipGrid(document.getElementById('step1-options'), refData.pronouns)
  renderOptionGrid(document.getElementById('step2-options'), refData.orientations, { withCustom: true, customKey: 'orientation' })
  renderChipGrid(document.getElementById('step3-options'), refData.preferredGenders)

  const intentContainer = document.getElementById('step5-options')
  if (intentContainer) {
    intentContainer.innerHTML = ''
    const preferred = refData.intents.filter(i => ['legacy_builder', 'intentional_partner'].includes(i.category_slug))
    const rest = refData.intents.filter(i => !['legacy_builder', 'intentional_partner'].includes(i.category_slug))
    if (preferred.length) {
      const lbl = document.createElement('div')
      lbl.className = 'ob-intent-group-label'
      lbl.textContent = 'Core LEVEL intents'
      intentContainer.appendChild(lbl)
      renderOptionGrid(intentContainer, preferred)
    }
    if (rest.length) {
      const lbl = document.createElement('div')
      lbl.className = 'ob-intent-group-label'
      lbl.textContent = 'Other partnership styles'
      intentContainer.appendChild(lbl)
      renderOptionGrid(intentContainer, rest)
    }
  }

  renderOptionGrid(document.getElementById('step6-options'), refData.longTermVisions)
  renderOptionGrid(document.getElementById('step7-options'), refData.careerChapters)
  renderOptionGrid(document.getElementById('stepLifeInt-options'), refData.lifeIntegrations)
  renderOptionGrid(document.getElementById('stepMobility-options'), refData.mobilityProfiles)
  renderOptionGrid(document.getElementById('step8-options'), refData.emotionalStyles)
  renderChipGrid(document.getElementById('step9-options'), refData.lifestyleValues)

  restorePanelSelections()
}

window.nextStep = function () {
  saveCurrentStep()
  if (currentStep < totalSteps - 1) {
    showPanel(currentStep + 1)
  } else {
    showCompletion()
  }
}

window.prevStep = function () {
  if (currentStep > 0) {
    showPanel(currentStep - 1)
  } else {
    window.history.back()
  }
}

async function showCompletion() {
  saveCurrentStep()
  store.setOnboarding(answers)
  store.setMatchingEligibility(evaluateEligibility(answers.intentCategory || answers.step5?.[0]))

  try {
    const res = await apiFetch('/api/auth/onboarding-complete', { method: 'POST', body: JSON.stringify({}) })
    if (res.ok) {
      const data = await res.json()
      if (data.tier) {
        store.applySubscriptionSync(data)
      } else {
        await hydrateSubscription()
      }
    }
  } catch (e) {
    console.warn('[onboarding] onboarding-complete skipped:', e)
  }

  panelEl(totalSteps - 1)?.classList.add('hidden')
  document.getElementById('completionScreen').style.display = 'flex'
  document.getElementById('obFooter').style.display = 'none'
  document.querySelectorAll('.ob-step-item').forEach(el => {
    el.classList.remove('active')
    el.classList.add('completed')
  })
  document.getElementById('progressFill').style.width = '100%'
  document.getElementById('progressPercent').textContent = '100%'
}

window.selectOption = function (el) { el.classList.toggle('selected') }

window.selectSingle = function (el) {
  const parent = el.closest('.ob-options-grid, .ob-options-list') || el.parentNode
  parent.querySelectorAll('.ob-option').forEach(s => s.classList.remove('selected'))
  el.classList.add('selected')
  saveCurrentStep()
}

window.selectCustom = function (el) {
  const parent = el.closest('.ob-options-grid, .ob-options-list') || el.parentNode
  parent.querySelectorAll('.ob-option').forEach(s => s.classList.remove('selected'))
  el.classList.add('selected')
  const input = el.querySelector('.ob-custom-input')
  if (input) {
    input.style.display = 'block'
    setTimeout(() => input.focus(), 60)
    input.oninput = () => saveCurrentStep()
    input.onkeydown = (e) => { if (e.key === 'Enter') saveCurrentStep() }
  }
  saveCurrentStep()
}

window.openCustom = function (key) {
  alert('Tap "Add your own" on the previous step to enter a custom ' + key + '.')
}

window.toggleChip = function (el) {
  el.classList.toggle('selected')
  saveCurrentStep()
}

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
  saveCurrentStep()
}

/* ─── Verification (mock KYC) ─── */
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


window.captureSelfie = async function () {
  const modal = document.getElementById('cameraModal')
  const video = document.getElementById('cameraVideo')
  const preview = document.getElementById('selfiePreview')
  const capBtn = document.getElementById('cameraCaptureBtn')
  const retakeBtn = document.getElementById('cameraRetakeBtn')
  const useBtn = document.getElementById('cameraUseBtn')
  const guide = document.getElementById('cameraGuide')
  const status = document.getElementById('cameraStatus')
  const closeBtn = document.getElementById('cameraCloseBtn')
  const canvas = document.createElement('canvas')
  let stream = null

  function stopStream() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
  }
  function closeCamera() {
    stopStream()
    modal.style.display = 'none'
    video.srcObject = null
  }

  async function startCamera() {
    preview.style.display = 'none'
    video.style.display = 'block'
    capBtn.style.display = 'inline-flex'
    retakeBtn.style.display = 'none'
    useBtn.style.display = 'none'
    guide.style.display = 'flex'
    capBtn.disabled = true
    status.textContent = 'Requesting camera access…'
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
        ? 'Camera access was denied.'
        : 'Unable to access your camera.'
    }
  }

  modal.style.display = 'flex'
  await startCamera()

  capBtn.onclick = function () {
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    preview.src = canvas.toDataURL('image/jpeg', 0.92)
    preview.style.display = 'block'
    video.style.display = 'none'
    capBtn.style.display = 'none'
    retakeBtn.style.display = 'inline-flex'
    useBtn.style.display = 'inline-flex'
    guide.style.display = 'none'
    status.textContent = 'Looking good? Confirm or retake.'
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


document.querySelectorAll('.ob-textarea').forEach(ta => {
  ta.addEventListener('input', () => {
    const count = ta.nextElementSibling
    if (count?.classList.contains('ob-char-count')) {
      count.textContent = ta.value.length + ' / 500 characters'
    }
    saveCurrentStep()
  })
})

document.querySelectorAll('.ob-step-item').forEach((el, i) => {
  el.addEventListener('click', () => {
    if (i === currentStep) return
    if (i < currentStep) showPanel(i)
  })
})

const obParams = new URLSearchParams(window.location.search)
if (obParams.has('goals')) {
  const idx = STEP_IDS.indexOf('step5')
  if (idx >= 0) showPanel(idx)
}

renderAllOptions().catch(err => console.error('[onboarding] ref data failed:', err))
updateUI()
