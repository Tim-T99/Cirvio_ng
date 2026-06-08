// src/middleware/exportToken.middleware.ts
// ─────────────────────────────────────────────
// Authenticates the OData feed with a per-tenant export token (not a user JWT,
// since BI tools like Power BI can't do interactive login on scheduled refresh).
//
// Token is read from, in order:
//   1. Authorization: Bearer <token>
//   2. Authorization: Basic base64(<token>:)   ← Power BI "Basic" auth, username = token
//   3. ?token=<token>                          ← manual / scripts
//
// Also enforces the paywall here (active plan + data_export feature), because
// the JWT-based requirePaidPlan/requireFeature can't run on this surface.
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import { prisma } from '../prisma/client'
import { resolveToken } from '../services/export.service'
import { tenantHasFeature } from '../services/entitlement.service'

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization
  if (auth) {
    if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
    if (auth.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(auth.slice(6).trim(), 'base64').toString('utf8')
        // username:password → token is the username (password ignored)
        return decoded.split(':')[0] || null
      } catch {
        return null
      }
    }
  }
  const q = req.query.token
  if (typeof q === 'string' && q) return q
  return null
}

export async function requireExportToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req)
  if (!token) {
    res.status(401)
      .set('WWW-Authenticate', 'Basic realm="Cirvio Export"')
      .json({ error: 'An export token is required.' })
    return
  }
  try {
    const tenantId = await resolveToken(token)
    if (!tenantId) {
      res.status(401).json({ error: 'Invalid or revoked export token.' })
      return
    }

    // Paywall: token feeds require an active plan that includes data export.
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { status: true } })
    if (tenant?.status !== 'ACTIVE') {
      res.status(403).json({ error: 'This export requires an active subscription.', code: 'SUBSCRIPTION_REQUIRED' })
      return
    }
    if (!(await tenantHasFeature(tenantId, 'data_export'))) {
      res.status(403).json({ error: 'Data export is not included in your plan.', code: 'FEATURE_NOT_AVAILABLE' })
      return
    }

    ;(req as Request & { exportTenantId?: string }).exportTenantId = tenantId
    next()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
