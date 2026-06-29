import { toast, modal, badge, avatar } from '../ui.js'

const PAGE_SIZE = 15

let state = { page: 1, search: '', tier: '', status: '', total: 0, rows: [] }

export async function render(el, api) {
  el.innerHTML = `
    <div class="adm-panel-header">
      <div><div class="adm-panel-title">User Management</div><div class="adm-panel-sub">Search, inspect, and manage member accounts.</div></div>
    </div>
    <div class="adm-table-wrap">
      <div class="adm-table-header">
        <div class="adm-search">
          <svg class="adm-search-icon" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input class="adm-input" id="uSearch" placeholder="Name or email…" style="width:240px">
        </div>
        <div class="adm-table-controls">
          <select class="adm-select" id="uTier" style="width:130px">
            <option value="">All tiers</option>
            <option value="level_base">Base</option>
            <option value="level_plus">Plus</option>
            <option value="level_prime">Prime</option>
          </select>
          <select class="adm-select" id="uStatus" style="width:130px">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
        </div>
      </div>
      <table class="adm-table">
        <thead><tr>
          <th>User</th><th>Tier</th><th>Region</th><th>Joined</th><th>Status</th><th></th>
        </tr></thead>
        <tbody id="uBody"></tbody>
      </table>
      <div class="adm-pagination" id="uPager"></div>
    </div>`

  const search = el.querySelector('#uSearch')
  const tierSel = el.querySelector('#uTier')
  const statusSel = el.querySelector('#uStatus')

  let debounce
  search.addEventListener('input', () => {
    clearTimeout(debounce)
    debounce = setTimeout(() => { state.search = search.value; state.page = 1; load() }, 350)
  })
  tierSel.addEventListener('change',   () => { state.tier   = tierSel.value;   state.page = 1; load() })
  statusSel.addEventListener('change', () => { state.status = statusSel.value; state.page = 1; load() })

  async function load() {
    const q = { page: state.page, limit: PAGE_SIZE }
    if (state.search) q.search = state.search
    if (state.tier)   q.tier   = state.tier
    if (state.status) q.status = state.status

    try {
      const data  = await api.get('/admin/api/users', q)
      state.rows  = data.users
      state.total = data.total
      renderRows()
      renderPager()
    } catch (e) { toast(e.message, 'error') }
  }

  function renderRows() {
    const body = el.querySelector('#uBody')
    if (!state.rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="adm-table-empty">No users found.</td></tr>`
      return
    }
    body.innerHTML = state.rows.map(u => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            ${avatar(u.name)}
            <div>
              <div class="adm-td-name">${esc(u.name)}</div>
              <div style="font-size:0.72rem;color:var(--adm-text-faint)">${esc(u.email)}</div>
            </div>
          </div>
        </td>
        <td>${badge(u.tier.replace('level_',''), u.tier)}</td>
        <td style="font-size:0.8rem;color:var(--adm-text-dim)">${esc(u.region)}</td>
        <td style="font-size:0.78rem;color:var(--adm-text-faint)">${fmtDate(u.created_at)}</td>
        <td>${badge(u.status, u.status)}</td>
        <td>
          <div class="adm-actions">
            <button class="adm-btn adm-btn-outline adm-btn-sm" data-action="view" data-id="${u.id}">View</button>
            <button class="adm-btn adm-btn-outline adm-btn-sm" data-action="tier"  data-id="${u.id}" data-name="${esc(u.name)}" data-tier="${u.tier}">Tier</button>
            ${u.status === 'active' ? `<button class="adm-btn adm-btn-danger adm-btn-sm" data-action="suspend" data-id="${u.id}" data-name="${esc(u.name)}">Suspend</button>` : ''}
          </div>
        </td>
      </tr>`).join('')

    body.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset, api))
    })
  }

  function renderPager() {
    const pages = Math.ceil(state.total / PAGE_SIZE)
    el.querySelector('#uPager').innerHTML = `
      <span>${state.total} users — page ${state.page} of ${Math.max(pages,1)}</span>
      <div class="adm-pagination-btns">
        <button class="adm-page-btn" ${state.page <= 1 ? 'disabled' : ''} id="uPrev">← Prev</button>
        <button class="adm-page-btn" ${state.page >= pages ? 'disabled' : ''} id="uNext">Next →</button>
      </div>`
    el.querySelector('#uPrev')?.addEventListener('click', () => { state.page--; load() })
    el.querySelector('#uNext')?.addEventListener('click', () => { state.page++; load() })
  }

  await load()
}

