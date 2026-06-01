import { Component, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

interface TenantStats {
  totalEmployees: number;
  activeEmployees: number;
  expiringVisas: number;
  expiredVisas: number;
  pendingWps: number;
  totalUsers: number;
}

interface TenantProfile {
  id: string;
  name: string;
  email: string;
  country: string;
  phone?: string;
  industry?: string;
  plan?: { name: string; priceAed: number; billingCycleMonths: number; maxEmployees: number; maxAdmins: number };
  trialEndsAt?: string;
  status: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  employeeNo?: string;
  status: string;
  startDate?: string;
  department?: { id: string; name: string };
}

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.html',
})
export class HomeComponent {
  private http = inject(HttpClient);
  private router = inject(Router);

  stats = signal<TenantStats | null>(null);
  profile = signal<TenantProfile | null>(null);
  recentEmployees = signal<Employee[]>([]);

  loadingStats   = signal(true);
  loadingProfile = signal(true);
  loadingEmployees = signal(true);

  readonly loading = computed(() => this.loadingStats() || this.loadingProfile());

  constructor() {
    this.http.get<TenantProfile>(`${environment.apiUrl}/api/tenant/profile`).subscribe({
      next: (p) => { this.profile.set(p); this.loadingProfile.set(false); },
      error: () => this.loadingProfile.set(false),
    });

    this.http.get<TenantStats>(`${environment.apiUrl}/api/tenant/stats`).subscribe({
      next: (s) => { this.stats.set(s); this.loadingStats.set(false); },
      error: () => this.loadingStats.set(false),
    });

    this.http.get<{ data: Employee[] }>(`${environment.apiUrl}/api/employees?page=1&pageSize=6`).subscribe({
      next: (r) => { this.recentEmployees.set(r.data ?? []); this.loadingEmployees.set(false); },
      error: () => this.loadingEmployees.set(false),
    });
  }

  get trialDaysLeft(): number | null {
    const t = this.profile()?.trialEndsAt;
    if (!t) return null;
    const diff = new Date(t).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86_400_000));
  }

  get utilizationPct(): number {
    const s = this.stats();
    const max = this.profile()?.plan?.maxEmployees;
    if (!s || !max) return 0;
    return Math.round((s.totalEmployees / max) * 100);
  }

  initials(emp: Employee): string {
    return ((emp.firstName[0] ?? '') + (emp.lastName[0] ?? '')).toUpperCase();
  }

  statusColor(status: string): { bg: string; color: string } {
    switch (status) {
      case 'ACTIVE':     return { bg: 'var(--success-bg)',  color: 'var(--success)'  };
      case 'INACTIVE':   return { bg: 'var(--neutral-100)', color: 'var(--fg-3)'     };
      case 'TERMINATED': return { bg: 'var(--danger-bg)',   color: 'var(--danger)'   };
      default:           return { bg: 'var(--neutral-100)', color: 'var(--fg-3)'     };
    }
  }

  goToOrgChart()  { this.router.navigate(['/dashboard/org']); }
  goToEmployees() { this.router.navigate(['/dashboard/employees']); }
  goToChat()      { this.router.navigate(['/dashboard/chat']); }
  goToDocs()      { this.router.navigate(['/dashboard/documents']); }
}
