// src/routes/upload.routes.ts
// ─────────────────────────────────────────────
// Image upload for authenticated tenant users (avatars, tenant logo).
// Returns a public URL; callers persist it via their profile-update route.
// ─────────────────────────────────────────────

import { Router } from 'express'
import { requireUser } from '../middleware/auth.middleware'
import { uploadMiddleware, handleImageUpload } from '../controllers/upload.controller'

const router = Router()

router.use(requireUser)
router.post('/image', uploadMiddleware, handleImageUpload)

export default router
