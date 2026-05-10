// src/services/wps.service.ts
// ─────────────────────────────────────────────
// WPS SERVICE
// Core differentiator #2
// UAE Wages Protection System compliance
// Salary disbursement tracking + SIF generation
// ─────────────────────────────────────────────

import { prisma } from '../prisma/client'
import {
  WpsStatus,
  SifStatus,
  WpsAlertType,
  AlertStatus,
} from '@prisma/client'
import { assertTenantActive } from './tenant.service'


// ─────────────────────────────────────────────
// SECURITY NOTES
// [S1] tenantId always from verified JWT middleware
//      never trusted from request body
// [S2] Employee ownership verified before every
//      WPS record operation
// [S3] SIF file ownership verified before access
//      SIF contains salary data — treat as sensitive
// [S4] netSalary always computed server-side
//      never trusted from client input
// [S5] Late payment detection runs server-side
//      UAE law: salary due by 10th of following month
// [S6] All mutations logged to UserActivityLog
// [S7] Violation records are append-only —
//      existing violations cannot be overwritten
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// CONSTANTS
// UAE WPS payment deadline = 10th of next month
// ─────────────────────────────────────────────

const WPS_PAYMENT_DEADLINE_DAY = 10


// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

// [S4] Always compute netSalary server-side
const computeNetSalary = (
  basicSalary: number,
  housingAllowance: number,
  transportAllowance: number,
  otherAllowances: number,
  deductions: number
): number => {
  return (
    basicSalary +
    housingAllowance +
    transportAllowance +
    otherAllowances -
    deductions
  )
}

// [S5] Determine if payment is late under UAE law
const assessLateness = (
  month: number,
  year: number,
  paymentDate: Date | null
): { isLate: boolean; lateByDays: number | null } => {
  if (!paymentDate) return { isLate: false, lateByDays: null }

  // Deadline = 10th of the month following the pay period
  const deadlineMonth = month === 12 ? 1 : month + 1
  const deadlineYear = month === 12 ? year + 1 : year
  const deadline = new Date(deadlineYear, deadlineMonth - 1, WPS_PAYMENT_DEADLINE_DAY)

  const isLate = paymentDate > deadline
  const lateByDays = isLate
    ? Math.ceil((paymentDate.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return { isLate, lateByDays }
}

// [S2] Verify employee belongs to tenant
const assertEmployeeOwnership = async (
  employeeId: string,
  tenantId: string
) => {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      basicSalaryAed: true,
      allowancesAed: true,
      wpsPersonId: true,
      wpsBankCode: true,
    },
  })

  if (!employee) throw new Error('Employee not found')
  return employee
}

// [S3] Verify SIF file belongs to tenant
const assertSifOwnership = async (
  sifFileId: string,
  tenantId: string
) => {
  const sif = await prisma.sifFile.findFirst({
    where: { id: sifFileId, tenantId },
    select: { id: true, status: true, month: true, year: true },
  })

  if (!sif) throw new Error('SIF file not found')
  return sif
}


// ─────────────────────────────────────────────
// SAFE SELECTS
// [S3] Salary data excluded from list view
// Full record only on direct fetch
// ─────────────────────────────────────────────

const wpsListSelect = {
  id: true,
  tenantId: true,
  employeeId: true,
  month: true,
  year: true,
  status: true,
  paymentDate: true,
  isLate: true,
  lateByDays: true,
  submittedAt: true,
  confirmedAt: true,
  createdAt: true,
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      employeeNo: true,
      department: { select: { name: true } },
    },
  },
} as const

const wpsFullSelect = {
  ...wpsListSelect,
  basicSalary: true,
  housingAllowance: true,
  transportAllowance: true,
  otherAllowances: true,
  deductions: true,
  netSalary: true,
  wpsPersonId: true,
  wpsBankCode: true,
  wpsAgentId: true,
  silaReference: true,
  violationRef: true,
  notes: true,
  updatedAt: true,
  sifFile: {
    select: {
      id: true,
      fileName: true,
      status: true,
      submittedAt: true,
    },
  },
  alerts: {
    select: {
      id: true,
      alertType: true,
      triggerDate: true,
      status: true,
      sentAt: true,
    },
    orderBy: { triggerDate: 'asc' as const },
  },
} as const


