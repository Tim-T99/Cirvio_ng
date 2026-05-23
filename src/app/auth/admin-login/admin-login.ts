import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../core/admin-auth.service';
import { LogoComponent } from '../../shared/logo/logo';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [RouterLink, LogoComponent],
  templateUrl: './admin-login.html',
})
export class AdminLoginComponent {
  email = signal('');
  password = signal('');
  showPassword = signal(false);
  error = signal('');
  loading = signal(false);

  constructor(private auth: AdminAuthService, private router: Router) {}

  handleSubmit(e: Event) {
    e.preventDefault();
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email(), this.password()).subscribe({
      next: () => this.router.navigate(['/admin/dashboard']),
      error: (err) => {
        this.error.set(err.error?.error ?? 'Login failed. Check your credentials.');
        this.loading.set(false);
      },
    });
  }
}
