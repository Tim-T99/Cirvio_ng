import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PasswordRuleComponent } from '../password-rule/password-rule';
import { LogoComponent } from '../../shared/logo/logo';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [RouterLink, PasswordRuleComponent, LogoComponent],
  templateUrl: './reset-password.html',
})
export class ResetPasswordComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  token = signal('');
  tokenError = signal('');

  password = signal('');
  confirmPassword = signal('');
  showPassword = signal(false);
  passwordFocused = signal(false);
  loading = signal(false);
  serverError = signal('');
  success = signal(false);

  readonly passwordRules = computed(() => {
    const pw = this.password();
    return {
      length:    pw.length >= 8,
      uppercase: /[A-Z]/.test(pw),
      number:    /[0-9]/.test(pw),
      special:   /[^A-Za-z0-9]/.test(pw),
    };
  });

  readonly allRulesMet = computed(() => Object.values(this.passwordRules()).every(Boolean));

  readonly isFormReady = computed(() =>
    this.allRulesMet() &&
    this.password() === this.confirmPassword() &&
    this.confirmPassword().length > 0
  );

  ngOnInit() {
    const t = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!t) { this.tokenError.set('No reset token found. Please use the link from your email.'); return; }
    this.token.set(t);
  }

  handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.isFormReady() || !this.token()) return;
    this.loading.set(true);
    this.serverError.set('');
    this.http.post(
      `${environment.apiUrl}/api/users/password-reset/${encodeURIComponent(this.token())}`,
      { newPassword: this.password() }
    ).subscribe({
      next: () => {
        this.success.set(true);
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (err) => {
        this.serverError.set(err.error?.error ?? 'This reset link is invalid or has expired. Please request a new one.');
        this.loading.set(false);
      },
    });
  }
}
