import { toast, modal, badge } from '../ui.js'

const TABS = ['all','active','past_due','cancelled','expired']

let activeTab = 'all'

export async function render(el, api) {
  el.innerHTML = `
    <div class="adm-panel-header">
      <div><div class="adm-panel-title">Subscriptions</div><div class="adm-panel-sub">View and manage member subscription records.</div></div>
    </div>
    <div class="adm-tabs">
      ${TABS.map(t => `<button class="adm-tab ${t===activeTab?'active':''}" data-tab="${t}">${cap(t)}</button>`).join('')}
    </div>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>User</th><th>Plan</th><th>Status</th><th>Since</th><th>Next Billing</th><th>Amount</th><th></th></tr></thead>
        <tbody id="subBody"></tbody>
      </table>
      <div class="adm-pagination" id="subPager"></div>
    </div>`

  el.querySelectorAll('.adm-tab').forEach(btn =>
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab
      el.querySelectorAll('.adm-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab))
      load()
    })
  )

  async function load() {
    const q = activeTab !== 'all' ? { status: activeTab } : {}
    try {
      const data = await api.get('/admin/api/subscriptions', q)
      const rows = data.subscriptions
      const body = el.querySelector('#subBody')

      if (!rows.length) {
        body.innerHTML = `<tr><td colspan="7" class="adm-table-empty">No subscriptions found.</td></tr>`
        return
      }

      body.innerHTML = rows.map(s => `
        <tr>
          <td class="adm-td-name">${esc(s.user_name || s.user_id)}</td>
          <td>${badge(s.tier.replace('level_',''), s.tier)}</td>
          <td>${badge(s.status, s.status)}</td>
          <td style="font-size:0.78rem;color:var(--adm-text-faint)">${fmtDate(s.started_at)}</td>
          <td style="font-size:0.78rem;color:var(--adm-text-faint)">${fmtDate(s.next_billing_at)}</td>
          <td style="font-size:0.83rem">₱${Number(s.amount_centavos/100).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
          <td>
            <div class="adm-actions">
              <button class="adm-btn adm-btn-outline adm-btn-sm" data-action="override" data-id="${s.id}" data-status="${s.status}">Override</button>
              <button class="adm-btn adm-btn-danger adm-btn-sm" data-action="refund" data-id="${s.id}" data-name="${esc(s.user_name||s.user_id)}">Refund flag</button>
            </div>
          </td>
        </tr>`).join('')

      body.querySelectorAll('[data-action]').forEach(btn =>
        btn.addEventListener('click', () => handleAction(btn.dataset, api, load))
      )

      el.querySelector('#subPager').textContent = `${data.total} subscriptions`
    } catch (e) { toast(e.message, 'error') }
  }

  await load()
}

async function handleAction({ action, id, status, name }, api, reload) {
  if (action === 'override') {
    const STATUSES = ['active','past_due','cancelled','expired']
    modal(`
      <div class="adm-modal-head"><span class="adm-modal-title">Override Status</span><button class="adm-modal-close" id="mc">✕</button></div>
      <div class="adm-modal-body">
        <div class="adm-form-row">
          <label class="adm-form-label">New status</label>
          <select class="adm-select" id="newStatus" style="width:100%">
            ${STATUSES.map(s => `<option value="${s}" ${s===status?'selected':''}>${cap(s)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="adm-modal-footer">
        <button class="adm-btn adm-btn-outline" id="mc2">Cancel</button>
        <button class="adm-btn adm-btn-gold" id="saveSub">Save</button>
      </div>`)
    document.getElementById('mc').addEventListener('click',  clear)
    document.getElementById('mc2').addEventListener('click', clear)
    document.getElementById('saveSub').addEventListener('click', async () => {
      try {
        await api.patch(`/admin/api/subscriptions/${id}`, { status: document.getElementById('newStatus').value })
        toast('Subscription updated.', 'success')
        clear(); reload()
      } catch (e) { toast(e.message, 'error') }
    })
  }

  if (action === 'refund') {
    modal(`
      <div class="adm-modal-head"><span class="adm-modal-title">Flag for Refund — ${esc(name)}</span><button class="adm-modal-close" id="mc">✕</button></div>
      <div class="adm-modal-body">
        <div class="adm-form-row">
          <label class="adm-form-label">Reason</label>
          <textarea class="adm-textarea" id="refundReason" placeholder="Describe the refund reason…"></textarea>
        </div>
      </div>
      <div class="adm-modal-footer">
        <button class="adm-btn adm-btn-outline" id="mc2">Cancel</button>
        <button class="adm-btn adm-btn-danger" id="flagRefund">Flag for refund</button>
      </div>`)
    document.getElementById('mc').addEventListener('click',  clear)
    document.getElementById('mc2').addEventListener('click', clear)
    document.getElementById('flagRefund').addEventListener('click', async () => {
      try {
        await api.post(`/admin/api/subscriptions/${id}/refund-flag`, { reason: document.getElementById('refundReason').value })
        toast('Refund flag submitted.', 'success')
        clear()
      } catch (e) { toast(e.message, 'error') }
    })
  }
}

function clear() { document.getElementById('admModals').innerHTML = '' }
function cap(s)  { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace('_',' ') : '' }
function esc(s)  { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—' }
