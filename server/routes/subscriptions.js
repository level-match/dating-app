const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { requireIdempotencyKey } = require('../middleware/idempotency')
const { attachSupabaseIdentity } = require('../middleware/subscription-auth')
const svc  = require('../services/subscription.service')
const paymongo = require('../services/paymongo.service')
const { TIER_PRICE_CENTAVOS } = require('../utils/prorate')
const pool = require('../db/pool')

const router = express.Router()

router.use(attachSupabaseIdentity)
router.use(['/subscribe', '/upgrade', '/charge', '/subscription/confirm'], requireIdempotencyKey)

function paymongoErrorResponse(res, err) {
  if (err.code === 'PAYMONGO_NOT_CONFIGURED' || err.code === 'INVALID_AMOUNT') {
    return res.status(500).json({ error: err.code, message: err.message })
  }
  if (err.code === 'PAYMONGO_ERROR') {
    return res.status(502).json({ error: 'PAYMONGO_ERROR', message: err.message })
  }
  throw err
}

function formatSubscriptionPayload(sub) {
  if (!sub) return { tier: 'base', subscription: null }
  return {
    tier: sub.tier,
    subscription: {
      id:               sub.id,
      status:           sub.status,
      currentPeriodEnd: sub.current_period_end,
      gracePeriodEnd:   sub.grace_period_end,
      retryCount:       sub.retry_count,
      scheduledTier:    sub.scheduled_tier || null,
    },
  }
}

async function resolveAuthUserId(req) {
  if (req.auth.userId) return req.auth.userId
  return svc.resolveUser(null, {
    externalId: req.auth.externalId,
    email: req.auth.email,
  })
}

/* ─── POST /api/subscribe ───────────────────────────────────────
   Initiates a subscription for the authenticated user.
   Creates a PayMongo Checkout Session and stores the subscription as
   'pending'. Entitlements are unlocked ONLY by the webhook (or dev confirm). */
router.post('/subscribe', async (req, res) => {
  const { tier } = req.body

  if (!['plus', 'prime'].includes(tier)) {
    return res.status(400).json({ error: 'INVALID_TIER', message: 'tier must be "plus" or "prime".' })
  }

  const userId = await resolveAuthUserId(req)

  const existing = await svc.getActiveSubscription(userId)
  if (existing?.status === 'pending') {
    return res.status(409).json({
      error: 'PAYMENT_PENDING',
      message: 'You have a pending payment. Finish PayMongo checkout before starting another plan.',
    })
  }

  if (existing && !(existing.tier === 'base' && existing.status === 'active')) {
    if (existing.tier === tier) {
      return res.status(409).json({
        error: 'ALREADY_ON_TIER',
        message: `You are already on LEVEL ${tier === 'prime' ? 'Prime' : 'Plus'}.`,
      })
    }
    if (existing.tier === 'plus' && tier === 'prime') {
      return res.status(400).json({
        error: 'USE_UPGRADE',
        message: 'To move from Plus to Prime, use the upgrade flow (pro-rated charge).',
      })
    }
    return res.status(409).json({
      error:   'DUPLICATE_SUBSCRIPTION',
      message: `You already have an active ${existing.tier} plan. Downgrade or wait for the period to end before changing this way.`,
      current: { id: existing.id, tier: existing.tier, status: existing.status },
    })
  }

  const amountCentavos = TIER_PRICE_CENTAVOS[tier]
  const referenceNumber = `level_sub_${uuidv4().replace(/-/g, '').slice(0, 20)}`
  const tierLabel = tier === 'prime' ? 'LEVEL Prime' : 'LEVEL Plus'

  let session
  try {
    session = await paymongo.createCheckoutSession({
      amountCentavos,
      description: `${tierLabel} — monthly membership`,
      referenceNumber,
      metadata: { user_id: userId, tier, flow: 'subscribe' },
    })
  } catch (err) {
    return paymongoErrorResponse(res, err)
  }

  const subscription = await svc.createSubscription({
    userId,
    tier,
    idempotencyKey:     req.idempotencyKey,
    provider:           'paymongo',
    providerPaymentId:  session.id,
    providerCustomerId: null,
  })

  res.status(202).json({
    subscriptionId:    subscription.id,
    providerPaymentId: session.id,
    status:            'pending',
    checkoutUrl:       session.checkoutUrl,
    message:           'Redirect to PayMongo checkout. Entitlements activate upon confirmed webhook.',
  })
})

