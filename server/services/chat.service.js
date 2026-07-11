const pool = require('../db/pool')
const { createSignedUrl, BUCKET } = require('./storage.service')
const { computeCompatibilityScore, loadViewer } = require('./match.service')

const FALLBACK_GRADIENT = 'linear-gradient(160deg,#1A2F4A,#0D1E35,#1E1008)'

function formatDisplayName(first, last) {
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (!f) return 'Member'
  if (!l) return f
  return `${f} ${l.charAt(0).toUpperCase()}.`
}

function formatRelativeTime(date) {
  if (!date) return ''
  const d = new Date(date)
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatMessageTime(date) {
  const d = new Date(date)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

async function resolvePhotoUrl(row) {
  if (row.primary_photo_path) {
    const objectPath = row.primary_photo_path.replace(`${BUCKET}/`, '')
    const signed = await createSignedUrl(objectPath, 3600)
    if (signed) return signed
  }
  return row.avatar_url || null
}

function mapConnectionRole(connection, viewerUserId) {
  // Messaging is only allowed when status is 'accepted' — i.e. one party sent a
  // request and the other accepted (or both requested and it auto-mutualized).
  if (connection.status === 'accepted') {
    return { status: 'accepted', connectionStatus: 'mutual', canMessage: true }
  }
  if (connection.from_user_id === viewerUserId) {
    return { status: 'pending', connectionStatus: 'pending_sent', canMessage: false }
  }
  return { status: 'request', connectionStatus: 'pending_received', canMessage: false }
}

function assertMutualConnection(connection) {
  if (!connection || connection.status !== 'accepted') {
    const err = new Error(
      'Messaging unlocks once the connection is mutual — they must accept your request, or you must accept theirs.',
    )
    err.code = 'MESSAGING_LOCKED'
    throw err
  }
}

async function loadConnectionForUser(connectionId, viewerUserId) {
  const { rows } = await pool.query(
    `SELECT cr.*,
            p.id AS profile_id,
            p.user_id AS other_user_id,
            p.first_name,
            p.last_name,
            p.professional_title,
            p.location,
            p.city,
            p.region_name,
            p.country_name,
            p.age,
            p.avatar_url,
            ph.storage_path AS primary_photo_path
     FROM connection_requests cr
     JOIN profiles p ON p.user_id = CASE
       WHEN cr.from_user_id = $2 THEN cr.to_user_id
       ELSE cr.from_user_id
     END
     LEFT JOIN user_profile_photos ph
       ON ph.user_id = p.user_id AND ph.is_primary = TRUE
     WHERE cr.id = $1
       AND (cr.from_user_id = $2 OR cr.to_user_id = $2)
       AND cr.status IN ('pending', 'accepted')`,
    [connectionId, viewerUserId],
  )
  return rows[0] || null
}

async function mapInboxRow(row, viewerUserId, viewer) {
  const role = mapConnectionRole(row, viewerUserId)
  const photo = await resolvePhotoUrl(row)
  const location = row.location || [row.city, row.region_name, row.country_name].filter(Boolean).join(', ')
  const score = viewer
    ? computeCompatibilityScore(viewer, { ...row, id: row.profile_id })
    : null

  let preview = ''
  if (row.last_message_body) {
    preview = row.from_user_id === viewerUserId && row.last_sender_user_id === viewerUserId
      ? `You: ${row.last_message_body}`
      : row.last_message_body
  } else if (role.connectionStatus === 'pending_sent') {
    preview = '⏳ Awaiting their response'
  } else if (role.connectionStatus === 'pending_received') {
    preview = '✉ Sent you a connection request'
  } else {
    preview = 'Say hello — your conversation starts here.'
  }

  return {
    connectionId: row.id,
    profileId: row.profile_id,
    status: role.status,
    connectionStatus: role.connectionStatus,
    canMessage: role.canMessage,
    name: formatDisplayName(row.first_name, row.last_name),
    profession: row.professional_title || 'Member',
    location,
    age: row.age,
    score,
    photo,
    fallback: FALLBACK_GRADIENT,
    preview,
    previewAt: row.last_message_at || row.updated_at,
    previewLabel: formatRelativeTime(row.last_message_at || row.updated_at),
  }
}

async function getInbox(viewerUserId) {
  const viewer = await loadViewer(viewerUserId).catch(() => null)

  const { rows } = await pool.query(
    `SELECT
       cr.id,
       cr.status,
       cr.from_user_id,
       cr.to_user_id,
       cr.updated_at,
       p.id AS profile_id,
       p.user_id AS other_user_id,
       p.first_name,
       p.last_name,
       p.professional_title,
       p.location,
       p.city,
       p.region_name,
       p.country_name,
       p.age,
       p.avatar_url,
       ph.storage_path AS primary_photo_path,
       lm.body AS last_message_body,
       lm.created_at AS last_message_at,
       lm.sender_user_id AS last_sender_user_id
     FROM connection_requests cr
     JOIN profiles p ON p.user_id = CASE
       WHEN cr.from_user_id = $1 THEN cr.to_user_id
       ELSE cr.from_user_id
     END
     LEFT JOIN user_profile_photos ph
       ON ph.user_id = p.user_id AND ph.is_primary = TRUE
     LEFT JOIN LATERAL (
       SELECT body, created_at, sender_user_id
       FROM chat_messages
       WHERE connection_id = cr.id
       ORDER BY created_at DESC
       LIMIT 1
     ) lm ON TRUE
     WHERE (cr.from_user_id = $1 OR cr.to_user_id = $1)
       AND cr.status IN ('pending', 'accepted')
     ORDER BY
       CASE WHEN cr.status = 'pending' AND cr.to_user_id = $1 THEN 0 ELSE 1 END,
       COALESCE(lm.created_at, cr.updated_at) DESC`,
    [viewerUserId],
  )

  const conversations = []
  for (const row of rows) {
    conversations.push(await mapInboxRow(row, viewerUserId, viewer))
  }

  const incoming = conversations.filter(c => c.connectionStatus === 'pending_received')
  const active = conversations.filter(c => c.connectionStatus === 'mutual')

  return {
    conversations,
    stats: {
      total: conversations.length,
      incoming: incoming.length,
      active: active.length,
      pendingSent: conversations.filter(c => c.connectionStatus === 'pending_sent').length,
    },
  }
}

async function getMessages(connectionId, viewerUserId) {
  const connection = await loadConnectionForUser(connectionId, viewerUserId)
  if (!connection) {
    const err = new Error('Conversation not found.')
    err.code = 'NOT_FOUND'
    throw err
  }

  if (connection.status !== 'accepted') {
    return {
      connection: await mapInboxRow(
        { ...connection, last_message_body: null, last_message_at: null, last_sender_user_id: null },
        viewerUserId,
        null,
      ),
      messages: [],
      canMessage: false,
    }
  }

  const { rows } = await pool.query(
    `SELECT id, sender_user_id, body, created_at
     FROM chat_messages
     WHERE connection_id = $1
     ORDER BY created_at ASC`,
    [connectionId],
  )

  const messages = rows.map(m => ({
    id: m.id,
    from: m.sender_user_id === viewerUserId ? 'me' : 'them',
    text: m.body,
    time: formatMessageTime(m.created_at),
    createdAt: m.created_at,
  }))

  const viewer = await loadViewer(viewerUserId).catch(() => null)
  const inboxItem = await mapInboxRow(
    { ...connection, last_message_body: null, last_message_at: null, last_sender_user_id: null },
    viewerUserId,
    viewer,
  )

  return { connection: inboxItem, messages, canMessage: true }
}

async function sendMessage(connectionId, viewerUserId, body) {
  const text = String(body || '').trim()
  if (!text) {
    const err = new Error('Message cannot be empty.')
    err.code = 'INVALID_MESSAGE'
    throw err
  }
  if (text.length > 4000) {
    const err = new Error('Message is too long (max 4000 characters).')
    err.code = 'INVALID_MESSAGE'
    throw err
  }

  const connection = await loadConnectionForUser(connectionId, viewerUserId)
  if (!connection) {
    const err = new Error('Conversation not found.')
    err.code = 'NOT_FOUND'
    throw err
  }
  assertMutualConnection(connection)

  const { rows } = await pool.query(
    `INSERT INTO chat_messages (connection_id, sender_user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, sender_user_id, body, created_at`,
    [connectionId, viewerUserId, text],
  )

  const m = rows[0]
  return {
    message: {
      id: m.id,
      from: 'me',
      text: m.body,
      time: formatMessageTime(m.created_at),
      createdAt: m.created_at,
    },
  }
}

async function countActiveThreads(viewerUserId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM connection_requests
     WHERE status = 'accepted'
       AND (from_user_id = $1 OR to_user_id = $1)`,
    [viewerUserId],
  )
  return rows[0]?.count || 0
}

module.exports = {
  getInbox,
  getMessages,
  sendMessage,
  countActiveThreads,
  formatRelativeTime,
}
