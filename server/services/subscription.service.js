const { v4: uuidv4 } = require('uuid')
const pool = require('../db/pool')
const { calculateProRata, TIER_PRICE_CENTAVOS } = require('../utils/prorate')

const GRACE_PERIOD_HOURS = Number(process.env.GRACE_PERIOD_HOURS || 24)
const MAX_RETRIES        = Number(process.env.MAX_PAYMENT_RETRIES || 3)

/* ─── User resolution ───────────────────────────────────────────
   The payment backend holds a minimal user mirror. Profile data stays
   in the app store; this table exists only to anchor payment records. */
async function resolveUser(client, { externalId, email }) {
  const hit = await (client || pool).query(
    'SELECT id FROM users WHERE external_id = $1',
    [externalId]
  )
  if (hit.rows.length) return hit.rows[0].id

  const ins = await (client || pool).query(
    'INSERT INTO users (external_id, email) VALUES ($1, $2) RETURNING id',
    [externalId, email]
  )
  return ins.rows[0].id
}

/* ─── Query helpers ─────────────────────────────────────────────*/

async function getActiveSubscription(userId) {
  const result = await pool.query(
    `SELECT * FROM subscriptions
     WHERE user_id = $1
       AND status IN ('active', 'pending', 'past_due')
     LIMIT 1`,
    [userId]
  )
  return result.rows[0] || null
}

/* ─── Create subscription (pending until webhook confirms) ──────
   Called after the payment gateway payment-link/intent is created.
   Entitlements are NOT unlocked here — that only happens in activateSubscription()
   which is called exclusively from the verified webhook handler. */
