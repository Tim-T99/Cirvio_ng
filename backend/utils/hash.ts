// src/utils/hash.ts
// ─────────────────────────────────────────────
// HASH UTILITIES
// Password hashing via bcrypt
// Token hashing via SHA-256
// Single source of truth for all hashing logic
// ─────────────────────────────────────────────

import bcrypt from 'bcrypt'
import crypto from 'crypto'


// ─────────────────────────────────────────────
// SECURITY NOTES
// [S1] bcrypt cost factor set to 12 —
//      high enough to be slow for attackers,
//      acceptable for a B2B SaaS login flow
//      (~300ms on modern hardware)
//      Never go below 10 in production
// [S2] SHA-256 used for tokens only —
//      never for passwords. Tokens are already
//      high-entropy random bytes so SHA-256
//      is appropriate and fast
// [S3] comparePassword uses bcrypt.compare —
//      constant-time by design, prevents
//      timing attacks at the hash level
// [S4] No custom salts — bcrypt generates and
//      embeds a unique salt per hash automatically
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

// [S1] Cost factor — increase if hardware improves
const BCRYPT_ROUNDS = 12


// ─────────────────────────────────────────────
// PASSWORD HASHING
// ─────────────────────────────────────────────

/**
 * Hash a plaintext password using bcrypt.
 * [S4] bcrypt auto-generates a unique salt per call.
 * Never store or log the plaintext password.
 */
export const hashPassword = async (plaintext: string): Promise<string> => {
  if (!plaintext || plaintext.length === 0) {
    throw new Error('Password cannot be empty')
  }

  // bcrypt has a 72-byte input limit — enforce it explicitly
  // to prevent silent truncation on very long passwords
  if (Buffer.byteLength(plaintext, 'utf8') > 72) {
    throw new Error('Password must not exceed 72 characters')
  }

  return bcrypt.hash(plaintext, BCRYPT_ROUNDS)
}

/**
 * Compare a plaintext password against a bcrypt hash.
 * [S3] bcrypt.compare is constant-time — safe against timing attacks.
 * Returns false (never throws) on mismatch — caller decides the response.
 */
export const comparePassword = async (
  plaintext: string,
  hash: string
): Promise<boolean> => {
  if (!plaintext || !hash) return false

  try {
    return await bcrypt.compare(plaintext, hash)
  } catch {
    // Malformed hash — treat as mismatch, never expose error detail
    return false
  }
}


// ─────────────────────────────────────────────
// TOKEN HASHING
// For invite tokens, session tokens, reset tokens
// [S2] SHA-256 only — never use for passwords
// ─────────────────────────────────────────────

/**
 * Hash a high-entropy random token using SHA-256.
 * Used for: invite tokens, password reset tokens, session tokens.
 * [S2] Appropriate because input is already cryptographically random.
 */
export const hashToken = (plainToken: string): string => {
  if (!plainToken || plainToken.length === 0) {
    throw new Error('Token cannot be empty')
  }

  return crypto
    .createHash('sha256')
    .update(plainToken)
    .digest('hex')
}


// ─────────────────────────────────────────────
// TOKEN GENERATION
// Centralised here so all random tokens
// use the same entropy source
// ─────────────────────────────────────────────

/**
 * Generate a cryptographically secure random token.
 * Default: 32 bytes = 64 hex characters.
 * Use for: invite links, password reset links, session tokens.
 */
export const generateToken = (bytes: number = 32): string => {
  return crypto.randomBytes(bytes).toString('hex')
}

/**
 * Generate a token and its hash together.
 * Returns plainToken for sending to client (once only)
 * and hashedToken for storing in the database.
 */
export const generateTokenPair = (bytes: number = 32): {
  plainToken: string
  hashedToken: string
} => {
  const plainToken = generateToken(bytes)
  const hashedToken = hashToken(plainToken)
  return { plainToken, hashedToken }
}
