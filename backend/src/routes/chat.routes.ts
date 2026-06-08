// src/routes/chat.routes.ts
// ─────────────────────────────────────────────
// AI ASSISTANT ROUTES
// Chat with read-only, tenant-scoped backend tool access.
// ─────────────────────────────────────────────

import { Router } from 'express'
import * as chatCtrl from '../controllers/chat.controller'
import { requireUser } from '../middleware/auth.middleware'
import { requireActiveTenant, stripTenantFromBody } from '../middleware/tenant.middleware'
import { requireFeature } from '../middleware/entitlement.middleware'

const router = Router()

router.use(requireUser)
router.use(requireActiveTenant)
router.use(stripTenantFromBody)
// Gated by plan. Plans with no configured feature set include everything,
// so existing tenants are unaffected until an admin curates a plan's features.
router.use(requireFeature('ai_assistant'))

// All roles may use the assistant (it is read-only).
router.post('/', chatCtrl.send)
router.get('/conversations', chatCtrl.listConversations)
router.get('/conversations/:conversationId', chatCtrl.getConversation)

export default router
