/* ============================================================
   LEVEL — Alignment Engine
   Weighted Euclidean-distance compatibility scoring across
   5 questionnaire categories plus profile-based demographic
   fit. Total category weight = 100; output normalised to a
   0–100 score. A Q1-Intention extreme mismatch (Legacy
   Builder vs Exploring) zeroes the entire score.

   Weights:
     · Intention    25  (with hard-gate)
     · Mindset      20
     · Life Stage   20
     · Lifestyle    15
     · Demographic  10  (age range, gender prefs, location)
     · Mobility     10  (geographic compatibility)
   ============================================================ */

export const DEMOGRAPHIC_WEIGHT = 10

/** ref_preferred_genders.id → ref_genders.id values that satisfy the preference */
const PREFERRED_TO_IDENTITY = {
  1: [1],       // Men → Male
  2: [2],       // Women → Female
  3: [3],       // Non-binary people → Non-binary
  4: [4],       // Trans women → Transgender
  5: [1, 4],    // Trans men → Male, Transgender
  6: [3, 99],   // Genderqueer → Non-binary, Custom
  7: null,      // Everyone → no filter
}

export const CATEGORIES = [
  {
    id: 'intention',
    label: 'Intention Alignment',
    weight: 25,
    questions: [
      {
        id: 'objective',
        prompt: 'Which statement best describes your primary objective on LEVEL?',
        options: [
          { value: 4, label: 'Legacy Builder',      desc: 'I am looking for a life partner to build a home and future with.' },
          { value: 3, label: 'Intentional Partner', desc: 'I am seeking a serious, committed relationship and am ready for long-term alignment.' },
          { value: 2, label: 'Directed Discovery',  desc: 'I am dating with the intention of a long-term partnership but prefer a slow, deliberate pace.' },
          { value: 1, label: 'Exploring',           desc: 'I am open to connections but not currently focused on a definitive long-term outcome.' },
        ],
        zeroOut: true,
      },
      {
        id: 'timeline',
        prompt: 'What is your ideal timeline for establishing a permanent partnership?',
        options: [
          { value: 3, label: 'Ready now',             desc: 'I am ready to commit now for the right person.' },
          { value: 2, label: 'Within 12 months',      desc: 'I anticipate a serious commitment within the next 12 months.' },
          { value: 1, label: '2+ years of dating',    desc: 'I prefer to date for 2+ years before considering permanent life integration.' },
        ],
      },
    ],
  },
  {
    id: 'mindset',
    label: 'Mindset & Values',
    weight: 20,
    questions: [
      {
        id: 'pillar',
        prompt: 'Which "Pillar of Value" is the primary driver in your life decisions?',
        options: [
          { value: 1, label: 'Growth & Ambition',  desc: 'Constant improvement and reaching the next peak.' },
          { value: 2, label: 'Integrity & Service', desc: 'Character, ethics, and community impact.' },
          { value: 3, label: 'Legacy & Family',     desc: 'Building something that outlasts me for my loved ones.' },
          { value: 4, label: 'Harmony & Peace',     desc: 'Maintaining a high-quality, balanced internal state.' },
        ],
      },
      {
        id: 'success',
        prompt: 'How do you define "Success" at this stage of your life?',
        options: [
          { value: 1, label: 'Achievement',     desc: 'Reaching specific professional or financial milestones.' },
          { value: 2, label: 'Influence',       desc: 'Having a voice and making an impact in my industry or community.' },
          { value: 3, label: 'Quality of Life', desc: 'The freedom to enjoy experiences and time with loved ones.' },
          { value: 4, label: 'Stability',       desc: 'Securing a safe and predictable future for my inner circle.' },
        ],
      },
    ],
  },
  {
    id: 'lifestage',
    label: 'Life Stage & Career',
    weight: 20,
    questions: [
      {
        id: 'chapter',
        prompt: 'How would you describe your current "Career Chapter"?',
        options: [
          { value: 3, label: 'Scaling',       desc: 'I am in high-growth mode, often requiring long hours and high intensity.' },
          { value: 2, label: 'Established',   desc: 'I have reached a level of seniority that allows for more predictable stability.' },
          { value: 1, label: 'Transitioning', desc: 'I am pivoting into a new venture or stepping back to focus on personal goals.' },
        ],
      },
      {
        id: 'partner_drive',
        prompt: 'When it comes to professional ambition, you prefer a partner who:',
        options: [
          { value: 3, label: 'Power Couple',         desc: 'Is as driven as I am — we are a "power couple" building together.' },
          { value: 2, label: 'Grounded Contrast',    desc: 'Is stable and supportive, providing a grounded contrast to my high-intensity life.' },
          { value: 1, label: 'Family-First',         desc: 'Prioritises life outside of work — I want us both to de-emphasise career for family.' },
        ],
      },
    ],
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle Compatibility',
    weight: 15,
    questions: [
      {
        id: 'integration',
        prompt: 'How do you integrate your professional life with your personal world?',
        options: [
          { value: 3, label: 'Blended',   desc: 'My work and social life mix — I enjoy networking and business dinners with my partner.' },
          { value: 2, label: 'Segmented', desc: 'I keep a firm boundary — when I am home, work stays at the office.' },
          { value: 1, label: 'Fluid',     desc: 'I work when inspiration strikes; I need a partner who understands an unconventional schedule.' },
        ],
      },
      {
        id: 'social',
        prompt: 'What is your "Social Architecture" preference?',
        options: [
          { value: 1, label: 'Private & Low-Profile', desc: 'Intimate evenings or small gatherings with a curated inner circle.' },
          { value: 3, label: 'The Networker',         desc: 'I thrive in social environments and enjoy attending events / functions regularly.' },
          { value: 2, label: 'The Balanced Host',     desc: 'A mix of deep privacy and occasional high-level social engagements.' },
        ],
      },
    ],
  },
  {
    id: 'mobility',
    label: 'Mobility Profile',
    weight: 10,
    questions: [
      {
        id: 'profile',
        prompt: 'How geographically anchored is your life today?',
        options: [
          { value: 1, label: 'Rooted',            desc: 'Anchored in one city, building a home. Continuity and community are foundational.' },
          { value: 2, label: 'Frequent Traveller', desc: 'A home base I love, with regular work or pleasure travel. Bicoastal or international cadence.' },
          { value: 3, label: 'Global Citizen',    desc: 'Multiple cities, fluid base. Comfortable building partnership across borders.' },
        ],
      },
    ],
  },
]

