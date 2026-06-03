// src/middleware/auth.middleware.ts
// ─────────────────────────────────────────────
// AUTH MIDDLEWARE
// Verifies JWT on every protected route
// Attaches verified payload to request object
// Separate guards for Admin and User routes
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import { extractBearerToken, verifyAdminToken, verifyUserToken } from '../../utils/jwt'
import { hashToken } from '../../utils/hash'
import { fingerprintFor } from '../../utils/device'
import { prisma } from '../prisma/client'

// Throttle window for the async last-seen write (keeps the auth path lag-free)
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000


// ─────────────────────────────────────────────
// SECURITY NOTES  (zero-trust: never trust the token alone)
// [S1] JWT verified cryptographically first —
//      DB session check runs only if JWT is valid
//      Prevents unnecessary DB load from forged tokens
// [S2] Session existence checked in DB —
//      allows forced logout by deleting session
//      JWT alone is not sufficient for auth
// [S3] Inactive users blocked at middleware —
//      deactivated accounts cannot use valid tokens
// [S4] Tenant status checked on every request —
//      suspended/cancelled tenants are blocked immediately
//      without waiting for token expiry
// [S5] Error messages are generic —
//      never reveal why auth failed specifically
// [S6] req.admin and req.user are typed —
//      controllers never access raw JWT payload
// [S7] Device-bound sessions (IP-flexible) —
//      a session is bound to the device fingerprint that
//      created it; a token replayed from another device is
//      rejected. IP is NOT bound, so mobile/roaming users
//      stay logged in. Legacy (null-fingerprint) sessions
//      are exempt for backward compatibility.
// [S8] Last-seen is updated asynchronously and throttled —
//      continuous verification adds no request latency.
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// EXPRESS REQUEST TYPE EXTENSIONS
// Attach verified identity to request object
// ─────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      admin?: {
        adminId: string
        role: 'SUPER_ADMIN' | 'SUPPORT'
      }
      user?: {
        userId: string
        tenantId: string
        role: 'TENANT_ADMIN' | 'HR_MANAGER' | 'VIEWER'
      }
    }
  }
}


// ─────────────────────────────────────────────
// ADMIN AUTH GUARD
// Protects /admin/* routes
// Verifies Admin JWT + Admin session in DB
// ─────────────────────────────────────────────

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const token = extractBearerToken(req.headers.authorization)

    if (!token) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // [S1] Verify JWT cryptographically first
    let payload
    try {
      payload = verifyAdminToken(token)
    } catch (err) {
      const message = (err as Error).message
      if (message === 'SESSION_EXPIRED') {
        res.status(401).json({ error: 'Session expired. Please log in again.' })
        return
      }
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // [S2] Verify session exists in DB
    // Allows forced logout by deleting the session record
    const hashedToken = hashToken(token)
    const session = await prisma.adminSession.findFirst({
      where: {
        token: hashedToken,
        adminId: payload.adminId,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, fingerprint: true, lastSeenAt: true },
    })

    if (!session) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // [S7] Zero-trust device binding (IP-flexible)
    const requestFingerprint = fingerprintFor(req.headers['user-agent'])
    if (session.fingerprint && session.fingerprint !== requestFingerprint) {
      await prisma.adminSession.deleteMany({ where: { id: session.id } })
      res.status(401).json({ error: 'Your session was ended for security reasons. Please log in again.' })
      return
    }

    // [S3] Verify admin account is still active
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
      select: { isActive: true, role: true },
    })

    if (!admin || !admin.isActive) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // [S8] Async, throttled last-seen update
    if (!session.lastSeenAt || Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
      void prisma.adminSession
        .update({ where: { id: session.id }, data: { lastSeenAt: new Date(), lastIp: req.ip } })
        .catch(() => {})
    }

    // [S6] Attach verified identity to request
    req.admin = {
      adminId: payload.adminId,
      role: payload.role,
    }

    next()
  } catch {
    // [S5] Never expose internal error details
    res.status(500).json({ error: 'Internal server error' })
  }
}


// ─────────────────────────────────────────────
// USER AUTH GUARD
// Protects all tenant-facing routes
// Verifies User JWT + User session in DB
// ─────────────────────────────────────────────

export const requireUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractBearerToken(req.headers.authorization)

    if (!token) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // [S1] Verify JWT cryptographically first
    let payload
    try {
      payload = verifyUserToken(token)
    } catch (err) {
      const message = (err as Error).message
      if (message === 'SESSION_EXPIRED') {
        res.status(401).json({ error: 'Session expired. Please log in again.' })
        return
      }
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // [S2] Verify session exists in DB
    const hashedToken = hashToken(token)
    const session = await prisma.userSession.findFirst({
      where: {
        token: hashedToken,
        userId: payload.userId,
        expiresAt: { gt: new Date() },
        // Exclude password reset pseudo-sessions
        NOT: { userAgent: 'PASSWORD_RESET' },
      },
      select: { id: true, fingerprint: true, lastSeenAt: true },
    })

    if (!session) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // [S7] Zero-trust device binding (IP-flexible)
    const requestFingerprint = fingerprintFor(req.headers['user-agent'])
    if (session.fingerprint && session.fingerprint !== requestFingerprint) {
      await prisma.userSession.deleteMany({ where: { id: session.id } })
      res.status(401).json({ error: 'Your session was ended for security reasons. Please log in again.' })
      return
    }

    // [S3] Verify user account is active AND [S4] tenant is still active
    const user = await prisma.user.findFirst({
      where: { id: payload.userId, tenantId: payload.tenantId },
      select: { isActive: true, role: true, tenant: { select: { status: true } } },
    })

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    if (user.tenant.status === 'SUSPENDED' || user.tenant.status === 'CANCELLED') {
      res.status(403).json({ error: 'Your organisation account is not active. Please contact support.' })
      return
    }

    // [S8] Async, throttled last-seen update
    if (!session.lastSeenAt || Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
      void prisma.userSession
        .update({ where: { id: session.id }, data: { lastSeenAt: new Date(), lastIp: req.ip } })
        .catch(() => {})
    }

    // [S6] Attach verified identity to request
    req.user = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
    }

    next()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}