/* ─── POST /api/upgrade ─────────────────────────────────────────
   Upgrades an active Plus subscription to Prime mid-cycle. */
router.post('/upgrade', async (req, res) => {
  const userId = await resolveAuthUserId(req)

  const current = await svc.getActiveSubscription(userId)

  if (!current) {
    return res.status(400).json({
      error: 'INVALID_UPGRADE_PATH',
      message: 'No active subscription found. Subscribe to Plus first, then upgrade to Prime.',
    })
  }

  if (current.status === 'pending') {
    return res.status(409).json({
      error: 'PAYMENT_PENDING',
      message: 'You have a pending payment. Finish PayMongo checkout before changing plans.',
    })
  }

  if (current.tier === 'prime') {
    return res.status(409).json({
      error: 'ALREADY_ON_TIER',
      message: 'You are already on LEVEL Prime.',
    })
  }

  if (current.tier === 'base') {
    return res.status(400).json({
      error: 'INVALID_UPGRADE_PATH',
      message: 'Base members should subscribe to Plus or Prime first (not mid-cycle upgrade).',
    })
  }

  if (current.tier !== 'plus' || !['active', 'past_due'].includes(current.status)) {
    return res.status(400).json({
      error: 'INVALID_UPGRADE_PATH',
      message: `Plus → Prime upgrade requires an active Plus plan. Current: ${current.tier} (${current.status}).`,
    })
  }

  const periodEndMs = new Date(current.current_period_end).getTime()
  if (Number.isFinite(periodEndMs) && periodEndMs > Date.now()) {
    return res.status(409).json({
      error: 'PERIOD_NOT_ENDED',
      message: `You can upgrade to Prime only after your Plus plan ends on ${new Date(current.current_period_end).toLocaleDateString('en-PH', { dateStyle: 'medium' })}.`,
      currentPeriodEnd: current.current_period_end,
    })
  }

  const { calculateProRata } = require('../utils/prorate')
  const proratePreview = calculateProRata('plus', 'prime', current.current_period_end)

  // Full credit covers Prime — activate without charging PayMongo.
  if (proratePreview.chargeCentavos <= 0) {
    const providerPaymentId = `pm_credit_${uuidv4().replace(/-/g, '').slice(0, 16)}`
    const { subscription, prorate } = await svc.initiateUpgrade({
      userId,
      idempotencyKey: req.idempotencyKey,
      provider: 'paymongo',
      providerPaymentId,
    })
    const activated = await svc.activateSubscription({
      subscriptionId: subscription.id,
      providerPaymentId,
    })
    return res.json({
      subscriptionId: activated.id,
      providerPaymentId,
      status: 'active',
      checkoutUrl: null,
      prorate: {
        remainingDays:  prorate.remainingDays,
        creditApplied:  `PHP ${(prorate.creditCentavos / 100).toFixed(2)}`,
        netCharge:      'PHP 0.00',
        chargeCentavos: 0,
      },
      message: 'Upgrade applied with pro-rata credit. No payment required.',
    })
  }

  const referenceNumber = `level_upg_${uuidv4().replace(/-/g, '').slice(0, 20)}`
  let session
  try {
    session = await paymongo.createCheckoutSession({
      amountCentavos: proratePreview.chargeCentavos,
      description: 'LEVEL Plus → Prime upgrade (pro-rated)',
      referenceNumber,
      metadata: {
        user_id: userId,
        subscription_id: current.id,
        tier: 'prime',
        flow: 'upgrade',
      },
    })
  } catch (err) {
    return paymongoErrorResponse(res, err)
  }

  const { subscription, prorate } = await svc.initiateUpgrade({
    userId,
    idempotencyKey:    req.idempotencyKey,
    provider:          'paymongo',
    providerPaymentId: session.id,
  })

  res.status(202).json({
    subscriptionId:    subscription.id,
    providerPaymentId: session.id,
    checkoutUrl:       session.checkoutUrl,
    prorate: {
      remainingDays:  prorate.remainingDays,
      creditApplied:  `PHP ${(prorate.creditCentavos  / 100).toFixed(2)}`,
      netCharge:      `PHP ${(prorate.chargeCentavos   / 100).toFixed(2)}`,
      chargeCentavos: prorate.chargeCentavos,
    },
    status:  'pending',
    message: 'Redirect to PayMongo checkout. Prime activates upon confirmed webhook.',
  })
})

