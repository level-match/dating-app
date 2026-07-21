/**
 * One-off: set every live subscription to active Base.
 * Cancels non-base live rows, then ensures each affected user has an active base plan.
 *
 * Usage: node server/scripts/reset-subscriptions-to-base.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const pool = require('../db/pool')
const subscriptionSvc = require('../services/subscription.service')

async function main() {
  const before = await pool.query(`
    SELECT tier, status, COUNT(*)::int AS n
    FROM subscriptions
    GROUP BY tier, status
    ORDER BY tier, status
  `)
  console.log('Before:', before.rows)

  const live = await pool.query(`
    SELECT id, user_id, tier, status
    FROM subscriptions
    WHERE status IN ('active', 'pending', 'past_due')
    ORDER BY created_at
  `)

  const client = await pool.connect()
  let cancelled = 0
  let ensured = 0

  try {
    await client.query('BEGIN')

    for (const sub of live.rows) {
      if (sub.tier === 'base' && sub.status === 'active') continue

      await client.query(
        `UPDATE subscriptions
         SET status = 'cancelled',
             cancelled_at = NOW(),
             scheduled_tier = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [sub.id]
      )

      await client.query(
        `INSERT INTO subscription_history
           (subscription_id, user_id, from_tier, to_tier, from_status, to_status, reason, triggered_by)
         VALUES ($1, $2, $3, 'base', $4, 'cancelled', 'bulk_reset_to_base', 'system')`,
        [sub.id, sub.user_id, sub.tier, sub.status]
      )
      cancelled += 1

      await subscriptionSvc.ensureBaseSubscription(sub.user_id, client)
      ensured += 1
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  const after = await pool.query(`
    SELECT tier, status, COUNT(*)::int AS n
    FROM subscriptions
    GROUP BY tier, status
    ORDER BY tier, status
  `)
  const liveAfter = await pool.query(`
    SELECT s.id, u.email, s.tier, s.status
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.status IN ('active', 'pending', 'past_due')
    ORDER BY u.email
  `)

  console.log(`Cancelled non-base live rows: ${cancelled}`)
  console.log(`Ensured base subscriptions: ${ensured}`)
  console.log('After:', after.rows)
  console.log('Live subscriptions:', liveAfter.rows)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => pool.end())
