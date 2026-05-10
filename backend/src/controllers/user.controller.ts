// src/controllers/user.controller.ts
// ─────────────────────────────────────────────
// USER CONTROLLER
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import * as userService from '../services/user.service'
import { prisma } from '../prisma/client'


export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }
    const result = await userService.loginUser(
      email, password,
      req.ip,
      req.headers['user-agent']
    )
    res.status(200).json(result)
  } catch (err) {
    const message = (err as Error).message
    if (message === 'Invalid credentials') {
      res.status(401).json({ error: message })
      return
    }
    if (message.includes('suspended') || message.includes('cancelled')) {
      res.status(403).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (token) await userService.logoutUser(token)
    res.status(200).json({ message: 'Logged out successfully' })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const logoutAll = async (req: Request, res: Response): Promise<void> => {
  try {
    await userService.logoutAllSessions(req.user!.userId, req.user!.tenantId)
    res.status(200).json({ message: 'All sessions terminated' })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, tenantSlug } = req.body
    if (!email || !tenantSlug) {
      res.status(400).json({ error: 'Email and organisation slug are required' })
      return
    }
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    })
    if (!tenant) {
      // [S4] Don't reveal whether tenant exists
      res.status(200).json({ message: 'If that email exists, a reset link has been sent.' })
      return
    }
    const result = await userService.requestPasswordReset(email, tenant.id)
    // In production: send result.plainToken via email — never return in response
    res.status(200).json({ message: result.message })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.params.token as string
    const { newPassword } = req.body
    if (!newPassword) {
      res.status(400).json({ error: 'New password is required' })
      return
    }
    await userService.resetPassword(token, newPassword)
    res.status(200).json({ message: 'Password reset successfully. Please log in.' })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
}

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new passwords are required' })
      return
    }
    await userService.changePassword(
      req.user!.userId,
      req.user!.tenantId,
      currentPassword,
      newPassword
    )
    res.status(200).json({ message: 'Password changed. All sessions have been terminated.' })
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('incorrect')) {
      res.status(400).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await userService.getUserById(req.user!.userId, req.user!.tenantId)
    res.status(200).json(user)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updateMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone, avatarUrl } = req.body
    const updated = await userService.updateUserProfile(
      req.user!.userId,
      req.user!.tenantId,
      { firstName, lastName, phone, avatarUrl }
    )
    res.status(200).json(updated)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await userService.listUsers(req.user!.tenantId)
    res.status(200).json(users)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.body
    if (!role) {
      res.status(400).json({ error: 'Role is required' })
      return
    }
    const updated = await userService.updateUserRole(
      req.params.userId as string,
      req.user!.tenantId,
      role,
      req.user!.userId
    )
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

export const deactivateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    await userService.deactivateUser(
      req.params.userId as string,
      req.user!.tenantId,
      req.user!.userId
    )
    res.status(200).json({ message: 'User deactivated' })
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    if (message.includes('own account')) {
      res.status(400).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const reactivateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    await userService.reactivateUser(
      req.params.userId as string,
      req.user!.tenantId,
      req.user!.userId
    )
    res.status(200).json({ message: 'User reactivated' })
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getActivityLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, action, limit } = req.query
    const logs = await userService.getUserActivityLogs(req.user!.tenantId, {
      userId: userId as string,
      action: action as string,
      limit: limit ? parseInt(limit as string) : undefined,
    })
    res.status(200).json(logs)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}