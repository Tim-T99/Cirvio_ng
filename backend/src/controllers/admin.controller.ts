// src/controllers/admin.controller.ts
// ─────────────────────────────────────────────
// ADMIN CONTROLLER
// Thin layer — validates input, calls service,
// returns response. No business logic here.
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import * as adminService from '../services/admin.service'


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

    const result = await adminService.loginAdmin(email, password)
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
    const { status, search } = req.query
    const tenants = await adminService.listAllTenants({
      status: status as any,
      search: search as string,
    })
    res.status(200).json(tenants)
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
    const { adminId, targetType, targetId, limit } = req.query
    const logs = await adminService.getAuditLogs({
      adminId: adminId as string,
      targetType: targetType as string,
      targetId: targetId as string,
      limit: limit ? parseInt(limit as string) : undefined,
    })
    res.status(200).json(logs)
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