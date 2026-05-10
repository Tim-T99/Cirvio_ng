// src/controllers/wps.controller.ts
// ─────────────────────────────────────────────
// WPS CONTROLLER
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import * as wpsService from '../services/wps.service'


export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, month, year, basicSalary } = req.body
    if (!employeeId || !month || !year || !basicSalary) {
      res.status(400).json({ error: 'employeeId, month, year, and basicSalary are required' })
      return
    }
    const record = await wpsService.createWpsRecord(
      req.user!.tenantId,
      req.user!.userId,
      req.body
    )
    res.status(201).json(record)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('already exists') || message.includes('limit')) {
      res.status(409).json({ error: message })
      return
    }
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const bulkCreate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year, overrides } = req.body
    if (!month || !year) {
      res.status(400).json({ error: 'month and year are required' })
      return
    }
    const results = await wpsService.bulkCreateWpsRecords(
      req.user!.tenantId,
      req.user!.userId,
      month,
      year,
      overrides
    )
    res.status(201).json(results)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('already')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year, employeeId, status, isLate, page, pageSize } = req.query
    const result = await wpsService.listWpsRecords(req.user!.tenantId, {
      month: month ? parseInt(month as string) : undefined,
      year: year ? parseInt(year as string) : undefined,
      employeeId: employeeId as string,
      status: status as any,
      isLate: isLate === 'true' ? true : isLate === 'false' ? false : undefined,
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
    const record = await wpsService.getWpsRecordById(req.params.wpsRecordId as string, req.user!.tenantId)
    res.status(200).json(record)
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
    const updated = await wpsService.updateWpsRecord(
      req.params.wpsRecordId as string,
      req.user!.tenantId,
      req.user!.userId,
      req.body
    )
    res.status(200).json(updated)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    if (message.includes('confirmed')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const recordViolation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { violationRef } = req.body
    if (!violationRef) {
      res.status(400).json({ error: 'violationRef is required' })
      return
    }
    const updated = await wpsService.recordViolation(
      req.params.wpsRecordId as string,
      req.user!.tenantId,
      req.user!.userId,
      violationRef
    )
    res.status(200).json(updated)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    if (message.includes('already exists')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const generateSif = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year } = req.body
    if (!month || !year) {
      res.status(400).json({ error: 'month and year are required' })
      return
    }
    const result = await wpsService.generateSifFile(
      req.user!.tenantId,
      req.user!.userId,
      month,
      year
    )
    res.status(200).json({
      sifFile: result.sifFile,
      // Return SIF content as downloadable text
      sifContent: result.sifContent,
    })
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('No WPS records')) {
      res.status(400).json({ error: message })
      return
    }
    if (message.includes('already exists')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const submitSif = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await wpsService.submitSifFile(
      req.params.sifFileId as string,
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
    if (message.includes('status')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const confirmSif = async (req: Request, res: Response): Promise<void> => {
  try {
    const { silaReference } = req.body
    const updated = await wpsService.confirmSifFile(
      req.params.sifFileId as string,
      req.user!.tenantId,
      req.user!.userId,
      silaReference
    )
    res.status(200).json(updated)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    if (message.includes('status')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const year = req.query.year
      ? parseInt(req.query.year as string)
      : new Date().getFullYear()
    const summary = await wpsService.getWpsDashboardSummary(req.user!.tenantId, year)
    res.status(200).json(summary)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}