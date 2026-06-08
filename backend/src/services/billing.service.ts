// src/services/billing.service.ts
// ─────────────────────────────────────────────
// Stripe subscription billing, tenant-scoped.
//
// Flow: tenant on TRIAL → self-serve Checkout → webhook flips status to ACTIVE
// and stores the subscription. Lapses (cancel / unpaid) revert the tenant to an
// expired-trial state so the existing read-only + upgrade gating kicks back in.
// ─────────────────────────────────────────────

import { prisma } from '../prisma/client'
import { getStripe, webhookSecret } from '../lib/stripe'
import { frontendUrl } from '../lib/email'
import { getTenantFeatures } from './entitlement.service'

// ── Public plan + subscription reads ─────────────────────────────────────────

export const listPlans = async () => {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceAed: 'asc' },
    select: {
      id: true, name: true, priceAed: true, billingCycleMonths: true,
      maxEmployees: true, maxAdmins: true, features: true,
      // A plan is purchasable only if an admin has linked a Stripe price.
      stripePriceId: true,
    },
  })
}

/** Current billing posture for a tenant, including live usage vs plan limits. */
export const getSubscription = async (tenantId: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      status: true, trialEndsAt: true, subscriptionEndsAt: true,
      stripeSubscriptionId: true,
      stripeCustomerId: true,
      plan: { select: { id: true, name: true, priceAed: true, maxEmployees: true, maxAdmins: true } },
    },
  })
  if (!tenant) throw new Error('Tenant not found')

  const [employeeCount, userCount, features] = await Promise.all([
    prisma.employee.count({ where: { tenantId } }),
    prisma.user.count({ where: { tenantId } }),
    getTenantFeatures(tenantId),
  ])

  const now = new Date()
  const trialExpired =
    tenant.status === 'TRIAL' && !!tenant.trialEndsAt && tenant.trialEndsAt < now

  return {
    status: tenant.status,
    plan: tenant.plan,
    trialEndsAt: tenant.trialEndsAt,
    subscriptionEndsAt: tenant.subscriptionEndsAt,
    hasSubscription: !!tenant.stripeSubscriptionId,
    canManageBilling: !!tenant.stripeCustomerId,
    trialExpired,
    features,
    isPaid: tenant.status === 'ACTIVE',
    usage: {
      employees: employeeCount,
      users: userCount,
      maxEmployees: tenant.plan?.maxEmployees ?? null,
      maxAdmins: tenant.plan?.maxAdmins ?? null,
    },
  }
}

// ── Checkout & portal (mutating, TENANT_ADMIN) ───────────────────────────────

/** Ensure the tenant has a Stripe Customer; create + persist one if not. */
async function ensureCustomer(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true, name: true, email: true },
  })
  if (!tenant) throw new Error('Tenant not found')
  if (tenant.stripeCustomerId) return tenant.stripeCustomerId

  const customer = await getStripe().customers.create({
    name: tenant.name,
    email: tenant.email,
    metadata: { tenantId },
  })
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { stripeCustomerId: customer.id },
  })
  return customer.id
}

export const createCheckoutSession = async (tenantId: string, planId: string): Promise<string> => {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { id: true, stripePriceId: true, isActive: true },
  })
  if (!plan || !plan.isActive) throw new Error('Plan not found')
  if (!plan.stripePriceId) throw new Error('This plan is not available for purchase yet')

  const customerId = await ensureCustomer(tenantId)
  const base = frontendUrl()

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${base}/dashboard/settings?billing=success`,
    cancel_url: `${base}/dashboard/settings?billing=cancelled`,
    metadata: { tenantId, planId },
    subscription_data: { metadata: { tenantId, planId } },
  })

  if (!session.url) throw new Error('Could not start checkout')
  return session.url
}

export const createPortalSession = async (tenantId: string): Promise<string> => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  })
  if (!tenant?.stripeCustomerId) throw new Error('No billing account to manage yet')

  const session = await getStripe().billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: `${frontendUrl()}/dashboard/settings`,
  })
  return session.url
}

// ── Webhook handling ─────────────────────────────────────────────────────────

export const constructEvent = (payload: Buffer, signature: string) => {
  return getStripe().webhooks.constructEvent(payload, signature, webhookSecret())
}

/** Find the tenant a Stripe object belongs to (metadata first, then customer). */
async function resolveTenantId(meta: Record<string, string> | null | undefined, customerId?: string | null): Promise<string | null> {
  if (meta?.tenantId) return meta.tenantId
  if (customerId) {
    const t = await prisma.tenant.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } })
    if (t) return t.id
  }
  return null
}

async function applySubscription(sub: any): Promise<void> {
  const tenantId = await resolveTenantId(sub.metadata, sub.customer as string)
  if (!tenantId) return

  const planId = sub.metadata?.planId
  const periodEnd = sub.current_period_end as number | undefined
  const endsAt = periodEnd ? new Date(periodEnd * 1000) : null

  // active / trialing → full access; past_due keeps access (Stripe retries);
  // canceled / unpaid / expired → revert to an expired-trial (read-only) state.
  const active = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'

  if (active) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'ACTIVE',
        stripeSubscriptionId: sub.id,
        subscriptionEndsAt: endsAt,
        ...(planId ? { planId } : {}),
      },
    })
  } else {
    await lapseTenant(tenantId)
  }
}

async function lapseTenant(tenantId: string): Promise<void> {
  // Reuse the existing TRIAL_EXPIRED gating: read-only + upgrade prompt,
  // while letting the admin re-subscribe.
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: 'TRIAL',
      trialEndsAt: new Date(0),
      subscriptionEndsAt: new Date(),
      stripeSubscriptionId: null,
    },
  })
}

export const handleEvent = async (event: any): Promise<void> => {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any
      if (session.subscription) {
        const sub = await getStripe().subscriptions.retrieve(session.subscription as string) as any
        // Carry checkout metadata onto the subscription resolution if needed.
        if (!sub.metadata?.tenantId && session.metadata?.tenantId) {
          sub.metadata = { ...sub.metadata, ...session.metadata }
        }
        await applySubscription(sub)
      }
      break
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await applySubscription(event.data.object)
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as any
      const tenantId = await resolveTenantId(sub.metadata, sub.customer as string)
      if (tenantId) await lapseTenant(tenantId)
      break
    }
    default:
      // Other events ignored for now.
      break
  }
}
