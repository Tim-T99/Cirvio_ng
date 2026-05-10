// src/controllers/tenant.controller.ts
// ─────────────────────────────────────────────
// TENANT CONTROLLER
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import * as tenantService from '../services/tenant.service'


export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationName, firstName, lastName, email, password } = req.body
    if (!organizationName || !firstName || !lastName || !email || !password) {
      res.status(400).json({ error: 'All fields are required' })
      return
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
      return
    }
    if (!/\d/.test(password)) {
      res.status(400).json({ error: 'Password must contain a number' })
      return
    }
    const result = await tenantService.registerTenant({ organizationName, firstName, lastName, email, password })
    res.status(201).json(result)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('already exists')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenant = await tenantService.getTenantProfile(req.user!.tenantId)
    res.status(200).json(tenant)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await tenantService.updateTenantProfile(req.user!.tenantId, req.body)
    res.status(200).json(updated)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await tenantService.getTenantStats(req.user!.tenantId)
    res.status(200).json(stats)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const createInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, role } = req.body
    if (!email || !role) {
      res.status(400).json({ error: 'Email and role are required' })
      return
    }
    const result = await tenantService.createInvite(req.user!.tenantId, { email, role })
    res.status(201).json({
      message: 'Invite created. Send the token to the user via email.',
      email: result.email,
      role: result.role,
      // plainToken returned here — controller sends via email in production
      // never log or store this value
      inviteToken: result.plainToken,
    })
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('already exists') || message.includes('limit')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const listInvites = async (req: Request, res: Response): Promise<void> => {
  try {
    const invites = await tenantService.listInvites(req.user!.tenantId)
    res.status(200).json(invites)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const revokeInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    await tenantService.revokeInvite(req.user!.tenantId, req.params.inviteId as string)
    res.status(200).json({ message: 'Invite revoked' })
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const validateInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.params.token as string
    const invite = await tenantService.validateInvite(token)
    res.status(200).json({
      email: invite.email,
      role: invite.role,
      tenant: invite.tenant,
    })
  } catch (err) {
    const message = (err as Error).message
    res.status(400).json({ error: message })
  }
}

export const acceptInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.params.token as string
    const { firstName, lastName, password } = req.body

    if (!firstName || !lastName || !password) {
      res.status(400).json({ error: 'firstName, lastName, and password are required' })
      return
    }

    const user = await tenantService.acceptInvite(token, { firstName, lastName, password })
    res.status(201).json({ message: 'Account created. You may now log in.', user })
  } catch (err) {
    const message = (err as Error).message
    res.status(400).json({ error: message })
  }
}