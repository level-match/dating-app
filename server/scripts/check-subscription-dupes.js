require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const pool = require('../db/pool')

async function main() {
  const dupes = await pool.query(`
    SELECT user_id, status, COUNT(*) AS n
    FROM subscriptions
    WHERE status IN ('active', 'pending', 'past_due')
    GROUP BY user_id, status
    HAVING COUNT(*) > 1
    ORDER BY n DESC
  `)
  const perUser = await pool.query(`
    SELECT user_id, COUNT(*) AS live_count
    FROM subscriptions
    WHERE status IN ('active', 'pending', 'past_due')
    GROUP BY user_id
    HAVING COUNT(*) > 1
  `)
  const idx = await pool.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'subscriptions' AND indexname = 'uq_subscriptions_single_active'
  `)
  const sample = await pool.query(`
    SELECT s.id, s.user_id, u.email, s.tier, s.status, s.created_at
    FROM subscriptions s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.status IN ('active', 'pending', 'past_due')
    ORDER BY s.user_id, s.created_at
    LIMIT 40
  `)
  const statusCounts = await pool.query(`
    SELECT status, COUNT(*) AS n FROM subscriptions GROUP BY status ORDER BY n DESC
  `)

  console.log('Status breakdown:', statusCounts.rows)
  console.log('Unique index present:', idx.rows.length > 0, idx.rows[0]?.indexdef || '')
  console.log('Users with >1 live subscription:', perUser.rows)
  console.log('Duplicate live rows per user+status:', dupes.rows)
  console.log('Sample live rows:', sample.rows)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => pool.end())
