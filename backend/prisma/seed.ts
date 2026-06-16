// prisma/seed.ts
// ─────────────────────────────────────────────
// Large-scale test data seeder for stress-testing every feature.
//
// Creates three client organisations on three real plans (Starter / Professional
// / Enterprise) with different sizes, each with a full department -> head -> lead
// -> IC hierarchy, HR, many employees (most with login accounts), visa records
// across every status, several months of WPS payroll (some late/pending),
// document metadata, pending invites, and visa alerts.
//
// Deterministic + idempotent: it deletes the seed tenants by slug (cascade) and
// recreates them, so re-runs give the same data. Run with DATABASE_URL set:
//   railway run npm run seed         (recommended)
//   DATABASE_URL="<url>" npm run seed
// ─────────────────────────────────────────────

import {
  Emirate, VisaType, VisaStatus, VisaAlertType, AlertStatus, EmploymentType,
  EmployeeStatus, UserRole, WpsStatus, Gender, DocumentType,
} from '@prisma/client'
import { prisma } from '../src/prisma/client'
import { hashPassword, hashToken, generateToken } from '../utils/hash'

const PASSWORD = 'Cirvio#Test2026'

// Deterministic RNG so re-runs produce identical data.
let _s = 0x9e3779b9
const rnd = () => {
  _s |= 0; _s = (_s + 0x6d2b79f5) | 0
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)]
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min
const chance = (p: number) => rnd() < p
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000)
const yearsAgo = (y: number) => new Date(Date.now() - Math.floor(y * 365) * 86_400_000)

const FIRST = ['Omar', 'Layla', 'Khalid', 'Priya', 'Daniel', 'Sara', 'Mohammed', 'Elena', 'Tomás', 'Aisha', 'Ravi', 'Sofia', 'Chen', 'Ahmed', 'Grace', 'Noura', 'James', 'Fatima', 'Wei', 'Carlos', 'Anya', 'Yusuf', 'Mei', 'Ibrahim', 'Olga', 'Rahul', 'Hana', 'Diego', 'Ngozi', 'Sami', 'Lucia', 'Arjun', 'Zara', 'Marco', 'Leila', 'Kenji', 'Amara', 'Viktor', 'Nadia', 'Paulo']
const LAST = ['Haddad', 'Saeed', 'Rahman', 'Nair', 'Okoro', 'Ali', 'Iqbal', 'Petrova', 'Rivera', 'Mansour', 'Shankar', 'Rossi', 'Wei', 'Farouk', 'Mwangi', 'Al Qasimi', 'Carter', 'Hassan', 'Lim', 'Mendoza', 'Ivanova', 'Khan', 'Tanaka', 'Eze', 'Costa', 'Sharma', 'Yilmaz', 'Santos', 'Abubakar', 'Haidar']
const NAT = ['AE', 'IN', 'PK', 'PH', 'EG', 'NG', 'GB', 'KE', 'LB', 'IT', 'CN', 'RU', 'BD', 'JO', 'ZA']

interface TenantSpec {
  name: string; slug: string; email: string; emirate: Emirate; industry: string
  planName: string; size: number; departments: string[]
}

const TENANTS: TenantSpec[] = [
  {
    name: 'TechFlow Solutions FZ-LLC', slug: 'techflow', email: 'billing@techflow.ae',
    emirate: Emirate.DUBAI, industry: 'Technology', planName: 'Enterprise', size: 110,
    departments: ['Engineering', 'Product', 'Operations', 'Finance', 'Human Resources', 'Sales', 'Marketing', 'Customer Success'],
  },
  {
    name: 'Gulf Cargo Services LLC', slug: 'gulf-cargo', email: 'billing@gulfcargo.ae',
    emirate: Emirate.SHARJAH, industry: 'Logistics', planName: 'Professional', size: 38,
    departments: ['Operations', 'Fleet', 'Finance', 'Human Resources', 'Sales'],
  },
  {
    name: 'Marina Bay Hospitality Group', slug: 'marina-bay', email: 'billing@marinabay.ae',
    emirate: Emirate.ABU_DHABI, industry: 'Hospitality', planName: 'Starter', size: 16,
    departments: ['Front Office', 'Food & Beverage', 'Housekeeping', 'Finance', 'Human Resources'],
  },
]

const SALARY: Record<number, number> = { 1: 5000, 2: 9000, 3: 15000, 4: 24000, 5: 38000 }
const titleFor = (dept: string, level: number) =>
  level === 5 ? 'General Manager'
    : level === 4 ? `Head of ${dept}`
      : level === 3 ? `${dept} Team Lead`
        : level === 2 ? `${dept} Specialist`
          : `${dept} Associate`

