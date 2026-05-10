// src/utils/jwt.ts
// ─────────────────────────────────────────────
// JWT UTILITIES
// Token signing and verification
// Separate payloads for Admin and User tokens
// Single source of truth for all JWT logic
// ─────────────────────────────────────────────

import jwt from 'jsonwebtoken'


// ─────────────────────────────────────────────
// SECURITY NOTES
// [S1] JWT_SECRET must be a long random string
//      minimum 64 characters in production
//      Never commit to version control
//      Set via environment variable only
// [S2] Tokens expire — short-lived by design
//      8 hours for session tokens
//      1 hour for reset tokens (set at call site)
// [S3] Algorithm pinned to HS256 explicitly —
//      prevents algorithm confusion attacks
//      where attacker switches to 'none'
// [S4] Payload contains only what middleware needs
//      No sensitive data (email, salary, EID)
//      ever stored in JWT payload
// [S5] Verification errors are caught and
//      normalised — raw jwt errors never
//      propagated to the client
// [S6] Admin and User tokens are structurally
//      different — an Admin token cannot be
//      used on a User route and vice versa
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET environment variable is missing or too short. Minimum 32 characters required.'
  )
}

// [S2] Token lifetimes
const SESSION_EXPIRY  = '8h'
const REFRESH_EXPIRY  = '7d'

// [S3] Algorithm pinned explicitly
const JWT_ALGORITHM = 'HS256' as const


// ─────────────────────────────────────────────
// PAYLOAD TYPES
// [S6] Structurally separate Admin vs User
// ─────────────────────────────────────────────

export type AdminJwtPayload = {
  type: 'admin'
  adminId: string
  role: 'SUPER_ADMIN' | 'SUPPORT'
}

export type UserJwtPayload = {
  type: 'user'
  userId: string
  tenantId: string
  role: 'TENANT_ADMIN' | 'HR_MANAGER' | 'VIEWER'
}

export type JwtPayload = AdminJwtPayload | UserJwtPayload


// ─────────────────────────────────────────────
// SIGN
// ─────────────────────────────────────────────

/**
 * Sign an Admin JWT.
 * [S4] Payload contains only adminId and role.
 * [S6] type: 'admin' field distinguishes from user tokens.
 */
export const signAdminToken = (payload: Omit<AdminJwtPayload, 'type'>): string => {
  return jwt.sign(
    { ...payload, type: 'admin' } satisfies AdminJwtPayload,
    JWT_SECRET,
    {
      algorithm: JWT_ALGORITHM,   // [S3]
      expiresIn: SESSION_EXPIRY,  // [S2]
    }
  )
}

/**
 * Sign a User JWT.
 * [S4] Payload contains only userId, tenantId, and role.
 * [S6] type: 'user' field distinguishes from admin tokens.
 */
export const signUserToken = (payload: Omit<UserJwtPayload, 'type'>): string => {
  return jwt.sign(
    { ...payload, type: 'user' } satisfies UserJwtPayload,
    JWT_SECRET,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: SESSION_EXPIRY,
    }
  )
}

/**
 * Legacy overload — kept for services written before
 * Admin/User split. Will be removed after middleware refactor.
 * Prefer signAdminToken or signUserToken directly.
 */
export const signToken = (
  payload: Omit<AdminJwtPayload, 'type'> | Omit<UserJwtPayload, 'type'>
): string => {
  if ('adminId' in payload) return signAdminToken(payload)
  return signUserToken(payload)
}


// ─────────────────────────────────────────────
// VERIFY
// [S5] Errors normalised — raw jwt errors never
//      propagated to the client
// ─────────────────────────────────────────────

/**
 * Verify and decode any Cirvio JWT.
 * [S3] Algorithm pinned — rejects tokens signed with other algorithms.
 * [S5] Throws normalised errors only.
 */
export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],  // [S3] whitelist only HS256
    })

    return decoded as JwtPayload
  } catch (err) {
    // [S5] Normalise all jwt errors into one of two messages
    if (err instanceof jwt.TokenExpiredError) {
      throw new Error('SESSION_EXPIRED')
    }

    // Covers: JsonWebTokenError, NotBeforeError, algorithm mismatch
    throw new Error('INVALID_TOKEN')
  }
}

/**
 * Verify and assert the token is an Admin token.
 * [S6] Rejects User tokens even if valid.
 */
export const verifyAdminToken = (token: string): AdminJwtPayload => {
  const payload = verifyToken(token)

  if (payload.type !== 'admin') {
    throw new Error('INVALID_TOKEN')
  }

  return payload
}

/**
 * Verify and assert the token is a User token.
 * [S6] Rejects Admin tokens even if valid.
 */
export const verifyUserToken = (token: string): UserJwtPayload => {
  const payload = verifyToken(token)

  if (payload.type !== 'user') {
    throw new Error('INVALID_TOKEN')
  }

  return payload
}


// ─────────────────────────────────────────────
// EXTRACT FROM HEADER
// Parses Authorization: Bearer <token>
// Returns null if header is missing or malformed
// ─────────────────────────────────────────────

/**
 * Extract raw JWT string from Authorization header.
 * Returns null if header is absent or malformed.
 * Middleware calls this before verifying.
 */
export const extractBearerToken = (
  authorizationHeader: string | undefined
): string | null => {
  if (!authorizationHeader) return null

  const parts = authorizationHeader.split(' ')

  if (parts.length !== 2 || parts[0] !== 'Bearer') return null

  const token = parts[1]

  // Sanity check — JWTs have exactly 3 dot-separated segments
  if (token.split('.').length !== 3) return null

  return token
}


// ─────────────────────────────────────────────
// DECODE WITHOUT VERIFY
// For reading payload from an expired token
// e.g. to extract userId for a refresh flow
// NEVER use for authentication decisions
// ─────────────────────────────────────────────

/**
 * Decode JWT payload without verifying signature.
 * ONLY use for non-auth purposes (e.g. refresh token flow).
 * Never use this for access control decisions.
 */
export const decodeTokenUnsafe = (token: string): JwtPayload | null => {
  try {
    return jwt.decode(token) as JwtPayload
  } catch {
    return null
  }
}
