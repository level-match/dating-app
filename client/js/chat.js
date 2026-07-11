import { requireAuth, initBodyFade, showToast } from './app.js'
import {
  canOpenNewThread,
  getThreadLimit,
  showUpgradeModal,
  setActiveThreadCount,
} from './membership-guard.js'
import {
  fetchChatInbox,
  fetchConnectionMessages,
  sendChatMessage,
  acceptConnectionRequest,
  declineConnectionRequest,
} from './chat-api.js'

requireAuth()
initBodyFade()

let conversations = []
let inboxStats = { incoming: 0, active: 0 }
let activeConnectionId = null
let activeConversation = null
let currentFilter = 'all'
let sending = false

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function avatarHtml(conv, { online = false, border = '' } = {}) {
  const style = border ? `border:${border};` : ''
  const inner = conv.photo
    ? `<img src="${escapeHtml(conv.photo)}" alt="${escapeHtml(conv.name)}" style="width:100%;height:100%;object-fit:cover;object-position:center top;">`
    : `<div style="width:100%;height:100%;background:${conv.fallback || 'linear-gradient(160deg,#1A2F4A,#0D1E35)'};"></div>`
  return `
    <div class="conv-avatar">
      <div class="conv-avatar-img" style="${style}">
        ${inner}
      </div>
      ${online ? '<div class="conv-online-dot"></div>' : ''}
    </div>`
}

function topbarInfo(conv) {
  const parts = [conv.profession]
  if (conv.age) parts.push(String(conv.age))
  if (conv.location) parts.push(conv.location)
  const score = conv.score ? ` · ${conv.score}% match` : ''
  return `${escapeHtml(parts.filter(Boolean).join(' · '))}${score}`
}

function filteredConversations() {
  if (currentFilter === 'requests') {
    return conversations.filter(c => c.connectionStatus === 'pending_received')
  }
  if (currentFilter === 'active') {
    return conversations.filter(c => c.connectionStatus === 'mutual')
  }
  return conversations
}

function updateFilterTabs() {
  const tabs = document.querySelectorAll('.conv-filter-tab')
  tabs.forEach(tab => {
    const filter = tab.dataset.filter
    tab.classList.toggle('active', filter === currentFilter)
    if (filter === 'requests') {
      tab.textContent = inboxStats.incoming
        ? `Requests (${inboxStats.incoming})`
        : 'Requests'
    }
  })
}

function renderConvList() {
  const list = document.getElementById('convList')
  if (!list) return

  const items = filteredConversations()
  list.innerHTML = ''

  if (!items.length) {
    list.innerHTML = `
      <div style="padding:var(--s-8) var(--s-6);text-align:center;">
        <div style="font-family:var(--font-serif);font-size:1.1rem;color:var(--cream-50);margin-bottom:var(--s-2);">
          ${currentFilter === 'requests' ? 'No incoming requests' : 'No conversations yet'}
        </div>
        <div style="font-family:var(--font-sans);font-size:0.85rem;color:rgba(255,255,255,0.5);line-height:1.6;">
          ${currentFilter === 'requests'
            ? 'When someone sends you a connection request, it will appear here.'
            : 'Connect with members from your matches to start messaging.'}
        </div>
        <a href="matches.html" class="btn btn-gold btn-sm" style="margin-top:var(--s-4);">Browse matches</a>
      </div>`
    return
  }

  const incoming = items.filter(c => c.connectionStatus === 'pending_received')
  const rest = items.filter(c => c.connectionStatus !== 'pending_received')

  if (incoming.length && currentFilter === 'all') {
    const header = document.createElement('div')
    header.style.cssText = 'padding:var(--s-4) var(--s-6) var(--s-2);font-family:var(--font-sans);font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold-500);background:rgba(212,168,67,0.04);border-bottom:1px solid var(--border-light);'
    header.textContent = `Connection Requests (${incoming.length})`
    list.appendChild(header)
    incoming.forEach(conv => list.appendChild(buildConvItem(conv, { request: true })))
  }

  if (rest.length && currentFilter === 'all') {
    const header = document.createElement('div')
    header.style.cssText = 'padding:var(--s-4) var(--s-6) var(--s-2);font-family:var(--font-sans);font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--slate-400);background:rgba(255,255,255,0.02);border-bottom:1px solid var(--border-light);'
    header.textContent = 'Conversations'
    list.appendChild(header)
  }

  const renderItems = currentFilter === 'all' ? rest : items
  renderItems.forEach(conv => list.appendChild(buildConvItem(conv)))
}

