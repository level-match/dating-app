/* ============================================================
   LEVEL — Supabase Realtime (live chat + notifications)
   ============================================================ */

import { supabase } from './supabase.js'
import { apiFetch } from './sso.js'

let appUserId = null
let globalChannel = null
let initPromise = null

const handlers = {
  message: new Set(),
  connection: new Set(),
  read: new Set(),
  any: new Set(),
}

function emit(type, row) {
  handlers[type]?.forEach(fn => {
    try { fn(row) } catch (e) { console.warn('[realtime] handler error:', e) }
  })
  handlers.any.forEach(fn => {
    try { fn(type, row) } catch (e) { console.warn('[realtime] handler error:', e) }
  })
}

function formatMessageTime(date) {
  const d = new Date(date)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

async function ensureAppUserId() {
  if (appUserId) return appUserId
  const res = await apiFetch('/api/auth/me')
  if (!res.ok) throw new Error('Could not load user for realtime')
  const { user } = await res.json()
  appUserId = user.id
  return appUserId
}

export function mapRealtimeMessage(row, viewerUserId = appUserId) {
  const fromMe = row.sender_user_id === viewerUserId
  return {
    id: row.id,
    from: fromMe ? 'me' : 'them',
    text: row.body,
    time: formatMessageTime(row.created_at),
    createdAt: row.created_at,
    read: false,
    showReadReceipt: fromMe,
  }
}

export function onRealtimeEvent(type, handler) {
  const set = handlers[type]
  if (!set) throw new Error(`Unknown realtime event type: ${type}`)
  set.add(handler)
  return () => set.delete(handler)
}

export function getAppUserId() {
  return appUserId
}

export function isRealtimeConnected() {
  return globalChannel?.state === 'joined'
}

async function ensureRealtimeAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  await supabase.realtime.setAuth(session.access_token)
  return session
}

async function attachGlobalChannel() {
  const session = await ensureRealtimeAuth()
  if (!session) {
    console.warn('[realtime] No session — live updates disabled until signed in')
    return
  }

  if (globalChannel) {
    await supabase.removeChannel(globalChannel)
    globalChannel = null
  }

  globalChannel = supabase
    .channel('level-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
      emit('message', payload.new)
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_message_reads' }, payload => {
      emit('read', payload.new)
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'connection_requests' }, payload => {
      emit('connection', payload.new)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'connection_requests' }, payload => {
      emit('connection', payload.new)
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        console.log('[realtime] Live channel connected')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('[realtime] Live channel status:', status)
      }
    })
}

function bindAuthRefresh() {
  if (bindAuthRefresh._bound) return
  bindAuthRefresh._bound = true

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session?.access_token) return
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
      try {
        await supabase.realtime.setAuth(session.access_token)
        if (globalChannel?.state !== 'joined') {
          initPromise = null
          await initRealtime()
        }
      } catch (err) {
        console.warn('[realtime] auth refresh failed:', err.message)
      }
    }
  })
}

/** Start the global realtime channel (idempotent). */
export function initRealtime() {
  bindAuthRefresh()
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await ensureAppUserId()
        await attachGlobalChannel()
      } catch (err) {
        console.warn('[realtime] init failed:', err.message)
        initPromise = null
      }
    })()
  }
  return initPromise
}

export async function subscribeToThread(connectionId, onNewMessage) {
  await initRealtime()
  if (!connectionId || !onNewMessage) return () => {}

  const handler = row => {
    if (row.connection_id === connectionId) onNewMessage(row)
  }
  handlers.message.add(handler)
  return () => handlers.message.delete(handler)
}

export async function unsubscribeFromThread() {
  // Thread handlers are removed via the unsubscribe fn from subscribeToThread.
}

export async function stopRealtime() {
  if (globalChannel) {
    await supabase.removeChannel(globalChannel)
    globalChannel = null
  }
  initPromise = null
}
