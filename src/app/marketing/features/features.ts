import { Component, AfterViewInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

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
  private observer?: IntersectionObserver;

  readonly features: FeatureBlock[] = [
    {
      icon: 'users',
      title: 'Employee Management',
      subtitle: 'Complete digital HR records for every team member.',
      points: [
        'Full employee profiles — personal details, emergency contacts, job history',
        'Department and role management with organisational hierarchy',
        'Employment contract storage and expiry tracking',
        'Bulk employee import via CSV or manual entry',
        'Role-based access so HR managers see only what they need',
      ],
      visual: [
        { label: 'Total employees',  value: '84',  color: 'var(--fg-1)' },
        { label: 'Departments',      value: '9',   color: 'var(--fg-1)' },
        { label: 'Active contracts', value: '81',  color: 'var(--success)' },
        { label: 'Expiring soon',    value: '3',   color: 'var(--warning)' },
      ],
    },
    {
      icon: 'shield',
      title: 'Visa & Immigration Tracking',
      subtitle: 'Never miss a visa renewal again.',
      points: [
        'Track all visa types — employment, residence, investor, visit',
        'Automated expiry alerts at 90, 60, and 30 days',
        'Store visa documents, entry stamps, and renewal records',
        'GDRFA and ICA status monitoring',
        'Renewal workflow with assignable tasks for your PRO team',
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
        'Monthly payroll records with full audit trail',
        'WPS SIF file generation for MOHRE submission',
        'Salary history per employee with change log',
        'Filing deadline reminders and calendar view',
        'MOL compliance status dashboard',
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
      subtitle: 'Proactive notifications before deadlines hit.',
      points: [
        'Configurable alert windows — 30, 60, or 90 days',
        'Email and in-app notifications for all team members',
        'Escalation rules if actions are not acknowledged',
        'Digest summaries — daily or weekly compliance reports',
        'Alert history and acknowledgement audit trail',
      ],
      visual: [
        { label: 'Active alerts',  value: '14', color: 'var(--warning)' },
        { label: 'Resolved today', value: '3',  color: 'var(--success)' },
        { label: 'Critical',       value: '2',  color: 'var(--danger)' },
        { label: 'Upcoming 30d',   value: '9',  color: 'var(--info)' },
      ],
    },
  ];

  readonly extras: Extra[] = [
    { icon: 'doc',     title: 'Document Storage',   desc: 'Centralised, secure document repository for all employee and company files.' },
    { icon: 'chart',   title: 'Compliance Reports', desc: 'Export audit-ready reports for MOHRE, GDRFA, and internal HR reviews.' },
    { icon: 'lock',    title: 'Role-based Access',  desc: 'Tenant Admin, HR Manager, and Viewer roles with granular permissions.' },
    { icon: 'refresh', title: 'Renewal Workflows',  desc: 'Assign renewal tasks to your PRO team with due dates and status tracking.' },
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
