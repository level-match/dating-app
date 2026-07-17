/**
 * Migration 022 — scheduled_tier for period-end downgrades.
 * Paid members keep their current tier until current_period_end.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(`
      ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS scheduled_tier VARCHAR(10)
    `)

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'subscriptions_scheduled_tier_check'
        ) THEN
          ALTER TABLE subscriptions
            ADD CONSTRAINT subscriptions_scheduled_tier_check
            CHECK (scheduled_tier IS NULL OR scheduled_tier IN ('base', 'plus'));
        END IF;
      END $$;
    `)

    await client.query('COMMIT')
    console.log('[migrate:022] scheduled_tier column ready')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch(err => {
  console.error('[migrate:022] failed:', err.message)
  process.exit(1)
})
