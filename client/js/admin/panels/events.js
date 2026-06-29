import { toast, modal, badge } from '../ui.js'

export async function render(el, api) {
  el.innerHTML = `
    <div class="adm-panel-header">
      <div><div class="adm-panel-title">Events</div><div class="adm-panel-sub">Manage mixers and VIP community events.</div></div>
      <button class="adm-btn adm-btn-gold" id="createEventBtn">+ Create event</button>
    </div>
    <div class="adm-event-grid" id="eventGrid"></div>`

  el.querySelector('#createEventBtn').addEventListener('click', () => openEventModal(null, api, load))

  async function load() {
    const grid = el.querySelector('#eventGrid')
    grid.innerHTML = '<div class="adm-loading"><div class="adm-spinner"></div></div>'
    try {
      const data   = await api.get('/admin/api/events')
      const events = data.events || data
      if (!events.length) {
        grid.innerHTML = `<div style="color:var(--adm-text-faint);padding:32px">No events yet.</div>`
        return
      }
      grid.innerHTML = events.map(ev => `
        <div class="adm-event-card">
          <div class="adm-event-head">
            <div>
              <div class="adm-event-title">${esc(ev.name)}</div>
              <div class="adm-event-meta">${esc(ev.venue)} · ${fmtDate(ev.event_date)}</div>
            </div>
            ${badge(ev.type || ev.event_type, ev.type || ev.event_type)}
          </div>
          <div class="adm-rsvp-bar">
            <div class="adm-rsvp-fill" style="width:${pct(ev.rsvp_count, ev.capacity)}%"></div>
          </div>
          <div style="font-size:0.75rem;color:var(--adm-text-faint)">${ev.rsvp_count ?? 0} / ${ev.capacity ?? '?'} RSVPs · ${badge(ev.status, ev.status)}</div>
          <div class="adm-event-footer">
            <div class="adm-actions">
              <button class="adm-btn adm-btn-outline adm-btn-sm" data-action="edit"   data-id="${ev.id}">Edit</button>
              <button class="adm-btn adm-btn-danger  adm-btn-sm" data-action="delete" data-id="${ev.id}" data-name="${esc(ev.name)}">Delete</button>
            </div>
          </div>
        </div>`).join('')

      grid.querySelectorAll('[data-action]').forEach(btn =>
        btn.addEventListener('click', () => {
          if (btn.dataset.action === 'edit') {
            const ev = events.find(e => String(e.id) === btn.dataset.id)
            openEventModal(ev, api, load)
          } else if (btn.dataset.action === 'delete') {
            confirmDelete(btn.dataset.id, btn.dataset.name, api, load)
          }
        })
      )
    } catch (e) { grid.innerHTML = `<div style="padding:24px;color:var(--adm-red)">${e.message}</div>` }
  }

  await load()
}

function openEventModal(ev, api, reload) {
  const isEdit = !!ev
  modal(`
    <div class="adm-modal-head">
      <span class="adm-modal-title">${isEdit ? 'Edit Event' : 'Create Event'}</span>
      <button class="adm-modal-close" id="mc">✕</button>
    </div>
    <div class="adm-modal-body">
      <div class="adm-form-grid">
        <div class="adm-form-row" style="grid-column:1/-1">
          <label class="adm-form-label">Event name</label>
          <input class="adm-input" id="evName" value="${esc(ev?.name||'')}" style="width:100%">
        </div>
        <div class="adm-form-row">
          <label class="adm-form-label">Type</label>
          <select class="adm-select" id="evType" style="width:100%">
            <option value="mixer" ${(ev?.type||ev?.event_type)==='mixer'?'selected':''}>Mixer</option>
            <option value="vip"   ${(ev?.type||ev?.event_type)==='vip'  ?'selected':''}>VIP</option>
          </select>
        </div>
        <div class="adm-form-row">
          <label class="adm-form-label">Status</label>
          <select class="adm-select" id="evStatus" style="width:100%">
            <option value="upcoming"  ${ev?.status==='upcoming' ?'selected':''}>Upcoming</option>
            <option value="completed" ${ev?.status==='completed'?'selected':''}>Completed</option>
            <option value="cancelled" ${ev?.status==='cancelled'?'selected':''}>Cancelled</option>
          </select>
        </div>
        <div class="adm-form-row" style="grid-column:1/-1">
          <label class="adm-form-label">Venue</label>
          <input class="adm-input" id="evVenue" value="${esc(ev?.venue||'')}" style="width:100%">
        </div>
        <div class="adm-form-row">
          <label class="adm-form-label">Date</label>
          <input class="adm-input" id="evDate" type="date" value="${ev?.event_date?.slice(0,10)||''}" style="width:100%">
        </div>
        <div class="adm-form-row">
          <label class="adm-form-label">Capacity</label>
          <input class="adm-input" id="evCap" type="number" value="${ev?.capacity||''}" min="1" style="width:100%">
        </div>
      </div>
    </div>
    <div class="adm-modal-footer">
      <button class="adm-btn adm-btn-outline" id="mc2">Cancel</button>
      <button class="adm-btn adm-btn-gold" id="evSave">${isEdit ? 'Save changes' : 'Create event'}</button>
    </div>`)

  const clear = () => document.getElementById('admModals').innerHTML = ''
  document.getElementById('mc').addEventListener('click',  clear)
  document.getElementById('mc2').addEventListener('click', clear)
  document.getElementById('evSave').addEventListener('click', async () => {
    const payload = {
      name:       document.getElementById('evName').value,
      event_type: document.getElementById('evType').value,
      status:     document.getElementById('evStatus').value,
      venue:      document.getElementById('evVenue').value,
      event_date: document.getElementById('evDate').value,
      capacity:   Number(document.getElementById('evCap').value),
    }
    try {
      if (isEdit) await api.put(`/admin/api/events/${ev.id}`, payload)
      else        await api.post('/admin/api/events', payload)
      toast(isEdit ? 'Event updated.' : 'Event created.', 'success')
      clear(); reload()
    } catch (e) { toast(e.message, 'error') }
  })
}

function confirmDelete(id, name, api, reload) {
  modal(`
    <div class="adm-modal-head"><span class="adm-modal-title">Delete "${esc(name)}"?</span><button class="adm-modal-close" id="mc">✕</button></div>
    <div class="adm-modal-body" style="font-size:0.85rem;color:var(--adm-text-dim)">This action cannot be undone. All RSVP records will be deleted.</div>
    <div class="adm-modal-footer">
      <button class="adm-btn adm-btn-outline" id="mc2">Cancel</button>
      <button class="adm-btn adm-btn-danger" id="delConfirm">Delete event</button>
    </div>`)
  const clear = () => document.getElementById('admModals').innerHTML = ''
  document.getElementById('mc').addEventListener('click',  clear)
  document.getElementById('mc2').addEventListener('click', clear)
  document.getElementById('delConfirm').addEventListener('click', async () => {
    try { await api.del(`/admin/api/events/${id}`); toast('Event deleted.', 'success'); clear(); reload() }
    catch (e) { toast(e.message, 'error') }
  })
}

function pct(a, b) { return b ? Math.min(100, Math.round((a / b) * 100)) : 0 }
function esc(s)  { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—' }
