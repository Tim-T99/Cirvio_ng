import { Component, AfterViewInit, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Feature { icon: string; title: string; desc: string; }
interface Step { n: string; title: string; desc: string; }
interface Stat { value: string; label: string; }
interface HeroStat { label: string; value: string; sub: string; warn?: boolean; ok?: boolean; }
interface Alert { name: string; type: string; days: number; urgent: boolean; }
interface Calendar { name: string; date: string; status: string; dot: string; }
type TabKey = 'dashboard' | 'org' | 'visas' | 'ai' | 'export';

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
    { icon: 'users',    title: 'Employee Records',      desc: 'Complete digital profiles — personal details, documents, departments, and a real reporting hierarchy.' },
    { icon: 'shield',   title: 'Visa & ID Tracking',    desc: 'Track every visa, Emirates ID, and labour card. Automated alerts at 90, 60, 30, 14, and 7 days before expiry.' },
    { icon: 'file',     title: 'WPS Payroll Compliance',desc: 'Monthly payroll records with a full audit trail, plus WPS SIF file generation for MOHRE submission.' },
    { icon: 'bell',     title: 'Smart Compliance Alerts',desc: 'A daily alert engine flags expiring and expired visas and WPS deadlines on a live dashboard.' },
    { icon: 'sparkles', title: 'AI Assistant',          desc: 'Ask Cirvio about your workforce — it reads your live org data to answer questions and surface efficiency insights.' },
    { icon: 'chart',    title: 'Power BI & CSV Export', desc: 'Connect a live, refreshable feed to Power BI or Tableau, or export clean, report-ready CSVs in one click.' },
  ];

  readonly steps: Step[] = [
    { n: '01', title: 'Add your employees',      desc: 'Enter staff records, documents, visas, and reporting lines in minutes.' },
    { n: '02', title: 'Let the alerts run',      desc: 'Cirvio automatically watches every visa, ID, and WPS deadline — no setup needed.' },
    { n: '03', title: 'Stay ahead of deadlines', desc: 'Work from a live dashboard, ask the AI assistant, and export reports whenever you need them.' },
  ];

  readonly stats: Stat[] = [
    { value: '14-day',  label: 'Free trial' },
    { value: '5-stage', label: 'Visa expiry alerts' },
    { value: 'Power BI',label: '& CSV data export' },
    { value: 'Passkey', label: 'Passwordless sign-in' },
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
    'Employment & residence visa monitoring with renewal alerts',
    'Emirates ID, labour card, and trade licence expiry tracking',
    'WPS payroll records and SIF file generation for MOHRE',
    'A live compliance dashboard with in-app alerts',
    'Org chart, role-based access, and an AI workforce assistant',
  ];

  readonly calendar: Calendar[] = [
    { name: 'WPS filing deadline',        date: 'Jun 14', status: 'upcoming',      dot: 'var(--warning)' },
    { name: 'Visa renewal — 4 employees', date: 'Jun 17', status: 'action needed', dot: 'var(--danger)' },
    { name: 'Labour card — R. Shankar',   date: 'Jun 28', status: 'upcoming',      dot: 'var(--warning)' },
    { name: 'Trade licence renewal',      date: 'Jul 03', status: 'upcoming',      dot: 'var(--info)' },
  ];

  // ── Interactive product showcase ──────────────────────────────────────────
  readonly activeTab = signal<TabKey>('dashboard');
  setTab(k: TabKey) { this.activeTab.set(k); }

  readonly tabs: { key: TabKey; label: string; nav: string }[] = [
    { key: 'dashboard', label: 'Dashboard',    nav: 'Home' },
    { key: 'org',       label: 'Org chart',    nav: 'Org Chart' },
    { key: 'visas',     label: 'Visa alerts',  nav: 'Visas' },
    { key: 'ai',        label: 'AI assistant', nav: 'Chat' },
    { key: 'export',    label: 'Data export',  nav: 'Settings' },
  ];
  readonly navItems = ['Home', 'Employees', 'Visas', 'WPS', 'Org Chart', 'Chat', 'Settings'];
  activeNav() { return this.tabs.find(t => t.key === this.activeTab())?.nav ?? 'Home'; }
  tabLabel() { return this.tabs.find(t => t.key === this.activeTab())?.label ?? ''; }

  readonly deptBars = [
    { name: 'Operations', pct: 100, color: 'var(--cirvio-sage)' },
    { name: 'Logistics',  pct: 74,  color: 'var(--cirvio-sage)' },
    { name: 'Finance',    pct: 52,  color: 'var(--info)' },
    { name: 'HR',         pct: 33,  color: 'var(--warning)' },
    { name: 'Sales',      pct: 61,  color: 'var(--cirvio-mint)' },
  ];

  readonly visaRows = [
    { name: 'Ahmed Al Mansoori', type: 'Employment', days: 12, status: 'Expiring', urgent: true },
    { name: 'Sarah Okafor',      type: 'Residence',  days: 24, status: 'Expiring', urgent: false },
    { name: 'Ravi Shankar',      type: 'Employment', days: 31, status: 'Expiring', urgent: false },
    { name: 'Mei Lin',           type: 'Investor',   days: 88, status: 'Active',   urgent: false },
    { name: 'Tomás Rivera',      type: 'Employment', days: 140,status: 'Active',   urgent: false },
  ];

  readonly aiMsgs: { role: 'user' | 'ai'; text: string; chips?: string[] }[] = [
    { role: 'user', text: 'Which managers are overloaded?' },
    { role: 'ai',   text: 'Two managers have wide spans: Operations lead (11 reports) and Logistics lead (9). Consider a team-lead layer under Operations to rebalance.', chips: ['Org overview'] },
  ];

  readonly exportSets = [
    { name: 'Employees', rows: 84 },
    { name: 'Visas', rows: 80 },
    { name: 'WPS records', rows: 1008 },
    { name: 'Documents', rows: 212 },
    { name: 'Departments', rows: 9 },
  ];

  readonly worksWith = ['Power BI', 'Tableau', 'WPS / SIF', 'MOHRE format', 'Emirates ID', 'CSV / Excel', 'Passkeys', 'Stripe billing'];

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
