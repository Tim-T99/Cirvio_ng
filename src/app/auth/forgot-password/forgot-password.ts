import { Component, signal, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LogoComponent } from '../../shared/logo/logo';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [RouterLink, LogoComponent],
  templateUrl: './forgot-password.html',
})
export class ForgotPasswordComponent {
  private http = inject(HttpClient);

  email = signal('');
  tenantSlug = signal('');
  submitted = signal(false);
  touched = signal(false);
  loading = signal(false);
  serverError = signal('');
  success = signal(false);

  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

  readonly errors = computed(() => ({
    email: !this.email().trim() ? 'Email is required'
      : !this.EMAIL_RE.test(this.email().trim()) ? 'Enter a valid email address' : '',
    tenantSlug: !this.tenantSlug().trim() ? 'Organisation slug is required' : '',
  }));

  readonly isValid = computed(() => !this.errors().email && !this.errors().tenantSlug);

  showError(field: 'email' | 'tenantSlug'): string {
    return (this.touched() || this.submitted()) ? this.errors()[field] : '';
  }

  handleSubmit(e: Event) {
    e.preventDefault();
    this.submitted.set(true);
    this.serverError.set('');
    if (!this.isValid()) return;

    this.loading.set(true);
    this.http.post<{ message: string }>(
      `${environment.apiUrl}/api/users/password-reset/request`,
      { email: this.email().trim(), tenantSlug: this.tenantSlug().trim() }
    ).subscribe({
      // [S4] Backend always returns success to prevent email enumeration.
      next: () => { this.success.set(true); this.loading.set(false); },
      error: (err) => {
        this.serverError.set(err.error?.error ?? 'Something went wrong. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
