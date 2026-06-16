// prisma/seed.ts
// ─────────────────────────────────────────────
// Test data seeder. Creates two realistic UAE client organisations, each with
// departments, an employee reporting hierarchy, visa records (varied expiry),
// recent WPS payroll records, and login accounts — including accounts for some
// employees themselves.
//
// Idempotent: it deletes the two seed tenants by slug first (cascades to all
// their data) and recreates them, so you can re-run it for a fresh state.
//
// Run it with DATABASE_URL pointing at your database, e.g.
//   DATABASE_URL="<your db url>" npm run seed
// ─────────────────────────────────────────────

import {
  Emirate, VisaType, VisaStatus, EmploymentType, EmployeeStatus,
  UserRole, WpsStatus, Gender,
} from '@prisma/client'
import { prisma } from '../src/prisma/client'
import { hashPassword } from '../utils/hash'

// One password for every seeded account, for easy testing.
const PASSWORD = 'Cirvio#Test2026'

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000)
const yearsAgo = (y: number) => new Date(Date.now() - y * 365 * 86_400_000)

type Login = { email: string; role: UserRole }

interface SeedEmp {
  key: string            // local ref for manager links
  first: string
  last: string
  nationality: string    // ISO-2
  jobTitle: string
  dept: string
  managerKey?: string
  level: number
  gender: Gender
  basic: number
  allow: number
  visaType: VisaType
  visaDays: number       // days until visa expiry (negative = expired)
  login?: Login          // if set, this employee also gets a login account
}

interface SeedTenant {
  name: string
  slug: string
  email: string
  emirate: Emirate
  industry: string
  admin: { first: string; last: string; email: string }
  hr: { first: string; last: string; email: string }
  departments: string[]
  employees: SeedEmp[]
}

const TENANTS: SeedTenant[] = [
  {
    name: 'Gulf Cargo Services LLC',
    slug: 'gulf-cargo',
    email: 'billing@gulfcargo.ae',
    emirate: Emirate.DUBAI,
    industry: 'Logistics',
    admin: { first: 'Omar', last: 'Haddad', email: 'admin@gulfcargo.ae' },
    hr: { first: 'Layla', last: 'Saeed', email: 'hr@gulfcargo.ae' },
    departments: ['Operations', 'Finance', 'Human Resources', 'Sales'],
    employees: [
      { key: 'gm',  first: 'Khalid', last: 'Rahman',  nationality: 'PK', jobTitle: 'General Manager',   dept: 'Operations',      level: 5, gender: Gender.MALE,   basic: 32000, allow: 12000, visaType: VisaType.EMPLOYMENT, visaDays: 220, login: { email: 'khalid@gulfcargo.ae', role: UserRole.VIEWER } },
      { key: 'ops', first: 'Priya',  last: 'Nair',    nationality: 'IN', jobTitle: 'Operations Manager', dept: 'Operations', managerKey: 'gm', level: 4, gender: Gender.FEMALE, basic: 18000, allow: 6000, visaType: VisaType.EMPLOYMENT, visaDays: 25, login: { email: 'priya@gulfcargo.ae', role: UserRole.VIEWER } },
      { key: 'fin', first: 'Daniel', last: 'Okoro',   nationality: 'NG', jobTitle: 'Finance Manager',    dept: 'Finance',    managerKey: 'gm', level: 4, gender: Gender.MALE,   basic: 19000, allow: 6000, visaType: VisaType.EMPLOYMENT, visaDays: 120 },
      { key: 'e1',  first: 'Sara',   last: 'Ali',     nationality: 'EG', jobTitle: 'Logistics Coordinator', dept: 'Operations', managerKey: 'ops', level: 2, gender: Gender.FEMALE, basic: 7500, allow: 2500, visaType: VisaType.EMPLOYMENT, visaDays: 7, login: { email: 'sara@gulfcargo.ae', role: UserRole.VIEWER } },
      { key: 'e2',  first: 'Mohammed', last: 'Iqbal', nationality: 'PK', jobTitle: 'Warehouse Supervisor', dept: 'Operations', managerKey: 'ops', level: 2, gender: Gender.MALE, basic: 6500, allow: 2000, visaType: VisaType.EMPLOYMENT, visaDays: 55 },
      { key: 'e3',  first: 'Elena',  last: 'Petrova', nationality: 'RU', jobTitle: 'Accountant',         dept: 'Finance',    managerKey: 'fin', level: 2, gender: Gender.FEMALE, basic: 9000, allow: 3000, visaType: VisaType.EMPLOYMENT, visaDays: 200 },
      { key: 'e4',  first: 'Tomás',  last: 'Rivera',  nationality: 'PH', jobTitle: 'Driver',             dept: 'Operations', managerKey: 'ops', level: 1, gender: Gender.MALE, basic: 4000, allow: 1500, visaType: VisaType.EMPLOYMENT, visaDays: -5 },
    ],
  },
  {
    name: 'Marina Bay Hospitality Group',
    slug: 'marina-bay',
    email: 'billing@marinabay.ae',
    emirate: Emirate.ABU_DHABI,
    industry: 'Hospitality',
    admin: { first: 'Noura', last: 'Al Qasimi', email: 'admin@marinabay.ae' },
    hr: { first: 'James', last: 'Carter', email: 'hr@marinabay.ae' },
    departments: ['Front Office', 'Food & Beverage', 'Finance', 'Housekeeping'],
    employees: [
      { key: 'dir', first: 'Aisha',  last: 'Mansour', nationality: 'LB', jobTitle: 'Hotel Director',    dept: 'Front Office',  level: 5, gender: Gender.FEMALE, basic: 35000, allow: 14000, visaType: VisaType.EMPLOYMENT, visaDays: 300, login: { email: 'aisha@marinabay.ae', role: UserRole.VIEWER } },
      { key: 'fo',  first: 'Ravi',   last: 'Shankar', nationality: 'IN', jobTitle: 'Front Office Manager', dept: 'Front Office', managerKey: 'dir', level: 4, gender: Gender.MALE, basic: 16000, allow: 5000, visaType: VisaType.EMPLOYMENT, visaDays: 14, login: { email: 'ravi@marinabay.ae', role: UserRole.VIEWER } },
      { key: 'fb',  first: 'Sofia',  last: 'Rossi',   nationality: 'IT', jobTitle: 'F&B Manager',        dept: 'Food & Beverage', managerKey: 'dir', level: 4, gender: Gender.FEMALE, basic: 17000, allow: 5000, visaType: VisaType.EMPLOYMENT, visaDays: 60 },
      { key: 'm1',  first: 'Chen',   last: 'Wei',     nationality: 'CN', jobTitle: 'Receptionist',       dept: 'Front Office', managerKey: 'fo', level: 1, gender: Gender.FEMALE, basic: 5000, allow: 1800, visaType: VisaType.EMPLOYMENT, visaDays: 30, login: { email: 'chen@marinabay.ae', role: UserRole.VIEWER } },
      { key: 'm2',  first: 'Ahmed',  last: 'Farouk',  nationality: 'EG', jobTitle: 'Chef',               dept: 'Food & Beverage', managerKey: 'fb', level: 2, gender: Gender.MALE, basic: 8500, allow: 2500, visaType: VisaType.EMPLOYMENT, visaDays: 90 },
      { key: 'm3',  first: 'Grace',  last: 'Mwangi',  nationality: 'KE', jobTitle: 'Housekeeping Lead',   dept: 'Housekeeping', managerKey: 'dir', level: 2, gender: Gender.FEMALE, basic: 4500, allow: 1500, visaType: VisaType.EMPLOYMENT, visaDays: 45 },
    ],
  },
]

