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
import * as userService from '../services/user.service'

const router = Router()

const allowSelfOrRole = (...roles: Array<'TENANT_ADMIN' | 'HR_MANAGER'>) => {
  return async (req: any, res: any, next: any): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    if (req.user.role === 'VIEWER') {
      const linkedEmployeeId = await userService.ensureUserEmployeeLink(req.user.userId, req.user.tenantId)

      if (!linkedEmployeeId || req.params.employeeId !== linkedEmployeeId) {
        res.status(403).json({ error: 'You can only update your own employee record.' })
        return
      }

      if (req.body) {
        const allowed = new Set(['firstName', 'lastName', 'middleName', 'phone', 'workEmail', 'personalEmail', 'jobTitle'])
        Object.keys(req.body).forEach((key) => {
          if (!allowed.has(key)) delete req.body[key]
        })
      }

      next()
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' })
      return
    }

    next()
  }
}

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
router.patch('/:employeeId', allowSelfOrRole('TENANT_ADMIN', 'HR_MANAGER'), employeeCtrl.update)
router.patch('/:employeeId/status', requireRole('TENANT_ADMIN', 'HR_MANAGER'), employeeCtrl.updateStatus)
router.post('/:employeeId/terminate', requireRole('TENANT_ADMIN'), employeeCtrl.terminate)

// ── Departments ──
router.get('/departments/list', employeeCtrl.listDepartments)
router.post('/departments', requireRole('TENANT_ADMIN', 'HR_MANAGER'), employeeCtrl.createDepartment)
router.patch('/departments/:departmentId', requireRole('TENANT_ADMIN', 'HR_MANAGER'), employeeCtrl.updateDepartment)
router.delete('/departments/:departmentId', requireRole('TENANT_ADMIN'), employeeCtrl.deleteDepartment)

export default router