require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const fs   = require('fs')
const path = require('path')
const pool = require('../pool')

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, '../admin-schema.sql'), 'utf8')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(schema)
    await client.query('COMMIT')
    console.log('[20260629_002] Admin schema applied.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260629_002] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
