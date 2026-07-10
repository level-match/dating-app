import { apiFetch } from './sso.js'
import { store } from './store.js'

export const PHOTO_MAX_SLOTS = 5
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024
export const PHOTO_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

export function mapApiPhoto(photo) {
  return {
    id: photo.id,
    src: photo.signedUrl || photo.src || '',
    name: photo.storagePath?.split('/').pop() || 'photo.webp',
    storagePath: photo.storagePath,
    displayOrder: photo.displayOrder,
    isPrimary: photo.isPrimary,
  }
}

async function parseError(res) {
  const body = await res.json().catch(() => ({}))
  return body.message || 'Something went wrong. Please try again.'
}

export async function fetchProfilePhotos() {
  const res = await apiFetch('/api/profile/photos')
  if (!res.ok) throw new Error(await parseError(res))
  const { photos } = await res.json()
  return (photos || []).map(mapApiPhoto)
}

function photoFormData(file) {
  const form = new FormData()
  form.append('photo', file)
  return form
}

export async function uploadProfilePhoto(file) {
  const res = await apiFetch('/api/profile/photos', {
    method: 'POST',
    body: photoFormData(file),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return mapApiPhoto(await res.json())
}

export async function replaceProfilePhoto(id, file) {
  const res = await apiFetch(`/api/profile/photos/${id}`, {
    method: 'PUT',
    body: photoFormData(file),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return mapApiPhoto(await res.json())
}

export async function deleteProfilePhoto(id) {
  const res = await apiFetch(`/api/profile/photos/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function reorderProfilePhotos(photoIds) {
  const res = await apiFetch('/api/profile/photos/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoIds }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const { photos } = await res.json()
  return (photos || []).map(mapApiPhoto)
}

export async function setPrimaryProfilePhoto(id) {
  const res = await apiFetch(`/api/profile/photos/${id}/primary`, { method: 'PATCH' })
  if (!res.ok) throw new Error(await parseError(res))
  return mapApiPhoto(await res.json())
}

/** Fetch photos from API and merge into the local user store. */
export async function syncPhotosToStore() {
  const photos = await fetchProfilePhotos()
  const user = store.getUser() || store.getDefaultUser()
  store.setUser({
    ...user,
    photos,
    mainPhoto: photos[0]?.src || null,
  })
  return photos
}

export function validatePhotoFile(file) {
  if (!file) return 'No file selected.'
  const type = (file.type || '').toLowerCase()
  if (!PHOTO_TYPES.includes(type)) {
    return 'Only JPG, PNG, WEBP, or HEIC images are allowed.'
  }
  if (file.size > PHOTO_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return `Image too large (${mb}MB). Max 10MB per photo.`
  }
  return null
}
