const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:4000' : ''

let _refreshing = null

async function request(path, opts = {}) {
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
    // Only attempt refresh once per concurrent batch
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
      return request(path, opts) // retry once
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
