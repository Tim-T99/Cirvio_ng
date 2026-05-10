import { Component, AfterViewInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Feature { icon: string; title: string; desc: string; }
interface Step { n: string; title: string; desc: string; }
interface Stat { value: string; label: string; }
interface HeroStat { label: string; value: string; sub: string; warn?: boolean; ok?: boolean; }
interface Alert { name: string; type: string; days: number; urgent: boolean; }
interface Calendar { name: string; date: string; status: string; dot: string; }

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private observer?: IntersectionObserver;

  readonly features: Feature[] = [
    { icon: 'users',    title: 'Employee Records',    desc: 'Complete digital profiles for every employee — contracts, IDs, and HR data in one secure place.' },
    { icon: 'shield',   title: 'Visa Tracking',       desc: 'Monitor visa types, status, and expiry dates. Receive automated alerts 90, 60, and 30 days before renewal.' },
    { icon: 'file',     title: 'Payroll Compliance',  desc: 'Stay on top of payroll filings and Wage Protection System requirements with a full audit trail.' },
    { icon: 'bell',     title: 'Smart Alerts',        desc: 'Automated notifications for visas, trade licenses, and document renewals. Never miss a deadline.' },
  ];

  readonly steps: Step[] = [
    { n: '01', title: 'Add your employees',      desc: 'Import or manually enter staff records, documents, and visa details in minutes.' },
    { n: '02', title: 'Configure your alerts',   desc: 'Set notification windows — 30, 60, or 90 days — for every visa and compliance deadline.' },
    { n: '03', title: 'Stay ahead of deadlines', desc: 'Get proactive alerts and a live compliance dashboard so nothing slips through.' },
  ];

  readonly stats: Stat[] = [
    { value: '100%',        label: 'Audit ready' },
    { value: '14-day',      label: 'Free trial' },
    { value: 'Real-time',   label: 'Alerts' },
    { value: 'Multi-region',label: 'Compliance' },
  ];

  readonly heroStats: HeroStat[] = [
    { label: 'Employees',     value: '84',   sub: '3 added this month' },
    { label: 'Visas expiring',value: '6',    sub: 'Next 30 days', warn: true },
    { label: 'WPS status',    value: 'Filed',sub: 'Last cycle: on time', ok: true },
  ];

  readonly heroAlerts: Alert[] = [
    { name: 'Ahmed Al Mansoori', type: 'Visa renewal', days: 12, urgent: true },
    { name: 'Sarah Okafor',      type: 'Visa renewal', days: 24, urgent: false },
    { name: 'Ravi Shankar',      type: 'Labour card',  days: 31, urgent: false },
  ];

  readonly checklist: string[] = [
    'Employment visa monitoring and renewal alerts',
    'Payroll filing reminders and full audit logs',
    'Trade licence and document expiry tracking',
    'Labour card status and renewal management',
    'Regulatory deadline notifications (MOHRE, GDRFA, and more)',
  ];

  readonly calendar: Calendar[] = [
    { name: 'WPS filing deadline',        date: 'Jun 14', status: 'upcoming',      dot: 'var(--warning)' },
    { name: 'Visa renewal — 4 employees', date: 'Jun 17', status: 'action needed', dot: 'var(--danger)' },
    { name: 'Labour card — R. Shankar',   date: 'Jun 28', status: 'upcoming',      dot: 'var(--warning)' },
    { name: 'Trade licence renewal',      date: 'Jul 03', status: 'upcoming',      dot: 'var(--info)' },
  ];

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach(el => this.observer!.observe(el));
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
