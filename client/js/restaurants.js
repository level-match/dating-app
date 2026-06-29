import { store } from './store.js'
import { requireAuth, initBodyFade, initNav, showToast } from './app.js'
import { canUseExecution, showUpgradeModal, currentTier } from './membership-guard.js'
import { getEntitlements } from './membership.js'

requireAuth()
initBodyFade()
initNav()

window.setFilter = function(el) {
  document.querySelectorAll('.exp-filter-chip').forEach(c => c.classList.remove('active'))
  el.classList.add('active')
}

let currentRestaurant = null
let currentMonth = new Date().getMonth()
let currentYear = new Date().getFullYear()
let selectedDay = null

const restaurantData = {
  'eleven-madison':   { name: 'Eleven Madison Park', cuisine: 'Contemporary Tasting Menu · Midtown, New York', stars: '⭐⭐⭐ Michelin' },
  'le-bernardin':     { name: 'Le Bernardin', cuisine: 'French Seafood · Midtown, New York', stars: '⭐⭐⭐ Michelin' },
  'per-se':           { name: 'Per Se', cuisine: 'Contemporary American · Columbus Circle', stars: '⭐⭐⭐ Michelin' },
  'aska':             { name: 'Aska', cuisine: 'Nordic Tasting Menu · Brooklyn', stars: '⭐⭐ Michelin' },
  'gabriel-kreuther': { name: 'Gabriel Kreuther', cuisine: 'Alsatian-American · Midtown', stars: '⭐⭐ Michelin' },
  'ko':               { name: 'Momofuku Ko', cuisine: 'Contemporary · East Village', stars: '⭐⭐ Michelin' },
  'gramercy':         { name: 'Gramercy Tavern', cuisine: 'American · Gramercy Park', stars: '⭐ Michelin' },
  'attaboy':          { name: 'Attaboy', cuisine: 'Bespoke Cocktails · Lower East Side', stars: '' },
  'employees-only':   { name: 'Employees Only', cuisine: 'Speakeasy Bar · West Village', stars: '' },
  'the-bar-room':     { name: 'The Dead Rabbit', cuisine: 'Historic Bar · Financial District', stars: '' },
}

window.openBooking = function(id) {
  /* ── Execution layer gate ──────────────────────────────────────
     Base:  midpoint suggestion + automated venue suggestions only.
            The calendar/booking flow is a Plus+ feature.
     Plus:  in-app scheduling and reservation requests.
     Prime: full concierge — handled by the concierge flow (same modal,
            Prime badge shown, concierge note pre-filled).
     ─────────────────────────────────────────────────────────── */
  if (!canUseExecution('scheduling')) {
    const tier = currentTier()
    showUpgradeModal({
      requiredTier: 'plus',
      title: 'Reservation booking is a Plus feature',
      body: `Your <strong>LEVEL Base</strong> plan includes automated venue suggestions.
             Upgrade to <strong>LEVEL Plus</strong> (₱499/month) to book reservations
             directly through the app, or to <strong>LEVEL Prime</strong> for full concierge assistance.`,
    })
    return
  }

  currentRestaurant = id
  const data  = restaurantData[id] || { name: id, cuisine: '', stars: '' }
  const modal = document.getElementById('bookingModal')
  const ent   = getEntitlements(currentTier())

  // Update modal content
  const nameEl = modal.querySelector('.booking-visual-content div[style*="font-serif"]')
  if (nameEl) nameEl.innerHTML = data.name.replace(' ', '<br>')
  const cuisineEl = modal.querySelector('.booking-visual-content div[style*="font-sans"]')
  if (cuisineEl) cuisineEl.textContent = data.cuisine

  // Inject concierge note for Prime members
  const existingNote = modal.querySelector('.prime-concierge-note')
  if (existingNote) existingNote.remove()
  if (ent.executionLayer === 'concierge') {
    const noteEl = document.createElement('div')
    noteEl.className = 'prime-concierge-note'
    noteEl.innerHTML = `
      <div style="background:rgba(193,164,100,0.08);border:1px solid rgba(193,164,100,0.25);border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:flex-start;gap:12px;">
        <span style="font-size:16px;flex-shrink:0;">✦</span>
        <div>
          <div style="font-family:var(--font-sans);font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-300);font-weight:600;margin-bottom:4px;">Prime Concierge</div>
          <div style="font-family:var(--font-sans);font-size:0.84rem;font-weight:300;color:rgba(255,255,255,0.65);line-height:1.55;">Your personal date assistant will confirm the reservation, brief the host, and handle any preferences on your behalf.</div>
        </div>
      </div>`
    modal.querySelector('.booking-visual-content')?.after(noteEl)
  }

  modal.classList.add('open')
  document.body.style.overflow = 'hidden'
  selectedDay = null
  renderCalendar()
}

