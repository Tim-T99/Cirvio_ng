// src/services/user.service.ts
// ─────────────────────────────────────────────
// USER SERVICE
// Manages users within a tenant
// Authentication, profile, role, session mgmt
// ─────────────────────────────────────────────

import { prisma } from '../prisma/client'
import { UserRole } from '@prisma/client'
import { hashPassword, comparePassword, hashToken } from '../../utils/hash'
import { signToken } from '../../utils/jwt'
import crypto from 'crypto'


// ─────────────────────────────────────────────
// SECURITY NOTES
// [S1] Tokens (password reset, session) are
//      stored as SHA-256 hashes only.
//      Plaintext returned once, never stored.
// [S2] All queries scoped to tenantId from
//      verified JWT — never from request body.
// [S3] passwordHash never returned in selects.
// [S4] Login uses constant-time comparison to
//      prevent user enumeration via timing.
// [S5] Password reset invalidates all active
//      sessions immediately.
// [S6] Role changes are logged in UserActivityLog
//      and restricted to TENANT_ADMIN only
//      (enforced at middleware layer).
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// SAFE USER SELECT
// Reusable — passwordHash never leaves service
// ─────────────────────────────────────────────

const safeUserSelect = {
  id: true,
  tenantId: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  employeeId: true,
  createdAt: true,
  updatedAt: true,
} as const


// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export const loginUser = async (
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
) => {
  // [S4] Always fetch user and run comparePassword
  // even if not found — prevents timing-based
  // user enumeration attacks
  const user = await prisma.user.findFirst({
    where: { email },
    include: {
      tenant: {
        select: { id: true, name: true, status: true, slug: true },
      },
    },
  })

  // [S4] Run comparison regardless to keep timing consistent
  const dummyHash = '$2b$12$invalidhashfortimingnormalization000000000000000000000'
  const valid = await comparePassword(
    password,
    user?.passwordHash ?? dummyHash
  )

  if (!user || !valid || !user.isActive) {
    throw new Error('Invalid credentials')
  }

  // [S2] Check tenant is still active
  if (user.tenant.status === 'SUSPENDED') {
    throw new Error('Your organisation account has been suspended. Please contact support.')
  }

  if (user.tenant.status === 'CANCELLED') {
    throw new Error('Your organisation account has been cancelled. Please contact support.')
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const token = signToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  })

  // [S1] Store hashed session token only
  const hashedToken = hashToken(token)

  await prisma.userSession.create({
    data: {
      userId: user.id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8), // 8 hours
      ipAddress,
      userAgent,
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
      tenantId: user.tenantId,
      tenant: user.tenant,
    },
  }
}

export const logoutUser = async (token: string) => {
  // [S1] Hash before lookup
  const hashedToken = hashToken(token)

  await prisma.userSession.deleteMany({
    where: { token: hashedToken },
  })
}

export const logoutAllSessions = async (
  userId: string,
  tenantId: string
) => {
  // [S2] Verify user belongs to tenant before wiping sessions
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  })

  if (!user) throw new Error('User not found')

  await prisma.userSession.deleteMany({
    where: { userId },
  })
}


// ─────────────────────────────────────────────
// PASSWORD RESET
// Token-based — never sent as plain in DB
// ─────────────────────────────────────────────

export const requestPasswordReset = async (
  email: string,
  tenantId: string
) => {
  // [S2] Scoped to tenant
  const user = await prisma.user.findFirst({
    where: { email, tenantId },
    select: { id: true, email: true, firstName: true },
  })

  // [S4] Always return success — prevents email enumeration
  if (!user) return { message: 'If that email exists, a reset link has been sent.' }

  // [S1] Generate secure token, store only hash
  const plainToken = crypto.randomBytes(32).toString('hex')
  const hashedToken = hashToken(plainToken)

  // Store as a session record with short expiry
  // In production: store in a dedicated PasswordResetToken table
  // For now reusing UserSession with a reset flag in userAgent field
  await prisma.userSession.create({
    data: {
      userId: user.id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour only
      userAgent: 'PASSWORD_RESET',
    },
  })

  // Return plainToken — caller (controller) sends this via email
  // Never log or persist this value
  return {
    plainToken,
    email: user.email,
    firstName: user.firstName,
    message: 'If that email exists, a reset link has been sent.',
  }
}

export const resetPassword = async (
  plainToken: string,
  newPassword: string
) => {
  // [S1] Hash before lookup
  const hashedToken = hashToken(plainToken)

  const session = await prisma.userSession.findFirst({
    where: {
      token: hashedToken,
      userAgent: 'PASSWORD_RESET',
      expiresAt: { gt: new Date() },
    },
  })

  if (!session) throw new Error('Invalid or expired reset link')

  const passwordHash = await hashPassword(newPassword)

  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash },
  })

  // [S5] Invalidate ALL sessions including the reset token
  await prisma.userSession.deleteMany({
    where: { userId: session.userId },
  })
}

