// src/routes/admin.routes.ts
// ─────────────────────────────────────────────
// ADMIN ROUTES
// Platform-level routes — no tenant context
// Protected by requireAdmin middleware
// ─────────────────────────────────────────────

import { Router } from 'express'
import * as adminCtrl from '../controllers/admin.controller'
import { requireAdmin } from '../middleware/auth.middleware'
import { requireAdminRole } from '../middleware/role.middleware'
import { adminAuthLimiter } from '../middleware/rateLimit.middleware'

const router = Router()

// ── Public ──
router.post('/login', adminAuthLimiter, adminCtrl.login)

// ── All routes below require admin auth ──
router.use(requireAdmin)

router.post('/logout', adminCtrl.logout)
router.get('/me', adminCtrl.getMe)

// ── Admin Management (SuperAdmin only) ──
router.post('/admins', requireAdminRole('SUPER_ADMIN'), adminCtrl.createAdmin)
router.get('/admins', requireAdminRole('SUPER_ADMIN'), adminCtrl.listAdmins)
router.patch('/admins/:adminId', requireAdminRole('SUPER_ADMIN'), adminCtrl.updateAdmin)
router.patch('/password', adminCtrl.changePassword)

// ── Tenant Oversight ──
router.get('/tenants', adminCtrl.listTenants)
router.get('/tenants/:tenantId', adminCtrl.getTenant)
router.patch('/tenants/:tenantId', requireAdminRole('SUPER_ADMIN'), adminCtrl.updateTenantDetails)
router.patch('/tenants/:tenantId/status', requireAdminRole('SUPER_ADMIN'), adminCtrl.updateTenantStatus)
router.patch('/tenants/:tenantId/plan', requireAdminRole('SUPER_ADMIN'), adminCtrl.changeTenantPlan)

// ── Plans ──
router.get('/plans', adminCtrl.listPlans)
router.post('/plans', requireAdminRole('SUPER_ADMIN'), adminCtrl.createPlan)
router.patch('/plans/:planId', requireAdminRole('SUPER_ADMIN'), adminCtrl.updatePlan)

// ── Audit + Stats + Live Monitoring ──
router.get('/audit-logs',  adminCtrl.getAuditLogs)
router.get('/stats',       adminCtrl.getPlatformStats)
router.get('/monitoring',  adminCtrl.getMonitoring)

export default router
