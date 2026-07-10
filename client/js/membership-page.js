import { requireAuth, initBodyFade, hydrateUser, hydrateSubscription } from './app.js'
import { store } from './store.js'
import { TIER_META } from './membership.js'
import {
  getSessionIdentity,
  subscribe,
  upgradeSubscription,
  downgradeSubscription,
  confirmPendingPayment,
  pollUntilActive,
  fetchSubscription,
} from './subscription.js'

const TIER_ORDER = ['base', 'plus', 'prime']

function renderMembershipPage(tier) {
  const meta = TIER_META[tier] || TIER_META.base
  document.getElementById('currentPlanBadge').textContent = `Current plan: ${meta.name}`
  document.getElementById('topbarTier').textContent = meta.name

  document.querySelectorAll('.mem-card--active').forEach(el => el.classList.remove('mem-card--active'))
  document.getElementById(`card-${tier}`)?.classList.add('mem-card--active')

  renderCta('base', tier)
  renderCta('plus', tier)
  renderCta('prime', tier)
}

/* ─ Render CTAs ─ */
function renderCta(cardTier, currentTier) {
  const el = document.getElementById(`cta-${cardTier}`)
  if (!el) return
  if (cardTier === currentTier) {
    el.innerHTML = `<div class="mem-current-label">✦ &nbsp;Current plan</div>`
    return
  }
  const cardMeta = TIER_META[cardTier]
  const tiers = ['base', 'plus', 'prime']
  const isUpgrade = tiers.indexOf(cardTier) > tiers.indexOf(currentTier)
  if (isUpgrade) {
    el.innerHTML = `<button class="btn btn-gold" style="width:100%;justify-content:center;" onclick="changeTier('${cardTier}')">Upgrade to ${cardMeta.shortName}</button>`
  } else {
    el.innerHTML = `<button class="btn btn-outline-dark" style="width:100%;justify-content:center;" onclick="changeTier('${cardTier}')">Downgrade to ${cardMeta.shortName}</button>`
  }
}

async function bootMembershipPage() {
  requireAuth()
  initBodyFade()
  hydrateUser()
  await hydrateSubscription()
  renderMembershipPage(store.getTier())
  checkPastDueState()
}

bootMembershipPage()

/* ═══════════════════════════════════════════════════════
   Payment modal
   ═══════════════════════════════════════════════════════ */
let _pendingTier     = null
let _expressProvider = null  // 'apple' | 'google' | null (card)

function showPaymentError(err) {
  const message = err?.message || 'Payment could not be completed. Please try again.'
  const el = document.getElementById('payErrorMsg')
  if (el) {
    el.textContent = message
    el.classList.add('visible')
  }
  document.getElementById('paySubmitBtn') && (document.getElementById('paySubmitBtn').disabled = false)
  showPanel('form')
  const toast = document.createElement('div')
  toast.className = 'toast animate-fadeUp'
  toast.style.cssText = 'border-color:rgba(239,68,68,0.30);background:rgba(239,68,68,0.10);'
  toast.innerHTML = `<span style="font-size:16px">⚠</span><span>${message}</span>`
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 5000)
}

async function processSubscriptionPayment() {
  const identity = await getSessionIdentity()
  if (!identity) {
    throw new Error('Sign in with your LEVEL account to subscribe.')
  }

  const currentTier = store.getTier()
  const targetTier = _pendingTier

  if (currentTier === 'plus' && targetTier === 'prime') {
    await upgradeSubscription()
  } else {
    await subscribe(targetTier)
  }

  try {
    await confirmPendingPayment()
  } catch (e) {
    if (e.status !== 404) throw e
  }

  const synced = await pollUntilActive(targetTier)
  store.applySubscriptionSync(synced)
  return synced
}

/* ─ Tier change entry point ─ */
window.changeTier = function(newTier) {
  if (newTier === store.getTier()) return
  const isUpgrade = TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(store.getTier())
  if (isUpgrade) {
    openPayModal(newTier)
  } else {
    const newMeta = TIER_META[newTier]
    if (!confirm(`Downgrade to ${newMeta.name}? You'll lose access to paid features at the end of the billing period.`)) return
    applyTierChange(newTier).catch(showPaymentError)
  }
}

