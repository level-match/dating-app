/* ============================================================
   LEVEL — Core App JS (ES Module)
   ============================================================ */

import { store } from './store.js'
import { getTierMeta } from './membership.js'
import { syncPhotosToStore } from './profile-photos.js'
import { fetchSubscription } from './subscription.js'

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

const PROFILE_CACHE_MS = 5 * 60 * 1000

function applyProfileToStore(p, user) {
  const mainPhoto = p.avatar_url || user.mainPhoto || null
  const photos = user.photos?.length
    ? user.photos
    : (mainPhoto ? [{ src: mainPhoto, name: 'main-photo' }] : [])

  store.setUser({
    ...user,
    firstName: p.first_name || user.firstName,
    lastName: p.last_name || user.lastName,
    role: p.professional_title || user.role,
    professionalTitle: p.professional_title,
    location: p.location,
    countryCode: p.country_code,
    countryName: p.country_name,
    regionCode: p.region_code,
    regionName: p.region_name,
    city: p.city,
    education: p.education,
    industry: p.industry,
    age: p.age ?? user.age ?? null,
    orientationVisibility: p.orientation_visibility ?? user.orientationVisibility,
    blockColleagues: p.block_colleagues ?? user.blockColleagues,
    discretionMode: p.discretion_mode ?? user.discretionMode,
    mutualOnlyVisibility: p.mutual_only_visibility ?? user.mutualOnlyVisibility,
    readReceipts: p.read_receipts ?? user.readReceipts,
    legacyVision: p.legacy_vision,
    bio: p.legacy_vision,
    genderIdentity: p.gender_identity,
    genderIdentityId: p.gender_identity_id,
    pronouns: (p.pronouns || []).map(x => x.label).join(', '),
    sexualOrientation: p.orientation,
    preferredGenders: (p.preferred_genders || []).map(x => x.label),
    preferredGenderIds: (p.preferred_genders || []).map(x => x.id),
    primaryIntent: p.primary_intent,
    longTermVision: p.long_term_vision,
    careerChapter: p.career_chapter,
    lifeIntegration: p.life_integration,
    mobilityProfile: p.mobility_profile,
    emotionalStyle: p.emotional_style,
    lifestyleValues: (p.lifestyle_values || []).map(x => x.label),
    ageRangeMin: p.age_range_min,
    ageRangeMax: p.age_range_max,
    mainPhoto,
    photos,
    avatarUrl: null,
    profileSavedToDb: true,
    profileLoadedFromApi: true,
    profileComplete: 100,
    profileFetchedAt: Date.now(),
  })

  if (p.block_colleagues != null) {
    store.updateSetting('privacy', 'blockColleagues', !!p.block_colleagues)
  }
  if (p.discretion_mode != null) {
    store.updateSetting('privacy', 'discretionMode', !!p.discretion_mode)
  }
  if (p.mutual_only_visibility != null) {
    store.updateSetting('privacy', 'mutualOnlyVisibility', !!p.mutual_only_visibility)
  }
  if (p.read_receipts != null) {
    store.updateSetting('privacy', 'readReceipts', !!p.read_receipts)
  }
}

/** Load saved profile from API into the local store (real name, alignment fields). */
export async function hydrateFromProfile({ force = false } = {}) {
  const cached = store.getUser()
  if (
    !force
    && cached?.profileLoadedFromApi
    && cached?.profileFetchedAt
    && Date.now() - cached.profileFetchedAt < PROFILE_CACHE_MS
  ) {
    return cached
  }

  try {
    const { supabase } = await import('./supabase.js')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null

    const { apiFetch } = await import('./sso.js')
    const res = await apiFetch('/api/auth/profile')
    if (!res.ok) return null
    const { profile: p } = await res.json()
    const user = store.getUser() || store.getDefaultUser()
    applyProfileToStore(p, user)
    await syncPhotosToStore().catch((e) => {
      console.warn('[app] syncPhotosToStore skipped:', e.message)
    })
    return p
  } catch (e) {
    console.warn('[app] hydrateFromProfile skipped:', e.message)
    return null
  }
}

/** Sync membership tier from the subscriptions table (per auth account). */
export async function hydrateSubscription() {
  try {
    const { supabase } = await import('./supabase.js')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null

    const data = await fetchSubscription()
    return store.applySubscriptionSync(data)
  } catch (e) {
    console.warn('[app] hydrateSubscription skipped:', e.message)
    return null
  }
}

/** Load profile + membership from API into the local store. */
export async function hydrateFromServer({ force = false } = {}) {
  await hydrateFromProfile({ force })
  await hydrateSubscription()
  return store.getUser()
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
