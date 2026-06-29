const express = require('express')
const pool    = require('../db/pool')
const { requireRole, activityLogger } = require('../middleware/admin-auth')
const { logActivity, hashPassword }   = require('../services/admin-auth.service')

const router = express.Router()

/* ================================================================
   MOCK DATA — replace each section with real DB queries once the
   app's user records are persisted server-side.
   ================================================================ */

const MOCK_USERS = [
  { id:'usr_001', name:'Alexandra R.',   email:'alexandra.r@business.com',   tier:'prime',  status:'active',    region:'New York',     joined:'2024-01-15', matches:23, messages:47 },
  { id:'usr_002', name:'James T.',       email:'james.t@ventures.com',        tier:'prime',  status:'active',    region:'New York',     joined:'2024-01-20', matches:18, messages:31 },
  { id:'usr_003', name:'Mia Santos',     email:'mia.santos@hospital.org',     tier:'plus',   status:'active',    region:'Metro Manila', joined:'2024-02-03', matches:12, messages:28 },
  { id:'usr_004', name:'Adrian Reyes',   email:'adrian.reyes@medical.com',    tier:'plus',   status:'active',    region:'Toronto',      joined:'2024-02-14', matches:9,  messages:22 },
  { id:'usr_005', name:'Sarah M.',       email:'sarah.m@lawfirm.com',         tier:'prime',  status:'active',    region:'London',       joined:'2024-03-01', matches:15, messages:33 },
  { id:'usr_006', name:'Daniel Cruz',    email:'daniel.cruz@studio.com',      tier:'plus',   status:'suspended', region:'Mexico City',  joined:'2024-03-12', matches:7,  messages:18 },
  { id:'usr_007', name:'Oliver H.',      email:'oliver.h@investments.com',    tier:'prime',  status:'active',    region:'London',       joined:'2024-03-22', matches:20, messages:41 },
  { id:'usr_008', name:'Marcus L.',      email:'marcus.l@lawfirm.com',        tier:'plus',   status:'active',    region:'New York',     joined:'2024-04-01', matches:11, messages:25 },
  { id:'usr_009', name:'Ryan M.',        email:'ryan.m@cardiology.com',       tier:'base',   status:'active',    region:'Boston',       joined:'2024-04-10', matches:4,  messages:8  },
  { id:'usr_010', name:'Thomas K.',      email:'thomas.k@bank.com',           tier:'base',   status:'banned',    region:'New York',     joined:'2024-04-18', matches:2,  messages:3  },
  { id:'usr_011', name:'Sophia Chen',    email:'sophia.chen@tech.com',        tier:'prime',  status:'active',    region:'Singapore',    joined:'2024-05-02', matches:17, messages:39 },
  { id:'usr_012', name:'Isabella Torres',email:'isabella.t@design.com',       tier:'plus',   status:'active',    region:'Barcelona',    joined:'2024-05-14', matches:8,  messages:20 },
  { id:'usr_013', name:'Lucas Pereira',  email:'lucas.p@finance.com',         tier:'base',   status:'active',    region:'São Paulo',    joined:'2024-05-28', matches:3,  messages:6  },
  { id:'usr_014', name:'Elena Vasquez',  email:'elena.v@pharma.com',          tier:'plus',   status:'active',    region:'Madrid',       joined:'2024-06-03', matches:10, messages:24 },
  { id:'usr_015', name:'Nathan Wong',    email:'nathan.w@ventures.com',       tier:'prime',  status:'active',    region:'Hong Kong',    joined:'2024-06-10', matches:14, messages:32 },
]

