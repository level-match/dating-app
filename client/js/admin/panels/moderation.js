import { toast, badge } from '../ui.js'

const TABS = ['pending','reviewed','actioned','dismissed']
let activeTab = 'pending'

export async function render(el, api) {
  el.innerHTML = `
    <div class="adm-panel-header">
      <div><div class="adm-panel-title">Content Moderation</div><div class="adm-panel-sub">Review flagged profiles, photos, and messages.</div></div>
    </div>
    <div class="adm-tabs">
      ${TABS.map(t => `<button class="adm-tab ${t===activeTab?'active':''}" data-tab="${t}">${cap(t)}</button>`).join('')}
    </div>
    <div class="adm-report-list" id="reportList"></div>`

  el.querySelectorAll('.adm-tab').forEach(btn =>
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab
      el.querySelectorAll('.adm-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab))
      load()
    })
  )

  async function load() {
    const list = el.querySelector('#reportList')
    list.innerHTML = '<div class="adm-loading"><div class="adm-spinner"></div></div>'
    try {
      const q = activeTab !== 'all' ? { status: activeTab } : {}
      const data = await api.get('/admin/api/reports', q)
      const reports = data.reports

      if (!reports.length) {
        list.innerHTML = `<div style="text-align:center;padding:48px;color:var(--adm-text-faint)">No ${activeTab} reports.</div>`
        return
      }

      list.innerHTML = reports.map(r => `
        <div class="adm-report-card" data-id="${r.id}">
          <div class="adm-report-head">
            <div>
              <div style="font-size:0.9rem;font-weight:500;color:var(--adm-text)">${esc(r.type)} — ${esc(r.reported_user)}</div>
              <div class="adm-report-meta">Reported by ${esc(r.reporter)} · ${fmtDate(r.created_at)}</div>
            </div>
            ${badge(r.status, r.status)}
          </div>
          <div class="adm-report-desc">${esc(r.description)}</div>
          ${r.status === 'pending' ? `
          <div class="adm-report-actions">
            <button class="adm-btn adm-btn-outline adm-btn-sm" data-action="dismiss"  data-id="${r.id}">Dismiss</button>
            <button class="adm-btn adm-btn-outline adm-btn-sm" data-action="review"   data-id="${r.id}">Mark reviewed</button>
            <button class="adm-btn adm-btn-danger  adm-btn-sm" data-action="action"   data-id="${r.id}" data-user="${esc(r.reported_user_id||r.id)}">Take action</button>
          </div>` : ''}
        </div>`).join('')

      list.querySelectorAll('[data-action]').forEach(btn =>
        btn.addEventListener('click', () => handleAction(btn.dataset, api, load))
      )
    } catch (e) {
      list.innerHTML = `<div style="padding:24px;color:var(--adm-red)">${e.message}</div>`
    }
  }

  await load()
}

async function handleAction({ action, id, user }, api, reload) {
  const statusMap = { dismiss: 'dismissed', review: 'reviewed', action: 'actioned' }
  const newStatus = statusMap[action]
  if (!newStatus) return
  try {
    await api.patch(`/admin/api/reports/${id}`, { status: newStatus })
    toast(`Report marked as ${newStatus}.`, 'success')
    reload()
  } catch (e) { toast(e.message, 'error') }
}

function cap(s)  { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
function esc(s)  { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—' }
