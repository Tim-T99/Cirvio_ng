// src/routes/visa.routes.ts
// ─────────────────────────────────────────────
// VISA ROUTES
// Visa lifecycle, alerts, dashboard
// ─────────────────────────────────────────────

import { Router } from 'express'
import * as visaCtrl from '../controllers/visa.controller'
import { requireUser } from '../middleware/auth.middleware'
import { requireActiveTenant, stripTenantFromBody } from '../middleware/tenant.middleware'
import { requireRole } from '../middleware/role.middleware'

const router = Router()

router.use(requireUser)
router.use(requireActiveTenant)
router.use(stripTenantFromBody)

// ── Dashboard (all roles) ──
router.get('/dashboard', visaCtrl.getDashboardSummary)
router.get('/alerts', visaCtrl.getPendingAlerts)

// ── CRUD (all roles can read) ──
router.get('/', visaCtrl.list)
router.get('/:visaRecordId', visaCtrl.getById)

// ── Mutate (HR_MANAGER+) ──
router.post('/', requireRole('TENANT_ADMIN', 'HR_MANAGER'), visaCtrl.create)
router.patch('/:visaRecordId', requireRole('TENANT_ADMIN', 'HR_MANAGER'), visaCtrl.update)
router.patch('/:visaRecordId/status', requireRole('TENANT_ADMIN', 'HR_MANAGER'), visaCtrl.updateStatus)

// ── Alert management ──
router.patch('/alerts/:alertId/dismiss', requireRole('TENANT_ADMIN', 'HR_MANAGER'), visaCtrl.dismissAlert)

export default router