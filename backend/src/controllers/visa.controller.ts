// src/controllers/visa.controller.ts
// ─────────────────────────────────────────────
// VISA CONTROLLER
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import * as visaService from '../services/visa.service'


export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body.employeeId || !req.body.visaType || !req.body.expiryDate) {
      res.status(400).json({ error: 'employeeId, visaType, and expiryDate are required' })
      return
    }
    const visa = await visaService.createVisaRecord(
      req.user!.tenantId,
      req.user!.userId,
      { ...req.body, expiryDate: new Date(req.body.expiryDate) }
    )
    res.status(201).json(visa)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, status, visaType, emirate, expiringWithinDays, page, pageSize } = req.query
    const result = await visaService.listVisaRecords(req.user!.tenantId, {
      employeeId: employeeId as string,
      status: status as any,
      visaType: visaType as any,
      emirate: emirate as any,
      expiringWithinDays: expiringWithinDays ? parseInt(expiringWithinDays as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    })
    res.status(200).json(result)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    const visa = await visaService.getVisaRecordById(req.params.visaRecordId as string, req.user!.tenantId)
    res.status(200).json(visa)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = { ...req.body }
    if (data.expiryDate) data.expiryDate = new Date(data.expiryDate)
    const updated = await visaService.updateVisaRecord(
      req.params.visaRecordId as string,
      req.user!.tenantId,
      req.user!.userId,
      data
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

export const updateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, reason, renewalInitiatedAt, renewalCompletedAt } = req.body
    if (!status) {
      res.status(400).json({ error: 'Status is required' })
      return
    }
    const updated = await visaService.updateVisaStatus(
      req.params.visaRecordId as string,
      req.user!.tenantId,
      req.user!.userId,
      status,
      { reason, renewalInitiatedAt, renewalCompletedAt }
    )
    res.status(200).json(updated)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    if (message.includes('Invalid status transition')) {
      res.status(400).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getPendingAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, alertType, limit } = req.query
    const alerts = await visaService.getPendingAlerts(req.user!.tenantId, {
      employeeId: employeeId as string,
      alertType: alertType as any,
      limit: limit ? parseInt(limit as string) : undefined,
    })
    res.status(200).json(alerts)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const dismissAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await visaService.dismissAlert(
      req.params.alertId as string,
      req.user!.tenantId,
      req.user!.userId
    )
    res.status(200).json(updated)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    if (message.includes('already closed')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const summary = await visaService.getVisaDashboardSummary(req.user!.tenantId)
    res.status(200).json(summary)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}