// ─────────────────────────────────────────────
// WPS RECORD — CREATE
// ─────────────────────────────────────────────

export const createWpsRecord = async (
  tenantId: string,
  performedBy: string,
  data: {
    employeeId: string
    month: number
    year: number
    basicSalary: number
    housingAllowance?: number
    transportAllowance?: number
    otherAllowances?: number
    deductions?: number
    paymentDate?: Date
    wpsPersonId?: string
    wpsBankCode?: string
    wpsAgentId?: string
    silaReference?: string
    notes?: string
  }
) => {
  await assertTenantActive(tenantId)

  // [S2] Verify employee belongs to tenant
  await assertEmployeeOwnership(data.employeeId, tenantId)

  // Validate month range
  if (data.month < 1 || data.month > 12) {
    throw new Error('Month must be between 1 and 12')
  }

  // Check for duplicate record
  const existing = await prisma.wpsRecord.findUnique({
    where: {
      tenantId_employeeId_month_year: {
        tenantId,
        employeeId: data.employeeId,
        month: data.month,
        year: data.year,
      },
    },
    select: { id: true },
  })

  if (existing) {
    throw new Error(
      `A WPS record already exists for this employee for ${data.month}/${data.year}`
    )
  }

  const housingAllowance    = data.housingAllowance    ?? 0
  const transportAllowance  = data.transportAllowance  ?? 0
  const otherAllowances     = data.otherAllowances     ?? 0
  const deductions          = data.deductions          ?? 0

  // [S4] Compute netSalary server-side — never from client
  const netSalary = computeNetSalary(
    data.basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowances,
    deductions
  )

  // [S5] Assess lateness server-side
  const { isLate, lateByDays } = assessLateness(
    data.month,
    data.year,
    data.paymentDate ?? null
  )

  const record = await prisma.wpsRecord.create({
    data: {
      tenantId,
      employeeId: data.employeeId,
      month: data.month,
      year: data.year,
      basicSalary: data.basicSalary,
      housingAllowance,
      transportAllowance,
      otherAllowances,
      deductions,
      netSalary,
      paymentDate: data.paymentDate,
      wpsPersonId: data.wpsPersonId,
      wpsBankCode: data.wpsBankCode,
      wpsAgentId: data.wpsAgentId,
      silaReference: data.silaReference,
      notes: data.notes,
      isLate,
      lateByDays,
    },
    select: wpsFullSelect,
  })

  // Generate WPS alerts for this record
  await generateWpsAlerts(
    record.id,
    tenantId,
    data.employeeId,
    data.month,
    data.year
  )

  // [S6] Log creation
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'WPS_RECORD_CREATED',
      targetType: 'WpsRecord',
      targetId: record.id,
      meta: {
        employeeId: data.employeeId,
        month: data.month,
        year: data.year,
        netSalary,
        isLate,
      },
    },
  })

  return record
}


// ─────────────────────────────────────────────
// BULK CREATE
// Create WPS records for all active employees
// in one pay cycle — primary monthly workflow
// ─────────────────────────────────────────────

