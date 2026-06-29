import { toast, badge } from '../ui.js'

export async function render(el, api) {
  el.innerHTML = `
    <div class="adm-panel-header">
      <div><div class="adm-panel-title">Messaging Oversight</div><div class="adm-panel-sub">Review flagged conversations.</div></div>
    </div>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Thread</th><th>Participants</th><th>Flagged</th><th>Reason</th><th>Status</th><th></th></tr></thead>
        <tbody id="msgBody"></tbody>
      </table>
    </div>`

  async function load() {
    try {
      const data    = await api.get('/admin/api/messaging/flagged')
      const threads = data.threads || []
      const body    = el.querySelector('#msgBody')

      if (!threads.length) {
        body.innerHTML = `<tr><td colspan="6" class="adm-table-empty">No flagged threads.</td></tr>`
        return
      }

      body.innerHTML = threads.map(t => `
        <tr>
          <td class="adm-td-id">${t.id}</td>
          <td style="font-size:0.82rem;color:var(--adm-text-dim)">${esc(t.participants?.join(' & ') || '—')}</td>
          <td style="font-size:0.78rem;color:var(--adm-text-faint)">${fmtDate(t.flagged_at)}</td>
          <td style="font-size:0.82rem;color:var(--adm-text-dim)">${esc(t.flag_reason || '—')}</td>
          <td>${badge(t.status, t.status)}</td>
          <td>
            <div class="adm-actions">
              <button class="adm-btn adm-btn-outline adm-btn-sm" data-action="dismiss" data-id="${t.id}">Dismiss</button>
              <button class="adm-btn adm-btn-danger  adm-btn-sm" data-action="disable" data-id="${t.id}">Disable thread</button>
            </div>
          </td>
        </tr>`).join('')

      body.querySelectorAll('[data-action]').forEach(btn =>
        btn.addEventListener('click', async () => {
          const newStatus = btn.dataset.action === 'dismiss' ? 'dismissed' : 'disabled'
          try {
            await api.patch(`/admin/api/messaging/${btn.dataset.id}`, { status: newStatus })
            toast(`Thread ${newStatus}.`, 'success')
            load()
          } catch (e) { toast(e.message, 'error') }
        })
      )
    } catch (e) {
      el.querySelector('#msgBody').innerHTML = `<tr><td colspan="6" style="padding:24px;color:var(--adm-red)">${e.message}</td></tr>`
    }
  }

  await load()
}

function esc(s)  { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—' }
