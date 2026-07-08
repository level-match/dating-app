/* ============================================================
   LEVEL — App State Store (localStorage-backed)
   ============================================================ */

import { SEED_ACCOUNTS as DEMO_SEED_ACCOUNTS } from './demo-data.js'

const KEYS = {
  USER:          'level_user',
  MATCHES:       'level_matches',
  MESSAGES:      'level_messages',
  BOOKINGS:      'level_bookings',
  ONBOARD:       'level_onboarding',
  ACCOUNTS:      'level_accounts',
  ALIGNMENT:     'level_alignment',
  NOTIFICATIONS: 'level_notifications',
  SETTINGS:      'level_settings',
  SENT_REQUESTS: 'level_sent_requests',
  PAST_DUE:      'level_past_due',
}

const DEFAULT_SETTINGS = {
  privacy: {
    discretionMode: false,
    blockColleagues: true,
    mutualOnlyVisibility: false,
    readReceipts: true,
  },
  notifications: {
    matches: true,
    messages: true,
    requests: true,
    concierge: true,
    system: false,
  },
  appearance: {
    reduceMotion: false,
  },
  account: {
    paused: false,
  },
}

const SEED_ACCOUNTS = DEMO_SEED_ACCOUNTS

/* geoTier drives geographic reach filtering per membership tier:
   local    → Base and above   (same metro)
   national → Plus and above   (same country / regional hubs)
   global   → Prime only       (international) */
const MOCK_MATCHES = [
  { id: 1, name: 'James T.',   role: 'Founder & CEO',         age: 38, city: 'NYC',    score: 96, tone: 'tone-3', status: 'new',       lastSeen: 'Online', geoTier: 'local'    },
  { id: 2, name: 'David K.',   role: 'CTO',                   age: 35, city: 'SF',     score: 91, tone: 'tone-2', status: 'new',       lastSeen: '2h ago',  geoTier: 'national' },
  { id: 3, name: 'Marcus L.',  role: 'Attorney, Partner',     age: 40, city: 'NYC',    score: 88, tone: 'tone-1', status: 'new',       lastSeen: '1h ago',  geoTier: 'local'    },
  { id: 4, name: 'Oliver H.',  role: 'Investment Director',   age: 37, city: 'London', score: 85, tone: 'tone-2', status: 'viewed',    lastSeen: '3h ago',  geoTier: 'global'   },
  { id: 5, name: 'Ryan M.',    role: 'Cardiologist',          age: 34, city: 'Boston', score: 88, tone: 'tone-1', status: 'request',   lastSeen: '8h ago',  geoTier: 'national' },
  { id: 6, name: 'Thomas K.',  role: 'Managing Director',     age: 42, city: 'NYC',    score: 79, tone: 'tone-3', status: 'viewed',    lastSeen: '5h ago',  geoTier: 'local'    },
  { id: 7, name: 'Daniel P.',  role: 'Neurosurgeon',          age: 39, city: 'Boston', score: 91, tone: 'tone-2', status: 'request',   lastSeen: '1h ago',  geoTier: 'national' },
]

const MOCK_NOTIFICATIONS = [
  {
    id: 'n1',
    type: 'match',
    title: 'New high-compatibility match',
    body: 'James T. — Founder & CEO · 96% alignment. Curated this morning.',
    timeISO: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    href: 'matches.html',
    read: false,
  },
  {
    id: 'n2',
    type: 'message',
    title: 'New message from James T.',
    body: '"That sounds wonderful — I know a great place in Tribeca. Friday works for me."',
    timeISO: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    href: 'chat.html',
    read: false,
  },
  {
    id: 'n3',
    type: 'request',
    title: 'Connection request from Daniel P.',
    body: 'Neurosurgeon · Boston · 91% alignment. Awaiting your reply.',
    timeISO: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    href: 'matches.html',
    read: false,
  },
  {
    id: 'n5',
    type: 'concierge',
    title: 'Your concierge confirmed Friday',
    body: 'Tribeca · 7:30 PM. Tap to view, modify, or add a note for the host.',
    timeISO: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    href: 'reservations.html',
    read: true,
  },
  {
    id: 'n6',
    type: 'system',
    title: 'Welcome to LEVEL, Alexandra.',
    body: "You're all set. Your first curated introductions are ready.",
    timeISO: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    href: 'dashboard.html',
    read: true,
  },
]

