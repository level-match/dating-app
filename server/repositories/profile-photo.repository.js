const MAX_PHOTOS = 5

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    storagePath: row.storage_path,
    displayOrder: row.display_order,
    isPrimary: row.is_primary,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

class ProfilePhotoRepository {
  async findByUserId(client, userId) {
    const { rows } = await client.query(
      `SELECT *
       FROM user_profile_photos
       WHERE user_id = $1
       ORDER BY display_order ASC`,
      [userId],
    )
    return rows
  }

  async findById(client, photoId) {
    const { rows } = await client.query(
      'SELECT * FROM user_profile_photos WHERE id = $1',
      [photoId],
    )
    return rows[0] || null
  }

  async countByUserId(client, userId) {
    const { rows } = await client.query(
      'SELECT COUNT(*)::int AS count FROM user_profile_photos WHERE user_id = $1',
      [userId],
    )
    return rows[0].count
  }

  async getNextDisplayOrder(client, userId) {
    const { rows } = await client.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order
       FROM user_profile_photos
       WHERE user_id = $1`,
      [userId],
    )
    return rows[0].next_order
  }

  async insert(client, {
    userId,
    storagePath,
    bucket,
    fileName,
    mimeType,
    fileSize,
    width,
    height,
    displayOrder,
    isPrimary,
  }) {
    const { rows } = await client.query(
      `INSERT INTO user_profile_photos
         (user_id, storage_path, bucket, file_name, mime_type, file_size,
          width, height, display_order, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [userId, storagePath, bucket, fileName, mimeType, fileSize, width, height, displayOrder, isPrimary],
    )
    return rows[0]
  }

  async updateMetadata(client, photoId, {
    storagePath,
    fileName,
    mimeType,
    fileSize,
    width,
    height,
  }) {
    const { rows } = await client.query(
      `UPDATE user_profile_photos
       SET storage_path = $2,
           file_name = $3,
           mime_type = $4,
           file_size = $5,
           width = $6,
           height = $7
       WHERE id = $1
       RETURNING *`,
      [photoId, storagePath, fileName, mimeType, fileSize, width, height],
    )
    return rows[0] || null
  }

  async clearPrimaryForUser(client, userId) {
    await client.query(
      'UPDATE user_profile_photos SET is_primary = FALSE WHERE user_id = $1',
      [userId],
    )
  }

  async setPrimary(client, userId, photoId) {
    await client.query(
      'UPDATE user_profile_photos SET is_primary = FALSE WHERE user_id = $1',
      [userId],
    )
    const { rows } = await client.query(
      `UPDATE user_profile_photos
       SET is_primary = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [photoId, userId],
    )
    return rows[0] || null
  }

  async updateDisplayOrders(client, userId, orderedPhotoIds) {
    for (let i = 0; i < orderedPhotoIds.length; i++) {
      await client.query(
        `UPDATE user_profile_photos
         SET display_order = $3
         WHERE id = $1 AND user_id = $2`,
        [orderedPhotoIds[i], userId, i + 1],
      )
    }
    return this.findByUserId(client, userId)
  }

  async delete(client, photoId) {
    const { rows } = await client.query(
      'DELETE FROM user_profile_photos WHERE id = $1 RETURNING *',
      [photoId],
    )
    return rows[0] || null
  }

  async reindexDisplayOrders(client, userId) {
    const photos = await this.findByUserId(client, userId)
    for (let i = 0; i < photos.length; i++) {
      const expected = i + 1
      if (photos[i].display_order !== expected) {
        await client.query(
          'UPDATE user_profile_photos SET display_order = $2 WHERE id = $1',
          [photos[i].id, expected],
        )
        photos[i].display_order = expected
      }
    }
    return photos
  }

  async setPrimaryOnLowestOrder(client, userId) {
    const { rows } = await client.query(
      `UPDATE user_profile_photos
       SET is_primary = TRUE
       WHERE id = (
         SELECT id FROM user_profile_photos
         WHERE user_id = $1
         ORDER BY display_order ASC
         LIMIT 1
       )
       RETURNING *`,
      [userId],
    )
    return rows[0] || null
  }
}

module.exports = { ProfilePhotoRepository, mapRow, MAX_PHOTOS }