async function createSubscription({
  userId, tier, idempotencyKey, provider = 'paymongo',
  providerPaymentId, providerCustomerId = null,
}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Application-layer guard (DB unique index is the hard guarantee)
    const existing = await client.query(
      `SELECT id, tier, status FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'pending', 'past_due')
       LIMIT 1`,
      [userId]
    )
    if (existing.rows.length) {
      const err = new Error('User already has an active subscription.')
      err.code = 'DUPLICATE_SUBSCRIPTION'
      err.existing = existing.rows[0]
      throw err
    }

    const sub = await client.query(
      `INSERT INTO subscriptions
         (user_id, tier, status, provider, provider_subscription_id, provider_customer_id)
       VALUES ($1, $2, 'pending', $3, $4, $5)
       RETURNING *`,
      [userId, tier, provider, providerPaymentId, providerCustomerId]
    )

    await client.query(
      `INSERT INTO payment_ledger
         (user_id, subscription_id, type, amount_centavos, description,
          provider, provider_payment_id, idempotency_key, status)
       VALUES ($1, $2, 'initial_charge', $3, $4, $5, $6, $7, 'pending')`,
      [
        userId,
        sub.rows[0].id,
        TIER_PRICE_CENTAVOS[tier],
        `Initial ${tier} subscription charge`,
        provider,
        providerPaymentId,
        idempotencyKey,
      ]
    )

    await client.query('COMMIT')
    return sub.rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/* ─── Activate subscription ─────────────────────────────────────
   Called ONLY from a cryptographically verified webhook handler.
   This is the sole gate that unlocks premium entitlements. */
async function activateSubscription({ subscriptionId, providerPaymentId }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const result = await client.query(
      `UPDATE subscriptions
       SET status               = 'active',
           current_period_start = NOW(),
           current_period_end   = NOW() + INTERVAL '30 days',
           grace_period_end     = NULL,
           retry_count          = 0,
           updated_at           = NOW()
       WHERE id = $1 AND status IN ('pending', 'past_due')
       RETURNING *`,
      [subscriptionId]
    )

    if (!result.rows.length) {
      const err = new Error('Subscription not found or already active.')
      err.code = 'NOT_FOUND'
      throw err
    }

    const sub = result.rows[0]

    await client.query(
      `UPDATE payment_ledger SET status = 'paid'
       WHERE provider_payment_id = $1 AND status = 'pending'`,
      [providerPaymentId]
    )

    await _writeHistory(client, {
      subscriptionId: sub.id,
      userId:      sub.user_id,
      fromStatus:  'pending',
      toStatus:    'active',
      toTier:      sub.tier,
      reason:      'payment_confirmed',
      triggeredBy: 'webhook',
    })

    await client.query('COMMIT')
    return sub
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/* ─── Handle payment failure ────────────────────────────────────
   Transitions to PAST_DUE and opens the 1-day grace period window.
   Premium features remain accessible during the grace period.
   On MAX_RETRIES, auto-downgrades to LEVEL Base. */
async function handlePaymentFailure({ subscriptionId, providerPaymentId }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const current = await client.query(
      'SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE',
      [subscriptionId]
    )
    if (!current.rows.length) {
      const err = new Error('Subscription not found.')
      err.code = 'NOT_FOUND'
      throw err
    }

    const sub         = current.rows[0]
    const newRetries  = sub.retry_count + 1
    const exhausted   = newRetries >= MAX_RETRIES

    if (exhausted) {
      await _downgradeToBase(client, sub, `payment_failure_max_retries`)
    } else {
      const gracePeriodEnd = new Date(Date.now() + GRACE_PERIOD_HOURS * 3_600_000)

      await client.query(
        `UPDATE subscriptions
         SET status           = 'past_due',
             grace_period_end = $1,
             retry_count      = $2,
             updated_at       = NOW()
         WHERE id = $3`,
        [gracePeriodEnd, newRetries, subscriptionId]
      )

      await _writeHistory(client, {
        subscriptionId: sub.id,
        userId:      sub.user_id,
        fromTier:    sub.tier,
        toTier:      sub.tier,
        fromStatus:  sub.status,
        toStatus:    'past_due',
        reason:      `payment_failed_retry_${newRetries}`,
        triggeredBy: 'webhook',
      })
    }

    if (providerPaymentId) {
      await client.query(
        `UPDATE payment_ledger SET status = 'failed'
         WHERE provider_payment_id = $1 AND status = 'pending'`,
        [providerPaymentId]
      )
    }

    await client.query('COMMIT')
    return { retryCount: newRetries, exhausted }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/* ─── Pro-rata upgrade: Plus → Prime ────────────────────────────
   1. Locks the current subscription row.
   2. Calculates unused days on Plus as a credit.
   3. Writes a prorata_credit ledger entry (negative centavos).
   4. Moves the subscription to 'pending' at the 'prime' tier.
   5. Writes an upgrade_charge ledger entry for the net amount.
   6. Returns the net charge so the caller can bill via the gateway. */
async function initiateUpgrade({
  userId, idempotencyKey, provider = 'paymongo', providerPaymentId,
}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const result = await client.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'past_due')
       FOR UPDATE`,
      [userId]
    )

    if (!result.rows.length) {
      const err = new Error('No upgradeable subscription found.')
      err.code = 'NO_SUBSCRIPTION'
      throw err
    }

    const sub = result.rows[0]
    if (sub.tier !== 'plus') {
      const err = new Error(`Upgrade path is Plus → Prime only. Current tier: ${sub.tier}`)
      err.code = 'INVALID_UPGRADE_PATH'
      throw err
    }

    const prorate = calculateProRata('plus', 'prime', sub.current_period_end)

    // Credit entry — negative centavos represent a monetary credit
    await client.query(
      `INSERT INTO payment_ledger
         (user_id, subscription_id, type, amount_centavos, description,
          provider, idempotency_key, status, metadata)
       VALUES ($1, $2, 'prorata_credit', $3, $4, $5, $6, 'paid', $7)`,
      [
        userId,
        sub.id,
        -prorate.creditCentavos,
        `Pro-rata credit: ${prorate.remainingDays.toFixed(2)} unused days on Plus`,
        provider,
        uuidv4(),
        JSON.stringify(prorate),
      ]
    )

    // Transition subscription to prime/pending — activates when charge webhook fires
    const updated = await client.query(
      `UPDATE subscriptions
       SET tier                     = 'prime',
           status                   = 'pending',
           current_period_start     = NOW(),
           current_period_end       = NOW() + INTERVAL '30 days',
           provider_subscription_id = COALESCE($1, provider_subscription_id),
           updated_at               = NOW()
       WHERE id = $2
       RETURNING *`,
      [providerPaymentId, sub.id]
    )

    // Net charge entry
    await client.query(
      `INSERT INTO payment_ledger
         (user_id, subscription_id, type, amount_centavos, description,
          provider, provider_payment_id, idempotency_key, status, metadata)
       VALUES ($1, $2, 'upgrade_charge', $3, $4, $5, $6, $7, 'pending', $8)`,
      [
        userId,
        sub.id,
        prorate.chargeCentavos,
        `Plus → Prime upgrade (PHP ${(prorate.creditCentavos / 100).toFixed(2)} credit applied)`,
        provider,
        providerPaymentId,
        idempotencyKey,
        JSON.stringify(prorate),
      ]
    )

    await _writeHistory(client, {
      subscriptionId: sub.id,
      userId,
      fromTier:    'plus',
      toTier:      'prime',
      fromStatus:  sub.status,
      toStatus:    'pending',
      reason:      'upgrade_initiated',
      triggeredBy: 'api',
    })

    await client.query('COMMIT')
    return { subscription: updated.rows[0], prorate }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/* ─── Cancel subscription ───────────────────────────────────────
   Marks as cancelled immediately. No proration — access continues
   until current_period_end (period-end cancellation). */
async function cancelSubscription({ subscriptionId, userId }) {
  const result = await pool.query(
    `UPDATE subscriptions
     SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status IN ('active', 'past_due')
     RETURNING *`,
    [subscriptionId, userId]
  )
  return result.rows[0] || null
}

/* ── Private helpers ─────────────────────────────────────────── */

async function _downgradeToBase(client, sub, reason) {
  await client.query(
    `UPDATE subscriptions
     SET tier             = 'base',
         status           = 'expired',
         grace_period_end = NULL,
         retry_count      = 0,
         updated_at       = NOW()
     WHERE id = $1`,
    [sub.id]
  )

  await _writeHistory(client, {
    subscriptionId: sub.id,
    userId:      sub.user_id,
    fromTier:    sub.tier,
    toTier:      'base',
    fromStatus:  sub.status,
    toStatus:    'expired',
    reason,
    triggeredBy: 'system',
  })
}

async function _writeHistory(client, {
  subscriptionId, userId, fromTier, toTier,
  fromStatus, toStatus, reason, triggeredBy,
}) {
  await client.query(
    `INSERT INTO subscription_history
       (subscription_id, user_id, from_tier, to_tier, from_status, to_status, reason, triggered_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [subscriptionId, userId, fromTier || null, toTier || null,
     fromStatus || null, toStatus || null, reason, triggeredBy]
  )
}

module.exports = {
  resolveUser,
  getActiveSubscription,
  createSubscription,
  activateSubscription,
  handlePaymentFailure,
  initiateUpgrade,
  cancelSubscription,
}
