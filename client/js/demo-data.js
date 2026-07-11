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

/** Demo personas disabled — app is running on live data. */
export const DEMO_ACCOUNTS = {}

export const SEED_ACCOUNTS = []

export const DEMO_MEMBER_PROFILES = {}

export const DEMO_ADMIN = {}
