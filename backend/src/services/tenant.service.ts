// src/services/tenant.service.ts
// ─────────────────────────────────────────────
// TENANT SERVICE
// Tenant self-management operations
// All operations are strictly scoped to tenantId
// Called by tenant-facing controllers only
// ─────────────────────────────────────────────

import { prisma } from '../prisma/client'
import { UserRole, TenantStatus } from '@prisma/client'
import { hashToken, hashPassword } from '../../utils/hash'
import { signToken } from '../../utils/jwt'
import crypto from 'crypto'


// ─────────────────────────────────────────────
// SECURITY NOTES
// [S1] Raw invite tokens are never stored —
//      only their SHA-256 hash is persisted.
//      The plaintext token is returned once
//      and never retrievable again.
// [S2] All queries are scoped to tenantId
//      passed from verified JWT middleware —
//      never trusted from request body.
// [S3] Sensitive fields (passwordHash etc.)
//      are excluded from all selects explicitly.
// [S4] Plan limit enforcement happens at the
//      service layer, not just the frontend.
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// TENANT REGISTRATION (public)
// Creates Tenant + first TENANT_ADMIN user in
// a single transaction, returns a session token
// ─────────────────────────────────────────────

export const registerTenant = async (data: {
  organizationName: string
  firstName: string
  lastName: string
  email: string
  password: string
}) => {
  // Check email uniqueness across all users
  const existingUser = await prisma.user.findFirst({ where: { email: data.email } })
  if (existingUser) {
    throw new Error('An account with this email already exists')
  }

  // Derive URL-safe slug from org name
  const baseSlug = data.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'workspace'

  const slugTaken = await prisma.tenant.findUnique({ where: { slug: baseSlug } })
  const slug = slugTaken ? `${baseSlug}-${Date.now()}` : baseSlug

  // Use the cheapest available plan for trial (optional — plan may not exist yet)
  const defaultPlan = await prisma.plan.findFirst({ orderBy: { priceAed: 'asc' } })

  const passwordHash = await hashPassword(data.password)

  const { tenant, user } = await prisma.$transaction(async (tx: typeof prisma) => {
    const tenant = await tx.tenant.create({
      data: {
        name: data.organizationName,
        slug,
        email: data.email,
        status: 'ACTIVE',
        trialEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14), // 14-day trial
        ...(defaultPlan && { planId: defaultPlan.id }),
      },
    })

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        role: 'TENANT_ADMIN',
        isActive: true,
      },
    })

    return { tenant, user }
  })

  const token = signToken({ userId: user.id, tenantId: tenant.id, role: user.role })
  const hashedToken = hashToken(token)

  await prisma.userSession.create({
    data: {
      userId: user.id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8),
    },
  })

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: tenant.id,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
      },
    },
  }
}


// ─────────────────────────────────────────────
// TENANT PROFILE
// ─────────────────────────────────────────────

export const getTenantProfile = async (tenantId: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      logoUrl: true,
      industry: true,
      emirate: true,
      tradelicenseNo: true,
      tradelicenseExpiry: true,
      status: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      createdAt: true,
      plan: {
        select: {
          name: true,
          maxEmployees: true,
          maxAdmins: true,
          priceAed: true,
          billingCycleMonths: true,
        },
      },
      _count: {
        select: {
          employees: true,
          users: true,
        },
      },
    },
  })

  if (!tenant) throw new Error('Tenant not found')
  return tenant
}

export const updateTenantProfile = async (
  tenantId: string,
  data: Partial<{
    name: string
    phone: string
    logoUrl: string
    industry: string
    tradelicenseNo: string
    tradelicenseExpiry: Date
  }>
) => {
  // [S2] tenantId comes from verified middleware, not request body
  return prisma.tenant.update({
    where: { id: tenantId },
    data,
    select: {
      id: true,
      name: true,
      phone: true,
      logoUrl: true,
      industry: true,
      tradelicenseNo: true,
      tradelicenseExpiry: true,
      updatedAt: true,
    },
  })
}


// ─────────────────────────────────────────────
// PLAN LIMIT HELPERS
// Internal checks — called before any create op
// [S4] Enforced server-side regardless of UI state
// ─────────────────────────────────────────────

export const assertEmployeeLimit = async (tenantId: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: { select: { maxEmployees: true } },
      _count: { select: { employees: true } },
    },
  })

  if (!tenant) throw new Error('Tenant not found')
  if (!tenant.plan) return  // no plan assigned yet — no limit to enforce

  if (tenant._count.employees >= tenant.plan.maxEmployees) {
    throw new Error(
      `Employee limit reached. Your plan allows a maximum of ${tenant.plan.maxEmployees} employees. Please upgrade to add more.`
    )
  }
}

