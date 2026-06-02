// src/routes/oauth.routes.ts
// ─────────────────────────────────────────────
// OAUTH / PASSKEY ROUTES
// Login routes are public.
// Registration and management routes require
// an authenticated user session.
// ─────────────────────────────────────────────

import { Router } from 'express'
import * as oauthCtrl from '../controllers/oauth.controller'
import { requireUser } from '../middleware/auth.middleware'
import { oauthLimiter, passkeyLimiter } from '../middleware/rateLimit.middleware'

const router = Router()

// ── Google OAuth ──
router.post('/google/login',    oauthLimiter, oauthCtrl.googleCallback)
router.post('/google/register', oauthLimiter, oauthCtrl.googleRegister)

// ── Passkey login (public) ──
router.post('/passkey/login/options', passkeyLimiter, oauthCtrl.passkeyLoginOptions)
router.post('/passkey/login',         passkeyLimiter, oauthCtrl.passkeyLogin)

// ── Passkey registration + management (authenticated) ──
router.post('/passkey/register/options', requireUser, passkeyLimiter, oauthCtrl.passkeyRegisterOptions)
router.post('/passkey/register',         requireUser, passkeyLimiter, oauthCtrl.passkeyRegister)
router.get('/passkey',                   requireUser, oauthCtrl.passkeyList)
router.delete('/passkey/:passkeyId',     requireUser, oauthCtrl.passkeyRemove)

export default router