export const bulkCreateWpsRecords = async (
  tenantId: string,
  performedBy: string,
  month: number,
  year: number,
  overrides?: {
    employeeId: string
    basicSalary?: number
    housingAllowance?: number
    transportAllowance?: number
    otherAllowances?: number
    deductions?: number
    paymentDate?: Date
  }[]
) => {
  await assertTenantActive(tenantId)

  if (month < 1 || month > 12) throw new Error('Month must be between 1 and 12')

  // Fetch all active employees with salary info
  const employees = await prisma.employee.findMany({
    where: { tenantId, status: 'ACTIVE' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      basicSalaryAed: true,
      allowancesAed: true,
      wpsPersonId: true,
      wpsBankCode: true,
    },
  })

  if (employees.length === 0) {
    throw new Error('No active employees found for this tenant')
  }

  // Check which employees already have a record this cycle
  const existing = await prisma.wpsRecord.findMany({
    where: { tenantId, month, year },
    select: { employeeId: true },
  })

  const existingIds = new Set(existing.map(r => r.employeeId))
  const toProcess = employees.filter(e => !existingIds.has(e.id))

  if (toProcess.length === 0) {
    throw new Error(
      `All active employees already have WPS records for ${month}/${year}`
    )
  }

  const results = {
    created: 0,
    skipped: existingIds.size,
    errors: [] as string[],
  }

  for (const employee of toProcess) {
    try {
      // Apply override if provided for this employee
      const override = overrides?.find(o => o.employeeId === employee.id)

      const basicSalary       = override?.basicSalary       ?? employee.basicSalaryAed       ?? 0
      const housingAllowance  = override?.housingAllowance  ?? 0
      const transportAllowance = override?.transportAllowance ?? 0
      const otherAllowances   = override?.otherAllowances   ?? employee.allowancesAed        ?? 0
      const deductions        = override?.deductions        ?? 0
      const paymentDate       = override?.paymentDate       ?? null

      // [S4] Server-side net salary computation
      const netSalary = computeNetSalary(
        basicSalary,
        housingAllowance,
        transportAllowance,
        otherAllowances,
        deductions
      )

      // [S5] Server-side lateness assessment
      const { isLate, lateByDays } = assessLateness(month, year, paymentDate)

      const record = await prisma.wpsRecord.create({
        data: {
          tenantId,
          employeeId: employee.id,
          month,
          year,
          basicSalary,
          housingAllowance,
          transportAllowance,
          otherAllowances,
          deductions,
          netSalary,
          paymentDate,
          wpsPersonId: employee.wpsPersonId ?? undefined,
          wpsBankCode: employee.wpsBankCode ?? undefined,
          isLate,
          lateByDays,
        },
        select: { id: true },
      })

      await generateWpsAlerts(record.id, tenantId, employee.id, month, year)

      results.created++
    } catch (err) {
      results.errors.push(
        `${employee.firstName} ${employee.lastName}: ${(err as Error).message}`
      )
    }
  }

  // [S6] Log bulk operation
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'WPS_BULK_CREATED',
      targetType: 'WpsRecord',
      targetId: tenantId,
      meta: { month, year, ...results },
    },
  })

  return results
}


// ─────────────────────────────────────────────
// ALERT GENERATION
// Due date warnings + overdue flags
// ─────────────────────────────────────────────

const generateWpsAlerts = async (
  wpsRecordId: string,
  tenantId: string,
  employeeId: string,
  month: number,
  year: number
) => {
  // Deadline = 10th of following month
  const deadlineMonth = month === 12 ? 1 : month + 1
  const deadlineYear  = month === 12 ? year + 1 : year
  const deadline = new Date(deadlineYear, deadlineMonth - 1, WPS_PAYMENT_DEADLINE_DAY)

  const now = new Date()
  const alertsToCreate = []

  // Due warning — 3 days before deadline
  const dueTrigger = new Date(deadline)
  dueTrigger.setDate(dueTrigger.getDate() - 3)
  if (dueTrigger > now) {
    alertsToCreate.push({
      wpsRecordId,
      tenantId,
      employeeId,
      alertType: WpsAlertType.PAYMENT_DUE,
      triggerDate: dueTrigger,
      status: AlertStatus.PENDING,
    })
  }

  // Overdue alert — 1 day after deadline
  const overdueTrigger = new Date(deadline)
  overdueTrigger.setDate(overdueTrigger.getDate() + 1)
  if (overdueTrigger > now) {
    alertsToCreate.push({
      wpsRecordId,
      tenantId,
      employeeId,
      alertType: WpsAlertType.PAYMENT_OVERDUE,
      triggerDate: overdueTrigger,
      status: AlertStatus.PENDING,
    })
  }

  if (alertsToCreate.length > 0) {
    await prisma.wpsAlert.createMany({ data: alertsToCreate })
  }
}


