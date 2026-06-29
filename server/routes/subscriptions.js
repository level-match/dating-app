const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { requireIdempotencyKey } = require('../middleware/idempotency')
const svc  = require('../services/subscription.service')
const pool = require('../db/pool')

const router = express.Router()

// Every write endpoint mandates an Idempotency-Key header
router.use(['/subscribe', '/upgrade', '/charge'], requireIdempotencyKey)

/* ─── POST /api/subscribe ───────────────────────────────────────
   Initiates a subscription for a new or existing user.
   Creates a PayMongo payment link and stores the subscription as
   'pending'. Entitlements are unlocked ONLY by the webhook. */
router.post('/subscribe', async (req, res) => {
  const { tier, externalUserId, email } = req.body

  if (!['plus', 'prime'].includes(tier)) {
    return res.status(400).json({ error: 'INVALID_TIER', message: 'tier must be "plus" or "prime".' })
  }
  if (!externalUserId || !email) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'externalUserId and email are required.' })
  }

  const userId = await svc.resolveUser(null, { externalId: externalUserId, email })

  // Reject if a live subscription already exists (mandate enforced at service + DB)
  const existing = await svc.getActiveSubscription(userId)
  if (existing) {
    return res.status(409).json({
      error:   'DUPLICATE_SUBSCRIPTION',
      message: 'An active subscription already exists for this account.',
      current: { id: existing.id, tier: existing.tier, status: existing.status },
    })
  }

  // ── PayMongo: create a payment link ──────────────────────────
  // Replace the block below with a real PayMongo Links API call.
  // The shape of the response is what you'd receive from the SDK:
  //   POST https://api.paymongo.com/v1/links
  //   Body: { data: { attributes: { amount, description, currency } } }
  // ----------------------------------------------------------
  const providerPaymentId = `pm_link_${uuidv4().replace(/-/g, '').slice(0, 16)}`
  const checkoutUrl       = `https://checkout.paymongo.com/links/${providerPaymentId}` // swap → real API response

  const subscription = await svc.createSubscription({
    userId,
    tier,
    idempotencyKey:    req.idempotencyKey,
    provider:          'paymongo',
    providerPaymentId,
    providerCustomerId: null,
  })

  res.status(202).json({
    subscriptionId: subscription.id,
    status:         'pending',
    checkoutUrl,
    message:        'Subscription pending payment. Entitlements activate upon confirmed webhook from PayMongo.',
  })
})

/* ─── POST /api/upgrade ─────────────────────────────────────────
   Upgrades an active Plus subscription to Prime mid-cycle.
   Computes pro-rata credit, returns net charge amount, and marks
   the subscription pending until the upgrade charge webhook fires. */
router.post('/upgrade', async (req, res) => {
  const { externalUserId, email } = req.body

  if (!externalUserId) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'externalUserId is required.' })
  }

  const userId = await svc.resolveUser(null, { externalId: externalUserId, email: email || '' })

  // ── PayMongo: create an immediate charge for the net amount ──
  // In production: first call initiateUpgrade() to get chargeCentavos,
  // then create the PayMongo payment intent for that amount, then
  // pass providerPaymentId back into the service call.
  // ----------------------------------------------------------
  const providerPaymentId = `pm_charge_${uuidv4().replace(/-/g, '').slice(0, 16)}`

  const { subscription, prorate } = await svc.initiateUpgrade({
    userId,
    idempotencyKey:    req.idempotencyKey,
    provider:          'paymongo',
    providerPaymentId,
  })

  res.status(202).json({
    subscriptionId: subscription.id,
    prorate: {
      remainingDays: prorate.remainingDays,
      creditApplied: `PHP ${(prorate.creditCentavos  / 100).toFixed(2)}`,
      netCharge:     `PHP ${(prorate.chargeCentavos   / 100).toFixed(2)}`,
      chargeCentavos: prorate.chargeCentavos,
    },
    status:  'pending',
    message: 'Upgrade pending payment. Prime features activate upon confirmed webhook from PayMongo.',
  })
})

/* ─── POST /api/charge ──────────────────────────────────────────
   Manual retry charge for a PAST_DUE subscription.
   The grace-period window is already open; this endpoint lets the
   client retry with a different payment method if needed. */
router.post('/charge', async (req, res) => {
  const { subscriptionId, externalUserId } = req.body

  if (!subscriptionId || !externalUserId) {
    return res.status(400).json({
      error: 'MISSING_FIELDS', message: 'subscriptionId and externalUserId are required.',
    })
  }

  // Verify the subscription belongs to the requesting user
  const result = await pool.query(
    `SELECT s.id, s.tier, s.status, s.retry_count
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND u.external_id = $2 AND s.status = 'past_due'`,
    [subscriptionId, externalUserId]
  )

  if (!result.rows.length) {
    return res.status(404).json({
      error: 'NOT_FOUND', message: 'No past-due subscription found for this account.',
    })
  }

  // ── PayMongo: retry charge with the customer's saved method ──
  // In production: retrieve the customer's saved payment method from
  // the gateway and create a new payment intent here.
  const providerPaymentId = `pm_retry_${uuidv4().replace(/-/g, '').slice(0, 16)}`

  // Record the retry in the ledger
  const sub = result.rows[0]
  await pool.query(
    `INSERT INTO payment_ledger
       (user_id, subscription_id, type, amount_centavos, description,
        provider, provider_payment_id, idempotency_key, status)
     SELECT u.id, $1, 'retry_charge',
            $2, $3, 'paymongo', $4, $5, 'pending'
     FROM subscriptions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [
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

/* ─── GET /api/subscription ─────────────────────────────────────
   Safe endpoint for the frontend to sync localStorage tier with
   the authoritative server state (e.g. on page load / app resume). */
router.get('/subscription', async (req, res) => {
  const { externalUserId } = req.query
  if (!externalUserId) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'externalUserId query param is required.' })
  }

  const user = await pool.query(
    'SELECT id FROM users WHERE external_id = $1',
    [externalUserId]
  )
  if (!user.rows.length) return res.json({ tier: 'base', subscription: null })

  const sub = await svc.getActiveSubscription(user.rows[0].id)
  if (!sub) return res.json({ tier: 'base', subscription: null })

  res.json({
    tier:         sub.tier,
    subscription: {
      id:               sub.id,
      status:           sub.status,
      currentPeriodEnd: sub.current_period_end,
      gracePeriodEnd:   sub.grace_period_end,
      retryCount:       sub.retry_count,
    },
  })
})

/* ─── DELETE /api/subscription ──────────────────────────────────
   Cancels the active subscription. Access continues until period end. */
router.delete('/subscription', async (req, res) => {
  const { subscriptionId, externalUserId } = req.body
  if (!subscriptionId || !externalUserId) {
    return res.status(400).json({ error: 'MISSING_FIELDS' })
  }

  const user = await pool.query('SELECT id FROM users WHERE external_id = $1', [externalUserId])
  if (!user.rows.length) return res.status(404).json({ error: 'NOT_FOUND' })

  const cancelled = await svc.cancelSubscription({
    subscriptionId,
    userId: user.rows[0].id,
  })

  if (!cancelled) return res.status(404).json({ error: 'NOT_FOUND', message: 'No cancellable subscription found.' })
  res.json({ message: 'Subscription cancelled. Access continues until the current period ends.', subscription: cancelled })
})

module.exports = router
