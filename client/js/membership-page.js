import { requireAuth, initBodyFade, hydrateUser, hydrateSubscription } from './app.js'
import { store } from './store.js'
import { TIER_META } from './membership.js'
import {
  getSessionIdentity,
  subscribe,
  upgradeSubscription,
  downgradeSubscription,
  cancelScheduledDowngrade,
  confirmPendingPayment,
  pollUntilActive,
  fetchSubscription,
  retryCharge,
} from './subscription.js'
import { bootPageLoader, finishPageLoader } from './loading.js'

const TIER_ORDER = ['base', 'plus', 'prime']
let _pendingDowngradeTier = null

function formatPeriodEnd(iso) {
  if (!iso) return 'the end of your billing period'
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'the end of your billing period'
  }
}

function getSubscription() {
  return store.getUser()?.subscription || null
}

function renderMembershipPage(tier) {
  const meta = TIER_META[tier] || TIER_META.base
  const sub = getSubscription()
  const periodLabel = sub?.currentPeriodEnd
    ? formatPeriodEnd(sub.currentPeriodEnd)
    : null

  document.getElementById('currentPlanBadge').textContent = periodLabel
    ? `Current plan: ${meta.name} · Renews ${periodLabel}`
    : `Current plan: ${meta.name}`
  document.getElementById('topbarTier').textContent = meta.name

  document.querySelectorAll('.mem-card--active').forEach(el => el.classList.remove('mem-card--active'))
  document.getElementById(`card-${tier}`)?.classList.add('mem-card--active')

  renderScheduledBanner(sub)
  renderCta('base', tier, sub)
  renderCta('plus', tier, sub)
  renderCta('prime', tier, sub)
}

function renderScheduledBanner(sub) {
  const banner = document.getElementById('scheduledDowngradeBanner')
  if (!banner) return

  if (!sub?.scheduledTier) {
    banner.style.display = 'none'
    return
  }

  const target = TIER_META[sub.scheduledTier] || TIER_META.base
  const when = formatPeriodEnd(sub.currentPeriodEnd)
  banner.style.display = ''
  document.getElementById('scheduledDowngradeText').textContent =
    `Downgrade to ${target.name} is scheduled for ${when}. You keep your current plan until then.`
}

function isPaidTier(tier) {
  return tier === 'plus' || tier === 'prime'
}

/** True while the paid billing window is still active (before currentPeriodEnd). */
function isCurrentPeriodActive(sub, tier = store.getTier()) {
  if (!isPaidTier(tier)) return false
  if (!sub?.currentPeriodEnd) return false
  return new Date(sub.currentPeriodEnd).getTime() > Date.now()
}

/* ─ Render CTAs ─ */
function renderCta(cardTier, currentTier, sub = getSubscription()) {
  const el = document.getElementById(`cta-${cardTier}`)
  if (!el) return
  if (cardTier === currentTier) {
    el.innerHTML = `<div class="mem-current-label">✦ &nbsp;Current plan</div>`
    return
  }

  const cardMeta = TIER_META[cardTier]
  const isUpgrade = TIER_ORDER.indexOf(cardTier) > TIER_ORDER.indexOf(currentTier)
  const periodLocked = isCurrentPeriodActive(sub, currentTier)
  const when = formatPeriodEnd(sub?.currentPeriodEnd)

  if (isUpgrade) {
    // Base → paid is always allowed. Paid → higher only after period ends.
    if (periodLocked) {
      el.innerHTML = `<div class="mem-current-label">Upgrade available after ${when}</div>`
      return
    }
    el.innerHTML = `<button class="btn btn-gold" style="width:100%;justify-content:center;" onclick="changeTier('${cardTier}')">Upgrade to ${cardMeta.shortName}</button>`
    return
  }

  // Downgrade only after current paid period ends.
  if (periodLocked) {
    el.innerHTML = `<div class="mem-current-label">Downgrade available after ${when}</div>`
    return
  }

  el.innerHTML = `<button class="btn btn-outline" style="width:100%;justify-content:center;" onclick="changeTier('${cardTier}')">Downgrade to ${cardMeta.shortName}</button>`
}

