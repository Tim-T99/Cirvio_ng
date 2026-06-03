// src/services/admin.service.ts
// ─────────────────────────────────────────────
// ADMIN SERVICE
// Platform-level operations: SuperAdmin + Support
// No tenantId scoping — operates across all tenants
// ─────────────────────────────────────────────

import { prisma } from '../prisma/client'
import { AdminRole, TenantStatus, Emirate } from '@prisma/client'
import { hashPassword, comparePassword, hashToken } from '../../utils/hash'
import { signToken } from '../../utils/jwt'
import { sessionDeviceData } from '../../utils/device'


// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export const loginAdmin = async (
  email: string,
  password: string,
  ctx?: { ipAddress?: string; userAgent?: string }
) => {
  const admin = await prisma.admin.findUnique({
    where: { email },
  })

  if (!admin || !admin.isActive) {
    throw new Error('Invalid credentials')
  }

  const valid = await comparePassword(password, admin.passwordHash)
  if (!valid) {
    throw new Error('Invalid credentials')
  }

  // Update last login timestamp
  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  })

  const token = signToken({ adminId: admin.id, role: admin.role })

  // Persist session
  // [S1] Store hashed token only — matches middleware lookup via hashToken()
  const hashedToken = hashToken(token)

  await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 1), // 1 hour
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      ...sessionDeviceData(ctx?.userAgent, ctx?.ipAddress),
    },
  })

  return {
    token,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  }
}

export const getAdminById = async (id: string) => {
  return prisma.admin.findUniqueOrThrow({
    where: { id },
    select: { id: true, email: true, name: true, role: true },
  })
}

export const logoutAdmin = async (token: string) => {
  await prisma.adminSession.deleteMany({
    where: { token },
  })
}


// ─────────────────────────────────────────────
// ADMIN MANAGEMENT
// SuperAdmin only — create/manage support staff
// ─────────────────────────────────────────────

export const createAdmin = async (data: {
  email: string
  password: string
  name: string
  role?: AdminRole
}) => {
  const existing = await prisma.admin.findUnique({
    where: { email: data.email },
  })

  if (existing) {
    throw new Error('An admin with this email already exists')
  }

  const passwordHash = await hashPassword(data.password)

  const admin = await prisma.admin.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      role: data.role ?? AdminRole.SUPPORT,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  return admin
}

export const listAdmins = async () => {
  return prisma.admin.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export const updateAdmin = async (
  adminId: string,
  data: Partial<{
    name: string
    role: AdminRole
    isActive: boolean
  }>
) => {
  return prisma.admin.update({
    where: { id: adminId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  })
}

export const changeAdminPassword = async (
  adminId: string,
  currentPassword: string,
  newPassword: string
) => {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
  })

  if (!admin) throw new Error('Admin not found')

  const valid = await comparePassword(currentPassword, admin.passwordHash)
  if (!valid) throw new Error('Current password is incorrect')

  const passwordHash = await hashPassword(newPassword)

  await prisma.admin.update({
    where: { id: adminId },
    data: { passwordHash },
  })

  // Invalidate all existing sessions on password change
  await prisma.adminSession.deleteMany({
    where: { adminId },
  })
}


// ─────────────────────────────────────────────
// TENANT OVERSIGHT
// View and manage all tenants across the platform
// ─────────────────────────────────────────────

export const listAllTenants = async (filters?: {
  status?: TenantStatus
  search?: string
}) => {
  return prisma.tenant.findMany({
    where: {
      ...(filters?.status && { status: filters.status }),
      ...(filters?.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { slug: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      plan: {
        select: { name: true, priceAed: true },
      },
      _count: {
        select: { employees: true, users: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export const getTenantById = async (tenantId: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      plan: true,
      _count: {
        select: {
          employees: true,
          users: true,
          visaRecords: true,
          wpsRecords: true,
        },
      },
    },
  })

  if (!tenant) throw new Error('Tenant not found')
  return tenant
}

export const updateTenantDetails = async (
  tenantId: string,
  data: Partial<{
    name: string
    email: string
    phone: string | null
    industry: string | null
    emirate: Emirate | null
    tradelicenseNo: string | null
    tradelicenseExpiry: Date | null
    trialEndsAt: Date | null
    subscriptionEndsAt: Date | null
  }>
) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
  if (!tenant) throw new Error('Tenant not found')
  return prisma.tenant.update({
    where: { id: tenantId },
    data,
    include: {
      plan: true,
      _count: { select: { employees: true, users: true, visaRecords: true, wpsRecords: true } },
    },
  })
}

export const updateTenantStatus = async (
  tenantId: string,
  status: TenantStatus,
  adminId: string,
  reason?: string
) => {
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { status },
    select: { id: true, name: true, status: true },
  })

  // Log the action
  await prisma.auditLog.create({
    data: {
      adminId,
      action: `TENANT_${status}`,
      targetType: 'Tenant',
      targetId: tenantId,
      meta: { reason },
    },
  })

  return tenant
}

export const changeTenantPlan = async (
  tenantId: string,
  planId: string,
  adminId: string
) => {
  const plan = await prisma.plan.findUnique({ where: { id: planId } })
  if (!plan) throw new Error('Plan not found')

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { planId },
    select: { id: true, name: true, planId: true },
  })

  await prisma.auditLog.create({
    data: {
      adminId,
      action: 'PLAN_CHANGED',
      targetType: 'Tenant',
      targetId: tenantId,
      meta: { newPlanId: planId, newPlanName: plan.name },
    },
  })

  return tenant
}


