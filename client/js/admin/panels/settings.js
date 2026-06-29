import { toast, modal, badge } from '../ui.js'

export async function render(el, api) {
  el.innerHTML = `
    <div class="adm-panel-header">
      <div><div class="adm-panel-title">Settings</div><div class="adm-panel-sub">Platform configuration and admin account management.</div></div>
    </div>
    <div class="adm-settings-grid" id="settingsGrid">
      <div class="adm-loading"><div class="adm-spinner"></div></div>
    </div>`

  try {
    const [settings, admins] = await Promise.all([
      api.get('/admin/api/settings'),
      api.get('/admin/api/admins'),
    ])
    renderSettings(el, settings, admins, api)
  } catch (e) {
    el.querySelector('#settingsGrid').innerHTML = `<div style="padding:24px;color:var(--adm-red)">${e.message}</div>`
  }
}

function renderSettings(el, s, admins, api) {
  el.querySelector('#settingsGrid').innerHTML = `
    <!-- Pricing -->
    <div class="adm-card">
      <div class="adm-card-title">Pricing</div>
      <div class="adm-form-row">
        <label class="adm-form-label">Plus (₱ / month)</label>
        <input class="adm-input" id="pricePlus" type="number" value="${s.pricing?.plus_monthly ?? 499}" style="width:100%">
      </div>
      <div class="adm-form-row">
        <label class="adm-form-label">Prime (₱ / month)</label>
        <input class="adm-input" id="pricePrime" type="number" value="${s.pricing?.prime_monthly ?? 1990}" style="width:100%">
      </div>
      <button class="adm-btn adm-btn-gold" id="savePricing" style="margin-top:8px">Save pricing</button>
    </div>

    <!-- Feature flags -->
    <div class="adm-card">
      <div class="adm-card-title">Feature Flags</div>
      ${toggleRow('Registration open', 'registration_open', s.features?.registration_open ?? true)}
      ${toggleRow('Mixer events',       'events_enabled',    s.features?.events_enabled    ?? true)}
      ${toggleRow('Concierge bookings', 'concierge_enabled', s.features?.concierge_enabled ?? true)}
      ${toggleRow('Community chat',     'community_enabled', s.features?.community_enabled ?? true)}
      <button class="adm-btn adm-btn-gold" id="saveFeatures" style="margin-top:14px">Save features</button>
    </div>

    <!-- Admin accounts -->
    <div class="adm-card" style="grid-column:1/-1">
      <div class="adm-card-title" style="display:flex;align-items:center;justify-content:space-between">
        Admin Accounts
        <button class="adm-btn adm-btn-outline adm-btn-sm" id="addAdminBtn">+ Add admin</button>
      </div>
      <table class="adm-table" style="margin-top:8px">
        <thead><tr><th>Email</th><th>Role</th><th>Created</th><th>Status</th><th></th></tr></thead>
        <tbody id="adminBody">
          ${(admins.admins || []).map(a => `
            <tr>
              <td class="adm-td-name">${esc(a.email)}</td>
              <td>${badge(a.role, a.role)}</td>
              <td style="font-size:0.78rem;color:var(--adm-text-faint)">${fmtDate(a.created_at)}</td>
              <td>${badge(a.is_active ? 'active' : 'disabled', a.is_active ? 'active' : 'disabled')}</td>
              <td>
                <button class="adm-btn adm-btn-${a.is_active?'danger':'outline'} adm-btn-sm" data-admin-id="${a.id}" data-active="${a.is_active}">
                  ${a.is_active ? 'Disable' : 'Enable'}
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- Announcements -->
    <div class="adm-card" style="grid-column:1/-1">
      <div class="adm-card-title">Send Announcement</div>
      <div class="adm-form-row">
        <label class="adm-form-label">Message</label>
        <textarea class="adm-textarea" id="annoMsg" placeholder="Platform-wide announcement text…" style="width:100%;min-height:100px"></textarea>
      </div>
      <div class="adm-form-row">
        <label class="adm-form-label">Audience</label>
        <select class="adm-select" id="annoAudience" style="width:200px">
          <option value="all">All members</option>
          <option value="level_plus">Plus members</option>
          <option value="level_prime">Prime members</option>
        </select>
      </div>
      <button class="adm-btn adm-btn-gold" id="sendAnno">Send announcement</button>
    </div>`

  // Pricing save
  el.querySelector('#savePricing').addEventListener('click', async () => {
    try {
      await api.put('/admin/api/settings', {
        pricing: {
          plus_monthly:  Number(el.querySelector('#pricePlus').value),
          prime_monthly: Number(el.querySelector('#pricePrime').value),
        },
      })
      toast('Pricing updated.', 'success')
    } catch (e) { toast(e.message, 'error') }
  })

  // Feature flags save
  el.querySelector('#saveFeatures').addEventListener('click', async () => {
    const features = {}
    ;['registration_open','events_enabled','concierge_enabled','community_enabled'].forEach(k => {
      features[k] = el.querySelector(`#toggle_${k}`)?.checked ?? true
    })
    try {
      await api.put('/admin/api/settings', { features })
      toast('Feature flags updated.', 'success')
    } catch (e) { toast(e.message, 'error') }
  })

  // Admin toggle active
  el.querySelectorAll('[data-admin-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newActive = btn.dataset.active === 'true' ? false : true
      try {
        await api.patch(`/admin/api/admins/${btn.dataset.adminId}/status`, { is_active: newActive })
        toast(`Admin ${newActive ? 'enabled' : 'disabled'}.`, 'success')
        // Re-render
        const [settings2, admins2] = await Promise.all([api.get('/admin/api/settings'), api.get('/admin/api/admins')])
        renderSettings(el, settings2, admins2, api)
      } catch (e) { toast(e.message, 'error') }
    })
  })

  // Add admin
  el.querySelector('#addAdminBtn').addEventListener('click', () => openAddAdminModal(api, async () => {
    const [s2, a2] = await Promise.all([api.get('/admin/api/settings'), api.get('/admin/api/admins')])
    renderSettings(el, s2, a2, api)
  }))

  // Announcement
  el.querySelector('#sendAnno').addEventListener('click', async () => {
    const msg = el.querySelector('#annoMsg').value.trim()
    const audience = el.querySelector('#annoAudience').value
    if (!msg) { toast('Enter a message first.', 'error'); return }
    try {
      await api.post('/admin/api/announcements', { message: msg, audience })
      toast('Announcement sent.', 'success')
      el.querySelector('#annoMsg').value = ''
    } catch (e) { toast(e.message, 'error') }
  })
}

