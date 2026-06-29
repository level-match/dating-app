/* ============================================================
   LEVEL — Alignment Engine
   Weighted Euclidean-distance compatibility scoring across
   5 categories. Total category weight = 90; output normalised
   to a 0–100 score. A Q1-Intention extreme mismatch (Legacy
   Builder vs Exploring) zeroes the entire score.

   Weights:
     · Intention   25  (with hard-gate)
     · Mindset     20
     · Life Stage  20
     · Lifestyle   15
     · Mobility    10  (geographic compatibility)
   ============================================================ */

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
 */
export function scoreCompatibility(userA, userB) {
  if (isZeroOut(userA, userB)) {
    return {
      overall: 0,
      zeroedOut: true,
      breakdown: CATEGORIES.map(c => ({ id: c.id, label: c.label, score: 0, weight: c.weight })),
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
  },
]
