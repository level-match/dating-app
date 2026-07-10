const express = require('express')
const { authenticateSupabase } = require('../middleware/supabase-auth')
const { upload } = require('../middleware/upload')
const profilePhotoService = require('../services/profile-photo.service')
const { mapRow } = require('../repositories/profile-photo.repository')
const { createSignedUrl, BUCKET } = require('../services/storage.service')

const router = express.Router()

router.use(authenticateSupabase)

function requireFile(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      error: 'MISSING_FILE',
      message: 'An image file is required.',
    })
  }
  next()
}

async function respondWithPhoto(row, res, status = 200) {
  const objectPath = row.storage_path.replace(`${BUCKET}/`, '')
  const payload = mapRow(row)
  payload.signedUrl = await createSignedUrl(objectPath)
  res.status(status).json(payload)
}

/* ─── GET /api/profile/photos ───────────────────────────────────*/
router.get('/photos', async (req, res) => {
  const photos = await profilePhotoService.listPhotos(req.auth.userId)
  res.json({ photos })
})

/* ─── POST /api/profile/photos ──────────────────────────────────*/
router.post('/photos', upload.single('photo'), requireFile, async (req, res) => {
  const row = await profilePhotoService.uploadPhoto(
    req.auth.userId,
    req.file.buffer,
    req.file.mimetype,
  )
  await respondWithPhoto(row, res, 201)
})

/* ─── PATCH /api/profile/photos/reorder ───────────────────────────*/
router.patch('/photos/reorder', async (req, res) => {
  const photoIds = req.body?.photoIds
  const photos = await profilePhotoService.reorderPhotos(req.auth.userId, photoIds)
  res.json({ photos })
})

/* ─── PATCH /api/profile/photos/:id/primary ─────────────────────*/
router.patch('/photos/:id/primary', async (req, res) => {
  const photo = await profilePhotoService.setPrimaryPhoto(req.auth.userId, req.params.id)
  res.json(photo)
})

/* ─── PUT /api/profile/photos/:id ───────────────────────────────*/
router.put('/photos/:id', upload.single('photo'), requireFile, async (req, res) => {
  const photo = await profilePhotoService.replacePhoto(
    req.auth.userId,
    req.params.id,
    req.file.buffer,
    req.file.mimetype,
  )
  res.json(photo)
})

/* ─── DELETE /api/profile/photos/:id ──────────────────────────────*/
router.delete('/photos/:id', async (req, res) => {
  const result = await profilePhotoService.deletePhoto(req.auth.userId, req.params.id)
  res.json(result)
})

module.exports = router
