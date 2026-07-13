require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'banned'));

CREATE INDEX IF NOT EXISTS idx_users_account_status ON users (account_status);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260713_021] users.account_status ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260713_021] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
