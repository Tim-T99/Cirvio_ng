import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { forkJoin } from 'rxjs';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  logoUrl: string | null;
  industry: string | null;
  country: string;
  emirate: string | null;
  tradelicenseNo: string | null;
  tradelicenseExpiry: string | null;
  status: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  planId: string | null;
  plan: { name: string; maxEmployees: number; maxAdmins: number; priceAed: number; billingCycleMonths: number } | null;
  _count: { employees: number; users: number; visaRecords: number; wpsRecords: number };
}

interface Plan {
  id: string;
  name: string;
  priceAed: number;
  maxEmployees: number;
  maxAdmins: number;
  billingCycleMonths: number;
}

interface TenantUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  activeSessions: number;
  deviceCount: number;
}

interface DeviceSession {
  id: string;
  deviceType: string | null;
  deviceName: string | null;
  os: string | null;
  browser: string | null;
  ipAddress: string | null;
  lastIp: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  expiresAt: string;
  active: boolean;
}

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './tenant-detail.html',
})
export class TenantDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tenant = signal<TenantDetail | null>(null);
  readonly plans = signal<Plan[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly saveError = signal('');
  readonly editing = signal(false);

  // Edit form fields
  readonly editName = signal('');
  readonly editEmail = signal('');
  readonly editPhone = signal('');
  readonly editIndustry = signal('');
  readonly editEmirate = signal('');
  readonly editTradelicenseNo = signal('');
  readonly editTradelicenseExpiry = signal('');
  readonly editTrialEndsAt = signal('');
  readonly editSubscriptionEndsAt = signal('');
  readonly editPlanId = signal<string | null>(null);

  // Users & Devices (sessions / zero-trust access control)
  readonly users = signal<TenantUser[]>([]);
  readonly loadingUsers = signal(true);
  readonly expandedUserId = signal<string | null>(null);
  readonly userSessions = signal<DeviceSession[]>([]);
  readonly loadingSessions = signal(false);
  readonly accessError = signal('');
  readonly accessBusy = signal<string | null>(null);

  get isUae(): boolean { return this.tenant()?.country === 'AE'; }

  readonly EMIRATES: { value: string; label: string }[] = [
    { value: 'ABU_DHABI',      label: 'Abu Dhabi' },
    { value: 'DUBAI',          label: 'Dubai' },
    { value: 'SHARJAH',        label: 'Sharjah' },
    { value: 'AJMAN',          label: 'Ajman' },
    { value: 'UMM_AL_QUWAIN',  label: 'Umm Al Quwain' },
    { value: 'RAS_AL_KHAIMAH', label: 'Ras Al Khaimah' },
    { value: 'FUJAIRAH',       label: 'Fujairah' },
  ];

  emirateLabel(value: string | null): string {
    return this.EMIRATES.find(e => e.value === value)?.label ?? '—';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('tenantId')!;
    forkJoin({
      tenant: this.http.get<TenantDetail>(`${environment.apiUrl}/api/admin/tenants/${id}`),
      plans: this.http.get<Plan[]>(`${environment.apiUrl}/api/admin/plans`),
    }).subscribe({
      next: ({ tenant, plans }) => {
        this.tenant.set(tenant);
        this.plans.set(plans);
        this.loading.set(false);
      },
      error: () => { this.error.set('Failed to load tenant.'); this.loading.set(false); },
    });
    this.loadUsers(id);
  }

  // ── Users & Devices ───────────────────────────
  private loadUsers(id: string): void {
    this.loadingUsers.set(true);
    this.http.get<{ users: TenantUser[] }>(`${environment.apiUrl}/api/admin/tenants/${id}/users`).subscribe({
      next: (r) => { this.users.set(r.users ?? []); this.loadingUsers.set(false); },
      error: () => { this.loadingUsers.set(false); },
    });
  }

  toggleUser(userId: string): void {
    if (this.expandedUserId() === userId) { this.expandedUserId.set(null); return; }
    this.expandedUserId.set(userId);
    this.userSessions.set([]);
    this.accessError.set('');
    this.loadingSessions.set(true);
    this.http.get<{ sessions: DeviceSession[] }>(`${environment.apiUrl}/api/admin/users/${userId}/sessions`).subscribe({
      next: (r) => { this.userSessions.set(r.sessions ?? []); this.loadingSessions.set(false); },
      error: () => { this.loadingSessions.set(false); },
    });
  }

  private syncCounts(userId: string): void {
    const sessions = this.userSessions();
    this.users.update(list => list.map(u => u.id === userId
      ? { ...u, activeSessions: sessions.filter(s => s.active).length, deviceCount: new Set(sessions.map(s => s.deviceName ?? s.id)).size }
      : u));
  }

  revokeSession(sessionId: string): void {
    this.accessBusy.set(sessionId);
    this.accessError.set('');
    this.http.delete(`${environment.apiUrl}/api/admin/sessions/${sessionId}`).subscribe({
      next: () => {
        this.userSessions.update(list => list.filter(s => s.id !== sessionId));
        const uid = this.expandedUserId();
        if (uid) this.syncCounts(uid);
        this.accessBusy.set(null);
      },
      error: (err) => { this.accessError.set(err.error?.error ?? 'Failed to revoke session.'); this.accessBusy.set(null); },
    });
  }

  revokeAllSessions(userId: string): void {
    this.accessBusy.set('all-' + userId);
    this.accessError.set('');
    this.http.post(`${environment.apiUrl}/api/admin/users/${userId}/revoke-sessions`, {}).subscribe({
      next: () => {
        this.userSessions.set([]);
        this.syncCounts(userId);
        this.accessBusy.set(null);
      },
      error: (err) => { this.accessError.set(err.error?.error ?? 'Failed to revoke sessions.'); this.accessBusy.set(null); },
    });
  }

  toggleUserActive(user: TenantUser): void {
    this.accessBusy.set('lock-' + user.id);
    this.accessError.set('');
    this.http.patch<{ isActive: boolean }>(`${environment.apiUrl}/api/admin/users/${user.id}/status`, { isActive: !user.isActive }).subscribe({
      next: (r) => {
        this.users.update(list => list.map(u => u.id === user.id
          ? { ...u, isActive: r.isActive, activeSessions: r.isActive ? u.activeSessions : 0, deviceCount: r.isActive ? u.deviceCount : 0 }
          : u));
        if (!r.isActive && this.expandedUserId() === user.id) this.userSessions.set([]);
        this.accessBusy.set(null);
      },
      error: (err) => { this.accessError.set(err.error?.error ?? 'Failed to update user.'); this.accessBusy.set(null); },
    });
  }

  deviceMeta(s: DeviceSession): string {
    const parts = [s.deviceName, s.browser && s.os ? null : (s.browser ?? s.os)].filter(Boolean);
    return parts.join(' · ') || 'Unknown device';
  }

  startEdit(): void {
    const t = this.tenant()!;
    this.editName.set(t.name);
    this.editEmail.set(t.email);
    this.editPhone.set(t.phone ?? '');
    this.editIndustry.set(t.industry ?? '');
    this.editEmirate.set(t.emirate ?? '');
    this.editTradelicenseNo.set(t.tradelicenseNo ?? '');
    this.editTradelicenseExpiry.set(t.tradelicenseExpiry ? t.tradelicenseExpiry.substring(0, 10) : '');
    this.editTrialEndsAt.set(t.trialEndsAt ? t.trialEndsAt.substring(0, 10) : '');
    this.editSubscriptionEndsAt.set(t.subscriptionEndsAt ? t.subscriptionEndsAt.substring(0, 10) : '');
    this.editPlanId.set(t.planId);
    this.saveError.set('');
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.saveError.set('');
  }

  save(): void {
    const t = this.tenant()!;
    this.saving.set(true);
    this.saveError.set('');

    const body = {
      name: this.editName(),
      email: this.editEmail(),
      phone: this.editPhone() || null,
      industry: this.editIndustry() || null,
      emirate: this.editEmirate() || null,
      tradelicenseNo: this.editTradelicenseNo() || null,
      tradelicenseExpiry: this.editTradelicenseExpiry() || null,
      trialEndsAt: this.editTrialEndsAt() || null,
      subscriptionEndsAt: this.editSubscriptionEndsAt() || null,
    };

    const planChanged = this.editPlanId() !== t.planId;

    const details$ = this.http.patch<TenantDetail>(`${environment.apiUrl}/api/admin/tenants/${t.id}`, body);
    const plan$ = planChanged
      ? this.http.patch<unknown>(`${environment.apiUrl}/api/admin/tenants/${t.id}/plan`, { planId: this.editPlanId() })
      : null;

    details$.subscribe({
      next: (updated) => {
        if (plan$) {
          plan$.subscribe({
            next: () => this.reload(t.id),
            error: (err) => {
              this.saveError.set(err.error?.error ?? 'Details saved but plan change failed.');
              this.saving.set(false);
              this.editing.set(false);
            },
          });
        } else {
          this.tenant.set(updated);
          this.editing.set(false);
          this.saving.set(false);
        }
      },
      error: (err) => {
        this.saveError.set(err.error?.error ?? 'Failed to save changes.');
        this.saving.set(false);
      },
    });
  }

  private reload(id: string): void {
    forkJoin({
      tenant: this.http.get<TenantDetail>(`${environment.apiUrl}/api/admin/tenants/${id}`),
      plans: this.http.get<Plan[]>(`${environment.apiUrl}/api/admin/plans`),
    }).subscribe({
      next: ({ tenant, plans }) => {
        this.tenant.set(tenant);
        this.plans.set(plans);
        this.editing.set(false);
        this.saving.set(false);
      },
      error: () => { this.editing.set(false); this.saving.set(false); },
    });
    this.loadUsers(id);
  }

  back(): void {
    this.router.navigate(['/admin/dashboard/tenants']);
  }

  statusStyle(status: string): { background: string; color: string } {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':    return { background: 'var(--success-bg)', color: 'var(--success)' };
      case 'TRIAL':     return { background: 'var(--info-bg)',    color: 'var(--info)' };
      case 'SUSPENDED': return { background: 'var(--warning-bg)', color: 'var(--warning)' };
      case 'CANCELLED': return { background: 'var(--danger-bg)',  color: 'var(--danger)' };
      default:          return { background: 'var(--neutral-100)', color: 'var(--fg-2)' };
    }
  }
}