function buildConvItem(conv, { request = false } = {}) {
  const div = document.createElement('div')
  div.className = `conv-item${request ? ' request' : ''}${conv.connectionStatus === 'pending_sent' ? ' pending-sent' : ''}${conv.connectionId === activeConnectionId ? ' active' : ''}`
  div.dataset.connectionId = conv.connectionId

  const previewStyle = request || conv.connectionStatus === 'pending_sent'
    ? 'color:var(--gold-500);'
    : ''

  div.innerHTML = `
    ${avatarHtml(conv, {
      border: request ? '2px solid rgba(212,168,67,0.40)' : conv.connectionStatus === 'pending_sent' ? '1.5px solid rgba(193,164,100,0.38)' : '',
    })}
    <div class="conv-body">
      <div class="conv-name-row">
        <span class="conv-name">${escapeHtml(conv.name)}</span>
        <span class="conv-time">${escapeHtml(conv.previewLabel || '')}</span>
      </div>
      <div class="conv-preview" style="${previewStyle}">${escapeHtml(conv.preview || '')}</div>
    </div>`

  div.addEventListener('click', () => openConnection(conv.connectionId))
  return div
}

function renderEmptyMain() {
  const main = document.getElementById('chatMain')
  if (!main) return
  main.innerHTML = `
    <div class="chat-empty-state" id="chatEmptyState">
      <div style="max-width:380px;text-align:center;padding:var(--s-12);">
        <div style="font-size:42px;margin-bottom:var(--s-4);opacity:0.5;">✉</div>
        <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:300;color:var(--cream-50);letter-spacing:-0.01em;margin-bottom:var(--s-3);">
          Select a conversation
        </div>
        <div style="font-family:var(--font-sans);font-size:0.92rem;font-weight:300;color:rgba(255,255,255,0.55);line-height:1.7;">
          Choose a thread from the list, or browse matches to connect with someone new.
        </div>
      </div>
    </div>`
  const panel = document.getElementById('profilePanel')
  if (panel) panel.style.display = 'none'
}

function renderProfilePanel(conv) {
  const panel = document.getElementById('profilePanel')
  if (!panel) return

  const portrait = conv.photo
    ? `<img src="${escapeHtml(conv.photo)}" alt="${escapeHtml(conv.name)}" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;">`
    : `<div style="width:100%;height:100%;background:${conv.fallback || 'linear-gradient(160deg,#1A2F4A,#0D1E35)'};"></div>`

  panel.style.display = ''
  panel.innerHTML = `
    <div class="profile-panel-header">About ${escapeHtml(conv.name.split(' ')[0])}</div>
    <div class="profile-panel-portrait">
      ${portrait}
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(6,12,26,0.80) 100%);"></div>
      ${conv.score ? `<div style="position:absolute;bottom:var(--s-4);left:var(--s-4);"><div class="badge badge-gold">${conv.score}% Match</div></div>` : ''}
    </div>
    <div class="profile-panel-content">
      <div>
        <div class="pp-name">${escapeHtml(conv.name)}</div>
        <div class="pp-role">${escapeHtml([conv.profession, conv.age, conv.location].filter(Boolean).join(' · '))}</div>
      </div>
      <a href="profile.html?id=${encodeURIComponent(conv.profileId)}" class="btn btn-outline-dark btn-sm" style="width:100%;justify-content:center;">View Full Profile</a>
    </div>`
}

