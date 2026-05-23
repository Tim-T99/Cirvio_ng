import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LogoComponent } from '../../shared/logo/logo';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, LogoComponent],
  templateUrl: './login.html',
})
export class LoginComponent {
  email = signal('');
  password = signal('');
  showPassword = signal(false);
  error = signal('');
  loading = signal(false);

  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  get isFormReady() { return this.EMAIL_RE.test(this.email().trim()) && this.password().length > 0; }

  constructor(private auth: AuthService, private router: Router) {}

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
