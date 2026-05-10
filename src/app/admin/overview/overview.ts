import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';

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
  employeeCount: number;
  createdAt: string;
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './overview.html',
})
export class OverviewComponent implements OnInit {
  private http = inject(HttpClient);

  readonly stats = signal<Stats | null>(null);
  readonly recentTenants = signal<Tenant[]>([]);
  readonly loadingStats = signal(true);
  readonly loadingTenants = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loadingStats.set(true);
    this.loadingTenants.set(true);
    this.error.set('');

    this.http.get<Stats>('/api/admin/stats').subscribe({
      next: (data) => {
        this.stats.set(data);
        this.loadingStats.set(false);
      },
      error: () => {
        this.error.set('Failed to load stats.');
        this.loadingStats.set(false);
      },
    });

    this.http
      .get<{ tenants: Tenant[] }>('/api/admin/tenants?limit=6&sortBy=createdAt&order=desc')
      .subscribe({
        next: (data) => {
          this.recentTenants.set(data.tenants ?? []);
          this.loadingTenants.set(false);
        },
        error: () => {
          this.loadingTenants.set(false);
        },
      });
  }

  refresh(): void {
    this.loadData();
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