const MOCK_SUBSCRIPTIONS = [
  { id:'sub_001', userId:'usr_001', userName:'Alexandra R.',   email:'alexandra.r@business.com',   tier:'prime',  status:'active',    amountPhp:1990, periodStart:'2025-06-01', periodEnd:'2025-07-01', provider:'paymongo', retries:0 },
  { id:'sub_002', userId:'usr_002', userName:'James T.',       email:'james.t@ventures.com',        tier:'prime',  status:'active',    amountPhp:1990, periodStart:'2025-06-15', periodEnd:'2025-07-15', provider:'paymongo', retries:0 },
  { id:'sub_003', userId:'usr_003', userName:'Mia Santos',     email:'mia.santos@hospital.org',     tier:'plus',   status:'active',    amountPhp:499,  periodStart:'2025-06-03', periodEnd:'2025-07-03', provider:'paymongo', retries:0 },
  { id:'sub_004', userId:'usr_004', userName:'Adrian Reyes',   email:'adrian.reyes@medical.com',    tier:'plus',   status:'past_due',  amountPhp:499,  periodStart:'2025-05-14', periodEnd:'2025-06-14', provider:'paymongo', retries:2 },
  { id:'sub_005', userId:'usr_005', userName:'Sarah M.',       email:'sarah.m@lawfirm.com',         tier:'prime',  status:'active',    amountPhp:1990, periodStart:'2025-06-01', periodEnd:'2025-07-01', provider:'stripe',   retries:0 },
  { id:'sub_006', userId:'usr_007', userName:'Oliver H.',      email:'oliver.h@investments.com',    tier:'prime',  status:'active',    amountPhp:1990, periodStart:'2025-06-22', periodEnd:'2025-07-22', provider:'paymongo', retries:0 },
  { id:'sub_007', userId:'usr_008', userName:'Marcus L.',      email:'marcus.l@lawfirm.com',        tier:'plus',   status:'cancelled', amountPhp:499,  periodStart:'2025-05-01', periodEnd:'2025-06-01', provider:'paymongo', retries:0 },
  { id:'sub_008', userId:'usr_011', userName:'Sophia Chen',    email:'sophia.chen@tech.com',        tier:'prime',  status:'active',    amountPhp:1990, periodStart:'2025-06-02', periodEnd:'2025-07-02', provider:'stripe',   retries:0 },
  { id:'sub_009', userId:'usr_012', userName:'Isabella Torres',email:'isabella.t@design.com',       tier:'plus',   status:'expired',   amountPhp:499,  periodStart:'2025-04-14', periodEnd:'2025-05-14', provider:'paymongo', retries:3 },
  { id:'sub_010', userId:'usr_015', userName:'Nathan Wong',    email:'nathan.w@ventures.com',       tier:'prime',  status:'active',    amountPhp:1990, periodStart:'2025-06-10', periodEnd:'2025-07-10', provider:'stripe',   retries:0 },
]

const MOCK_REPORTS = [
  { id:'rep_001', reporterId:'usr_003', reporterName:'Mia Santos',     reportedId:'usr_010', reportedName:'Thomas K.',     type:'harassment',            description:'Sent repeated unsolicited messages after being ignored.', status:'pending',  createdAt:'2025-06-24' },
  { id:'rep_002', reporterId:'usr_008', reporterName:'Marcus L.',      reportedId:'usr_006', reportedName:'Daniel Cruz',   type:'inappropriate_content', description:'Shared explicit images without consent.',               status:'actioned', createdAt:'2025-06-22', resolution:'User suspended for 7 days.' },
  { id:'rep_003', reporterId:'usr_001', reporterName:'Alexandra R.',   reportedId:'usr_013', reportedName:'Lucas Pereira', type:'fake_profile',          description:'Profile information does not match verification photos.', status:'pending',  createdAt:'2025-06-25' },
  { id:'rep_004', reporterId:'usr_005', reporterName:'Sarah M.',       reportedId:'usr_010', reportedName:'Thomas K.',     type:'spam',                  description:'Copied and pasted the same opening message to multiple users.', status:'reviewed', createdAt:'2025-06-23' },
  { id:'rep_005', reporterId:'usr_011', reporterName:'Sophia Chen',    reportedId:'usr_006', reportedName:'Daniel Cruz',   type:'harassment',            description:'Threatening messages after conversation ended.',          status:'pending',  createdAt:'2025-06-26' },
]

const MOCK_EVENTS = [
  { id:'evt_001', title:'LEVEL Manila Mixer',        type:'mixer', date:'2025-07-15T19:00:00', venue:'Marriott Grand Ballroom, Pasay City', capacity:60, rsvpCount:42, eligibility:'plus',  status:'upcoming',  description:'Exclusive evening mixer for LEVEL Plus members in Metro Manila.' },
  { id:'evt_002', title:'BGC VIP Networking Night',  type:'vip',   date:'2025-07-22T18:30:00', venue:'The Penthouse, BGC',                  capacity:30, rsvpCount:28, eligibility:'prime', status:'upcoming',  description:'Intimate VIP gathering for Prime members.' },
  { id:'evt_003', title:'Makati Social Mixer',        type:'mixer', date:'2025-06-20T19:30:00', venue:'The Ruins, Makati',                   capacity:50, rsvpCount:50, eligibility:'plus',  status:'completed', description:'Monthly Plus mixer in the CBD.' },
  { id:'evt_004', title:'Singapore Prime Connect',    type:'vip',   date:'2025-08-05T18:00:00', venue:'One-Ninety, Four Seasons SG',         capacity:25, rsvpCount:11, eligibility:'prime', status:'upcoming',  description:'Prime member event for Southeast Asia.' },
]