// ─────────────────────────────────────────────
// PLAN MANAGEMENT
// CRUD for subscription plans
// ─────────────────────────────────────────────

export const listPlans = async () => {
  return prisma.plan.findMany({
    orderBy: { priceAed: 'asc' },
  })
}

export const createPlan = async (data: {
  name: string
  maxEmployees: number
  maxAdmins: number
  priceAed: number
  billingCycleMonths?: number
}) => {
  return prisma.plan.create({ data })
}

export const updatePlan = async (
  planId: string,
  data: Partial<{
    name: string
    maxEmployees: number
    maxAdmins: number
    priceAed: number
    isActive: boolean
  }>
) => {
  return prisma.plan.update({
    where: { id: planId },
    data,
  })
}


// ─────────────────────────────────────────────
// AUDIT LOGS
// Platform-wide action trail
// ─────────────────────────────────────────────

export const getAuditLogs = async (filters?: {
  adminId?: string
  targetType?: string
  targetId?: string
  limit?: number
}) => {
  return prisma.auditLog.findMany({
    where: {
      ...(filters?.adminId && { adminId: filters.adminId }),
      ...(filters?.targetType && { targetType: filters.targetType }),
      ...(filters?.targetId && { targetId: filters.targetId }),
    },
    include: {
      admin: {
        select: { name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 100,
  })
}


// ─────────────────────────────────────────────
// PLATFORM STATS
// Dashboard summary for SuperAdmin
// ─────────────────────────────────────────────

export const getPlatformStats = async () => {
  const [
    totalTenants,
    active,
    trial,
    suspended,
    totalEmployees,
    platformAdmins,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: 'ACTIVE' } }),
    prisma.tenant.count({ where: { status: 'TRIAL' } }),
    prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
    prisma.employee.count(),
    prisma.admin.count({ where: { isActive: true } }),
  ])

  return { totalTenants, active, trial, suspended, totalEmployees, platformAdmins }
}


// ─────────────────────────────────────────────
// SESSIONS · DEVICES · ACCESS CONTROL
// Per-tenant / per-user device visibility plus the
// zero-trust enforcement actions (revoke, force
// logout, lock). Password-reset pseudo-sessions are
// always excluded.
// ─────────────────────────────────────────────

const REAL_SESSION = { NOT: { userAgent: 'PASSWORD_RESET' } } as const

/** Write an audit-log entry; never throws (audit must not block an action). */
export const recordAudit = async (
  adminId: string | undefined,
  action: string,
  targetType: string,
  targetId: string,
  meta?: Record<string, unknown>,
) => {
  try {
    await prisma.auditLog.create({
      data: { adminId: adminId ?? null, action, targetType, targetId, meta: (meta ?? null) as any },
    })
  } catch {
    /* swallow */
  }
}

