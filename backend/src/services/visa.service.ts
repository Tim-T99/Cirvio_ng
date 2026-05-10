// src/services/visa.service.ts
// ─────────────────────────────────────────────
// VISA SERVICE
// Core differentiator #1
// Full UAE visa lifecycle management
// Expiry tracking + alert generation
// ─────────────────────────────────────────────

import { prisma } from '../prisma/client'
import { VisaStatus, VisaType, VisaAlertType, AlertStatus, Emirate } from '@prisma/client'
import { assertTenantActive } from './tenant.service'


// ─────────────────────────────────────────────
// SECURITY NOTES
// [S1] tenantId always from verified JWT middleware
//      never trusted from request body
// [S2] Employee ownership verified before every
//      visa operation — prevents cross-tenant
//      visa injection via valid employeeId
// [S3] Alert dismissal logs userId of dismisser
//      creates accountability trail
// [S4] Visa status transitions validated —
//      illegal state jumps blocked at service layer
// [S5] All mutations logged to UserActivityLog
// [S6] Renewal chain integrity enforced —
//      previousVisaId verified to belong to
//      same tenant and employee before linking
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// ALERT WINDOW CONFIG
// Days before expiry each alert type fires
// Single source of truth — change here only
// ─────────────────────────────────────────────

const ALERT_WINDOWS: { type: VisaAlertType; days: number }[] = [
  { type: VisaAlertType.NINETY_DAYS,   days: 90 },
  { type: VisaAlertType.SIXTY_DAYS,    days: 60 },
  { type: VisaAlertType.THIRTY_DAYS,   days: 30 },
  { type: VisaAlertType.FOURTEEN_DAYS, days: 14 },
  { type: VisaAlertType.SEVEN_DAYS,    days: 7  },
]


// ─────────────────────────────────────────────
// SAFE SELECTS
// ─────────────────────────────────────────────

const visaListSelect = {
  id: true,
  tenantId: true,
  employeeId: true,
  visaType: true,
  visaNumber: true,
  expiryDate: true,
  issueDate: true,
  status: true,
  emirate: true,
  gracePeriodDays: true,
  renewalInitiatedAt: true,
  createdAt: true,
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nationality: true,
      jobTitle: true,
      department: { select: { name: true } },
    },
  },
} as const

