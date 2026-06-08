import { Component, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AvatarComponent } from '../../shared/avatar/avatar';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  organizationName?: string;
  tenant?: { id: string; name: string; country: string };
}

interface OrgProfile {
  name: string;
  phone: string | null;
  industry: string | null;
  logoUrl: string | null;
  tradelicenseNo: string | null;
  tradelicenseExpiry: string | null;
  emirate: string | null;
}

const ALLOWED_IMAGE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface TenantInvite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

interface InviteResponse {
  message: string;
  email: string;
  role: string;
  emailed: boolean;
  emailConfigured: boolean;
  inviteUrl: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  QA: 'Qatar',
  BH: 'Bahrain',
  KW: 'Kuwait',
  OM: 'Oman',
  OTHER: 'Other',
};

interface BillingPlan {
  id: string;
  name: string;
  priceAed: number;
  billingCycleMonths: number;
  maxEmployees: number;
  maxAdmins: number;
  stripePriceId: string | null;
}

interface SubscriptionInfo {
  billingEnabled: boolean;
  status: string;
  plan: { id: string; name: string; priceAed: number; maxEmployees: number; maxAdmins: number } | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  hasSubscription: boolean;
  canManageBilling: boolean;
  trialExpired: boolean;
  features: string[];
  isPaid: boolean;
  usage: { employees: number; users: number; maxEmployees: number | null; maxAdmins: number | null };
}

interface ExportDataset { key: string; label: string; entitySet: string; columns: string[]; }
interface ExportTokenInfo { id: string; name: string; prefix: string; lastUsedAt: string | null; createdAt: string; }
interface NewExportToken { id: string; name: string; prefix: string; token: string; odataUrl: string; createdAt: string; }

interface PasskeyEntry {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [DatePipe, AvatarComponent],
  templateUrl: './settings.html',
})
export class SettingsComponent implements OnInit {
  private http       = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  profile = signal<UserProfile | null>(null);
  loading = signal(true);
  saving = signal(false);
  success = signal(false);
  error = signal('');

  firstName = signal('');
  lastName = signal('');

  // Avatar (own profile photo)
  avatarUploading = signal(false);
  avatarError = signal('');

  // Tenant logo
  logoUrl = signal<string | null>(null);
  logoUploading = signal(false);
  logoError = signal('');

  get countryName(): string {
    const code = this.profile()?.tenant?.country ?? 'AE';
    return COUNTRY_NAMES[code] ?? code;
  }

  orgName = signal('');
  orgPhone = signal('');
  orgIndustry = signal('');
  orgTradelicenseNo = signal('');
  orgTradelicenseExpiry = signal('');
  orgEmirate = signal('');
  orgSaving = signal(false);
  orgSuccess = signal(false);
  orgError = signal('');

  get isUae(): boolean { return this.profile()?.tenant?.country === 'AE'; }
  get isTenantAdmin(): boolean { return this.profile()?.role === 'TENANT_ADMIN'; }

  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  passwordError = signal('');
  passwordSuccess = signal(false);
  savingPassword = signal(false);

  passkeys         = signal<PasskeyEntry[]>([]);
  passkeyLoading   = signal(false);
  passkeyError     = signal('');
  passkeySuccess   = signal('');
  passkeyName      = signal('');
  readonly passkeySupported = isPlatformBrowser(this.platformId) && !!(window as any).PublicKeyCredential;

  // Team invites (TENANT_ADMIN only)
  readonly INVITE_ROLES = [
    { value: 'VIEWER', label: 'Viewer' },
    { value: 'HR_MANAGER', label: 'HR Manager' },
    { value: 'TENANT_ADMIN', label: 'Tenant Admin' },
  ];
  invites          = signal<TenantInvite[]>([]);
  inviteEmail      = signal('');
  inviteRole       = signal('VIEWER');
  invitingBusy     = signal(false);
  inviteError      = signal('');
  lastInvite       = signal<{ inviteUrl: string; emailed: boolean; email: string } | null>(null);
  linkCopied       = signal(false);
  revokingId       = signal<string | null>(null);