const MOCK_FLAGGED_THREADS = [
  { id:'thd_001', participants:['Alexandra R.', 'James T.'],   flagReason:'potential_spam',    flaggedAt:'2025-06-24', messageCount:47, lastMessage:'2025-06-25T14:32:00', status:'pending'  },
  { id:'thd_002', participants:['Thomas K.',    'Mia Santos'], flagReason:'harassment',        flaggedAt:'2025-06-25', messageCount:23, lastMessage:'2025-06-25T18:10:00', status:'disabled' },
  { id:'thd_003', participants:['Daniel Cruz',  'Elena V.'],   flagReason:'inappropriate_content', flaggedAt:'2025-06-26', messageCount:12, lastMessage:'2025-06-26T09:45:00', status:'pending' },
]

const MOCK_BOOKINGS = [
  { id:'bk_001', userId:'usr_001', userName:'Alexandra R.',  matchName:'James T.',    requestType:'restaurant_reservation', venue:'Aubergine, BGC',         requestedDate:'2025-07-10', status:'confirmed', notes:'Table for 2, window seat. No shellfish.',   assignedTo:'Sarah Admin', createdAt:'2025-06-20' },
  { id:'bk_002', userId:'usr_005', userName:'Sarah M.',      matchName:'Oliver H.',   requestType:'experience',             venue:'Hot Air Balloon, Pampanga', requestedDate:'2025-07-14', status:'pending',   notes:'Anniversary surprise experience.',           assignedTo:null,          createdAt:'2025-06-24' },
  { id:'bk_003', userId:'usr_007', userName:'Oliver H.',     matchName:'Sophia C.',   requestType:'restaurant_reservation', venue:'Antonio\'s, Tagaytay',    requestedDate:'2025-07-08', status:'completed', notes:'Vegetarian menu requested.',                assignedTo:'Mike Admin',  createdAt:'2025-06-15' },
  { id:'bk_004', userId:'usr_011', userName:'Sophia Chen',   matchName:'Nathan W.',   requestType:'personal_assistance',    venue:'N/A',                      requestedDate:'2025-07-20', status:'pending',   notes:'Help planning a multi-day itinerary in Bohol.', assignedTo:null,      createdAt:'2025-06-26' },
  { id:'bk_005', userId:'usr_015', userName:'Nathan Wong',   matchName:'Isabella T.', requestType:'restaurant_reservation', venue:'Gallery Vask, BGC',        requestedDate:'2025-07-16', status:'confirmed', notes:'Allergic to nuts. Chef\'s tasting preferred.', assignedTo:'Sarah Admin', createdAt:'2025-06-22' },
]

const APP_SETTINGS = {
  pricing:  { plus: 499, prime: 1990 },
  features: {
    base:  { matchDeliveryLimit: 10, geoReach: 'local',    communityAccess: false, concierge: false },
    plus:  { matchDeliveryLimit: null, geoReach: 'national', communityAccess: true,  concierge: false },
    prime: { matchDeliveryLimit: null, geoReach: 'global',  communityAccess: true,  concierge: true  },
  },
  maintenance: false,
  signupsEnabled: true,
}

/* ================================================================
   ANALYTICS
   ================================================================ */
router.get('/analytics/overview', async (req, res) => {
  const base = 612, plus = 178, prime = 57
  res.json({
    users: { total: base + plus + prime, base, plus, prime,
      activeToday: 234, activeWeek: 892, activeMonth: 2341,
      newToday: 12, newYesterday: 8 },
    revenue: {
      monthPhp: 125470,
      plusPhp:   88922,
      primePhp:  36548,
    },
    matchSuccessRate: 73,
    activeConversations: 341,
    pendingReports: MOCK_REPORTS.filter(r => r.status === 'pending').length,
    pendingBookings: MOCK_BOOKINGS.filter(b => b.status === 'pending').length,
  })
})

