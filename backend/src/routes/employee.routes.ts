// src/routes/employee.routes.ts
// ─────────────────────────────────────────────
// EMPLOYEE ROUTES
// Core employee CRUD + departments
// ─────────────────────────────────────────────

import { Router } from 'express'
import * as employeeCtrl from '../controllers/employee.controller'
import { requireUser } from '../middleware/auth.middleware'
import { requireActiveTenant, stripTenantFromBody } from '../middleware/tenant.middleware'
import { requireRole } from '../middleware/role.middleware'

const router = Router()

router.use(requireUser)
router.use(requireActiveTenant)
router.use(stripTenantFromBody)

// ── Read (all roles) ──
router.get('/', employeeCtrl.list)
router.get('/expiry-snapshot', employeeCtrl.getExpirySnapshot)
router.get('/:employeeId', employeeCtrl.getById)
router.get('/:employeeId/records', employeeCtrl.getWithRecords)

// ── Mutate (HR_MANAGER+) ──
router.post('/', requireRole('TENANT_ADMIN', 'HR_MANAGER'), employeeCtrl.create)
router.patch('/:employeeId', requireRole('TENANT_ADMIN', 'HR_MANAGER'), employeeCtrl.update)
router.patch('/:employeeId/status', requireRole('TENANT_ADMIN', 'HR_MANAGER'), employeeCtrl.updateStatus)
router.post('/:employeeId/terminate', requireRole('TENANT_ADMIN'), employeeCtrl.terminate)

// ── Departments ──
router.get('/departments/list', employeeCtrl.listDepartments)
router.post('/departments', requireRole('TENANT_ADMIN', 'HR_MANAGER'), employeeCtrl.createDepartment)
router.patch('/departments/:departmentId', requireRole('TENANT_ADMIN', 'HR_MANAGER'), employeeCtrl.updateDepartment)
router.delete('/departments/:departmentId', requireRole('TENANT_ADMIN'), employeeCtrl.deleteDepartment)

export default router