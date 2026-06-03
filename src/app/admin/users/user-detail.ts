import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { forkJoin } from 'rxjs';
import { AvatarComponent } from '../../shared/avatar/avatar';

interface UserDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    planId: string | null;
    plan: { id: string; name: string } | null;
  };
  activeSessions: number;
  deviceCount: number;
}

interface Plan {
  id: string;
  name: string;
  priceAed: number;
  maxEmployees: number;
  maxAdmins: number;
  billingCycleMonths: number;
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
  selector: 'app-admin-user-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, AvatarComponent],
  templateUrl: './user-detail.html',
})
export class AdminUserDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly user = signal<UserDetail | null>(null);
  readonly plans = signal<Plan[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  // Profile editing
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal('');
  readonly editFirstName = signal('');
  readonly editLastName = signal('');
  readonly editEmail = signal('');
  readonly editPhone = signal('');
  readonly editRole = signal('VIEWER');

  // Plan (tenant) management
  readonly editPlanId = signal<string | null>(null);
  readonly savingPlan = signal(false);
  readonly planError = signal('');

  // Avatar upload
  readonly uploading = signal(false);
  readonly uploadError = signal('');

  // Status / delete
  readonly busy = signal('');
  readonly actionError = signal('');
  readonly confirmingDelete = signal(false);

  // Devices / sessions
  readonly sessions = signal<DeviceSession[]>([]);
  readonly loadingSessions = signal(false);
  readonly accessBusy = signal<string | null>(null);

  readonly ROLES = [
    { value: 'TENANT_ADMIN', label: 'Tenant Admin' },
    { value: 'HR_MANAGER', label: 'HR Manager' },
    { value: 'VIEWER', label: 'Viewer' },
  ];

  roleLabel(value: string): string {
    return this.ROLES.find(r => r.value === value)?.label ?? value;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('userId')!;
    this.load(id);
  }

  private load(id: string): void {
    this.loading.set(true);
    forkJoin({
      user: this.http.get<{ user: UserDetail }>(`${environment.apiUrl}/api/admin/users/${id}`),
      plans: this.http.get<Plan[]>(`${environment.apiUrl}/api/admin/plans`),
    }).subscribe({
      next: ({ user, plans }) => {
        this.user.set(user.user);
        this.plans.set(plans);
        this.editPlanId.set(user.user.tenant.planId);
        this.loading.set(false);
        this.loadSessions(id);
      },
      error: () => { this.error.set('Failed to load user.'); this.loading.set(false); },
    });
  }

  private loadSessions(id: string): void {
    this.loadingSessions.set(true);
    this.http.get<{ sessions: DeviceSession[] }>(`${environment.apiUrl}/api/admin/users/${id}/sessions`).subscribe({
      next: (r) => { this.sessions.set(r.sessions ?? []); this.loadingSessions.set(false); },
      error: () => { this.loadingSessions.set(false); },
    });
  }

  // ── Profile edit ──────────────────────────────
  startEdit(): void {
    const u = this.user()!;
    this.editFirstName.set(u.firstName);
    this.editLastName.set(u.lastName);
    this.editEmail.set(u.email);
    this.editPhone.set(u.phone ?? '');
    this.editRole.set(u.role);
    this.saveError.set('');
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.saveError.set('');
  }

  save(): void {
    const u = this.user()!;
    this.saving.set(true);
    this.saveError.set('');
    const body = {
      firstName: this.editFirstName(),
      lastName: this.editLastName(),
      email: this.editEmail(),
      phone: this.editPhone() || null,
      role: this.editRole(),
    };
    this.http.patch<Partial<UserDetail>>(`${environment.apiUrl}/api/admin/users/${u.id}`, body).subscribe({
      next: (updated) => {
        this.user.update(cur => cur ? { ...cur, ...updated } : cur);
        this.editing.set(false);
        this.saving.set(false);
      },
      error: (err) => {
        this.saveError.set(err.error?.error ?? 'Failed to save changes.');
        this.saving.set(false);
      },
    });
  }

  // ── Avatar upload ─────────────────────────────
  onAvatarPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadError.set('');

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      this.uploadError.set('Please choose a PNG, JPG, WEBP or GIF image.');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError.set('Image must be 5 MB or smaller.');
      input.value = '';
      return;
    }

    const u = this.user()!;
    const form = new FormData();
    form.append('file', file);
    form.append('kind', 'avatar');
    this.uploading.set(true);

    this.http.post<{ url: string }>(`${environment.apiUrl}/api/admin/uploads/image`, form).subscribe({
      next: ({ url }) => {
        this.http.patch<Partial<UserDetail>>(`${environment.apiUrl}/api/admin/users/${u.id}`, { avatarUrl: url }).subscribe({
          next: () => {
            this.user.update(cur => cur ? { ...cur, avatarUrl: url } : cur);
            this.uploading.set(false);
          },
          error: (err) => { this.uploadError.set(err.error?.error ?? 'Failed to save avatar.'); this.uploading.set(false); },
        });
      },
      error: (err) => { this.uploadError.set(err.error?.error ?? 'Upload failed.'); this.uploading.set(false); },
    });
    input.value = '';
  }

  removeAvatar(): void {
    const u = this.user()!;
    if (!u.avatarUrl) return;
    this.uploading.set(true);
    this.uploadError.set('');
    this.http.patch<Partial<UserDetail>>(`${environment.apiUrl}/api/admin/users/${u.id}`, { avatarUrl: null }).subscribe({
      next: () => { this.user.update(cur => cur ? { ...cur, avatarUrl: null } : cur); this.uploading.set(false); },
      error: (err) => { this.uploadError.set(err.error?.error ?? 'Failed to remove avatar.'); this.uploading.set(false); },
    });
  }

  // ── Tenant plan ───────────────────────────────
  savePlan(): void {
    const u = this.user()!;
    if (this.editPlanId() === u.tenant.planId) return;
    this.savingPlan.set(true);
    this.planError.set('');
    this.http.patch(`${environment.apiUrl}/api/admin/tenants/${u.tenant.id}/plan`, { planId: this.editPlanId() }).subscribe({
      next: () => {
        const plan = this.plans().find(p => p.id === this.editPlanId()) ?? null;
        this.user.update(cur => cur ? { ...cur, tenant: { ...cur.tenant, planId: this.editPlanId(), plan: plan ? { id: plan.id, name: plan.name } : null } } : cur);
        this.savingPlan.set(false);
      },
      error: (err) => { this.planError.set(err.error?.error ?? 'Failed to change plan.'); this.savingPlan.set(false); },
    });
  }

  // ── Status / delete ───────────────────────────
  toggleActive(): void {
    const u = this.user()!;
    this.busy.set('status');
    this.actionError.set('');
    this.http.patch<{ isActive: boolean }>(`${environment.apiUrl}/api/admin/users/${u.id}/status`, { isActive: !u.isActive }).subscribe({
      next: (r) => {
        this.user.update(cur => cur ? { ...cur, isActive: r.isActive, activeSessions: r.isActive ? cur.activeSessions : 0, deviceCount: r.isActive ? cur.deviceCount : 0 } : cur);
        if (!r.isActive) this.sessions.set([]);
        this.busy.set('');
      },
      error: (err) => { this.actionError.set(err.error?.error ?? 'Failed to update status.'); this.busy.set(''); },
    });
  }

  deleteUser(): void {
    const u = this.user()!;
    this.busy.set('delete');
    this.actionError.set('');
    this.http.delete(`${environment.apiUrl}/api/admin/users/${u.id}`).subscribe({
      next: () => this.router.navigate(['/admin/dashboard/tenants', u.tenant.id]),
      error: (err) => { this.actionError.set(err.error?.error ?? 'Failed to delete user.'); this.busy.set(''); this.confirmingDelete.set(false); },
    });
  }

  // ── Devices ───────────────────────────────────
  deviceMeta(s: DeviceSession): string {
    const parts = [s.deviceName, s.browser && s.os ? null : (s.browser ?? s.os)].filter(Boolean);
    return parts.join(' · ') || 'Unknown device';
  }

  revokeSession(sessionId: string): void {
    this.accessBusy.set(sessionId);
    this.http.delete(`${environment.apiUrl}/api/admin/sessions/${sessionId}`).subscribe({
      next: () => { this.sessions.update(list => list.filter(s => s.id !== sessionId)); this.accessBusy.set(null); },
      error: () => { this.accessBusy.set(null); },
    });
  }

  revokeAll(): void {
    const u = this.user()!;
    this.accessBusy.set('all');
    this.http.post(`${environment.apiUrl}/api/admin/users/${u.id}/revoke-sessions`, {}).subscribe({
      next: () => { this.sessions.set([]); this.user.update(cur => cur ? { ...cur, activeSessions: 0 } : cur); this.accessBusy.set(null); },
      error: () => { this.accessBusy.set(null); },
    });
  }

  back(): void {
    const u = this.user();
    if (u) this.router.navigate(['/admin/dashboard/tenants', u.tenant.id]);
    else this.router.navigate(['/admin/dashboard/tenants']);
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
