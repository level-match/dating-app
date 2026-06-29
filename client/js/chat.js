import { store } from './store.js'
import { requireAuth, initBodyFade, showToast } from './app.js'
import { canOpenNewThread, getThreadLimit, showUpgradeModal, currentTier } from './membership-guard.js'

/* ─── Sent-request pending items ────────────────────────────────
   Dynamically inject "Awaiting Response" items into the conv list
   for any connection requests the user sent from the profile page.
   ─────────────────────────────────────────────────────────── */
function buildPendingConvItem(req) {
  const div = document.createElement('div')
  div.className = 'conv-item pending-sent'
  div.dataset.reqId = req.id
  div.innerHTML = `
    <div class="conv-avatar">
      <div class="conv-avatar-img" style="border:1.5px solid rgba(193,164,100,0.38);">
        <div style="width:100%;height:100%;${req.fallback ? `background:${req.fallback};` : ''}"></div>
      </div>
    </div>
    <div class="conv-body">
      <div class="conv-name-row">
        <span class="conv-name">${escapeHtml(req.name)}</span>
        <span class="conv-time" style="color:rgba(193,164,100,0.7);">Pending</span>
      </div>
      <div class="conv-preview" style="color:rgba(193,164,100,0.65);">
        ⏳ Awaiting their response
      </div>
    </div>`
  div.addEventListener('click', () => openSentRequest(req))
  return div
}

