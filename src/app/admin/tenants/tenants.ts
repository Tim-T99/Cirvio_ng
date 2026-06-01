import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';

export interface Tenant {
  id: string;
  companyName: string;
  email: string;
  plan: string;
  status: string;
  employeeCount: number | null;
  userCount: number | null;
  trialEndsAt: string | null;
  createdAt: string;
}

interface TenantsResponse {
  tenants: Tenant[];
  total: number;
  page: number;
  totalPages: number;
}

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './tenants.html',
})
export class TenantsComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly tenants = signal<Tenant[]>([]);
  readonly total = signal(0);
  readonly totalPages = signal(1);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly search = signal('');
  readonly statusFilter = signal('ALL');
  readonly openMenuId = signal<string | null>(null);
  readonly menuPos = signal<{ top: number; right: number } | null>(null);

  readonly statusTabs = ['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED'];
  readonly limit = 15;

  ngOnInit(): void {
    this.fetchTenants();
  }

  fetchTenants(): void {
    this.loading.set(true);
    this.error.set('');
    const status = this.statusFilter() === 'ALL' ? '' : `&status=${this.statusFilter()}`;
    const search = this.search() ? `&search=${encodeURIComponent(this.search())}` : '';
    this.http
      .get<TenantsResponse>(`${environment.apiUrl}/api/admin/tenants?page=${this.page()}&limit=${this.limit}${search}${status}`)
      .subscribe({
        next: (data) => {
          this.tenants.set(data.tenants ?? []);
          this.total.set(data.total ?? 0);
          this.totalPages.set(data.totalPages ?? 1);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load tenants.');
          this.loading.set(false);
        },
      });
  }

  onSearch(val: string): void {
    this.search.set(val);
    this.page.set(1);
    this.fetchTenants();
  }

  setStatus(tab: string): void {
    this.statusFilter.set(tab);
    this.page.set(1);
    this.fetchTenants();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.fetchTenants();
  }

  toggleMenu(id: string, event: MouseEvent): void {
    if (this.openMenuId() === id) {
      this.openMenuId.set(null);
      this.menuPos.set(null);
    } else {
      const btn = event.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      this.openMenuId.set(id);
      this.menuPos.set({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  }

  closeMenu(): void {
    this.openMenuId.set(null);
    this.menuPos.set(null);
  }

  viewDetails(tenant: Tenant): void {
    this.closeMenu();
    this.router.navigate(['/admin/dashboard/tenants', tenant.id]);
  }

  updateStatus(tenant: Tenant, newStatus: string): void {
    this.closeMenu();
    this.http
      .patch(`${environment.apiUrl}/api/admin/tenants/${tenant.id}/status`, { status: newStatus })
      .subscribe({
        next: () => this.fetchTenants(),
        error: () => this.error.set(`Failed to update status for ${tenant.companyName}.`),
      });
  }

  statusStyle(status: string): { background: string; color: string } {
    switch (status?.toLowerCase()) {
      case 'active':    return { background: 'var(--success-bg)', color: 'var(--success)' };
      case 'trial':     return { background: 'var(--info-bg)',    color: 'var(--info)' };
      case 'suspended': return { background: 'var(--warning-bg)', color: 'var(--warning)' };
      case 'cancelled': return { background: 'var(--danger-bg)',  color: 'var(--danger)' };
      default:          return { background: 'var(--neutral-100)', color: 'var(--fg-2)' };
    }
  }

  readonly pages = computed(() => {
    const total = this.totalPages();
    const cur = this.page();
    const arr: (number | '...')[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) arr.push(i);
    } else {
      arr.push(1);
      if (cur > 3) arr.push('...');
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) arr.push(i);
      if (cur < total - 2) arr.push('...');
      arr.push(total);
    }
    return arr;
  });
}
