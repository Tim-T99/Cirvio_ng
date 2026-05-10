// src/routes/wps.routes.ts
// ─────────────────────────────────────────────
// WPS ROUTES
// Salary records, SIF lifecycle, violations, dashboard
// ─────────────────────────────────────────────

import { Router } from 'express'
import * as wpsCtrl from '../controllers/wps.controller'
import { requireUser } from '../middleware/auth.middleware'
import { requireActiveTenant, stripTenantFromBody } from '../middleware/tenant.middleware'
import { requireRole } from '../middleware/role.middleware'

const router = Router()

router.use(requireUser)
router.use(requireActiveTenant)
router.use(stripTenantFromBody)

// ── Dashboard (all roles) ──
router.get('/dashboard', wpsCtrl.getDashboardSummary)

// ── WPS Records ──
router.get('/', wpsCtrl.list)
router.get('/:wpsRecordId', wpsCtrl.getById)

router.post('/', requireRole('TENANT_ADMIN', 'HR_MANAGER'), wpsCtrl.create)
router.post('/bulk', requireRole('TENANT_ADMIN', 'HR_MANAGER'), wpsCtrl.bulkCreate)
router.patch('/:wpsRecordId', requireRole('TENANT_ADMIN', 'HR_MANAGER'), wpsCtrl.update)

// ── Violations ──
router.post('/:wpsRecordId/violation', requireRole('TENANT_ADMIN', 'HR_MANAGER'), wpsCtrl.recordViolation)

// ── SIF File Lifecycle ──
router.post('/sif/generate', requireRole('TENANT_ADMIN'), wpsCtrl.generateSif)
router.post('/sif/:sifFileId/submit', requireRole('TENANT_ADMIN'), wpsCtrl.submitSif)
router.post('/sif/:sifFileId/confirm', requireRole('TENANT_ADMIN'), wpsCtrl.confirmSif)

export default router