function renderPendingSentView(conv) {
  const firstName = conv.name.split(' ')[0]
  document.getElementById('chatMain').innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div class="chat-topbar">
        <div class="chat-topbar-user">
          <div style="width:44px;height:44px;border-radius:50%;overflow:hidden;border:1.5px solid var(--border-gold);">
            ${conv.photo
              ? `<img src="${escapeHtml(conv.photo)}" alt="" style="width:100%;height:100%;object-fit:cover;">`
              : `<div style="width:100%;height:100%;background:${conv.fallback};"></div>`}
          </div>
          <div>
            <div class="chat-topbar-name">${escapeHtml(conv.name)}</div>
            <div class="chat-topbar-info">${topbarInfo(conv)}</div>
          </div>
        </div>
      </div>
      <div style="padding:18px 28px;background:linear-gradient(120deg,rgba(193,164,100,0.06),rgba(193,164,100,0.10));border-bottom:1px solid rgba(193,164,100,0.18);">
        <div style="max-width:760px;margin:0 auto;font-family:var(--font-sans);font-size:0.88rem;font-weight:300;color:rgba(255,255,255,0.65);line-height:1.55;">
          ⏳ Awaiting response from ${escapeHtml(firstName)}. Messaging unlocks once they accept.
        </div>
      </div>
      <div class="chat-messages" style="flex:1;display:flex;align-items:center;justify-content:center;text-align:center;padding:var(--s-12);">
        <div style="max-width:380px;">
          <div style="font-size:42px;margin-bottom:var(--s-4);opacity:0.5;">✦</div>
          <div style="font-family:var(--font-serif);font-size:1.5rem;font-weight:300;color:var(--cream-50);margin-bottom:var(--s-3);">A quiet moment — for now.</div>
          <div style="font-family:var(--font-sans);font-size:0.92rem;font-weight:300;color:rgba(255,255,255,0.55);line-height:1.7;">
            Your first message with ${escapeHtml(firstName)} will appear here once they accept.
          </div>
        </div>
      </div>
      <div class="chat-locked">
        <div style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;color:var(--text-muted);">
          🔒 Messaging unlocks once ${escapeHtml(firstName)} accepts your request
        </div>
      </div>
    </div>`
  renderProfilePanel(conv)
}

function renderRequestView(conv) {
  document.getElementById('chatMain').innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div class="chat-topbar">
        <div class="chat-topbar-user">
          <div style="width:44px;height:44px;border-radius:50%;overflow:hidden;border:1.5px solid var(--border-gold);">
            ${conv.photo
              ? `<img src="${escapeHtml(conv.photo)}" alt="" style="width:100%;height:100%;object-fit:cover;">`
              : `<div style="width:100%;height:100%;background:${conv.fallback};"></div>`}
          </div>
          <div>
            <div class="chat-topbar-name">${escapeHtml(conv.name)}</div>
            <div class="chat-topbar-info">${topbarInfo(conv)}</div>
          </div>
        </div>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:var(--s-8);">
        <div class="connection-request-banner" style="max-width:420px;">
          <div style="font-size:40px;margin-bottom:var(--s-4);">✉️</div>
          <div class="crb-title">${escapeHtml(conv.name)} wants to connect</div>
          <div class="crb-desc">${conv.score ? `${conv.score}% compatibility alignment.` : 'Review their profile before accepting.'}</div>
          <div style="display:flex;gap:var(--s-3);">
            <button type="button" id="declineRequestBtn" class="btn btn-outline-dark" style="flex:1;justify-content:center;">Decline</button>
            <button type="button" id="acceptRequestBtn" class="btn btn-gold" style="flex:1;justify-content:center;">Accept &amp; Message</button>
          </div>
          <a href="profile.html?id=${encodeURIComponent(conv.profileId)}" style="display:block;margin-top:var(--s-4);font-family:var(--font-sans);font-size:var(--text-xs);color:var(--text-muted);text-decoration:underline;text-underline-offset:2px;text-align:center;">View full profile first</a>
        </div>
      </div>
      <div class="chat-locked">
        <div style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;color:var(--text-muted);">
          🔒 Accept their request to unlock messaging — both sides must agree to connect
        </div>
      </div>
    </div>`

  document.getElementById('acceptRequestBtn')?.addEventListener('click', () => acceptIncoming(conv))
  document.getElementById('declineRequestBtn')?.addEventListener('click', () => declineIncoming(conv))
  renderProfilePanel(conv)
}

