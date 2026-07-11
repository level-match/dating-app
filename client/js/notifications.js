import { requireAuth, initBodyFade, initNav, showToast } from './app.js'
import {
  fetchNotificationFeed,
  markNotificationRead,
  markAllNotificationsRead,
} from './notifications-api.js'
import { bootPageLoader, finishPageLoader } from './loading.js'

requireAuth()
initBodyFade()
initNav()

const TYPE_ICONS = {
  match: '◆',
  message: '✉',
  request: '↗',
  view: '◉',
  concierge: '✦',
  system: '✺',
}

const TYPE_LABELS = {
  match: 'Match',
  message: 'Message',
  request: 'Request',
  view: 'Profile view',
  concierge: 'Concierge',
  system: 'System',
}

let currentTab = 'all'
let notifications = []

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]))
}

function relativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.round(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.round(hr / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function renderEmpty() {
  const messages = {
    all: { title: "You're all caught up.", body: "Connection requests, messages, and match updates will appear here." },
    unread: { title: 'No unread notifications.', body: "You've seen everything — beautifully done." },
    match: { title: 'No match alerts.', body: 'When a connection is mutual, it will show up here.' },
    message: { title: 'No message alerts.', body: 'New replies from your connections appear here.' },
    request: { title: 'No connection requests.', body: 'Incoming requests from members will appear here.' },
    concierge: { title: 'Nothing from your concierge.', body: 'Reservation and date confirmations will appear here when available.' },
    system: { title: 'No platform updates.', body: 'Membership and account notices appear here.' },
  }
  const m = messages[currentTab] || messages.all
  return `
    <div class="notif-empty">
      <div class="notif-empty-orb">⌖</div>
      <h3>${m.title}</h3>
      <p>${m.body}</p>
    </div>`
}

function renderCard(n) {
  const icon = TYPE_ICONS[n.type] || '✶'
  const typeLabel = TYPE_LABELS[n.type] || 'Update'
  return `
    <a class="notif-card ${n.read ? 'read' : 'unread'}"
       data-id="${escapeHtml(n.id)}"
       href="${escapeHtml(n.href || '#')}"
       onclick="onNotifClick(event, '${escapeHtml(n.id)}')">
      <div class="notif-icon ${n.type || 'system'}">${icon}</div>
      <div class="notif-body">
        <div class="notif-card-title">${escapeHtml(n.title)}</div>
        <div class="notif-card-text">${escapeHtml(n.body)}</div>
      </div>
      <div class="notif-meta">
        <div class="notif-time">${relativeTime(n.timeISO)}</div>
        <div class="notif-type-pill">${escapeHtml(typeLabel)}</div>
      </div>
    </a>`
}

function refreshCounts() {
  const unread = notifications.filter(n => !n.read).length
  document.getElementById('cntAll')?.textContent = notifications.length
  document.getElementById('cntUnread')?.textContent = unread
  const btn = document.getElementById('markAllBtn')
  if (btn) btn.disabled = unread === 0
}

function render() {
  const list = document.getElementById('notifList')
  if (!list) return

  let filtered = notifications
  if (currentTab === 'unread') filtered = notifications.filter(n => !n.read)
  else if (currentTab !== 'all') filtered = notifications.filter(n => n.type === currentTab)

  refreshCounts()

  if (!filtered.length) {
    list.innerHTML = renderEmpty()
    return
  }

  list.innerHTML = filtered.map(renderCard).join('')
}

window.setNotifTab = function (el, key) {
  document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'))
  el.classList.add('active')
  currentTab = key
  render()
}

window.onNotifClick = async function (ev, id) {
  const item = notifications.find(n => n.id === id)
  if (item) item.read = true
  try {
    await markNotificationRead(id)
  } catch {}
  window.__levelTopbar?.refresh?.()
}

window.markAllRead = async function () {
  try {
    await markAllNotificationsRead()
    notifications = notifications.map(n => ({ ...n, read: true }))
    showToast('All notifications marked as read.', '✓', 2200)
    render()
    window.__levelTopbar?.refresh?.()
  } catch (err) {
    showToast(err.message || 'Could not mark notifications read.', '⚠', 3000)
  }
}

async function bootNotificationsPage() {
  bootPageLoader('Loading notifications')
  try {
    const payload = await fetchNotificationFeed()
    notifications = payload.notifications || []
    render()
  } catch (err) {
    const list = document.getElementById('notifList')
    if (list) {
      list.innerHTML = `
        <div class="notif-empty">
          <h3>Could not load notifications</h3>
          <p>${escapeHtml(err.message || 'Check that you are signed in and the server is running.')}</p>
        </div>`
    }
  } finally {
    finishPageLoader()
  }
}

window.addEventListener('level:notifications-updated', (e) => {
  if (e.detail?.notifications) {
    notifications = e.detail.notifications
    render()
  }
})

bootNotificationsPage()
