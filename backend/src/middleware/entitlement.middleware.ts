// src/middleware/entitlement.middleware.ts
// ─────────────────────────────────────────────
// Plan-based feature gating.
//   requireFeature(key) — tenant's plan must include the feature.
//   requirePaidPlan     — tenant must be on an active (paid) subscription.
// Both assume requireUser has already populated req.user.
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import { prisma } from '../prisma/client'
import { tenantHasFeature } from '../services/entitlement.service'

export function requireFeature(key: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    try {
      if (await tenantHasFeature(req.user.tenantId, key)) {
        next()
        return
      }
      res.status(403).json({
        error: 'This feature is not included in your current plan.',
        code: 'FEATURE_NOT_AVAILABLE',
        feature: key,
      })
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

/** Requires an active (paid) subscription — i.e. behind the paywall. */
export async function requirePaidPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { status: true },
    })
    if (tenant?.status === 'ACTIVE') {
      next()
      return
    }
    res.status(403).json({
      error: 'This feature requires an active subscription. Please upgrade your plan.',
      code: 'SUBSCRIPTION_REQUIRED',
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