function visaFor(): { status: VisaStatus; days: number; renewing: boolean } {
  const r = rnd()
  if (r < 0.60) return { status: VisaStatus.ACTIVE, days: int(120, 700), renewing: false }
  if (r < 0.78) return { status: VisaStatus.EXPIRING_SOON, days: int(1, 30), renewing: false }
  if (r < 0.88) return { status: VisaStatus.EXPIRED, days: -int(1, 60), renewing: false }
  if (r < 0.96) return { status: VisaStatus.RENEWAL_IN_PROGRESS, days: int(0, 45), renewing: true }
  return { status: VisaStatus.CANCELLED, days: int(30, 200), renewing: false }
}

function alertWindow(days: number): { type: VisaAlertType; remaining: number } | null {
  if (days < 0) return { type: VisaAlertType.EXPIRED, remaining: 0 }
  if (days <= 7) return { type: VisaAlertType.SEVEN_DAYS, remaining: days }
  if (days <= 14) return { type: VisaAlertType.FOURTEEN_DAYS, remaining: days }
  if (days <= 30) return { type: VisaAlertType.THIRTY_DAYS, remaining: days }
  if (days <= 60) return { type: VisaAlertType.SIXTY_DAYS, remaining: days }
  if (days <= 90) return { type: VisaAlertType.NINETY_DAYS, remaining: days }
  return null
}

