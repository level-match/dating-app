import { store } from './store.js'
import { requireAuth, initBodyFade, initNav, showToast } from './app.js'

requireAuth()
initBodyFade()
initNav()

const TYPE_ICONS = {
  match:     '◆',
  message:   '✉',
  request:   '↗',
  view:      '◉',
  concierge: '✦',
  system:    '✺',
}

const TYPE_LABELS = {
  match:     'Match',
  message:   'Message',
  request:   'Request',
  view:      'Profile view',
  concierge: 'Concierge',
  system:    'System',
}

let currentTab = 'all'

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
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
    all:       { title: "You're all caught up.",     body: "When new matches, messages, or concierge updates arrive, they'll appear here." },
    unread:    { title: "No unread notifications.",  body: "You've seen everything — beautifully done." },
    match:     { title: "No new match alerts.",      body: "We surface a notification each time a highly compatible match is curated for you." },
    message:   { title: "No new message alerts.",    body: "When a member replies, you'll see a notification here in addition to your inbox." },
    concierge: { title: "Nothing from your concierge.", body: "Reservation confirmations, host requests, and date arrangements appear here." },
    system:    { title: "No platform updates.",      body: "Approval notes, membership tier changes, and account messages live here." },
  }
  const m = messages[currentTab] || messages.all
  return `
    <div class="notif-empty">
      <div class="notif-empty-orb">⌖</div>
      <h3>${m.title}</h3>
      <p>${m.body}</p>
    </div>
  `
}

function renderCard(n) {
  const icon = TYPE_ICONS[n.type] || '✶'
  const typeLabel = TYPE_LABELS[n.type] || 'Update'
  return `
    <a class="notif-card ${n.read ? 'read' : 'unread'}"
       data-id="${n.id}"
       href="${n.href || '#'}"
       onclick="onNotifClick(event, '${n.id}')">
      <div class="notif-icon ${n.type || 'system'}">${icon}</div>
      <div class="notif-body">
        <div class="notif-card-title">${escapeHtml(n.title)}</div>
        <div class="notif-card-text">${escapeHtml(n.body)}</div>
      </div>
      <div class="notif-meta">
        <div class="notif-time">${relativeTime(n.timeISO)}</div>
        <div class="notif-type-pill">${escapeHtml(typeLabel)}</div>
      </div>
    </a>
  `
}

function refreshCounts(all) {
  const unread = all.filter(n => !n.read).length
  document.getElementById('cntAll').textContent    = all.length
  document.getElementById('cntUnread').textContent = unread
  const btn = document.getElementById('markAllBtn')
  if (btn) btn.disabled = unread === 0
}

function render() {
  const list = document.getElementById('notifList')
  if (!list) return

  const all = store.getNotifications()

  let filtered = all
  if (currentTab === 'unread')         filtered = all.filter(n => !n.read)
  else if (currentTab !== 'all')       filtered = all.filter(n => n.type === currentTab)

  refreshCounts(all)

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

window.onNotifClick = function (ev, id) {
  // Allow default href navigation, but mark read first.
  store.markNotificationRead(id)
}

window.markAllRead = function () {
  store.markAllNotificationsRead()
  showToast('All notifications marked as read.', '✓', 2200)
  render()
}

render()
