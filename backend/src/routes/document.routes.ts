// src/routes/document.routes.ts
// ─────────────────────────────────────────────
// DOCUMENT ROUTES
// File metadata CRUD + presigned URL endpoints
// ─────────────────────────────────────────────

import { Router } from 'express'
import * as docCtrl from '../controllers/document.controller'
import { requireUser } from '../middleware/auth.middleware'
import { requireActiveTenant, stripTenantFromBody } from '../middleware/tenant.middleware'
import { requireRole } from '../middleware/role.middleware'

const router = Router()

router.use(requireUser)
router.use(requireActiveTenant)
router.use(stripTenantFromBody)

// ── Read (all roles) ──
router.get('/', docCtrl.list)
router.get('/expiring', docCtrl.getExpiring)
router.get('/:documentId/download-url', docCtrl.getDownloadUrl)
router.get('/employee/:employeeId/summary', docCtrl.getEmployeeSummary)

// ── Mutate (HR_MANAGER+) ──
router.post('/upload-url', requireRole('TENANT_ADMIN', 'HR_MANAGER'), docCtrl.getUploadUrl)
router.post('/', requireRole('TENANT_ADMIN', 'HR_MANAGER'), docCtrl.create)
router.patch('/:documentId', requireRole('TENANT_ADMIN', 'HR_MANAGER'), docCtrl.update)
router.delete('/:documentId', requireRole('TENANT_ADMIN'), docCtrl.remove)

export default router