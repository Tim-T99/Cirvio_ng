// src/lib/export-datasets.ts
// ─────────────────────────────────────────────
// Clean, denormalized, report-ready datasets for BI export.
// One registry drives both the CSV export and the OData feed, so the columns,
// types and values stay identical across formats.
//
// Every fetcher is tenant-scoped. Columns use human-readable names; related
// records are resolved to names, dates are ISO strings, enums kept as-is.
// ─────────────────────────────────────────────

import { prisma } from '../prisma/client'

export type EdmType = 'String' | 'Int32' | 'Double' | 'Boolean' | 'DateTimeOffset'

export interface Column {
  name: string
  type: EdmType
}

export interface Dataset {
  key: string          // url slug, e.g. "employees"
  entitySet: string    // OData entity set, e.g. "Employees"
  label: string
  keyField: string     // unique key column for OData
  columns: Column[]
  fetch: (tenantId: string) => Promise<Record<string, unknown>[]>
}

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null)

const daysUntil = (d: Date | null | undefined): number | null => {
  if (!d) return null
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000)
}

const fullName = (p?: { firstName: string; lastName: string } | null): string | null =>
  p ? `${p.firstName} ${p.lastName}` : null

// ── Employees ────────────────────────────────────────────────────────────────

const employees: Dataset = {
  key: 'employees',
  entitySet: 'Employees',
  label: 'Employees',
  keyField: 'EmployeeId',
  columns: [
    { name: 'EmployeeId', type: 'String' },
    { name: 'EmployeeNo', type: 'String' },
    { name: 'FirstName', type: 'String' },
    { name: 'LastName', type: 'String' },
    { name: 'FullName', type: 'String' },
    { name: 'JobTitle', type: 'String' },
    { name: 'Department', type: 'String' },
    { name: 'Manager', type: 'String' },
    { name: 'JobLevel', type: 'Int32' },
    { name: 'Status', type: 'String' },
    { name: 'EmploymentType', type: 'String' },
    { name: 'Nationality', type: 'String' },
    { name: 'Gender', type: 'String' },
    { name: 'DateOfBirth', type: 'DateTimeOffset' },
    { name: 'StartDate', type: 'DateTimeOffset' },
    { name: 'EndDate', type: 'DateTimeOffset' },
    { name: 'WorkEmail', type: 'String' },
    { name: 'Phone', type: 'String' },
    { name: 'BasicSalaryAed', type: 'Double' },
    { name: 'AllowancesAed', type: 'Double' },
    { name: 'TotalMonthlyAed', type: 'Double' },
    { name: 'CreatedAt', type: 'DateTimeOffset' },
  ],
  fetch: async (tenantId) => {
    const rows = await prisma.employee.findMany({
      where: { tenantId },
      select: {
        id: true, employeeNo: true, firstName: true, lastName: true, jobTitle: true,
        jobLevel: true, status: true, employmentType: true, nationality: true, gender: true,
        dateOfBirth: true, startDate: true, endDate: true, workEmail: true, phone: true,
        basicSalaryAed: true, allowancesAed: true, createdAt: true,
        department: { select: { name: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
    return rows.map((e) => ({
      EmployeeId: e.id,
      EmployeeNo: e.employeeNo ?? null,
      FirstName: e.firstName,
      LastName: e.lastName,
      FullName: `${e.firstName} ${e.lastName}`,
      JobTitle: e.jobTitle,
      Department: e.department?.name ?? null,
      Manager: fullName(e.manager),
      JobLevel: e.jobLevel ?? null,
      Status: e.status,
      EmploymentType: e.employmentType,
      Nationality: e.nationality,
      Gender: e.gender ?? null,
      DateOfBirth: iso(e.dateOfBirth),
      StartDate: iso(e.startDate),
      EndDate: iso(e.endDate),
      WorkEmail: e.workEmail ?? null,
      Phone: e.phone ?? null,
      BasicSalaryAed: e.basicSalaryAed ?? null,
      AllowancesAed: e.allowancesAed ?? null,
      TotalMonthlyAed: (e.basicSalaryAed ?? 0) + (e.allowancesAed ?? 0),
      CreatedAt: iso(e.createdAt),
    }))
  },
}

// ── Visas ────────────────────────────────────────────────────────────────────

const visas: Dataset = {
  key: 'visas',
  entitySet: 'Visas',
  label: 'Visa records',
  keyField: 'VisaId',
  columns: [
    { name: 'VisaId', type: 'String' },
    { name: 'EmployeeNo', type: 'String' },
    { name: 'EmployeeName', type: 'String' },
    { name: 'VisaType', type: 'String' },
    { name: 'VisaNumber', type: 'String' },
    { name: 'Status', type: 'String' },
    { name: 'Emirate', type: 'String' },
    { name: 'IssueDate', type: 'DateTimeOffset' },
    { name: 'ExpiryDate', type: 'DateTimeOffset' },
    { name: 'DaysToExpiry', type: 'Int32' },
    { name: 'SponsorName', type: 'String' },
    { name: 'ResidenceVisaNo', type: 'String' },
    { name: 'CreatedAt', type: 'DateTimeOffset' },
  ],
  fetch: async (tenantId) => {
    const rows = await prisma.visaRecord.findMany({
      where: { tenantId },
      select: {
        id: true, visaType: true, visaNumber: true, status: true, emirate: true,
        issueDate: true, expiryDate: true, sponsorName: true, residenceVisaNo: true, createdAt: true,
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
      },
      orderBy: { expiryDate: 'asc' },
    })
    return rows.map((v) => ({
      VisaId: v.id,
      EmployeeNo: v.employee?.employeeNo ?? null,
      EmployeeName: fullName(v.employee),
      VisaType: v.visaType,
      VisaNumber: v.visaNumber ?? null,
      Status: v.status,
      Emirate: v.emirate ?? null,
      IssueDate: iso(v.issueDate),
      ExpiryDate: iso(v.expiryDate),
      DaysToExpiry: daysUntil(v.expiryDate),
      SponsorName: v.sponsorName ?? null,
      ResidenceVisaNo: v.residenceVisaNo ?? null,
      CreatedAt: iso(v.createdAt),
    }))
  },
}

// ── WPS / payroll ──────────────────────────────────────────────────────────────

const wps: Dataset = {
  key: 'wps',
  entitySet: 'WpsRecords',
  label: 'WPS / payroll records',
  keyField: 'WpsId',
  columns: [
    { name: 'WpsId', type: 'String' },
    { name: 'EmployeeNo', type: 'String' },
    { name: 'EmployeeName', type: 'String' },
    { name: 'Period', type: 'String' },
    { name: 'Month', type: 'Int32' },
    { name: 'Year', type: 'Int32' },
    { name: 'Status', type: 'String' },
    { name: 'PaymentDate', type: 'DateTimeOffset' },
    { name: 'BasicSalary', type: 'Double' },
    { name: 'HousingAllowance', type: 'Double' },
    { name: 'TransportAllowance', type: 'Double' },
    { name: 'OtherAllowances', type: 'Double' },
    { name: 'Deductions', type: 'Double' },
    { name: 'NetSalary', type: 'Double' },
    { name: 'IsLate', type: 'Boolean' },
    { name: 'LateByDays', type: 'Int32' },
  ],
  fetch: async (tenantId) => {
    const rows = await prisma.wpsRecord.findMany({
      where: { tenantId },
      select: {
        id: true, month: true, year: true, status: true, paymentDate: true,
        basicSalary: true, housingAllowance: true, transportAllowance: true,
        otherAllowances: true, deductions: true, netSalary: true, isLate: true, lateByDays: true,
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
    return rows.map((w) => ({
      WpsId: w.id,
      EmployeeNo: w.employee?.employeeNo ?? null,
      EmployeeName: fullName(w.employee),
      Period: `${w.year}-${String(w.month).padStart(2, '0')}`,
      Month: w.month,
      Year: w.year,
      Status: w.status,
      PaymentDate: iso(w.paymentDate),
      BasicSalary: w.basicSalary ?? null,
      HousingAllowance: w.housingAllowance ?? null,
      TransportAllowance: w.transportAllowance ?? null,
      OtherAllowances: w.otherAllowances ?? null,
      Deductions: w.deductions ?? null,
      NetSalary: w.netSalary ?? null,
      IsLate: w.isLate ?? false,
      LateByDays: w.lateByDays ?? null,
    }))
  },
}

// ── Documents ──────────────────────────────────────────────────────────────────

const documents: Dataset = {
  key: 'documents',
  entitySet: 'Documents',
  label: 'Documents',
  keyField: 'DocumentId',
  columns: [
    { name: 'DocumentId', type: 'String' },
    { name: 'EmployeeNo', type: 'String' },
    { name: 'EmployeeName', type: 'String' },
    { name: 'DocumentType', type: 'String' },
    { name: 'FileName', type: 'String' },
    { name: 'ExpiryDate', type: 'DateTimeOffset' },
    { name: 'DaysToExpiry', type: 'Int32' },
    { name: 'UploadedAt', type: 'DateTimeOffset' },
  ],
  fetch: async (tenantId) => {
    const rows = await prisma.document.findMany({
      where: { tenantId },
      select: {
        id: true, documentType: true, fileName: true, expiryDate: true, createdAt: true,
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
      },
      orderBy: { expiryDate: 'asc' },
    })
    return rows.map((d) => ({
      DocumentId: d.id,
      EmployeeNo: d.employee?.employeeNo ?? null,
      EmployeeName: fullName(d.employee),
      DocumentType: d.documentType,
      FileName: d.fileName,
      ExpiryDate: iso(d.expiryDate),
      DaysToExpiry: daysUntil(d.expiryDate),
      UploadedAt: iso(d.createdAt),
    }))
  },
}

// ── Departments (with cost rollups) ──────────────────────────────────────────

const departments: Dataset = {
  key: 'departments',
  entitySet: 'Departments',
  label: 'Departments',
  keyField: 'DepartmentId',
  columns: [
    { name: 'DepartmentId', type: 'String' },
    { name: 'Name', type: 'String' },
    { name: 'ParentDepartment', type: 'String' },
    { name: 'CostCenter', type: 'String' },
    { name: 'EmployeeCount', type: 'Int32' },
    { name: 'MonthlyPayrollAed', type: 'Double' },
  ],
  fetch: async (tenantId) => {
    const rows = await prisma.department.findMany({
      where: { tenantId },
      select: {
        id: true, name: true, costCenter: true,
        parent: { select: { name: true } },
        employees: { select: { basicSalaryAed: true, allowancesAed: true } },
      },
      orderBy: { name: 'asc' },
    })
    return rows.map((d) => ({
      DepartmentId: d.id,
      Name: d.name,
      ParentDepartment: d.parent?.name ?? null,
      CostCenter: d.costCenter ?? null,
      EmployeeCount: d.employees.length,
      MonthlyPayrollAed: d.employees.reduce((s, e) => s + (e.basicSalaryAed ?? 0) + (e.allowancesAed ?? 0), 0),
    }))
  },
}

export const DATASETS: Dataset[] = [employees, visas, wps, documents, departments]

export const datasetByKey = new Map(DATASETS.map((d) => [d.key, d]))
export const datasetByEntitySet = new Map(DATASETS.map((d) => [d.entitySet, d]))