// ─────────────────────────────────────────────
// WPS RECORD — READ
// ─────────────────────────────────────────────

export const listWpsRecords = async (
  tenantId: string,
  filters?: {
    month?: number
    year?: number
    employeeId?: string
    status?: WpsStatus
    isLate?: boolean
    page?: number
    pageSize?: number
  }
) => {
  const page     = filters?.page     ?? 1
  const pageSize = filters?.pageSize ?? 20
  const skip     = (page - 1) * pageSize

  // [S2] Verify employee belongs to tenant if filtering by employee
  if (filters?.employeeId) {
    await assertEmployeeOwnership(filters.employeeId, tenantId)
  }

  const where = {
    tenantId,
    ...(filters?.month      && { month: filters.month }),
    ...(filters?.year       && { year: filters.year }),
    ...(filters?.employeeId && { employeeId: filters.employeeId }),
    ...(filters?.status     && { status: filters.status }),
    ...(filters?.isLate !== undefined && { isLate: filters.isLate }),
  }

  const [records, total] = await Promise.all([
    prisma.wpsRecord.findMany({
      where,
      select: wpsListSelect,   // [S3] salary excluded from list
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      skip,
      take: pageSize,
    }),
    prisma.wpsRecord.count({ where }),
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

export const getWpsRecordById = async (
  wpsRecordId: string,
  tenantId: string
) => {
  // [S1] Tenant scope enforced
  const record = await prisma.wpsRecord.findFirst({
    where: { id: wpsRecordId, tenantId },
    select: wpsFullSelect,  // [S3] full salary data on direct fetch only
  })

  if (!record) throw new Error('WPS record not found')
  return record
}


// ─────────────────────────────────────────────
// WPS RECORD — UPDATE
// ─────────────────────────────────────────────

export const updateWpsRecord = async (
  wpsRecordId: string,
  tenantId: string,
  performedBy: string,
  data: Partial<{
    basicSalary: number
    housingAllowance: number
    transportAllowance: number
    otherAllowances: number
    deductions: number
    paymentDate: Date
    wpsPersonId: string
    wpsBankCode: string
    wpsAgentId: string
    silaReference: string
    notes: string
  }>
) => {
  // [S1] Tenant scope enforced
  const existing = await prisma.wpsRecord.findFirst({
    where: { id: wpsRecordId, tenantId },
    select: {
      id: true,
      month: true,
      year: true,
      employeeId: true,
      basicSalary: true,
      housingAllowance: true,
      transportAllowance: true,
      otherAllowances: true,
      deductions: true,
      status: true,
    },
  })

  if (!existing) throw new Error('WPS record not found')

  // Block updates on confirmed records
  if (existing.status === WpsStatus.CONFIRMED) {
    throw new Error('Cannot modify a confirmed WPS record')
  }

  // [S4] Recompute netSalary if any salary field changes
  const basicSalary        = data.basicSalary        ?? existing.basicSalary
  const housingAllowance   = data.housingAllowance   ?? existing.housingAllowance
  const transportAllowance = data.transportAllowance ?? existing.transportAllowance
  const otherAllowances    = data.otherAllowances    ?? existing.otherAllowances
  const deductions         = data.deductions         ?? existing.deductions

  const netSalary = computeNetSalary(
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowances,
    deductions
  )

  // [S5] Reassess lateness if payment date changes
  let latenessUpdate = {}
  if (data.paymentDate !== undefined) {
    const { isLate, lateByDays } = assessLateness(
      existing.month,
      existing.year,
      data.paymentDate
    )
    latenessUpdate = { isLate, lateByDays }
  }

  const updated = await prisma.wpsRecord.update({
    where: { id: wpsRecordId },
    data: {
      ...data,
      netSalary,
      ...latenessUpdate,
    },
    select: wpsFullSelect,
  })

  // [S6] Log update
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'WPS_RECORD_UPDATED',
      targetType: 'WpsRecord',
      targetId: wpsRecordId,
      meta: { updatedFields: Object.keys(data) },
    },
  })

  return updated
}


