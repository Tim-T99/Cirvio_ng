// src/controllers/admin.controller.ts
// ─────────────────────────────────────────────
// ADMIN CONTROLLER
// Thin layer — validates input, calls service,
// returns response. No business logic here.
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import * as adminService from '../services/admin.service'
import { prisma } from '../prisma/client'
import { Emirate } from '@prisma/client'


// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const result = await adminService.loginAdmin(email, password, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })
    res.status(200).json(result)
  } catch (err) {
    const message = (err as Error).message
    if (message === 'Invalid credentials') {
      res.status(401).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = await adminService.getAdminById(req.admin!.adminId)
    res.status(200).json(admin)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (token) await adminService.logoutAdmin(token)
    res.status(200).json({ message: 'Logged out successfully' })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}


// ─────────────────────────────────────────────
// ADMIN MANAGEMENT
// ─────────────────────────────────────────────

export const createAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role } = req.body

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' })
      return
    }

    const admin = await adminService.createAdmin({ email, password, name, role })
    res.status(201).json(admin)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('already exists')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const listAdmins = async (_req: Request, res: Response): Promise<void> => {
  try {
    const admins = await adminService.listAdmins()
    res.status(200).json(admins)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updateAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.params.adminId as string
    const { name, role, isActive } = req.body

    const updated = await adminService.updateAdmin(adminId, { name, role, isActive })
    res.status(200).json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body
    const adminId = req.admin!.adminId

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new passwords are required' })
      return
    }

    await adminService.changeAdminPassword(adminId, currentPassword, newPassword)
    res.status(200).json({ message: 'Password changed successfully' })
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('incorrect')) {
      res.status(400).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}


// ─────────────────────────────────────────────
// TENANT OVERSIGHT
// ─────────────────────────────────────────────

export const listTenants = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search, page = '1', limit = '15' } = req.query
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.max(1, parseInt(limit as string) || 15)

    const raw = await adminService.listAllTenants({
      status: status as any,
      search: search as string,
    })

    const mapped = raw.map(t => ({
      id: t.id,
      companyName: (t as any).name,
      email: t.email,
      plan: t.plan?.name ?? 'N/A',
      status: t.status,
      employeeCount: (t as any)._count?.employees ?? null,
      userCount: (t as any)._count?.users ?? null,
      trialEndsAt: (t as any).trialEndsAt ?? null,
      createdAt: t.createdAt,
    }))

    const total = mapped.length
    const totalPages = Math.max(1, Math.ceil(total / limitNum))
    const paginated = mapped.slice((pageNum - 1) * limitNum, pageNum * limitNum)

    res.status(200).json({ tenants: paginated, total, page: pageNum, totalPages })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenant = await adminService.getTenantById(req.params.tenantId as string)
    res.status(200).json(tenant)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updateTenantDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, industry, emirate, tradelicenseNo, tradelicenseExpiry, trialEndsAt, subscriptionEndsAt } = req.body
    const updated = await adminService.updateTenantDetails(req.params.tenantId as string, {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(industry !== undefined && { industry: industry || null }),
      ...(emirate !== undefined && { emirate: emirate ? emirate as Emirate : null }),
      ...(tradelicenseNo !== undefined && { tradelicenseNo: tradelicenseNo || null }),
      ...(tradelicenseExpiry !== undefined && { tradelicenseExpiry: tradelicenseExpiry ? new Date(tradelicenseExpiry) : null }),
      ...(trialEndsAt !== undefined && { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null }),
      ...(subscriptionEndsAt !== undefined && { subscriptionEndsAt: subscriptionEndsAt ? new Date(subscriptionEndsAt) : null }),
    })
    res.status(200).json(updated)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) { res.status(404).json({ error: message }); return }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updateTenantStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.params.tenantId as string
    const { status, reason } = req.body
    const adminId = req.admin!.adminId

    if (!status) {
      res.status(400).json({ error: 'Status is required' })
      return
    }

    const updated = await adminService.updateTenantStatus(tenantId, status, adminId, reason)
    res.status(200).json(updated)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const changeTenantPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.params.tenantId as string
    const { planId } = req.body
    const adminId = req.admin!.adminId

    if (!planId) {
      res.status(400).json({ error: 'Plan ID is required' })
      return
    }

    const updated = await adminService.changeTenantPlan(tenantId, planId, adminId)
    res.status(200).json(updated)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}


// ─────────────────────────────────────────────
// PLANS
// ─────────────────────────────────────────────

export const listPlans = async (_req: Request, res: Response): Promise<void> => {
  try {
    const plans = await adminService.listPlans()
    res.status(200).json(plans)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const createPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, maxEmployees, maxAdmins, priceAed, billingCycleMonths } = req.body

    if (!name || !maxEmployees || !maxAdmins || !priceAed) {
      res.status(400).json({ error: 'name, maxEmployees, maxAdmins, and priceAed are required' })
      return
    }

    const plan = await adminService.createPlan({
      name, maxEmployees, maxAdmins, priceAed, billingCycleMonths,
    })
    res.status(201).json(plan)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updatePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await adminService.updatePlan(req.params.planId as string, req.body)
    res.status(200).json(updated)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}


