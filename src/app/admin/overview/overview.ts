import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

interface Stats {
  totalTenants: number;
  active: number;
  trial: number;
  suspended: number;
  totalEmployees: number;
  platformAdmins: number;
}

interface Tenant {
  id: string;
  companyName: string;
  email: string;
  plan: string;
  status: string;
  employeeCount: number | null;
  userCount: number | null;
  createdAt: string;
}

interface AdminRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

type PanelKind = 'total' | 'active' | 'trial' | 'suspended' | 'employees' | 'admins';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './overview.html',
})
export class OverviewComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly stats = signal<Stats | null>(null);
  readonly recentTenants = signal<Tenant[]>([]);
  readonly loadingStats = signal(true);
  readonly loadingTenants = signal(true);
  readonly error = signal('');

  // Drill-down overlay
  readonly panel = signal<{ kind: PanelKind; title: string } | null>(null);
  readonly panelLoading = signal(false);
  readonly panelTenants = signal<Tenant[]>([]);
  readonly panelAdmins = signal<AdminRow[]>([]);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loadingStats.set(true);
    this.loadingTenants.set(true);
    this.error.set('');

    this.http.get<Stats>(`${environment.apiUrl}/api/admin/stats`).subscribe({
      next: (data) => { this.stats.set(data); this.loadingStats.set(false); },
      error: () => { this.error.set('Failed to load stats.'); this.loadingStats.set(false); },
    });

    this.http
      .get<{ tenants: Tenant[] }>(`${environment.apiUrl}/api/admin/tenants?limit=6&sortBy=createdAt&order=desc`)
      .subscribe({
        next: (data) => { this.recentTenants.set(data.tenants ?? []); this.loadingTenants.set(false); },
        error: () => { this.loadingTenants.set(false); },
      });
  }

  refresh(): void {
    this.loadData();
  }

  // ── Drill-down ────────────────────────────────
  openPanel(kind: PanelKind, title: string): void {
    this.panel.set({ kind, title });
    this.panelLoading.set(true);
    this.panelTenants.set([]);
    this.panelAdmins.set([]);

    if (kind === 'admins') {
      this.http.get<AdminRow[]>(`${environment.apiUrl}/api/admin/admins`).subscribe({
        next: (rows) => { this.panelAdmins.set(rows ?? []); this.panelLoading.set(false); },
        error: () => { this.panelLoading.set(false); },
      });
      return;
    }

    const status =
      kind === 'active' ? 'ACTIVE' :
      kind === 'trial' ? 'TRIAL' :
      kind === 'suspended' ? 'SUSPENDED' : '';
    const q = status ? `&status=${status}` : '';

    this.http.get<{ tenants: Tenant[] }>(`${environment.apiUrl}/api/admin/tenants?limit=1000${q}`).subscribe({
      next: (r) => {
        let rows = r.tenants ?? [];
        if (kind === 'employees') rows = [...rows].sort((a, b) => (b.employeeCount ?? 0) - (a.employeeCount ?? 0));
        this.panelTenants.set(rows);
        this.panelLoading.set(false);
      },
      error: () => { this.panelLoading.set(false); },
    });
  }

  closePanel(): void {
    this.panel.set(null);
  }

  goToTenant(id: string): void {
    this.closePanel();
    this.router.navigate(['/admin/dashboard/tenants', id]);
  }

  statusColor(status: string): { bg: string; color: string } {
    switch (status?.toLowerCase()) {
      case 'active':    return { bg: 'var(--success-bg)', color: 'var(--success)' };
      case 'trial':     return { bg: 'var(--info-bg)', color: 'var(--info)' };
      case 'suspended': return { bg: 'var(--warning-bg)', color: 'var(--warning)' };
      case 'cancelled': return { bg: 'var(--danger-bg)', color: 'var(--danger)' };
      default:          return { bg: 'var(--neutral-100)', color: 'var(--fg-2)' };
    }
  }
}
