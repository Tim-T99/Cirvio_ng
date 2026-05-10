// src/services/employee.service.ts
// ─────────────────────────────────────────────
// EMPLOYEE SERVICE
// Core operational record management
// All operations strictly scoped to tenantId
// Central record — visa, WPS, docs hang off this
// ─────────────────────────────────────────────

import { prisma } from '../prisma/client'
import { EmployeeStatus, EmploymentType, Gender } from '@prisma/client'
import { assertEmployeeLimit, assertTenantActive } from './tenant.service'


// ─────────────────────────────────────────────
// SECURITY NOTES
// [S1] tenantId always from verified JWT middleware
//      never trusted from request body
// [S2] Sensitive identity fields (EID, passport)
//      excluded from list queries — only returned
//      in single record fetch (need-to-know basis)
// [S3] Emergency contact stored as Json —
//      validated at controller layer before insert
// [S4] Plan limits checked before every create
// [S5] Termination is soft delete only —
//      data retained for UAE labour law compliance
//      Hard deletes blocked at service layer
// [S6] All mutations logged to UserActivityLog
// ─────────────────────────────────────────────


// ─────────────────────────────────────────────
// SAFE SELECTS
// Two levels — list view vs full record
// [S2] Identity fields withheld from list view
// ─────────────────────────────────────────────

const employeeListSelect = {
  id: true,
  tenantId: true,
  firstName: true,
  lastName: true,
  middleName: true,
  photoUrl: true,
  jobTitle: true,
  employmentType: true,
  status: true,
  startDate: true,
  nationality: true,
  workEmail: true,
  phone: true,
  employeeNo: true,
  createdAt: true,
  department: {
    select: { id: true, name: true },
  },
} as const

const employeeFullSelect = {
  ...employeeListSelect,
  dateOfBirth: true,
  gender: true,
  personalEmail: true,
  emergencyContact: true,
  endDate: true,

  // [S2] Sensitive identity — full record only
  eidNumber: true,
  eidExpiry: true,
  passportNumber: true,
  passportExpiry: true,
  labourCardNo: true,

  // Salary
  basicSalaryAed: true,
  allowancesAed: true,

  updatedAt: true,

  // Related counts
  _count: {
    select: {
      visaRecords: true,
      documents: true,
      wpsRecords: true,
    },
  },

  // Linked user account if any
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  },
} as const


// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────

export const createEmployee = async (
  tenantId: string,
  performedBy: string,
  data: {
    firstName: string
    lastName: string
    middleName?: string
    dateOfBirth?: Date
    gender?: Gender
    nationality: string
    photoUrl?: string
    personalEmail?: string
    workEmail?: string
    phone?: string
    emergencyContact?: {
      name: string
      phone: string
      relationship: string
    }
    employeeNo?: string
    jobTitle: string
    departmentId?: string
    employmentType?: EmploymentType
    startDate: Date
    eidNumber?: string
    eidExpiry?: Date
    passportNumber?: string
    passportExpiry?: Date
    labourCardNo?: string
    basicSalaryAed?: number
    allowancesAed?: number
  }
) => {
  // [S4] Check plan limit and tenant status before creating
  await assertTenantActive(tenantId)
  await assertEmployeeLimit(tenantId)

  // [S1] Verify department belongs to this tenant if provided
  if (data.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: data.departmentId, tenantId },
      select: { id: true },
    })
    if (!dept) throw new Error('Department not found')
  }

  // Check EID uniqueness within tenant if provided
  if (data.eidNumber) {
    const existing = await prisma.employee.findFirst({
      where: { tenantId, eidNumber: data.eidNumber },
      select: { id: true },
    })
    if (existing) throw new Error('An employee with this Emirates ID already exists')
  }

  // Check employee number uniqueness within tenant if provided
  if (data.employeeNo) {
    const existing = await prisma.employee.findFirst({
      where: { tenantId, employeeNo: data.employeeNo },
      select: { id: true },
    })
    if (existing) throw new Error('An employee with this employee number already exists')
  }

  const employee = await prisma.employee.create({
    data: {
      tenantId,
      ...data,
    },
    select: employeeFullSelect,
  })

  // [S6] Log creation
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'EMPLOYEE_CREATED',
      targetType: 'Employee',
      targetId: employee.id,
      meta: {
        name: `${data.firstName} ${data.lastName}`,
        jobTitle: data.jobTitle,
      },
    },
  })

  return employee
}


// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