/* ─ Open modal & reset all panels ─ */
window.openPayModal = function(targetTier) {
  _pendingTier     = targetTier
  _expressProvider = null
  const m = TIER_META[targetTier]

  // Update dynamic text
  document.getElementById('payPlanName').textContent = m.name
  document.getElementById('payPlanPrice').innerHTML  =
    `₱${m.price.toLocaleString()}<span style="font-family:var(--font-sans);font-size:0.78rem;color:rgba(255,255,255,0.38);">/mo</span>`
  document.getElementById('payBtnLabel').textContent = `Pay ₱${m.price.toLocaleString()}`
  document.getElementById('paySuccessTitle').textContent = `Welcome to ${m.name}`
  document.getElementById('paySheetAmount').textContent  = `₱${m.price.toLocaleString()}`
  document.getElementById('pstep1Tier').textContent = m.name

  // Reset form inputs
  document.getElementById('payCardName').value   = ''
  document.getElementById('payCardNumber').value = ''
  document.getElementById('payExpiry').value     = ''
  document.getElementById('payCvv').value        = ''
  document.getElementById('payErrorMsg').classList.remove('visible')
  document.querySelectorAll('.pay-input').forEach(i => i.classList.remove('error'))
  document.getElementById('paySubmitBtn').disabled = false

  // Show only the form panel
  showPanel('form')

  // Reset flow steps
  document.querySelectorAll('.pay-flow-step').forEach(s => s.classList.remove('active', 'done'))

  document.getElementById('payModalBackdrop').classList.add('open')
  setTimeout(() => document.getElementById('payCardName').focus(), 100)
}

window.closePayModal = function() {
  document.getElementById('payModalBackdrop').classList.remove('open')
  _pendingTier     = null
  _expressProvider = null
}

/* Close on backdrop / Escape */
document.getElementById('payModalBackdrop').addEventListener('click', function(e) {
  if (e.target === this) window.closePayModal()
})
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') window.closePayModal()
})

/* ─ Panel switcher ─ */
function showPanel(name) {
  document.getElementById('payFormWrap').style.display   = name === 'form'  ? '' : 'none'
  document.getElementById('paySheet').classList.toggle('visible', name === 'sheet')
  document.getElementById('payProcessing').classList.toggle('visible', name === 'processing')
  document.getElementById('paySuccess').classList.toggle('visible', name === 'success')
}

/* ─ Card input formatting ─ */
document.getElementById('payCardNumber').addEventListener('input', function() {
  const v = this.value.replace(/\D/g, '').slice(0, 16)
  this.value = v.match(/.{1,4}/g)?.join(' ') || v
})
document.getElementById('payExpiry').addEventListener('input', function() {
  let v = this.value.replace(/\D/g, '').slice(0, 4)
  if (v.length >= 3) v = v.slice(0, 2) + ' / ' + v.slice(2)
  this.value = v
})
document.getElementById('payCvv').addEventListener('input', function() {
  this.value = this.value.replace(/\D/g, '').slice(0, 4)
})

/* ═══════════════════════════════════════════════════════
   Step 1 → Step 2  (Express: Apple Pay / Google Pay)
   ═══════════════════════════════════════════════════════ */
window.submitExpressPayment = function(provider) {
  _expressProvider = provider

  // Render provider header in the sheet
  const isApple = provider === 'apple'
  document.getElementById('paySheetProvider').innerHTML = isApple
    ? `<div class="pay-sheet-provider-logo">
         <svg width="18" height="22" viewBox="0 0 814 1000" fill="white">
           <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.3-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.5 135.4-317.5 269-317.5 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49.1 189.2-49.1 30.1 0 108.2 2.6 168.2 81.1zm-134.5-162.4c31.3-37.9 53.1-90.8 53.1-143.6 0-7.3-.6-14.6-1.9-20.6-50.4 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 85.2-55.1 139.3 0 8.1 1.3 16.2 1.9 18.8 3.2.6 8.4 1.3 13.6 1.3 44.9 0 100.9-29.2 135.5-71z"/>
         </svg>
         <span style="font-size:1rem;font-weight:600;color:#fff;letter-spacing:0;">Pay</span>
       </div>`
    : `<div class="pay-sheet-provider-logo">
         <svg width="52" height="22" viewBox="0 0 120 48" fill="none">
           <text y="36" font-size="36" font-family="'Product Sans',sans-serif" font-weight="500">
             <tspan fill="#4285F4">G</tspan><tspan fill="#EA4335">o</tspan><tspan fill="#FBBC05">o</tspan><tspan fill="#4285F4">g</tspan><tspan fill="#34A853">l</tspan><tspan fill="#EA4335">e</tspan>
           </text>
         </svg>
         <span style="font-size:0.85rem;font-weight:500;color:rgba(255,255,255,0.6);">Pay</span>
       </div>`

  // Biometric label
  document.getElementById('payBiometricLabel').textContent = isApple
    ? 'Double-click to confirm' : 'Confirm with fingerprint'
  document.getElementById('payBiometricSub').textContent = isApple
    ? 'Authenticate with Face ID to complete payment'
    : 'Touch the sensor to verify and pay'

  // Reset biometric ring state
  const ring = document.getElementById('payBiometricRing')
  ring.classList.remove('scanning', 'authed')

  // Show the sheet (Step 2)
  showPanel('sheet')

  // Auto-trigger biometric scan after 900ms (simulates SDK presenting the sheet)
  setTimeout(() => triggerBiometric(isApple), 900)
}

