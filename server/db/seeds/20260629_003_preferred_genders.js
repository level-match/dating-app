require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const PREFERRED_GENDERS = [
  [1, 'Men'],
  [2, 'Women'],
  [3, 'Non-binary people'],
  [4, 'Trans women'],
  [5, 'Trans men'],
  [6, 'Genderqueer people'],
  [7, 'Everyone'],
]

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const [id, label] of PREFERRED_GENDERS) {
      await client.query(
        `INSERT INTO ref_preferred_genders (id, label) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label`,
        [id, label]
      )
    }
    await client.query('COMMIT')
    console.log(`[20260629_003] ref_preferred_genders: ${PREFERRED_GENDERS.length} rows upserted.`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260629_003] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
