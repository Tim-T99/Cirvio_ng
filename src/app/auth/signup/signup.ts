import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { PasswordRuleComponent } from '../password-rule/password-rule';
import { LogoComponent } from '../../shared/logo/logo';

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
export class SignupComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

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

    return base && this.allRulesMet() && this.password() === this.confirmPassword() && this.confirmPassword().length > 0;
  });

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
    if (!this.allRulesMet()) next['password'] = 'Password does not meet all requirements';
    if (this.confirmPassword() && this.password() !== this.confirmPassword()) next['confirmPassword'] = 'Passwords do not match';
    this.errors.set(next);
    return Object.keys(next).length === 0;
  }

  handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.validate()) return;
    this.loading.set(true);
    this.serverError.set('');

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