async function bootMembershipPage() {
  bootPageLoader('Loading membership')
  try {
    requireAuth()
    initBodyFade()
    hydrateUser()
    await hydrateSubscription()
    renderMembershipPage(store.getTier())
    checkPastDueState()
  } finally {
    finishPageLoader()
  }
  // Run after the loader so payment confirmation never blocks the page.
  await handlePaymentReturn()
}

bootMembershipPage()

function showPaymentError(err) {
  const message = err?.message
    || err?.body?.message
    || 'Payment could not be completed. Please try again.'
  showPaymentToast(message, { error: true })
}

function showPaymentToast(message, { error = false } = {}) {
  document.querySelectorAll('.toast.payment-toast').forEach(t => t.remove())
  const toast = document.createElement('div')
  toast.className = 'toast animate-fadeUp payment-toast'
  if (error) {
    toast.style.cssText = 'border-color:rgba(239,68,68,0.30);background:rgba(239,68,68,0.10);'
  }
  toast.innerHTML =
    `<span style="font-size:18px">${error ? '⚠' : '✦'}</span>` +
    `<span style="flex:1">${message}</span>` +
    `<button type="button" aria-label="Dismiss" style="background:transparent;border:0;color:inherit;opacity:0.7;cursor:pointer;font-size:16px;line-height:1;padding:0 0 0 8px;">✕</button>`
  const dismiss = () => toast.remove()
  toast.querySelector('button')?.addEventListener('click', dismiss)
  document.body.appendChild(toast)
  setTimeout(dismiss, error ? 8000 : 4000)
}

function clearPaymentQuery() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('payment')) return
  url.searchParams.delete('payment')
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}

function isPaidActive(data) {
  return Boolean(
    data?.tier
    && data.tier !== 'base'
    && data.subscription?.status === 'active'
  )
}

/**
 * After PayMongo redirects back to membership.html?payment=success|cancelled.
 * Polls briefly for the webhook, then falls back to the local confirm endpoint
 * (available when ALLOW_DEV_PAYMENT_CONFIRM=true) so localhost works without ngrok.
 */
async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search)
  const payment = params.get('payment')
  if (!payment) return

  if (payment === 'cancelled') {
    clearPaymentQuery()
    showPaymentToast('Payment cancelled. Your plan was not changed.', { error: true })
    return
  }

  if (payment !== 'success') return

  showPaymentToast('Confirming payment…')

  try {
    let synced = await fetchSubscription()

    // Short wait for a real webhook (production / public API).
    if (!isPaidActive(synced)) {
      try {
        const current = synced.tier && synced.tier !== 'base' ? synced.tier : null
        if (current) {
          synced = await pollUntilActive(current, { maxAttempts: 5, intervalMs: 800 })
        } else {
          synced = await pollUntilPaidTier({ maxAttempts: 5, intervalMs: 800 })
        }
      } catch {
        // Webhook may not reach localhost — try dev confirm next.
      }
    }

    // Local/dev fallback: simulate the PayMongo webhook.
    if (!isPaidActive(synced)) {
      try {
        await confirmPendingPayment()
        synced = await fetchSubscription()
      } catch (e) {
        if (e.status && e.status !== 404) throw e
      }
    }

    if (!isPaidActive(synced)) {
      try {
        synced = await pollUntilPaidTier({ maxAttempts: 5, intervalMs: 600 })
      } catch {
        /* fall through */
      }
    }

    clearPaymentQuery()

    if (!isPaidActive(synced)) {
      showPaymentToast(
        'Payment received, but your plan is still pending. Wait a moment and refresh — the webhook may not have reached the server yet.',
        { error: true }
      )
      return
    }

    store.applySubscriptionSync(synced)
    renderMembershipPage(synced.tier)
    const newMeta = TIER_META[synced.tier] || TIER_META.base
    showPaymentToast(`Welcome to ${newMeta.name}! Reloading…`)
    setTimeout(() => window.location.assign('/membership.html'), 1000)
  } catch (err) {
    clearPaymentQuery()
    showPaymentToast(
      err?.message || 'Payment received — refresh in a moment if your plan has not updated.',
      { error: true }
    )
  }
}