/* ─── Demographic fit (profile-based, not questionnaire) ─── */

/**
 * Normalise profile / API shapes into a demographic scoring object.
 *   { age, ageRangeMin, ageRangeMax, genderIdentityId, preferredGenderIds,
 *     countryCode, regionCode, city }
 */
export function normalizeDemographicProfile(raw) {
  if (!raw) return null
  const prefIds = raw.preferredGenderIds
    ?? raw.preferred_gender_ids
    ?? (Array.isArray(raw.preferredGenders)
      ? raw.preferredGenders.map(g => (typeof g === 'object' ? g.id : g))
      : null)
  return {
    age: raw.age ?? null,
    ageRangeMin: raw.ageRangeMin ?? raw.age_range_min ?? null,
    ageRangeMax: raw.ageRangeMax ?? raw.age_range_max ?? null,
    genderIdentityId: raw.genderIdentityId ?? raw.gender_identity_id ?? null,
    preferredGenderIds: prefIds ?? [],
    countryCode: raw.countryCode ?? raw.country_code ?? null,
    regionCode: raw.regionCode ?? raw.region_code ?? null,
    city: raw.city ?? null,
  }
}

function normalizeCode(value) {
  if (!value) return null
  return String(value).trim().toUpperCase()
}

/** Score how well candidateAge fits viewer's stated age range, in [0,1]. */
function ageInRangeScore(age, min, max) {
  if (age == null) return 0.5
  if (min == null && max == null) return 0.5
  const lo = min ?? 18
  const hi = max ?? 99
  if (age >= lo && age <= hi) return 1
  const dist = age < lo ? lo - age : age - hi
  if (dist >= 8) return 0
  return 1 - dist / 8
}

/** Mutual age-range fit: each person's age vs the other's preferred range. */
export function scoreAgeRangeOverlap(profileA, profileB) {
  const a = normalizeDemographicProfile(profileA)
  const b = normalizeDemographicProfile(profileB)
  if (!a || !b) return 0
  return (
    ageInRangeScore(b.age, a.ageRangeMin, a.ageRangeMax) +
    ageInRangeScore(a.age, b.ageRangeMin, b.ageRangeMax)
  ) / 2
}