function openSentRequest(req) {
  document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('active'))
  document.querySelector(`.conv-item[data-req-id="${req.id}"]`)?.classList.add('active')

  const firstName = req.name.split(' ')[0]
  document.getElementById('chatMain').innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div class="chat-topbar">
        <div class="chat-topbar-user">
          <div style="width:44px;height:44px;border-radius:50%;overflow:hidden;border:1.5px solid var(--border-gold);">
            <div style="width:100%;height:100%;${req.fallback ? `background:${req.fallback};` : ''}"></div>
          </div>
          <div>
            <div class="chat-topbar-name">${escapeHtml(req.name)}</div>
            <div class="chat-topbar-info">${escapeHtml(req.role)} · ${escapeHtml(req.location)} · ${req.score}% match</div>
          </div>
        </div>
      </div>

      <!-- Awaiting banner -->
      <div style="padding:18px 28px;background:linear-gradient(120deg,rgba(193,164,100,0.06),rgba(193,164,100,0.10));border-bottom:1px solid rgba(193,164,100,0.18);">
        <div style="display:flex;align-items:center;gap:14px;max-width:760px;margin:0 auto;">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(193,164,100,0.15);border:1px solid rgba(193,164,100,0.40);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="font-size:16px;">⏳</span>
          </div>
          <div style="flex:1;">
            <div style="font-family:var(--font-sans);font-size:0.66rem;letter-spacing:0.20em;text-transform:uppercase;color:var(--gold-300);font-weight:600;margin-bottom:2px;">
              Awaiting response from ${escapeHtml(firstName)}
            </div>
            <div style="font-family:var(--font-sans);font-size:0.88rem;font-weight:300;color:rgba(255,255,255,0.65);line-height:1.55;">
              Your connection request is out there. Most members respond within a day — we'll notify you the moment they do.
            </div>
          </div>
        </div>
      </div>

      <!-- Empty thread placeholder -->
      <div class="chat-messages" style="flex:1;display:flex;align-items:center;justify-content:center;text-align:center;padding:var(--s-12);">
        <div style="max-width:380px;">
          <div style="font-size:42px;margin-bottom:var(--s-4);opacity:0.5;">✦</div>
          <div style="font-family:var(--font-serif);font-size:1.5rem;font-weight:300;color:var(--cream-50);letter-spacing:-0.01em;margin-bottom:var(--s-3);">
            A quiet moment — for now.
          </div>
          <div style="font-family:var(--font-sans);font-size:0.92rem;font-weight:300;color:rgba(255,255,255,0.55);line-height:1.7;">
            Your first message with ${escapeHtml(firstName)} will appear here once they accept.
          </div>
        </div>
      </div>

      <!-- Locked input -->
      <div class="chat-locked">
        <div style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;color:var(--text-muted);">
          🔒 Messaging unlocks when ${escapeHtml(firstName)} accepts your request
        </div>
      </div>
    </div>`
}

function injectSentRequests() {
  const requests = store.getSentRequests()
  if (!requests.length) return

  const convList = document.getElementById('convList')
  if (!convList) return

  // Find the "Connection Requests" section header to insert above it
  const allDivs   = Array.from(convList.children)
  const reqHeader = allDivs.find(el => el.textContent.trim() === 'Connection Requests')

  // Build "Awaiting Response" section
  const section = document.createElement('div')
  section.id = 'awaitingResponseSection'

  const header = document.createElement('div')
  header.style.cssText = 'padding:var(--s-4) var(--s-6) var(--s-2);font-family:var(--font-sans);font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold-500);background:rgba(193,164,100,0.04);border-bottom:1px solid var(--border-light);'
  header.textContent = `Awaiting Response (${requests.length})`
  section.appendChild(header)

  requests.forEach(req => section.appendChild(buildPendingConvItem(req)))

  if (reqHeader) {
    convList.insertBefore(section, reqHeader)
  } else {
    convList.appendChild(section)
  }
}

/* Handle ?pending=memberId — auto-open the pending conversation on redirect */
function openPendingFromUrl() {
  const pendingId = new URLSearchParams(window.location.search).get('pending')
  if (!pendingId) return
  const req = store.getSentRequests().find(r => r.id === pendingId)
  if (req) {
    // Small delay to let the DOM render first
    requestAnimationFrame(() => openSentRequest(req))
  }
}

requireAuth()
initBodyFade()

/* ─── Request metadata (shared by accept / decline / open) ──── */
const REQUEST_MAP = {
  marcus: {
    id: 3, name: 'Marcus L.',
    info: 'Senior Partner · 40 · NYC',
    score: 91,
    bg:   'linear-gradient(135deg,#12180A,#0A1005)',
    desc: 'Marcus is a Senior Partner at a New York law firm. You share 91% compatibility alignment.',
  },
  ryan: {
    id: 5, name: 'Ryan M.',
    info: 'Cardiologist · 37 · Boston',
    score: 88,
    bg:   'linear-gradient(135deg,#1A2030,#101520)',
    desc: 'Ryan is a Cardiologist in Boston. You share 88% compatibility. He travels frequently to NYC.',
  },
}

/** Active conversation id (1 = James T. by default) */
let activeConvId = 1

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/* ─── Messages rendering ─────────────────────────────────────── */
function renderMessages(matchId) {
  const messages = store.getMessages(matchId)
  const area = document.getElementById('messagesArea')
  if (!area) return

  area.innerHTML = '<div class="chat-date-divider"><div class="chat-date-label">Today — May 10</div></div>'

  messages.forEach(msg => {
    const row = document.createElement('div')
    row.className = `msg-row ${msg.from === 'me' ? 'sent' : 'received'}`
    if (msg.from === 'them') {
      row.innerHTML = `
        <div class="msg-avatar">
          <div style="width:100%;height:100%;background:linear-gradient(135deg,#1A0F08,#140C06);border-radius:50%;"></div>
        </div>
        <div class="msg-content">
          <div class="msg-bubble-text">${escapeHtml(msg.text)}</div>
          <div class="msg-time">${msg.time}</div>
        </div>`
    } else {
      row.innerHTML = `
        <div class="msg-content">
          <div class="msg-bubble-text">${escapeHtml(msg.text)}</div>
          <div class="msg-time">${msg.time} ✓✓</div>
        </div>`
    }
    area.appendChild(row)
  })

  // Typing indicator
  const typing = document.createElement('div')
  typing.className = 'typing-indicator'
  typing.id = 'typingIndicator'
  typing.style.display = 'none'
  typing.innerHTML = `
    <div class="msg-avatar">
      <div style="width:32px;height:32px;background:linear-gradient(135deg,#1A0F08,#140C06);border-radius:50%;"></div>
    </div>
    <div class="typing-bubble">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`
  area.appendChild(typing)

  area.scrollTop = area.scrollHeight
}

window.openConv = function(id) {
  const convMap = { james: 1, david: 2, oliver: 3 }
  const targetId = convMap[id] || 1

  /* Thread limit gate: Base tier is capped at 3 concurrent threads.
     Only block when the user is trying to open a thread that isn't
     already open (i.e. a genuinely new one). */
  if (targetId !== activeConvId && !canOpenNewThread()) {
    const limit = getThreadLimit()
    showUpgradeModal({
      requiredTier: 'plus',
      title: `Your plan supports ${limit} active thread${limit === 1 ? '' : 's'}`,
      body: `Upgrade to <strong>LEVEL Plus</strong> for unlimited conversations and unmatch history.`,
    })
    return
  }

  document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('active'))
  if (event?.currentTarget) event.currentTarget.classList.add('active')

  activeConvId = targetId
  renderMessages(activeConvId)
}

/* ─── Request: open / accept / decline ───────────────────────── */
window.openRequest = function(id) {
  document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('active'))
  if (event?.currentTarget) event.currentTarget.classList.add('active')

  const req = REQUEST_MAP[id]
  if (!req) return

  document.getElementById('chatMain').innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div class="chat-topbar">
        <div class="chat-topbar-user">
          <div style="width:44px;height:44px;border-radius:50%;overflow:hidden;border:1.5px solid var(--border-gold);">
            <div style="width:100%;height:100%;background:${req.bg};"></div>
          </div>
          <div>
            <div class="chat-topbar-name">${escapeHtml(req.name)}</div>
            <div class="chat-topbar-info">${escapeHtml(req.info)} · ${req.score}% match</div>
          </div>
        </div>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:var(--s-8);">
        <div class="connection-request-banner" style="max-width:420px;">
          <div style="font-size:40px;margin-bottom:var(--s-4);">✉️</div>
          <div class="crb-title">${escapeHtml(req.name)} wants to connect</div>
          <div class="crb-desc">${escapeHtml(req.desc)}</div>
          <div style="display:flex;gap:var(--s-3);">
            <button onclick="declineRequest('${id}')" class="btn btn-outline-dark" style="flex:1;justify-content:center;">Decline</button>
            <button onclick="acceptRequest('${id}')" class="btn btn-gold" style="flex:1;justify-content:center;">Accept &amp; Message</button>
          </div>
          <a href="profile.html" style="display:block;margin-top:var(--s-4);font-family:var(--font-sans);font-size:var(--text-xs);color:var(--text-muted);text-decoration:underline;text-underline-offset:2px;text-align:center;">View full profile first</a>
        </div>
      </div>
      <div class="chat-locked">
        <div style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;color:var(--text-muted);">🔒 Accept the connection request to start messaging</div>
      </div>
    </div>`
}

