// src/middleware/rateLimit.middleware.ts
// ─────────────────────────────────────────────
// RATE LIMITING
// Tiered limits applied per route category.
// All limits are per IP address.
//
// In-memory store is used by default (single
// process). For multi-instance deployments set
// REDIS_URL and swap the store to ioredis-based
// or @rate-limit/redis — the limiter options
// below are store-agnostic.
//
// Limits are intentionally conservative; tune
// RATE_LIMIT_MULTIPLIER env var in dev/staging:
//   RATE_LIMIT_MULTIPLIER=10 npm run server
// ─────────────────────────────────────────────

import { rateLimit, Options, ipKeyGenerator } from 'express-rate-limit'
import { Request, Response } from 'express'

// ── Tuning knob ───────────────────────────────
// Multiply all limits × this value. Default 1.
// Raise in dev/staging via env var.
const M = Math.max(1, parseFloat(process.env.RATE_LIMIT_MULTIPLIER ?? '1'))

// ── Standard JSON error response ─────────────

const handler = (_req: Request, res: Response) => {
  res.status(429).json({
    error: 'Too many requests. Please slow down and try again shortly.',
  })
}

// ── Shared base options ───────────────────────

const base: Partial<Options> = {
  standardHeaders: 'draft-7', // Return RateLimit-* headers (RFC 9110 draft)
  legacyHeaders:   false,     // Disable X-RateLimit-* legacy headers
  handler,
  // Skip rate limiting in tests
  skip: () => process.env.NODE_ENV === 'test',
}

// ─────────────────────────────────────────────
// LIMITERS
//
// ┌──────────────────────────┬────────┬────────┐
// │ Category                 │ Reqs   │ Window │
// ├──────────────────────────┼────────┼────────┤
// │ Global (all /api/*)      │   300  │ 15 min │
// │ Standard API             │   100  │ 15 min │
// │ Auth (login, register)   │    15  │ 15 min │
// │ Password reset request   │     5  │  1 hr  │
// │ Admin auth               │    10  │ 15 min │
// │ OAuth endpoints          │    20  │ 15 min │
// │ Passkey endpoints        │    20  │ 15 min │
// │ SIF generation (costly)  │    10  │  1 hr  │
// │ File upload-url          │    30  │ 15 min │
// └──────────────────────────┴────────┴────────┘
// ─────────────────────────────────────────────

/** Catches runaway clients before they hit any route logic */
export const globalLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit:    Math.floor(300 * M),
  message:  undefined,
})

/** General authenticated API calls (employees, visas, docs, WPS) */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit:    Math.floor(100 * M),
})

/** Login + tenant register + OAuth login — most abuse-targeted */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit:    Math.floor(15 * M),
  // Per-email keying for login: makes credential-stuffing harder
  // Falls back to IP if body can't be parsed
  keyGenerator: (req) => {
    const email = req.body?.email as string | undefined
    const ip = ipKeyGenerator(req.ip ?? '')
    return email ? `${ip}:${email.toLowerCase().trim()}` : ip
  },
})

/** Password reset REQUEST (sends email) — very expensive, abuse-prone */
export const passwordResetLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000, // 1 hour
  limit:    Math.floor(5 * M),
  keyGenerator: (req) => {
    const email = req.body?.email as string | undefined
    const ip = ipKeyGenerator(req.ip ?? '')
    return email ? `${ip}:${email.toLowerCase().trim()}` : ip
  },
})

/** Admin portal login — tighter because admins have platform-wide access */
export const adminAuthLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit:    Math.floor(10 * M),
})

/** OAuth endpoints — slightly more lenient than password auth */
export const oauthLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit:    Math.floor(20 * M),
})

/** Passkey endpoints */
export const passkeyLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit:    Math.floor(20 * M),
})

/** SIF file generation — heavy DB + CSV work */
export const sifLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000, // 1 hour
  limit:    Math.floor(10 * M),
})

/** Document upload-url — each call may trigger S3 presign + DB write */
export const uploadLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit:    Math.floor(30 * M),
})
