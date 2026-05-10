// src/middleware/role.middleware.ts
// ─────────────────────────────────────────────
// ROLE MIDDLEWARE
// Enforces role-based access control
// Always runs AFTER auth middleware
// Never run standalone — requires req.admin
// or req.user to be set first
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'


// ─────────────────────────────────────────────
// SECURITY NOTES
// [S1] Role checks always after auth —
//      middleware order enforced by route setup
// [S2] Roles are read from req.admin/req.user
//      which are set by verified JWT only —
//      never from request body or query params
// [S3] Least privilege — VIEWER is the default
//      role. Elevated roles must be explicitly
//      granted and checked
// [S4] SuperAdmin check is strict —
//      SUPPORT admins cannot access destructive
//      platform operations
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// ADMIN ROLE GUARDS
// ─────────────────────────────────────────────

/**
 * Restrict route to SUPER_ADMIN only.
 * [S4] SUPPORT admins are explicitly blocked.
 * Use for: plan management, tenant suspension,
 * admin account creation, audit log access.
 */
export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // [S1] requireAdmin must have run first
  if (!req.admin) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  // [S4] Strict SuperAdmin check
  if (req.admin.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  next()
}

/**
 * Allow any authenticated admin.
 * Use for: read-only admin operations,
 * tenant overview, support lookups.
 */
export const requireAnyAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.admin) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  next()
}


// ─────────────────────────────────────────────
// USER ROLE GUARDS
// ─────────────────────────────────────────────

/**
 * Restrict route to TENANT_ADMIN only.
 * Use for: user management, role changes,
 * account settings, invite management.
 */
export const requireTenantAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // [S1] requireUser must have run first
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (req.user.role !== 'TENANT_ADMIN') {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  next()
}

/**
 * Allow TENANT_ADMIN or HR_MANAGER.
 * [S3] Excludes VIEWER — read-only accounts
 * cannot mutate employee or compliance data.
 * Use for: employee CRUD, visa management,
 * WPS records, document uploads.
 */
export const requireHrOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const allowed = ['TENANT_ADMIN', 'HR_MANAGER']

  if (!allowed.includes(req.user.role)) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  next()
}

/**
 * Allow any authenticated user regardless of role.
 * [S3] Even VIEWER can access these routes.
 * Use for: dashboard reads, profile view,
 * list queries, export downloads.
 */
export const requireAnyUser = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  next()
}


// ─────────────────────────────────────────────
// SELF-ONLY GUARD
// Allows users to access only their own record
// unless they have an elevated role
// ─────────────────────────────────────────────

/**
 * Allow access if the requesting user is the
 * target user, OR if they are a TENANT_ADMIN.
 * Use for: profile updates, password change,
 * personal activity log access.
 *
 * Expects target userId in req.params.userId
 */
// ─────────────────────────────────────────────
// DYNAMIC ROLE FACTORY
// Used by route files as:
//   requireRole("TENANT_ADMIN", "HR_MANAGER")
// ─────────────────────────────────────────────

/**
 * Factory: allow any of the listed user roles.
 * Returns Express middleware.
 * Usage: requireRole("TENANT_ADMIN", "HR_MANAGER")
 */
export const requireRole = (
  ...roles: Array<'TENANT_ADMIN' | 'HR_MANAGER' | 'VIEWER'>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' })
      return
    }

    next()
  }
}

/**
 * Factory: allow any of the listed admin roles.
 * Usage: requireAdminRole("SUPER_ADMIN")
 */
export const requireAdminRole = (
  ...roles: Array<'SUPER_ADMIN' | 'SUPPORT'>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    if (!roles.includes(req.admin.role)) {
      res.status(403).json({ error: 'Insufficient permissions' })
      return
    }

    next()
  }
}


export const requireSelfOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const targetUserId = req.params.userId

  if (!targetUserId) {
    res.status(400).json({ error: 'User ID is required' })
    return
  }

  const isSelf      = req.user.userId === targetUserId
  const isTenantAdmin = req.user.role === 'TENANT_ADMIN'

  if (!isSelf && !isTenantAdmin) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  next()
}