const sharp = require('sharp')

const WEBP_QUALITY = 85
const MAX_DIMENSION = 2048

const SUPPORTED_INPUT_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

/**
 * Process an uploaded image: strip EXIF, resize if needed, convert to WebP.
 * @returns {{ buffer: Buffer, width: number, height: number, mimeType: string, fileSize: number }}
 */
async function processProfileImage(inputBuffer, mimeType) {
  const normalizedMime = (mimeType || '').toLowerCase()
  if (!SUPPORTED_INPUT_MIME.has(normalizedMime)) {
    const err = new Error('Only JPEG, PNG, WebP, and HEIC images are allowed.')
    err.code = 'INVALID_FILE_TYPE'
    throw err
  }

  let pipeline = sharp(inputBuffer, { failOn: 'none' })
    .rotate() // auto-orient from EXIF, then strip metadata on output
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })

  const buffer = await pipeline
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer()

  const { width, height } = await sharp(buffer).metadata()

  return {
    buffer,
    width: width || 0,
    height: height || 0,
    mimeType: 'image/webp',
    fileSize: buffer.length,
  }
}

module.exports = { processProfileImage, SUPPORTED_INPUT_MIME }
