require('../config/load-env')
const pool = require('../db/pool')

async function main() {
  const pub = await pool.query(`
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' ORDER BY tablename
  `)
  const rls = await pool.query(`
    SELECT relname, relrowsecurity FROM pg_class
    WHERE relname IN ('chat_messages', 'connection_requests', 'chat_message_reads')
  `)
  const pol = await pool.query(`
    SELECT tablename, policyname FROM pg_policies
    WHERE tablename IN ('chat_messages', 'connection_requests', 'chat_message_reads')
    ORDER BY tablename
  `)
  console.log('Publication tables:', pub.rows.map(r => r.tablename))
  console.log('RLS enabled:', rls.rows)
  console.log('Policies:', pol.rows)
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
