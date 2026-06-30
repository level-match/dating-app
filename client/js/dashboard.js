import { requireAuth, hydrateUser, hydrateFromProfile, initBodyFade, initNav, initScrollReveal, initCompatBars } from './app.js'
import { getMembersByScore } from './members.js'
import { store } from './store.js'

requireAuth()
initBodyFade()
initNav()
initScrollReveal()
initCompatBars()

async function bootDashboard() {
  await hydrateFromProfile()
  const user = hydrateUser()

  const hasSavedProfile = !!user.profileSavedToDb
  const isNewAccount = !hasSavedProfile && store.getSentRequestIds().length === 0

// Hydrate stats — real counts only; never synthetic fallbacks
const statValues = document.querySelectorAll('.stat-value')
if (statValues[0]) statValues[0].textContent = user.matches    || 0
if (statValues[1]) statValues[1].textContent = user.messages   || 0
if (statValues[2]) statValues[2].textContent = user.views      || 0
if (statValues[3]) statValues[3].textContent = user.connections || 0

// Greeting
const hour = new Date().getHours()
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
const topbarTitle = document.querySelector('.topbar-title')
if (topbarTitle) topbarTitle.textContent = `${greeting}, ${user.firstName || 'there'}.`

// Date line
const welcomeDate = document.querySelector('.welcome-date')
if (welcomeDate) {
  const now = new Date()
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const datePart = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`
  welcomeDate.textContent = isNewAccount
    ? `${datePart} · Complete your profile to unlock curated matches`
    : `${datePart} · ${user.matches || 0} new profiles curated for you`
}

// ─── Today's curated matches ───
const dashGrid = document.getElementById('dashMatches')

if (dashGrid && isNewAccount) {
  dashGrid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:var(--s-10) var(--s-6);background:rgba(255,255,255,0.03);border:1px solid var(--border-light);border-radius:var(--radius-2xl);">
      <div style="font-family:var(--font-sans);font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-400);margin-bottom:var(--s-3);">Welcome to LEVEL</div>
      <div style="font-family:var(--font-serif);font-size:var(--text-2xl);font-weight:300;color:var(--text-primary);">Your curated matches will appear here</div>
      <p style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;line-height:1.7;color:var(--text-secondary);max-width:460px;margin:var(--s-3) auto var(--s-6);">
        Complete your profile and set your relationship goals so LEVEL can find your most compatible connections.
      </p>
      <div style="display:flex;flex-wrap:wrap;gap:var(--s-3);justify-content:center;">
        <a class="btn btn-gold btn-sm" href="profile-setup.html">Complete your profile</a>
        <a class="btn btn-outline-dark btn-sm" href="matches.html">Browse members</a>
      </div>
    </div>`

} else if (dashGrid && !store.isMatchingEligible()) {
  // Intent Guardrail — respectful hold on curated introductions.
  dashGrid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:var(--s-10) var(--s-6);background:rgba(255,255,255,0.03);border:1px solid var(--border-light);border-radius:var(--radius-2xl);">
      <div style="font-family:var(--font-sans);font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-400);margin-bottom:var(--s-3);">Built for intentional partnership</div>
      <div style="font-family:var(--font-serif);font-size:var(--text-2xl);font-weight:300;color:var(--text-primary);">Your matching network is on hold</div>
      <p style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;line-height:1.7;color:var(--text-secondary);max-width:460px;margin:var(--s-3) auto var(--s-6);">
        LEVEL is designed for individuals seeking intentional, long-term partnerships. Your current relationship preferences may not align with the core matching network at this time.
      </p>
      <div style="display:flex;flex-wrap:wrap;gap:var(--s-3);justify-content:center;">
        <a class="btn btn-gold btn-sm" href="onboarding.html?goals">Update relationship goals</a>
        <a class="btn btn-outline-dark btn-sm" href="restaurants.html">Continue exploring LEVEL</a>
      </div>
    </div>`

} else if (dashGrid) {
  // Filter out members who already received a request — they've moved to chat
  const sentIds = store.getSentRequestIds()
  const top = getMembersByScore().filter(m => !sentIds.includes(m.id)).slice(0, 3)

  if (top.length === 0) {
    dashGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:var(--s-10) var(--s-6);
                  background:rgba(255,255,255,0.03);border:1px solid var(--border-light);
                  border-radius:var(--radius-2xl);">
        <div style="font-family:var(--font-sans);font-size:10px;font-weight:500;letter-spacing:0.18em;
                    text-transform:uppercase;color:var(--gold-400);margin-bottom:var(--s-3);">Queue complete</div>
        <div style="font-family:var(--font-serif);font-size:var(--text-2xl);font-weight:300;
                    color:var(--text-primary);">Your requests are out there.</div>
        <p style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;line-height:1.7;
                  color:var(--text-secondary);max-width:420px;margin:var(--s-3) auto var(--s-6);">
          You've connected with everyone in your current curated set. Check messages for replies,
          or upgrade to unlock more matches.
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:var(--s-3);justify-content:center;">
          <a class="btn btn-gold btn-sm" href="chat.html">View pending requests</a>
          <a class="btn btn-outline-dark btn-sm" href="membership.html">See upgrade options</a>
        </div>
      </div>`
  } else {
    dashGrid.innerHTML = top.map(m => {
      const bg = m.photo
        ? `<img class="match-card-bg" src="${m.photo}" alt="${m.name}" loading="lazy">`
        : `<div class="match-card-bg" style="background:${m.fallback};"></div>`
      return `
        <div class="match-card" role="button" tabindex="0" data-id="${m.id}">
          ${bg}
          <div class="match-overlay"></div>
          <div class="match-card-content">
            <div class="match-name">${m.name}</div>
            <div class="match-details">${m.profession} · ${m.location}</div>
            <div class="match-align"><span class="match-align-score">${m.score}%</span> Compatibility Alignment</div>
            <div class="match-summary">${m.alignmentSummary}</div>
          </div>
        </div>`
    }).join('')

    const open = id => { if (id) window.location = `profile.html?id=${encodeURIComponent(id)}&from=dashboard` }
    dashGrid.addEventListener('click', e => {
      const card = e.target.closest('.match-card')
      if (card) open(card.dataset.id)
    })
    dashGrid.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      const card = e.target.closest('.match-card')
      if (card) { e.preventDefault(); open(card.dataset.id) }
    })
  }
}

// ─── Activity feed + Featured Match: hide for new accounts ───
if (isNewAccount) {
  const activityList = document.getElementById('activityList')
  if (activityList) {
    activityList.innerHTML = `
      <div style="text-align:center;padding:var(--s-8) var(--s-6);">
        <div style="font-family:var(--font-sans);font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-400);margin-bottom:var(--s-3);">No activity yet</div>
        <div style="font-family:var(--font-serif);font-size:var(--text-xl);font-weight:300;color:var(--text-primary);margin-bottom:var(--s-3);">Start connecting to see engagement</div>
        <p style="font-family:var(--font-sans);font-size:var(--text-sm);font-weight:300;line-height:1.7;color:var(--text-secondary);max-width:360px;margin:0 auto var(--s-5);">
          Once you connect with members, their messages, views, and profile activity will appear here.
        </p>
        <a class="btn btn-outline-dark btn-sm" href="matches.html">Find connections</a>
      </div>`
  }

  const featuredMatch = document.getElementById('featuredMatch')
  if (featuredMatch) featuredMatch.style.display = 'none'
}

// Filter tabs
window.setFilter = function(el) {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'))
  el.classList.add('active')
}
}

bootDashboard()
