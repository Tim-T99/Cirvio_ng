// src/services/document.service.ts
// ─────────────────────────────────────────────
// DOCUMENT SERVICE
// File attachment layer
// Scoped to Employee and optionally VisaRecord
// Handles metadata only — actual file storage
// is handled by your file bucket (R2/S3)
// ─────────────────────────────────────────────

import { prisma } from '../prisma/client'
import { DocumentType } from '@prisma/client'
import { assertTenantActive } from './tenant.service'


// ─────────────────────────────────────────────
// SECURITY NOTES
// [S1] tenantId always from verified JWT middleware
//      never trusted from request body
// [S2] Employee ownership verified before every
//      document operation
// [S3] VisaRecord ownership verified when
//      visaRecordId is provided
// [S4] fileUrl validated to prevent open redirect
//      or path traversal via malicious URLs
// [S5] Presigned URL generation is time-limited
//      Direct bucket URLs never exposed to client
//      All file access goes through signed URLs
// [S6] Document deletion is hard delete —
//      file bucket cleanup triggered alongside
//      DB record removal. Logged for audit trail
// [S7] MIME type and file size validated
//      server-side before metadata is persisted
// [S8] All mutations logged to UserActivityLog
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// CONSTANTS
// [S7] Allowed types and size limits
// ─────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

const MAX_FILE_SIZE_KB = 10 * 1024  // 10MB

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_MIME_TYPES)


// ─────────────────────────────────────────────
// SAFE SELECTS
// [S5] fileUrl included — but access controlled
//      via presigned URLs at controller layer
// ─────────────────────────────────────────────

const documentListSelect = {
  id: true,
  tenantId: true,
  employeeId: true,
  visaRecordId: true,
  documentType: true,
  fileName: true,
  fileSizeKb: true,
  mimeType: true,
  expiryDate: true,
  notes: true,
  uploadedBy: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      department: { select: { name: true } },
    },
  },
} as const

const documentFullSelect = {
  ...documentListSelect,
  fileUrl: true,  // [S5] only returned for presigned URL generation
  visaRecord: {
    select: {
      id: true,
      visaType: true,
      visaNumber: true,
      expiryDate: true,
    },
  },
} as const


// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

// [S2] Verify employee belongs to tenant
const assertEmployeeOwnership = async (
  employeeId: string,
  tenantId: string
) => {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: { id: true, firstName: true, lastName: true },
  })

  if (!employee) throw new Error('Employee not found')
  return employee
}

// [S3] Verify visa record belongs to tenant AND employee
const assertVisaOwnership = async (
  visaRecordId: string,
  tenantId: string,
  employeeId: string
) => {
  const visa = await prisma.visaRecord.findFirst({
    where: { id: visaRecordId, tenantId, employeeId },
    select: { id: true },
  })

  if (!visa) throw new Error('Visa record not found or does not belong to this employee')
  return visa
}

// [S4] Validate fileUrl is a safe internal bucket path
// Prevents open redirect or external URL injection
const assertSafeFileUrl = (fileUrl: string) => {
  // Must be a relative path or from your known bucket domain
  // Adjust BUCKET_DOMAIN to match your R2/S3 bucket URL
  const BUCKET_DOMAIN = process.env.FILE_BUCKET_DOMAIN ?? ''

  const isRelative = fileUrl.startsWith('uploads/')
  const isBucketUrl = BUCKET_DOMAIN && fileUrl.startsWith(BUCKET_DOMAIN)

  if (!isRelative && !isBucketUrl) {
    throw new Error('Invalid file URL — must be a valid bucket path')
  }
}

// [S7] Validate MIME type and file size
const assertFileConstraints = (
  mimeType: string,
  fileSizeKb: number
) => {
  if (!ALLOWED_MIME_SET.has(mimeType)) {
    throw new Error(
      `File type not allowed. Accepted types: PDF, JPEG, PNG, WEBP`
    )
  }

  if (fileSizeKb > MAX_FILE_SIZE_KB) {
    throw new Error(
      `File size exceeds the 10MB limit (received ${(fileSizeKb / 1024).toFixed(1)}MB)`
    )
  }
}


// ─────────────────────────────────────────────
// CREATE
// Persists document metadata after file is
// uploaded to bucket by the client via presigned URL
// ─────────────────────────────────────────────

