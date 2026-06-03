// src/controllers/upload.controller.ts
// ─────────────────────────────────────────────
// Image upload endpoint — receives a single image (multipart/form-data
// field "file") and streams it to Supabase Storage, returning the
// public URL. Persisting the URL (to user.avatarUrl / tenant.logoUrl)
// is done by the caller via the relevant profile-update endpoint.
// ─────────────────────────────────────────────

import { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { uploadImage, isStorageConfigured } from '../lib/storage'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

/** In-memory multer — we never touch disk, just forward bytes to Supabase. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Unsupported image type'))
  },
}).single('file')

/** Runs multer and turns size/type errors into clean 400s instead of a 500. */
export const uploadMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (err: unknown) => {
    if (!err) return next()
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : err.message
      res.status(400).json({ error: msg })
      return
    }
    res.status(400).json({ error: (err as Error).message || 'Invalid upload' })
  })
}

/** POST image → { url }. `kind` (avatar|logo) selects the storage folder. */
export const handleImageUpload = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isStorageConfigured()) {
      res.status(503).json({ error: 'Image storage is not configured on the server' })
      return
    }
    if (!req.file) {
      res.status(400).json({ error: 'No image provided (field "file")' })
      return
    }

    const kind = (req.body?.kind as string) === 'logo' ? 'logos' : 'avatars'
    const url = await uploadImage(req.file.buffer, req.file.mimetype, kind)
    res.status(201).json({ url })
  } catch (err) {
    const message = (err as Error).message || 'Upload failed'
    const status = message.includes('not configured') ? 503 : 400
    res.status(status).json({ error: message })
  }
}
