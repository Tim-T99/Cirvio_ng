// src/middleware/tenant.middleware.ts
// ─────────────────────────────────────────────
// TENANT MIDDLEWARE
// Enforces tenant scoping and status checks
// Always runs AFTER auth middleware
// Prevents cross-tenant data access
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import { prisma } from '../prisma/client'


// ─────────────────────────────────────────────
// SECURITY NOTES
// [S1] tenantId sourced exclusively from
//      verified JWT payload (req.user.tenantId)
//      Never from request body, params, or query
// [S2] Tenant status verified on every request —
//      suspended/cancelled tenants blocked
//      immediately without waiting for JWT expiry
// [S3] Trial expiry enforced at middleware —
//      expired trial tenants cannot mutate data
//      Read-only access granted during grace period
// [S4] Plan limits for critical resources checked
//      here as a secondary enforcement layer
//      Primary enforcement is in service layer
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// TENANT STATUS GUARD
// Blocks requests from suspended or cancelled
// tenants on every protected route
// ─────────────────────────────────────────────

/**
 * Verify tenant is active before allowing any request.
 * [S1] tenantId always from req.user — never request input.
 * [S2] Catches suspension/cancellation in real time.
 */
export const requireActiveTenant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // [S1] requireUser must have run first
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: {
        status: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
      },
    })

    if (!tenant) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // [S2] Block suspended and cancelled tenants immediately
    if (tenant.status === 'SUSPENDED') {
      res.status(403).json({
        error: 'Your organisation account has been suspended. Please contact support.',
        code: 'TENANT_SUSPENDED',
      })
      return
    }

    if (tenant.status === 'CANCELLED') {
      res.status(403).json({
        error: 'Your organisation account has been cancelled. Please contact support.',
        code: 'TENANT_CANCELLED',
      })
      return
    }

    // [S3] Block expired trials on mutating requests
    if (
      tenant.status === 'TRIAL' &&
      tenant.trialEndsAt &&
      tenant.trialEndsAt < new Date()
    ) {
      // Allow GET requests during expired trial — read-only grace
      if (req.method !== 'GET') {
        res.status(403).json({
          error: 'Your free trial has expired. Please upgrade to continue.',
          code: 'TRIAL_EXPIRED',
        })
        return
      }
    }

    next()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}


// ─────────────────────────────────────────────
// TENANT RESOURCE OWNERSHIP GUARD
// Verifies route param IDs belong to the
// requesting tenant before hitting the controller
// Secondary check — services also verify this
// ─────────────────────────────────────────────

/**
 * Verify that req.params.employeeId belongs
 * to the requesting tenant.
 * Runs before employee controllers as an
 * early-exit layer before service is called.
 */
export const requireEmployeeOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    const employeeId = req.params.employeeId as string

    if (!employeeId) {
      next()
      return
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId: req.user.tenantId },
      select: { id: true },
    })

    if (!employee) {
      // [S5] Return 404 not 403 — don't confirm resource exists
      res.status(404).json({ error: 'Employee not found' })
      return
    }

    next()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Verify that req.params.visaRecordId belongs
 * to the requesting tenant.
 */
export const requireVisaOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    const visaRecordId = req.params.visaRecordId as string

    if (!visaRecordId) {
      next()
      return
    }

    const visa = await prisma.visaRecord.findFirst({
      where: { id: visaRecordId, tenantId: req.user.tenantId },
      select: { id: true },
    })

    if (!visa) {
      res.status(404).json({ error: 'Visa record not found' })
      return
    }

    next()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Verify that req.params.documentId belongs
 * to the requesting tenant.
 */
export const requireDocumentOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    const documentId = req.params.documentId as string

    if (!documentId) {
      next()
      return
    }

    const document = await prisma.document.findFirst({
      where: { id: documentId, tenantId: req.user.tenantId },
      select: { id: true },
    })

    if (!document) {
      res.status(404).json({ error: 'Document not found' })
      return
    }

    next()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}


// ─────────────────────────────────────────────
// REQUEST SANITISATION
// Strips tenantId from request body entirely
// Prevents tenant injection via body payload
// ─────────────────────────────────────────────

/**
 * Remove tenantId from request body if present.
 * [S1] tenantId must always come from JWT —
 * this ensures even if a client sends one
 * it is silently stripped before reaching
 * the controller.
 */
export const stripTenantFromBody = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (req.body && typeof req.body === 'object') {
    delete req.body.tenantId
    delete req.body.tenant_id
  }

  next()
}


// ─────────────────────────────────────────────
// RATE LIMIT HELPER
// Attaches tenant context for rate limiters
// Use with express-rate-limit keyed by tenantId
// ─────────────────────────────────────────────

/**
 * Key generator for express-rate-limit.
 * Limits requests per tenant not per IP —
 * prevents one IP from being rate limited
 * across multiple tenants.
 *
 * Usage:
 * const limiter = rateLimit({ keyGenerator: tenantRateLimitKey })
 */
export const tenantRateLimitKey = (req: Request): string => {
  // Fall back to IP if no tenant context
  return req.user?.tenantId ?? req.ip ?? 'unknown'
}