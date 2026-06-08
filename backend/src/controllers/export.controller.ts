// src/controllers/export.controller.ts
// ─────────────────────────────────────────────
// EXPORT CONTROLLER (JWT-authed, behind paywall + data_export feature)
// Token management, in-app CSV download, and OData connection info.
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import * as exportService from '../services/export.service'
import { DATASETS, datasetByKey } from '../lib/export-datasets'

/** Public base URL of this API (honours a proxy or an explicit override). */
export function apiBaseUrl(req: Request): string {
  const override = process.env.PUBLIC_API_URL
  if (override) return override.replace(/\/+$/, '')
  return `${req.protocol}://${req.get('host')}`
}

export const listDatasets = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    odataUrl: `${apiBaseUrl(req)}/api/odata/`,
    datasets: DATASETS.map((d) => ({
      key: d.key,
      label: d.label,
      entitySet: d.entitySet,
      columns: d.columns.map((c) => c.name),
    })),
  })
}

export const downloadCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    const dataset = datasetByKey.get(req.params.dataset as string)
    if (!dataset) {
      res.status(404).json({ error: 'Unknown dataset' })
      return
    }
    const rows = await dataset.fetch(req.user!.tenantId)
    const csv = exportService.toCsv(dataset.columns, rows)
    const stamp = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="cirvio-${dataset.key}-${stamp}.csv"`)
    res.status(200).send(csv)
  } catch {
    res.status(500).json({ error: 'Failed to generate export' })
  }
}

export const listTokens = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await exportService.listTokens(req.user!.tenantId))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const createToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body
    const token = await exportService.createToken(req.user!.tenantId, req.user!.userId, name ?? '')
    res.status(201).json({ ...token, odataUrl: `${apiBaseUrl(req)}/api/odata/` })
  } catch {
    res.status(500).json({ error: 'Could not create token' })
  }
}

export const revokeToken = async (req: Request, res: Response): Promise<void> => {
  try {
    await exportService.revokeToken(req.user!.tenantId, req.params.tokenId as string)
    res.status(204).send()
  } catch (err) {
    if ((err as Error).message.includes('not found')) { res.status(404).json({ error: 'Token not found' }); return }
    res.status(500).json({ error: 'Internal server error' })
  }
}
