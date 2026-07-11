/* ============================================================
   LEVEL — Live topbar (messages + notifications badges & polling)
   ============================================================ */

import { fetchNotificationFeed } from './notifications-api.js'

const POLL_MS = 20_000

let state = {
  notifications: [],
  messagePreviews: [],
  stats: { unreadNotifications: 0, unreadMessages: 0, incomingRequests: 0, activeChats: 0 },
  loaded: false,
  error: null,
}

let pollTimer = null

function escapeText(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]))
}

function avatarStyle(item) {
  if (item.photo) {
    return `background-image:url('${String(item.photo).replace(/'/g, '%27')}');background-size:cover;background-position:center;`
  }
  return `background:${item.fallback || 'linear-gradient(135deg,#1A2F4A,#0D1E35)'};`
}

function updateBadges() {
  const msgCount = state.stats.unreadMessages || 0
  const notifCount = state.stats.unreadNotifications || 0

  document.querySelectorAll('.topbar-icon-btn').forEach(btn => {
    const path = btn.querySelector('svg path')?.getAttribute('d') || ''
    const isMessage = path.includes('M8 12h.01')
    const isBell = path.includes('M15 17h5')
    if (!isMessage && !isBell) return

    const anchor = btn.closest('a') || btn
    let dot = anchor.querySelector('.notif-dot')
    const count = isMessage ? msgCount : isBell ? notifCount : 0

    if (count > 0) {
      if (!dot) {
        dot = document.createElement('div')
        dot.className = 'notif-dot'
        anchor.appendChild(dot)
      }
      dot.style.display = ''
      dot.dataset.count = String(count)
    } else if (dot) {
      dot.style.display = 'none'
    }
  })

  const sidebarNotifBadge = document.querySelector('.sidebar-item[href="notifications.html"] .sidebar-badge')
  if (sidebarNotifBadge) {
    if (notifCount > 0) {
      sidebarNotifBadge.textContent = String(notifCount)
      sidebarNotifBadge.style.display = ''
    } else {
      sidebarNotifBadge.style.display = 'none'
    }
  }

  const sidebarChatBadge = document.querySelector('.sidebar-item[href="chat.html"] .sidebar-badge')
  if (sidebarChatBadge) {
    if (msgCount > 0) {
      sidebarChatBadge.textContent = String(msgCount)
      sidebarChatBadge.style.display = ''
    } else {
      sidebarChatBadge.style.display = 'none'
    }
  }
}

function buildPopoverLoadingHtml(kind) {
  const title = kind === 'messages' ? 'Messages' : 'Notifications'
  const footer = kind === 'messages'
    ? '<div class="tbp-footer"><a href="chat.html">View all messages →</a></div>'
    : '<div class="tbp-footer"><a href="notifications.html">See all activity →</a></div>'

  return `
    <div class="tbp-header">
      <span class="tbp-title">${title}</span>
      <span class="tbp-meta">Loading</span>
    </div>
    <div class="tbp-body tbp-body--loading">
      <div class="tbp-loading">
        <div class="level-spinner" style="width:34px;height:34px" role="status" aria-label="Loading"></div>
      </div>
    </div>
    ${footer}`
}

function buildPopoverErrorHtml(kind, message) {
  const title = kind === 'messages' ? 'Messages' : 'Notifications'
  const footer = kind === 'messages'
    ? '<div class="tbp-footer"><a href="chat.html">View all messages →</a></div>'
    : '<div class="tbp-footer"><a href="notifications.html">See all activity →</a></div>'

  return `
    <div class="tbp-header">
      <span class="tbp-title">${title}</span>
    </div>
    <div class="tbp-body">
      <div class="tbp-empty">${escapeText(message || 'Could not load. Try again.')}</div>
    </div>
    ${footer}`
}

