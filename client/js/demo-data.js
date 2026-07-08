/* ============================================================
   LEVEL — Demo / mock preview data (single source of truth)

   Use for UI previews and local-only demo sessions — NOT production
   auth. Real sign-up uses Supabase (Google OAuth or email OTP).

   See README → "Demo & preview mode" for how to use each account.
   ============================================================ */

/** Reserved for future MFA phone SMS — see client/js/otp-service.js */
export const DEMO_MFA_PHONE_CODE = '123456'

/**
 * Pre-filled onboarding answers (labels must match ref_* seed data).
 * Used when starting the "profile review" demo after sign-up.
 */
export const DEMO_ONBOARDING = {
  step0: ['Female'],
  step1: ['she / her'],
  step2: ['Straight'],
  step3: ['Men', 'Everyone'],
  step4: { min: 30, max: 42 },
  step5: ['Intentional Partner'],
  intentCategory: 'intentional_partner',
  step6: ['Peak career alongside a serious partner'],
  step7: ['Established'],
  stepLifeInt: ['Blended'],
  stepMobility: ['Frequent traveller'],
  step8: ['I address it directly but calmly'],
  step9: ['Fine dining', 'International travel', 'Fitness & wellness', 'Cooking'],
  step10:
    'I am building toward a partnership where ambition and depth reinforce each other — not compete. My next chapter is anchored in one city I love, with someone who shares a long-term vision.',
}

/** Demo personas — pick one in auth via "Try demo". */
export const DEMO_ACCOUNTS = {
  /**
   * Fresh applicant — empty onboarding, starts at onboarding.html.
   * Use to test the full questionnaire (options load from /api/ref/all).
   */
  applicant: {
    key: 'applicant',
    label: 'New applicant',
    email: 'demo@level.app',
    firstName: 'Jordan',
    lastName: 'M.',
    profession: '',
    authProvider: 'demo',
    oauthFields: { firstName: true, lastName: true, email: true, avatarUrl: false },
    onboarding: null,
    profileSavedToDb: false,
    destination: 'onboarding.html',
    blurb: 'Empty onboarding — walk through every step from scratch.',
  },

  /**
   * Post-onboarding — onboarding answers pre-filled; lands on profile setup
   * so you can review/edit selections + name/email before saving to DB.
   */
  profileReview: {
    key: 'profileReview',
    label: 'After onboarding (pre-filled)',
    email: 'preview@level.app',
    firstName: 'Alexandra',
    lastName: 'R.',
    // Title left blank — real users fill this on profile setup (not onboarding).
    profession: '',
    authProvider: 'demo',
    oauthFields: { firstName: true, lastName: true, email: true, avatarUrl: false },
    onboarding: DEMO_ONBOARDING,
    profileSavedToDb: false,
    destination: 'profile-setup.html',
    blurb: 'Onboarding complete — review name, email, and all selections on profile setup.',
  },

  /**
   * Returning member — profile marked saved locally; dashboard + mock matches.
   * Browse other people via profile.html?id=james-t (members.js).
   */
  member: {
    key: 'member',
    label: 'Returning member',
    email: 'alexandra@level.app',
    firstName: 'Alexandra',
    lastName: 'R.',
    profession: 'Partner, McKinsey & Company',
    role: 'Partner, McKinsey & Company',
    location: 'New York, NY',
    education: 'MBA, Harvard Business School',
    industry: 'Management Consulting',
    legacyVision: DEMO_ONBOARDING.step10,
    authProvider: 'demo',
    oauthFields: { firstName: true, lastName: true, email: true, avatarUrl: false },
    onboarding: DEMO_ONBOARDING,
    profileSavedToDb: true,
    profileComplete: 100,
    matches: 7,
    messages: 3,
    views: 12,
    connections: 2,
    tier: 'base',
    destination: 'dashboard.html',
    blurb: 'Dashboard with your name — mock match cards from members.js.',
  },
}

/** Legacy seed accounts (email/password UI if re-enabled). */
export const SEED_ACCOUNTS = Object.values(DEMO_ACCOUNTS).map(a => ({
  email: a.email,
  password: 'demo1234',
  firstName: a.firstName,
  lastName: a.lastName,
  profession: a.profession || a.role || '',
}))

/** Other people's profiles for browsing — not your account. */
export const DEMO_MEMBER_PROFILES = {
  note: 'Mock curated members live in client/js/members.js',
  exampleUrls: [
    'profile.html?id=james-t',
    'profile.html?id=sarah-m',
    'profile.html?id=david-k',
  ],
}

/** Admin panel (server seed 001) — dev only. */
export const DEMO_ADMIN = {
  email: 'admin@level.app',
  password: 'Level@Admin2024!',
  loginUrl: 'admin-login.html',
}
