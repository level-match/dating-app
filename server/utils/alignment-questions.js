/**
 * Alignment questionnaire schema — mirrors client/js/alignment-engine.js CATEGORIES.
 * Questionnaire categories (excluding demographic fit, which is profile-based).
 */

const QUESTIONNAIRE_CATEGORIES = [
  {
    id: 'intention',
    label: 'Intention Alignment',
    weight: 25,
    questions: [
      {
        id: 'objective',
        options: [{ value: 4 }, { value: 3 }, { value: 2 }, { value: 1 }],
        zeroOut: true,
      },
      {
        id: 'timeline',
        options: [{ value: 3 }, { value: 2 }, { value: 1 }],
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
        options: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }],
      },
      {
        id: 'success',
        options: [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }],
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
        options: [{ value: 3 }, { value: 2 }, { value: 1 }],
      },
      {
        id: 'partner_drive',
        options: [{ value: 3 }, { value: 2 }, { value: 1 }],
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
        options: [{ value: 3 }, { value: 2 }, { value: 1 }],
      },
      {
        id: 'social',
        options: [{ value: 1 }, { value: 3 }, { value: 2 }],
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
        options: [{ value: 1 }, { value: 2 }, { value: 3 }],
      },
    ],
  },
]

const CATEGORY_BY_ID = Object.fromEntries(
  QUESTIONNAIRE_CATEGORIES.map(c => [c.id, c]),
)

function optionRange(question) {
  const vals = question.options.map(o => o.value)
  return Math.max(...vals) - Math.min(...vals) || 1
}

function questionSimilarity(question, a, b) {
  if (a == null || b == null) return 0
  return 1 - Math.abs(Number(a) - Number(b)) / optionRange(question)
}

function scoreCategoryFromAnswers(categoryId, answersA, answersB) {
  const cat = CATEGORY_BY_ID[categoryId]
  if (!cat) return 0.5
  const sims = cat.questions.map(q => {
    const a = answersA?.[categoryId]?.[q.id]
    const b = answersB?.[categoryId]?.[q.id]
    return questionSimilarity(q, a, b)
  })
  return sims.reduce((sum, v) => sum + v, 0) / sims.length
}

/**
 * Legacy Builder (4) vs Exploring (1) zeroes the entire pairing.
 */
function isZeroOutPair(answersA, answersB) {
  const cat = CATEGORY_BY_ID.intention
  const q = cat.questions[0]
  const a = answersA?.intention?.[q.id]
  const b = answersB?.intention?.[q.id]
  if (a == null || b == null) return false
  const max = Math.max(...q.options.map(o => o.value))
  const min = Math.min(...q.options.map(o => o.value))
  return (a === max && b === min) || (a === min && b === max)
}

module.exports = {
  QUESTIONNAIRE_CATEGORIES,
  CATEGORY_BY_ID,
  optionRange,
  questionSimilarity,
  scoreCategoryFromAnswers,
  isZeroOutPair,
}
