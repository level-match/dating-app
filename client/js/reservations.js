import { store } from './store.js'
import { requireAuth, initBodyFade, initNav, showToast } from './app.js'

requireAuth()
initBodyFade()
initNav()

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

let currentFilter = 'upcoming'

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]))
}

/** Parse a booking date like "May 14, 2026" into a Date (start-of-day). */
function bookingDate(booking) {
  if (!booking?.date) return null
  const m = booking.date.match(/^(\w+)\s+(\d{1,2}),\s+(\d{4})$/)
  if (!m) return null
  const monthIdx = MONTHS.indexOf(m[1])
  if (monthIdx < 0) return null
  return new Date(+m[3], monthIdx, +m[2])
}

function isUpcoming(booking) {
  const d = bookingDate(booking)
  if (!d) return true // unknown date defaults to upcoming
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d.getTime() >= today.getTime()
}

function renderEmpty() {
  return `
    <div class="res-empty">
      <div class="res-empty-orb">⌖</div>
      <h3>No reservations ${currentFilter === 'past' ? 'in your history' : 'yet'}.</h3>
      <p>${currentFilter === 'past'
          ? "When your upcoming reservations have passed, they'll appear here."
          : "Reserve a table from the Experiences page and your booking will appear here, with concierge support attached."}</p>
      <a href="restaurants.html" class="res-cta">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        Browse experiences
      </a>
    </div>
  `
}

function renderCard(b) {
  const notesBlock = b.notes
    ? `<div class="res-notes">${escapeHtml(b.notes)}</div>`
    : ''

  const stars = b.stars
    ? `<div class="res-stars">${escapeHtml(b.stars)}</div>`
    : ''

  const confirmationCode = b.confirmation || ('LVL-' + String(b.id).slice(-6))

  return `
    <article class="res-card" data-id="${b.id}">
      <div class="res-card-header">
        <div>
          <div class="res-name">${escapeHtml(b.restaurant || 'Reservation')}</div>
          ${b.cuisine ? `<div class="res-cuisine">${escapeHtml(b.cuisine)}</div>` : ''}
          ${stars}
        </div>
        <span class="res-status">Confirmed</span>
      </div>

      <div class="res-detail-grid">
        <div class="res-detail-cell">
          <div class="label">Date</div>
          <div class="value">${escapeHtml(b.date || 'TBD')}</div>
        </div>
        <div class="res-detail-cell">
          <div class="label">Time</div>
          <div class="value">${escapeHtml(b.time || '—')}</div>
        </div>
        <div class="res-detail-cell">
          <div class="label">Party</div>
          <div class="value">${escapeHtml(b.party || '2')} guest${b.party === '1' ? '' : 's'}</div>
        </div>
      </div>

      ${notesBlock}

      <div class="res-footer">
        <div class="res-confirmation">Confirmation <strong>${escapeHtml(confirmationCode)}</strong></div>
        <div class="res-actions">
          <button class="res-btn" onclick="modifyBooking(${b.id})">Modify</button>
          <button class="res-btn danger" onclick="cancelBooking(${b.id})">Cancel</button>
        </div>
      </div>
    </article>
  `
}

function render() {
  const list = document.getElementById('resList')
  if (!list) return

  let bookings = store.getBookings()

  if (currentFilter === 'upcoming') bookings = bookings.filter(isUpcoming)
  else if (currentFilter === 'past') bookings = bookings.filter(b => !isUpcoming(b))

  if (!bookings.length) {
    list.innerHTML = renderEmpty()
    return
  }

  list.innerHTML = `<div class="res-grid">${bookings.map(renderCard).join('')}</div>`
}

window.setResTab = function (el, key) {
  document.querySelectorAll('.res-tab').forEach(t => t.classList.remove('active'))
  el.classList.add('active')
  currentFilter = key
  render()
}

window.cancelBooking = function (id) {
  if (!confirm('Cancel this reservation? Our concierge will handle the rest.')) return
  store.cancelBooking(id)
  showToast('Reservation cancelled.', '✓', 2500)
  render()
}

window.modifyBooking = function (id) {
  showToast('A concierge will reach out shortly to update your reservation.', '✦', 3500)
}

render()
