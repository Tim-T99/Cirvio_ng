import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { LogoComponent } from '../../shared/logo/logo';
import { environment } from '../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, LogoComponent],
  templateUrl: './login.html',
})
export class LoginComponent implements OnInit {
  private auth       = inject(AuthService);
  private http       = inject(HttpClient);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);

  email            = signal('');
  password         = signal('');
  showPassword     = signal(false);
  error            = signal('');
  loading          = signal(false);
  sessionExpiredMsg = signal('');
  readonly hasGoogle = !!environment.googleClientId;

  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  get isFormReady() { return this.EMAIL_RE.test(this.email().trim()) && this.password().length > 0; }

  ngOnInit() {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'session_expired') {
      this.sessionExpiredMsg.set('Your session expired. Please log in again.');
    }
    if (isPlatformBrowser(this.platformId) && environment.googleClientId) {
      this.loadGoogleSdk();
    }
  }

  // ── Google ────────────────────────────────────────────────────────────────

  private loadGoogleSdk() {
    if ((window as any)['google']?.accounts) { this.initGoogle(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => this.initGoogle();
    document.head.appendChild(s);
  }

  private initGoogle() {
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (r: { credential: string }) => this.onGoogleCredential(r.credential),
    });
    const el = document.getElementById('google-btn');
    if (el) google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: 348, text: 'signin_with' });
  }

  private onGoogleCredential(credential: string) {
    this.error.set('');
    this.loading.set(true);
    this.auth.loginWithGoogle(credential).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        const e = err.error;
        if (err.status === 404) {
          this.router.navigate(['/signup'], { queryParams: { email: e?.email, firstName: e?.firstName, lastName: e?.lastName, via: 'google' } });
        } else {
          this.error.set(e?.error ?? 'Google sign-in failed.');
          this.loading.set(false);
        }
      },
    });
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
    if (!this.isFormReady || this.loading()) return;
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
