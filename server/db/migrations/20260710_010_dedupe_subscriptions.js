require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
-- Keep only the newest live subscription per user; cancel older duplicates.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM subscriptions
  WHERE status IN ('active', 'pending', 'past_due')
)
UPDATE subscriptions s
SET status       = 'cancelled',
    cancelled_at = NOW(),
    updated_at   = NOW()
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_single_active
  ON subscriptions (user_id)
  WHERE status IN ('active', 'pending', 'past_due');
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const before = await client.query(`
      SELECT user_id, COUNT(*) AS n
      FROM subscriptions
      WHERE status IN ('active', 'pending', 'past_due')
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `)
    await client.query(SQL)
    const after = await client.query(`
      SELECT user_id, COUNT(*) AS n
      FROM subscriptions
      WHERE status IN ('active', 'pending', 'past_due')
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `)
    await client.query('COMMIT')
    console.log('[20260710_010] Deduped live subscriptions.')
    console.log('  Users with duplicates before:', before.rows.length)
    console.log('  Users with duplicates after:', after.rows.length)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260710_010] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