export const assertUserLimit = async (tenantId: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: { select: { maxAdmins: true } },
      _count: { select: { users: true } },
    },
  })

  if (!tenant) throw new Error('Tenant not found')
  if (!tenant.plan) return  // no plan assigned yet — no limit to enforce

  if (tenant._count.users >= tenant.plan.maxAdmins) {
    throw new Error(
      `User limit reached. Your plan allows a maximum of ${tenant.plan.maxAdmins} users. Please upgrade to add more.`
    )
  }
}

export const assertTenantActive = async (tenantId: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true },
  })

  if (!tenant) throw new Error('Tenant not found')

  if (tenant.status === TenantStatus.SUSPENDED) {
    throw new Error('Your account has been suspended. Please contact support.')
  }

  if (tenant.status === TenantStatus.CANCELLED) {
    throw new Error('Your account has been cancelled. Please contact support.')
  }
}


// ─────────────────────────────────────────────
// TENANT INVITES
// Invite new users to join the tenant portal
// [S1] Token security — plaintext never stored
// ─────────────────────────────────────────────

export const createInvite = async (
  tenantId: string,
  data: {
    email: string
    role: UserRole
  }
) => {
  // [S4] Check user limit before sending invite
  await assertUserLimit(tenantId)
  await assertTenantActive(tenantId)

  // Check if user already exists in this tenant
  const existingUser = await prisma.user.findFirst({
    where: { tenantId, email: data.email },
  })
  if (existingUser) {
    throw new Error('A user with this email already exists in your organisation')
  }

  // Check for existing pending invite
  const existingInvite = await prisma.tenantInvite.findFirst({
    where: {
      tenantId,
      email: data.email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
  if (existingInvite) {
    throw new Error('An active invite already exists for this email')
  }

  // [S1] Generate cryptographically secure random token
  const plainToken = crypto.randomBytes(32).toString('hex')

  // [S1] Store only the hash — plaintext is never persisted
  const hashedToken = hashToken(plainToken)

  await prisma.tenantInvite.create({
    data: {
      tenantId,
      email: data.email,
      role: data.role,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48), // 48 hours
    },
  })

  // Return plaintext once — caller sends this in the invite email link
  // It is never retrievable again after this point
  return { plainToken, email: data.email, role: data.role }
}

export const validateInvite = async (plainToken: string) => {
  // [S1] Hash the incoming token before DB lookup
  const hashedToken = hashToken(plainToken)

  const invite = await prisma.tenantInvite.findUnique({
    where: { token: hashedToken },
    include: {
      tenant: {
        select: { id: true, name: true, logoUrl: true },
      },
    },
  })

  if (!invite) throw new Error('Invalid or expired invite link')
  if (invite.acceptedAt) throw new Error('This invite has already been used')
  if (invite.expiresAt < new Date()) throw new Error('This invite has expired')

  return invite
}

export const acceptInvite = async (
  plainToken: string,
  data: {
    firstName: string
    lastName: string
    password: string
  }
) => {
  const invite = await validateInvite(plainToken)

  // [S3] Import hash here — password never stored plain
  const { hashPassword } = await import('../../utils/hash')
  const passwordHash = await hashPassword(data.password)

  const user = await prisma.user.create({
    data: {
      tenantId: invite.tenantId,
      email: invite.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: invite.role,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      tenantId: true,
    },
  })

  // Mark invite as accepted
  await prisma.tenantInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  })

  return user
}

export const listInvites = async (tenantId: string) => {
  // [S2] Scoped to tenantId from middleware
  return prisma.tenantInvite.findMany({
    where: {
      tenantId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      // [S1] token (hashed) is never returned to client
    },
    orderBy: { createdAt: 'desc' },
  })
}

export const revokeInvite = async (
  tenantId: string,
  inviteId: string
) => {
  // [S2] Verify invite belongs to this tenant before deleting
  const invite = await prisma.tenantInvite.findFirst({
    where: { id: inviteId, tenantId },
  })

  if (!invite) throw new Error('Invite not found')

  await prisma.tenantInvite.delete({
    where: { id: inviteId },
  })
}


// ─────────────────────────────────────────────
// TENANT STATS
// Dashboard summary scoped to this tenant
// ─────────────────────────────────────────────

export const getTenantStats = async (tenantId: string) => {
  // [S2] All counts scoped to tenantId
  const [
    totalEmployees,
    activeEmployees,
    expiringVisas,
    expiredVisas,
    pendingWps,
    totalUsers,
  ] = await Promise.all([
    prisma.employee.count({
      where: { tenantId },
    }),
    prisma.employee.count({
      where: { tenantId, status: 'ACTIVE' },
    }),
    prisma.visaRecord.count({
      where: { tenantId, status: 'EXPIRING_SOON' },
    }),
    prisma.visaRecord.count({
      where: { tenantId, status: 'EXPIRED' },
    }),
    prisma.wpsRecord.count({
      where: { tenantId, status: 'PENDING' },
    }),
    prisma.user.count({
      where: { tenantId },
    }),
  ])

  return {
    totalEmployees,
    activeEmployees,
    expiringVisas,
    expiredVisas,
    pendingWps,
    totalUsers,
  }
}