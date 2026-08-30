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

interface EmployeeProfile extends Employee {
  personalEmail?: string;
  workEmail?: string;
  phone?: string;
  nationality?: string;
  visaRecords?: { id: string; visaType: string; expiryDate: string; status: string }[];
  wpsRecords?: { id: string; month: number; year: number; status: string; isLate: boolean }[];
  documents?: { id: string; fileName: string; documentType: string; expiryDate?: string }[];
  _count?: { visaRecords: number; documents: number; wpsRecords: number };
}

interface CurrentUser { role: string; employee?: { id: string } | null; }

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
  employeeProfile = signal<EmployeeProfile | null>(null);
  userRole = signal<string | null>(null);

  loadingStats   = signal(true);
  loadingProfile = signal(true);
  loadingEmployees = signal(true);
  loadingEmployeeProfile = signal(true);

  readonly loading = computed(() => this.loadingStats() || this.loadingProfile());
  readonly isEmployee = computed(() => this.userRole() === 'VIEWER');
  readonly employeeAlerts = computed(() => {
    const employee = this.employeeProfile();
    if (!employee) return [];
    const alerts: { label: string; detail: string; tone: 'danger' | 'warning' | 'info'; tab: 'visas' | 'wps' | 'docs' }[] = [];
    for (const visa of employee.visaRecords ?? []) {
      const days = Math.ceil((new Date(visa.expiryDate).getTime() - Date.now()) / 86_400_000);
      if (days <= 60 && visa.status !== 'CANCELLED') {
        alerts.push({ label: days < 0 ? 'Visa expired' : 'Visa renewal coming up', detail: `${this.formatDays(days)} · ${this.label(visa.visaType)}`, tone: days < 0 ? 'danger' : 'warning', tab: 'visas' });
      }
    }
    if ((employee.wpsRecords ?? []).some(record => record.status === 'PENDING' || record.isLate)) {
      alerts.push({ label: 'Payroll record needs attention', detail: 'Review your latest WPS record', tone: 'info', tab: 'wps' });
    }
    return alerts;
  });

  constructor() {
    this.http.get<CurrentUser>(`${environment.apiUrl}/api/users/me`).subscribe({
      next: (user) => {
        this.userRole.set(user.role);
        if (user.role === 'VIEWER') {
          if (user.employee?.id) this.loadEmployeeProfile(user.employee.id);
          else this.loadingEmployeeProfile.set(false);
          return;
        }
        this.loadTenantHome();
      },
      error: () => { this.userRole.set(null); this.loadTenantHome(); this.loadingEmployeeProfile.set(false); },
    });
  }

  private loadTenantHome() {
    this.http.get<TenantProfile>(`${environment.apiUrl}/api/tenant/profile`).subscribe({ next: (p) => { this.profile.set(p); this.loadingProfile.set(false); }, error: () => this.loadingProfile.set(false) });
    this.http.get<TenantStats>(`${environment.apiUrl}/api/tenant/stats`).subscribe({ next: (s) => { this.stats.set(s); this.loadingStats.set(false); }, error: () => this.loadingStats.set(false) });
    this.http.get<{ data: Employee[] }>(`${environment.apiUrl}/api/employees?page=1&pageSize=6`).subscribe({ next: (r) => { this.recentEmployees.set(r.data ?? []); this.loadingEmployees.set(false); }, error: () => this.loadingEmployees.set(false) });
  }

  private loadEmployeeProfile(id: string) {
    this.http.get<EmployeeProfile>(`${environment.apiUrl}/api/employees/${id}/records`).subscribe({ next: (employee) => { this.employeeProfile.set(employee); this.loadingEmployeeProfile.set(false); }, error: () => this.loadingEmployeeProfile.set(false) });
  }

  formatDays(days: number): string { return days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`; }
  label(value: string): string { return value.replace(/_/g, ' '); }
  goToProfile() { this.router.navigate(['/dashboard/employees/me']); }
  goToEmployeeTab(tab: 'visas' | 'wps' | 'docs') { this.router.navigate(['/dashboard/employees/me'], { queryParams: { tab } }); }

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