// ─────────────────────────────────────────────
// VIOLATION TRACKING
// [S7] Append-only — cannot overwrite existing
// ─────────────────────────────────────────────

export const recordViolation = async (
  wpsRecordId: string,
  tenantId: string,
  performedBy: string,
  violationRef: string
) => {
  // [S1] Tenant scope enforced
  const record = await prisma.wpsRecord.findFirst({
    where: { id: wpsRecordId, tenantId },
    select: { id: true, violationRef: true },
  })

  if (!record) throw new Error('WPS record not found')

  // [S7] Block overwriting an existing violation reference
  if (record.violationRef) {
    throw new Error(
      `A violation reference already exists for this record: ${record.violationRef}. Contact support to amend.`
    )
  }

  const updated = await prisma.wpsRecord.update({
    where: { id: wpsRecordId },
    data: {
      violationRef,
      isLate: true,
    },
    select: { id: true, violationRef: true, isLate: true },
  })

  // Raise a violation alert
  await prisma.wpsAlert.create({
    data: {
      wpsRecordId,
      tenantId,
      employeeId: (await prisma.wpsRecord.findUnique({
        where: { id: wpsRecordId },
        select: { employeeId: true },
      }))!.employeeId,
      alertType: WpsAlertType.VIOLATION_RAISED,
      triggerDate: new Date(),
      status: AlertStatus.SENT,
      sentAt: new Date(),
    },
  })

  // [S6] Log violation
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'WPS_VIOLATION_RECORDED',
      targetType: 'WpsRecord',
      targetId: wpsRecordId,
      meta: { violationRef },
    },
  })

  return updated
}


// ─────────────────────────────────────────────
// SIF FILE MANAGEMENT
// Salary Information File — UAE WPS submission
// ─────────────────────────────────────────────

export const generateSifFile = async (
  tenantId: string,
  performedBy: string,
  month: number,
  year: number
) => {
  await assertTenantActive(tenantId)

  // Check for existing SIF this cycle
  const existing = await prisma.sifFile.findUnique({
    where: { tenantId_month_year: { tenantId, month, year } },
    select: { id: true, status: true },
  })

  if (existing && existing.status !== SifStatus.DRAFT) {
    throw new Error(
      `A SIF file for ${month}/${year} already exists with status: ${existing.status}`
    )
  }

  // Fetch all WPS records for this cycle
  const records = await prisma.wpsRecord.findMany({
    where: { tenantId, month, year },
    select: {
      id: true,
      netSalary: true,
      wpsPersonId: true,
      wpsBankCode: true,
      wpsAgentId: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          eidNumber: true,
          employeeNo: true,
        },
      },
    },
  })

  if (records.length === 0) {
    throw new Error(`No WPS records found for ${month}/${year}. Create records first.`)
  }

  const totalAmountAed = records.reduce((sum, r) => sum + r.netSalary, 0)
  const fileName = `cirvio_sif_${tenantId}_${year}_${String(month).padStart(2, '0')}.csv`

  // Build SIF content (UAE SIF format)
  const sifContent = buildSifContent(records, month, year)

  // In production: upload sifContent to R2/S3, store URL
  // For now: store as placeholder — file upload handled in controller
  const fileUrl = `pending_upload/${fileName}`

  const sifFile = existing
    ? await prisma.sifFile.update({
        where: { id: existing.id },
        data: {
          fileName,
          fileUrl,
          employeeCount: records.length,
          totalAmountAed,
          status: SifStatus.READY,
        },
      })
    : await prisma.sifFile.create({
        data: {
          tenantId,
          month,
          year,
          fileName,
          fileUrl,
          employeeCount: records.length,
          totalAmountAed,
          status: SifStatus.READY,
        },
      })

  // Link all WPS records to this SIF file
  await prisma.wpsRecord.updateMany({
    where: { tenantId, month, year },
    data: { sifFileId: sifFile.id },
  })

  // [S6] Log generation
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'SIF_FILE_GENERATED',
      targetType: 'SifFile',
      targetId: sifFile.id,
      meta: {
        month,
        year,
        employeeCount: records.length,
        totalAmountAed,
      },
    },
  })

  return { sifFile, sifContent }
}

