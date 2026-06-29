import { store } from './store.js'
import { requireAuth, initBodyFade } from './app.js'
import { evaluateEligibility } from './matching-policy.js'
import { apiFetch } from './sso.js'
import { getRefData } from './ref-data.js'

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
  'stepVerify',     //  0. Identity verification (auto-skipped for now; restore when KYC is ready)
  'step0',          //  1. Gender identity
  'step1',          //  2. Pronouns
  'step2',          //  3. Orientation
  'step3',          //  4. Preferred genders
  'step4',          //  5. Age range
  'step5',          //  6. Primary intent
  'step6',          //  7. Long-term vision
  'step7',          //  8. Career chapter
  'stepLifeInt',    //  9. Life integration style
  'stepMobility',   // 10. Mobility profile
  'step8',          // 11. Emotional compatibility
  // 'stepReligion',   // Faith & religion — temporarily hidden (re-add to restore)
  'step9',          // 12. Lifestyle & values
  'step10',         // 13. Legacy & vision
]

// Start at 1 to skip identity verification — step still exists in the array
// so the sidebar renders it, but users land directly on gender identity.
const SKIP_TO_STEP = 0
let currentStep = SKIP_TO_STEP
const totalSteps = STEP_IDS.length
const answers = {}

// Initialise panel visibility: show only the starting step
;(() => {
  STEP_IDS.forEach((id, i) => {
    const el = document.getElementById(id)
    if (!el) return
    if (i === currentStep) el.classList.remove('hidden')
    else el.classList.add('hidden')
  })
})()

/* ═══════════════════════════════════════════════════════════════════════
   Dynamic option rendering — loads all choices from /api/ref/all so
   the UI always reflects what's in the database (no hardcoded labels).
   ═══════════════════════════════════════════════════════════════════════ */

function renderOptions(container, items, { single = true, hasCustom = false, customKey = '' } = {}) {
  if (!container || !items?.length) return
  const handler = single ? 'selectSingle(this)' : 'toggleChip(this)'

  container.innerHTML = items
    .filter(item => item.id !== 99)   // 99 = Custom sentinel — added separately below
    .map(item => `
      <div class="ob-option" onclick="${handler}">
        <div class="ob-option-check">✓</div>
        <span class="ob-option-label">${item.label}</span>
      </div>`).join('')

  if (hasCustom) {
    container.insertAdjacentHTML('beforeend', `
      <div class="ob-option custom" onclick="selectCustom(this, '${customKey}')">
        <div class="ob-option-check"></div>
        <span class="ob-option-label">Add your own</span>
        <span class="ob-option-desc">Type it the way you'd describe yourself</span>
        <input type="text" class="ob-custom-input" placeholder="Type and press enter"
          style="display:none;margin-top:10px;width:100%;background:transparent;border:none;
                 border-bottom:1px solid rgba(184,168,212,0.5);color:#FBF7EE;padding:6px 0;
                 font-family:Inter,sans-serif;font-size:0.92rem;outline:none;"/>
      </div>`)
  }
}

function renderChips(container, items) {
  if (!container || !items?.length) return
  container.innerHTML = items.map(item =>
    `<div class="ob-chip" onclick="toggleChip(this)">${item.label}</div>`
  ).join('')
}

// Fetch ref data and populate every option container in the DOM
getRefData().then(ref => {
  // step0 — Gender identity (single select + custom)
  renderOptions(document.getElementById('step0-options'), ref.genders,
    { single: true, hasCustom: true, customKey: 'identity' })

  // step1 — Pronouns (multi chip)
  renderChips(document.getElementById('step1-options'), ref.pronouns)

  // step2 — Orientation (single select + custom)
  renderOptions(document.getElementById('step2-options'), ref.orientations,
    { single: true, hasCustom: true, customKey: 'orientation' })

  // step3 — Preferred genders (multi chip)
  renderChips(document.getElementById('step3-options'), ref.preferredGenders)

  // step5 intent panel has custom layout — keep its static HTML

  // step6 — Long-term vision (list layout)
  renderOptions(document.getElementById('step6-options'), ref.longTermVisions)

  // step7 — Career chapter (list layout)
  renderOptions(document.getElementById('step7-options'), ref.careerChapters)

  // stepLifeInt — Life integration
  renderOptions(document.getElementById('stepLifeInt-options'), ref.lifeIntegrations)

  // stepMobility — Mobility profile (list layout)
  renderOptions(document.getElementById('stepMobility-options'), ref.mobilityProfiles)

  // step8 — Emotional compatibility
  renderOptions(document.getElementById('step8-options'), ref.emotionalStyles)

  // step9 — Lifestyle values (multi chip)
  renderChips(document.getElementById('step9-options'), ref.lifestyleValues)

}).catch(err => {
  console.warn('[onboarding] Could not load ref data:', err.message)
})

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
  if (currentStep > SKIP_TO_STEP) {
    panelEl(currentStep).classList.add('hidden')
    currentStep--
    panelEl(currentStep).classList.remove('hidden')
    updateUI()
  } else {
    window.history.back()
  }
}

async function showCompletion() {
  saveCurrentStep()
  store.setOnboarding(answers)
  store.setMatchingEligibility(evaluateEligibility(answers.intentCategory || answers['step5']?.[0]))

  panelEl(totalSteps - 1).classList.add('hidden')
  document.getElementById('completionScreen').style.display = 'flex'
  document.getElementById('obFooter').style.display = 'none'
  document.querySelectorAll('.ob-step-item').forEach(el => {
    el.classList.remove('active'); el.classList.add('completed')
  })
  document.getElementById('progressFill').style.width = '100%'
  document.getElementById('progressPercent').textContent = '100%'

  // Build the profile payload from collected answers
  const user    = store.getUser()
  const ageData = answers['step4'] || {}

  const pick = (key) => {
    const v = answers[key]
    if (!v) return null
    if (Array.isArray(v)) return v.length === 1 ? v[0] : v.join(', ')
    return v
  }

  const payload = {
    firstName:              user?.firstName || '',
    lastName:               user?.lastName  || '',
    avatarUrl:              user?.avatarUrl || '',
    genderIdentity:         pick('step0'),
    pronouns:               answers['step1']  || [],
    orientation:            pick('step2'),
    preferredGenders:       answers['step3']  || [],
    ageRangeMin:            ageData.min || null,
    ageRangeMax:            ageData.max || null,
    primaryIntent:          pick('step5'),
    intentCategory:         answers.intentCategory || null,
    longTermVision:         pick('step6'),
    careerChapter:          pick('step7'),
    lifeIntegration:        pick('stepLifeInt'),
    mobilityProfile:        pick('stepMobility'),
    emotionalCompatibility: pick('step8'),
    lifestyleValues:        answers['step9']  || [],
    legacyVision:           answers['step10'] || '',
  }

  try {
    const res = await apiFetch('/api/auth/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[onboarding] profile save failed:', err)
    } else {
      console.log('[onboarding] profile saved to database.')
    }
  } catch (e) {
    console.error('[onboarding] profile save error:', e)
  }
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

window.captureSelfie = function () {
  // Mock capture: in production this would open getUserMedia + live ID match.
  setVerifyState('vcSelfie', 'pending', 'Capturing')
  setTimeout(() => setVerifyState('vcSelfie', 'verified'), 1400)
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