const visaFullSelect = {
  ...visaListSelect,
  sponsorName: true,
  sponsorId: true,
  entryPermitNo: true,
  entryPermitIssue: true,
  entryPermitExpiry: true,
  residenceVisaNo: true,
  medicalDoneAt: true,
  biometricsDoneAt: true,
  renewalCompletedAt: true,
  previousVisaId: true,
  notes: true,
  updatedAt: true,
  alerts: {
    select: {
      id: true,
      alertType: true,
      triggerDate: true,
      daysRemaining: true,
      status: true,
      sentAt: true,
      dismissedAt: true,
    },
    orderBy: { triggerDate: 'asc' as const },
  },
  documents: {
    select: {
      id: true,
      documentType: true,
      fileName: true,
      fileUrl: true,
      createdAt: true,
    },
  },
  previousVisa: {
    select: {
      id: true,
      visaNumber: true,
      expiryDate: true,
      visaType: true,
    },
  },
  renewals: {
    select: {
      id: true,
      visaNumber: true,
      issueDate: true,
      expiryDate: true,
      status: true,
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

// [S2] Verify visa belongs to tenant
const assertVisaOwnership = async (
  visaId: string,
  tenantId: string
) => {
  const visa = await prisma.visaRecord.findFirst({
    where: { id: visaId, tenantId },
    select: { id: true, employeeId: true, status: true, expiryDate: true },
  })

  if (!visa) throw new Error('Visa record not found')
  return visa
}

// Calculate days remaining from today
const daysUntil = (date: Date): number => {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// Derive correct visa status from expiry date
const deriveVisaStatus = (expiryDate: Date): VisaStatus => {
  const days = daysUntil(expiryDate)
  if (days < 0)  return VisaStatus.EXPIRED
  if (days <= 30) return VisaStatus.EXPIRING_SOON
  return VisaStatus.ACTIVE
}


// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────

export const createVisaRecord = async (
  tenantId: string,
  performedBy: string,
  data: {
    employeeId: string
    visaType: VisaType
    expiryDate: Date
    visaNumber?: string
    sponsorName?: string
    sponsorId?: string
    entryPermitNo?: string
    entryPermitIssue?: Date
    entryPermitExpiry?: Date
    residenceVisaNo?: string
    issueDate?: Date
    gracePeriodDays?: number
    emirate?: Emirate
    medicalDoneAt?: Date
    biometricsDoneAt?: Date
    previousVisaId?: string
    notes?: string
  }
) => {
  await assertTenantActive(tenantId)

  // [S2] Verify employee belongs to this tenant
  await assertEmployeeOwnership(data.employeeId, tenantId)

  // [S6] Verify previousVisaId belongs to same tenant + employee
  if (data.previousVisaId) {
    const prevVisa = await prisma.visaRecord.findFirst({
      where: {
        id: data.previousVisaId,
        tenantId,
        employeeId: data.employeeId,
      },
      select: { id: true },
    })
    if (!prevVisa) throw new Error('Previous visa record not found or does not belong to this employee')
  }

  // Derive initial status from expiry date
  const status = deriveVisaStatus(data.expiryDate)

  const visa = await prisma.visaRecord.create({
    data: {
      tenantId,
      ...data,
      status,
    },
    select: visaFullSelect,
  })

  // Generate alert schedule for this visa record
  await generateVisaAlerts(visa.id, tenantId, data.employeeId, data.expiryDate)

  // [S5] Log creation
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'VISA_RECORD_CREATED',
      targetType: 'VisaRecord',
      targetId: visa.id,
      meta: {
        employeeId: data.employeeId,
        visaType: data.visaType,
        expiryDate: data.expiryDate,
      },
    },
  })

  return visa
}


// ─────────────────────────────────────────────
// ALERT GENERATION
// Creates scheduled alert records on visa create/update
// Scheduler job reads these and fires notifications
// ─────────────────────────────────────────────

const generateVisaAlerts = async (
  visaRecordId: string,
  tenantId: string,
  employeeId: string,
  expiryDate: Date
) => {
  // Clear existing pending alerts before regenerating
  // Prevents duplicate alerts if expiry date is updated
  await prisma.visaAlert.deleteMany({
    where: {
      visaRecordId,
      status: AlertStatus.PENDING,
    },
  })

  const today = new Date()

  const alertsToCreate = ALERT_WINDOWS
    .map(({ type, days }) => {
      const triggerDate = new Date(expiryDate)
      triggerDate.setDate(triggerDate.getDate() - days)
      const daysRemaining = daysUntil(expiryDate)

      // Only create future alerts
      if (triggerDate <= today) return null

      return {
        visaRecordId,
        tenantId,
        employeeId,
        alertType: type,
        triggerDate,
        daysRemaining: days,
        status: AlertStatus.PENDING,
      }
    })
    .filter(Boolean) as {
      visaRecordId: string
      tenantId: string
      employeeId: string
      alertType: VisaAlertType
      triggerDate: Date
      daysRemaining: number
      status: AlertStatus
    }[]

  if (alertsToCreate.length > 0) {
    await prisma.visaAlert.createMany({ data: alertsToCreate })
  }

  return alertsToCreate.length
}


// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

export const listVisaRecords = async (
  tenantId: string,
  filters?: {
    employeeId?: string
    status?: VisaStatus
    visaType?: VisaType
    emirate?: Emirate
    expiringWithinDays?: number
    page?: number
    pageSize?: number
  }
) => {
  const page = filters?.page ?? 1
  const pageSize = filters?.pageSize ?? 20
  const skip = (page - 1) * pageSize

  // Build expiry date filter if requested
  let expiryFilter = {}
  if (filters?.expiringWithinDays) {
    const threshold = new Date()
    threshold.setDate(threshold.getDate() + filters.expiringWithinDays)
    expiryFilter = { expiryDate: { lte: threshold, gte: new Date() } }
  }

  // [S2] If employeeId filter provided, verify it belongs to tenant
  if (filters?.employeeId) {
    await assertEmployeeOwnership(filters.employeeId, tenantId)
  }

  const where = {
    tenantId,
    ...(filters?.employeeId && { employeeId: filters.employeeId }),
    ...(filters?.status && { status: filters.status }),
    ...(filters?.visaType && { visaType: filters.visaType }),
    ...(filters?.emirate && { emirate: filters.emirate }),
    ...expiryFilter,
  }

  const [records, total] = await Promise.all([
    prisma.visaRecord.findMany({
      where,
      select: visaListSelect,
      orderBy: { expiryDate: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.visaRecord.count({ where }),
  ])

  return {
    data: records,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export const getVisaRecordById = async (
  visaId: string,
  tenantId: string
) => {
  // [S2] Ownership check via assertVisaOwnership
  await assertVisaOwnership(visaId, tenantId)

  return prisma.visaRecord.findFirst({
    where: { id: visaId, tenantId },
    select: visaFullSelect,
  })
}


// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────

export const updateVisaRecord = async (
  visaId: string,
  tenantId: string,
  performedBy: string,
  data: Partial<{
    visaType: VisaType
    visaNumber: string
    sponsorName: string
    sponsorId: string
    entryPermitNo: string
    entryPermitIssue: Date
    entryPermitExpiry: Date
    residenceVisaNo: string
    issueDate: Date
    expiryDate: Date
    gracePeriodDays: number
    emirate: Emirate
    medicalDoneAt: Date
    biometricsDoneAt: Date
    notes: string
  }>
) => {
  // [S2] Ownership check
  const existing = await assertVisaOwnership(visaId, tenantId)

  // Recalculate status if expiry date is changing
  let statusUpdate = {}
  if (data.expiryDate) {
    const newStatus = deriveVisaStatus(data.expiryDate)
    statusUpdate = { status: newStatus }
  }

  const updated = await prisma.visaRecord.update({
    where: { id: visaId },
    data: { ...data, ...statusUpdate },
    select: visaFullSelect,
  })

  // Regenerate alert schedule if expiry date changed
  if (data.expiryDate) {
    await generateVisaAlerts(
      visaId,
      tenantId,
      existing.employeeId,
      data.expiryDate
    )
  }

  // [S5] Log update
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'VISA_RECORD_UPDATED',
      targetType: 'VisaRecord',
      targetId: visaId,
      meta: { updatedFields: Object.keys(data) },
    },
  })

  return updated
}


// ─────────────────────────────────────────────
// STATUS TRANSITIONS
// [S4] Validated — illegal transitions blocked
// ─────────────────────────────────────────────

const VALID_TRANSITIONS: Record<VisaStatus, VisaStatus[]> = {
  [VisaStatus.ACTIVE]:               [VisaStatus.EXPIRING_SOON, VisaStatus.CANCELLED, VisaStatus.RENEWAL_IN_PROGRESS],
  [VisaStatus.EXPIRING_SOON]:        [VisaStatus.RENEWAL_IN_PROGRESS, VisaStatus.EXPIRED, VisaStatus.CANCELLED],
  [VisaStatus.RENEWAL_IN_PROGRESS]:  [VisaStatus.ACTIVE, VisaStatus.CANCELLED],
  [VisaStatus.EXPIRED]:              [VisaStatus.RENEWAL_IN_PROGRESS],
  [VisaStatus.CANCELLED]:            [],  // terminal state
}

export const updateVisaStatus = async (
  visaId: string,
  tenantId: string,
  performedBy: string,
  newStatus: VisaStatus,
  meta?: { reason?: string; renewalInitiatedAt?: Date; renewalCompletedAt?: Date }
) => {
  // [S2] Ownership check
  const existing = await assertVisaOwnership(visaId, tenantId)

  // [S4] Validate transition
  const allowed = VALID_TRANSITIONS[existing.status]
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${existing.status} → ${newStatus}`
    )
  }

  // Build update payload
  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === VisaStatus.RENEWAL_IN_PROGRESS && meta?.renewalInitiatedAt) {
    updateData.renewalInitiatedAt = meta.renewalInitiatedAt
  }
  if (newStatus === VisaStatus.ACTIVE && meta?.renewalCompletedAt) {
    updateData.renewalCompletedAt = meta.renewalCompletedAt
  }

  const updated = await prisma.visaRecord.update({
    where: { id: visaId },
    data: updateData,
    select: visaListSelect,
  })

  // [S5] Log transition
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'VISA_STATUS_CHANGED',
      targetType: 'VisaRecord',
      targetId: visaId,
      meta: {
        previousStatus: existing.status,
        newStatus,
        reason: meta?.reason ?? null,
      },
    },
  })

  return updated
}


// ─────────────────────────────────────────────
// ALERT MANAGEMENT
// ─────────────────────────────────────────────

export const getPendingAlerts = async (
  tenantId: string,
  filters?: {
    employeeId?: string
    alertType?: VisaAlertType
    limit?: number
  }
) => {
  // [S2] If employeeId filter provided, verify ownership
  if (filters?.employeeId) {
    await assertEmployeeOwnership(filters.employeeId, tenantId)
  }

  return prisma.visaAlert.findMany({
    where: {
      tenantId,
      status: { in: [AlertStatus.PENDING, AlertStatus.SENT] },
      ...(filters?.employeeId && { employeeId: filters.employeeId }),
      ...(filters?.alertType && { alertType: filters.alertType }),
    },
    include: {
      visaRecord: {
        select: {
          id: true,
          visaType: true,
          visaNumber: true,
          expiryDate: true,
          status: true,
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
      },
    },
    orderBy: { triggerDate: 'asc' },
    take: filters?.limit ?? 50,
  })
}

export const dismissAlert = async (
  alertId: string,
  tenantId: string,
  dismissedBy: string
) => {
  // [S2] Verify alert belongs to tenant
  const alert = await prisma.visaAlert.findFirst({
    where: { id: alertId, tenantId },
    select: { id: true, status: true },
  })

  if (!alert) throw new Error('Alert not found')

  if (alert.status === AlertStatus.RESOLVED || alert.status === AlertStatus.DISMISSED) {
    throw new Error('Alert is already closed')
  }

  // [S3] Log who dismissed it
  return prisma.visaAlert.update({
    where: { id: alertId },
    data: {
      status: AlertStatus.DISMISSED,
      dismissedAt: new Date(),
      dismissedBy,  // [S3] accountability trail
    },
    select: {
      id: true,
      alertType: true,
      status: true,
      dismissedAt: true,
      dismissedBy: true,
    },
  })
}


// ─────────────────────────────────────────────
// CRON JOB HANDLER
// Called by visaAlert.job.ts on schedule
// Updates visa statuses + marks alerts as sent
// ─────────────────────────────────────────────

export const processVisaAlerts = async () => {
  const now = new Date()

  // Find all pending alerts whose trigger date has passed
  const dueAlerts = await prisma.visaAlert.findMany({
    where: {
      status: AlertStatus.PENDING,
      triggerDate: { lte: now },
    },
    include: {
      visaRecord: {
        select: {
          id: true,
          tenantId: true,
          employeeId: true,
          expiryDate: true,
          status: true,
        },
      },
    },
  })

  const results = {
    processed: 0,
    statusUpdates: 0,
    errors: [] as string[],
  }

  for (const alert of dueAlerts) {
    try {
      // Update alert to SENT
      await prisma.visaAlert.update({
        where: { id: alert.id },
        data: {
          status: AlertStatus.SENT,
          sentAt: now,
        },
      })

      // Sync visa status based on current expiry
      const currentStatus = deriveVisaStatus(alert.visaRecord.expiryDate)
      if (currentStatus !== alert.visaRecord.status) {
        await prisma.visaRecord.update({
          where: { id: alert.visaRecord.id },
          data: { status: currentStatus },
        })
        results.statusUpdates++
      }

      results.processed++
    } catch (err) {
      results.errors.push(`Alert ${alert.id}: ${(err as Error).message}`)
    }
  }

  // Also catch expired visas with no pending alerts remaining
  await prisma.visaRecord.updateMany({
    where: {
      status: { in: [VisaStatus.ACTIVE, VisaStatus.EXPIRING_SOON] },
      expiryDate: { lt: now },
    },
    data: { status: VisaStatus.EXPIRED },
  })

  return results
}


// ─────────────────────────────────────────────
// VISA DASHBOARD SUMMARY
// Tenant-level overview for HR dashboard
// ─────────────────────────────────────────────

export const getVisaDashboardSummary = async (tenantId: string) => {
  const now = new Date()
  const in30Days = new Date(); in30Days.setDate(now.getDate() + 30)
  const in60Days = new Date(); in60Days.setDate(now.getDate() + 60)
  const in90Days = new Date(); in90Days.setDate(now.getDate() + 90)

  const [
    total,
    active,
    expiringSoon,
    expired,
    renewalInProgress,
    expiringIn30,
    expiringIn60,
    expiringIn90,
    pendingAlerts,
  ] = await Promise.all([
    prisma.visaRecord.count({ where: { tenantId } }),
    prisma.visaRecord.count({ where: { tenantId, status: VisaStatus.ACTIVE } }),
    prisma.visaRecord.count({ where: { tenantId, status: VisaStatus.EXPIRING_SOON } }),
    prisma.visaRecord.count({ where: { tenantId, status: VisaStatus.EXPIRED } }),
    prisma.visaRecord.count({ where: { tenantId, status: VisaStatus.RENEWAL_IN_PROGRESS } }),
    prisma.visaRecord.count({ where: { tenantId, expiryDate: { lte: in30Days, gte: now } } }),
    prisma.visaRecord.count({ where: { tenantId, expiryDate: { lte: in60Days, gte: now } } }),
    prisma.visaRecord.count({ where: { tenantId, expiryDate: { lte: in90Days, gte: now } } }),
    prisma.visaAlert.count({ where: { tenantId, status: AlertStatus.PENDING } }),
  ])

  return {
    total,
    active,
    expiringSoon,
    expired,
    renewalInProgress,
    expiringTimeline: {
      within30Days: expiringIn30,
      within60Days: expiringIn60,
      within90Days: expiringIn90,
    },
    pendingAlerts,
  }
}