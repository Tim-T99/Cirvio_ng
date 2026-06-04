// src/services/chat/orgInsights.service.ts
// ─────────────────────────────────────────────
// Aggregated, tenant-scoped organisation analytics for the AI assistant.
// Pure read. Computes the structural + cost signals the model reasons over
// when asked to analyse the org or suggest efficiency improvements.
// ─────────────────────────────────────────────

import { prisma } from '../../prisma/client'

interface MiniEmployee {
  id: string
  firstName: string
  lastName: string
  jobTitle: string
  status: string
  managerId: string | null
  departmentId: string | null
  jobLevel: number | null
  basicSalaryAed: number | null
  allowancesAed: number | null
}

const cost = (e: MiniEmployee) => (e.basicSalaryAed ?? 0) + (e.allowancesAed ?? 0)

export const getOrgOverview = async (tenantId: string) => {
  const [tenant, employees, departments] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true, country: true, status: true, trialEndsAt: true,
        plan: { select: { name: true, maxEmployees: true, maxAdmins: true } },
      },
    }),
    prisma.employee.findMany({
      where: { tenantId },
      select: {
        id: true, firstName: true, lastName: true, jobTitle: true, status: true,
        managerId: true, departmentId: true, jobLevel: true,
        basicSalaryAed: true, allowancesAed: true,
      },
    }),
    prisma.department.findMany({
      where: { tenantId },
      select: { id: true, name: true, parentDepartmentId: true },
    }),
  ])

  const byId = new Map(employees.map(e => [e.id, e as MiniEmployee]))

  // ── Headcount breakdowns ──────────────────────────────────────────────
  const byStatus: Record<string, number> = {}
  for (const e of employees) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1

  // ── Reporting tree ────────────────────────────────────────────────────
  const directReports = new Map<string, MiniEmployee[]>()
  const roots: MiniEmployee[] = []
  for (const e of employees as MiniEmployee[]) {
    const mid = e.managerId && byId.has(e.managerId) ? e.managerId : null
    if (mid) {
      const arr = directReports.get(mid) ?? []
      arr.push(e)
      directReports.set(mid, arr)
    } else {
      roots.push(e)
    }
  }

  // Depth via BFS from roots (cycle-safe — managers are validated, but guard).
  let maxDepth = 0
  const seen = new Set<string>()
  let layer = roots
  while (layer.length) {
    maxDepth++
    const next: MiniEmployee[] = []
    for (const e of layer) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      next.push(...(directReports.get(e.id) ?? []))
    }
    layer = next
  }

  const managers = [...directReports.entries()]
  const spans = managers.map(([id, reps]) => ({
    manager: byId.get(id),
    reports: reps.length,
  }))
  const totalManaged = spans.reduce((s, m) => s + m.reports, 0)
  const avgSpan = managers.length ? +(totalManaged / managers.length).toFixed(1) : 0

  const wideSpans = spans
    .filter(s => s.reports >= 8)
    .sort((a, b) => b.reports - a.reports)
    .slice(0, 10)
    .map(s => ({ name: `${s.manager?.firstName} ${s.manager?.lastName}`, title: s.manager?.jobTitle, reports: s.reports }))

  // Managers with exactly one report — often a redundant layer.
  const singleReportChains = spans
    .filter(s => s.reports === 1)
    .map(s => ({ name: `${s.manager?.firstName} ${s.manager?.lastName}`, title: s.manager?.jobTitle }))

  // Employees with no manager (excluding the single most-senior root if any).
  const unassigned = roots.map(e => ({ name: `${e.firstName} ${e.lastName}`, title: e.jobTitle }))

  // ── Department rollups (headcount + monthly cost) ─────────────────────
  const deptName = new Map(departments.map(d => [d.id, d.name]))
  const deptAgg = new Map<string, { headcount: number; monthlyCostAed: number }>()
  let unassignedDeptHeadcount = 0
  for (const e of employees as MiniEmployee[]) {
    if (!e.departmentId) { unassignedDeptHeadcount++; continue }
    const cur = deptAgg.get(e.departmentId) ?? { headcount: 0, monthlyCostAed: 0 }
    cur.headcount++
    cur.monthlyCostAed += cost(e)
    deptAgg.set(e.departmentId, cur)
  }
  const departmentBreakdown = [...deptAgg.entries()]
    .map(([id, v]) => ({ department: deptName.get(id) ?? 'Unknown', ...v }))
    .sort((a, b) => b.headcount - a.headcount)

  const totalMonthlyPayrollAed = employees.reduce((s, e) => s + cost(e as MiniEmployee), 0)
  const salaried = employees.filter(e => cost(e as MiniEmployee) > 0).length

  return {
    company: {
      name: tenant?.name,
      country: tenant?.country,
      status: tenant?.status,
      plan: tenant?.plan?.name ?? null,
      planLimits: tenant?.plan ? { maxEmployees: tenant.plan.maxEmployees, maxAdmins: tenant.plan.maxAdmins } : null,
      trialEndsAt: tenant?.trialEndsAt ?? null,
    },
    headcount: {
      total: employees.length,
      byStatus,
      departments: departments.length,
    },
    hierarchy: {
      depth: maxDepth,
      managers: managers.length,
      individualContributors: employees.length - managers.length,
      avgSpanOfControl: avgSpan,
      topLevel: roots.length,                       // people reporting to no one
      wideSpans,                                    // managers with >=8 reports
      singleReportManagers: singleReportChains,     // potential redundant layers
      employeesWithoutManager: unassigned,
    },
    cost: {
      totalMonthlyPayrollAed,
      salariedEmployees: salaried,
      employeesMissingSalary: employees.length - salaried,
      unassignedDeptHeadcount,
      departmentBreakdown,
    },
  }
}