window.closeBooking = function() {
  document.getElementById('bookingModal').classList.remove('open')
  document.body.style.overflow = ''
}

window.selectTime = function(el) {
  document.querySelectorAll('.time-slot:not(.unavailable)').forEach(t => t.classList.remove('selected'))
  el.classList.add('selected')
}

window.selectParty = function(el) {
  el.parentNode.querySelectorAll('.time-slot').forEach(t => t.classList.remove('selected'))
  el.classList.add('selected')
}

window.prevMonth = function() {
  currentMonth--
  if (currentMonth < 0) { currentMonth = 11; currentYear-- }
  renderCalendar()
}

window.nextMonth = function() {
  currentMonth++
  if (currentMonth > 11) { currentMonth = 0; currentYear++ }
  renderCalendar()
}

function renderCalendar() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const calMonthEl = document.getElementById('calMonth')
  if (calMonthEl) calMonthEl.textContent = months[currentMonth] + ' ' + currentYear

  const grid = document.getElementById('calGrid')
  if (!grid) return
  while (grid.children.length > 7) grid.removeChild(grid.lastChild)

  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const today = new Date()
  const available = [12, 13, 14, 16, 17, 19, 20, 21, 23, 24, 26, 27]

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div')
    el.className = 'cal-day disabled'
    grid.appendChild(el)
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div')
    const isToday = d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
    const isPast = new Date(currentYear, currentMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const isAvail = available.includes(d) && !isPast

    el.className = 'cal-day'
    if (isToday) el.classList.add('today')
    if (isPast) el.classList.add('disabled')
    if (isAvail) el.classList.add('available')
    if (d === selectedDay) el.classList.add('selected')
    el.textContent = d

    if (!isPast) {
      el.onclick = () => {
        document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'))
        el.classList.add('selected')
        selectedDay = d
      }
    }
    grid.appendChild(el)
  }
}

window.confirmBooking = function() {
  const data = restaurantData[currentRestaurant] || { name: currentRestaurant }
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']

  // Time slots live inside `.time-slots`; the party-size row is its own
  // sibling group of `.time-slot`s outside of `.time-slots`.
  const timeEl  = document.querySelector('.time-slots .time-slot.selected:not(.unavailable)')
  const partyEl = Array.from(document.querySelectorAll('.time-slot.selected'))
    .find(el => !el.closest('.time-slots'))

  const selectedTime    = timeEl?.textContent?.trim() || '7:30 PM'
  const partySize       = partyEl?.textContent?.trim() || '2'
  const specialRequests = document.querySelector('.form-textarea')?.value?.trim() || ''

  const booking = {
    restaurantId: currentRestaurant,
    restaurant:   data.name,
    cuisine:      data.cuisine,
    stars:        data.stars || '',
    date:         selectedDay ? `${months[currentMonth]} ${selectedDay}, ${currentYear}` : 'Date TBD',
    time:         selectedTime,
    party:        partySize,
    notes:        specialRequests,
    confirmation: 'LVL-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    createdAt:    new Date().toISOString(),
  }
  store.addBooking(booking)
  window.closeBooking()
  showToast(`Reservation confirmed at ${data.name}!`, '🎉', 2200)
  setTimeout(() => {
    window.location.href = 'reservations.html'
  }, 1500)
}

// Close on backdrop click
document.getElementById('bookingModal')?.addEventListener('click', function(e) {
  if (e.target === this) window.closeBooking()
})