// Builds UAE-compliant SIF CSV content
// Format: EDR (Employer Detail Record) + EDL (Employee Detail Lines)
const buildSifContent = (
  records: {
    id: string
    netSalary: number
    wpsPersonId: string | null
    wpsBankCode: string | null
    wpsAgentId: string | null
    employee: {
      id: string
      firstName: string
      lastName: string
      eidNumber: string | null
      employeeNo: string | null
    }
  }[],
  month: number,
  year: number
): string => {
  const lines: string[] = []
  const payPeriod = `${year}${String(month).padStart(2, '0')}`

  // EDR — Employer Detail Record (header)
  lines.push([
    'EDR',
    records[0]?.wpsAgentId ?? '',
    payPeriod,
    records.length,
    records.reduce((sum, r) => sum + r.netSalary, 0).toFixed(2),
    'AED',
  ].join(','))

  // EDL — one line per employee
  for (const record of records) {
    lines.push([
      'EDL',
      record.wpsPersonId ?? record.employee.employeeNo ?? record.employee.id,
      record.employee.eidNumber ?? '',
      record.employee.firstName,
      record.employee.lastName,
      record.wpsBankCode ?? '',
      record.netSalary.toFixed(2),
      'AED',
      payPeriod,
    ].join(','))
  }

  return lines.join('\n')
}

export const submitSifFile = async (
  sifFileId: string,
  tenantId: string,
  performedBy: string
) => {
  // [S3] Ownership check
  const sif = await assertSifOwnership(sifFileId, tenantId)

  if (sif.status !== SifStatus.READY) {
    throw new Error(`SIF file must be in READY status to submit. Current: ${sif.status}`)
  }

  const updated = await prisma.sifFile.update({
    where: { id: sifFileId },
    data: {
      status: SifStatus.SUBMITTED,
      submittedAt: new Date(),
    },
  })

  // Update all linked WPS records to SUBMITTED
  await prisma.wpsRecord.updateMany({
    where: { sifFileId },
    data: { status: WpsStatus.SUBMITTED, submittedAt: new Date() },
  })

  // [S6] Log submission
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'SIF_FILE_SUBMITTED',
      targetType: 'SifFile',
      targetId: sifFileId,
      meta: { month: sif.month, year: sif.year },
    },
  })

  return updated
}

export const confirmSifFile = async (
  sifFileId: string,
  tenantId: string,
  performedBy: string,
  silaReference?: string
) => {
  // [S3] Ownership check
  const sif = await assertSifOwnership(sifFileId, tenantId)

  if (sif.status !== SifStatus.SUBMITTED) {
    throw new Error(`SIF file must be in SUBMITTED status to confirm. Current: ${sif.status}`)
  }

  const updated = await prisma.sifFile.update({
    where: { id: sifFileId },
    data: {
      status: SifStatus.CONFIRMED,
      confirmedAt: new Date(),
    },
  })

  // Update all linked WPS records to CONFIRMED
  await prisma.wpsRecord.updateMany({
    where: { sifFileId },
    data: {
      status: WpsStatus.CONFIRMED,
      confirmedAt: new Date(),
      ...(silaReference && { silaReference }),
    },
  })

  // Resolve any pending overdue alerts for this cycle
  await prisma.wpsAlert.updateMany({
    where: {
      tenantId,
      wpsRecord: { sifFileId },
      alertType: WpsAlertType.PAYMENT_OVERDUE,
      status: AlertStatus.PENDING,
    },
    data: {
      status: AlertStatus.RESOLVED,
    },
  })

  // [S6] Log confirmation
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'SIF_FILE_CONFIRMED',
      targetType: 'SifFile',
      targetId: sifFileId,
      meta: { month: sif.month, year: sif.year, silaReference },
    },
  })

  return updated
}


