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
  await applyDueScheduledChanges(userId)
  await recoverAbandonedPrimeUpgrade(userId)

  const result = await pool.query(
    `SELECT * FROM subscriptions
     WHERE user_id = $1
       AND status IN ('active', 'pending', 'past_due')
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId]
  )
  return result.rows[0] || null
}

/**
 * If Plus→Prime checkout was abandoned, subscription can be stuck as prime/pending.
 * Roll it back to plus/active so the member can retry.
 */
async function recoverAbandonedPrimeUpgrade(userId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const result = await client.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1
         AND tier = 'prime'
         AND status = 'pending'
       ORDER BY created_at DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    )

    if (!result.rows.length) {
      await client.query('COMMIT')
      return null
    }

    const sub = result.rows[0]
    const paid = await client.query(
      `SELECT id FROM payment_ledger
       WHERE subscription_id = $1
         AND type = 'upgrade_charge'
         AND status = 'paid'
       LIMIT 1`,
      [sub.id]
    )
    if (paid.rows.length) {
      await client.query('COMMIT')
      return null
    }

    await client.query(
      `UPDATE payment_ledger
       SET status = 'failed'
       WHERE subscription_id = $1
         AND type = 'upgrade_charge'
         AND status = 'pending'`,
      [sub.id]
    )

    await client.query(
      `UPDATE subscriptions
       SET tier = 'plus',
           status = 'active',
           scheduled_tier = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [sub.id]
    )

    await _writeHistory(client, {
      subscriptionId: sub.id,
      userId,
      fromTier:    'prime',
      toTier:      'plus',
      fromStatus:  'pending',
      toStatus:    'active',
      reason:      'upgrade_abandoned_reverted',
      triggeredBy: 'system',
    })

    await client.query('COMMIT')
    return true
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Apply any scheduled_tier once current_period_end has passed.
 * Keeps paid access until the billing period ends.
 */
async function applyDueScheduledChanges(userId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const result = await client.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1
         AND status IN ('active', 'past_due')
         AND scheduled_tier IS NOT NULL
         AND current_period_end <= NOW()
       ORDER BY created_at DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    )

    if (!result.rows.length) {
      await client.query('COMMIT')
      return null
    }

    const sub = result.rows[0]
    const targetTier = sub.scheduled_tier
    await _applyScheduledDowngrade(client, sub, targetTier)
    await client.query('COMMIT')
    return true
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
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
       ORDER BY created_at DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    )
    if (existing.rows.length) {
      const current = existing.rows[0]
      if (current.tier === 'base' && current.status === 'active') {
        const upgraded = await client.query(
          `UPDATE subscriptions
           SET tier                     = $1,
               status                   = 'pending',
               provider                 = $2,
               provider_subscription_id = $3,
               provider_customer_id     = $4,
               grace_period_end         = NULL,
               retry_count              = 0,
               scheduled_tier           = NULL,
               updated_at               = NOW()
           WHERE id = $5
           RETURNING *`,
          [tier, provider, providerPaymentId, providerCustomerId, current.id]
        )

        await client.query(
          `INSERT INTO payment_ledger
             (user_id, subscription_id, type, amount_centavos, description,
              provider, provider_payment_id, idempotency_key, status)
           VALUES ($1, $2, 'initial_charge', $3, $4, $5, $6, $7, 'pending')`,
          [
            userId,
            upgraded.rows[0].id,
            TIER_PRICE_CENTAVOS[tier],
            `Initial ${tier} subscription charge`,
            provider,
            providerPaymentId,
            idempotencyKey,
          ]
        )

        await _writeHistory(client, {
          subscriptionId: upgraded.rows[0].id,
          userId,
          fromTier:   'base',
          toTier:     tier,
          fromStatus: 'active',
          toStatus:   'pending',
          reason:     'upgrade_from_base',
          triggeredBy: 'api',
        })

        await client.query('COMMIT')
        return upgraded.rows[0]
      }

      const err = new Error('User already has an active subscription.')
      err.code = 'DUPLICATE_SUBSCRIPTION'
      err.existing = current
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

    const ledger = await client.query(
      `SELECT type FROM payment_ledger
       WHERE provider_payment_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [providerPaymentId]
    )
    const chargeType = ledger.rows[0]?.type || null
    const isUpgrade = chargeType === 'upgrade_charge'

    const result = await client.query(
      `UPDATE subscriptions
       SET status               = 'active',
           tier                 = CASE WHEN $2 THEN 'prime' ELSE tier END,
           current_period_start = NOW(),
           current_period_end   = NOW() + INTERVAL '30 days',
           grace_period_end     = NULL,
           retry_count          = 0,
           scheduled_tier       = NULL,
           updated_at           = NOW()
       WHERE id = $1 AND status IN ('pending', 'past_due', 'active')
       RETURNING *`,
      [subscriptionId, isUpgrade]
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
      fromStatus:  isUpgrade ? 'active' : 'pending',
      toStatus:    'active',
      toTier:      sub.tier,
      reason:      isUpgrade ? 'upgrade_payment_confirmed' : 'payment_confirmed',
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

    // Fail any previous unpaid upgrade attempts for this subscription.
    await client.query(
      `UPDATE payment_ledger
       SET status = 'failed'
       WHERE subscription_id = $1
         AND type = 'upgrade_charge'
         AND status = 'pending'`,
      [sub.id]
    )

    // Keep Plus active until PayMongo confirms — do not flip to prime/pending yet.
    const updated = await client.query(
      `UPDATE subscriptions
       SET provider_subscription_id = COALESCE($1, provider_subscription_id),
           scheduled_tier           = NULL,
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
      toStatus:    sub.status,
      reason:      'upgrade_checkout_created',
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

/* ─── Ensure base subscription ────────────────────────────────────
   Creates an active LEVEL Base row when a user finishes onboarding.
   Idempotent — returns the existing live subscription if one exists. */
async function ensureBaseSubscription(userId, client = null) {
  const db = client || pool
  const ownsTx = !client

  if (ownsTx) {
    const outer = await pool.connect()
    try {
      await outer.query('BEGIN')
      const sub = await _ensureBaseSubscriptionLocked(outer, userId)
      await outer.query('COMMIT')
      return sub
    } catch (err) {
      await outer.query('ROLLBACK')
      throw err
    } finally {
      outer.release()
    }
  }

  return _ensureBaseSubscriptionLocked(db, userId)
}

async function _ensureBaseSubscriptionLocked(db, userId) {
  await db.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId])

  const existing = await db.query(
    `SELECT * FROM subscriptions
     WHERE user_id = $1 AND status IN ('active', 'pending', 'past_due')
     ORDER BY created_at DESC, id DESC
     LIMIT 1
     FOR UPDATE`,
    [userId]
  )
  if (existing.rows.length) return existing.rows[0]

  const ins = await db.query(
    `INSERT INTO subscriptions (user_id, tier, status, provider, current_period_start)
     VALUES ($1, 'base', 'active', 'manual', NOW())
     RETURNING *`,
    [userId]
  )

  await _writeHistory(db, {
    subscriptionId: ins.rows[0].id,
    userId,
    toTier:      'base',
    toStatus:    'active',
    reason:      'onboarding_started',
    triggeredBy: 'system',
  })

  return ins.rows[0]
}

