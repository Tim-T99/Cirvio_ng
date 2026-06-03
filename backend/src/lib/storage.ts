// src/lib/storage.ts
// ─────────────────────────────────────────────
// Supabase Storage helper — uploads images (tenant logos, user avatars)
// to a public bucket and returns their public URL.
//
// Required env vars (set on the backend host, e.g. Railway):
//   SUPABASE_URL                — https://<project-ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   — service-role key (server-side only, never exposed)
//   SUPABASE_STORAGE_BUCKET     — optional, defaults to "public-assets"
//
// The bucket is created automatically on first use, so no manual setup
// is needed beyond providing the two credentials above.
// ─────────────────────────────────────────────

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'public-assets'

let client: SupabaseClient | null = null
let bucketReady = false

/** Lazily build the Supabase client. Returns null when storage isn't configured. */
function getClient(): SupabaseClient | null {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}

/** True when the required Supabase credentials are present. */
export function isStorageConfigured(): boolean {
  return getClient() !== null
}

/** Ensure the public bucket exists (idempotent, runs once per process). */
async function ensureBucket(sb: SupabaseClient): Promise<void> {
  if (bucketReady) return
  const { data } = await sb.storage.getBucket(BUCKET)
  if (!data) {
    await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: '5MB',
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    })
  }
  bucketReady = true
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/**
 * Upload an image buffer and return its public URL.
 * @param folder logical sub-folder, e.g. "avatars" or "logos"
 */
export async function uploadImage(
  buffer: Buffer,
  mimeType: string,
  folder: string,
): Promise<string> {
  const sb = getClient()
  if (!sb) throw new Error('Image storage is not configured')

  const ext = EXT[mimeType]
  if (!ext) throw new Error('Unsupported image type')

  await ensureBucket(sb)

  const path = `${folder}/${randomUUID()}.${ext}`
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false, cacheControl: '31536000' })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
