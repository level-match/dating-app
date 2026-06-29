/**
 * Seeds the default Super Admin account.
 * Run ONCE after 20260629_002_admin_schema.js:
 *   node db/seeds/20260629_001_admin_user.js
 *
 * Default credentials (change immediately after first login):
 *   Email:    admin@level.app
 *   Password: Level@Admin2024!
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const bcrypt = require('bcrypt')
const pool   = require('../pool')

async function seed() {
  const email    = process.env.SEED_ADMIN_EMAIL    || 'admin@level.app'
  const password = process.env.SEED_ADMIN_PASSWORD || 'Level@Admin2024!'
  const hash     = await bcrypt.hash(password, 12)

  const client = await pool.connect()
  try {
    const existing = await client.query('SELECT id FROM admin_users WHERE email = $1', [email])
    if (existing.rows.length) {
      console.log(`[20260629_001] Super admin already exists: ${email}`)
      return
    }
    await client.query(
      `INSERT INTO admin_users (email, password_hash, role, first_name, last_name)
       VALUES ($1, $2, 'super_admin', 'Super', 'Admin')`,
      [email, hash]
    )
    console.log(`[20260629_001] Super admin created: ${email}`)
    console.log(`[20260629_001] Password: ${password}  ← change this immediately.`)
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch(err => { console.error('[20260629_001] Error:', err.message); process.exit(1) })
