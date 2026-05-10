import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PasswordRuleComponent } from '../password-rule/password-rule';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [RouterLink, PasswordRuleComponent],
  templateUrl: './accept-invite.html',
})
export class AcceptInviteComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  token = signal('');
  inviteInfo = signal<{ email?: string; organizationName?: string } | null>(null);
  tokenError = signal('');

  firstName = signal('');
  lastName = signal('');
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
    this.firstName().trim().length > 0 &&
    this.lastName().trim().length > 0 &&
    this.allRulesMet() &&
    this.password() === this.confirmPassword() &&
    this.confirmPassword().length > 0
  );

  ngOnInit() {
    const t = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!t) { this.tokenError.set('No invite token found. Please check your invite link.'); return; }
    this.token.set(t);
    this.http.get<{ email?: string; organizationName?: string; error?: string }>(
      `${environment.apiUrl}/api/auth/accept-invite?token=${encodeURIComponent(t)}`
    ).subscribe({
      next: (d) => { if (d.error) this.tokenError.set(d.error); else this.inviteInfo.set(d); },
      error: () => this.tokenError.set('Unable to validate invite link. Please try again.'),
    });
  }

  handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.isFormReady() || !this.token()) return;
    this.loading.set(true);
    this.serverError.set('');
    this.http.post(`${environment.apiUrl}/api/auth/accept-invite`, {
      token: this.token(),
      firstName: this.firstName(),
      lastName: this.lastName(),
      password: this.password(),
      confirmPassword: this.confirmPassword(),
    }).subscribe({
      next: () => {
        this.success.set(true);
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (err) => {
        this.serverError.set(err.error?.error ?? 'Failed to accept invite. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