async function pollUntilPaidTier({ maxAttempts = 8, intervalMs = 800 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await fetchSubscription()
    if (isPaidActive(data)) return data
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error('Payment confirmation timed out. Please refresh in a moment.')
}

function setUpgradeButtonsBusy(busy) {
  document.querySelectorAll('[id^="cta-"] button').forEach(btn => {
    btn.disabled = busy
    if (busy) btn.textContent = 'Redirecting to PayMongo…'
  })
}

/** Client-side tier change rules.
 *  - Base → Plus/Prime: anytime
 *  - Paid upgrade / downgrade: only after currentPeriodEnd
 */
function validateTierChange(targetTier) {
  const currentTier = store.getTier()
  const sub = getSubscription()
  const currentMeta = TIER_META[currentTier] || TIER_META.base
  const targetMeta = TIER_META[targetTier] || TIER_META.base
  const fromIdx = TIER_ORDER.indexOf(currentTier)
  const toIdx = TIER_ORDER.indexOf(targetTier)
  const when = formatPeriodEnd(sub?.currentPeriodEnd)

  if (!TIER_ORDER.includes(targetTier)) {
    return { ok: false, message: 'That membership plan is not available.' }
  }

  if (toIdx === fromIdx) {
    return { ok: false, message: `You're already on ${currentMeta.name}.` }
  }

  if (sub?.status === 'pending') {
    return {
      ok: false,
      message: 'You have a pending payment. Finish PayMongo checkout or wait for confirmation before changing plans.',
    }
  }

  const isUpgrade = toIdx > fromIdx
  const isDowngrade = toIdx < fromIdx
  const periodLocked = isCurrentPeriodActive(sub, currentTier)

  if (isUpgrade) {
    if (!(
      (currentTier === 'base' && (targetTier === 'plus' || targetTier === 'prime'))
      || (currentTier === 'plus' && targetTier === 'prime')
    )) {
      return {
        ok: false,
        message: `You can't upgrade from ${currentMeta.name} to ${targetMeta.name}.`,
      }
    }

    // Paid plan still active — must wait until it expires.
    if (periodLocked) {
      return {
        ok: false,
        message: `You can upgrade to ${targetMeta.name} only after your current ${currentMeta.name} plan ends on ${when}.`,
      }
    }

    return { ok: true, direction: 'upgrade', currentTier, targetTier }
  }

  if (isDowngrade) {
    if (!(
      (currentTier === 'prime' && (targetTier === 'plus' || targetTier === 'base'))
      || (currentTier === 'plus' && targetTier === 'base')
    )) {
      return {
        ok: false,
        message: `You can't move from ${currentMeta.name} down to ${targetMeta.name}.`,
      }
    }

    if (!sub?.currentPeriodEnd) {
      return {
        ok: false,
        message: 'Your billing period end date is missing. Refresh the page, then try again.',
      }
    }

    if (periodLocked) {
      return {
        ok: false,
        message: `You can downgrade to ${targetMeta.name} only after your current ${currentMeta.name} plan ends on ${when}.`,
      }
    }

    return { ok: true, direction: 'downgrade', currentTier, targetTier }
  }

  return { ok: false, message: 'Invalid plan change.' }
}

/** Create PayMongo checkout and redirect — no in-app payment modal. */
async function startPayMongoCheckout(targetTier) {
  const check = validateTierChange(targetTier)
  if (!check.ok || check.direction !== 'upgrade') {
    throw new Error(check.message || 'This upgrade is not allowed.')
  }

  const identity = await getSessionIdentity()
  if (!identity) {
    throw new Error('Sign in with your LEVEL account to subscribe.')
  }

  const currentTier = store.getTier()
  const meta = TIER_META[targetTier] || TIER_META.plus
  showPaymentToast(`Opening PayMongo checkout for ${meta.name}…`)
  setUpgradeButtonsBusy(true)

  try {
    let result
    if (currentTier === 'plus' && targetTier === 'prime') {
      result = await upgradeSubscription()
    } else if (currentTier === 'base' && (targetTier === 'plus' || targetTier === 'prime')) {
      result = await subscribe(targetTier)
    } else {
      throw new Error(`Upgrade from ${currentTier} to ${targetTier} is not supported.`)
    }

    if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl
      return
    }

    // Zero-charge upgrade (full pro-rata credit) — already active.
    if (result.status === 'active') {
      const synced = await fetchSubscription()
      store.applySubscriptionSync(synced)
      finishTierChange(targetTier)
      return
    }

    throw new Error(result.message || 'Checkout URL was not returned. Please try again.')
  } catch (err) {
    setUpgradeButtonsBusy(false)
    renderMembershipPage(store.getTier())
    throw err
  }
}

