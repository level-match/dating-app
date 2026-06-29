const express = require('express')
const pool = require('../db/pool')
const {
  rawBodySaver,
  verifyPayMongoWebhook,
  verifyStripeWebhook,
} = require('../middleware/verify-webhook')
const svc = require('../services/subscription.service')

const router = express.Router()

/* ─── PayMongo Webhook ──────────────────────────────────────────
   Endpoint: POST /webhooks/paymongo
   rawBodySaver must precede verifyPayMongoWebhook so the raw body
   string is available for HMAC recomputation before JSON.parse(). */
router.post('/paymongo', rawBodySaver, verifyPayMongoWebhook, async (req, res) => {
  const event   = req.webhookPayload
  const eventId = event.data?.id || event.id

  // Record the event; returns false if already processed (replay protection)
  const isNew = await _recordEvent(eventId, 'paymongo', event.type, event)
  if (!isNew) {
    return res.status(200).json({ received: true, skipped: 'already_processed' })
  }

  try {
    switch (event.type) {
      case 'payment.paid':
      case 'link.payment.paid':
        await _handlePaymentPaid(event.data?.attributes || {})
        break

      case 'payment.failed':
        await _handlePaymentFailed(event.data?.attributes || {})
        break

      // PayMongo sends this when a subscription's billing cycle runs
      case 'payment.paid.recurring':
        await _handleRecurringPaid(event.data?.attributes || {})
        break

      default:
        // Acknowledge unknown types without processing — prevents infinite retries
        console.log(`[webhook/paymongo] Unhandled event type: ${event.type}`)
    }

    await _markProcessed(eventId, 'paymongo')
    res.status(200).json({ received: true })
  } catch (err) {
    // Log and acknowledge. Returning 200 prevents PayMongo from flooding
    // with retries for non-transient errors. Transient DB errors should
    // return 500 so the provider retries.
    const isTransient = err.code === 'ECONNREFUSED' || err.code === '57P03'
    await _markError(eventId, 'paymongo', err.message)
    console.error('[webhook/paymongo] Processing error:', err.message)
    res.status(isTransient ? 500 : 200).json({ received: !isTransient, error: err.message })
  }
})

/* ─── Stripe Webhook ────────────────────────────────────────────
   Endpoint: POST /webhooks/stripe */
router.post('/stripe', rawBodySaver, verifyStripeWebhook, async (req, res) => {
  const event = req.webhookPayload

  const isNew = await _recordEvent(event.id, 'stripe', event.type, event)
  if (!isNew) {
    return res.status(200).json({ received: true, skipped: 'already_processed' })
  }

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await _handlePaymentPaid({
          external_reference_number: event.data.object.payment_intent,
        })
        break

      case 'invoice.payment_failed':
        await _handlePaymentFailed({
          external_reference_number: event.data.object.payment_intent,
        })
        break

      case 'customer.subscription.deleted':
        await _handleStripeSubscriptionDeleted(event.data.object)
        break

      default:
        console.log(`[webhook/stripe] Unhandled event type: ${event.type}`)
    }

    await _markProcessed(event.id, 'stripe')
    res.status(200).json({ received: true })
  } catch (err) {
    const isTransient = err.code === 'ECONNREFUSED' || err.code === '57P03'
    await _markError(event.id, 'stripe', err.message)
    console.error('[webhook/stripe] Processing error:', err.message)
    res.status(isTransient ? 500 : 200).json({ received: !isTransient, error: err.message })
  }
})

/* ── Payment event handlers ─────────────────────────────────────
   These are the ONLY code paths that call activateSubscription().
   Entitlement promotion never happens from a client-side request. */

async function _handlePaymentPaid(attributes) {
  const providerPaymentId = attributes.external_reference_number || attributes.id
  if (!providerPaymentId) return

  const ledger = await pool.query(
    `SELECT subscription_id FROM payment_ledger
     WHERE provider_payment_id = $1 AND status = 'pending'
     LIMIT 1`,
    [providerPaymentId]
  )

  if (!ledger.rows.length) {
    console.warn('[webhook] No pending ledger entry for payment ID:', providerPaymentId)
    return
  }

  await svc.activateSubscription({
    subscriptionId: ledger.rows[0].subscription_id,
    providerPaymentId,
  })
}

async function _handlePaymentFailed(attributes) {
  const providerPaymentId = attributes.external_reference_number || attributes.id
  if (!providerPaymentId) return

  const ledger = await pool.query(
    `SELECT subscription_id FROM payment_ledger
     WHERE provider_payment_id = $1
     LIMIT 1`,
    [providerPaymentId]
  )

  if (!ledger.rows.length) {
    console.warn('[webhook] No ledger entry for failed payment ID:', providerPaymentId)
    return
  }

  const { retryCount, exhausted } = await svc.handlePaymentFailure({
    subscriptionId: ledger.rows[0].subscription_id,
    providerPaymentId,
  })

  if (exhausted) {
    console.log(`[webhook] Subscription ${ledger.rows[0].subscription_id} downgraded to base after ${retryCount} retries.`)
  }
}

async function _handleRecurringPaid(attributes) {
  // Recurring billing: reactivate and extend the billing period
  await _handlePaymentPaid(attributes)
}

async function _handleStripeSubscriptionDeleted(stripeSubscription) {
  await pool.query(
    `UPDATE subscriptions
     SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
     WHERE provider_subscription_id = $1 AND status IN ('active', 'past_due', 'pending')`,
    [stripeSubscription.id]
  )
}

/* ── Webhook event table helpers ────────────────────────────────*/

async function _recordEvent(eventId, provider, eventType, payload) {
  try {
    await pool.query(
      `INSERT INTO webhook_events (event_id, provider, event_type, payload)
       VALUES ($1, $2, $3, $4)`,
      [eventId, provider, eventType, JSON.stringify(payload)]
    )
    return true // new event
  } catch (err) {
    if (err.code === '23505') return false // unique violation = already recorded
    throw err
  }
}

async function _markProcessed(eventId, provider) {
  await pool.query(
    'UPDATE webhook_events SET processed_at = NOW() WHERE event_id = $1 AND provider = $2',
    [eventId, provider]
  )
}

async function _markError(eventId, provider, message) {
  await pool.query(
    'UPDATE webhook_events SET error = $1 WHERE event_id = $2 AND provider = $3',
    [message, eventId, provider]
  )
}

module.exports = router
