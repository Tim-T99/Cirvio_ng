import { Component, signal, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

const COUNTRY_NAMES: Record<string, string> = {
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  QA: 'Qatar',
  BH: 'Bahrain',
  KW: 'Kuwait',
  OM: 'Oman',
  OTHER: 'Other',
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [],
  templateUrl: './settings.html',
})
export class SettingsComponent implements OnInit {
  private http = inject(HttpClient);

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

  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  passwordError = signal('');
  passwordSuccess = signal(false);
  savingPassword = signal(false);

  ngOnInit() {
    this.http.get<UserProfile>(`${environment.apiUrl}/api/users/me`).subscribe({
      next: (u) => {
        this.profile.set(u);
        this.firstName.set(u.firstName ?? '');
        this.lastName.set(u.lastName ?? '');
        this.loading.set(false);
      },
      error: () => { this.error.set('Failed to load profile.'); this.loading.set(false); },
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
    this.http.post(`${environment.apiUrl}/api/users/change-password`, {
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
}
