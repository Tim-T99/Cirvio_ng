import { Component, AfterViewInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo.service';

interface FeatureBlock {
  icon: string;
  title: string;
  subtitle: string;
  points: string[];
  visual: { label: string; value: string; color: string }[];
}

interface Extra { icon: string; title: string; desc: string; }

@Component({
  selector: 'app-features',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './features.html',
})
export class FeaturesComponent implements AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private seo = inject(SeoService);
  private observer?: IntersectionObserver;

  constructor() {
    this.seo.set({
      title: 'Features — Visa, Emirates ID & WPS Compliance Tools | Cirvio',
      description: 'Every tool your HR team needs: employee records, visa & Emirates ID tracking, WPS payroll compliance, smart alerts, an AI workforce assistant, and Power BI / CSV export.',
      path: '/features',
    });
  }

  readonly features: FeatureBlock[] = [
    {
      icon: 'users',
      title: 'Employee Management',
      subtitle: 'Complete digital HR records for every team member.',
      points: [
        'Full employee profiles — personal details, emergency contacts, job history',
        'Departments and a real reporting hierarchy, visualised as an org chart',
        'Employment details, salary, and document storage per employee',
        'Role-based access so HR managers and viewers see only what they need',
        'Export any employee data to CSV or your BI tool in one click',
      ],
      visual: [
        { label: 'Total employees',  value: '84',  color: 'var(--fg-1)' },
        { label: 'Departments',      value: '9',   color: 'var(--fg-1)' },
        { label: 'Active',           value: '81',  color: 'var(--success)' },
        { label: 'Expiring soon',    value: '3',   color: 'var(--warning)' },
      ],
    },
    {
      icon: 'shield',
      title: 'Visa & Immigration Tracking',
      subtitle: 'Never miss a visa renewal again.',
      points: [
        'Track all visa types — employment, residence, investor, dependent, golden',
        'Automated expiry alerts at 90, 60, 30, 14, and 7 days before expiry',
        'A daily engine flags expiring and expired visas automatically',
        'Store visa numbers, sponsor, emirate, entry-permit and residence details',
        'Emirates ID and labour-card expiry tracked alongside every visa',
      ],
      visual: [
        { label: 'Employment visa', value: '62',  color: 'var(--success)' },
        { label: 'Residence visa',  value: '18',  color: 'var(--success)' },
        { label: 'Expiring <30d',   value: '6',   color: 'var(--danger)' },
        { label: 'Expiring <60d',   value: '11',  color: 'var(--warning)' },
      ],
    },
    {
      icon: 'file',
      title: 'WPS Compliance',
      subtitle: 'Wage Protection System filing, simplified.',
      points: [
        'Monthly payroll records with a full audit trail',
        'WPS SIF file generation in the MOHRE-approved format',
        'Salary breakdown per employee — basic, allowances, deductions, net',
        'WPS compliance dashboard with submission and lateness status',
        'Bulk-create a month’s payroll for all active employees at once',
      ],
      visual: [
        { label: 'Last WPS filing',   value: 'On time',    color: 'var(--success)' },
        { label: 'This cycle status', value: 'Due Jun 14', color: 'var(--warning)' },
        { label: 'Employees paid',    value: '84 / 84',    color: 'var(--success)' },
        { label: 'SIF file',          value: 'Ready',      color: 'var(--info)' },
      ],
    },
    {
      icon: 'bell',
      title: 'Smart Alerts',
      subtitle: 'Get ahead of every deadline on a live dashboard.',
      points: [
        'A daily engine watches every visa, ID, and WPS deadline automatically',
        'Visa alerts at 90, 60, 30, 14, and 7 days before expiry',
        'In-app alerts surfaced on a live compliance dashboard',
        'Dismiss or resolve alerts, with status tracked per record',
        'No configuration needed — it runs from the day you add an employee',
      ],
      visual: [
        { label: 'Active alerts',  value: '14', color: 'var(--warning)' },
        { label: 'Resolved today', value: '3',  color: 'var(--success)' },
        { label: 'Critical',       value: '2',  color: 'var(--danger)' },
        { label: 'Upcoming 30d',   value: '9',  color: 'var(--info)' },
      ],
    },
    {
      icon: 'sparkles',
      title: 'AI Workforce Assistant',
      subtitle: 'Ask questions about your organisation in plain language.',
      points: [
        'Reads your live, tenant-scoped data — never another company’s',
        'Answers questions about headcount, structure, visas, and WPS',
        'Surfaces efficiency insights — wide spans, thin teams, cost outliers',
        'Every data lookup it makes is logged for a full audit trail',
        'Read-only and safe: it advises, your team decides',
      ],
      visual: [
        { label: 'Avg span',       value: '5.2',  color: 'var(--fg-1)' },
        { label: 'Org depth',      value: '4',    color: 'var(--fg-1)' },
        { label: 'No manager',     value: '3',    color: 'var(--warning)' },
        { label: 'Insights',       value: 'Live', color: 'var(--info)' },
      ],
    },
    {
      icon: 'chart',
      title: 'Power BI & Data Export',
      subtitle: 'Turn your workforce data into reports in minutes.',
      points: [
        'Live OData feed — connect Power BI or Tableau and refresh on schedule',
        'One-click CSV export of clean, report-ready datasets',
        'Employees, visas, WPS, documents and departments, denormalised',
        'Per-tenant access tokens you can create and revoke at any time',
        'Human-readable columns and derived fields, ready to pivot',
      ],
      visual: [
        { label: 'Datasets',   value: '5',        color: 'var(--fg-1)' },
        { label: 'Power BI',   value: 'Live',     color: 'var(--success)' },
        { label: 'Tableau',    value: 'OData',    color: 'var(--success)' },
        { label: 'CSV',        value: '1-click',  color: 'var(--info)' },
      ],
    },
  ];

  readonly extras: Extra[] = [
    { icon: 'doc',     title: 'Document Storage',     desc: 'Secure repository for employee and company files, with expiry tracking.' },
    { icon: 'chart',   title: 'Power BI & CSV Export',desc: 'Connect a live OData feed to Power BI or Tableau, or export clean CSVs.' },
    { icon: 'lock',    title: 'Role-based Access',    desc: 'Tenant Admin, HR Manager, and Viewer roles with granular permissions.' },
    { icon: 'refresh', title: 'Passwordless Sign-in', desc: 'Sign in with passkeys — Face ID, Touch ID, or a security key. No password to phish.' },
  ];

  // ── Per-feature mockup data ────────────────────────────────────────────────
  screenRoute(icon: string): string {
    return { users: 'employees', shield: 'visas', file: 'wps', bell: 'visas', sparkles: 'chat', chart: 'settings' }[icon] ?? 'dashboard';
  }

  readonly visaRows = [
    { name: 'Ahmed Al Mansoori', type: 'Employment', days: 12, status: 'Expiring', urgent: true },
    { name: 'Sarah Okafor',      type: 'Residence',  days: 24, status: 'Expiring', urgent: false },
    { name: 'Ravi Shankar',      type: 'Employment', days: 31, status: 'Expiring', urgent: false },
    { name: 'Mei Lin',           type: 'Investor',   days: 88, status: 'Active',   urgent: false },
  ];

  readonly alertRows = [
    { name: 'Visa — A. Al Mansoori', sub: 'Employment · expires in 12 days', level: 'danger' },
    { name: 'Emirates ID — S. Okafor', sub: 'Renewal due in 24 days', level: 'warning' },
    { name: 'WPS filing', sub: 'June cycle due Jun 14', level: 'warning' },
    { name: 'Labour card — R. Shankar', sub: 'Expires in 31 days', level: 'info' },
  ];

  readonly aiMsgs: { role: 'user' | 'ai'; text: string; chips?: string[] }[] = [
    { role: 'user', text: 'Where are we top-heavy?' },
    { role: 'ai',   text: 'Operations has 11 reports under one manager — the widest span in the org. Three employees also have no manager assigned.', chips: ['Org overview'] },
  ];

  readonly exportSets = [
    { name: 'Employees', rows: 84 },
    { name: 'Visas', rows: 80 },
    { name: 'WPS records', rows: 1008 },
    { name: 'Departments', rows: 9 },
  ];

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach(el => this.observer!.observe(el));
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
