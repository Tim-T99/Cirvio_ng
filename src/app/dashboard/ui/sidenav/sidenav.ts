import { Component, EventEmitter, inject, Input, Output, signal, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { LogoComponent } from '../../../shared/logo/logo';
import { AvatarComponent } from '../../../shared/avatar/avatar';

interface UserProfile {
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LogoComponent, AvatarComponent],
  templateUrl: './sidenav.html',
})
export class SidenavComponent {
  @Input() mobileOpen = false;
  @Output() navClose = new EventEmitter<void>();

  private auth = inject(AuthService);
  private http = inject(HttpClient);

  profile = signal<UserProfile | null>(null);
  // Entitled feature keys (null until loaded → links shown by default).
  private features = signal<string[] | null>(null);

  private readonly allLinks = [
    { label: 'Home',       path: '/dashboard',            exact: true,  icon: 'home',     feature: null as string | null },
    { label: 'Employees',  path: '/dashboard/employees',  exact: false, icon: 'employees', feature: null as string | null },
    { label: 'Visas',      path: '/dashboard/visas',      exact: false, icon: 'visas',     feature: null as string | null },
    { label: 'WPS',        path: '/dashboard/wps',        exact: false, icon: 'wps',       feature: null as string | null },
    { label: 'Org Chart',  path: '/dashboard/org',        exact: false, icon: 'org',       feature: null as string | null },
    { label: 'Documents',  path: '/dashboard/documents',  exact: false, icon: 'docs',      feature: null as string | null },
    { label: 'Chat',       path: '/dashboard/chat',       exact: false, icon: 'chat',      feature: 'ai_assistant' as string | null },
    { label: 'Settings',   path: '/dashboard/settings',   exact: false, icon: 'settings',  feature: null as string | null },
  ];

  // Hide a link only when entitlements are known AND its feature is excluded.
  readonly navLinks = computed(() => {
    const f = this.features();
    return this.allLinks.filter(l => !l.feature || f === null || f.includes(l.feature));
  });

  constructor() {
    this.http.get<UserProfile>(`${environment.apiUrl}/api/users/me`).subscribe({
      next: (u) => this.profile.set(u),
      error: () => {},
    });
    this.http.get<{ features: string[] }>(`${environment.apiUrl}/api/billing/subscription`).subscribe({
      next: (s) => this.features.set(s.features ?? null),
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
