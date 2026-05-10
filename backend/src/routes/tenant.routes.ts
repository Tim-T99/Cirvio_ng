// src/routes/tenant.routes.ts
// ─────────────────────────────────────────────
// TENANT ROUTES
// Tenant self-management: profile, invites, stats
// Protected by requireUser + requireActiveTenant
// ─────────────────────────────────────────────

import { Router } from 'express'
import * as tenantCtrl from '../controllers/tenant.controller'
import { requireUser } from '../middleware/auth.middleware'
import { requireActiveTenant, stripTenantFromBody } from '../middleware/tenant.middleware'
import { requireRole } from '../middleware/role.middleware'

const router = Router()

// ── Public ──
router.post('/register', tenantCtrl.register)
router.get('/invites/validate/:token', tenantCtrl.validateInvite)
router.post('/invites/accept/:token', tenantCtrl.acceptInvite)

// ── All routes below require auth + active tenant ──
router.use(requireUser)
router.use(requireActiveTenant)
router.use(stripTenantFromBody)

// ── Profile ──
router.get('/profile', tenantCtrl.getProfile)
router.patch('/profile', requireRole('TENANT_ADMIN'), tenantCtrl.updateProfile)

// ── Stats ──
router.get('/stats', tenantCtrl.getStats)

// ── Invites (TENANT_ADMIN only) ──
router.post('/invites', requireRole('TENANT_ADMIN'), tenantCtrl.createInvite)
router.get('/invites', requireRole('TENANT_ADMIN'), tenantCtrl.listInvites)
router.delete('/invites/:inviteId', requireRole('TENANT_ADMIN'), tenantCtrl.revokeInvite)

export default router