/* Simulate biometric authentication (Step 3) */
function triggerBiometric(isApple) {
  const ring  = document.getElementById('payBiometricRing')
  const label = document.getElementById('payBiometricLabel')
  const sub   = document.getElementById('payBiometricSub')

  ring.classList.add('scanning')
  label.textContent = isApple ? 'Scanning Face ID…' : 'Reading fingerprint…'
  sub.textContent   = 'Hold still — verifying your identity'

  // After 1.6s — authenticated
  setTimeout(() => {
    ring.classList.remove('scanning')
    ring.classList.add('authed')
    ring.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
    label.textContent = 'Identity verified'
    sub.textContent   = 'Generating encrypted payment token…'

    // After another 1s — token generated, move to processing flow
    setTimeout(() => {
      showPanel('processing')
      runPaymentFlow()
    }, 1000)
  }, 1600)
}

window.cancelSheet = function() {
  showPanel('form')
  _expressProvider = null
}

/* ═══════════════════════════════════════════════════════
   Card payment submission (skips the sheet — card
   already provides credentials; goes straight to flow)
   ═══════════════════════════════════════════════════════ */
window.submitPayment = function() {
  const name   = document.getElementById('payCardName').value.trim()
  const number = document.getElementById('payCardNumber').value.replace(/\s/g, '')
  const expiry = document.getElementById('payExpiry').value.replace(/\s/g, '')
  const cvv    = document.getElementById('payCvv').value.trim()
  let valid = true

  function flag(id) { document.getElementById(id).classList.add('error'); valid = false }
  document.querySelectorAll('.pay-input').forEach(i => i.classList.remove('error'))

  if (!name)                           flag('payCardName')
  if (number.length < 15)              flag('payCardNumber')
  if (!/^\d{2}\/\d{2}$/.test(expiry)) flag('payExpiry')
  if (cvv.length < 3)                  flag('payCvv')

  if (!valid) {
    document.getElementById('payErrorMsg').classList.add('visible')
    return
  }
  document.getElementById('payErrorMsg').classList.remove('visible')
  document.getElementById('paySubmitBtn').disabled = true
  showPanel('processing')
  runPaymentFlow()
}

/* ═══════════════════════════════════════════════════════
   4-step animated payment flow
   Step 1  Initiate Intent        (always shown first)
   Step 2  Present Payment Sheet  (already happened for express; shown for card)
   Step 3  Authorize Payment      (biometric for express; 3DS/card auth for card)
   Step 4  Submit Token to Backend
   ═══════════════════════════════════════════════════════ */
function runPaymentFlow() {
  const isExpress = !!_expressProvider
  const paymentPromise = processSubscriptionPayment()

  const steps = [
    { id: 'pstep-1', delay: 0,    duration: isExpress ? 600  : 800  },
    { id: 'pstep-2', delay: isExpress ? 600  : 800,  duration: isExpress ? 400  : 700  },
    { id: 'pstep-3', delay: isExpress ? 1000 : 1500, duration: isExpress ? 400  : 900  },
    { id: 'pstep-4', delay: isExpress ? 1400 : 2400, duration: isExpress ? 700  : 800  },
  ]

  // For express, mark steps 2 & 3 as already done (they happened in the sheet)
  if (isExpress) {
    setTimeout(() => {
      document.getElementById('pstep-2')?.classList.add('done')
      document.getElementById('pstep-3')?.classList.add('done')
    }, 1050)
  }

  steps.forEach(({ id, delay, duration }, idx) => {
    setTimeout(() => {
      if (idx > 0) {
        document.getElementById(steps[idx - 1].id)?.classList.remove('active')
        document.getElementById(steps[idx - 1].id)?.classList.add('done')
      }
      if (!isExpress || (id !== 'pstep-2' && id !== 'pstep-3')) {
        document.getElementById(id)?.classList.add('active')
      }
    }, delay)

    setTimeout(() => {
      document.getElementById(id)?.classList.remove('active')
      document.getElementById(id)?.classList.add('done')
    }, delay + duration)
  })

  const totalTime = steps[steps.length - 1].delay + steps[steps.length - 1].duration + 400
  setTimeout(async () => {
    try {
      await paymentPromise
      showPanel('success')
      setTimeout(() => finishTierChange(_pendingTier), 1800)
    } catch (err) {
      showPaymentError(err)
    }
  }, totalTime)
}

