import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.html',
})
export class SignupComponent {
  email = '';
  username = '';
  password = '';
  confirmPassword = '';

  errors = signal<Record<string, string>>({});
  loading = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  validate(): boolean {
    const e: Record<string, string> = {};

    if (this.username.length < 3) {
      e['username'] = 'Username must be at least 3 characters.';
    }
    if (this.password.length < 8) {
      e['password'] = 'Password must be at least 8 characters.';
    } else if (!/\d/.test(this.password)) {
      e['password'] = 'Password must contain at least one number.';
    }
    if (this.password !== this.confirmPassword) {
      e['confirmPassword'] = 'Passwords do not match.';
    }

    this.errors.set(e);
    return Object.keys(e).length === 0;
  }

  handleSubmit() {
    if (!this.validate()) return;

    this.loading.set(true);
    this.auth.signup(this.email, this.username, this.password).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.errors.set({ form: err.error?.message ?? 'Signup failed. Please try again.' });
        this.loading.set(false);
      },
    });
  }
}
