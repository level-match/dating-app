/* ============================================================
   LEVEL — App State Store (localStorage-backed)
   ============================================================ */

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


export const store = {
  // Session-only cache for large base64 photo previews (kept out of localStorage).
  _photoPreview: null,

  getUser() {
    const user = JSON.parse(localStorage.getItem(KEYS.USER) || 'null')
    if (!user || !this._photoPreview) return user
    return {
      ...user,
      photos: this._photoPreview.photos ?? user.photos,
      mainPhoto: this._photoPreview.mainPhoto ?? user.mainPhoto,
    }
  },

  _leanUserForStorage(data) {
    if (!data) return data
    const lean = { ...data }
    const hasDataUrlPhoto = (lean.mainPhoto || '').startsWith('data:')
      || (lean.photos || []).some(p => p?.src?.startsWith('data:'))
    if (hasDataUrlPhoto) {
      this._photoPreview = {
        photos: lean.photos,
        mainPhoto: lean.mainPhoto,
      }
      if ((lean.mainPhoto || '').startsWith('data:')) lean.mainPhoto = null
      if (Array.isArray(lean.photos)) {
        lean.photos = lean.photos.map(p => (
          p?.src?.startsWith('data:') ? { name: p.name, localPreview: true } : p
        ))
      }
    }
    return lean
  },

  setUser(data) {
    localStorage.setItem(KEYS.USER, JSON.stringify(this._leanUserForStorage(data)))
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

  setSubscription(subscription) {
    const user = this.getUser()
    if (!user) return
    user.subscription = subscription
    this.setUser(user)
  },

  /** Apply server-authoritative subscription sync to the session user. */
  applySubscriptionSync({ tier, subscription } = {}) {
    const user = this.getUser()
    if (!user) return null

    user.tier = tier || 'base'
    user.subscription = subscription || null

    if (subscription?.status === 'past_due' && subscription.gracePeriodEnd) {
      const graceEnd = new Date(subscription.gracePeriodEnd).getTime()
      this.setPastDue({
        tier: user.tier,
        gracePeriodEnd: graceEnd,
        retryCount: subscription.retryCount ?? 0,
        nextRetry: graceEnd,
      })
    } else {
      this.clearPastDue()
    }

    this.setUser(user)
    return user
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
    return JSON.parse(localStorage.getItem(KEYS.MATCHES) || 'null') || []
  },

  updateMatchStatus(id, status) {
    const matches = this.getMatches()
    const m = matches.find(x => x.id === id)
    if (m) m.status = status
    localStorage.setItem(KEYS.MATCHES, JSON.stringify(matches))
    return matches
  },

  getMessages(matchId) {
    const all = JSON.parse(localStorage.getItem(KEYS.MESSAGES) || '{}')
    return all[matchId] || []
  },

  addMessage(matchId, text) {
    const all = JSON.parse(localStorage.getItem(KEYS.MESSAGES) || '{}')
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
    this._photoPreview = null
    localStorage.removeItem(KEYS.USER)
  },

  /* ─── Notifications ─── */
  getNotifications() {
    const stored = localStorage.getItem(KEYS.NOTIFICATIONS)
    if (stored) return JSON.parse(stored)
    return []
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
