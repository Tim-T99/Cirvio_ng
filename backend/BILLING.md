# Billing & paywall (Stripe)

Self-serve subscriptions via Stripe Checkout. A tenant on `TRIAL` upgrades
through hosted Checkout; a Stripe webhook flips the tenant to `ACTIVE`. When a
subscription lapses (cancelled / unpaid), the tenant reverts to an expired-trial
state — the existing read-only + upgrade gating (`TRIAL_EXPIRED`) takes over.

Billing is **optional**: if `STRIPE_SECRET_KEY` is unset, billing endpoints
return a clear "not configured" response and the app runs normally on trials.

## Environment variables

| Variable                | Required | Description                                              |
| ----------------------- | -------- | -------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | for billing | `sk_test_...` / `sk_live_...`                          |
| `STRIPE_WEBHOOK_SECRET` | for billing | `whsec_...` from the webhook endpoint you create        |
| `FRONTEND_URL`          | yes      | Used for Checkout success/cancel + portal return URLs    |

Set these in your backend host's environment variables.

## One-time Stripe setup

1. In the Stripe Dashboard, create a **Product** + a recurring **Price** for each
   tier (e.g. Starter / Growth). Copy each **Price ID** (`price_...`).
2. In the Cirvio **admin panel**, set each Plan's `stripePriceId` to its Stripe
   Price ID (Plan create/update accepts `stripePriceId`). A plan without a
   `stripePriceId` shows as "Contact us" and can't be purchased.
3. Create a **webhook endpoint** pointing at `POST /api/billing/webhook`
   (`https://<api-host>/api/billing/webhook`) and subscribe to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. For local testing: `stripe listen --forward-to localhost:4000/api/billing/webhook`.

## Endpoints

| Method | Path                          | Who            | Purpose                          |
| ------ | ----------------------------- | -------------- | -------------------------------- |
| GET    | `/api/billing/plans`          | any user       | List active plans                |
| GET    | `/api/billing/subscription`   | any user       | Current status, plan, usage      |
| POST   | `/api/billing/checkout`       | TENANT_ADMIN   | Start Stripe Checkout → `{ url }` |
| POST   | `/api/billing/portal`         | TENANT_ADMIN   | Open Stripe customer portal      |
| POST   | `/api/billing/webhook`        | Stripe (signed) | Subscription lifecycle           |

The webhook is mounted with `express.raw` **before** `express.json` so Stripe's
signature can be verified against the raw body.

## Status mapping

| Stripe subscription status     | Tenant result                          |
| ------------------------------ | -------------------------------------- |
| `active` / `trialing` / `past_due` | `ACTIVE` (past_due = grace, Stripe retries) |
| `canceled` / `unpaid` / deleted    | reverts to expired-trial (read-only + upgrade) |
