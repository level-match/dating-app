import { store } from './store.js'
import { initBodyFade, requireAuth, showToast } from './app.js'
import { saveAlignmentAnswers } from './alignment-api.js'
import {
  CATEGORIES,
  SAMPLE_PEERS,
  scoreCompatibility,
  isComplete,
} from './alignment-engine.js'

initBodyFade()
requireAuth()

const TOTAL_QUESTIONS = CATEGORIES.reduce((n, c) => n + c.questions.length, 0)
const answers         = store.getAlignment() || {}

const categoriesEl = document.getElementById('aeCategories')
const submitBtn    = document.getElementById('aeSubmit')
const resultsEl    = document.getElementById('aeResults')
const peerGridEl   = document.getElementById('aePeerGrid')
const progFillEl   = document.getElementById('aeProgressFill')
const progPctEl    = document.getElementById('aeProgressPct')
const progTextEl   = document.getElementById('aeProgressText')

/* ─── Render the 4 categories × 2 questions ─── */
function renderCategories() {
  categoriesEl.innerHTML = CATEGORIES.map((cat, ci) => `
    <section class="ae-category" data-cat="${cat.id}">
      <header class="ae-category-header">
        <div class="ae-cat-meta">
          <div class="ae-cat-num">Section ${ci + 1}</div>
          <h2 class="ae-cat-name">${cat.label}</h2>
        </div>
      </header>

      ${cat.questions.map(q => `
        <div class="ae-question" data-q="${q.id}">
          <div class="ae-question-prompt">${q.prompt}</div>
          ${q.zeroOut ? '' : ''}
          <div class="ae-options">
            ${q.options.map(opt => `
              <div class="ae-option" data-value="${opt.value}"
                   onclick="window.aeSelect('${cat.id}','${q.id}',${opt.value},this)">
                <div class="ae-option-radio"></div>
                <div class="ae-option-body">
                  <span class="ae-option-label">${opt.label}</span>
                  <span class="ae-option-desc">${opt.desc}</span>
                </div>
                <span class="ae-option-value">${opt.value}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </section>
  `).join('')

  CATEGORIES.forEach(cat => {
    cat.questions.forEach(q => {
      const v = answers?.[cat.id]?.[q.id]
      if (v != null) markSelected(cat.id, q.id, v)
    })
  })
  refreshProgress()
}

/* ─── Selection ─── */
window.aeSelect = function (catId, qId, value, el) {
  answers[catId] = answers[catId] || {}
  answers[catId][qId] = value

  // Clear siblings within the question, then mark the clicked option
  const qBlock = el.closest('.ae-question')
  qBlock.querySelectorAll('.ae-option').forEach(o => o.classList.remove('selected'))
  el.classList.add('selected')

  refreshProgress()
  store.setAlignment(answers)   // persist incrementally
  saveAlignmentAnswers(answers).catch(err => {
    console.warn('[alignment] server sync skipped:', err.message)
  })
}

function markSelected(catId, qId, value) {
  const qBlock = document.querySelector(`[data-cat="${catId}"] [data-q="${qId}"]`)
  if (!qBlock) return
  const opt = qBlock.querySelector(`.ae-option[data-value="${value}"]`)
  if (opt) opt.classList.add('selected')
}

function answeredCount() {
  let n = 0
  CATEGORIES.forEach(c => c.questions.forEach(q => {
    if (answers?.[c.id]?.[q.id] != null) n++
  }))
  return n
}

function refreshProgress() {
  const done = answeredCount()
  const pct  = Math.round((done / TOTAL_QUESTIONS) * 100)
  progFillEl.style.width   = pct + '%'
  progPctEl.textContent    = pct + '%'
  progTextEl.textContent   = `${done} of ${TOTAL_QUESTIONS} answered`
  submitBtn.disabled       = !isComplete(answers)

  // Mark categories complete (border tint)
  CATEGORIES.forEach(cat => {
    const sec = document.querySelector(`.ae-category[data-cat="${cat.id}"]`)
    if (!sec) return
    const complete = cat.questions.every(q => answers?.[cat.id]?.[q.id] != null)
    sec.classList.toggle('is-complete', complete)
  })
}

/* ─── Submit & render peer scores ─── */
submitBtn.addEventListener('click', async () => {
  if (!isComplete(answers)) return
  store.setAlignment(answers)

  try {
    await saveAlignmentAnswers(answers)
    showToast('Alignment saved to your profile.', '✓')
  } catch (err) {
    console.warn('[alignment] save failed:', err.message)
    showToast('Saved locally — sync to profile failed.', '!')
  }

  peerGridEl.innerHTML = SAMPLE_PEERS.map(peer => {
    const user = store.getUser() || {}
    const viewerDemographics = {
      age: user.age ?? null,
      ageRangeMin: user.ageRangeMin ?? null,
      ageRangeMax: user.ageRangeMax ?? null,
      genderIdentityId: user.genderIdentityId ?? null,
      preferredGenderIds: user.preferredGenderIds ?? [],
      countryCode: user.countryCode ?? null,
      regionCode: user.regionCode ?? null,
      city: user.city ?? null,
    }
    const result = scoreCompatibility(answers, peer.answers, {
      demographicsA: viewerDemographics,
      demographicsB: peer.demographics,
    })
    const isZero = result.zeroedOut
    const overall = isZero
      ? `<div class="ae-peer-score-num">EXCL.</div>
         <div class="ae-peer-score-label">Zero-Out</div>`
      : `<div><span class="ae-peer-score-num">${result.overall}</span><span class="ae-peer-score-sym">%</span></div>
         <div class="ae-peer-score-label">Match</div>`

    const bars = result.breakdown.map(b => `
      <div class="ae-peer-bar-row">
        <span class="ae-peer-bar-label">${b.label}</span>
        <div class="ae-peer-bar-track">
          <div class="ae-peer-bar-fill" style="width:${b.score}%"></div>
        </div>
        <span class="ae-peer-bar-num">${b.score}</span>
      </div>
    `).join('')

    return `
      <div class="ae-peer-card ${isZero ? 'zeroed' : ''}">
        <div class="ae-peer-info">
          <div class="ae-peer-name">${peer.name}</div>
          <div class="ae-peer-role">${peer.role}</div>
          <div class="ae-peer-bars">${bars}</div>
        </div>
        <div class="ae-peer-score">${overall}</div>
      </div>
    `
  }).join('')

  resultsEl.classList.add('visible')
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

renderCategories()