/* ─ Tier change entry point ─ */
window.changeTier = function(newTier) {
  const check = validateTierChange(newTier)
  if (!check.ok) {
    showPaymentError({ message: check.message })
    return
  }

  if (check.direction === 'upgrade') {
    startPayMongoCheckout(newTier).catch(showPaymentError)
    return
  }

  openDowngradeConfirm(newTier)
}

function openDowngradeConfirm(targetTier) {
  const check = validateTierChange(targetTier)
  if (!check.ok || check.direction !== 'downgrade') {
    showPaymentError({ message: check.message || 'This downgrade is not allowed.' })
    return
  }

  const currentMeta = TIER_META[store.getTier()] || TIER_META.base
  const targetMeta = TIER_META[targetTier] || TIER_META.base

  _pendingDowngradeTier = targetTier
  document.getElementById('downgradeConfirmTitle').textContent = `Downgrade to ${targetMeta.name}?`
  document.getElementById('downgradeConfirmBody').innerHTML =
    `Your <strong>${currentMeta.name}</strong> billing period has ended.<br><br>` +
    `Confirm to switch to <strong>${targetMeta.name}</strong> now.`
  document.getElementById('downgradeConfirmBackdrop').classList.add('open')
}

window.closeDowngradeConfirm = function() {
  document.getElementById('downgradeConfirmBackdrop')?.classList.remove('open')
  _pendingDowngradeTier = null
}

document.getElementById('downgradeConfirmBackdrop')?.addEventListener('click', (e) => {
  if (e.target?.id === 'downgradeConfirmBackdrop') window.closeDowngradeConfirm()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.closeDowngradeConfirm()
})

window.confirmDowngrade = function() {
  const targetTier = _pendingDowngradeTier
  if (!targetTier) return
  const btn = document.getElementById('downgradeConfirmOk')
  if (btn) btn.disabled = true
  applyTierChange(targetTier)
    .catch(showPaymentError)
    .finally(() => {
      if (btn) btn.disabled = false
      window.closeDowngradeConfirm()
    })
}

window.cancelScheduledDowngradeClick = function() {
  cancelScheduledDowngrade()
    .then(async (body) => {
      store.applySubscriptionSync(body)
      renderMembershipPage(store.getTier())
      showPaymentToast(body.message || 'Scheduled downgrade cancelled.')
    })
    .catch(showPaymentError)
}

/* ─ Apply scheduled downgrade ─ */
async function applyTierChange(newTier) {
  const identity = await getSessionIdentity()

  if (identity) {
    const result = await downgradeSubscription(newTier)
    store.applySubscriptionSync(result)
    renderMembershipPage(store.getTier())
    showPaymentToast(result.message || `Downgrade to ${TIER_META[newTier]?.name || newTier} scheduled.`)
    return
  }

  store.setTier(newTier)
  store.clearPastDue()
  localStorage.removeItem('level_match_cycle')
  const newMeta = TIER_META[newTier] || TIER_META.base
  showPaymentToast(`Plan updated to ${newMeta.name}. Reloading…`)
  setTimeout(() => window.location.reload(), 1400)
}

function finishTierChange(newTier) {
  store.clearPastDue()
  localStorage.removeItem('level_match_cycle')
  const newMeta = TIER_META[newTier] || TIER_META.base
  showPaymentToast(`Welcome to ${newMeta.name}! Reloading…`)
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

/* ─ Update Payment Method — PayMongo checkout for past_due retry ─ */
window.updatePaymentMethod = async function() {
  const pd = store.getPastDue()
  if (!pd) return

  try {
    const synced = await fetchSubscription()
    const subscriptionId = synced.subscription?.id
    if (!subscriptionId) {
      throw new Error('No past-due subscription found to update.')
    }
    showPaymentToast('Opening PayMongo checkout…')
    const result = await retryCharge(subscriptionId)
    if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl
      return
    }
    throw new Error(result.message || 'Checkout URL was not returned.')
  } catch (err) {
    showPaymentError(err)
  }
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
