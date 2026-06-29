/* ============================================================
   LEVEL — Canonical Member Dataset
   --------------------------------------------------------------
   Single source of truth for curated introductions. Powers the
   Match Dashboard grid (matches.html), the expanded professional
   profile (profile.html), and the dashboard hub previews.

   Each member carries both the compact card fields and the
   structured content for the ten profile sections:
     1. Overview              6. Relationship Intent
     2. Legacy & Vision       7. Mobility Profile
     3. Career Journey        8. Compatibility Breakdown
     4. Values & Principles   9. Verification & Trust
     5. Lifestyle Alignment  10. Shared Alignment Indicators
   ============================================================ */

export const MEMBERS = [
  {
    id: 'james-t',
    name: 'James T.',
    age: 38,
    pronouns: 'he/they',
    photo: 'assets/james.jpg',
    fallback: 'linear-gradient(160deg,#1A2F4A,#0D1E35,#1E1008)',
    geoTier: 'local',
    profession: 'Founder & CEO',
    company: 'Apex Ventures · Climate tech',
    location: 'New York City',
    mobility: 'NYC anchored · frequent traveller',
    score: 96,
    careerChapter: 'Scaling chapter',
    status: 'mutual',
    presence: 'online',
    intentShort: 'Long-term partnership',
    intentLong: 'Looking for an intentional partner ready for long-term partnership.',
    alignmentSummary: 'Strong overlap in career chapter, ambition, and long-term family intent.',
    badges: ['id', 'career', 'photo', 'premium'],
    values: ['Ambition as a means', 'History', 'Cooking', 'Wine', 'Travel'],
    overview: {
      quote: 'I built my company so I could one day step back from it — not the other way around. Looking for someone who sees ambition as a means, not the meaning.',
      paragraphs: [
        'Founded Apex Ventures in 2018 and closed a Series B last year. Off-hours I cook, read history, and try to spend Sundays away from a screen.',
        'I want a real partnership — equal, ambitious, kind. Someone building their own life, not looking to be carried through mine.',
      ],
    },
    legacy: 'A family and a foundation. The long goal is to step back from the company and pour into people, not just products — to build something that outlasts the work.',
    career: [
      { role: 'Founder & CEO', org: 'Apex Ventures', period: '2018 — present', note: 'Climate infrastructure. Series B last year.' },
      { role: 'VP Product', org: 'Stripe', period: '2013 — 2018', note: 'Scaled payments products into new markets.' },
      { role: 'MBA', org: 'Harvard Business School', period: '2011 — 2013', note: '' },
    ],
    principles: [
      'Equal partnership over hierarchy',
      'Kindness is non-negotiable',
      'Ambition in service of a life — not instead of one',
    ],
    lifestyle: [
      { label: 'Pace', value: 'High intensity · scaling chapter' },
      { label: 'Off-hours', value: 'Cooking, history, screen-free Sundays' },
      { label: 'Health', value: 'Disciplined; early mornings' },
    ],
    relationship: [
      { label: 'Timeline', value: 'Open within 12 months' },
      { label: 'Family', value: 'Wants children eventually' },
      { label: 'Seeking', value: 'An equal, ambitious, kind partner' },
    ],
    shared: [
      { label: 'Family-minded', note: 'You both want children, deliberately' },
      { label: 'Career-driven', note: 'Senior operators who protect personal time' },
      { label: 'New York life', note: 'Both anchored in the city' },
    ],
  },
  {
    id: 'mia-santos',
    name: 'Mia Santos',
    age: 36,
    pronouns: 'she/her',
    photo: 'assets/mia.jpg',
    fallback: 'linear-gradient(160deg,#1A1330,#1F1340,#0F0820)',
    geoTier: 'global',
    profession: 'Pediatric Surgeon',
    company: 'Hospital La Paz',
    location: 'Madrid',
    mobility: 'Madrid · bicoastal with NYC',
    score: 94,
    careerChapter: 'Established practice',
    status: 'mutual',
    presence: 'busy',
    intentShort: 'Serious & ready',
    intentLong: 'Seeking a serious partner — ready to commit when the right person appears.',
    alignmentSummary: 'Aligned on values, a calm lifestyle rhythm, and a settled, family-minded future.',
    badges: ['id', 'career', 'photo'],
    values: ['Family', 'Art', 'Stillness', 'Medicine', 'Travel'],
    overview: {
      quote: 'Surgery taught me that the steadiest hands belong to the most settled minds. I lead a full life — I\'d like to share it with someone who leads theirs.',
      paragraphs: [
        'Pediatric surgeon at La Paz. Madrid base, with about ten trips a year to New York for a research collaboration.',
        'Art collector, quiet weekends, very close to my family. I am not in a rush, but I am clear about what I want.',
      ],
    },
    legacy: 'To keep mending what can be mended — in the operating room and at home. A steady, art-filled life with a partner who values calm as much as ambition.',
    career: [
      { role: 'Attending Surgeon, Pediatrics', org: 'Hospital La Paz', period: '2016 — present', note: 'Complex congenital cases.' },
      { role: 'Research Fellow', org: 'NewYork-Presbyterian', period: '2013 — 2016', note: 'Ongoing collaboration today.' },
      { role: 'MD', org: 'Universidad Autónoma de Madrid', period: '2005 — 2011', note: '' },
    ],
    principles: [
      'Steadiness over spectacle',
      'Family comes first, always',
      'Care is shown in attention, not words',
    ],
    lifestyle: [
      { label: 'Pace', value: 'Established · structured days' },
      { label: 'Off-hours', value: 'Galleries, family, quiet weekends' },
      { label: 'Health', value: 'Calm, deliberate routines' },
    ],
    relationship: [
      { label: 'Timeline', value: 'Ready when the right person appears' },
      { label: 'Family', value: 'Open — not on a deadline' },
      { label: 'Seeking', value: 'Someone settled who leads a full life' },
    ],
    shared: [
      { label: 'Values calm', note: 'Both protect stillness in busy lives' },
      { label: 'Globally mobile', note: 'You both keep ties to New York' },
      { label: 'Family close', note: 'Family is central for you both' },
    ],
  },
  {
    id: 'sarah-m',
    name: 'Sarah M.',
    age: 32,
    pronouns: 'she/they',
    photo: 'assets/sarah.jpg',
    fallback: 'linear-gradient(160deg,#101A2A,#0A1424,#1A1018)',
    geoTier: 'global',
    profession: 'IP Partner',
    company: 'London law firm',
    location: 'London',
    mobility: 'London anchored',
    score: 91,
    careerChapter: 'Senior partner',
    status: 'pending',
    presence: 'online',
    intentShort: 'Long-term, by decades',
    intentLong: 'Long-term seeking — building a partnership that grows over decades.',
    alignmentSummary: 'Shared deliberate pace, cultural sensibilities, and a decades-long horizon.',
    badges: ['id', 'career', 'photo'],
    values: ['Listening', 'Theatre', 'Deliberate choices', 'LGBTQIA+', 'Books'],
    overview: {
      quote: 'I argue for a living, but I don\'t want to argue at home. What I want is a partner who listens with the same care I bring to a closing argument.',
      paragraphs: [
        'IP Partner at a London firm. Trained as a barrister before going in-house, then made partner.',
        'Theatre most Thursdays. I want children eventually — not as an assumption, as a decision made together.',
      ],
    },
    legacy: 'A partnership built to grow over decades, and — deliberately, when the time is right — a family chosen rather than assumed.',
    career: [
      { role: 'IP Partner', org: 'London law firm', period: '2020 — present', note: 'Intellectual property & licensing.' },
      { role: 'Senior Counsel (in-house)', org: 'Global media group', period: '2016 — 2020', note: '' },
      { role: 'Barrister', org: 'Commercial chambers', period: '2012 — 2016', note: '' },
    ],
    principles: [
      'Listen before you argue',
      'Decide deliberately, not by default',
      'A calm home is the point of the work',
    ],
    lifestyle: [
      { label: 'Pace', value: 'Established · senior partner' },
      { label: 'Off-hours', value: 'Theatre, reading, slow weekends' },
      { label: 'Health', value: 'Measured, consistent' },
    ],
    relationship: [
      { label: 'Timeline', value: '12–24 months to serious' },
      { label: 'Family', value: 'Children: yes, deliberately' },
      { label: 'Seeking', value: 'A careful listener for the long run' },
    ],
    shared: [
      { label: 'Deliberate', note: 'Both make big decisions slowly' },
      { label: 'Culture-led', note: 'Theatre, books and quiet evenings' },
      { label: 'Long horizon', note: 'You both think in decades' },
    ],
  },
  {
    id: 'adrian-reyes',
    name: 'Adrian Reyes',
    age: 39,
    pronouns: 'he/him',
    photo: 'assets/adrian.jpg',
    fallback: 'linear-gradient(160deg,#161024,#1A0F28,#0A0814)',
    geoTier: 'national',
    profession: 'Cardiothoracic Surgeon',
    company: 'Toronto General',
    location: 'Toronto',
    mobility: 'Toronto · settled',
    score: 92,
    careerChapter: 'Established practice',
    status: 'new',
    presence: 'offline',
    intentShort: 'Permanent partnership',
    intentLong: 'Ready for a permanent partnership — done dating casually.',
    alignmentSummary: 'Closely matched on family-first intent, disciplined routines, and readiness now.',
    badges: ['id', 'career', 'photo'],
    values: ['Family', 'Wellness', 'Discipline', 'Travel', 'Devotion'],
    overview: {
      quote: 'I hold lives in my hands for a living. I\'m looking for someone I can put my own life in the hands of.',
      paragraphs: [
        'Cardiothoracic surgeon. Long days, careful evenings. I run early and cook on Sundays.',
        'I protect the people I love with everything I have. Family is the project I take most seriously.',
      ],
    },
    legacy: 'A devoted family and a steady home — the kind of certainty I work to give my patients, built for the people closest to me.',
    career: [
      { role: 'Cardiothoracic Surgeon', org: 'Toronto General', period: '2015 — present', note: '' },
      { role: 'Fellowship, Cardiac Surgery', org: 'Cleveland Clinic', period: '2012 — 2015', note: '' },
      { role: 'MD', org: 'University of Toronto', period: '2004 — 2010', note: '' },
    ],
    principles: [
      'Devotion over convenience',
      'Discipline is a form of love',
      'Protect your people, quietly',
    ],
    lifestyle: [
      { label: 'Pace', value: 'Established · disciplined cadence' },
      { label: 'Off-hours', value: 'Early runs, Sunday cooking' },
      { label: 'Health', value: 'Rigorous, by habit' },
    ],
    relationship: [
      { label: 'Timeline', value: 'Ready now for the right person' },
      { label: 'Family', value: 'Children: absolutely' },
      { label: 'Seeking', value: 'Someone to build a settled life with' },
    ],
    shared: [
      { label: 'Family-first', note: 'Children are a clear yes for you both' },
      { label: 'Disciplined', note: 'Structured routines, early mornings' },
      { label: 'Ready now', note: 'Both done with casual dating' },
    ],
  },
  {
    id: 'daniel-cruz',
    name: 'Daniel Cruz',
    age: 34,
    pronouns: 'he/him',
    photo: 'assets/daniel.jpg',
    fallback: 'linear-gradient(160deg,#1A1230,#100C24,#0A0816)',
    geoTier: 'national',
    profession: 'Creative Director',
    company: 'Global lifestyle brand',
    location: 'Mexico City',
    mobility: 'CDMX base · global citizen',
    score: 89,
    careerChapter: 'Building chapter',
    status: 'new',
    presence: 'online',
    intentShort: 'Considered & serious',
    intentLong: 'Open to where it leads — but only with someone present.',
    alignmentSummary: 'Overlap in craft-led values, worldliness, and an unhurried, considered approach.',
    badges: ['id', 'career', 'photo'],
    values: ['Craft', 'Photography', 'Cooking', 'Patience', 'Design'],
    overview: {
      quote: 'Design taught me that the best things are made slowly. I don\'t want a fast romance. I want a considered one.',
      paragraphs: [
        'Creative director for a global brand. I spend half my time in Mexico City and half in transit.',
        'I\'d happily start as pen pals turned partners — until distance shouldn\'t be the shape of it anymore.',
      ],
    },
    legacy: 'A life made with care — work I\'m proud of, a home with real craft in it, and a partner I build slowly and keep.',
    career: [
      { role: 'Creative Director', org: 'Global lifestyle brand', period: '2019 — present', note: '' },
      { role: 'Design Lead', org: 'Independent studio', period: '2014 — 2019', note: '' },
      { role: 'BFA, Communication Design', org: 'Parsons', period: '2008 — 2012', note: '' },
    ],
    principles: [
      'The best things are made slowly',
      'Presence over proximity',
      'Taste is just attention, repeated',
    ],
    lifestyle: [
      { label: 'Pace', value: 'Fluid · unconventional schedule' },
      { label: 'Off-hours', value: 'Photography, cooking, markets' },
      { label: 'Health', value: 'Active, travel-shaped' },
    ],
    relationship: [
      { label: 'Timeline', value: 'No timeline — but serious' },
      { label: 'Family', value: 'Open to either path' },
      { label: 'Seeking', value: 'Someone fully present, wherever we are' },
    ],
    shared: [
      { label: 'Craft-led', note: 'You both care how things are made' },
      { label: 'Worldly', note: 'Comfortable across cities and cultures' },
      { label: 'Unhurried', note: 'Neither of you rushes what matters' },
    ],
  },
  {
    id: 'oliver-h',
    name: 'Oliver H.',
    age: 37,
    pronouns: 'he/him',
    photo: 'assets/oliver.jpg',
    fallback: 'linear-gradient(160deg,#1A2030,#101520,#070E18)',
    geoTier: 'global',
    profession: 'Investment Director',
    company: 'Private credit',
    location: 'London',
    mobility: 'London · sails the Med in summer',
    score: 86,
    careerChapter: 'Established · low-profile',
    status: 'new',
    presence: 'busy',
    intentShort: 'Quietly serious',
    intentLong: 'Quietly serious — looking for the same in return.',
    alignmentSummary: 'Aligned on privacy, understated living, and quietly serious intentions.',
    badges: ['id', 'career'],
    values: ['Privacy', 'Sailing', 'Architecture', 'Reading', 'Restraint'],
    overview: {
      quote: 'I don\'t need a public life. I need a private one that\'s actually mine.',
      paragraphs: [
        'Investment director, mostly private credit. I sail on weekends.',
        'I read more than I speak, and I prefer dinner at home to dinner at the restaurant everyone is posting about.',
      ],
    },
    legacy: 'A private, well-built life — a real home, a small circle that matters, and a partnership that doesn\'t need an audience.',
    career: [
      { role: 'Investment Director', org: 'Private credit fund', period: '2017 — present', note: '' },
      { role: 'Principal', org: 'Merchant bank', period: '2011 — 2017', note: '' },
      { role: 'BA, Economics', org: 'LSE', period: '2005 — 2008', note: '' },
    ],
    principles: [
      'A private life, kept private',
      'Substance over visibility',
      'Say less; mean it',
    ],
    lifestyle: [
      { label: 'Pace', value: 'Established · low-profile' },
      { label: 'Off-hours', value: 'Sailing, architecture, reading' },
      { label: 'Health', value: 'Steady, outdoors when possible' },
    ],
    relationship: [
      { label: 'Timeline', value: '12 months for the right person' },
      { label: 'Family', value: 'Open' },
      { label: 'Seeking', value: 'Someone equally uninterested in performing' },
    ],
    shared: [
      { label: 'Understated', note: 'You both prefer private to public' },
      { label: 'Considered', note: 'Quality over noise in how you live' },
      { label: 'Grounded', note: 'Home over scene' },
    ],
  },
  {
    id: 'marcus-l',
    name: 'Marcus L.',
    age: 40,
    pronouns: 'he/him',
    photo: 'assets/Marcus.jpg',
    fallback: 'linear-gradient(160deg,#12180A,#0A1005,#1A1208)',
    geoTier: 'local',
    profession: 'Senior Partner · Litigation',
    company: 'New York law firm',
    location: 'New York City',
    mobility: 'NYC anchored',
    score: 91,
    careerChapter: 'Established · deliberate',
    status: 'new',
    presence: 'offline',
    intentShort: 'Marriage-focused',
    intentLong: 'Marriage-focused — looking for a life partner.',
    alignmentSummary: 'Strong overlap in marriage-minded intent, a reading life, and New York roots.',
    badges: ['id', 'career', 'photo'],
    values: ['Commitment', 'Reading', 'Patience', 'Loyalty', 'New York'],
    overview: {
      quote: 'At forty, I know exactly what I\'m looking for. I\'ve also learned to recognise it slowly.',
      paragraphs: [
        'Senior partner, litigation. I spend more time on books than on screens.',
        'I\'ve been single by choice the last three years — I\'d like that to change for the right reason, not the right timing.',
      ],
    },
    legacy: 'A marriage that holds, a home full of books, and the kind of loyalty that compounds over a lifetime.',
    career: [
      { role: 'Senior Partner', org: 'New York law firm', period: '2016 — present', note: 'Complex commercial litigation.' },
      { role: 'Partner', org: 'Litigation boutique', period: '2010 — 2016', note: '' },
      { role: 'JD', org: 'Columbia Law School', period: '2004 — 2007', note: '' },
    ],
    principles: [
      'Commit for the right reason, not the right timing',
      'Loyalty compounds',
      'Patience is not passivity',
    ],
    lifestyle: [
      { label: 'Pace', value: 'Established · deliberate' },
      { label: 'Off-hours', value: 'Reading, long walks, the city' },
      { label: 'Health', value: 'Consistent, unflashy' },
    ],
    relationship: [
      { label: 'Timeline', value: 'Ready now — won\'t rush' },
      { label: 'Family', value: 'Wants children · prepared to' },
      { label: 'Seeking', value: 'A life partner, marriage in mind' },
    ],
    shared: [
      { label: 'Marriage-minded', note: 'Both clear about wanting to commit' },
      { label: 'Readers', note: 'Books over screens for you both' },
      { label: 'New York life', note: 'Anchored in the city' },
    ],
  },
]

