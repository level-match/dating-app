const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:4000' : ''

// ─── Dev mock layer ───────────────────────────────────────────────────────────
const DEV_MODE = () => sessionStorage.getItem('adm_token') === 'dev-token'

function last30Labels() {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 29 + i)
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  })
}

const DEV_STORE = {
  users: [
    { id: 'u001', name: 'Gabrielle Santos',  email: 'g.santos@example.com',   tier: 'level_prime', region: 'Makati',       status: 'active',    created_at: '2024-02-14T10:00:00Z' },
    { id: 'u002', name: 'Marco Reyes',        email: 'm.reyes@example.com',    tier: 'level_plus',  region: 'BGC',          status: 'active',    created_at: '2024-03-08T09:30:00Z' },
    { id: 'u003', name: 'Isabella Cruz',      email: 'i.cruz@example.com',     tier: 'level_base',  region: 'Ortigas',      status: 'active',    created_at: '2024-03-22T14:15:00Z' },
    { id: 'u004', name: 'Rafael Bautista',    email: 'r.bautista@example.com', tier: 'level_plus',  region: 'Makati',       status: 'active',    created_at: '2024-04-05T11:00:00Z' },
    { id: 'u005', name: 'Sophia Mendoza',     email: 's.mendoza@example.com',  tier: 'level_prime', region: 'BGC',          status: 'active',    created_at: '2024-04-18T08:45:00Z' },
    { id: 'u006', name: 'Diego Torres',       email: 'd.torres@example.com',   tier: 'level_base',  region: 'Quezon City',  status: 'suspended', created_at: '2024-05-01T16:20:00Z' },
    { id: 'u007', name: 'Camille Flores',     email: 'c.flores@example.com',   tier: 'level_plus',  region: 'Alabang',      status: 'active',    created_at: '2024-05-14T13:10:00Z' },
    { id: 'u008', name: 'Adrian Lim',         email: 'a.lim@example.com',      tier: 'level_base',  region: 'Pasig',        status: 'active',    created_at: '2024-06-02T10:30:00Z' },
  ],
  subscriptions: [
    { id: 's001', user_name: 'Gabrielle Santos', user_id: 'u001', tier: 'level_prime', status: 'active',   started_at: '2024-02-14T00:00:00Z', next_billing_at: '2025-07-14T00:00:00Z', amount_centavos: 199000 },
    { id: 's002', user_name: 'Marco Reyes',      user_id: 'u002', tier: 'level_plus',  status: 'active',   started_at: '2024-03-08T00:00:00Z', next_billing_at: '2025-07-08T00:00:00Z', amount_centavos: 49900  },
    { id: 's003', user_name: 'Rafael Bautista',  user_id: 'u004', tier: 'level_plus',  status: 'active',   started_at: '2024-04-05T00:00:00Z', next_billing_at: '2025-07-05T00:00:00Z', amount_centavos: 49900  },
    { id: 's004', user_name: 'Sophia Mendoza',   user_id: 'u005', tier: 'level_prime', status: 'active',   started_at: '2024-04-18T00:00:00Z', next_billing_at: '2025-07-18T00:00:00Z', amount_centavos: 199000 },
    { id: 's005', user_name: 'Camille Flores',   user_id: 'u007', tier: 'level_plus',  status: 'past_due', started_at: '2024-05-14T00:00:00Z', next_billing_at: '2025-06-14T00:00:00Z', amount_centavos: 49900  },
  ],
  reports: [
    { id: 'r001', type: 'Inappropriate Photo', reported_user: 'Diego Torres',  reporter: 'Camille Flores', status: 'pending',  description: 'Profile photo does not meet community standards.',             created_at: '2025-06-20T10:00:00Z', reported_user_id: 'u006' },
    { id: 'r002', type: 'Harassment',          reported_user: 'Adrian Lim',    reporter: 'Isabella Cruz',  status: 'pending',  description: 'User sent unsolicited messages after being asked to stop.',  created_at: '2025-06-22T14:30:00Z', reported_user_id: 'u008' },
    { id: 'r003', type: 'Fake Profile',        reported_user: 'Unknown User',  reporter: 'Marco Reyes',    status: 'reviewed', description: 'Suspected to be using stolen photos from social media.',     created_at: '2025-06-18T09:15:00Z', reported_user_id: null   },
  ],
  events: [
    { id: 'e001', name: 'BGC Rooftop Mixer',       venue: 'Aura Premiere, BGC',       event_date: '2025-07-15T18:00:00Z', type: 'mixer', event_type: 'mixer', status: 'upcoming',  rsvp_count: 28, capacity: 40 },
    { id: 'e002', name: 'Prime Members Dinner',     venue: 'Gallery by Chele, BGC',    event_date: '2025-07-28T19:00:00Z', type: 'vip',   event_type: 'vip',   status: 'upcoming',  rsvp_count: 12, capacity: 20 },
    { id: 'e003', name: 'Makati Cocktail Evening',  venue: 'Ritz-Carlton, Makati',     event_date: '2025-06-10T18:30:00Z', type: 'mixer', event_type: 'mixer', status: 'completed', rsvp_count: 35, capacity: 35 },
  ],
  bookings: [
    { id: 'b001', member_name: 'Gabrielle Santos', user_id: 'u001', request_type: 'restaurant', venue: 'Maido, BGC',                       requested_for: '2025-07-12T00:00:00Z', status: 'pending',   assigned_to: null,                 notes: 'Anniversary dinner for 2'  },
    { id: 'b002', member_name: 'Sophia Mendoza',   user_id: 'u005', request_type: 'experience', details: 'Hot air balloon, Pampanga',      requested_for: '2025-07-20T00:00:00Z', status: 'confirmed', assigned_to: 'concierge@level.app', notes: ''                          },
    { id: 'b003', member_name: 'Gabrielle Santos', user_id: 'u001', request_type: 'restaurant', venue: 'Nobu, City of Dreams',             requested_for: '2025-08-01T00:00:00Z', status: 'pending',   assigned_to: null,                 notes: 'Private room preferred'    },
    { id: 'b004', member_name: 'Sophia Mendoza',   user_id: 'u005', request_type: 'travel',     details: 'El Nido luxury villa, 3 nights', requested_for: '2025-08-10T00:00:00Z', status: 'pending',   assigned_to: null,                 notes: ''                          },
  ],
}

