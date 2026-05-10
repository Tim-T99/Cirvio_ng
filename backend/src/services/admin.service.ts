// src/services/admin.service.ts
// ─────────────────────────────────────────────
// ADMIN SERVICE
// Platform-level operations: SuperAdmin + Support
// No tenantId scoping — operates across all tenants
// ─────────────────────────────────────────────

import { prisma } from '../prisma/client'
import { AdminRole, TenantStatus } from '@prisma/client'
import { hashPassword, comparePassword, hashToken } from '../../utils/hash'
import { signToken } from '../../utils/jwt'


// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export const loginAdmin = async (
  email: string,
  password: string
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
    activeTenants,
    trialTenants,
    totalEmployees,
    totalUsers,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: 'ACTIVE' } }),
    prisma.tenant.count({ where: { status: 'TRIAL' } }),
    prisma.employee.count(),
    prisma.user.count(),
  ])

  return {
    totalTenants,
    activeTenants,
    trialTenants,
    totalEmployees,
    totalUsers,
  }
}