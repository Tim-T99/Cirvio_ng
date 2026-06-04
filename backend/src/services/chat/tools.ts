// src/services/chat/tools.ts
// ─────────────────────────────────────────────
// Tool registry for the AI assistant.
//
// SAFETY: every executor receives the tenantId/role from the authenticated
// session (ctx) — NEVER from the model. Tools are read-only in this phase and
// route through the same tenant-scoped services the REST API uses, so the
// model can never see another tenant's data or widen its own scope.
// ─────────────────────────────────────────────

import { ToolDef } from '../../lib/anthropic'
import * as employeeService from '../employee.service'
import * as visaService from '../visa.service'
import * as wpsService from '../wps.service'
import * as documentService from '../document.service'
import { getOrgOverview } from './orgInsights.service'

export interface ChatContext {
  tenantId: string
  userId: string
  role: string
}

type Executor = (ctx: ChatContext, args: Record<string, any>) => Promise<unknown>

interface RegisteredTool {
  def: ToolDef
  run: Executor
}

const tools: RegisteredTool[] = [
  {
    def: {
      name: 'get_org_overview',
      description:
        'Get a structured snapshot of the whole organisation: headcount and status breakdown, reporting hierarchy (depth, managers, spans of control, wide spans, single-report managers, employees with no manager), department headcount + monthly payroll cost, plan limits and subscription status. Use this first when asked anything about org structure, size, efficiency, or cost.',
      input_schema: { type: 'object', properties: {} },
    },
    run: (ctx) => getOrgOverview(ctx.tenantId),
  },
  {
    def: {
      name: 'list_employees',
      description:
        'List employees (paginated, max 50 per page). Use to find specific people or count by criteria. Returns id, name, job title, status, department and managerId. Use the returned id with get_employee for full detail.',
      input_schema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Match name, job title, employee no. or work email' },
          status: { type: 'string', enum: ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'] },
          employmentType: { type: 'string', enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE'] },
          page: { type: 'number' },
          pageSize: { type: 'number', description: 'Default 20, max 50' },
        },
      },
    },
    run: async (ctx, args) => {
      const res: any = await employeeService.listEmployees(ctx.tenantId, {
        search: args.search,
        status: args.status,
        employmentType: args.employmentType,
        page: args.page ? Number(args.page) : 1,
        pageSize: Math.min(args.pageSize ? Number(args.pageSize) : 20, 50),
      })
      return {
        total: res.total,
        page: res.page,
        employees: (res.data ?? []).map((e: any) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          jobTitle: e.jobTitle,
          status: e.status,
          department: e.department?.name ?? null,
          managerId: e.managerId ?? null,
        })),
      }
    },
  },
  {
    def: {
      name: 'get_employee',
      description:
        'Get full detail for one employee by id, including manager, direct reports, and a summary of their visa, WPS and document records. Get the id from list_employees first.',
      input_schema: {
        type: 'object',
        properties: { employeeId: { type: 'string', description: 'Employee UUID' } },
        required: ['employeeId'],
      },
    },
    run: async (ctx, args) => {
      const e: any = await employeeService.getEmployeeWithRecords(args.employeeId, ctx.tenantId)
      return {
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        jobTitle: e.jobTitle,
        status: e.status,
        department: e.department?.name ?? null,
        employmentType: e.employmentType,
        startDate: e.startDate,
        nationality: e.nationality,
        manager: e.manager ? `${e.manager.firstName} ${e.manager.lastName} (${e.manager.jobTitle ?? ''})` : null,
        directReports: (e.reports ?? []).map((r: any) => `${r.firstName} ${r.lastName} (${r.jobTitle ?? ''})`),
        monthlySalaryAed: (e.basicSalaryAed ?? 0) + (e.allowancesAed ?? 0),
        counts: e._count,
        visaRecords: (e.visaRecords ?? []).map((v: any) => ({ type: v.visaType, status: v.status, expiry: v.expiryDate })),
        recentWps: (e.wpsRecords ?? []).slice(0, 3).map((w: any) => ({ month: w.month, year: w.year, status: w.status, late: w.isLate })),
      }
    },
  },
  {
    def: {
      name: 'get_compliance_summary',
      description:
        'Get the tenant compliance posture: visa status counts and pending expiry alerts, WPS submission/lateness/violation stats for the current year, and documents expiring within 90 days. Use for questions about compliance risk, expiring visas, WPS, or deadlines.',
      input_schema: { type: 'object', properties: {} },
    },
    run: async (ctx) => {
      const year = new Date().getFullYear()
      const [visa, wps, expiringDocs] = await Promise.all([
        visaService.getVisaDashboardSummary(ctx.tenantId),
        wpsService.getWpsDashboardSummary(ctx.tenantId, year),
        documentService.getExpiringDocuments(ctx.tenantId, 90),
      ])
      return {
        visa,
        wps,
        documentsExpiringWithin90Days: (expiringDocs ?? []).map((d: any) => ({
          type: d.documentType,
          fileName: d.fileName,
          expiry: d.expiryDate,
          employee: d.employee ? `${d.employee.firstName} ${d.employee.lastName}` : undefined,
        })),
      }
    },
  },
]

export const toolDefs: ToolDef[] = tools.map(t => t.def)

const byName = new Map(tools.map(t => [t.def.name, t]))

export async function runTool(ctx: ChatContext, name: string, args: Record<string, any>): Promise<unknown> {
  const tool = byName.get(name)
  if (!tool) throw new Error(`Unknown tool: ${name}`)
  return tool.run(ctx, args ?? {})
}
