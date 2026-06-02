import { Component, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  organizationName?: string;
  tenant?: { id: string; name: string; country: string };
}

interface OrgProfile {
  name: string;
  phone: string | null;
  industry: string | null;
  tradelicenseNo: string | null;
  tradelicenseExpiry: string | null;
  emirate: string | null;
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
  imports: [DatePipe],
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

  ngOnInit() {
    this.http.get<UserProfile>(`${environment.apiUrl}/api/users/me`).subscribe({
      next: (u) => {
        this.profile.set(u);
        this.firstName.set(u.firstName ?? '');
        this.lastName.set(u.lastName ?? '');
        this.loading.set(false);
        if (u.role === 'TENANT_ADMIN') this.loadOrgProfile();
        this.loadPasskeys();
      },
      error: () => { this.error.set('Failed to load profile.'); this.loading.set(false); },
    });
  }

  private loadOrgProfile() {
    this.http.get<OrgProfile>(`${environment.apiUrl}/api/tenant/profile`).subscribe({
      next: (o) => {
        this.orgName.set(o.name ?? '');
        this.orgPhone.set(o.phone ?? '');
        this.orgIndustry.set(o.industry ?? '');
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