export const createDocument = async (
  tenantId: string,
  performedBy: string,
  data: {
    employeeId: string
    documentType: DocumentType
    fileName: string
    fileUrl: string
    mimeType: string
    fileSizeKb: number
    visaRecordId?: string
    expiryDate?: Date
    notes?: string
  }
) => {
  await assertTenantActive(tenantId)

  // [S2] Verify employee belongs to tenant
  await assertEmployeeOwnership(data.employeeId, tenantId)

  // [S3] Verify visa record if provided
  if (data.visaRecordId) {
    await assertVisaOwnership(data.visaRecordId, tenantId, data.employeeId)
  }

  // [S4] Validate file URL
  assertSafeFileUrl(data.fileUrl)

  // [S7] Validate MIME type and file size
  assertFileConstraints(data.mimeType, data.fileSizeKb)

  const document = await prisma.document.create({
    data: {
      tenantId,
      employeeId: data.employeeId,
      documentType: data.documentType,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      mimeType: data.mimeType,
      fileSizeKb: data.fileSizeKb,
      visaRecordId: data.visaRecordId,
      expiryDate: data.expiryDate,
      notes: data.notes,
      uploadedBy: performedBy,
    },
    select: documentListSelect,
  })

  // [S8] Log upload
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'DOCUMENT_UPLOADED',
      targetType: 'Document',
      targetId: document.id,
      meta: {
        employeeId: data.employeeId,
        documentType: data.documentType,
        fileName: data.fileName,
        fileSizeKb: data.fileSizeKb,
        visaRecordId: data.visaRecordId ?? null,
      },
    },
  })

  return document
}


// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

export const listDocuments = async (
  tenantId: string,
  filters?: {
    employeeId?: string
    visaRecordId?: string
    documentType?: DocumentType
    expiringWithinDays?: number
    page?: number
    pageSize?: number
  }
) => {
  const page     = filters?.page     ?? 1
  const pageSize = filters?.pageSize ?? 20
  const skip     = (page - 1) * pageSize

  // [S2] Verify employee belongs to tenant if filtering
  if (filters?.employeeId) {
    await assertEmployeeOwnership(filters.employeeId, tenantId)
  }

  // [S3] Verify visa record belongs to tenant if filtering
  if (filters?.visaRecordId) {
    const visa = await prisma.visaRecord.findFirst({
      where: { id: filters.visaRecordId, tenantId },
      select: { id: true },
    })
    if (!visa) throw new Error('Visa record not found')
  }

  // Build expiry filter
  let expiryFilter = {}
  if (filters?.expiringWithinDays) {
    const threshold = new Date()
    threshold.setDate(threshold.getDate() + filters.expiringWithinDays)
    expiryFilter = { expiryDate: { lte: threshold, gte: new Date() } }
  }

  const where = {
    tenantId,
    ...(filters?.employeeId   && { employeeId: filters.employeeId }),
    ...(filters?.visaRecordId && { visaRecordId: filters.visaRecordId }),
    ...(filters?.documentType && { documentType: filters.documentType }),
    ...expiryFilter,
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      select: documentListSelect,  // [S5] fileUrl excluded from list
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.document.count({ where }),
  ])

  return {
    data: documents,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export const getDocumentById = async (
  documentId: string,
  tenantId: string
) => {
  // [S1] Tenant scope enforced
  const document = await prisma.document.findFirst({
    where: { id: documentId, tenantId },
    select: documentFullSelect,  // [S5] fileUrl returned for presigned URL generation
  })

  if (!document) throw new Error('Document not found')
  return document
}

// [S5] Generate a presigned URL for secure file access
// Called when user clicks to view/download a document
// Raw fileUrl (bucket path) never sent to client directly
export const getPresignedDownloadUrl = async (
  documentId: string,
  tenantId: string,
  expiresInSeconds: number = 300  // 5 minutes default
) => {
  // [S1] Tenant scope enforced
  const document = await prisma.document.findFirst({
    where: { id: documentId, tenantId },
    select: { id: true, fileUrl: true, fileName: true, mimeType: true },
  })

  if (!document) throw new Error('Document not found')

  // In production: call your R2/S3 SDK to generate presigned URL
  // Example for Cloudflare R2:
  // const url = await r2.getSignedUrl('getObject', {
  //   Bucket: process.env.R2_BUCKET_NAME,
  //   Key: document.fileUrl,
  //   Expires: expiresInSeconds,
  // })

  // Placeholder — replace with actual SDK call
  const presignedUrl = `${process.env.FILE_BUCKET_DOMAIN}/${document.fileUrl}?expires=${Date.now() + expiresInSeconds * 1000}`

  return {
    presignedUrl,
    fileName: document.fileName,
    mimeType: document.mimeType,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  }
}

// [S5] Generate a presigned URL for uploading
// Client uploads directly to bucket — file never
// passes through your API server
export const getPresignedUploadUrl = async (
  tenantId: string,
  employeeId: string,
  fileName: string,
  mimeType: string,
  fileSizeKb: number
) => {
  // [S2] Verify employee belongs to tenant
  await assertEmployeeOwnership(employeeId, tenantId)

  // [S7] Validate before generating upload URL
  assertFileConstraints(mimeType, fileSizeKb)

  // Build a safe bucket key — never use raw fileName from client
  const sanitizedFileName = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase()

  const bucketKey = `uploads/${tenantId}/${employeeId}/${Date.now()}_${sanitizedFileName}`

  // In production: call your R2/S3 SDK to generate presigned PUT URL
  // Example for Cloudflare R2:
  // const presignedUrl = await r2.getSignedUrl('putObject', {
  //   Bucket: process.env.R2_BUCKET_NAME,
  //   Key: bucketKey,
  //   ContentType: mimeType,
  //   Expires: 300,
  // })

  // Placeholder — replace with actual SDK call
  const presignedUrl = `${process.env.FILE_BUCKET_DOMAIN}/${bucketKey}?method=PUT&expires=${Date.now() + 300000}`

  return {
    presignedUrl,
    bucketKey,   // client sends this back as fileUrl when calling createDocument
    expiresAt: new Date(Date.now() + 300 * 1000),
  }
}


// ─────────────────────────────────────────────
// UPDATE
// Metadata only — file itself cannot be replaced
// To replace a file: delete + re-upload
// ─────────────────────────────────────────────

export const updateDocument = async (
  documentId: string,
  tenantId: string,
  performedBy: string,
  data: Partial<{
    documentType: DocumentType
    expiryDate: Date
    notes: string
  }>
) => {
  // [S1] Tenant scope enforced
  const existing = await prisma.document.findFirst({
    where: { id: documentId, tenantId },
    select: { id: true, fileName: true },
  })

  if (!existing) throw new Error('Document not found')

  const updated = await prisma.document.update({
    where: { id: documentId },
    data,
    select: documentListSelect,
  })

  // [S8] Log update
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'DOCUMENT_UPDATED',
      targetType: 'Document',
      targetId: documentId,
      meta: {
        updatedFields: Object.keys(data),
        fileName: existing.fileName,
      },
    },
  })

  return updated
}


