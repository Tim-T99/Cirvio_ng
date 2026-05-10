// src/controllers/document.controller.ts
// ─────────────────────────────────────────────
// DOCUMENT CONTROLLER
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import * as documentService from '../services/document.service'


export const getUploadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, fileName, mimeType, fileSizeKb } = req.body
    if (!employeeId || !fileName || !mimeType || !fileSizeKb) {
      res.status(400).json({ error: 'employeeId, fileName, mimeType, and fileSizeKb are required' })
      return
    }
    const result = await documentService.getPresignedUploadUrl(
      req.user!.tenantId,
      employeeId,
      fileName,
      mimeType,
      fileSizeKb
    )
    res.status(200).json(result)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    if (message.includes('not allowed') || message.includes('size')) {
      res.status(400).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, documentType, fileName, fileUrl, mimeType, fileSizeKb } = req.body
    if (!employeeId || !documentType || !fileName || !fileUrl || !mimeType || !fileSizeKb) {
      res.status(400).json({
        error: 'employeeId, documentType, fileName, fileUrl, mimeType, and fileSizeKb are required',
      })
      return
    }
    const document = await documentService.createDocument(
      req.user!.tenantId,
      req.user!.userId,
      req.body
    )
    res.status(201).json(document)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    if (message.includes('not allowed') || message.includes('Invalid file')) {
      res.status(400).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, visaRecordId, documentType, expiringWithinDays, page, pageSize } = req.query
    const result = await documentService.listDocuments(req.user!.tenantId, {
      employeeId: employeeId as string,
      visaRecordId: visaRecordId as string,
      documentType: documentType as any,
      expiringWithinDays: expiringWithinDays ? parseInt(expiringWithinDays as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    })
    res.status(200).json(result)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getDownloadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await documentService.getPresignedDownloadUrl(
      req.params.documentId as string,
      req.user!.tenantId
    )
    res.status(200).json(result)
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
    const updated = await documentService.updateDocument(
      req.params.documentId as string,
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
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await documentService.deleteDocument(
      req.params.documentId as string,
      req.user!.tenantId,
      req.user!.userId
    )
    // Caller should trigger bucket deletion using result.fileUrl
    res.status(200).json({ message: 'Document deleted', ...result })
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getExpiring = async (req: Request, res: Response): Promise<void> => {
  try {
    const withinDays = req.query.withinDays ? parseInt(req.query.withinDays as string) : 90
    const documents = await documentService.getExpiringDocuments(req.user!.tenantId, withinDays)
    res.status(200).json(documents)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getEmployeeSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const summary = await documentService.getEmployeeDocumentSummary(
      req.params.employeeId as string,
      req.user!.tenantId
    )
    res.status(200).json(summary)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}