/* ─ Apply tier & reload after successful server sync ─ */
async function applyTierChange(newTier) {
  const identity = await getSessionIdentity()

  if (identity) {
    await downgradeSubscription(newTier)
    const synced = await fetchSubscription()
    store.applySubscriptionSync(synced)
  } else {
    store.setTier(newTier)
    store.clearPastDue()
  }

  localStorage.removeItem('level_match_cycle')
  window.closePayModal()
  const newMeta = TIER_META[newTier] || TIER_META.base
  const toast = document.createElement('div')
  toast.className = 'toast animate-fadeUp'
  toast.innerHTML = `<span style="font-size:18px">✦</span><span>Plan updated to ${newMeta.name}. Reloading…</span>`
  document.body.appendChild(toast)
  setTimeout(() => window.location.reload(), 1400)
}

function finishTierChange(newTier) {
  store.clearPastDue()
  localStorage.removeItem('level_match_cycle')
  window.closePayModal()
  const newMeta = TIER_META[newTier] || TIER_META.base
  const toast = document.createElement('div')
  toast.className = 'toast animate-fadeUp'
  toast.innerHTML = `<span style="font-size:18px">✦</span><span>Welcome to ${newMeta.name}! Reloading…</span>`
  document.body.appendChild(toast)
  setTimeout(() => window.location.reload(), 1400)
}

/* ═══════════════════════════════════════════════════════
   Error Handling & Subscription Degradation
   ═══════════════════════════════════════════════════════ */

/* ─ Boot: check for existing PAST_DUE state ─ */
function checkPastDueState() {
  const pd = store.getPastDue()
  if (!pd) return

  // Grace period already expired — re-sync from server
  if (Date.now() > pd.gracePeriodEnd) {
    hydrateSubscription().then(() => window.location.reload())
    return
  }

  renderPastDueBanner(pd)
  initGraceCountdown(pd.gracePeriodEnd)
}

function renderPastDueBanner(pd) {
  const banner = document.getElementById('pastDueBanner')
  if (!banner) return
  banner.style.display = ''

  const m = TIER_META[pd.tier]
  document.getElementById('pdPlanName').textContent = m?.name || pd.tier

  // Retry dots
  ;[1, 2, 3].forEach(n => {
    const dot = document.getElementById(`pd-retry-${n}`)
    if (!dot) return
    dot.className = 'retry-dot'
    if (n <= pd.retryCount) dot.classList.add('fail')
    else if (n === pd.retryCount + 1 && pd.retryCount < 3) dot.classList.add('active')
  })

  // Retry label
  const label = document.getElementById('pdRetryLabel')
  if (label) {
    if (pd.retryCount >= 3) {
      label.textContent = 'All retries exhausted — grace period final window'
    } else {
      const hoursLeft = Math.max(0, Math.round((pd.nextRetry - Date.now()) / 3_600_000))
      label.textContent = `Retry ${pd.retryCount} of 3 failed · Next attempt in ${hoursLeft}h`
    }
  }

  // Disable Simulate button while already in PAST_DUE
  const btn = document.getElementById('dgSimBtn')
  if (btn) btn.disabled = true
}

function initGraceCountdown(endTime) {
  const el = document.getElementById('graceCountdown')
  if (!el) return

  function tick() {
    const rem = endTime - Date.now()
    if (rem <= 0) {
      el.textContent = 'Expired'
      el.classList.add('expired')
      hydrateSubscription().then(() => window.location.reload())
      return
    }
    const h = Math.floor(rem / 3_600_000)
    const m = Math.floor((rem % 3_600_000) / 60_000)
    const s = Math.floor((rem % 60_000) / 1000)
    el.textContent =
      String(h).padStart(2, '0') + ':' +
      String(m).padStart(2, '0') + ':' +
      String(s).padStart(2, '0')
    setTimeout(tick, 1000)
  }
  tick()
}

