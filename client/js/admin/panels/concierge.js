import { toast, modal, badge } from '../ui.js'

const STATUSES = ['pending','confirmed','completed','cancelled']

export async function render(el, api) {
  el.innerHTML = `
    <div class="adm-panel-header">
      <div><div class="adm-panel-title">Concierge & Bookings</div><div class="adm-panel-sub">Manage Prime member concierge requests and venue bookings.</div></div>
    </div>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Member</th><th>Type</th><th>Venue / Details</th><th>Date</th><th>Status</th><th>Assigned</th><th></th></tr></thead>
        <tbody id="conBody"></tbody>
      </table>
    </div>`

  async function load() {
    try {
      const data     = await api.get('/admin/api/concierge/bookings')
      const bookings = data.bookings || []
      const body     = el.querySelector('#conBody')

      if (!bookings.length) {
        body.innerHTML = `<tr><td colspan="7" class="adm-table-empty">No bookings found.</td></tr>`
        return
      }

      body.innerHTML = bookings.map(b => `
        <tr>
          <td class="adm-td-name">${esc(b.member_name || b.user_id)}</td>
          <td>${badge(b.request_type || 'booking', b.status)}</td>
          <td style="font-size:0.82rem;color:var(--adm-text-dim);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.venue || b.details || '—')}</td>
          <td style="font-size:0.78rem;color:var(--adm-text-faint)">${fmtDate(b.requested_for || b.booking_date)}</td>
          <td>${badge(b.status, b.status)}</td>
          <td style="font-size:0.8rem;color:var(--adm-text-dim)">${esc(b.assigned_to || '—')}</td>
          <td>
            <button class="adm-btn adm-btn-outline adm-btn-sm" data-id="${b.id}" data-current="${b.status}" data-member="${esc(b.member_name||b.user_id)}" data-notes="${esc(b.notes||'')}">
              Update
            </button>
          </td>
        </tr>`).join('')

      body.querySelectorAll('[data-id]').forEach(btn =>
        btn.addEventListener('click', () => openUpdateModal(btn.dataset, api, load))
      )
    } catch (e) {
      el.querySelector('#conBody').innerHTML = `<tr><td colspan="7" style="padding:24px;color:var(--adm-red)">${e.message}</td></tr>`
    }
  }

  await load()
}

function openUpdateModal({ id, current, member, notes }, api, reload) {
  modal(`
    <div class="adm-modal-head">
      <span class="adm-modal-title">Update Booking — ${esc(member)}</span>
      <button class="adm-modal-close" id="mc">✕</button>
    </div>
    <div class="adm-modal-body">
      <div class="adm-form-row">
        <label class="adm-form-label">Status</label>
        <select class="adm-select" id="conStatus" style="width:100%">
          ${STATUSES.map(s => `<option value="${s}" ${s===current?'selected':''}>${cap(s)}</option>`).join('')}
        </select>
      </div>
      <div class="adm-form-row">
        <label class="adm-form-label">Assign to admin</label>
        <input class="adm-input" id="conAssign" placeholder="Admin name or email…" style="width:100%">
      </div>
      <div class="adm-form-row">
        <label class="adm-form-label">Notes</label>
        <textarea class="adm-textarea" id="conNotes" placeholder="Internal notes…">${esc(notes)}</textarea>
      </div>
    </div>
    <div class="adm-modal-footer">
      <button class="adm-btn adm-btn-outline" id="mc2">Cancel</button>
      <button class="adm-btn adm-btn-gold" id="conSave">Save</button>
    </div>`)

  const clear = () => document.getElementById('admModals').innerHTML = ''
  document.getElementById('mc').addEventListener('click',  clear)
  document.getElementById('mc2').addEventListener('click', clear)
  document.getElementById('conSave').addEventListener('click', async () => {
    try {
      await api.patch(`/admin/api/concierge/bookings/${id}`, {
        status:      document.getElementById('conStatus').value,
        assigned_to: document.getElementById('conAssign').value || undefined,
        notes:       document.getElementById('conNotes').value,
      })
      toast('Booking updated.', 'success')
      clear(); reload()
    } catch (e) { toast(e.message, 'error') }
  })
}

function cap(s)  { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
function esc(s)  { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—' }