function genderMatchesPreference(viewerPrefs, candidateGenderId) {
  const prefs = (viewerPrefs || []).map(Number)
  if (!prefs.length) return 0.5
  if (prefs.includes(7)) return 1
  if (candidateGenderId == null) return 0.5
  const genderId = Number(candidateGenderId)
  return prefs.some(prefId => {
    const allowed = PREFERRED_TO_IDENTITY[prefId]
    if (allowed == null) return true
    return allowed.includes(genderId)
  }) ? 1 : 0
}

/** Mutual gender-preference fit: each person's prefs vs the other's identity. */
export function scoreGenderPreferenceMatch(profileA, profileB) {
  const a = normalizeDemographicProfile(profileA)
  const b = normalizeDemographicProfile(profileB)
  if (!a || !b) return 0
  return (
    genderMatchesPreference(a.preferredGenderIds, b.genderIdentityId) +
    genderMatchesPreference(b.preferredGenderIds, a.genderIdentityId)
  ) / 2
}

/** Location proximity in [0,1]: same city > region > country > abroad. */
export function scoreLocationProximity(profileA, profileB) {
  const a = normalizeDemographicProfile(profileA)
  const b = normalizeDemographicProfile(profileB)
  if (!a || !b) return 0
  const aCountry = normalizeCode(a.countryCode)
  const bCountry = normalizeCode(b.countryCode)
  if (!aCountry || !bCountry) return 0.5
  if (aCountry !== bCountry) return 0.15

  const aRegion = normalizeCode(a.regionCode)
  const bRegion = normalizeCode(b.regionCode)
  if (aRegion && bRegion && aRegion === bRegion) {
    const aCity = (a.city || '').trim().toLowerCase()
    const bCity = (b.city || '').trim().toLowerCase()
    if (aCity && bCity && aCity === bCity) return 1
    return 0.75
  }
  return 0.45
}

/**
 * Combined demographic fit (0–100) from age overlap, gender prefs, and location.
 *   { overall, components: { ageRange, gender, location } }
 */
export function scoreDemographicFit(profileA, profileB) {
  const ageScore = scoreAgeRangeOverlap(profileA, profileB)
  const genderScore = scoreGenderPreferenceMatch(profileA, profileB)
  const locationScore = scoreLocationProximity(profileA, profileB)
  const combined = (ageScore + genderScore + locationScore) / 3
  return {
    overall: Math.round(combined * 100),
    components: {
      ageRange: Math.round(ageScore * 100),
      gender: Math.round(genderScore * 100),
      location: Math.round(locationScore * 100),
    },
  }
}

/* ─── Helpers ─── */

function optionRange(question) {
  const vals = question.options.map(o => o.value)
  return Math.max(...vals) - Math.min(...vals) || 1
}

/**
 * Per-question similarity in [0,1] from absolute distance.
 *  1.0 = identical answers, 0 = polar opposites on that scale.
 */
function questionSimilarity(question, a, b) {
  if (a == null || b == null) return 0
  return 1 - Math.abs(a - b) / optionRange(question)
}

/* ─── Zero-out gate ─── */

/**
 * Returns true when the pairing should be excluded outright.
 * Rule (per spec): If one user picks Q1 = 4 (Legacy Builder) and the
 * other picks Q1 = 1 (Exploring), zero the score entirely.
 */
export function isZeroOut(userA, userB) {
  const q = CATEGORIES[0].questions[0]              // Intention → objective
  const a = userA?.[CATEGORIES[0].id]?.[q.id]
  const b = userB?.[CATEGORIES[0].id]?.[q.id]
  if (a == null || b == null) return false
  const max = Math.max(...q.options.map(o => o.value))
  const min = Math.min(...q.options.map(o => o.value))
  return (a === max && b === min) || (a === min && b === max)
}

/* ─── Core scoring ─── */

/**
 * Returns a structured compatibility result between two answer sets.
 *   { overall: 0-100, zeroedOut: bool, breakdown: [{id,label,score,weight}] }
 *
 * Each user object is keyed by category id, then question id:
 *   { intention: { objective: 4, timeline: 2 }, mindset: { ... }, ... }
 *
 * Optional `demographicsA` / `demographicsB` add the 10% Demographic Fit
 * dimension (age range overlap, gender preference match, location proximity).
 */
