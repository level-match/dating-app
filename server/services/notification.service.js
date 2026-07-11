const pool = require('../db/pool')
const chatSvc = require('./chat.service')

async function loadReadSet(userId) {
  const { rows } = await pool.query(
    `SELECT notification_id FROM notification_reads WHERE user_id = $1`,
    [userId],
  )
  return new Set(rows.map(r => r.notification_id))
}

function isUnread(readSet, id) {
  return !readSet.has(id)
}

function buildNotificationRecords(inbox, readSet) {
  const notifications = []

  for (const conv of inbox.conversations || []) {
    const base = {
      connectionId: conv.connectionId,
      profileId: conv.profileId,
      name: conv.name,
      photo: conv.photo,
      fallback: conv.fallback,
      timeISO: conv.previewAt,
      previewLabel: conv.previewLabel,
    }

    if (conv.connectionStatus === 'pending_received') {
      const id = `request:${conv.connectionId}`
      notifications.push({
        id,
        type: 'request',
        title: `${conv.name} wants to connect`,
        body: conv.score
          ? `${conv.score}% compatibility alignment — review and respond when ready.`
          : 'Sent you a connection request.',
        href: `chat.html?connection=${encodeURIComponent(conv.connectionId)}`,
        read: !isUnread(readSet, id),
        ...base,
      })
      continue
    }

    if (conv.connectionStatus !== 'mutual') continue

    const msgId = `message:${conv.connectionId}`
    const matchId = `match:${conv.connectionId}`

    const preview = conv.preview || ''
    const fromThem = preview
      && !preview.startsWith('You:')
      && !preview.startsWith('Say hello')
      && !preview.startsWith('⏳')

    if (fromThem) {
      notifications.push({
        id: msgId,
        type: 'message',
        title: `Message from ${conv.name}`,
        body: preview,
        href: `chat.html?connection=${encodeURIComponent(conv.connectionId)}`,
        read: !isUnread(readSet, msgId),
        ...base,
      })
    } else if (preview.includes('Say hello')) {
      notifications.push({
        id: matchId,
        type: 'match',
        title: `Connected with ${conv.name}`,
        body: 'Messaging is unlocked — say hello when you are ready.',
        href: `chat.html?connection=${encodeURIComponent(conv.connectionId)}`,
        read: !isUnread(readSet, matchId),
        ...base,
      })
    }
  }

  notifications.sort((a, b) => new Date(b.timeISO) - new Date(a.timeISO))
  return notifications
}

function buildMessagePreviews(inbox) {
  return (inbox.conversations || [])
    .filter(c => c.connectionStatus === 'pending_received' || c.connectionStatus === 'mutual')
    .slice(0, 6)
    .map(c => {
      const unread = c.connectionStatus === 'pending_received'
        || (c.preview && !c.preview.startsWith('You:') && !c.preview.includes('Say hello'))
      return {
        connectionId: c.connectionId,
        profileId: c.profileId,
        name: c.name,
        preview: c.preview,
        time: c.previewLabel,
        photo: c.photo,
        fallback: c.fallback,
        unread,
        href: `chat.html?connection=${encodeURIComponent(c.connectionId)}`,
      }
    })
}

async function getNotificationFeed(userId) {
  const inbox = await chatSvc.getInbox(userId)
  const readSet = await loadReadSet(userId)
  const notifications = buildNotificationRecords(inbox, readSet)
  const messagePreviews = buildMessagePreviews(inbox)

  const unreadNotifications = notifications.filter(n => !n.read).length
  const unreadMessages = messagePreviews.filter(m => m.unread).length

  return {
    notifications,
    messagePreviews,
    stats: {
      unreadNotifications,
      unreadMessages,
      incomingRequests: inbox.stats?.incoming || 0,
      activeChats: inbox.stats?.active || 0,
    },
  }
}

async function markRead(userId, notificationId) {
  await pool.query(
    `INSERT INTO notification_reads (user_id, notification_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, notification_id) DO UPDATE SET read_at = NOW()`,
    [userId, notificationId],
  )
}

async function markAllRead(userId, notificationIds) {
  if (!notificationIds.length) return
  await pool.query(
    `INSERT INTO notification_reads (user_id, notification_id)
     SELECT $1, unnest($2::text[])
     ON CONFLICT (user_id, notification_id) DO UPDATE SET read_at = NOW()`,
    [userId, notificationIds],
  )
}

module.exports = {
  getNotificationFeed,
  markRead,
  markAllRead,
}