/* ─── POST /api/charge ──────────────────────────────────────────
   Manual retry charge for a PAST_DUE subscription. */
router.post('/charge', async (req, res) => {
  const { subscriptionId } = req.body

  if (!subscriptionId) {
    return res.status(400).json({
      error: 'MISSING_FIELDS', message: 'subscriptionId is required.',
    })
  }

  const userId = await resolveAuthUserId(req)

  const result = await pool.query(
    `SELECT s.id, s.tier, s.status, s.retry_count
     FROM subscriptions s
     WHERE s.id = $1 AND s.user_id = $2 AND s.status = 'past_due'`,
    [subscriptionId, userId]
  )

  if (!result.rows.length) {
    return res.status(404).json({
      error: 'NOT_FOUND', message: 'No past-due subscription found for this account.',
    })
  }

  const sub = result.rows[0]
  const amountCentavos = TIER_PRICE_CENTAVOS[sub.tier]
  const referenceNumber = `level_retry_${uuidv4().replace(/-/g, '').slice(0, 18)}`

  let session
  try {
    session = await paymongo.createCheckoutSession({
      amountCentavos,
      description: `LEVEL ${sub.tier} — payment retry`,
      referenceNumber,
      metadata: {
        user_id: userId,
        subscription_id: subscriptionId,
        tier: sub.tier,
        flow: 'retry',
      },
    })
  } catch (err) {
    return paymongoErrorResponse(res, err)
  }

  await pool.query(
    `INSERT INTO payment_ledger
       (user_id, subscription_id, type, amount_centavos, description,
        provider, provider_payment_id, idempotency_key, status)
     VALUES ($1, $2, 'retry_charge', $3, $4, 'paymongo', $5, $6, 'pending')`,
    [
      userId,
      subscriptionId,
      amountCentavos,
      `Manual retry charge — retry #${sub.retry_count + 1}`,
      session.id,
      req.idempotencyKey,
    ]
  )

  res.status(202).json({
    subscriptionId,
    providerPaymentId: session.id,
    checkoutUrl:       session.checkoutUrl,
    status:  'pending',
    message: 'Redirect to PayMongo checkout. Entitlement restored upon webhook confirmation.',
  })
})

/* ─── POST /api/subscription/confirm ────────────────────────────
   Development-only: simulates PayMongo payment.paid webhook.
   In production, entitlements unlock exclusively via verified webhooks. */
router.post('/subscription/confirm', async (req, res) => {
  const allowDev = process.env.NODE_ENV !== 'production'
    || process.env.ALLOW_DEV_PAYMENT_CONFIRM === 'true'

  if (!allowDev) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not available.' })
  }

  const userId = await resolveAuthUserId(req)

  const pending = await pool.query(
    `SELECT s.id AS subscription_id, pl.provider_payment_id
     FROM subscriptions s
     JOIN payment_ledger pl
       ON pl.subscription_id = s.id
      AND pl.status = 'pending'
      AND pl.type IN ('initial_charge', 'upgrade_charge', 'retry_charge')
     WHERE s.user_id = $1
       AND (
         s.status = 'pending'
         OR (s.status = 'active' AND pl.type = 'upgrade_charge')
       )
     ORDER BY pl.created_at DESC
     LIMIT 1`,
    [userId]
  )

  if (!pending.rows.length) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: 'No pending subscription payment found for this account.',
    })
  }

  const { subscription_id: subscriptionId, provider_payment_id: providerPaymentId } = pending.rows[0]
  const sub = await svc.activateSubscription({ subscriptionId, providerPaymentId })

  res.json({
    tier: sub.tier,
    subscription: {
      id:               sub.id,
      status:           sub.status,
      currentPeriodEnd: sub.current_period_end,
      gracePeriodEnd:   sub.grace_period_end,
      retryCount:       sub.retry_count,
    },
    message: 'Payment confirmed (development). Subscription is now active.',
  })
})

/* ─── GET /api/subscription ─────────────────────────────────────
   Sync local tier with authoritative server state. */
