const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { requireIdempotencyKey } = require('../middleware/idempotency')
const { attachSupabaseIdentity } = require('../middleware/subscription-auth')
const svc  = require('../services/subscription.service')
const pool = require('../db/pool')

const router = express.Router()

router.use(attachSupabaseIdentity)
router.use(['/subscribe', '/upgrade', '/charge', '/subscription/confirm'], requireIdempotencyKey)

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
   Creates a PayMongo payment link and stores the subscription as
   'pending'. Entitlements are unlocked ONLY by the webhook (or dev confirm). */
router.post('/subscribe', async (req, res) => {
  const { tier } = req.body

  if (!['plus', 'prime'].includes(tier)) {
    return res.status(400).json({ error: 'INVALID_TIER', message: 'tier must be "plus" or "prime".' })
  }

  const userId = await resolveAuthUserId(req)

  const existing = await svc.getActiveSubscription(userId)
  if (existing && !(existing.tier === 'base' && existing.status === 'active')) {
    return res.status(409).json({
      error:   'DUPLICATE_SUBSCRIPTION',
      message: 'An active subscription already exists for this account.',
      current: { id: existing.id, tier: existing.tier, status: existing.status },
    })
  }

  const providerPaymentId = `pm_link_${uuidv4().replace(/-/g, '').slice(0, 16)}`
  const checkoutUrl       = `https://checkout.paymongo.com/links/${providerPaymentId}`

  const subscription = await svc.createSubscription({
    userId,
    tier,
    idempotencyKey:     req.idempotencyKey,
    provider:           'paymongo',
    providerPaymentId,
    providerCustomerId: null,
  })

  res.status(202).json({
    subscriptionId:    subscription.id,
    providerPaymentId,
    status:            'pending',
    checkoutUrl,
    message:           'Subscription pending payment. Entitlements activate upon confirmed webhook from PayMongo.',
  })
})

/* ─── POST /api/upgrade ─────────────────────────────────────────
   Upgrades an active Plus subscription to Prime mid-cycle. */
router.post('/upgrade', async (req, res) => {
  const userId = await resolveAuthUserId(req)
  const providerPaymentId = `pm_charge_${uuidv4().replace(/-/g, '').slice(0, 16)}`

  const { subscription, prorate } = await svc.initiateUpgrade({
    userId,
    idempotencyKey:    req.idempotencyKey,
    provider:          'paymongo',
    providerPaymentId,
  })

  res.status(202).json({
    subscriptionId: subscription.id,
    providerPaymentId,
    prorate: {
      remainingDays:  prorate.remainingDays,
      creditApplied:  `PHP ${(prorate.creditCentavos  / 100).toFixed(2)}`,
      netCharge:        `PHP ${(prorate.chargeCentavos   / 100).toFixed(2)}`,
      chargeCentavos:   prorate.chargeCentavos,
    },
    status:  'pending',
    message: 'Upgrade pending payment. Prime features activate upon confirmed webhook from PayMongo.',
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

  const providerPaymentId = `pm_retry_${uuidv4().replace(/-/g, '').slice(0, 16)}`
  const sub = result.rows[0]

  await pool.query(
    `INSERT INTO payment_ledger
       (user_id, subscription_id, type, amount_centavos, description,
        provider, provider_payment_id, idempotency_key, status)
     VALUES ($1, $2, 'retry_charge', $3, $4, 'paymongo', $5, $6, 'pending')`,
    [
      userId,
      subscriptionId,
      require('../utils/prorate').TIER_PRICE_CENTAVOS[sub.tier],
      `Manual retry charge — retry #${sub.retry_count + 1}`,
      providerPaymentId,
      req.idempotencyKey,
    ]
  )

  res.status(202).json({
    subscriptionId,
    providerPaymentId,
    status:  'pending',
    message: 'Retry charge initiated. Entitlement restored upon webhook confirmation.',
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
     WHERE s.user_id = $1 AND s.status = 'pending'
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
   Persists a tier downgrade to the database. */
router.post('/subscription/downgrade', async (req, res) => {
  const { targetTier } = req.body

  if (!['base', 'plus'].includes(targetTier)) {
    return res.status(400).json({
      error: 'INVALID_TIER',
      message: 'targetTier must be "base" or "plus".',
    })
  }

  if (!req.auth.userId) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' })
  }

  const sub = await svc.downgradeSubscription({
    userId: req.auth.userId,
    targetTier,
  })

  res.json({
    ...formatSubscriptionPayload(sub),
    message: `Subscription downgraded to ${sub.tier}.`,
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
