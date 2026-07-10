const { getSupabaseAdmin, BUCKET } = require('../config/supabase')

async function uploadObject(storagePath, buffer, mimeType) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
      cacheControl: '3600',
    })

  if (error) {
    console.error('[storage] upload failed:', error.message)
    const err = new Error('Failed to upload image.')
    err.code = 'STORAGE_UPLOAD_FAILED'
    throw err
  }
}

async function deleteObject(storagePath) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])

  if (error) {
    console.error('[storage] delete failed:', error.message)
    const err = new Error('Failed to delete image from storage.')
    err.code = 'STORAGE_DELETE_FAILED'
    throw err
  }
}

async function createSignedUrl(storagePath, expiresInSeconds = 3600) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error) {
    console.error('[storage] signed URL failed:', error.message)
    return null
  }
  return data.signedUrl
}

function buildStoragePath(userId, fileName) {
  return `${userId}/${fileName}`
}

function buildFullStoragePath(userId, fileName) {
  return `${BUCKET}/${userId}/${fileName}`
}

module.exports = {
  uploadObject,
  deleteObject,
  createSignedUrl,
  buildStoragePath,
  buildFullStoragePath,
  BUCKET,
}
