const multer = require('multer')

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(_req, file, cb) {
    const mime = (file.mimetype || '').toLowerCase()
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      const err = new Error('Only JPEG, PNG, WebP, and HEIC images are allowed.')
      err.code = 'INVALID_FILE_TYPE'
      return cb(err)
    }
    cb(null, true)
  },
})

module.exports = { upload, MAX_FILE_SIZE, ALLOWED_MIME_TYPES }
