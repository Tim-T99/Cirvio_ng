// src/services/entitlement.service.ts
// ─────────────────────────────────────────────
// Resolves which features a tenant is entitled to, based on its plan.
// Feature flags are independent of subscription status; the "paywall"
// (must be on a paid/ACTIVE plan) is enforced separately via requirePaidPlan.
// ─────────────────────────────────────────────

import { prisma } from '../prisma/client'
import { resolvePlanFeatures } from '../lib/features'

/** The effective set of feature keys enabled for a tenant's plan. */
export async function getTenantFeatures(tenantId: string): Promise<string[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: { select: { features: true } } },
  })
  // No plan → treat as all-enabled (don't lock people out by default).
  if (!tenant?.plan) return resolvePlanFeatures(null)
  return resolvePlanFeatures(tenant.plan.features)
}

export async function tenantHasFeature(tenantId: string, key: string): Promise<boolean> {
  return (await getTenantFeatures(tenantId)).includes(key)
}