function buildMessagesPopoverHtml() {
  const items = state.messagePreviews || []
  const unreadCt = state.stats.unreadMessages || 0

  if (!items.length) {
    return `
      <div class="tbp-header">
        <span class="tbp-title">Messages</span>
        <span class="tbp-meta">Inbox</span>
      </div>
      <div class="tbp-body"><div class="tbp-empty">No conversations yet.</div></div>
      <div class="tbp-footer"><a href="chat.html">Open messages →</a></div>`
  }

  return `
    <div class="tbp-header">
      <span class="tbp-title">Messages</span>
      <span class="tbp-meta">${unreadCt ? `${unreadCt} need attention` : 'All caught up'}</span>
    </div>
    <div class="tbp-body">
      ${items.slice(0, 5).map(m => `
        <a class="tbp-item" href="${escapeText(m.href)}">
          <div class="tbp-avatar" style="${avatarStyle(m)}">
            ${m.unread ? '<div class="dot"></div>' : ''}
          </div>
          <div>
            <div class="tbp-name">${escapeText(m.name)}</div>
            <div class="tbp-sub">${escapeText(m.preview)}</div>
          </div>
          <div class="tbp-time">${escapeText(m.time || '')}</div>
        </a>`).join('')}
    </div>
    <div class="tbp-footer"><a href="chat.html">View all messages →</a></div>`
}

function buildNotificationsPopoverHtml() {
  const items = (state.notifications || []).slice(0, 5)
  const unreadCt = state.stats.unreadNotifications || 0
  const ICON = { match: '◆', message: '✉', request: '↗', view: '◉', concierge: '✦', system: '✺' }

  return `
    <div class="tbp-header">
      <span class="tbp-title">Notifications</span>
      <span class="tbp-meta">${unreadCt ? `${unreadCt} new` : 'All caught up'}</span>
    </div>
    <div class="tbp-body">
      ${items.length ? items.map(n => `
        <a class="tbp-item ${n.read ? '' : 'unread'}" href="${escapeText(n.href || 'notifications.html')}">
          <div class="tbp-nicon ${n.type || 'system'}">${ICON[n.type] || '✶'}</div>
          <div>
            <div class="tbp-name">${escapeText(n.title)}</div>
            <div class="tbp-sub">${escapeText(n.body || '')}</div>
          </div>
          <div class="tbp-time">${escapeText(n.previewLabel || '')}</div>
        </a>`).join('') : `<div class="tbp-empty">You're all caught up.</div>`}
    </div>
    <div class="tbp-footer"><a href="notifications.html">See all activity →</a></div>`
}

async function refreshFeed() {
  try {
    const payload = await fetchNotificationFeed()
    state = {
      notifications: payload.notifications || [],
      messagePreviews: payload.messagePreviews || [],
      stats: payload.stats || state.stats,
      loaded: true,
      error: null,
    }
    updateBadges()

    const msgPop = document.getElementById('tbpMessages')
    if (msgPop?.classList.contains('active')) {
      msgPop.innerHTML = buildMessagesPopoverHtml()
    }
    const notifPop = document.getElementById('tbpNotifications')
    if (notifPop?.classList.contains('active')) {
      notifPop.innerHTML = buildNotificationsPopoverHtml()
    }

    window.dispatchEvent(new CustomEvent('level:notifications-updated', { detail: state }))
  } catch (err) {
    state.error = err.message
    console.warn('[topbar-live] refresh failed:', err.message)

    const msgPop = document.getElementById('tbpMessages')
    if (msgPop?.classList.contains('active')) {
      msgPop.innerHTML = buildPopoverErrorHtml('messages', err.message)
    }
    const notifPop = document.getElementById('tbpNotifications')
    if (notifPop?.classList.contains('active')) {
      notifPop.innerHTML = buildPopoverErrorHtml('notifications', err.message)
    }
  }
}

function startPolling() {
  if (pollTimer) return
  refreshFeed()
  pollTimer = window.setInterval(refreshFeed, POLL_MS)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

window.__levelTopbar = {
  getState: () => state,
  refresh: refreshFeed,
  buildMessagesPopoverHtml,
  buildNotificationsPopoverHtml,
  buildPopoverLoadingHtml,
  buildPopoverErrorHtml,
  startPolling,
  stopPolling,
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshFeed()
})

startPolling()

export { refreshFeed, state }
