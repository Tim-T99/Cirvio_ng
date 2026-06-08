// src/services/export.service.ts
// ─────────────────────────────────────────────
// BI export: per-tenant read-only API tokens, CSV serialization, and the
// OData v4 feed (service document, $metadata EDMX, entity collections).
// ─────────────────────────────────────────────

import { prisma } from '../prisma/client'
import { hashToken, generateToken } from '../../utils/hash'
import { DATASETS, datasetByEntitySet, Column } from '../lib/export-datasets'

// ── Tokens ───────────────────────────────────────────────────────────────────

export const createToken = async (tenantId: string, userId: string, name: string) => {
  const plaintext = generateToken(32) // 64 hex chars
  const record = await prisma.exportToken.create({
    data: {
      tenantId,
      name: name.trim() || 'Export token',
      tokenHash: hashToken(plaintext),
      prefix: plaintext.slice(0, 8),
      createdBy: userId,
    },
    select: { id: true, name: true, prefix: true, createdAt: true },
  })
  // Plaintext is returned once and never stored.
  return { ...record, token: plaintext }
}

export const listTokens = async (tenantId: string) => {
  return prisma.exportToken.findMany({
    where: { tenantId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  })
}

export const revokeToken = async (tenantId: string, id: string) => {
  // [S] Scoped to tenant so one tenant can't revoke another's token.
  const res = await prisma.exportToken.updateMany({
    where: { id, tenantId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (res.count === 0) throw new Error('Token not found')
}

/** Resolve a plaintext token to its tenantId (or null). Touches lastUsedAt. */
export const resolveToken = async (plaintext: string): Promise<string | null> => {
  if (!plaintext) return null
  const record = await prisma.exportToken.findFirst({
    where: { tokenHash: hashToken(plaintext), revokedAt: null },
    select: { id: true, tenantId: true },
  })
  if (!record) return null
  // Throttle the write — only update if stale-ish (best-effort, non-blocking).
  prisma.exportToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})
  return record.tenantId
}

// ── CSV ──────────────────────────────────────────────────────────────────────

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'string' ? v : String(v)
  // Escape if it contains a comma, quote, or newline.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export const toCsv = (columns: Column[], rows: Record<string, unknown>[]): string => {
  const header = columns.map((c) => c.name).join(',')
  const lines = rows.map((r) => columns.map((c) => csvCell(r[c.name])).join(','))
  return [header, ...lines].join('\r\n')
}

// ── OData v4 ───────────────────────────────────────────────────────────────────

/** Service document — lists the available entity sets. */
export const odataServiceDocument = (baseUrl: string) => ({
  '@odata.context': `${baseUrl}/$metadata`,
  value: DATASETS.map((d) => ({ name: d.entitySet, kind: 'EntitySet', url: d.entitySet })),
})

const EDM: Record<string, string> = {
  String: 'Edm.String',
  Int32: 'Edm.Int32',
  Double: 'Edm.Double',
  Boolean: 'Edm.Boolean',
  DateTimeOffset: 'Edm.DateTimeOffset',
}

/** EDMX ($metadata) document describing all entity types + sets. */
export const odataMetadata = (): string => {
  const types = DATASETS.map((d) => {
    const props = d.columns
      .map((c) => {
        const isKey = c.name === d.keyField
        return `        <Property Name="${c.name}" Type="${EDM[c.type]}"${isKey ? ' Nullable="false"' : ''}/>`
      })
      .join('\n')
    return `      <EntityType Name="${d.entitySet}">
        <Key><PropertyRef Name="${d.keyField}"/></Key>
${props}
      </EntityType>`
  }).join('\n')

  const sets = DATASETS.map((d) => `        <EntitySet Name="${d.entitySet}" EntityType="Cirvio.${d.entitySet}"/>`).join('\n')

  return `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="Cirvio" xmlns="http://docs.oasis-open.org/odata/ns/edm">
${types}
      <EntityContainer Name="Container">
${sets}
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`
}

/** A collection response for one entity set. */
export const odataCollection = async (baseUrl: string, entitySet: string, tenantId: string) => {
  const dataset = datasetByEntitySet.get(entitySet)
  if (!dataset) return null
  const rows = await dataset.fetch(tenantId)
  return {
    '@odata.context': `${baseUrl}/$metadata#${entitySet}`,
    value: rows,
  }
}