/* ─ Update Payment Method (opens pay modal, clears PAST_DUE on success) ─ */
window.updatePaymentMethod = function() {
  const pd = store.getPastDue()
  if (!pd) return
  openPayModal(pd.tier)
}

/* ─ Manual retry simulation ─ */
window.triggerRetry = function() {
  const pd = store.getPastDue()
  if (!pd) return

  const newCount = pd.retryCount + 1
  if (newCount >= 3) {
    // Final retry — show downgrade
    store.setPastDue({ ...pd, retryCount: newCount, nextRetry: Date.now() })
    renderPastDueBanner({ ...pd, retryCount: newCount })
    showDegradationToast('All retries failed — downgrading to LEVEL Base in 5 seconds…')
    setTimeout(() => {
      store.setTier('base')
      store.clearPastDue()
      window.location.reload()
    }, 5000)
  } else {
    const next = Date.now() + (3 - newCount) * 8 * 3_600_000
    store.setPastDue({ ...pd, retryCount: newCount, nextRetry: next })
    renderPastDueBanner({ ...pd, retryCount: newCount, nextRetry: next })
    showDegradationToast(`Retry ${newCount} of 3 failed — next attempt scheduled`)
  }
}

function showDegradationToast(msg) {
  const t = document.createElement('div')
  t.className = 'toast animate-fadeUp'
  t.style.cssText = 'border-color:rgba(239,68,68,0.30);background:rgba(239,68,68,0.10);'
  t.innerHTML = `<span style="font-size:16px">⚠</span><span>${msg}</span>`
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 4000)
}

/* ─ Simulate a payment failure (demo trigger) ─ */
window.simulatePaymentFailure = function() {
  const currentTier = store.getTier()
  if (currentTier === 'base') {
    showDegradationToast('Upgrade to Plus or Prime first to simulate a billing failure.')
    return
  }

  const btn = document.getElementById('dgSimBtn')
  if (btn) btn.disabled = true

  // Set PAST_DUE state — 24h grace from now (use short window for demo clarity)
  const gracePeriodEnd = Date.now() + 24 * 3_600_000
  const nextRetry      = Date.now() + 8  * 3_600_000
  store.setPastDue({ tier: currentTier, gracePeriodEnd, retryCount: 0, nextRetry })

  runDegradationFlow(currentTier, gracePeriodEnd)
}