const MOCK_MESSAGES = {
  1: [
    { from: 'them', text: "I noticed you're based in New York — do you have a favorite neighborhood?", time: '10:14 AM' },
    { from: 'me',   text: "I love the Upper West Side — there's something about being near the park that recharges me.", time: '10:22 AM' },
    { from: 'them', text: "The West Village on Sunday is perfect. I'd love to find out more about what you do outside of work.", time: '10:28 AM' },
    { from: 'me',   text: "I'd love that too. Are you open to grabbing dinner this week?", time: '10:35 AM' },
    { from: 'them', text: "That sounds wonderful — I know a great place in Tribeca. Friday works for me.", time: '2:21 PM' },
  ],
  2: [
    { from: 'them', text: "I'd love to know more about your work in private equity.", time: '9:00 AM' },
    { from: 'me',   text: "Happy to share more! The deals are fascinating but honestly the people are the best part.", time: '9:15 AM' },
  ],
  3: [
    { from: 'them', text: "Your profile is exceptional. Would you be open to connecting?", time: 'Yesterday' },
  ]
}

export const store = {
  getUser() {
    return JSON.parse(localStorage.getItem(KEYS.USER) || 'null')
  },

  setUser(data) {
    localStorage.setItem(KEYS.USER, JSON.stringify(data))
  },

  getDefaultUser() {
    return {
      id: 'me',
      firstName: '',
      lastName: '',
      role: '',
      age: null,
      city: '',
      tier: 'base',
      profileComplete: 0,
      matches: 0,
      messages: 0,
      views: 0,
      connections: 0,
      // Empty defaults for real / direct preview sessions.
      // Demo personas inject name + title via demo-mode.js instead.
      mfa: { required: false, complete: true },
    }
  },

  /* ─── Multi-Factor Authentication (LEVEL Identity Gateway) ───────
     A session created via OAuth carries an `mfa` object that gates access
     until email OTP is verified. Phone factor is reserved for later (SMS):

       mfa: {
         required: true,
         email: { verified: false },
         phone: { verified: false, number: null }, // unused until SMS provider
         complete: false,
       }
       pendingDestination: 'dashboard.html' | 'onboarding.html'
     ─────────────────────────────────────────────────────────────── */

  /* Begin an authenticated-but-ungated session straight out of OAuth. */
  startMfaSession(profile, destination = 'dashboard.html') {
    this.setUser({
      ...profile,
      mfa: {
        required: true,
        email: { verified: false },
        phone: { verified: false, number: null },
        complete: false,
      },
      pendingDestination: destination,
    })
    return this.getUser()
  },

  getMfaState() {
    return this.getUser()?.mfa || null
  },

  /* True when the current session is authenticated but still owes MFA. */
  needsMfa() {
    const m = this.getMfaState()
    return !!(m && m.required && !m.complete)
  },

  isMfaComplete() {
    const m = this.getMfaState()
    return !m || !m.required || !!m.complete
  },

  markEmailVerified() {
    const user = this.getUser()
    if (!user?.mfa) return
    user.mfa.email = { ...(user.mfa.email || {}), verified: true }
    this.setUser(user)
  },

  markPhoneVerified(number) {
    const user = this.getUser()
    if (!user?.mfa) return
    user.mfa.phone = { ...(user.mfa.phone || {}), verified: true, number: number || user.mfa.phone?.number || null }
    this.setUser(user)
  },

  /* Finalize once email MFA is verified; returns where to send the user. */
  completeMfa() {
    const user = this.getUser()
    if (!user?.mfa) return 'dashboard.html'
    user.mfa.complete = true
    const dest = user.pendingDestination || 'dashboard.html'
    delete user.pendingDestination
    this.setUser(user)
    return dest
  },

  getPendingDestination() {
    return this.getUser()?.pendingDestination || 'dashboard.html'
  },

  /* ─── Membership tier ───────────────────────────────────────────
     Tier values: 'base' | 'plus' | 'prime'
     Stored on the user object so every module reads one source.
     ─────────────────────────────────────────────────────────── */

  getTier() {
    return this.getUser()?.tier || 'base'
  },

  setTier(tier) {
    const user = this.getUser()
    if (!user) return
    user.tier = tier
    this.setUser(user)
  },

  /* ─── Matching eligibility (Intent Guardrail) ───────────────────
     The authoritative decision is produced by js/matching-policy.js
     (a protected business rule, server-side in production). We cache
     the resulting eligibility object on the session so every surface
     reads one source of truth. ─────────────────────────────────── */

  setMatchingEligibility(result) {
    const user = this.getUser()
    if (!user) return null
    user.matching = result
    this.setUser(user)
    return result
  },

  getMatchingEligibility() {
    return this.getUser()?.matching || null
  },

  /* Default to eligible when unknown (e.g. demo user, not-yet-onboarded);
     only an explicit guardrail failure blocks access. */
  isMatchingEligible() {
    const m = this.getMatchingEligibility()
    return !m || m.matchingEligibility !== false
  },

  getMatches() {
    return JSON.parse(localStorage.getItem(KEYS.MATCHES) || 'null') || MOCK_MATCHES
  },

  updateMatchStatus(id, status) {
    const matches = this.getMatches()
    const m = matches.find(x => x.id === id)
    if (m) m.status = status
    localStorage.setItem(KEYS.MATCHES, JSON.stringify(matches))
    return matches
  },

  getMessages(matchId) {
    const all = JSON.parse(localStorage.getItem(KEYS.MESSAGES) || 'null') || MOCK_MESSAGES
    return all[matchId] || []
  },

  addMessage(matchId, text) {
    const all = JSON.parse(localStorage.getItem(KEYS.MESSAGES) || 'null') || MOCK_MESSAGES
    if (!all[matchId]) all[matchId] = []
    all[matchId].push({
      from: 'me',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    })
    localStorage.setItem(KEYS.MESSAGES, JSON.stringify(all))
    return all[matchId]
  },

  getBookings() {
    return JSON.parse(localStorage.getItem(KEYS.BOOKINGS) || '[]')
  },

  addBooking(booking) {
    const bookings = this.getBookings()
    const record = { ...booking, id: Date.now() }
    bookings.unshift(record)
    localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(bookings))
    return record
  },

  cancelBooking(id) {
    const bookings = this.getBookings().filter(b => b.id !== id)
    localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(bookings))
    return bookings
  },

  getOnboarding() {
    return JSON.parse(localStorage.getItem(KEYS.ONBOARD) || '{}')
  },

  setOnboarding(data) {
    const existing = this.getOnboarding()
    localStorage.setItem(KEYS.ONBOARD, JSON.stringify({ ...existing, ...data }))
  },

  /* ─── Alignment Engine answers ─── */
  getAlignment() {
    return JSON.parse(localStorage.getItem(KEYS.ALIGNMENT) || 'null')
  },

  setAlignment(answers) {
    localStorage.setItem(KEYS.ALIGNMENT, JSON.stringify(answers))
  },

  clearAlignment() {
    localStorage.removeItem(KEYS.ALIGNMENT)
  },

  /* ─── Sent connection requests ──────────────────────────────────
     Stores rich display info so any page can render pending items
     without needing to import the full member dataset.
     Each entry: { id, name, role, location, score, fallback, sentAt }
     ─────────────────────────────────────────────────────────── */

  getSentRequests() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.SENT_REQUESTS) || '[]')
    } catch { return [] }
  },

  addSentRequest(member) {
    const list = this.getSentRequests()
    if (list.some(r => r.id === member.id)) return
    list.push({
      id:       member.id,
      name:     member.name,
      role:     member.profession || member.role || '',
      location: member.location   || '',
      score:    member.score      || 0,
      fallback: member.fallback   || 'linear-gradient(135deg,#0A0F20,#060C18)',
      sentAt:   new Date().toISOString(),
    })
    localStorage.setItem(KEYS.SENT_REQUESTS, JSON.stringify(list))
    // Mirror as pending_other in the match list where a record exists
    try {
      const candidate = this.getMatches().find(m =>
        m.name.toLowerCase().startsWith(member.name.toLowerCase().split(' ')[0])
      )
      if (candidate) this.updateMatchStatus(candidate.id, 'pending_other')
    } catch {}
  },

  hasSentRequest(memberId) {
    return this.getSentRequests().some(r => r.id === memberId)
  },

  getSentRequestIds() {
    return this.getSentRequests().map(r => r.id)
  },

  isLoggedIn() {
    return !!localStorage.getItem(KEYS.USER)
  },

  logout() {
    localStorage.removeItem(KEYS.USER)
  },

  /* ─── Notifications ─── */
  getNotifications() {
    const stored = localStorage.getItem(KEYS.NOTIFICATIONS)
    if (stored) return JSON.parse(stored)
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(MOCK_NOTIFICATIONS))
    return MOCK_NOTIFICATIONS
  },

  unreadNotificationCount() {
    return this.getNotifications().filter(n => !n.read).length
  },

  markNotificationRead(id) {
    const all = this.getNotifications()
    const n = all.find(x => x.id === id)
    if (n) n.read = true
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(all))
    return all
  },

  markAllNotificationsRead() {
    const all = this.getNotifications().map(n => ({ ...n, read: true }))
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(all))
    return all
  },

  addNotification(n) {
    const all = this.getNotifications()
    const record = {
      id: 'n' + Date.now(),
      timeISO: new Date().toISOString(),
      read: false,
      ...n,
    }
    all.unshift(record)
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(all))
    return record
  },

  /* ─── Accounts (mock auth) ─── */
  getAccounts() {
    const stored = localStorage.getItem(KEYS.ACCOUNTS)
    if (stored) return JSON.parse(stored)
    localStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(SEED_ACCOUNTS))
    return SEED_ACCOUNTS
  },

  findAccount(email) {
    const target = (email || '').trim().toLowerCase()
    return this.getAccounts().find(a => a.email.toLowerCase() === target) || null
  },

  addAccount(account) {
    const accounts = this.getAccounts()
    const email = (account.email || '').trim().toLowerCase()
    if (accounts.some(a => a.email.toLowerCase() === email)) {
      return { ok: false, reason: 'exists' }
    }
    const record = { ...account, email }
    accounts.push(record)
    localStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts))
    return { ok: true, account: record }
  },

  verifyAccount(email, password) {
    const acc = this.findAccount(email)
    if (!acc) return { ok: false, reason: 'not_found' }
    if (acc.password !== password) return { ok: false, reason: 'bad_password' }
    return { ok: true, account: acc }
  },

  /* ─── Settings ─── */
  getSettings() {
    const stored = localStorage.getItem(KEYS.SETTINGS)
    if (!stored) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    const parsed = JSON.parse(stored)
    return {
      privacy:       { ...DEFAULT_SETTINGS.privacy,       ...(parsed.privacy       || {}) },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications || {}) },
      appearance:    { ...DEFAULT_SETTINGS.appearance,    ...(parsed.appearance    || {}) },
      account:       { ...DEFAULT_SETTINGS.account,       ...(parsed.account       || {}) },
    }
  },

  setSettings(settings) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings))
  },

  updateSetting(group, key, value) {
    const current = this.getSettings()
    current[group] = { ...current[group], [key]: value }
    this.setSettings(current)
    return current
  },

  resetSettings() {
    localStorage.removeItem(KEYS.SETTINGS)
    return this.getSettings()
  },

  /* ─── Subscription billing failure state ───────────────────────
     Stored when a recurring charge fails. Shape:
       {
         tier:            'plus' | 'prime',
         gracePeriodEnd:  <Unix ms>,   // 24h after first failure
         retryCount:      0-3,
         nextRetry:       <Unix ms>,
       }
     Cleared on successful retry or manual payment update.
     ─────────────────────────────────────────────────────────── */

  getPastDue() {
    try { return JSON.parse(localStorage.getItem(KEYS.PAST_DUE) || 'null') }
    catch { return null }
  },

  setPastDue(data) {
    localStorage.setItem(KEYS.PAST_DUE, JSON.stringify(data))
  },

  clearPastDue() {
    localStorage.removeItem(KEYS.PAST_DUE)
  },
}