async function handleAction({ action, id, name, tier }, api) {
  if (action === 'view') {
    try {
      const u = await api.get(`/admin/api/users/${id}`)
      modal(`
        <div class="adm-modal-head"><span class="adm-modal-title">User Detail</span><button class="adm-modal-close" id="mc">✕</button></div>
        <div class="adm-modal-body">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
            ${avatar(u.name, 48)}
            <div>
              <div style="font-size:1rem;font-weight:500">${esc(u.name)}</div>
              <div style="font-size:0.8rem;color:var(--adm-text-faint)">${esc(u.email)}</div>
            </div>
          </div>
          <div class="adm-stat-row" style="margin-bottom:16px">
            ${chip('Tier', u.tier.replace('level_',''))}
            ${chip('Region', u.region)}
            ${chip('Status', u.status)}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.8rem">
            <div><span style="color:var(--adm-text-faint)">ID:</span> <span style="font-family:monospace">${u.id}</span></div>
            <div><span style="color:var(--adm-text-faint)">Joined:</span> ${fmtDate(u.created_at)}</div>
            <div><span style="color:var(--adm-text-faint)">Matches:</span> ${u.stats?.matches ?? '—'}</div>
            <div><span style="color:var(--adm-text-faint)">Threads:</span> ${u.stats?.threads ?? '—'}</div>
          </div>
        </div>`)
      document.getElementById('mc').addEventListener('click', () => document.getElementById('admModals').innerHTML = '')
    } catch (e) { toast(e.message, 'error') }
  }

  if (action === 'tier') {
    modal(`
      <div class="adm-modal-head"><span class="adm-modal-title">Change Tier — ${esc(name)}</span><button class="adm-modal-close" id="mc">✕</button></div>
      <div class="adm-modal-body">
        <div class="adm-form-row">
          <label class="adm-form-label">New tier</label>
          <select class="adm-select" id="newTier" style="width:100%">
            <option value="level_base"  ${tier==='level_base'  ? 'selected':''}>Base (Free)</option>
            <option value="level_plus"  ${tier==='level_plus'  ? 'selected':''}>Plus (₱499/mo)</option>
            <option value="level_prime" ${tier==='level_prime' ? 'selected':''}>Prime (₱1,990/mo)</option>
          </select>
        </div>
        <div class="adm-form-row">
          <label class="adm-form-label">Reason (optional)</label>
          <input class="adm-input" id="tierReason" placeholder="Admin override reason…" style="width:100%">
        </div>
      </div>
      <div class="adm-modal-footer">
        <button class="adm-btn adm-btn-outline" id="mc2">Cancel</button>
        <button class="adm-btn adm-btn-gold" id="tierSave">Save</button>
      </div>`)
    document.getElementById('mc').addEventListener('click',  () => document.getElementById('admModals').innerHTML = '')
    document.getElementById('mc2').addEventListener('click', () => document.getElementById('admModals').innerHTML = '')
    document.getElementById('tierSave').addEventListener('click', async () => {
      const t = document.getElementById('newTier').value
      const r = document.getElementById('tierReason').value
      try {
        await api.patch(`/admin/api/users/${id}/tier`, { tier: t, reason: r })
        toast('Tier updated.', 'success')
        document.getElementById('admModals').innerHTML = ''
      } catch (e) { toast(e.message, 'error') }
    })
  }

  if (action === 'suspend') {
    modal(`
      <div class="adm-modal-head"><span class="adm-modal-title">Suspend ${esc(name)}?</span><button class="adm-modal-close" id="mc">✕</button></div>
      <div class="adm-modal-body" style="font-size:0.85rem;color:var(--adm-text-dim)">This will immediately restrict the user's access. You can reactivate them from the user detail view.</div>
      <div class="adm-modal-footer">
        <button class="adm-btn adm-btn-outline" id="mc2">Cancel</button>
        <button class="adm-btn adm-btn-danger" id="suspendConfirm">Suspend account</button>
      </div>`)
    document.getElementById('mc').addEventListener('click',  () => document.getElementById('admModals').innerHTML = '')
    document.getElementById('mc2').addEventListener('click', () => document.getElementById('admModals').innerHTML = '')
    document.getElementById('suspendConfirm').addEventListener('click', async () => {
      try {
        await api.patch(`/admin/api/users/${id}/status`, { status: 'suspended' })
        toast('User suspended.', 'success')
        document.getElementById('admModals').innerHTML = ''
      } catch (e) { toast(e.message, 'error') }
    })
  }
}

function chip(label, value) {
  return `<div class="adm-stat-chip"><span style="color:var(--adm-text-faint)">${label}:</span> ${esc(value)}</div>`
}

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—' }
