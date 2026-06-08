// src/controllers/odata.controller.ts
// ─────────────────────────────────────────────
// OData v4 feed (token-authed via requireExportToken, which sets
// req.exportTenantId). Power BI / Tableau connect to the service root.
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import * as exportService from '../services/export.service'
import { apiBaseUrl } from './export.controller'

const tenantOf = (req: Request) => (req as Request & { exportTenantId?: string }).exportTenantId!

const odataBase = (req: Request) => `${apiBaseUrl(req)}/api/odata`

export const serviceDocument = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('OData-Version', '4.0')
  res.status(200).json(exportService.odataServiceDocument(odataBase(req)))
}

export const metadata = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('OData-Version', '4.0')
  res.setHeader('Content-Type', 'application/xml')
  res.status(200).send(exportService.odataMetadata())
}

export const collection = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await exportService.odataCollection(odataBase(req), req.params.entitySet as string, tenantOf(req))
    if (!result) {
      res.status(404).json({ error: 'Unknown entity set' })
      return
    }
    res.setHeader('OData-Version', '4.0')
    res.status(200).json(result)
  } catch {
    res.status(500).json({ error: 'Failed to load data' })
  }
}
