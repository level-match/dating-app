/* ============================================================
   LEVEL — Core App JS (ES Module)
   ============================================================ */

import { store } from './store.js'
import { getTierMeta } from './membership.js'

// ─── Nav scroll effect ───
export function initNav() {
  const nav = document.getElementById('mainNav')
  if (!nav) return
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 60)
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

// ─── Scroll reveal ───
export function initScrollReveal() {
  const els = document.querySelectorAll('[data-reveal], .stagger-children')
  if (!els.length) return
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target) }
    })
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
  els.forEach(el => io.observe(el))
}

// ─── Smooth anchor scroll ───
export function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(link.getAttribute('href'))
      if (!target) return
      e.preventDefault()
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
}

// ─── Animated bar fills on scroll ───
export function initCompatBars() {
  const fills = document.querySelectorAll('.dimension-fill, .featured-score-bar-fill')
  if (!fills.length) return
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return
      const el = e.target
      const w = el.style.width
      el.style.width = '0'
      requestAnimationFrame(() => {
        el.style.transition = 'width 1.2s cubic-bezier(0.16,1,0.3,1)'
        el.style.width = w
      })
      io.unobserve(el)
    })
  }, { threshold: 0.2 })
  fills.forEach(el => io.observe(el))
}

// ─── Toast ───
export function showToast(message, icon = '✓', duration = 4000) {
  document.querySelector('.toast')?.remove()
  const t = document.createElement('div')
  t.className = 'toast animate-fadeUp'
  t.innerHTML = `<span style="font-size:18px">${icon}</span><span>${message}</span>`
  document.body.appendChild(t)
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300) }, duration)
}

// ─── User hydration (fill name etc. from store) ───
export function hydrateUser() {
  const user = store.getUser() || store.getDefaultUser()
  const displayName = user.firstName || 'there'
  document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = displayName })
  document.querySelectorAll('[data-user-role]').forEach(el => { el.textContent = user.role || user.professionalTitle || '' })
  document.querySelectorAll('[data-user-tier]').forEach(el => {
    const meta = getTierMeta(user.tier)
    el.textContent = `${meta.shortName || user.tier} Member ✦`
  })
  return user
}

/** Load saved profile from API into the local store (real name, alignment fields). */
export async function hydrateFromProfile() {
  try {
    const { apiFetch } = await import('./sso.js')
    const res = await apiFetch('/api/auth/profile')
    if (!res.ok) return null
    const { profile: p } = await res.json()
    const user = store.getUser() || store.getDefaultUser()

    store.setUser({
      ...user,
      firstName: p.first_name || user.firstName,
      lastName: p.last_name || user.lastName,
      role: p.professional_title || user.role,
      professionalTitle: p.professional_title,
      location: p.location,
      education: p.education,
      industry: p.industry,
      legacyVision: p.legacy_vision,
      bio: p.legacy_vision,
      genderIdentity: p.gender_identity,
      pronouns: (p.pronouns || []).map(x => x.label).join(', '),
      sexualOrientation: p.orientation,
      preferredGenders: (p.preferred_genders || []).map(x => x.label),
      primaryIntent: p.primary_intent,
      longTermVision: p.long_term_vision,
      careerChapter: p.career_chapter,
      lifeIntegration: p.life_integration,
      mobilityProfile: p.mobility_profile,
      emotionalStyle: p.emotional_style,
      lifestyleValues: (p.lifestyle_values || []).map(x => x.label),
      ageRangeMin: p.age_range_min,
      ageRangeMax: p.age_range_max,
      profileSavedToDb: true,
      profileLoadedFromApi: true,
      profileComplete: 100,
    })
    return p
  } catch (e) {
    console.warn('[app] hydrateFromProfile skipped:', e.message)
    return null
  }
}

// ─── Body fade-in ───
export function initBodyFade() {
  document.body.style.opacity = '0'
  requestAnimationFrame(() => {
    document.body.style.transition = 'opacity .3s ease'
    document.body.style.opacity = '1'
  })
}

// ─── Guard: gate every protected route ───
// 1. No session  → seed the MFA-cleared demo user so previews work directly.
// 2. Session owes MFA → bounce to the Identity Gateway; protected content
//    (dashboard, matches, onboarding, messages, bookings, settings, …) stays
//    sealed until both OTP factors are verified.
export function requireAuth() {
  if (!store.isLoggedIn()) {
    store.setUser(store.getDefaultUser())
    return
  }
  if (store.needsMfa()) {
    window.location.replace('mfa.html')
  }
}

// ─── Init shared across all pages ───
export function initShared() {
  initBodyFade()
  initNav()
  initScrollReveal()
  initSmoothScroll()
  initCompatBars()
  hydrateUser()
}