/** Users of a tenant with active-session and distinct-device counts. */
export const listTenantUsers = async (tenantId: string) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
  if (!tenant) throw new Error('Tenant not found')

  const now = new Date()
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true, email: true, firstName: true, lastName: true, avatarUrl: true,
      role: true, isActive: true, lastLoginAt: true, createdAt: true,
      sessions: {
        where: { expiresAt: { gt: now }, ...REAL_SESSION },
        select: { id: true, fingerprint: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return users.map(({ sessions, ...u }) => ({
    ...u,
    activeSessions: sessions.length,
    deviceCount: new Set(sessions.map(s => s.fingerprint ?? s.id)).size,
  }))
}

/** All sessions (devices) for one user, newest first. */
export const listUserSessions = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, tenantId: true, email: true, firstName: true,
      lastName: true, isActive: true, role: true, avatarUrl: true,
    },
  })
  if (!user) throw new Error('User not found')

  const now = new Date()
  const sessions = await prisma.userSession.findMany({
    where: { userId, ...REAL_SESSION },
    select: {
      id: true, deviceType: true, deviceName: true, os: true, browser: true,
      ipAddress: true, lastIp: true, lastSeenAt: true, createdAt: true, expiresAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return { user, sessions: sessions.map(s => ({ ...s, active: s.expiresAt > now })) }
}

/** Platform-wide active sessions across all tenants (paginated). */
export const listActiveSessions = async (opts?: { page?: number; limit?: number }) => {
  const page = Math.max(1, opts?.page ?? 1)
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 25))
  const now = new Date()
  const where = { expiresAt: { gt: now }, ...REAL_SESSION }

  const [total, rows] = await Promise.all([
    prisma.userSession.count({ where }),
    prisma.userSession.findMany({
      where,
      select: {
        id: true, deviceType: true, deviceName: true, os: true, browser: true,
        ipAddress: true, lastIp: true, lastSeenAt: true, createdAt: true,
        user: {
          select: {
            id: true, email: true, firstName: true, lastName: true, avatarUrl: true,
            tenant: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { lastSeenAt: { sort: 'desc', nulls: 'last' } },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return { sessions: rows, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) }
}

/** Revoke (force-logout) a single session. */
export const revokeSession = async (sessionId: string) => {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true },
  })
  if (!session) throw new Error('Session not found')
  await prisma.userSession.delete({ where: { id: sessionId } })
  return { revoked: true, userId: session.userId }
}

/** Revoke every session for a user (force-logout everywhere). */
export const revokeUserSessions = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) throw new Error('User not found')
  const result = await prisma.userSession.deleteMany({ where: { userId } })
  return { revoked: result.count }
}

/** Lock / unlock a tenant user. Deactivating also force-logs-out everywhere. */
export const setUserActive = async (userId: string, isActive: boolean) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) throw new Error('User not found')

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: { id: true, email: true, isActive: true, tenantId: true },
  })

  if (!isActive) {
    await prisma.userSession.deleteMany({ where: { userId } })
  }
  return updated
}

/** Full detail for one tenant user — profile, tenant (with plan) and device/session counts. */
export const getUserDetail = async (userId: string) => {
  const now = new Date()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, firstName: true, lastName: true, avatarUrl: true,
      phone: true, role: true, isActive: true, lastLoginAt: true,
      createdAt: true, updatedAt: true,
      tenant: {
        select: {
          id: true, name: true, slug: true, status: true, planId: true,
          plan: { select: { id: true, name: true } },
        },
      },
      sessions: {
        where: { expiresAt: { gt: now }, ...REAL_SESSION },
        select: { id: true, fingerprint: true },
      },
    },
  })
  if (!user) throw new Error('User not found')

  const { sessions, ...rest } = user
  return {
    ...rest,
    activeSessions: sessions.length,
    deviceCount: new Set(sessions.map(s => s.fingerprint ?? s.id)).size,
  }
}

/** Update a tenant user's profile fields. Email is unique per tenant. */
export const updateUserDetail = async (
  userId: string,
  data: Partial<{
    firstName: string
    lastName: string
    email: string
    phone: string | null
    role: 'TENANT_ADMIN' | 'HR_MANAGER' | 'VIEWER'
    avatarUrl: string | null
  }>,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tenantId: true, email: true },
  })
  if (!user) throw new Error('User not found')

  if (data.email && data.email !== user.email) {
    const clash = await prisma.user.findFirst({
      where: { tenantId: user.tenantId, email: data.email, id: { not: userId } },
      select: { id: true },
    })
    if (clash) throw new Error('Email already in use within this tenant')
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true, email: true, firstName: true, lastName: true, avatarUrl: true,
      phone: true, role: true, isActive: true,
    },
  })
}

/** Permanently delete a tenant user (cascades sessions & activity logs). */
export const deleteUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tenantId: true, role: true, email: true },
  })
  if (!user) throw new Error('User not found')

  // Guard: never remove a tenant's last admin — they'd be locked out.
  if (user.role === 'TENANT_ADMIN') {
    const admins = await prisma.user.count({
      where: { tenantId: user.tenantId, role: 'TENANT_ADMIN' },
    })
    if (admins <= 1) throw new Error('Cannot delete the only admin of a tenant')
  }

  await prisma.user.delete({ where: { id: userId } })
  return { deleted: true, email: user.email }
}

/** Active-session and device totals for the platform dashboard. */
export const getSessionStats = async () => {
  const now = new Date()
  const where = { expiresAt: { gt: now }, ...REAL_SESSION }

  const [activeSessions, byType, fingerprints] = await Promise.all([
    prisma.userSession.count({ where }),
    prisma.userSession.groupBy({ by: ['deviceType'], where, _count: { _all: true } }),
    prisma.userSession.findMany({ where, select: { fingerprint: true } }),
  ])

  const activeDevices = new Set(fingerprints.map(f => f.fingerprint).filter(Boolean)).size

  return {
    activeSessions,
    activeDevices,
    byDeviceType: Object.fromEntries(byType.map(r => [r.deviceType ?? 'unknown', r._count._all])),
  }
}