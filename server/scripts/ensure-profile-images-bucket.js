/**
 * One-time setup: ensure the profile-images Storage bucket exists.
 * Run: node scripts/ensure-profile-images-bucket.js
 */
require('dotenv').config()
const { getSupabaseAdmin, BUCKET } = require('../config/supabase')

async function ensureBucket() {
  const supabase = getSupabaseAdmin()
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()

  if (listError) {
    console.error('[storage-setup] Failed to list buckets:', listError.message)
    process.exit(1)
  }

  const exists = buckets.some((b) => b.name === BUCKET)
  if (exists) {
    console.log(`[storage-setup] Bucket "${BUCKET}" already exists.`)
    return
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/webp'],
  })

  if (error) {
    console.error('[storage-setup] Failed to create bucket:', error.message)
    process.exit(1)
  }

  console.log(`[storage-setup] Bucket "${BUCKET}" created.`)
}

ensureBucket()