router.get('/subscription', async (req, res) => {
  if (!req.auth.userId) {
    return res.json({ tier: 'base', subscription: null })
  }

  let sub = await svc.getActiveSubscription(req.auth.userId)
  if (!sub) {
    const user = await pool.query(
      'SELECT onboarding_complete FROM users WHERE id = $1',
      [req.auth.userId]
    )
    if (user.rows[0]?.onboarding_complete) {
      sub = await svc.ensureBaseSubscription(req.auth.userId)
    } else {
      return res.json({ tier: 'base', subscription: null })
    }
  }

  res.json(formatSubscriptionPayload(sub))
})

/* ─── POST /api/subscription/downgrade ──────────────────────────
   Schedules a tier downgrade at current_period_end (keeps access until then). */
router.post('/subscription/downgrade', async (req, res) => {
  const { targetTier } = req.body

  if (!['base', 'plus'].includes(targetTier)) {
    return res.status(400).json({
      error: 'INVALID_TIER',
      message: 'Downgrade target must be "base" or "plus".',
    })
  }

  if (!req.auth.userId) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' })
  }

  const current = await svc.getActiveSubscription(req.auth.userId)
  if (!current) {
    return res.status(404).json({
      error: 'NO_SUBSCRIPTION',
      message: 'No active subscription found to downgrade.',
    })
  }

  if (current.status === 'pending') {
    return res.status(409).json({
      error: 'PAYMENT_PENDING',
      message: 'You have a pending payment. Finish checkout before scheduling a downgrade.',
    })
  }

  const rank = { base: 0, plus: 1, prime: 2 }
  if ((rank[targetTier] ?? -1) >= (rank[current.tier] ?? -1)) {
    return res.status(400).json({
      error: 'INVALID_DOWNGRADE_PATH',
      message: `Downgrade must go to a lower plan. Current: ${current.tier}, requested: ${targetTier}.`,
    })
  }

  if (targetTier === 'plus' && current.tier !== 'prime') {
    return res.status(400).json({
      error: 'INVALID_DOWNGRADE_PATH',
      message: 'Only LEVEL Prime can downgrade to Plus.',
    })
  }

  const periodEndMs = new Date(current.current_period_end).getTime()
  if (Number.isFinite(periodEndMs) && periodEndMs > Date.now()) {
    return res.status(409).json({
      error: 'PERIOD_NOT_ENDED',
      message: `You can downgrade only after your current plan ends on ${new Date(current.current_period_end).toLocaleDateString('en-PH', { dateStyle: 'medium' })}.`,
      currentPeriodEnd: current.current_period_end,
    })
  }

  const { subscription, effectiveAt, scheduled } = await svc.downgradeSubscription({
    userId: req.auth.userId,
    targetTier,
  })

  const targetMeta = targetTier === 'plus' ? 'LEVEL Plus' : 'LEVEL Base'
  res.json({
    ...formatSubscriptionPayload(subscription),
    scheduled,
    effectiveAt,
    message: scheduled
      ? `Downgrade to ${targetMeta} scheduled for ${new Date(effectiveAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}. You keep your current plan until then.`
      : `Subscription updated to ${subscription.tier}.`,
  })
})

/* ─── POST /api/subscription/downgrade/cancel ───────────────────
   Cancels a pending period-end downgrade. */
router.post('/subscription/downgrade/cancel', async (req, res) => {
  if (!req.auth.userId) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' })
  }

  const sub = await svc.cancelScheduledDowngrade({ userId: req.auth.userId })
  if (!sub) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: 'No scheduled downgrade found.',
    })
  }

  res.json({
    ...formatSubscriptionPayload(sub),
    message: 'Scheduled downgrade cancelled. Your current plan continues.',
  })
})

/* ─── DELETE /api/subscription ──────────────────────────────────
   Cancels the active subscription. */
router.delete('/subscription', async (req, res) => {
  const { subscriptionId } = req.body
  if (!subscriptionId) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'subscriptionId is required.' })
  }

  if (!req.auth.userId) {
    return res.status(404).json({ error: 'NOT_FOUND' })
  }

  const cancelled = await svc.cancelSubscription({
    subscriptionId,
    userId: req.auth.userId,
  })

  if (!cancelled) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'No cancellable subscription found.' })
  }

  res.json({
    message: 'Subscription cancelled. Access continues until the current period ends.',
    subscription: cancelled,
  })
})

module.exports = router