function visaStatusFor(days: number): VisaStatus {
  if (days < 0) return VisaStatus.EXPIRED
  if (days <= 30) return VisaStatus.EXPIRING_SOON
  return VisaStatus.ACTIVE
}

async function main() {
  console.log('Seeding test data…')
  const passwordHash = await hashPassword(PASSWORD)

  // Shared plan (all features enabled → null means all).
  const plan = await prisma.plan.upsert({
    where: { name: 'Growth (seed)' },
    update: {},
    create: { name: 'Growth (seed)', maxEmployees: 200, maxAdmins: 10, priceAed: 799, features: undefined },
  })

  // Fresh start for the two seed tenants (cascade deletes all their data).
  await prisma.tenant.deleteMany({ where: { slug: { in: TENANTS.map(t => t.slug) } } })

  const summary: { org: string; name: string; email: string; role: string }[] = []

  for (const t of TENANTS) {
    const tenant = await prisma.tenant.create({
      data: {
        name: t.name, slug: t.slug, email: t.email, country: 'AE',
        emirate: t.emirate, industry: t.industry, status: 'ACTIVE',
        planId: plan.id, subscriptionEndsAt: daysFromNow(365),
      },
    })

    // Departments
    const deptIds: Record<string, string> = {}
    for (const name of t.departments) {
      const d = await prisma.department.create({ data: { tenantId: tenant.id, name } })
      deptIds[name] = d.id
    }

    // Account-owner admin + HR manager (not employees)
    await prisma.user.create({
      data: { tenantId: tenant.id, email: t.admin.email, passwordHash, firstName: t.admin.first, lastName: t.admin.last, role: UserRole.TENANT_ADMIN, isActive: true },
    })
    summary.push({ org: t.name, name: `${t.admin.first} ${t.admin.last}`, email: t.admin.email, role: 'TENANT_ADMIN' })
    await prisma.user.create({
      data: { tenantId: tenant.id, email: t.hr.email, passwordHash, firstName: t.hr.first, lastName: t.hr.last, role: UserRole.HR_MANAGER, isActive: true },
    })
    summary.push({ org: t.name, name: `${t.hr.first} ${t.hr.last}`, email: t.hr.email, role: 'HR_MANAGER' })

    // Employees (pass 1: create without managers)
    const empIds: Record<string, string> = {}
    let seq = 1
    for (const e of t.employees) {
      const emp = await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          firstName: e.first, lastName: e.last, nationality: e.nationality, gender: e.gender,
          jobTitle: e.jobTitle, departmentId: deptIds[e.dept] ?? null, jobLevel: e.level,
          employmentType: EmploymentType.FULL_TIME, status: EmployeeStatus.ACTIVE,
          startDate: yearsAgo(1 + (seq % 4)), dateOfBirth: yearsAgo(28 + (seq % 12)),
          employeeNo: `${t.slug.toUpperCase().slice(0, 3)}-${String(seq).padStart(3, '0')}`,
          eidNumber: `784-${1980 + seq}-${String(1000000 + seq * 7).slice(0, 7)}-${seq % 10}`,
          eidExpiry: daysFromNow(e.visaDays), passportExpiry: daysFromNow(e.visaDays + 60),
          passportNumber: `P${t.slug.slice(0, 2).toUpperCase()}${100000 + seq}`,
          workEmail: `${e.first.toLowerCase()}.${e.last.toLowerCase()}@${t.slug}.ae`,
          phone: `+9715${(10000000 + seq * 137) % 90000000}`,
          basicSalaryAed: e.basic, allowancesAed: e.allow,
          wpsPersonId: `WPS${tenant.id.slice(0, 4)}${seq}`, wpsBankCode: 'ENBD',
        },
      })
      empIds[e.key] = emp.id
      seq++
    }

    // Employees (pass 2: link managers)
    for (const e of t.employees) {
      if (e.managerKey && empIds[e.managerKey]) {
        await prisma.employee.update({ where: { id: empIds[e.key] }, data: { managerId: empIds[e.managerKey] } })
      }
    }

    // Visas + recent WPS + optional employee logins
    const now = new Date()
    for (const e of t.employees) {
      const employeeId = empIds[e.key]
      const expiry = daysFromNow(e.visaDays)

      await prisma.visaRecord.create({
        data: {
          tenantId: tenant.id, employeeId, visaType: e.visaType,
          visaNumber: `${t.slug.slice(0, 3).toUpperCase()}-V-${empIds[e.key].slice(0, 6)}`,
          emirate: t.emirate, issueDate: yearsAgo(2), expiryDate: expiry,
          residenceVisaNo: `RV${100000 + e.basic}`, sponsorName: t.name,
          status: visaStatusFor(e.visaDays),
        },
      })

      // Two most recent completed months of WPS, paid on time.
      for (let back = 1; back <= 2; back++) {
        const dt = new Date(now.getFullYear(), now.getMonth() - back, 1)
        const month = dt.getMonth() + 1
        const year = dt.getFullYear()
        await prisma.wpsRecord.create({
          data: {
            tenantId: tenant.id, employeeId, month, year,
            basicSalary: e.basic, housingAllowance: Math.round(e.allow * 0.6),
            transportAllowance: Math.round(e.allow * 0.4), otherAllowances: 0, deductions: 0,
            netSalary: e.basic + e.allow,
            paymentDate: new Date(year, month, 5), // 5th of the following month — on time
            status: WpsStatus.CONFIRMED, wpsPersonId: `WPS${employeeId.slice(0, 4)}`, wpsBankCode: 'ENBD',
          },
        })
      }

      if (e.login) {
        await prisma.user.create({
          data: {
            tenantId: tenant.id, email: e.login.email, passwordHash,
            firstName: e.first, lastName: e.last, role: e.login.role, isActive: true,
            employeeId, // link the login to the employee record
          },
        })
        summary.push({ org: t.name, name: `${e.first} ${e.last}`, email: e.login.email, role: `${e.login.role} (employee)` })
      }
    }

    console.log(`  ${t.name}: ${t.employees.length} employees, ${t.departments.length} departments`)
  }

  console.log('\n──────────── LOGIN CREDENTIALS ────────────')
  console.log(`Password for every account below:  ${PASSWORD}\n`)
  for (const t of TENANTS) {
    console.log(`■ ${t.name}  (organisation slug: ${t.slug})`)
    for (const row of summary.filter(s => s.org === t.name)) {
      console.log(`   ${row.role.padEnd(22)} ${row.email}`)
    }
    console.log('')
  }
  console.log('Done. Log in at your frontend /login with the org slug + email + the password above.')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('Seed failed:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