function devRespond(method, fullPath) {
  const [path, qs] = fullPath.split('?')
  const params = new URLSearchParams(qs || '')

  if (method === 'GET') {
    if (path === '/admin/api/analytics/overview') return {
      totalUsers: 1247, newUsersToday: 8, activeSubscriptions: 342,
      mrr: 892580, mrrGrowth: 12.4, openReports: 3,
      eventsThisMonth: 2, upcomingEvents: 2, pendingBookings: 4,
    }
    if (path === '/admin/api/analytics/chart') {
      const labels = last30Labels()
      return {
        signups: { labels, data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 12) + 2) },
        tiers: [905, 280, 62],
        revenue: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          plus:  [218010, 268020, 298060, 348100, 378110, 408120],
          prime: [398000, 398000, 597000, 597000, 796000, 895500],
        },
      }
    }
    if (path === '/admin/api/users') return { users: DEV_STORE.users, total: DEV_STORE.users.length }
    if (path.startsWith('/admin/api/users/')) {
      const id = path.slice('/admin/api/users/'.length)
      const u = DEV_STORE.users.find(u => u.id === id) || DEV_STORE.users[0]
      return { ...u, stats: { matches: 14, threads: 6 } }
    }
    if (path === '/admin/api/subscriptions') {
      const status = params.get('status')
      const subs = status ? DEV_STORE.subscriptions.filter(s => s.status === status) : DEV_STORE.subscriptions
      return { subscriptions: subs, total: subs.length }
    }
    if (path === '/admin/api/reports') {
      const status = params.get('status')
      const rep = status ? DEV_STORE.reports.filter(r => r.status === status) : DEV_STORE.reports
      return { reports: rep }
    }
    if (path === '/admin/api/events') return { events: DEV_STORE.events }
    if (path === '/admin/api/messaging/flagged') return { threads: [] }
    if (path === '/admin/api/concierge/bookings') return { bookings: DEV_STORE.bookings }
    if (path === '/admin/api/settings') return {
      pricing: { plus_monthly: 499, prime_monthly: 1990 },
      features: { registration_open: true, events_enabled: true, concierge_enabled: true, community_enabled: true },
    }
    if (path === '/admin/api/admins') return {
      admins: [{ id: 1, email: 'admin@level.app', role: 'super_admin', is_active: true, created_at: '2024-01-01T00:00:00Z' }]
    }
  }

  // All write operations succeed silently in dev mode
  return null
}
// ─────────────────────────────────────────────────────────────────────────────

let _refreshing = null

async function request(path, opts = {}) {
  if (DEV_MODE()) return devRespond(opts.method || 'GET', path)

  const token = sessionStorage.getItem('adm_token')
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 401) {
    if (!_refreshing) {
      _refreshing = fetch(`${API_BASE}/admin/auth/refresh`, {
        method: 'POST', credentials: 'include',
      }).then(async r => {
        if (!r.ok) throw new Error('refresh_failed')
        const d = await r.json()
        sessionStorage.setItem('adm_token', d.accessToken)
      }).finally(() => { _refreshing = null })
    }
    try {
      await _refreshing
      return request(path, opts)
    } catch {
      sessionStorage.removeItem('adm_token')
      sessionStorage.removeItem('adm_admin')
      window.location.href = 'admin-login.html'
      throw new Error('session_expired')
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const e = new Error(err.message || `HTTP ${res.status}`)
    e.code = err.error
    e.status = res.status
    throw e
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get:    (path, query) => request(path + (query ? '?' + new URLSearchParams(query) : ''), { method: 'GET' }),
  post:   (path, body)  => request(path, { method: 'POST',  body }),
  put:    (path, body)  => request(path, { method: 'PUT',   body }),
  patch:  (path, body)  => request(path, { method: 'PATCH', body }),
  del:    (path)        => request(path, { method: 'DELETE' }),
}