/* Status → display label/class used by the dashboard grid pills. */
export const STATUS_LABELS = {
  new:     'New',
  mutual:  'Mutual',
  pending: 'Pending',
}

export const PRESENCE_LABELS = {
  online:  'Online now',
  busy:    'Busy',
  offline: 'Offline',
}

/* The six standing compatibility dimensions shown on every profile. */
const COMPAT_DIMENSIONS = [
  'Career Alignment',
  'Relationship Goals',
  'Emotional Maturity',
  'Life Vision',
  'Lifestyle Match',
  'Communication',
]

export function getMembers() {
  return MEMBERS
}

export function getMembersByScore() {
  return MEMBERS.slice().sort((a, b) => b.score - a.score)
}

export function getMember(id) {
  return MEMBERS.find(m => m.id === id) || null
}

/* Derive a tailored-looking compatibility breakdown from the overall score.
   Deterministic per member (seeded by id) so it's stable across renders and
   never needs hand-maintained numbers. Values cluster around the headline
   score and are clamped to a believable 70–99 range. */
export function compatBreakdown(member) {
  const seed = (member.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const offsets = [2, -3, 1, -1, -4, 0]
  return COMPAT_DIMENSIONS.map((label, i) => {
    const jitter = ((seed * (i + 3)) % 5) - 2
    const pct = Math.max(70, Math.min(99, member.score + offsets[i] + jitter))
    return { label, pct }
  })
}