/**
 * Replace the request conv-item in the sidebar with an active conversation
 * item showing a "Waiting…" preview, and click-route it to the conversation
 * view we just opened.
 */
function moveRequestToConversations(reqKey, req) {
  const itemSelector = `.conv-item.request[onclick*="openRequest('${reqKey}')"]`
  const item = document.querySelector(itemSelector)
  if (!item) return

  // Build a new conversation item
  const conv = document.createElement('div')
  conv.className = 'conv-item active'
  conv.setAttribute('data-conv-key', reqKey)
  conv.setAttribute('onclick', `reopenPending('${reqKey}')`)
  conv.innerHTML = `
    <div class="conv-avatar">
      <div class="conv-avatar-img" style="border:1.5px solid rgba(85,226,233,0.42);">
        <div style="width:100%;height:100%;background:${req.bg};"></div>
      </div>
    </div>
    <div class="conv-body">
      <div class="conv-name-row">
        <span class="conv-name">${escapeHtml(req.name)}</span>
        <span class="conv-time">Now</span>
      </div>
      <div class="conv-preview" style="color:#55E2E9;">⏳ Waiting for ${escapeHtml(req.name.split(' ')[0])} to accept</div>
    </div>
  `

  // Insert near the top of the conversation list (above the requests header).
  // Strategy: place it right before the existing "Connection Requests" header.
  const requestsHeader = Array.from(document.querySelectorAll('.conv-list > div'))
    .find(el => el.textContent.trim() === 'Connection Requests')
  if (requestsHeader) {
    requestsHeader.parentNode.insertBefore(conv, requestsHeader)
  } else {
    item.parentNode.insertBefore(conv, item)
  }

  // Remove the original request entry
  item.remove()

  // Hide the Connection Requests section header if no requests remain
  hideRequestsHeaderIfEmpty()
}