  // Billing (TENANT_ADMIN only)
  billing          = signal<SubscriptionInfo | null>(null);
  billingPlans     = signal<BillingPlan[]>([]);
  billingBusy      = signal('');           // planId being checked out, or 'portal'
  billingError     = signal('');
  billingNotice    = signal('');           // success/cancel banner after Stripe redirect

  // Data export (TENANT_ADMIN, paid + data_export feature)
  exportDatasets   = signal<ExportDataset[]>([]);
  exportTokens     = signal<ExportTokenInfo[]>([]);
  odataUrl         = signal('');
  newTokenName     = signal('');
  createdToken     = signal<NewExportToken | null>(null);
  tokenCopied      = signal(false);
  exportBusy       = signal('');           // 'create' | token id
  csvBusy          = signal('');           // dataset key being downloaded
  exportError      = signal('');

  ngOnInit() {
    // Surface the Stripe checkout outcome (?billing=success|cancelled).
    if (isPlatformBrowser(this.platformId)) {
      const params = new URLSearchParams(window.location.search);
      const b = params.get('billing');
      if (b === 'success') this.billingNotice.set('success');
      else if (b === 'cancelled') this.billingNotice.set('cancelled');
    }

    this.http.get<UserProfile>(`${environment.apiUrl}/api/users/me`).subscribe({
      next: (u) => {
        this.profile.set(u);
        this.firstName.set(u.firstName ?? '');
        this.lastName.set(u.lastName ?? '');
        this.loading.set(false);
        if (u.role === 'TENANT_ADMIN') { this.loadOrgProfile(); this.loadInvites(); this.loadBilling(); }
        this.loadPasskeys();
      },
      error: () => { this.error.set('Failed to load profile.'); this.loading.set(false); },
    });
  }

  // ── Billing ────────────────────────────────────────────────────────────────

  private loadBilling() {
    this.http.get<SubscriptionInfo>(`${environment.apiUrl}/api/billing/subscription`).subscribe({
      next: (s) => { this.billing.set(s); if (this.canExport) this.loadExport(); },
      error: () => {},
    });
    this.http.get<{ billingEnabled: boolean; plans: BillingPlan[] }>(`${environment.apiUrl}/api/billing/plans`).subscribe({
      next: (r) => this.billingPlans.set(r.plans ?? []),
      error: () => {},
    });
  }

  // ── Data export (paid + data_export feature) ───────────────────────────────

  get canExport(): boolean {
    const b = this.billing();
    return !!b && b.isPaid && (b.features ?? []).includes('data_export');
  }

  private loadExport() {
    this.http.get<{ odataUrl: string; datasets: ExportDataset[] }>(`${environment.apiUrl}/api/export/datasets`).subscribe({
      next: (r) => { this.exportDatasets.set(r.datasets ?? []); this.odataUrl.set(r.odataUrl); },
      error: () => {},
    });
    this.loadExportTokens();
  }

  private loadExportTokens() {
    this.http.get<ExportTokenInfo[]>(`${environment.apiUrl}/api/export/tokens`).subscribe({
      next: (t) => this.exportTokens.set(t ?? []),
      error: () => {},
    });
  }

  createExportToken() {
    const name = this.newTokenName().trim() || 'BI export';
    this.exportError.set('');
    this.exportBusy.set('create');
    this.http.post<NewExportToken>(`${environment.apiUrl}/api/export/tokens`, { name }).subscribe({
      next: (t) => {
        this.createdToken.set(t);
        this.newTokenName.set('');
        this.exportBusy.set('');
        this.loadExportTokens();
      },
      error: (err) => { this.exportError.set(err.error?.error ?? 'Could not create token.'); this.exportBusy.set(''); },
    });
  }

  revokeExportToken(id: string) {
    this.exportBusy.set(id);
    this.http.delete(`${environment.apiUrl}/api/export/tokens/${id}`).subscribe({
      next: () => { this.exportTokens.update(list => list.filter(t => t.id !== id)); this.exportBusy.set(''); },
      error: () => { this.exportError.set('Could not revoke token.'); this.exportBusy.set(''); },
    });
  }

