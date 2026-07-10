const { v4: uuidv4 } = require('uuid')
const pool = require('../db/pool')
const { ProfilePhotoRepository, mapRow, MAX_PHOTOS } = require('../repositories/profile-photo.repository')
const { processProfileImage } = require('./image-processing.service')
const {
  uploadObject,
  deleteObject,
  createSignedUrl,
  buildStoragePath,
  buildFullStoragePath,
  BUCKET,
} = require('./storage.service')

const repo = new ProfilePhotoRepository()

function appError(message, code) {
  const err = new Error(message)
  err.code = code
  return err
}

async function assertOwnership(client, photoId, userId) {
  const photo = await repo.findById(client, photoId)
  if (!photo) throw appError('Photo not found.', 'NOT_FOUND')
  if (photo.user_id !== userId) throw appError('You do not have access to this photo.', 'FORBIDDEN')
  return photo
}

async function formatPhotoResponse(photo, { includeSignedUrl = false } = {}) {
  const mapped = mapRow(photo)
  if (includeSignedUrl) {
    const objectPath = photo.storage_path.replace(`${BUCKET}/`, '')
    mapped.signedUrl = await createSignedUrl(objectPath)
  }
  return mapped
}

async function uploadPhoto(userId, fileBuffer, mimeType) {
  const processed = await processProfileImage(fileBuffer, mimeType)
  const fileName = `${uuidv4()}.webp`
  const objectPath = buildStoragePath(userId, fileName)
  const storagePath = buildFullStoragePath(userId, fileName)

  await uploadObject(objectPath, processed.buffer, processed.mimeType)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`profile-photos:${userId}`])

    const count = await repo.countByUserId(client, userId)
    if (count >= MAX_PHOTOS) {
      throw appError(`You can upload at most ${MAX_PHOTOS} profile photos.`, 'PHOTO_LIMIT_REACHED')
    }

    const displayOrder = await repo.getNextDisplayOrder(client, userId)
    const isPrimary = count === 0

    const row = await repo.insert(client, {
      userId,
      storagePath,
      bucket: BUCKET,
      fileName,
      mimeType: processed.mimeType,
      fileSize: processed.fileSize,
      width: processed.width,
      height: processed.height,
      displayOrder,
      isPrimary,
    })

    await client.query('COMMIT')
    return row
  } catch (err) {
    await client.query('ROLLBACK')
    await deleteObject(objectPath).catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

async function listPhotos(userId) {
  const client = await pool.connect()
  try {
    const rows = await repo.findByUserId(client, userId)
    return Promise.all(rows.map((row) => formatPhotoResponse(row, { includeSignedUrl: true })))
  } finally {
    client.release()
  }
}

async function setPrimaryPhoto(userId, photoId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await assertOwnership(client, photoId, userId)
    const updated = await repo.setPrimary(client, userId, photoId)
    if (!updated) throw appError('Photo not found.', 'NOT_FOUND')
    await client.query('COMMIT')
    return formatPhotoResponse(updated)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function reorderPhotos(userId, photoIds) {
  if (!Array.isArray(photoIds) || !photoIds.length) {
    throw appError('photoIds must be a non-empty array.', 'INVALID_REQUEST')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existing = await repo.findByUserId(client, userId)
    const existingIds = new Set(existing.map((p) => p.id))

    if (photoIds.length !== existing.length) {
      throw appError('photoIds must include every photo for this user.', 'INVALID_REQUEST')
    }

    const unique = new Set(photoIds)
    if (unique.size !== photoIds.length) {
      throw appError('photoIds must not contain duplicates.', 'INVALID_REQUEST')
    }

    for (const id of photoIds) {
      if (!existingIds.has(id)) {
        throw appError('One or more photo IDs are invalid.', 'INVALID_REQUEST')
      }
    }

    const rows = await repo.updateDisplayOrders(client, userId, photoIds)
    await client.query('COMMIT')
    return Promise.all(rows.map((row) => formatPhotoResponse(row)))
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function replacePhoto(userId, photoId, fileBuffer, mimeType) {
  const client = await pool.connect()
  let newObjectPath = null
  let oldObjectPath = null

  try {
    await client.query('BEGIN')
    const existing = await assertOwnership(client, photoId, userId)

    const processed = await processProfileImage(fileBuffer, mimeType)
    const fileName = `${uuidv4()}.webp`
    newObjectPath = buildStoragePath(userId, fileName)
    const storagePath = buildFullStoragePath(userId, fileName)
    oldObjectPath = existing.storage_path.replace(`${BUCKET}/`, '')

    await uploadObject(newObjectPath, processed.buffer, processed.mimeType)

    const updated = await repo.updateMetadata(client, photoId, {
      storagePath,
      fileName,
      mimeType: processed.mimeType,
      fileSize: processed.fileSize,
      width: processed.width,
      height: processed.height,
    })

    await client.query('COMMIT')

    await deleteObject(oldObjectPath).catch((err) => {
      console.error('[profile-photo] failed to delete replaced file:', err.message)
    })

    return formatPhotoResponse(updated)
  } catch (err) {
    await client.query('ROLLBACK')
    if (newObjectPath) {
      await deleteObject(newObjectPath).catch(() => {})
    }
    throw err
  } finally {
    client.release()
  }
}

async function deletePhoto(userId, photoId) {
  const client = await pool.connect()
  let objectPath = null

  try {
    await client.query('BEGIN')
    const existing = await assertOwnership(client, photoId, userId)
    objectPath = existing.storage_path.replace(`${BUCKET}/`, '')
    const wasPrimary = existing.is_primary

    await repo.delete(client, photoId)
    const remaining = await repo.reindexDisplayOrders(client, userId)

    if (wasPrimary && remaining.length) {
      await repo.clearPrimaryForUser(client, userId)
      await repo.setPrimaryOnLowestOrder(client, userId)
    }

    await client.query('COMMIT')
    await deleteObject(objectPath).catch((err) => {
      console.error('[profile-photo] failed to delete storage object:', err.message)
    })

    return { ok: true }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

module.exports = {
  uploadPhoto,
  listPhotos,
  setPrimaryPhoto,
  reorderPhotos,
  replacePhoto,
  deletePhoto,
  MAX_PHOTOS,
}
