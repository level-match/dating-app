import { apiFetch } from './sso.js'

export async function saveAlignmentAnswers(answers) {
  const res = await apiFetch('/api/auth/profile/alignment', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || 'Failed to save alignment answers.')
    err.code = data.error
    throw err
  }
  return data
}

export async function fetchAlignmentAnswers() {
  const res = await apiFetch('/api/auth/profile')
  if (!res.ok) return null
  const { profile } = await res.json()
  return profile?.alignment_answers || null
}