// ─────────────────────────────────────────────
// AUDIT + STATS
// ─────────────────────────────────────────────

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { adminId, targetType, targetId, page = '1', limit = '20' } = req.query
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.max(1, parseInt(limit as string) || 20)

    const logs = await adminService.getAuditLogs({
      adminId: adminId as string,
      targetType: targetType as string,
      targetId: targetId as string,
    })

    const mapped = logs.map(l => ({
      id: l.id,
      action: l.action,
      actorEmail: (l as any).admin?.email ?? 'system',
      targetType: l.targetType ?? '',
      targetId: l.targetId ?? '',
      meta: l.meta as Record<string, unknown> | null,
      createdAt: l.createdAt,
    }))

    const total = mapped.length
    const totalPages = Math.max(1, Math.ceil(total / limitNum))
    const paginated = mapped.slice((pageNum - 1) * limitNum, pageNum * limitNum)

    res.status(200).json({ entries: paginated, total, page: pageNum, totalPages })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getPlatformStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await adminService.getPlatformStats()
    res.status(200).json(stats)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getMonitoring = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now   = new Date()
    const h24   = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const h1    = new Date(now.getTime() -      60 * 60 * 1000)

    const realSession = { expiresAt: { gt: now }, NOT: { userAgent: 'PASSWORD_RESET' } }

    const [
      activeUserSessions, activeAdminSessions,
      signupsToday, signupsLastHour,
      activeEmployees, totalEmployees,
      expiringVisas, expiredVisas, pendingWps,
      recentAudit, tenantsByStatus,
      sessionsByDevice, deviceFingerprints, recentNewDevices,
    ] = await Promise.all([
      prisma.userSession.count({ where: { expiresAt: { gt: now } } }),
      prisma.adminSession.count({ where: { expiresAt: { gt: now } } }),
      prisma.tenant.count({ where: { createdAt: { gte: h24 } } }),
      prisma.tenant.count({ where: { createdAt: { gte: h1  } } }),
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
      prisma.employee.count({}),
      prisma.visaRecord.count({ where: { status: 'EXPIRING_SOON' } }),
      prisma.visaRecord.count({ where: { status: 'EXPIRED' } }),
      prisma.wpsRecord.count({ where: { status: 'PENDING' } }),
      prisma.auditLog.findMany({
        take: 15, orderBy: { createdAt: 'desc' },
        include: { admin: { select: { email: true } } },
      }),
      prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.userSession.groupBy({ by: ['deviceType'], where: realSession, _count: { _all: true } }),
      prisma.userSession.findMany({ where: realSession, select: { fingerprint: true } }),
      prisma.userActivityLog.findMany({
        where: { action: 'NEW_DEVICE_LOGIN', createdAt: { gte: h24 } },
        take: 12, orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, firstName: true, lastName: true, tenant: { select: { name: true } } } } },
      }),
    ])

    const activeDevices = new Set(deviceFingerprints.map(f => f.fingerprint).filter(Boolean)).size

    res.status(200).json({
      timestamp: now.toISOString(),
      sessions: { activeUsers: activeUserSessions, activeAdmins: activeAdminSessions },
      devices: {
        active: activeDevices,
        byType: Object.fromEntries(sessionsByDevice.map(r => [r.deviceType ?? 'unknown', r._count._all])),
      },
      signups: { last24h: signupsToday, lastHour: signupsLastHour },
      workforce: { active: activeEmployees, total: totalEmployees },
      compliance: { expiringVisas, expiredVisas, pendingWps },
      tenantsByStatus: Object.fromEntries(tenantsByStatus.map(r => [r.status, r._count._all])),
      newDevices: recentNewDevices.map(l => ({
        id: l.id,
        user: `${(l as any).user?.firstName ?? ''} ${(l as any).user?.lastName ?? ''}`.trim() || (l as any).user?.email || 'Unknown',
        tenant: (l as any).user?.tenant?.name ?? '—',
        deviceName: (l.meta as any)?.deviceName ?? 'Unknown device',
        ipAddress: (l.meta as any)?.ipAddress ?? null,
        createdAt: l.createdAt,
      })),
      recentActivity: recentAudit.map(l => ({
        id: l.id, action: l.action,
        actor: (l as any).admin?.email ?? 'system',
        targetType: l.targetType, targetId: l.targetId,
        createdAt: l.createdAt,
      })),
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}


// ─────────────────────────────────────────────
// SESSIONS · DEVICES · ACCESS CONTROL
// ─────────────────────────────────────────────

const notFoundOr500 = (err: unknown, res: Response) => {
  const message = (err as Error).message
  if (message?.includes('not found')) { res.status(404).json({ error: message }); return }
  res.status(500).json({ error: 'Internal server error' })
}

export const getTenantUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await adminService.listTenantUsers(req.params.tenantId as string)
    res.status(200).json({ users })
  } catch (err) { notFoundOr500(err, res) }
}

export const getUserSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await adminService.listUserSessions(req.params.userId as string)
    res.status(200).json(data)
  } catch (err) { notFoundOr500(err, res) }
}

export const getActiveSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '25' } = req.query
    const data = await adminService.listActiveSessions({
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 25,
    })
    res.status(200).json(data)
  } catch { res.status(500).json({ error: 'Internal server error' }) }
}

export const getSessionStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await adminService.getSessionStats())
  } catch { res.status(500).json({ error: 'Internal server error' }) }
}

export const revokeSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await adminService.revokeSession(req.params.sessionId as string)
    await adminService.recordAudit(req.admin!.adminId, 'SESSION_REVOKED', 'UserSession', req.params.sessionId as string, { userId: result.userId })
    res.status(200).json(result)
  } catch (err) { notFoundOr500(err, res) }
}

export const revokeUserSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string
    const result = await adminService.revokeUserSessions(userId)
    await adminService.recordAudit(req.admin!.adminId, 'USER_SESSIONS_REVOKED', 'User', userId, { count: result.revoked })
    res.status(200).json(result)
  } catch (err) { notFoundOr500(err, res) }
}

export const setUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string
    const { isActive } = req.body as { isActive?: boolean }
    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive (boolean) is required' })
      return
    }
    const updated = await adminService.setUserActive(userId, isActive)
    await adminService.recordAudit(req.admin!.adminId, isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED', 'User', userId)
    res.status(200).json(updated)
  } catch (err) { notFoundOr500(err, res) }
}