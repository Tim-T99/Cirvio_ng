// src/routes/billing.routes.ts
// ─────────────────────────────────────────────
// BILLING ROUTES (authenticated)
// Note: the Stripe webhook is mounted separately in app.ts (raw body).
// ─────────────────────────────────────────────

import { Router } from 'express'
import * as billingCtrl from '../controllers/billing.controller'
import { requireUser } from '../middleware/auth.middleware'
import { requireTenantAdmin } from '../middleware/role.middleware'

const router = Router()

router.use(requireUser)
// Note: NOT behind requireActiveTenant — an expired-trial tenant must still be
// able to read plans and start checkout to regain access.

// Read (any signed-in user)
router.get('/plans', billingCtrl.getPlans)
router.get('/subscription', billingCtrl.getSubscription)

// Mutating (tenant admins only)
router.post('/checkout', requireTenantAdmin, billingCtrl.createCheckout)
router.post('/portal', requireTenantAdmin, billingCtrl.createPortal)

export default router
