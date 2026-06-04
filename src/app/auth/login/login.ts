import { Component, inject, signal, computed, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { LogoComponent } from '../../shared/logo/logo';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, LogoComponent],
  templateUrl: './login.html',
})
export class LoginComponent implements OnInit {
  private auth       = inject(AuthService);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);

  email            = signal('');
  password         = signal('');
  showPassword     = signal(false);
  error            = signal('');
  loading          = signal(false);
  sessionExpiredMsg = signal('');

  // Validation state
  submitted = signal(false);
  touched   = signal<Record<string, boolean>>({});

  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

  /** Per-field errors derived from the current values (re-evaluates as the user types). */
  readonly fieldErrors = computed<Record<string, string>>(() => {
    const errors: Record<string, string> = {};
    const email = this.email().trim();
    if (!email)                       errors['email'] = 'Email is required';
    else if (!this.EMAIL_RE.test(email)) errors['email'] = 'Enter a valid email address';
    if (!this.password())             errors['password'] = 'Password is required';
    return errors;
  });

  /** Show a field's error only once it's been blurred or the form was submitted. */
  showError(field: string): boolean {
    return (this.submitted() || !!this.touched()[field]) && !!this.fieldErrors()[field];
  }

  markTouched(field: string): void {
    this.touched.update(t => ({ ...t, [field]: true }));
  }

  ngOnInit() {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'session_expired') {
      this.sessionExpiredMsg.set('Your session expired. Please log in again.');
    }
  }

  // ── Passkey ───────────────────────────────────────────────────────────────

  async signInWithPasskey() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!(window as any).PublicKeyCredential) {
      this.error.set('Passkeys are not supported in this browser.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    try {
      const { options, challengeId } = await firstValueFrom(this.auth.passkeyLoginOptions());
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const assertion = await startAuthentication({ optionsJSON: options });
      this.auth.loginWithPasskey(challengeId, assertion).subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: (err) => {
          this.error.set(err.error?.error ?? 'Passkey sign-in failed.');
          this.loading.set(false);
        },
      });
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        this.error.set('Passkey sign-in was cancelled.');
      } else if (err?.name === 'NotSupportedError') {
        this.error.set('Passkeys are not supported on this device.');
      } else if (err?.status) {
        this.error.set(err.error?.error ?? 'Passkey sign-in failed.');
      } else {
        this.error.set('Passkey sign-in failed. Please try again.');
      }
      this.loading.set(false);
    }
  }

  // ── Email/password ────────────────────────────────────────────────────────

  handleSubmit(e: Event) {
    e.preventDefault();
    this.submitted.set(true);
    if (Object.keys(this.fieldErrors()).length > 0 || this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    this.auth.login(this.email().trim(), this.password()).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(err.error?.error ?? 'Login failed. Check your credentials.');
        this.loading.set(false);
      },
    });
  }
}
