// src/routes/export.routes.ts
// ─────────────────────────────────────────────
// EXPORT ROUTES (JWT) — behind the paywall + the data_export feature.
// Token management, in-app CSV download, OData connection info.
// ─────────────────────────────────────────────

import { Router } from 'express'
import * as exportCtrl from '../controllers/export.controller'
import { requireUser } from '../middleware/auth.middleware'
import { requirePaidPlan, requireFeature } from '../middleware/entitlement.middleware'
import { requireTenantAdmin, requireHrOrAdmin } from '../middleware/role.middleware'

const router = Router()

router.use(requireUser)
router.use(requirePaidPlan)               // active (paid) subscription required
router.use(requireFeature('data_export')) // and the plan must include export

router.get('/datasets', exportCtrl.listDatasets)

// CSV includes salary data → restrict to HR managers / tenant admins.
router.get('/csv/:dataset', requireHrOrAdmin, exportCtrl.downloadCsv)

// Token management — tenant admins only.
router.get('/tokens', requireTenantAdmin, exportCtrl.listTokens)
router.post('/tokens', requireTenantAdmin, exportCtrl.createToken)
router.delete('/tokens/:tokenId', requireTenantAdmin, exportCtrl.revokeToken)

export default router
