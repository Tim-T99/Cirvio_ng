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
  serverError      = signal('');
  loading          = signal(false);

  // Validation state
  submitted = signal(false);
  touched   = signal<Record<string, boolean>>({});

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

  // ── Validation ────────────────────────────────────────────────────────────

  /** Per-field errors derived from the current values (re-evaluates as the user types). */
  readonly fieldErrors = computed<Record<string, string>>(() => {
    const e: Record<string, string> = {};
    if (!this.organizationName().trim()) e['organizationName'] = 'Organization name is required';
    if (!this.industry())                e['industry']         = 'Please select an industry';
    if (!this.country())                 e['country']          = 'Please select a country';
    if (!this.firstName().trim())        e['firstName']        = 'First name is required';
    if (!this.lastName().trim())         e['lastName']         = 'Last name is required';

    const email = this.email().trim();
    if (!email)                          e['email'] = 'Email is required';
    else if (!this.EMAIL_RE.test(email)) e['email'] = 'Enter a valid email address';

    if (!this.password())                e['password'] = 'Password is required';
    else if (!this.allRulesMet())        e['password'] = 'Password does not meet all requirements';

    if (!this.confirmPassword())                        e['confirmPassword'] = 'Please confirm your password';
    else if (this.password() !== this.confirmPassword()) e['confirmPassword'] = 'Passwords do not match';

    return e;
  });

  readonly isFormReady = computed(() => Object.keys(this.fieldErrors()).length === 0);

  /** Show a field's error only once it's been blurred or the form was submitted. */
  showError(field: string): boolean {
    return (this.submitted() || !!this.touched()[field]) && !!this.fieldErrors()[field];
  }

  markTouched(field: string): void {
    this.touched.update(t => ({ ...t, [field]: true }));
  }

  handleSubmit(e: Event) {
    e.preventDefault();
    this.submitted.set(true);
    if (!this.isFormReady() || this.loading()) return;
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
