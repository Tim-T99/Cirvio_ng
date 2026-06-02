import { Component, inject, signal, computed, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { PasswordRuleComponent } from '../password-rule/password-rule';
import { LogoComponent } from '../../shared/logo/logo';
import { environment } from '../../../environments/environment';

declare const google: any;

export const INDUSTRIES = [
  'Construction & Real Estate',
  'Oil, Gas & Energy',
  'Technology & IT Services',
  'Healthcare & Pharmaceuticals',
  'Retail & E-commerce',
  'Financial Services & Banking',
  'Hospitality & Tourism',
  'Transportation & Logistics',
  'Education & Training',
  'Manufacturing & Industrial',
  'Government & Public Sector',
  'Professional Services (Legal, Consulting, Accounting)',
  'Media & Advertising',
  'Telecommunications',
  'Agriculture & Food',
  'Other',
];

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [RouterLink, PasswordRuleComponent, LogoComponent],
  templateUrl: './signup.html',
})
export class SignupComponent implements OnInit {
  private auth       = inject(AuthService);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);

  organizationName = signal('');
  industry         = signal('');
  country          = signal('AE');
  firstName        = signal('');
  lastName         = signal('');
  email            = signal('');
  password         = signal('');
  confirmPassword  = signal('');
  showPassword     = signal(false);
  passwordFocused  = signal(false);
  emailTouched     = signal(false);
  errors           = signal<Record<string, string>>({});
  serverError      = signal('');
  loading          = signal(false);
  readonly hasGoogle = !!environment.googleClientId;

  // Filled via Google OAuth pre-fill
  googleCredential = signal<string | null>(null);
  googlePrefilled  = signal(false);

  readonly INDUSTRIES = INDUSTRIES;

  readonly countries: { code: string; name: string }[] = [
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'QA', name: 'Qatar' },
    { code: 'BH', name: 'Bahrain' },
    { code: 'KW', name: 'Kuwait' },
    { code: 'OM', name: 'Oman' },
    { code: 'OTHER', name: 'Other' },
  ];

  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

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

  readonly isFormReady = computed(() => {
    const base =
      this.organizationName().trim().length > 0 &&
      this.firstName().trim().length > 0 &&
      this.lastName().trim().length > 0 &&
      this.EMAIL_RE.test(this.email().trim()) &&
      this.industry().length > 0 &&
      this.country().length > 0;

    if (this.googlePrefilled()) return base; // Google users don't need password fields
    return base && this.allRulesMet() && this.password() === this.confirmPassword() && this.confirmPassword().length > 0;
  });

  ngOnInit() {
    // Pre-fill from Google redirect
    const params = this.route.snapshot.queryParamMap;
    if (params.get('via') === 'google') {
      if (params.get('email'))     this.email.set(params.get('email')!);
      if (params.get('firstName')) this.firstName.set(params.get('firstName')!);
      if (params.get('lastName'))  this.lastName.set(params.get('lastName')!);
      this.googlePrefilled.set(true);
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
      callback: (r: { credential: string }) => {
        this.googleCredential.set(r.credential);
        this.googlePrefilled.set(true);
        // Decode for name/email pre-fill (payload is base64url, no verification needed client-side)
        try {
          const payload = JSON.parse(atob(r.credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
          if (payload.email)      this.email.set(payload.email);
          if (payload.given_name) this.firstName.set(payload.given_name);
          if (payload.family_name) this.lastName.set(payload.family_name);
        } catch {}
      },
    });
    const el = document.getElementById('signup-google-btn');
    if (el) google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: 388, text: 'signup_with' });
  }

  signInWithApple() {
    this.serverError.set('Apple Sign-In requires server configuration. Contact your administrator.');
  }

  // ── Validation ────────────────────────────────────────────────────────────

  handleEmailBlur() {
    this.emailTouched.set(true);
    if (this.email() && !this.EMAIL_RE.test(this.email().trim())) {
      this.errors.update(e => ({ ...e, email: 'Please enter a valid email address' }));
    }
  }

  validate(): boolean {
    const next: Record<string, string> = {};
    if (!this.organizationName().trim()) next['organizationName'] = 'Organization name is required';
    if (!this.industry())                next['industry']         = 'Please select an industry';
    if (!this.country())                 next['country']          = 'Please select a country';
    if (!this.firstName().trim())        next['firstName']        = 'First name is required';
    if (!this.lastName().trim())         next['lastName']         = 'Last name is required';
    if (!this.email().trim())            next['email']            = 'Email is required';
    else if (!this.EMAIL_RE.test(this.email().trim())) next['email'] = 'Please enter a valid email address';
    if (!this.googlePrefilled()) {
      if (!this.allRulesMet()) next['password'] = 'Password does not meet all requirements';
      if (this.confirmPassword() && this.password() !== this.confirmPassword()) next['confirmPassword'] = 'Passwords do not match';
    }
    this.errors.set(next);
    return Object.keys(next).length === 0;
  }

  handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.validate()) return;
    this.loading.set(true);
    this.serverError.set('');

    const cred = this.googleCredential();
    if (cred) {
      // Google OAuth registration
      this.auth.registerWithGoogle({
        credential:       cred,
        organizationName: this.organizationName(),
        country:          this.country(),
        industry:         this.industry() || undefined,
      }).subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: (err) => { this.serverError.set(err.error?.error ?? 'Registration failed.'); this.loading.set(false); },
      });
    } else {
      // Email/password registration
      this.auth.register({
        organizationName: this.organizationName(),
        firstName:        this.firstName(),
        lastName:         this.lastName(),
        email:            this.email().trim(),
        password:         this.password(),
        country:          this.country(),
        industry:         this.industry() || undefined,
      }).subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: (err) => { this.serverError.set(err.error?.error ?? 'Registration failed. Please try again.'); this.loading.set(false); },
      });
    }
  }
}
