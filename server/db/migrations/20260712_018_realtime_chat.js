require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../pool')

const SQL = `
-- Resolve the app users.id from the Supabase auth JWT (auth.uid()).
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM users WHERE external_id = auth.uid()::text LIMIT 1
$$;

-- ─── Row Level Security for Realtime subscriptions ─────────────
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connection_requests_select_participant ON connection_requests;
CREATE POLICY connection_requests_select_participant
  ON connection_requests FOR SELECT TO authenticated
  USING (
    from_user_id = current_app_user_id()
    OR to_user_id = current_app_user_id()
  );

DROP POLICY IF EXISTS chat_messages_select_participant ON chat_messages;
CREATE POLICY chat_messages_select_participant
  ON chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connection_requests cr
      WHERE cr.id = chat_messages.connection_id
        AND (
          cr.from_user_id = current_app_user_id()
          OR cr.to_user_id = current_app_user_id()
        )
    )
  );

DROP POLICY IF EXISTS chat_message_reads_select_participant ON chat_message_reads;
CREATE POLICY chat_message_reads_select_participant
  ON chat_message_reads FOR SELECT TO authenticated
  USING (
    reader_user_id = current_app_user_id()
    OR EXISTS (
      SELECT 1
      FROM chat_messages cm
      JOIN connection_requests cr ON cr.id = cm.connection_id
      WHERE cm.id = chat_message_reads.message_id
        AND cm.sender_user_id = current_app_user_id()
    )
  );

GRANT SELECT ON connection_requests TO authenticated;
GRANT SELECT ON chat_messages TO authenticated;
GRANT SELECT ON chat_message_reads TO authenticated;

-- ─── Supabase Realtime publication ───────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'connection_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE connection_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_message_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reads;
  END IF;
END $$;
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('[20260712_018] Realtime RLS + publication ready.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[20260712_018] Failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