function hideRequestsHeaderIfEmpty() {
  const remainingRequests = document.querySelectorAll('.conv-item.request')
  if (remainingRequests.length === 0) {
    const header = Array.from(document.querySelectorAll('.conv-list > div'))
      .find(el => el.textContent.trim() === 'Connection Requests')
    if (header) header.style.display = 'none'
  }
}

/** Re-render the pending conversation when the user clicks the new conv item. */
window.reopenPending = function(reqKey) {
  const req = REQUEST_MAP[reqKey]
  if (!req) return
  document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('active'))
  if (event?.currentTarget) event.currentTarget.classList.add('active')
  renderPendingConversation(reqKey, req)
}

/**
 * Render the messages view for a freshly-accepted request whose other party
 * has not yet accepted. The message thread is still locked, but the view is
 * the conversation view (not the request banner).
 */
function renderPendingConversation(reqKey, req) {
  const firstName = req.name.split(' ')[0]
  document.getElementById('chatMain').innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div class="chat-topbar">
        <div class="chat-topbar-user">
          <div style="width:44px;height:44px;border-radius:50%;overflow:hidden;border:1.5px solid var(--border-gold);">
            <div style="width:100%;height:100%;background:${req.bg};"></div>
          </div>
          <div>
            <div class="chat-topbar-name">${escapeHtml(req.name)}</div>
            <div class="chat-topbar-info">${escapeHtml(req.info)} · ${req.score}% match</div>
          </div>
        </div>
        <div class="chat-topbar-actions">
          <div class="chat-topbar-btn" title="View Profile" onclick="window.location='profile.html'">👤</div>
          <div class="chat-topbar-btn" title="More options">⋯</div>
        </div>
      </div>

      <!-- Waiting banner -->
      <div style="padding:18px 28px;background:linear-gradient(120deg, rgba(85,226,233,0.06), rgba(4,150,199,0.10));border-bottom:1px solid rgba(85,226,233,0.18);">
        <div style="display:flex;align-items:center;gap:14px;max-width:760px;margin:0 auto;">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(4,150,199,0.18);border:1px solid rgba(85,226,233,0.40);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="font-size:16px;">⏳</span>
          </div>
          <div style="flex:1;">
            <div style="font-family:var(--font-sans);font-size:0.66rem;letter-spacing:0.20em;text-transform:uppercase;color:#55E2E9;font-weight:600;margin-bottom:2px;">
              Waiting for ${escapeHtml(firstName)}
            </div>
            <div style="font-family:var(--font-sans);font-size:0.88rem;font-weight:300;color:rgba(255,255,255,0.65);line-height:1.55;">
              You accepted the connection. We've notified ${escapeHtml(firstName)} — messaging unlocks the moment they accept too.
            </div>
          </div>
        </div>
      </div>

      <!-- Empty thread placeholder -->
      <div class="chat-messages" id="messagesArea" style="display:flex;align-items:center;justify-content:center;text-align:center;padding:var(--s-12);">
        <div style="max-width:380px;">
          <div style="font-size:42px;margin-bottom:var(--s-4);opacity:0.6;">◇</div>
          <div style="font-family:var(--font-serif);font-size:1.5rem;font-weight:300;color:var(--cream-50);letter-spacing:-0.01em;margin-bottom:var(--s-3);">
            A quiet moment — for now.
          </div>
          <div style="font-family:var(--font-sans);font-size:0.92rem;font-weight:300;color:rgba(255,255,255,0.55);line-height:1.7;">
            Your first message will appear here once ${escapeHtml(firstName)} accepts. Most members reply within a day.
          </div>
        </div>
      </div>

      <!-- Locked input -->
      <div class="chat-locked" style="border-top:1px solid var(--border-light);padding:18px 24px;display:flex;align-items:center;justify-content:center;gap:10px;background:rgba(255,255,255,0.02);">
        <span style="font-size:14px;">🔒</span>
        <span style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;color:var(--text-muted);">
          Messaging is locked until ${escapeHtml(firstName)} accepts your request.
        </span>
      </div>
    </div>
  `
}

window.acceptRequest = function(id) {
  const req = REQUEST_MAP[id]
  if (!req) return

  /* Thread limit gate: accepting a request opens a new thread. */
  if (!canOpenNewThread()) {
    const limit = getThreadLimit()
    showUpgradeModal({
      requiredTier: 'plus',
      title: `Thread limit reached (${limit} active)`,
      body: `Upgrade to <strong>LEVEL Plus</strong> to accept more connections — unlimited threads, plus unmatch history.`,
    })
    return
  }

  // Mark as pending the other party — for the demo this is the default state.
  store.updateMatchStatus(req.id, 'pending_other')

  // Move sidebar item from requests → conversations (with "Waiting…" preview)
  moveRequestToConversations(id, req)

  // Switch the main panel to the messages view (with waiting banner + locked input)
  activeConvId = req.id
  renderPendingConversation(id, req)

  showToast(`Connection accepted — waiting for ${req.name.split(' ')[0]} to accept too.`, '✦', 3000)
}

window.declineRequest = function(id) {
  const req = REQUEST_MAP[id]
  if (!req) return

  store.updateMatchStatus(req.id, 'passed')

  // Remove the request conv-item from the sidebar
  const item = document.querySelector(`.conv-item.request[onclick*="openRequest('${id}')"]`)
  if (item) item.remove()
  hideRequestsHeaderIfEmpty()

  showToast(`Request from ${req.name.split(' ')[0]} declined.`, '✓', 2500)

  // Reset the chat main to the first active conversation
  const firstConv = document.querySelector('.conv-item:not(.request)')
  if (firstConv) {
    firstConv.click()
  } else {
    document.getElementById('chatMain').innerHTML = `
      <div style="height:100%;display:flex;align-items:center;justify-content:center;padding:var(--s-12);text-align:center;">
        <div style="max-width:380px;">
          <div style="font-size:42px;margin-bottom:var(--s-4);opacity:0.5;">✉</div>
          <div style="font-family:var(--font-serif);font-size:1.6rem;font-weight:300;color:var(--cream-50);letter-spacing:-0.01em;margin-bottom:var(--s-3);">
            Select a conversation.
          </div>
          <div style="font-family:var(--font-sans);font-size:0.92rem;font-weight:300;color:rgba(255,255,255,0.55);line-height:1.7;">
            Choose a thread from the list to continue, or browse new matches.
          </div>
        </div>
      </div>`
  }
}

window.setConvFilter = function(el, filter) {
  document.querySelectorAll('.conv-filter-tab').forEach(t => t.classList.remove('active'))
  el.classList.add('active')
}

window.sendMessage = function() {
  const input = document.getElementById('messageInput')
  const text = input?.value.trim()
  if (!text) return

  store.addMessage(activeConvId, text)

  const messages = document.getElementById('messagesArea')
  const msgRow = document.createElement('div')
  msgRow.className = 'msg-row sent animate-fadeUp'
  msgRow.innerHTML = `
    <div class="msg-content">
      <div class="msg-bubble-text">${escapeHtml(text)}</div>
      <div class="msg-time">Just now ✓</div>
    </div>`
  messages.insertBefore(msgRow, document.getElementById('typingIndicator'))
  input.value = ''
  autoResize(input)
  messages.scrollTop = messages.scrollHeight

  setTimeout(() => {
    const typing = document.getElementById('typingIndicator')
    if (typing) { typing.style.display = 'flex'; messages.scrollTop = messages.scrollHeight }
  }, 800)
  setTimeout(() => {
    const typing = document.getElementById('typingIndicator')
    if (typing) typing.style.display = 'none'
  }, 3500)
}

window.handleKeyDown = function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendMessage() }
}

window.autoResize = function(el) {
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

function autoResize(el) { window.autoResize(el) }

// Init: render first conversation, inject sent-request pending items, handle redirect
window.addEventListener('load', () => {
  injectSentRequests()
  const hasPendingParam = new URLSearchParams(window.location.search).get('pending')
  if (hasPendingParam) {
    openPendingFromUrl()
  } else {
    renderMessages(activeConvId)
  }
})
