// src/lib/stripe.ts
// ─────────────────────────────────────────────
// Stripe client (lazy). Billing is optional — if STRIPE_SECRET_KEY is unset,
// billing endpoints return a clear "not configured" error instead of crashing.
//
// Env:
//   STRIPE_SECRET_KEY     — sk_test_... / sk_live_...
//   STRIPE_WEBHOOK_SECRET — whsec_... (from the Stripe webhook endpoint)
//   FRONTEND_URL          — used to build checkout success/cancel + portal return URLs
// ─────────────────────────────────────────────

import Stripe from 'stripe'

// Instance type derived from the constructor — avoids the namespace/value
// ambiguity in the stripe package's type exports under CommonJS.
type StripeClient = InstanceType<typeof Stripe>

let client: StripeClient | null = null

export function isBillingConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export function getStripe(): StripeClient {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Billing is not configured')
  }
  if (!client) {
    // Uses the SDK's bundled API version (kept in sync with the `stripe` dep).
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      appInfo: { name: 'Cirvio' },
    })
  }
  return client
}

export function webhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET
  if (!s) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  return s
}
