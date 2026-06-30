/* ============================================================
   LEVEL — Demo / preview session (local only, no Supabase)

   Loads a prepopulated session into the store for UI walkthroughs.
   Call startDemoSession() from auth.html "Try demo" buttons.
   ============================================================ */

import { store } from './store.js'
import { DEMO_ACCOUNTS } from './demo-data.js'
import { evaluateEligibility } from './matching-policy.js'

/**
 * @param {'applicant'|'profileReview'|'member'} variant
 * @returns {string} destination path
 */
export function startDemoSession(variant = 'profileReview') {
  const demo = DEMO_ACCOUNTS[variant]
  if (!demo) throw new Error(`Unknown demo variant: ${variant}`)

  const base = store.getDefaultUser()

  store.setUser({
    ...base,
    id: `demo-${variant}`,
    firstName: demo.firstName,
    lastName: demo.lastName,
    email: demo.email,
    role: demo.role || demo.profession || '',
    profession: demo.profession || '',
    location: demo.location || '',
    education: demo.education || '',
    industry: demo.industry || '',
    legacyVision: demo.legacyVision || '',
    bio: demo.legacyVision || '',
    tier: demo.tier || 'base',
    matches: demo.matches ?? 0,
    messages: demo.messages ?? 0,
    views: demo.views ?? 0,
    connections: demo.connections ?? 0,
    profileComplete: demo.profileComplete ?? 0,
    profileSavedToDb: !!demo.profileSavedToDb,
    authProvider: 'demo',
    oauthFields: demo.oauthFields,
    mfa: { required: false, complete: true },
  })

  if (demo.onboarding) {
    store.setOnboarding(demo.onboarding)
    const category = demo.onboarding.intentCategory || demo.onboarding.step5?.[0]
    store.setMatchingEligibility(evaluateEligibility(category))
  } else {
    localStorage.removeItem('level_onboarding')
  }

  return demo.destination
}

export function installDemoHandlers() {
  window.startDemoSession = function (variant) {
    try {
      const dest = startDemoSession(variant)
      window.location.href = dest
    } catch (e) {
      console.error('[demo-mode]', e)
      alert('Demo mode failed to start.')
    }
  }
}

export function listDemoAccounts() {
  return Object.values(DEMO_ACCOUNTS)
}