async function main() {
  console.log('Seeding large-scale test data…')
  const passwordHash = await hashPassword(PASSWORD)

  // ── Plans (realistic tiers + feature entitlements) ──────────────────────
  const planDefs = [
    { name: 'Starter',      maxEmployees: 25,     maxAdmins: 3,   priceAed: 299,  features: [] as string[] },
    { name: 'Professional', maxEmployees: 150,    maxAdmins: 10,  priceAed: 799,  features: ['ai_assistant', 'data_export'] },
    { name: 'Enterprise',   maxEmployees: 100000, maxAdmins: 100, priceAed: 2499, features: undefined as unknown as string[] }, // null = all
  ]
  const plans: Record<string, { id: string }> = {}
  for (const p of planDefs) {
    const plan = await prisma.plan.upsert({
      where: { name: p.name },
      update: { maxEmployees: p.maxEmployees, maxAdmins: p.maxAdmins, priceAed: p.priceAed, features: p.features ?? undefined },
      create: { name: p.name, maxEmployees: p.maxEmployees, maxAdmins: p.maxAdmins, priceAed: p.priceAed, features: p.features ?? undefined },
    })
    plans[p.name] = plan
  }

  await prisma.tenant.deleteMany({ where: { slug: { in: TENANTS.map(t => t.slug) } } })

  const keyCreds: { org: string; plan: string; size: number; admin: string; hr: string; sampleEmployees: string[] }[] = []

  for (const t of TENANTS) {
    const tenant = await prisma.tenant.create({
      data: {
        name: t.name, slug: t.slug, email: t.email, country: 'AE', emirate: t.emirate,
        industry: t.industry, status: 'ACTIVE', planId: plans[t.planName].id,
        subscriptionEndsAt: daysFromNow(365),
      },
    })

    const deptIds: Record<string, string> = {}
    for (const d of t.departments) {
      const dep = await prisma.department.create({ data: { tenantId: tenant.id, name: d } })
      deptIds[d] = dep.id
    }

    // Deterministic owner admin + HR manager (not employees) — known credentials.
    const adminEmail = `admin@${t.slug}.ae`
    const hrEmailFixed = `hr@${t.slug}.ae`
    const gmEmail = `gm@${t.slug}.ae`
    await prisma.user.create({
      data: { tenantId: tenant.id, email: adminEmail, passwordHash, firstName: pick(FIRST), lastName: pick(LAST), role: UserRole.TENANT_ADMIN, isActive: true },
    })
    await prisma.user.create({
      data: { tenantId: tenant.id, email: hrEmailFixed, passwordHash, firstName: pick(FIRST), lastName: pick(LAST), role: UserRole.HR_MANAGER, isActive: true },
    })

    // ── Employees with hierarchy ──────────────────────────────────────────
    const usedEmail = new Set<string>()
    const emailFor = (first: string, last: string) => {
      const base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '')
      let e = `${base}@${t.slug}.ae`; let n = 2
      while (usedEmail.has(e)) e = `${base}${n++}@${t.slug}.ae`
      usedEmail.add(e); return e
    }

    const employees: { id: string; first: string; last: string; level: number; dept: string; salary: number }[] = []
    let seq = 0
    const credSamples: string[] = []

    const makeEmployee = async (level: number, dept: string, managerId: string | null, opts?: { login?: UserRole; email?: string }) => {
      seq++
      const first = pick(FIRST), last = pick(LAST)
      const basic = SALARY[level] + int(-1000, 2000)
      const allow = Math.round(basic * (0.3 + rnd() * 0.2))
      const workEmail = opts?.email ?? emailFor(first, last)
      if (opts?.email) usedEmail.add(opts.email)
      // status mix
      const sr = rnd()
      const status = sr < 0.88 ? EmployeeStatus.ACTIVE : sr < 0.94 ? EmployeeStatus.ON_LEAVE : sr < 0.98 ? EmployeeStatus.SUSPENDED : EmployeeStatus.TERMINATED
      const emp = await prisma.employee.create({
        data: {
          tenantId: tenant.id, firstName: first, lastName: last, nationality: pick(NAT),
          gender: chance(0.5) ? Gender.MALE : Gender.FEMALE, jobTitle: titleFor(dept, level),
          departmentId: deptIds[dept], managerId, jobLevel: level,
          employmentType: chance(0.85) ? EmploymentType.FULL_TIME : pick([EmploymentType.PART_TIME, EmploymentType.CONTRACT]),
          status, startDate: yearsAgo(0.3 + rnd() * 6),
          endDate: status === EmployeeStatus.TERMINATED ? daysFromNow(-int(10, 200)) : null,
          dateOfBirth: yearsAgo(24 + rnd() * 20),
          employeeNo: `${t.slug.slice(0, 3).toUpperCase()}-${String(seq).padStart(4, '0')}`,
          eidNumber: `784-${1985 + (seq % 15)}-${String(1000000 + seq * 31).slice(0, 7)}-${seq % 10}`,
          eidExpiry: daysFromNow(int(-30, 700)), passportNumber: `P${t.slug.slice(0, 2).toUpperCase()}${100000 + seq}`,
          passportExpiry: daysFromNow(int(60, 1200)), workEmail, phone: `+9715${(10000000 + seq * 137) % 90000000}`,
          basicSalaryAed: basic, allowancesAed: allow, wpsPersonId: `WPS${tenant.id.slice(0, 4)}${seq}`, wpsBankCode: pick(['ENBD', 'ADCB', 'FAB', 'MASHREQ']),
        },
      })
      employees.push({ id: emp.id, first, last, level, dept, salary: basic + allow })

      // Login account (skip terminated)
      if (opts?.login && status !== EmployeeStatus.TERMINATED) {
        await prisma.user.create({
          data: { tenantId: tenant.id, email: workEmail, passwordHash, firstName: first, lastName: last, role: opts.login, isActive: true, employeeId: emp.id },
        })
        if (credSamples.length < 3 && opts.login === UserRole.VIEWER && opts.email !== gmEmail) credSamples.push(workEmail)
      }
      return emp
    }

    // GM (deterministic login: gm@<slug>.ae)
    const gm = await makeEmployee(5, t.departments[0], null, { login: UserRole.VIEWER, email: gmEmail })
    // Department heads — each gets a Viewer login
    const heads: Record<string, string> = {}
    for (const d of t.departments) {
      const head = await makeEmployee(4, d, gm.id, { login: UserRole.VIEWER })
      heads[d] = head.id
    }
    // Optional leads + fill with ICs across departments
    let made = 1 + t.departments.length
    let di = 0
    while (made < t.size) {
      const dept = t.departments[di % t.departments.length]; di++
      const level = chance(0.18) ? 3 : chance(0.5) ? 2 : 1
      // ~1 in 6 employees get a login account
      const login = chance(0.16) ? UserRole.VIEWER : undefined
      await makeEmployee(level, dept, heads[dept], login ? { login } : undefined)
      made++
    }

    // ── Visas + alerts ────────────────────────────────────────────────────
    const visaRows = employees.map((e) => {
      const v = visaFor()
      return {
        tenantId: tenant.id, employeeId: e.id, visaType: pick([VisaType.EMPLOYMENT, VisaType.EMPLOYMENT, VisaType.INVESTOR, VisaType.DEPENDENT]),
        visaNumber: `${t.slug.slice(0, 3).toUpperCase()}-V-${e.id.slice(0, 8)}`, emirate: t.emirate,
        issueDate: yearsAgo(1 + rnd() * 2), expiryDate: daysFromNow(v.days), status: v.status,
        residenceVisaNo: `RV${100000 + int(0, 899999)}`, sponsorName: t.name,
        renewalInitiatedAt: v.renewing ? daysFromNow(-int(1, 20)) : null,
      }
    })
    await prisma.visaRecord.createMany({ data: visaRows })

    // Re-read visa ids to attach alerts (createMany doesn't return ids)
    const createdVisas = await prisma.visaRecord.findMany({ where: { tenantId: tenant.id }, select: { id: true, employeeId: true, expiryDate: true } })
    const alertRows = createdVisas.flatMap((v) => {
      const days = Math.ceil((v.expiryDate.getTime() - Date.now()) / 86_400_000)
      const w = alertWindow(days)
      if (!w) return []
      return [{
        tenantId: tenant.id, visaRecordId: v.id, employeeId: v.employeeId,
        alertType: w.type, triggerDate: new Date(), daysRemaining: w.remaining, status: AlertStatus.PENDING,
      }]
    })
    if (alertRows.length) await prisma.visaAlert.createMany({ data: alertRows })

    // ── WPS payroll: last 3 months ────────────────────────────────────────
    const now = new Date()
    const wpsRows = employees.flatMap((e) =>
      [1, 2, 3].map((back) => {
        const dt = new Date(now.getFullYear(), now.getMonth() - back, 1)
        const month = dt.getMonth() + 1, year = dt.getFullYear()
        const basic = SALARY[e.level] ?? 7000
        const allow = Math.round(e.salary - e.salary / 1.4)
        const recent = back === 1
        const late = chance(0.12)
        const pending = recent && chance(0.3)
        const paymentDate = pending ? null : new Date(year, month, late ? 18 : 5)
        const deadline = new Date(year, month, 10)
        return {
          tenantId: tenant.id, employeeId: e.id, month, year,
          basicSalary: basic, housingAllowance: Math.round(allow * 0.6), transportAllowance: Math.round(allow * 0.4),
          otherAllowances: 0, deductions: 0, netSalary: basic + allow, paymentDate,
          status: pending ? WpsStatus.PENDING : WpsStatus.CONFIRMED,
          isLate: !!(paymentDate && paymentDate > deadline),
          lateByDays: paymentDate && paymentDate > deadline ? Math.ceil((paymentDate.getTime() - deadline.getTime()) / 86_400_000) : null,
          wpsPersonId: `WPS${e.id.slice(0, 4)}`, wpsBankCode: 'ENBD',
        }
      })
    )
    await prisma.wpsRecord.createMany({ data: wpsRows })

    // ── Documents (metadata) for ~35% of employees ────────────────────────
    const docRows = employees.filter(() => chance(0.35)).flatMap((e) => ([
      { tenantId: tenant.id, employeeId: e.id, documentType: DocumentType.PASSPORT_COPY, fileName: 'passport.pdf', fileUrl: `uploads/${tenant.id}/${e.id}/passport.pdf`, mimeType: 'application/pdf', fileSizeKb: int(120, 900), expiryDate: daysFromNow(int(60, 1200)) },
      { tenantId: tenant.id, employeeId: e.id, documentType: DocumentType.VISA_COPY, fileName: 'visa.pdf', fileUrl: `uploads/${tenant.id}/${e.id}/visa.pdf`, mimeType: 'application/pdf', fileSizeKb: int(120, 900), expiryDate: daysFromNow(int(-20, 365)) },
    ]))
    if (docRows.length) await prisma.document.createMany({ data: docRows })

    // ── Pending invites ───────────────────────────────────────────────────
    const inviteRows = [UserRole.HR_MANAGER, UserRole.VIEWER, UserRole.VIEWER].map((role, i) => ({
      tenantId: tenant.id, email: `pending.invite${i + 1}@${t.slug}.ae`, role,
      token: hashToken(generateToken(32)), expiresAt: daysFromNow(7),
    }))
    await prisma.tenantInvite.createMany({ data: inviteRows })

    keyCreds.push({ org: t.name, plan: t.planName, size: employees.length, admin: adminEmail, hr: hrEmailFixed, sampleEmployees: [gmEmail, ...credSamples] })
    console.log(`  ${t.name}: ${employees.length} employees, ${t.departments.length} depts, ${createdVisas.length} visas, ${wpsRows.length} WPS, ${alertRows.length} alerts, plan=${t.planName}`)
  }

  console.log('\n════════════ LOGIN CREDENTIALS ════════════')
  console.log(`Password for EVERY account: ${PASSWORD}`)
  console.log('Log in with email + password (no org slug needed).\n')
  for (const c of keyCreds) {
    console.log(`■ ${c.org}  —  plan: ${c.plan}, ${c.size} employees`)
    console.log(`   Tenant admin : ${c.admin}`)
    if (c.hr) console.log(`   HR manager   : ${c.hr}`)
    console.log(`   Employee logins (Viewer) : ${c.sampleEmployees.join(', ')}${c.sampleEmployees.length ? '  … and more' : ''}`)
    console.log(`   (employee logins use the work email pattern firstname.lastname@${c.org.includes('TechFlow') ? 'techflow' : c.org.includes('Gulf') ? 'gulf-cargo' : 'marina-bay'}.ae)`)
    console.log('')
  }
  console.log('Tip: TechFlow (Enterprise) and Gulf Cargo (Professional) include AI + Data Export;')
  console.log('Marina Bay (Starter) does not — good for testing feature gating.')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('Seed failed:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