/* ─── Downgrade subscription ──────────────────────────────────────
   Schedules Prime → Plus or paid → Base at current_period_end.
   Member keeps the current paid tier until that date. */
async function downgradeSubscription({ userId, targetTier }) {
  if (!['base', 'plus'].includes(targetTier)) {
    const err = new Error('Downgrade target must be "base" or "plus".')
    err.code = 'INVALID_TIER'
    throw err
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const result = await client.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'past_due')
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    )

    if (!result.rows.length) {
      const base = await ensureBaseSubscription(userId, client)
      await client.query('COMMIT')
      return { subscription: base, effectiveAt: null, scheduled: false }
    }

    const sub = result.rows[0]

    if (sub.tier === targetTier) {
      await client.query(
        `UPDATE subscriptions
         SET scheduled_tier = NULL, updated_at = NOW()
         WHERE id = $1`,
        [sub.id]
      )
      await client.query('COMMIT')
      return { subscription: { ...sub, scheduled_tier: null }, effectiveAt: null, scheduled: false }
    }

    if (targetTier === 'plus' && sub.tier !== 'prime') {
      const err = new Error(`Cannot downgrade from ${sub.tier} to plus.`)
      err.code = 'INVALID_DOWNGRADE_PATH'
      throw err
    }

    const periodEnd = new Date(sub.current_period_end)
    const periodEnded = periodEnd.getTime() <= Date.now()

    if (!periodEnded) {
      const err = new Error(
        `You can downgrade only after your current plan ends on ${periodEnd.toLocaleDateString('en-PH', { dateStyle: 'medium' })}.`
      )
      err.code = 'PERIOD_NOT_ENDED'
      err.currentPeriodEnd = periodEnd.toISOString()
      throw err
    }

    await _applyScheduledDowngrade(client, sub, targetTier)
    const live = await client.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'pending', 'past_due')
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    )
    await client.query('COMMIT')
    return {
      subscription: live.rows[0],
      effectiveAt: new Date().toISOString(),
      scheduled: false,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** Clear a pending period-end downgrade. */
async function cancelScheduledDowngrade({ userId }) {
  const result = await pool.query(
    `UPDATE subscriptions
     SET scheduled_tier = NULL, updated_at = NOW()
     WHERE user_id = $1
       AND status IN ('active', 'past_due')
       AND scheduled_tier IS NOT NULL
     RETURNING *`,
    [userId]
  )
  return result.rows[0] || null
}

async function _applyScheduledDowngrade(client, sub, targetTier) {
  if (targetTier === 'plus' && sub.tier === 'prime') {
    await client.query(
      `UPDATE subscriptions
       SET tier = 'plus',
           scheduled_tier = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [sub.id]
    )

    await _writeHistory(client, {
      subscriptionId: sub.id,
      userId:      sub.user_id,
      fromTier:    'prime',
      toTier:      'plus',
      fromStatus:  sub.status,
      toStatus:    sub.status,
      reason:      'downgrade_prime_to_plus_period_end',
      triggeredBy: 'system',
    })
    return
  }

  if (targetTier === 'base') {
    await client.query(
      `UPDATE subscriptions
       SET status = 'cancelled',
           cancelled_at = NOW(),
           scheduled_tier = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [sub.id]
    )

    await _writeHistory(client, {
      subscriptionId: sub.id,
      userId:      sub.user_id,
      fromTier:    sub.tier,
      toTier:      'base',
      fromStatus:  sub.status,
      toStatus:    'cancelled',
      reason:      'downgrade_to_base_period_end',
      triggeredBy: 'system',
    })

    await ensureBaseSubscription(sub.user_id, client)
  }
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
  ensureBaseSubscription,
  downgradeSubscription,
  cancelScheduledDowngrade,
  applyDueScheduledChanges,
}