export function scoreCompatibility(userA, userB, { demographicsA, demographicsB } = {}) {
  if (isZeroOut(userA, userB)) {
    return {
      overall: 0,
      zeroedOut: true,
      breakdown: [
        ...CATEGORIES.map(c => ({ id: c.id, label: c.label, score: 0, weight: c.weight })),
        { id: 'demographic', label: 'Demographic Fit', score: 0, weight: DEMOGRAPHIC_WEIGHT },
      ],
    }
  }

  let weightedTotal = 0
  let weightSum     = 0
  const breakdown   = []

  for (const cat of CATEGORIES) {
    const sims = cat.questions.map(q => {
      const a = userA?.[cat.id]?.[q.id]
      const b = userB?.[cat.id]?.[q.id]
      return questionSimilarity(q, a, b)
    })
    const catScore = sims.reduce((s, v) => s + v, 0) / sims.length    // 0..1
    breakdown.push({
      id: cat.id,
      label: cat.label,
      score: Math.round(catScore * 100),
      weight: cat.weight,
    })
    weightedTotal += catScore * cat.weight
    weightSum     += cat.weight
  }

  if (demographicsA && demographicsB) {
    const demo = scoreDemographicFit(demographicsA, demographicsB)
    breakdown.push({
      id: 'demographic',
      label: 'Demographic Fit',
      score: demo.overall,
      weight: DEMOGRAPHIC_WEIGHT,
      components: demo.components,
    })
    weightedTotal += (demo.overall / 100) * DEMOGRAPHIC_WEIGHT
    weightSum     += DEMOGRAPHIC_WEIGHT
  }

  return {
    overall: Math.round((weightedTotal / weightSum) * 100),
    zeroedOut: false,
    breakdown,
  }
}

/* ─── Utility: did the user complete every question? ─── */
export function isComplete(answers) {
  if (!answers) return false
  return CATEGORIES.every(c => c.questions.every(q => answers?.[c.id]?.[q.id] != null))
}

/* ─── Sample peer profiles for the live preview on the
       assessment page. These give the user immediate feedback
       on how their answers score against real archetypes. ─── */
export const SAMPLE_PEERS = [
  {
    name: 'James T.',
    role: 'Founder & CEO · 38 · NYC',
    answers: {
      intention: { objective: 4, timeline: 2 },
      mindset:   { pillar: 3,    success:  2 },
      lifestage: { chapter: 3,   partner_drive: 3 },
      lifestyle: { integration: 3, social: 3 },
      mobility:  { profile: 2 },
    },
    demographics: {
      age: 38, ageRangeMin: 30, ageRangeMax: 45,
      genderIdentityId: 1, preferredGenderIds: [2],
      countryCode: 'US', regionCode: 'NY', city: 'New York',
    },
  },
  {
    name: 'Mia Santos',
    role: 'Investment Director · 32 · London',
    answers: {
      intention: { objective: 3, timeline: 2 },
      mindset:   { pillar: 2,    success: 3 },
      lifestage: { chapter: 2,   partner_drive: 2 },
      lifestyle: { integration: 2, social: 2 },
      mobility:  { profile: 2 },
    },
    demographics: {
      age: 32, ageRangeMin: 28, ageRangeMax: 42,
      genderIdentityId: 2, preferredGenderIds: [1],
      countryCode: 'GB', regionCode: 'ENG', city: 'London',
    },
  },
  {
    name: 'Adrian Reyes',
    role: 'Architect · 34 · Los Angeles',
    answers: {
      intention: { objective: 2, timeline: 1 },
      mindset:   { pillar: 1,    success: 2 },
      lifestage: { chapter: 1,   partner_drive: 1 },
      lifestyle: { integration: 1, social: 1 },
      mobility:  { profile: 1 },
    },
    demographics: {
      age: 34, ageRangeMin: 26, ageRangeMax: 38,
      genderIdentityId: 1, preferredGenderIds: [2, 3],
      countryCode: 'US', regionCode: 'CA', city: 'Los Angeles',
    },
  },
  {
    name: 'Sarah M.',
    role: 'Investment Director · 32 · NYC',
    answers: {
      intention: { objective: 4, timeline: 1 },
      mindset:   { pillar: 3,    success: 4 },
      lifestage: { chapter: 2,   partner_drive: 2 },
      lifestyle: { integration: 2, social: 1 },
      mobility:  { profile: 1 },
    },
    demographics: {
      age: 32, ageRangeMin: 30, ageRangeMax: 42,
      genderIdentityId: 2, preferredGenderIds: [1],
      countryCode: 'US', regionCode: 'NY', city: 'New York',
    },
  },
]
