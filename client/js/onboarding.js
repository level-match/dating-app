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
  'stepProfile',    //  0. Your details (name + email from OAuth consent)
  'stepVerify',     //  1. Identity verification
  'step0',          //  2. Gender identity
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

// Start at profile details — user confirms OAuth name/email, then verification.
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

  // Re-apply any selections saved before ref data finished loading
  STEP_IDS.forEach(restorePanelSelections)

}).catch(err => {
  console.warn('[onboarding] Could not load ref data:', err.message)
})

function restorePanelSelections(stepKey) {
  const panel = document.getElementById(stepKey)
  if (!panel) return

  if (stepKey === 'stepProfile') {
    const data = answers.stepProfile
    if (!data) return
    const fn = document.getElementById('obFirstName')
    const ln = document.getElementById('obLastName')
    const em = document.getElementById('obEmail')
    if (fn && data.firstName) fn.value = data.firstName
    if (ln && data.lastName) ln.value = data.lastName
    if (em && data.email) em.value = data.email
    return
  }

  if (stepKey === 'step4') {
    const data = answers.step4
    if (!data?.min) return
    const minEl = panel.querySelector('#rangeMin')
    const maxEl = panel.querySelector('#rangeMax')
    if (minEl) minEl.value = data.min
    if (maxEl) maxEl.value = data.max
    const ageMin = document.getElementById('ageMin')
    const ageMax = document.getElementById('ageMax')
    if (ageMin) ageMin.textContent = data.min
    if (ageMax) ageMax.textContent = data.max
    return
  }

  const textarea = panel.querySelector('textarea')
  if (textarea && typeof answers[stepKey] === 'string') {
    textarea.value = answers[stepKey]
    const count = textarea.nextElementSibling
    if (count?.classList.contains('ob-char-count')) {
      count.textContent = textarea.value.length + ' / 500 characters'
    }
    return
  }

  const saved = answers[stepKey]
  if (!Array.isArray(saved) || !saved.length) return

  panel.querySelectorAll('.ob-option, .ob-chip').forEach(el => {
    const label = (el.querySelector('.ob-option-label')?.textContent || el.textContent).trim()
    const intent = el.dataset.intent
    const match = saved.includes(label)
      || saved.includes(intent)
      || (stepKey === 'step5' && answers.intentCategory && intent === answers.intentCategory)
    el.classList.toggle('selected', match)
  })
}

function showPanel(stepIndex) {
  panelEl(currentStep)?.classList.add('hidden')
  currentStep = stepIndex
  const panel = panelEl(currentStep)
  panel?.classList.remove('hidden')
  if (panel) panel.style.animation = 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both'
  restorePanelSelections(STEP_IDS[currentStep])
  updateUI()
}

function updateUI() {
  const pct = Math.round(((currentStep + 1) / totalSteps) * 100)
  document.getElementById('progressFill').style.width = pct + '%'
  document.getElementById('progressPercent').textContent = pct + '%'
  document.getElementById('currentStepNum').textContent = currentStep + 1
  const totalEl = document.getElementById('totalStepNum')
  if (totalEl) totalEl.textContent = totalSteps
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

  if (key === 'stepProfile') {
    const firstName = document.getElementById('obFirstName')?.value.trim() || ''
    const lastName  = document.getElementById('obLastName')?.value.trim() || ''
    const email     = document.getElementById('obEmail')?.value.trim() || ''
    answers.stepProfile = { firstName, lastName, email }
    const user = store.getUser()
    if (user) {
      store.setUser({
        ...user,
        firstName,
        lastName,
        email,
        oauthFields: {
          ...(user.oauthFields || {}),
          firstName: !!firstName,
          lastName: !!lastName,
          email: !!email,
        },
      })
    }
    return
  }

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
    const category = sel?.dataset.intent
    if (category) {
      answers.intentCategory = category
      store.setMatchingEligibility(evaluateEligibility(category))
    }
  }
}

function panelEl(i) {
  return document.getElementById(STEP_IDS[i])
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
  if (currentStep > SKIP_TO_STEP) {
    saveCurrentStep()
    showPanel(currentStep - 1)
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
  const user       = store.getUser()
  const profileData = answers.stepProfile || {}
  const ageData    = answers['step4'] || {}

  const pick = (key) => {
    const v = answers[key]
    if (!v || (Array.isArray(v) && !v.length)) return null
    if (Array.isArray(v)) return v.length === 1 ? v[0] : v.join(', ')
    return v
  }

  const payload = {
    firstName:              profileData.firstName || user?.firstName || '',
    lastName:               profileData.lastName  || user?.lastName  || '',
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
  saveCurrentStep()
}

window.selectCustom = function (el) {
  el.parentNode.querySelectorAll('.ob-option').forEach(s => s.classList.remove('selected'))
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
      saveCurrentStep()
      showPanel(i)
    }
  })
})

// Deep-link: ?goals jumps straight to the Relationship Goals step so members
// can update their intent (used by the Intent Mismatch panel's CTA).
const obParams = new URLSearchParams(window.location.search)
if (obParams.has('goals')) {
  const idx = STEP_IDS.indexOf('step5')
  if (idx >= 0) showPanel(idx)
}

function prefillProfileStep() {
  const user = store.getUser()
  if (!user) return
  const oauth = user.oauthFields || {}

  const fn = document.getElementById('obFirstName')
  const ln = document.getElementById('obLastName')
  const em = document.getElementById('obEmail')

  if (fn && oauth.firstName && user.firstName) fn.value = user.firstName
  if (ln && oauth.lastName && user.lastName) ln.value = user.lastName
  if (em && oauth.email && user.email) em.value = user.email
}

prefillProfileStep()
updateUI()