router.get('/analytics/chart', async (req, res) => {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  res.json({
    signups7d:   { labels: days, data: [8, 12, 6, 15, 9, 11, 12] },
    revenue7d:   { labels: days, data: [12500, 9800, 14900, 22000, 8500, 17800, 12500] },
    tierHistory: {
      labels: ['Jan','Feb','Mar','Apr','May','Jun'],
      base:   [420, 468, 510, 551, 589, 612],
      plus:   [98,  112, 130, 148, 163, 178],
      prime:  [22,  28,  34,  41,  49,  57],
    },
  })
})

/* ================================================================
   USER MANAGEMENT
   ================================================================ */
router.get('/users', (req, res) => {
  let users = [...MOCK_USERS]
  const { tier, status, region, q, page = 1, limit = 10 } = req.query

  if (tier && tier !== 'all')    users = users.filter(u => u.tier === tier)
  if (status && status !== 'all') users = users.filter(u => u.status === status)
  if (region) users = users.filter(u => u.region.toLowerCase().includes(region.toLowerCase()))
  if (q)      users = users.filter(u =>
    u.name.toLowerCase().includes(q.toLowerCase()) ||
    u.email.toLowerCase().includes(q.toLowerCase()) ||
    u.id.includes(q)
  )

  const total = users.length
  const start = (Number(page) - 1) * Number(limit)
  res.json({ users: users.slice(start, start + Number(limit)), total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
})

router.get('/users/:id', (req, res) => {
  const user = MOCK_USERS.find(u => u.id === req.params.id)
  if (!user) return res.status(404).json({ error: 'NOT_FOUND' })
  res.json(user)
})

router.patch('/users/:id/tier',
  requireRole('moderator', 'super_admin'),
  activityLogger('user.tier_changed', 'user'),
  (req, res) => {
    const { tier } = req.body
    if (!['base','plus','prime'].includes(tier)) return res.status(400).json({ error: 'INVALID_TIER' })
    const user = MOCK_USERS.find(u => u.id === req.params.id)
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' })
    const prev = user.tier
    user.tier = tier
    res.json({ id: user.id, tier, previous: prev })
  }
)

router.patch('/users/:id/status',
  requireRole('moderator', 'super_admin'),
  activityLogger('user.status_changed', 'user'),
  (req, res) => {
    const { status, reason } = req.body
    if (!['active','suspended','banned'].includes(status)) return res.status(400).json({ error: 'INVALID_STATUS' })
    const user = MOCK_USERS.find(u => u.id === req.params.id)
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' })
    user.status = status
    res.json({ id: user.id, status, reason })
  }
)

router.delete('/users/:id',
  requireRole('super_admin'),
  activityLogger('user.deleted', 'user'),
  (req, res) => {
    const idx = MOCK_USERS.findIndex(u => u.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'NOT_FOUND' })
    const [removed] = MOCK_USERS.splice(idx, 1)
    res.json({ id: removed.id, deleted: true })
  }
)

/* ================================================================
   SUBSCRIPTION MANAGEMENT
   ================================================================ */
router.get('/subscriptions', (req, res) => {
  let subs = [...MOCK_SUBSCRIPTIONS]
  const { tier, status, page = 1, limit = 10 } = req.query
  if (tier   && tier   !== 'all') subs = subs.filter(s => s.tier   === tier)
  if (status && status !== 'all') subs = subs.filter(s => s.status === status)
  const total = subs.length
  const start = (Number(page) - 1) * Number(limit)
  res.json({ subscriptions: subs.slice(start, start + Number(limit)), total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
})

router.patch('/subscriptions/:id',
  requireRole('super_admin'),
  activityLogger('subscription.status_changed', 'subscription'),
  (req, res) => {
    const { status } = req.body
    const sub = MOCK_SUBSCRIPTIONS.find(s => s.id === req.params.id)
    if (!sub) return res.status(404).json({ error: 'NOT_FOUND' })
    sub.status = status
    res.json({ id: sub.id, status })
  }
)

router.post('/subscriptions/:id/refund-flag',
  requireRole('super_admin'),
  activityLogger('subscription.refund_flagged', 'subscription'),
  (req, res) => {
    const sub = MOCK_SUBSCRIPTIONS.find(s => s.id === req.params.id)
    if (!sub) return res.status(404).json({ error: 'NOT_FOUND' })
    res.json({ id: sub.id, refundFlagged: true, flaggedAt: new Date().toISOString() })
  }
)

/* ================================================================
   CONTENT MODERATION
   ================================================================ */
router.get('/reports', (req, res) => {
  let reports = [...MOCK_REPORTS]
  const { status, type } = req.query
  if (status && status !== 'all') reports = reports.filter(r => r.status === status)
  if (type   && type   !== 'all') reports = reports.filter(r => r.type   === type)
  res.json({ reports, total: reports.length })
})

router.patch('/reports/:id',
  requireRole('moderator', 'super_admin'),
  activityLogger('report.reviewed', 'report'),
  (req, res) => {
    const { status, resolution } = req.body
    const report = MOCK_REPORTS.find(r => r.id === req.params.id)
    if (!report) return res.status(404).json({ error: 'NOT_FOUND' })
    report.status = status
    if (resolution) report.resolution = resolution
    report.reviewedAt = new Date().toISOString()
    res.json(report)
  }
)

/* ================================================================
   COMMUNITY EVENTS
   ================================================================ */
router.get('/events', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM community_events ORDER BY event_date DESC')
    res.json({ events: rows.length ? rows : MOCK_EVENTS, total: rows.length || MOCK_EVENTS.length })
  } catch {
    res.json({ events: MOCK_EVENTS, total: MOCK_EVENTS.length })
  }
})

router.post('/events',
  requireRole('moderator', 'super_admin'),
  activityLogger('event.created', 'event'),
  async (req, res) => {
    const { title, type, date, venue, capacity, eligibility, description } = req.body
    try {
      const { rows } = await pool.query(
        `INSERT INTO community_events (title, type, description, venue, event_date, capacity, eligibility, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [title, type, description, venue, date, capacity, eligibility, req.admin.sub]
      )
      res.status(201).json(rows[0])
    } catch {
      const mock = { id: `evt_${Date.now()}`, title, type, date, venue, capacity: Number(capacity), rsvpCount: 0, eligibility, status: 'upcoming', description }
      MOCK_EVENTS.push(mock)
      res.status(201).json(mock)
    }
  }
)

router.put('/events/:id',
  requireRole('moderator', 'super_admin'),
  activityLogger('event.updated', 'event'),
  async (req, res) => {
    const { title, type, date, venue, capacity, eligibility, description, status } = req.body
    try {
      const { rows } = await pool.query(
        `UPDATE community_events SET title=$1, type=$2, description=$3, venue=$4,
         event_date=$5, capacity=$6, eligibility=$7, status=$8 WHERE id=$9 RETURNING *`,
        [title, type, description, venue, date, capacity, eligibility, status, req.params.id]
      )
      if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' })
      res.json(rows[0])
    } catch {
      const ev = MOCK_EVENTS.find(e => e.id === req.params.id)
      if (!ev) return res.status(404).json({ error: 'NOT_FOUND' })
      Object.assign(ev, { title, type, date, venue, capacity: Number(capacity), eligibility, status, description })
      res.json(ev)
    }
  }
)

router.delete('/events/:id',
  requireRole('super_admin'),
  activityLogger('event.deleted', 'event'),
  async (req, res) => {
    try {
      await pool.query('DELETE FROM community_events WHERE id = $1', [req.params.id])
    } catch {
      const idx = MOCK_EVENTS.findIndex(e => e.id === req.params.id)
      if (idx !== -1) MOCK_EVENTS.splice(idx, 1)
    }
    res.json({ id: req.params.id, deleted: true })
  }
)

/* ================================================================
   MESSAGING OVERSIGHT
   ================================================================ */
router.get('/messaging/flagged', (req, res) => {
  const { status } = req.query
  let threads = [...MOCK_FLAGGED_THREADS]
  if (status && status !== 'all') threads = threads.filter(t => t.status === status)
  res.json({ threads, total: threads.length })
})

router.patch('/messaging/:threadId',
  requireRole('moderator', 'super_admin'),
  activityLogger('thread.status_changed', 'thread'),
  (req, res) => {
    const { status } = req.body
    const thread = MOCK_FLAGGED_THREADS.find(t => t.id === req.params.threadId)
    if (!thread) return res.status(404).json({ error: 'NOT_FOUND' })
    thread.status = status
    res.json(thread)
  }
)

/* ================================================================
   CONCIERGE & BOOKING
   ================================================================ */
router.get('/concierge/bookings', (req, res) => {
  let bookings = [...MOCK_BOOKINGS]
  const { status } = req.query
  if (status && status !== 'all') bookings = bookings.filter(b => b.status === status)
  res.json({ bookings, total: bookings.length })
})

router.patch('/concierge/bookings/:id',
  requireRole('moderator', 'super_admin'),
  activityLogger('booking.updated', 'booking'),
  (req, res) => {
    const booking = MOCK_BOOKINGS.find(b => b.id === req.params.id)
    if (!booking) return res.status(404).json({ error: 'NOT_FOUND' })
    const { status, assignedTo, adminNotes } = req.body
    if (status)     booking.status     = status
    if (assignedTo !== undefined) booking.assignedTo = assignedTo
    if (adminNotes !== undefined) booking.adminNotes = adminNotes
    res.json(booking)
  }
)

/* ================================================================
   SETTINGS & CONFIGURATION
   ================================================================ */
router.get('/settings', requireRole('super_admin'), (req, res) => {
  res.json(APP_SETTINGS)
})

router.put('/settings',
  requireRole('super_admin'),
  activityLogger('settings.updated', 'settings'),
  (req, res) => {
    const { pricing, features, maintenance, signupsEnabled } = req.body
    if (pricing)  Object.assign(APP_SETTINGS.pricing,  pricing)
    if (features) Object.assign(APP_SETTINGS.features, features)
    if (typeof maintenance    === 'boolean') APP_SETTINGS.maintenance    = maintenance
    if (typeof signupsEnabled === 'boolean') APP_SETTINGS.signupsEnabled = signupsEnabled
    res.json(APP_SETTINGS)
  }
)

/* ─── Admin account management (super_admin only) ───────────────*/
router.get('/admins', requireRole('super_admin'), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, role, first_name, last_name, is_active, last_login_at, created_at FROM admin_users ORDER BY created_at'
  )
  res.json({ admins: rows })
})

router.post('/admins',
  requireRole('super_admin'),
  activityLogger('admin.created', 'admin'),
  async (req, res) => {
    const { email, password, role, firstName, lastName } = req.body
    if (!email || !password || !role) return res.status(400).json({ error: 'MISSING_FIELDS' })
    const hash = await hashPassword(password)
    const { rows } = await pool.query(
      `INSERT INTO admin_users (email, password_hash, role, first_name, last_name)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, email, role, first_name, last_name, is_active`,
      [email.toLowerCase(), hash, role, firstName || null, lastName || null]
    )
    res.status(201).json(rows[0])
  }
)

router.patch('/admins/:id/status',
  requireRole('super_admin'),
  activityLogger('admin.status_changed', 'admin'),
  async (req, res) => {
    const { isActive } = req.body
    if (req.params.id === req.admin.sub) return res.status(400).json({ error: 'CANNOT_SELF_DEACTIVATE' })
    const { rows } = await pool.query(
      'UPDATE admin_users SET is_active = $1 WHERE id = $2 RETURNING id, email, is_active',
      [isActive, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' })
    res.json(rows[0])
  }
)

router.delete('/admins/:id',
  requireRole('super_admin'),
  activityLogger('admin.deleted', 'admin'),
  async (req, res) => {
    if (req.params.id === req.admin.sub) return res.status(400).json({ error: 'CANNOT_DELETE_SELF' })
    await pool.query('DELETE FROM admin_users WHERE id = $1', [req.params.id])
    res.json({ id: req.params.id, deleted: true })
  }
)

/* ─── Activity logs ──────────────────────────────────────────────*/
router.get('/activity-logs', requireRole('super_admin'), async (req, res) => {
  const { page = 1, limit = 50 } = req.query
  const offset = (Number(page) - 1) * Number(limit)
  const { rows } = await pool.query(
    `SELECT * FROM admin_activity_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [Number(limit), offset]
  )
  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM admin_activity_logs')
  res.json({ logs: rows, total: Number(count), page: Number(page) })
})

/* ─── Announcements ─────────────────────────────────────────────*/
router.post('/announcements',
  requireRole('super_admin'),
  activityLogger('announcement.sent', 'announcement'),
  (req, res) => {
    const { title, body, targetTier } = req.body
    if (!title || !body) return res.status(400).json({ error: 'MISSING_FIELDS' })
    // In production: push to notification queue / FCM
    res.json({ sent: true, title, targetTier: targetTier || 'all', sentAt: new Date().toISOString() })
  }
)

module.exports = router
