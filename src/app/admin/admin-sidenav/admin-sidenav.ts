import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AdminAuthService } from '../../core/admin-auth.service';
import { LogoComponent } from '../../shared/logo/logo';

@Component({
  selector: 'app-admin-sidenav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LogoComponent],
  templateUrl: './admin-sidenav.html',
})
export class AdminSidenavComponent {
  readonly auth = inject(AdminAuthService);

  readonly navLinks = [
    {
      label: 'Overview',
      path: '/admin/dashboard',
      exact: true,
      icon: 'overview',
    },
    {
      label: 'Tenants',
      path: '/admin/dashboard/tenants',
      exact: false,
      icon: 'tenants',
    },
    {
      label: 'Plans',
      path: '/admin/dashboard/plans',
      exact: false,
      icon: 'plans',
    },
    {
      label: 'Admins',
      path: '/admin/dashboard/admins',
      exact: false,
      icon: 'admins',
    },
    {
      label: 'Audit Log',
      path: '/admin/dashboard/audit',
      exact: false,
      icon: 'audit',
    },
  ];

  logout(): void {
    this.auth.logout();
  }
}