/* ─ Animated 4-step degradation flow ─ */
function runDegradationFlow(tier, gracePeriodEnd) {
  const m      = TIER_META[tier]
  const payId  = 'pay_' + Math.random().toString(36).slice(2, 10)
  const userId = 'usr_' + Math.random().toString(36).slice(2, 10)

  // Reset all steps
  ;[1, 2, 3, 4].forEach(n => {
    const s = document.getElementById(`dg-step-${n}`)
    if (s) s.classList.remove('active', 'done', 'fail', 'past-due')
    const d = document.getElementById(`dg-detail-${n}`)
    if (d) d.innerHTML = ''
  })

  // ─ Step 1: Payment Failure Event (t=400ms) ─
  setTimeout(() => {
    const s = document.getElementById('dg-step-1')
    if (s) s.classList.add('active')
    document.getElementById('dg-detail-1').innerHTML =
      `<span style="color:rgba(255,255,255,0.28)">// Webhook received from payment gateway</span>\n` +
      `<span style="color:#FCA5A5">POST</span> /webhooks/paymongo\n` +
      `{\n` +
      `  <span style="color:#7DD3FC">"event"</span>:   <span style="color:#FCA5A5">"charge.failed"</span>,\n` +
      `  <span style="color:#7DD3FC">"reason"</span>:  <span style="color:#FCA5A5">"insufficient_funds"</span>,\n` +
      `  <span style="color:#7DD3FC">"amount"</span>:  <span style="color:#FCD34D">${m.price * 100}</span>,\n` +
      `  <span style="color:#7DD3FC">"pay_id"</span>:  <span style="color:#86EFAC">"${payId}"</span>,\n` +
      `  <span style="color:#7DD3FC">"user_id"</span>: <span style="color:#86EFAC">"${userId}"</span>\n` +
      `}\n` +
      `<span style="color:#FCA5A5">✗ Charge capture failed — funds unavailable</span>`
  }, 400)

  // ─ Step 1 → Step 2: PAST_DUE Transition (t=1700ms) ─
  setTimeout(() => {
    document.getElementById('dg-step-1')?.classList.replace('active', 'fail')

    const s = document.getElementById('dg-step-2')
    if (s) s.classList.add('active')
    document.getElementById('dg-detail-2').innerHTML =
      `<span style="color:rgba(255,255,255,0.28)">// Updating subscription ledger state</span>\n` +
      `<span style="color:#7DD3FC">UPDATE</span> subscriptions\n` +
      `  <span style="color:#7DD3FC">SET</span>\n` +
      `    status           = <span style="color:#FBBF24">'past_due'</span>,\n` +
      `    failure_count    = 1,\n` +
      `    grace_period_end = NOW() + INTERVAL <span style="color:#FCD34D">'24 hours'</span>\n` +
      `  <span style="color:#7DD3FC">WHERE</span> user_id = <span style="color:#86EFAC">'${userId}'</span>\n\n` +
      `<span style="color:#FBBF24">→ 1 row updated · Status: PAST_DUE</span>\n` +
      `<span style="color:rgba(255,255,255,0.28)">  Premium features remain active · Grace window open</span>`
  }, 1700)

  // ─ Step 2 → Step 3: Grace Period / Retry Loop (t=3100ms) ─
  setTimeout(() => {
    document.getElementById('dg-step-2')?.classList.replace('active', 'past-due')

    const s = document.getElementById('dg-step-3')
    if (s) s.classList.add('active')
    document.getElementById('dg-detail-3').innerHTML =
      `<span style="color:rgba(255,255,255,0.28)">// Scheduler queuing automated retries</span>\n` +
      `retry_schedule = [\n` +
      `  { at: <span style="color:#7DD3FC">+8h</span>,  attempt: <span style="color:#FCD34D">1</span>, status: <span style="color:#FCA5A5">"failed"</span>  },\n` +
      `  { at: <span style="color:#7DD3FC">+16h</span>, attempt: <span style="color:#FCD34D">2</span>, status: <span style="color:#FCA5A5">"failed"</span>  },\n` +
      `  { at: <span style="color:#7DD3FC">+24h</span>, attempt: <span style="color:#FCD34D">3</span>, status: <span style="color:#FBBF24">"pending"</span> },\n` +
      `]\n\n` +
      `<span style="color:#86EFAC">✓ Grace period active — 24h window open</span>\n` +
      `<span style="color:rgba(255,255,255,0.28)">  Features: unlimited matches, messaging, radius</span>`
  }, 3100)

  // ─ Step 3 → Step 4: Auto-Downgrade (t=5000ms) ─
  setTimeout(() => {
    document.getElementById('dg-step-3')?.classList.replace('active', 'fail')

    const s = document.getElementById('dg-step-4')
    if (s) s.classList.add('active')
    document.getElementById('dg-detail-4').innerHTML =
      `<span style="color:rgba(255,255,255,0.28)">// Final retry exhausted — downgrading account</span>\n` +
      `<span style="color:#7DD3FC">UPDATE</span> users\n` +
      `  <span style="color:#7DD3FC">SET</span>\n` +
      `    tier                = <span style="color:#86EFAC">'base'</span>,\n` +
      `    subscription_status = <span style="color:#FCA5A5">'inactive'</span>,\n` +
      `    downgraded_at       = NOW()\n` +
      `  <span style="color:#7DD3FC">WHERE</span> user_id = <span style="color:#86EFAC">'${userId}'</span>\n\n` +
      `<span style="color:rgba(255,255,255,0.28)">Restrictions applied:</span>\n` +
      `  <span style="color:#FCA5A5">✗ Geographic scope  → local only</span>\n` +
      `  <span style="color:#FCA5A5">✗ Messaging         → 5 threads max</span>\n` +
      `  <span style="color:#FCA5A5">✗ Queue priority    → removed</span>\n` +
      `  <span style="color:#FCA5A5">✗ Radius            → metro only</span>`
  }, 5000)

  // ─ Step 4 done, show PAST_DUE banner (t=6800ms) ─
  setTimeout(() => {
    document.getElementById('dg-step-4')?.classList.replace('active', 'fail')

    // Show the alert banner with current state
    const pd = store.getPastDue()
    if (pd) {
      renderPastDueBanner({ ...pd, retryCount: 0 })
      initGraceCountdown(pd.gracePeriodEnd)
    }
  }, 6800)
}

// Run PAST_DUE check after boot completes (boot also calls this)