export const changePassword = async (
  userId: string,
  tenantId: string,
  currentPassword: string,
  newPassword: string
) => {
  // [S2] Scoped to tenant
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  })

  if (!user) throw new Error('User not found')

  const valid = await comparePassword(currentPassword, user.passwordHash)
  if (!valid) throw new Error('Current password is incorrect')

  const passwordHash = await hashPassword(newPassword)

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  })

  // [S5] Invalidate all sessions on password change
  await prisma.userSession.deleteMany({
    where: { userId },
  })
}


// ─────────────────────────────────────────────
// USER PROFILE
// ─────────────────────────────────────────────

export const getUserById = async (
  userId: string,
  tenantId: string
) => {
  // [S2] Scoped to tenant
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      ...safeUserSelect,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          department: { select: { name: true } },
        },
      },
    },
  })

  if (!user) throw new Error('User not found')
  return user
}

export const updateUserProfile = async (
  userId: string,
  tenantId: string,
  data: Partial<{
    firstName: string
    lastName: string
    phone: string
    avatarUrl: string
  }>
) => {
  // [S2] Scoped to tenant — user cannot update another tenant's user
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  })

  if (!user) throw new Error('User not found')

  return prisma.user.update({
    where: { id: userId },
    data,
    select: safeUserSelect,
  })
}


// ─────────────────────────────────────────────
// USER MANAGEMENT
// TENANT_ADMIN operations only
// Enforced at middleware — noted here for clarity
// ─────────────────────────────────────────────

export const listUsers = async (tenantId: string) => {
  // [S2] Scoped to tenant
  return prisma.user.findMany({
    where: { tenantId },
    select: safeUserSelect,
    orderBy: { createdAt: 'desc' },
  })
}

export const updateUserRole = async (
  targetUserId: string,
  tenantId: string,
  newRole: UserRole,
  performedBy: string
) => {
  // [S2] Verify target user belongs to same tenant
  const targetUser = await prisma.user.findFirst({
    where: { id: targetUserId, tenantId },
    select: { id: true, role: true, email: true },
  })

  if (!targetUser) throw new Error('User not found')

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
    select: safeUserSelect,
  })

  // [S6] Log role change with full context
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'USER_ROLE_CHANGED',
      targetType: 'User',
      targetId: targetUserId,
      meta: {
        previousRole: targetUser.role,
        newRole,
        targetEmail: targetUser.email,
      },
    },
  })

  return updated
}

export const deactivateUser = async (
  targetUserId: string,
  tenantId: string,
  performedBy: string
) => {
  // [S2] Scoped to tenant
  const targetUser = await prisma.user.findFirst({
    where: { id: targetUserId, tenantId },
    select: { id: true, email: true },
  })

  if (!targetUser) throw new Error('User not found')

  // Prevent self-deactivation
  if (targetUserId === performedBy) {
    throw new Error('You cannot deactivate your own account')
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: false },
  })

  // [S5] Kill all active sessions immediately
  await prisma.userSession.deleteMany({
    where: { userId: targetUserId },
  })

  // [S6] Log deactivation
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'USER_DEACTIVATED',
      targetType: 'User',
      targetId: targetUserId,
      meta: { targetEmail: targetUser.email },
    },
  })
}

export const reactivateUser = async (
  targetUserId: string,
  tenantId: string,
  performedBy: string
) => {
  // [S2] Scoped to tenant
  const targetUser = await prisma.user.findFirst({
    where: { id: targetUserId, tenantId },
    select: { id: true, email: true },
  })

  if (!targetUser) throw new Error('User not found')

  await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: true },
  })

  // [S6] Log reactivation
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'USER_REACTIVATED',
      targetType: 'User',
      targetId: targetUserId,
      meta: { targetEmail: targetUser.email },
    },
  })
}


// ─────────────────────────────────────────────
// ACTIVITY LOGS
// Tenant-scoped user action trail
// ─────────────────────────────────────────────

export const getUserActivityLogs = async (
  tenantId: string,
  filters?: {
    userId?: string
    action?: string
    limit?: number
  }
) => {
  // [S2] Verify requested userId belongs to this tenant
  if (filters?.userId) {
    const userExists = await prisma.user.findFirst({
      where: { id: filters.userId, tenantId },
      select: { id: true },
    })
    if (!userExists) throw new Error('User not found')
  }

  return prisma.userActivityLog.findMany({
    where: {
      user: { tenantId },
      ...(filters?.userId && { userId: filters.userId }),
      ...(filters?.action && { action: filters.action }),
    },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 100,
  })
}