  copyToken() {
    const t = this.createdToken()?.token;
    if (!t || !isPlatformBrowser(this.platformId)) return;
    navigator.clipboard?.writeText(t).then(() => {
      this.tokenCopied.set(true);
      setTimeout(() => this.tokenCopied.set(false), 2500);
    }).catch(() => {});
  }

  downloadCsv(key: string) {
    this.exportError.set('');
    this.csvBusy.set(key);
    this.http.get(`${environment.apiUrl}/api/export/csv/${key}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        if (isPlatformBrowser(this.platformId)) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `cirvio-${key}-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
        this.csvBusy.set('');
      },
      error: () => { this.exportError.set('Download failed. You may not have permission to export this dataset.'); this.csvBusy.set(''); },
    });
  }

  subscribe(planId: string) {
    this.billingError.set('');
    this.billingBusy.set(planId);
    this.http.post<{ url: string }>(`${environment.apiUrl}/api/billing/checkout`, { planId }).subscribe({
      next: (r) => { if (isPlatformBrowser(this.platformId)) window.location.href = r.url; },
      error: (err) => { this.billingError.set(err.error?.error ?? 'Could not start checkout.'); this.billingBusy.set(''); },
    });
  }

  manageBilling() {
    this.billingError.set('');
    this.billingBusy.set('portal');
    this.http.post<{ url: string }>(`${environment.apiUrl}/api/billing/portal`, {}).subscribe({
      next: (r) => { if (isPlatformBrowser(this.platformId)) window.location.href = r.url; },
      error: (err) => { this.billingError.set(err.error?.error ?? 'Could not open billing portal.'); this.billingBusy.set(''); },
    });
  }

  planPrice(p: BillingPlan): string {
    const cycle = p.billingCycleMonths === 1 ? 'mo' : `${p.billingCycleMonths} mo`;
    return `AED ${p.priceAed.toLocaleString()} / ${cycle}`;
  }

  get isCurrentPlan(): (planId: string) => boolean {
    return (planId: string) => this.billing()?.status === 'ACTIVE' && this.billing()?.plan?.id === planId;
  }

  // ── Team invites ──────────────────────────────────────────────────────────

  private loadInvites() {
    this.http.get<TenantInvite[]>(`${environment.apiUrl}/api/tenant/invites`).subscribe({
      next: (list) => this.invites.set(list ?? []),
      error: () => {},
    });
  }

  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

  sendInvite() {
    const email = this.inviteEmail().trim();
    this.inviteError.set('');
    this.linkCopied.set(false);
    if (!this.EMAIL_RE.test(email)) { this.inviteError.set('Enter a valid email address.'); return; }

    this.invitingBusy.set(true);
    this.http.post<InviteResponse>(`${environment.apiUrl}/api/tenant/invites`, {
      email,
      role: this.inviteRole(),
    }).subscribe({
      next: (r) => {
        this.lastInvite.set({ inviteUrl: r.inviteUrl, emailed: r.emailed, email: r.email });
        this.inviteEmail.set('');
        this.invitingBusy.set(false);
        this.loadInvites();
      },
      error: (err) => { this.inviteError.set(err.error?.error ?? 'Failed to create invite.'); this.invitingBusy.set(false); },
    });
  }

  copyInviteLink() {
    const url = this.lastInvite()?.inviteUrl;
    if (!url || !isPlatformBrowser(this.platformId)) return;
    navigator.clipboard?.writeText(url).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2500);
    }).catch(() => {});
  }

  revokeInvite(id: string) {
    this.revokingId.set(id);
    this.http.delete(`${environment.apiUrl}/api/tenant/invites/${id}`).subscribe({
      next: () => { this.invites.update(list => list.filter(i => i.id !== id)); this.revokingId.set(null); },
      error: (err) => { this.inviteError.set(err.error?.error ?? 'Failed to revoke invite.'); this.revokingId.set(null); },
    });
  }

  roleLabel(value: string): string {
    return this.INVITE_ROLES.find(r => r.value === value)?.label ?? value;
  }

  private loadOrgProfile() {
    this.http.get<OrgProfile>(`${environment.apiUrl}/api/tenant/profile`).subscribe({
      next: (o) => {
        this.orgName.set(o.name ?? '');
        this.orgPhone.set(o.phone ?? '');
        this.orgIndustry.set(o.industry ?? '');
        this.logoUrl.set(o.logoUrl ?? null);
        this.orgTradelicenseNo.set(o.tradelicenseNo ?? '');
        this.orgTradelicenseExpiry.set(o.tradelicenseExpiry ? o.tradelicenseExpiry.substring(0, 10) : '');
        this.orgEmirate.set(o.emirate ?? '');
      },
      error: () => {},
    });
  }

  saveOrgProfile() {
    this.orgSaving.set(true);
    this.orgSuccess.set(false);
    this.orgError.set('');
    const body: Record<string, unknown> = {
      name: this.orgName(),
      phone: this.orgPhone() || null,
      industry: this.orgIndustry() || null,
      tradelicenseNo: this.orgTradelicenseNo() || null,
      tradelicenseExpiry: this.orgTradelicenseExpiry() ? new Date(this.orgTradelicenseExpiry()) : null,
    };
    this.http.patch(`${environment.apiUrl}/api/tenant/profile`, body).subscribe({
      next: () => {
        this.orgSuccess.set(true);
        this.orgSaving.set(false);
        setTimeout(() => this.orgSuccess.set(false), 3000);
      },
      error: (err) => {
        this.orgError.set(err.error?.error ?? 'Failed to save organisation profile.');
        this.orgSaving.set(false);
      },
    });
  }

  saveProfile() {
    this.saving.set(true);
    this.success.set(false);
    this.error.set('');
    this.http.patch<UserProfile>(`${environment.apiUrl}/api/users/me`, {
      firstName: this.firstName(),
      lastName: this.lastName(),
    }).subscribe({
      next: (u) => {
        this.profile.set(u);
        this.success.set(true);
        this.saving.set(false);
        setTimeout(() => this.success.set(false), 3000);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to save changes.');
        this.saving.set(false);
      },
    });
  }

  // ── Avatar / logo upload ─────────────────────────────────────────────────

  private validateImage(file: File, setErr: (m: string) => void): boolean {
    if (!ALLOWED_IMAGE.includes(file.type)) { setErr('Please choose a PNG, JPG, WEBP or GIF image.'); return false; }
    if (file.size > MAX_IMAGE_BYTES) { setErr('Image must be 5 MB or smaller.'); return false; }
    return true;
  }

  private uploadImage(file: File, kind: 'avatar' | 'logo') {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    return this.http.post<{ url: string }>(`${environment.apiUrl}/api/uploads/image`, form);
  }

  onAvatarPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.avatarError.set('');
    if (!this.validateImage(file, m => this.avatarError.set(m))) return;

    this.avatarUploading.set(true);
    this.uploadImage(file, 'avatar').subscribe({
      next: ({ url }) => {
        this.http.patch<UserProfile>(`${environment.apiUrl}/api/users/me`, { avatarUrl: url }).subscribe({
          next: (u) => { this.profile.set(u); this.avatarUploading.set(false); },
          error: (err) => { this.avatarError.set(err.error?.error ?? 'Failed to save photo.'); this.avatarUploading.set(false); },
        });
      },
      error: (err) => { this.avatarError.set(err.error?.error ?? 'Upload failed.'); this.avatarUploading.set(false); },
    });
  }

  removeAvatar() {
    this.avatarUploading.set(true);
    this.avatarError.set('');
    this.http.patch<UserProfile>(`${environment.apiUrl}/api/users/me`, { avatarUrl: null }).subscribe({
      next: (u) => { this.profile.set(u); this.avatarUploading.set(false); },
      error: (err) => { this.avatarError.set(err.error?.error ?? 'Failed to remove photo.'); this.avatarUploading.set(false); },
    });
  }

  onLogoPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.logoError.set('');
    if (!this.validateImage(file, m => this.logoError.set(m))) return;

    this.logoUploading.set(true);
    this.uploadImage(file, 'logo').subscribe({
      next: ({ url }) => {
        this.http.patch(`${environment.apiUrl}/api/tenant/profile`, { logoUrl: url }).subscribe({
          next: () => { this.logoUrl.set(url); this.logoUploading.set(false); },
          error: (err) => { this.logoError.set(err.error?.error ?? 'Failed to save logo.'); this.logoUploading.set(false); },
        });
      },
      error: (err) => { this.logoError.set(err.error?.error ?? 'Upload failed.'); this.logoUploading.set(false); },
    });
  }

  removeLogo() {
    this.logoUploading.set(true);
    this.logoError.set('');
    this.http.patch(`${environment.apiUrl}/api/tenant/profile`, { logoUrl: null }).subscribe({
      next: () => { this.logoUrl.set(null); this.logoUploading.set(false); },
      error: (err) => { this.logoError.set(err.error?.error ?? 'Failed to remove logo.'); this.logoUploading.set(false); },
    });
  }

  changePassword() {
    this.passwordError.set('');
    this.passwordSuccess.set(false);
    if (!this.currentPassword() || !this.newPassword()) { this.passwordError.set('All fields are required.'); return; }
    if (this.newPassword() !== this.confirmPassword()) { this.passwordError.set('New passwords do not match.'); return; }
    if (this.newPassword().length < 8) { this.passwordError.set('New password must be at least 8 characters.'); return; }
    this.savingPassword.set(true);
    this.http.patch(`${environment.apiUrl}/api/users/me/password`, {
      currentPassword: this.currentPassword(),
      newPassword: this.newPassword(),
    }).subscribe({
      next: () => {
        this.passwordSuccess.set(true);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.savingPassword.set(false);
        setTimeout(() => this.passwordSuccess.set(false), 3000);
      },
      error: (err) => {
        this.passwordError.set(err.error?.error ?? 'Failed to change password.');
        this.savingPassword.set(false);
      },
    });
  }

  // ── Passkeys ─────────────────────────────────────────────────────────────

  loadPasskeys() {
    this.http.get<{ passkeys: PasskeyEntry[] }>(`${environment.apiUrl}/api/auth/passkey`).subscribe({
      next: (r) => this.passkeys.set(r.passkeys),
      error: () => {},
    });
  }

  async addPasskey() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.passkeyError.set('');
    this.passkeySuccess.set('');
    this.passkeyLoading.set(true);
    try {
      const { options } = await firstValueFrom(
        this.http.post<{ options: any }>(`${environment.apiUrl}/api/auth/passkey/register/options`, {})
      );
      const { startRegistration } = await import('@simplewebauthn/browser');
      const attestation = await startRegistration({ optionsJSON: options });
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/api/auth/passkey/register`, {
          ...attestation,
          name: this.passkeyName() || null,
        })
      );
      this.passkeyName.set('');
      this.passkeySuccess.set('Passkey registered successfully.');
      this.loadPasskeys();
      setTimeout(() => this.passkeySuccess.set(''), 4000);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        this.passkeyError.set('Passkey registration was cancelled.');
      } else {
        this.passkeyError.set(err?.error?.error ?? 'Failed to register passkey.');
      }
    } finally {
      this.passkeyLoading.set(false);
    }
  }

  removePasskey(id: string) {
    this.http.delete(`${environment.apiUrl}/api/auth/passkey/${id}`).subscribe({
      next: () => this.passkeys.update(list => list.filter(p => p.id !== id)),
      error: (err) => this.passkeyError.set(err.error?.error ?? 'Failed to remove passkey.'),
    });
  }

  passkeyDeviceLabel(p: PasskeyEntry): string {
    const base = p.deviceType === 'multiDevice' ? 'Synced passkey' : 'Single-device passkey';
    return p.backedUp ? `${base} (backed up)` : base;
  }
}