function openAddAdminModal(api, reload) {
  modal(`
    <div class="adm-modal-head"><span class="adm-modal-title">Add Admin</span><button class="adm-modal-close" id="mc">✕</button></div>
    <div class="adm-modal-body">
      <div class="adm-form-row">
        <label class="adm-form-label">Email</label>
        <input class="adm-input" id="newAdminEmail" type="email" placeholder="admin@level.app" style="width:100%">
      </div>
      <div class="adm-form-row">
        <label class="adm-form-label">Role</label>
        <select class="adm-select" id="newAdminRole" style="width:100%">
          <option value="support">Support</option>
          <option value="moderator">Moderator</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>
      <div class="adm-form-row">
        <label class="adm-form-label">Password</label>
        <input class="adm-input" id="newAdminPass" type="password" placeholder="Minimum 12 characters" style="width:100%">
      </div>
    </div>
    <div class="adm-modal-footer">
      <button class="adm-btn adm-btn-outline" id="mc2">Cancel</button>
      <button class="adm-btn adm-btn-gold" id="createAdmin">Create admin</button>
    </div>`)

  const clear = () => document.getElementById('admModals').innerHTML = ''
  document.getElementById('mc').addEventListener('click',  clear)
  document.getElementById('mc2').addEventListener('click', clear)
  document.getElementById('createAdmin').addEventListener('click', async () => {
    try {
      await api.post('/admin/api/admins', {
        email:    document.getElementById('newAdminEmail').value,
        role:     document.getElementById('newAdminRole').value,
        password: document.getElementById('newAdminPass').value,
      })
      toast('Admin account created.', 'success')
      clear(); reload()
    } catch (e) { toast(e.message, 'error') }
  })
}

function toggleRow(label, key, defaultVal) {
  return `<div class="adm-toggle-row">
    <div><div class="adm-toggle-label">${label}</div></div>
    <input type="checkbox" class="adm-toggle" id="toggle_${key}" ${defaultVal ? 'checked' : ''}>
  </div>`
}

function esc(s)  { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—' }
