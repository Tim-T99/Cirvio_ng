// src/routes/odata.routes.ts
// ─────────────────────────────────────────────
// OData v4 feed — authenticated by a per-tenant export token (Bearer / Basic /
// ?token). The paywall + data_export checks live inside requireExportToken.
// ─────────────────────────────────────────────

import { Router } from 'express'
import * as odataCtrl from '../controllers/odata.controller'
import { requireExportToken } from '../middleware/exportToken.middleware'

const router = Router()

router.use(requireExportToken)

router.get('/', odataCtrl.serviceDocument)
router.get('/$metadata', odataCtrl.metadata)
router.get('/:entitySet', odataCtrl.collection)

export default router