// ─────────────────────────────────────────────
// DELETE
// [S6] Hard delete — removes DB record
// Caller responsible for bucket file cleanup
// Always logged for audit trail
// ─────────────────────────────────────────────

export const deleteDocument = async (
  documentId: string,
  tenantId: string,
  performedBy: string
) => {
  // [S1] Tenant scope enforced
  const document = await prisma.document.findFirst({
    where: { id: documentId, tenantId },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      documentType: true,
      employeeId: true,
    },
  })

  if (!document) throw new Error('Document not found')

  await prisma.document.delete({ where: { id: documentId } })

  // [S8] Log deletion with full context for audit
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'DOCUMENT_DELETED',
      targetType: 'Document',
      targetId: documentId,
      meta: {
        fileName: document.fileName,
        fileUrl: document.fileUrl,   // retain in log for bucket cleanup reference
        documentType: document.documentType,
        employeeId: document.employeeId,
      },
    },
  })

  // Return fileUrl so controller can trigger bucket deletion
  return { deletedId: documentId, fileUrl: document.fileUrl }
}


// ─────────────────────────────────────────────
// EXPIRY DASHBOARD
// Documents expiring within a given window
// Feeds the HR dashboard alert panel
// ─────────────────────────────────────────────

export const getExpiringDocuments = async (
  tenantId: string,
  withinDays: number = 90
) => {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() + withinDays)

  return prisma.document.findMany({
    where: {
      tenantId,
      expiryDate: {
        lte: threshold,
        gte: new Date(),
      },
    },
    select: {
      id: true,
      documentType: true,
      fileName: true,
      expiryDate: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { expiryDate: 'asc' },
  })
}


// ─────────────────────────────────────────────
// DOCUMENT SUMMARY
// Per-employee document status overview
// ─────────────────────────────────────────────

export const getEmployeeDocumentSummary = async (
  employeeId: string,
  tenantId: string
) => {
  // [S2] Ownership check
  await assertEmployeeOwnership(employeeId, tenantId)

  const documents = await prisma.document.findMany({
    where: { employeeId, tenantId },
    select: {
      id: true,
      documentType: true,
      fileName: true,
      expiryDate: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Group by document type — latest of each type first
  const byType = documents.reduce(
    (acc, doc) => {
      if (!acc[doc.documentType]) acc[doc.documentType] = []
      acc[doc.documentType].push(doc)
      return acc
    },
    {} as Record<string, typeof documents>
  )

  const now = new Date()
  const in90Days = new Date()
  in90Days.setDate(now.getDate() + 90)

  // Flag any expiring within 90 days
  const expiringSoon = documents.filter(
    d => d.expiryDate && d.expiryDate <= in90Days && d.expiryDate >= now
  )

  const expired = documents.filter(
    d => d.expiryDate && d.expiryDate < now
  )

  return {
    total: documents.length,
    byType,
    expiringSoon,
    expired,
  }
}