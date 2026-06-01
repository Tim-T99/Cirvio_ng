import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { LogoComponent } from '../../../shared/logo/logo';

interface UserProfile {
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
}

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LogoComponent],
  templateUrl: './sidenav.html',
})
export class SidenavComponent {
  @Input() mobileOpen = false;
  @Output() navClose = new EventEmitter<void>();

  private auth = inject(AuthService);
  private http = inject(HttpClient);

  profile = signal<UserProfile | null>(null);

  readonly navLinks = [
    { label: 'Home',       path: '/dashboard',            exact: true,  icon: 'home'      },
    { label: 'Employees',  path: '/dashboard/employees',  exact: false, icon: 'employees' },
    { label: 'Visas',      path: '/dashboard/visas',      exact: false, icon: 'visas'     },
    { label: 'WPS',        path: '/dashboard/wps',        exact: false, icon: 'wps'       },
    { label: 'Org Chart',  path: '/dashboard/org',        exact: false, icon: 'org'       },
    { label: 'Documents',  path: '/dashboard/documents',  exact: false, icon: 'docs'      },
    { label: 'Chat',       path: '/dashboard/chat',       exact: false, icon: 'chat'      },
    { label: 'Settings',   path: '/dashboard/settings',   exact: false, icon: 'settings'  },
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