export const listEmployees = async (
  tenantId: string,
  filters?: {
    status?: EmployeeStatus
    departmentId?: string
    employmentType?: EmploymentType
    search?: string
    nationality?: string
    page?: number
    pageSize?: number
  }
) => {
  const page = filters?.page ?? 1
  const pageSize = filters?.pageSize ?? 20
  const skip = (page - 1) * pageSize

  // [S1] All filters scoped under tenantId
  const where = {
    tenantId,
    ...(filters?.status && { status: filters.status }),
    ...(filters?.employmentType && { employmentType: filters.employmentType }),
    ...(filters?.nationality && { nationality: filters.nationality }),
    ...(filters?.departmentId && { departmentId: filters.departmentId }),
    ...(filters?.search && {
      OR: [
        { firstName: { contains: filters.search, mode: 'insensitive' as const } },
        { lastName: { contains: filters.search, mode: 'insensitive' as const } },
        { jobTitle: { contains: filters.search, mode: 'insensitive' as const } },
        { employeeNo: { contains: filters.search, mode: 'insensitive' as const } },
        { workEmail: { contains: filters.search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: employeeListSelect,  // [S2] identity fields excluded
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ])

  return {
    data: employees,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export const getEmployeeById = async (
  employeeId: string,
  tenantId: string
) => {
  // [S1] Tenant scope enforced
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: employeeFullSelect,  // [S2] full identity fields returned here
  })

  if (!employee) throw new Error('Employee not found')
  return employee
}

export const getEmployeeWithRecords = async (
  employeeId: string,
  tenantId: string
) => {
  // [S1] Tenant scope enforced
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: {
      ...employeeFullSelect,
      visaRecords: {
        select: {
          id: true,
          visaType: true,
          visaNumber: true,
          expiryDate: true,
          status: true,
          emirate: true,
          issueDate: true,
        },
        orderBy: { expiryDate: 'desc' },
      },
      wpsRecords: {
        select: {
          id: true,
          month: true,
          year: true,
          netSalary: true,
          status: true,
          paymentDate: true,
          isLate: true,
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 12,  // last 12 months
      },
      documents: {
        select: {
          id: true,
          documentType: true,
          fileName: true,
          expiryDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!employee) throw new Error('Employee not found')
  return employee
}


// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────

export const updateEmployee = async (
  employeeId: string,
  tenantId: string,
  performedBy: string,
  data: Partial<{
    firstName: string
    lastName: string
    middleName: string
    dateOfBirth: Date
    gender: Gender
    nationality: string
    photoUrl: string
    personalEmail: string
    workEmail: string
    phone: string
    emergencyContact: {
      name: string
      phone: string
      relationship: string
    }
    employeeNo: string
    jobTitle: string
    departmentId: string
    employmentType: EmploymentType
    startDate: Date
    eidNumber: string
    eidExpiry: Date
    passportNumber: string
    passportExpiry: Date
    labourCardNo: string
    basicSalaryAed: number
    allowancesAed: number
  }>
) => {
  // [S1] Verify employee belongs to tenant
  const existing = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: { id: true, eidNumber: true, employeeNo: true },
  })

  if (!existing) throw new Error('Employee not found')

  // Check EID uniqueness if being changed
  if (data.eidNumber && data.eidNumber !== existing.eidNumber) {
    const conflict = await prisma.employee.findFirst({
      where: {
        tenantId,
        eidNumber: data.eidNumber,
        NOT: { id: employeeId },
      },
      select: { id: true },
    })
    if (conflict) throw new Error('An employee with this Emirates ID already exists')
  }

  // Check employee number uniqueness if being changed
  if (data.employeeNo && data.employeeNo !== existing.employeeNo) {
    const conflict = await prisma.employee.findFirst({
      where: {
        tenantId,
        employeeNo: data.employeeNo,
        NOT: { id: employeeId },
      },
      select: { id: true },
    })
    if (conflict) throw new Error('An employee with this employee number already exists')
  }

  // [S1] Verify new department belongs to tenant if changed
  if (data.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: data.departmentId, tenantId },
      select: { id: true },
    })
    if (!dept) throw new Error('Department not found')
  }

  const updated = await prisma.employee.update({
    where: { id: employeeId },
    data,
    select: employeeFullSelect,
  })

  // [S6] Log update
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'EMPLOYEE_UPDATED',
      targetType: 'Employee',
      targetId: employeeId,
      meta: { updatedFields: Object.keys(data) },
    },
  })

  return updated
}


// ─────────────────────────────────────────────
// STATUS MANAGEMENT
// [S5] Soft operations only — no hard deletes
// ─────────────────────────────────────────────

export const terminateEmployee = async (
  employeeId: string,
  tenantId: string,
  performedBy: string,
  data: {
    endDate: Date
    reason?: string
  }
) => {
  // [S1] Tenant scope enforced
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: { id: true, firstName: true, lastName: true, status: true },
  })

  if (!employee) throw new Error('Employee not found')

  if (employee.status === EmployeeStatus.TERMINATED) {
    throw new Error('Employee is already terminated')
  }

  const updated = await prisma.employee.update({
    where: { id: employeeId },
    data: {
      status: EmployeeStatus.TERMINATED,
      endDate: data.endDate,
    },
    select: employeeListSelect,
  })

  // [S6] Log termination with reason
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'EMPLOYEE_TERMINATED',
      targetType: 'Employee',
      targetId: employeeId,
      meta: {
        name: `${employee.firstName} ${employee.lastName}`,
        endDate: data.endDate,
        reason: data.reason ?? null,
      },
    },
  })

  return updated
}