function renderActiveChat(conv, messages, canMessage) {
  document.getElementById('chatMain').innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div class="chat-topbar">
        <div class="chat-topbar-user">
          <div style="width:44px;height:44px;border-radius:50%;overflow:hidden;border:1.5px solid var(--border-gold);">
            ${conv.photo
              ? `<img src="${escapeHtml(conv.photo)}" alt="" style="width:100%;height:100%;object-fit:cover;">`
              : `<div style="width:100%;height:100%;background:${conv.fallback};"></div>`}
          </div>
          <div>
            <div class="chat-topbar-name">${escapeHtml(conv.name)}</div>
            <div class="chat-topbar-info">${topbarInfo(conv)}</div>
          </div>
        </div>
        <div class="chat-topbar-actions">
          <div class="chat-topbar-btn" title="View Profile" onclick="window.location='profile.html?id=${encodeURIComponent(conv.profileId)}'">👤</div>
        </div>
      </div>
      <div class="chat-messages" id="messagesArea"></div>
      ${canMessage ? `
      <div class="chat-input-area" id="chatInputArea">
        <div class="chat-input-row">
          <textarea class="chat-input-field" placeholder="Write something thoughtful..." rows="1" id="messageInput"></textarea>
          <div class="chat-input-actions">
            <div class="chat-send-btn" id="sendMessageBtn">→</div>
          </div>
        </div>
        <div class="chat-input-extras">
          <div class="chat-input-hint">Press Enter to send · Shift+Enter for new line</div>
        </div>
      </div>` : `
      <div class="chat-locked">
        <div style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;color:var(--text-muted);">🔒 Messaging is locked for this connection</div>
      </div>`}
    </div>`

  renderMessages(messages, conv)
  renderProfilePanel(conv)

  if (canMessage) {
    const input = document.getElementById('messageInput')
    const sendBtn = document.getElementById('sendMessageBtn')
    sendBtn?.addEventListener('click', () => sendMessage())
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    })
    input?.addEventListener('input', () => autoResize(input))
  }
}

function renderMessages(messages, conv) {
  const area = document.getElementById('messagesArea')
  if (!area) return

  area.innerHTML = ''

  if (!messages.length) {
    area.innerHTML = `
      <div style="flex:1;display:flex;align-items:center;justify-content:center;text-align:center;padding:var(--s-12);width:100%;">
        <div style="max-width:380px;">
          <div style="font-size:42px;margin-bottom:var(--s-4);opacity:0.5;">◇</div>
          <div style="font-family:var(--font-serif);font-size:1.5rem;font-weight:300;color:var(--cream-50);margin-bottom:var(--s-3);">Start the conversation</div>
          <div style="font-family:var(--font-sans);font-size:0.92rem;font-weight:300;color:rgba(255,255,255,0.55);line-height:1.7;">
            Say hello to ${escapeHtml(conv.name.split(' ')[0])} — thoughtful first messages go a long way.
          </div>
        </div>
      </div>`
    return
  }

  messages.forEach(msg => {
    const row = document.createElement('div')
    row.className = `msg-row ${msg.from === 'me' ? 'sent' : 'received'}`
    row.innerHTML = `
      <div class="msg-content">
        <div class="msg-bubble-text">${escapeHtml(msg.text)}</div>
        <div class="msg-time">${escapeHtml(msg.time)}${msg.from === 'me' ? ' ✓' : ''}</div>
      </div>`
    area.appendChild(row)
  })

  area.scrollTop = area.scrollHeight
}

async function openConnection(connectionId) {
  const conv = conversations.find(c => c.connectionId === connectionId)
  if (!conv) return

  activeConnectionId = connectionId
  activeConversation = conv
  document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('active'))
  document.querySelector(`.conv-item[data-connection-id="${connectionId}"]`)?.classList.add('active')

  if (conv.connectionStatus === 'pending_sent') {
    renderPendingSentView(conv)
    return
  }

  if (conv.connectionStatus === 'pending_received') {
    renderRequestView(conv)
    return
  }

  try {
    const payload = await fetchConnectionMessages(connectionId)
    activeConversation = payload.connection || conv

    if (payload.canMessage !== true || activeConversation.connectionStatus !== 'mutual') {
      if (activeConversation.connectionStatus === 'pending_sent') {
        renderPendingSentView(activeConversation)
      } else if (activeConversation.connectionStatus === 'pending_received') {
        renderRequestView(activeConversation)
      } else {
        renderActiveChat(activeConversation, [], false)
      }
      return
    }

    renderActiveChat(activeConversation, payload.messages || [], true)
  } catch (err) {
    showToast(err.message || 'Could not load messages.', '⚠', 3500)
  }
}

async function acceptIncoming(conv) {
  if (!canOpenNewThread()) {
    const limit = getThreadLimit()
    showUpgradeModal({
      requiredTier: 'plus',
      title: `Thread limit reached (${limit} active)`,
      body: 'Upgrade to <strong>LEVEL Plus</strong> to accept more connections.',
    })
    return
  }

  try {
    await acceptConnectionRequest(conv.profileId)
    showToast(`Connected with ${conv.name.split(' ')[0]}.`, '✦', 2500)
    await loadInbox()
    await openConnection(conv.connectionId)
  } catch (err) {
    showToast(err.message || 'Could not accept the request.', '⚠', 3500)
  }
}

async function declineIncoming(conv) {
  try {
    await declineConnectionRequest(conv.profileId)
    showToast(`Request from ${conv.name.split(' ')[0]} declined.`, '✓', 2500)
    activeConnectionId = null
    activeConversation = null
    await loadInbox()
    renderEmptyMain()
  } catch (err) {
    showToast(err.message || 'Could not decline the request.', '⚠', 3500)
  }
}

async function sendMessage() {
  if (sending || !activeConnectionId) return

  if (activeConversation?.connectionStatus !== 'mutual' || activeConversation?.canMessage !== true) {
    showToast('Messaging unlocks once you both accept the connection.', '⚠', 3500)
    return
  }

  const input = document.getElementById('messageInput')
  const text = input?.value.trim()
  if (!text) return

  sending = true
  try {
    const result = await sendChatMessage(activeConnectionId, text)
    input.value = ''
    autoResize(input)

    const area = document.getElementById('messagesArea')
    const emptyHint = area?.querySelector('[style*="Start the conversation"]')
    if (emptyHint) area.innerHTML = ''

    const msg = result.message
    const row = document.createElement('div')
    row.className = 'msg-row sent animate-fadeUp'
    row.innerHTML = `
      <div class="msg-content">
        <div class="msg-bubble-text">${escapeHtml(msg.text)}</div>
        <div class="msg-time">${escapeHtml(msg.time)} ✓</div>
      </div>`
    area?.appendChild(row)
    area.scrollTop = area.scrollHeight

    await loadInbox()
  } catch (err) {
    showToast(err.message || 'Could not send message.', '⚠', 3500)
  } finally {
    sending = false
  }
}

function autoResize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

async function loadInbox() {
  const payload = await fetchChatInbox()
  conversations = payload.conversations || []
  inboxStats = payload.stats || { incoming: 0, active: 0 }
  setActiveThreadCount(inboxStats.active || 0)
  updateFilterTabs()
  renderConvList()
}

function resolveDeepLink() {
  const params = new URLSearchParams(window.location.search)
  const connectionId = params.get('connection')
  const pendingProfileId = params.get('pending')

  if (connectionId) {
    const conv = conversations.find(c => c.connectionId === connectionId)
    if (conv) return openConnection(connectionId)
  }

  if (pendingProfileId) {
    const conv = conversations.find(c => c.profileId === pendingProfileId)
    if (conv) return openConnection(conv.connectionId)
  }

  const first = filteredConversations()[0]
  if (first) return openConnection(first.connectionId)
}

function bindFilters() {
  document.querySelectorAll('.conv-filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentFilter = tab.dataset.filter || 'all'
      updateFilterTabs()
      renderConvList()
    })
  })
}

window.addEventListener('load', async () => {
  bindFilters()
  try {
    await loadInbox()
    await resolveDeepLink()
  } catch (err) {
    showToast(err.message || 'Could not load messages.', '⚠', 4000)
    const list = document.getElementById('convList')
    if (list) {
      list.innerHTML = `
        <div style="padding:var(--s-8) var(--s-6);text-align:center;color:rgba(255,255,255,0.55);">
          ${escapeHtml(err.message || 'Could not load your inbox.')}
        </div>`
    }
  }
})
