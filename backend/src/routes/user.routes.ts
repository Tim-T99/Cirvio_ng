// src/routes/user.routes.ts
// ─────────────────────────────────────────────
// USER ROUTES
// Auth, profile, user management
// ─────────────────────────────────────────────

import { Router } from 'express'
import * as userCtrl from '../controllers/user.controller'
import { requireUser } from '../middleware/auth.middleware'
import { requireActiveTenant, stripTenantFromBody } from '../middleware/tenant.middleware'
import { requireRole } from '../middleware/role.middleware'

const router = Router()

// ── Public ──
router.post('/login', userCtrl.login)
router.post('/password-reset/request', userCtrl.requestPasswordReset)
router.post('/password-reset/:token', userCtrl.resetPassword)

// ── All routes below require auth + active tenant ──
router.use(requireUser)
router.use(requireActiveTenant)
router.use(stripTenantFromBody)

// ── Self-service ──
router.get('/me', userCtrl.getMe)
router.patch('/me', userCtrl.updateMe)
router.patch('/me/password', userCtrl.changePassword)
router.post('/logout', userCtrl.logout)
router.post('/logout-all', userCtrl.logoutAll)

// ── User management (TENANT_ADMIN / HR_MANAGER) ──
router.get('/', requireRole('TENANT_ADMIN', 'HR_MANAGER'), userCtrl.listUsers)
router.patch('/:userId/role', requireRole('TENANT_ADMIN'), userCtrl.updateUserRole)
router.patch('/:userId/deactivate', requireRole('TENANT_ADMIN'), userCtrl.deactivateUser)
router.patch('/:userId/reactivate', requireRole('TENANT_ADMIN'), userCtrl.reactivateUser)

// ── Activity logs ──
router.get('/activity-logs', requireRole('TENANT_ADMIN', 'HR_MANAGER'), userCtrl.getActivityLogs)

export default router