export const updateEmployeeStatus = async (
  employeeId: string,
  tenantId: string,
  performedBy: string,
  status: Exclude<EmployeeStatus, 'TERMINATED'>  // termination has its own function
) => {
  // [S1] Tenant scope enforced
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: { id: true, status: true },
  })

  if (!employee) throw new Error('Employee not found')

  if (employee.status === EmployeeStatus.TERMINATED) {
    throw new Error('Cannot change status of a terminated employee')
  }

  const updated = await prisma.employee.update({
    where: { id: employeeId },
    data: { status },
    select: employeeListSelect,
  })

  // [S6] Log status change
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'EMPLOYEE_STATUS_CHANGED',
      targetType: 'Employee',
      targetId: employeeId,
      meta: {
        previousStatus: employee.status,
        newStatus: status,
      },
    },
  })

  return updated
}


// ─────────────────────────────────────────────
// DEPARTMENTS
// Tenant-scoped grouping
// ─────────────────────────────────────────────

export const listDepartments = async (tenantId: string) => {
  return prisma.department.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      _count: { select: { employees: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export const createDepartment = async (
  tenantId: string,
  performedBy: string,
  data: { name: string; description?: string }
) => {
  // [S1] Scoped to tenant
  const existing = await prisma.department.findFirst({
    where: { tenantId, name: { equals: data.name, mode: 'insensitive' } },
    select: { id: true },
  })

  if (existing) throw new Error('A department with this name already exists')

  const dept = await prisma.department.create({
    data: { tenantId, ...data },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
    },
  })

  // [S6] Log creation
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'DEPARTMENT_CREATED',
      targetType: 'Department',
      targetId: dept.id,
      meta: { name: data.name },
    },
  })

  return dept
}

export const updateDepartment = async (
  departmentId: string,
  tenantId: string,
  performedBy: string,
  data: Partial<{ name: string; description: string }>
) => {
  // [S1] Tenant scope enforced
  const dept = await prisma.department.findFirst({
    where: { id: departmentId, tenantId },
    select: { id: true },
  })

  if (!dept) throw new Error('Department not found')

  const updated = await prisma.department.update({
    where: { id: departmentId },
    data,
    select: { id: true, name: true, description: true },
  })

  // [S6] Log update
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'DEPARTMENT_UPDATED',
      targetType: 'Department',
      targetId: departmentId,
      meta: { updatedFields: Object.keys(data) },
    },
  })

  return updated
}

export const deleteDepartment = async (
  departmentId: string,
  tenantId: string,
  performedBy: string
) => {
  // [S1] Tenant scope enforced
  const dept = await prisma.department.findFirst({
    where: { id: departmentId, tenantId },
    select: {
      id: true,
      name: true,
      _count: { select: { employees: true } },
    },
  })

  if (!dept) throw new Error('Department not found')

  // Block deletion if employees are assigned
  if (dept._count.employees > 0) {
    throw new Error(
      `Cannot delete department with ${dept._count.employees} assigned employee(s). Reassign them first.`
    )
  }

  await prisma.department.delete({ where: { id: departmentId } })

  // [S6] Log deletion
  await prisma.userActivityLog.create({
    data: {
      userId: performedBy,
      action: 'DEPARTMENT_DELETED',
      targetType: 'Department',
      targetId: departmentId,
      meta: { name: dept.name },
    },
  })
}


// ─────────────────────────────────────────────
// EXPIRY DASHBOARD
// Employees with documents expiring soon
// Feeds the HR dashboard alert panel
// ─────────────────────────────────────────────

export const getExpirySnapshot = async (
  tenantId: string,
  withinDays: number = 90
) => {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() + withinDays)

  const [eidExpiring, passportExpiring, visaExpiring] = await Promise.all([
    // EID expiring
    prisma.employee.findMany({
      where: {
        tenantId,
        status: EmployeeStatus.ACTIVE,
        eidExpiry: { lte: threshold, gte: new Date() },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        eidNumber: true,
        eidExpiry: true,
        department: { select: { name: true } },
      },
      orderBy: { eidExpiry: 'asc' },
    }),

    // Passport expiring
    prisma.employee.findMany({
      where: {
        tenantId,
        status: EmployeeStatus.ACTIVE,
        passportExpiry: { lte: threshold, gte: new Date() },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        passportNumber: true,
        passportExpiry: true,
        department: { select: { name: true } },
      },
      orderBy: { passportExpiry: 'asc' },
    }),

    // Visa expiring (from VisaRecord)
    prisma.visaRecord.findMany({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
        expiryDate: { lte: threshold, gte: new Date() },
      },
      select: {
        id: true,
        visaType: true,
        expiryDate: true,
        status: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    }),
  ])

  return { eidExpiring, passportExpiring, visaExpiring }
}