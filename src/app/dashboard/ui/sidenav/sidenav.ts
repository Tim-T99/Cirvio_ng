import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface UserProfile {
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
}

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidenav.html',
})
export class SidenavComponent {
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  profile = signal<UserProfile | null>(null);

  readonly navLinks = [
    { label: 'Chat', path: '/dashboard', exact: true, icon: 'chat' },
    { label: 'Documents', path: '/dashboard/documents', exact: false, icon: 'docs' },
    { label: 'Settings', path: '/dashboard/settings', exact: false, icon: 'settings' },
  ];

  constructor() {
    this.http.get<UserProfile>(`${environment.apiUrl}/api/users/me`).subscribe({
      next: (u) => this.profile.set(u),
      error: () => {},
    });
  }

  get initials(): string {
    const p = this.profile();
    if (!p) return '?';
    const f = p.firstName?.[0] ?? '';
    const l = p.lastName?.[0] ?? '';
    return (f + l).toUpperCase() || p.email[0].toUpperCase();
  }

  get displayName(): string {
    const p = this.profile();
    if (!p) return '';
    if (p.firstName || p.lastName) return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
    return p.email;
  }

  logout() {
    this.auth.logout();
  }
}