// ─────────────────────────────────────────────
// CRON JOB HANDLER
// Called by wpsAlert.job.ts on schedule
// Detects overdue payments + fires alerts
// ─────────────────────────────────────────────

export const processWpsAlerts = async () => {
  const now = new Date()

  // Find all pending alerts whose trigger date has passed
  const dueAlerts = await prisma.wpsAlert.findMany({
    where: {
      status: AlertStatus.PENDING,
      triggerDate: { lte: now },
    },
    select: {
      id: true,
      wpsRecordId: true,
      alertType: true,
      wpsRecord: {
        select: {
          id: true,
          tenantId: true,
          month: true,
          year: true,
          status: true,
          paymentDate: true,
        },
      },
    },
  })

  const results = {
    processed: 0,
    latePaymentsDetected: 0,
    errors: [] as string[],
  }

  for (const alert of dueAlerts) {
    try {
      await prisma.wpsAlert.update({
        where: { id: alert.id },
        data: { status: AlertStatus.SENT, sentAt: now },
      })

      // [S5] If overdue alert fires and record still PENDING — flag as late
      if (
        alert.alertType === WpsAlertType.PAYMENT_OVERDUE &&
        alert.wpsRecord.status === WpsStatus.PENDING
      ) {
        const { month, year } = alert.wpsRecord
        const deadline = new Date(
          month === 12 ? year + 1 : year,
          month === 12 ? 0 : month,
          WPS_PAYMENT_DEADLINE_DAY
        )

        const lateByDays = Math.ceil(
          (now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)
        )

        await prisma.wpsRecord.update({
          where: { id: alert.wpsRecordId },
          data: { isLate: true, lateByDays },
        })

        results.latePaymentsDetected++
      }

      results.processed++
    } catch (err) {
      results.errors.push(`Alert ${alert.id}: ${(err as Error).message}`)
    }
  }

  return results
}


// ─────────────────────────────────────────────
// WPS DASHBOARD SUMMARY
// Tenant-level compliance overview
// ─────────────────────────────────────────────

export const getWpsDashboardSummary = async (
  tenantId: string,
  year: number
) => {
  // [S1] Scoped to tenant + year
  const [
    totalRecords,
    confirmedRecords,
    pendingRecords,
    lateRecords,
    violationRecords,
    pendingAlerts,
    monthlySummary,
  ] = await Promise.all([
    prisma.wpsRecord.count({ where: { tenantId, year } }),
    prisma.wpsRecord.count({ where: { tenantId, year, status: WpsStatus.CONFIRMED } }),
    prisma.wpsRecord.count({ where: { tenantId, year, status: WpsStatus.PENDING } }),
    prisma.wpsRecord.count({ where: { tenantId, year, isLate: true } }),
    prisma.wpsRecord.count({ where: { tenantId, year, violationRef: { not: null } } }),
    prisma.wpsAlert.count({ where: { tenantId, status: AlertStatus.PENDING } }),

    // Monthly breakdown — total salary disbursed per month
    prisma.wpsRecord.groupBy({
      by: ['month'],
      where: { tenantId, year, status: WpsStatus.CONFIRMED },
      _sum: { netSalary: true },
      _count: { id: true },
      orderBy: { month: 'asc' },
    }),
  ])

  return {
    year,
    totalRecords,
    confirmedRecords,
    pendingRecords,
    lateRecords,
    violationRecords,
    pendingAlerts,
    complianceRate: totalRecords > 0
      ? Math.round((confirmedRecords / totalRecords) * 100)
      : 0,
    monthlySummary: monthlySummary.map(m => ({
      month: m.month,
      employeeCount: m._count.id,
      totalDisbursedAed: m._sum.netSalary ?? 0,
    })),
  }
}