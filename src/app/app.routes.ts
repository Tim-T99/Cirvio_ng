import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';

export const routes: Routes = [
  // Marketing (with Header/Footer layout)
  {
    path: '',
    loadComponent: () => import('./marketing/marketing').then(m => m.MarketingComponent),
    children: [
      { path: '', loadComponent: () => import('./marketing/home/home').then(m => m.HomeComponent) },
      { path: 'features', loadComponent: () => import('./marketing/features/features').then(m => m.FeaturesComponent) },
      { path: 'pricing', loadComponent: () => import('./marketing/pricing/pricing').then(m => m.PricingComponent) },
      { path: 'about', loadComponent: () => import('./marketing/about/about').then(m => m.AboutComponent) },
      { path: 'contact', loadComponent: () => import('./marketing/contact/contact').then(m => m.ContactComponent) },
    ],
  },

  // Auth pages
  { path: 'maintenance',   loadComponent: () => import('./maintenance/maintenance').then(m => m.MaintenanceComponent) },
  { path: 'login',          canActivate: [guestGuard], loadComponent: () => import('./auth/login/login').then(m => m.LoginComponent) },
  { path: 'signup',         canActivate: [guestGuard], loadComponent: () => import('./auth/signup/signup').then(m => m.SignupComponent) },
  { path: 'admin',          loadComponent: () => import('./auth/admin-login/admin-login').then(m => m.AdminLoginComponent) },
  { path: 'accept-invite',   loadComponent: () => import('./auth/accept-invite/accept-invite').then(m => m.AcceptInviteComponent) },
  { path: 'forgot-password', canActivate: [guestGuard], loadComponent: () => import('./auth/forgot-password/forgot-password').then(m => m.ForgotPasswordComponent) },
  { path: 'reset-password',  loadComponent: () => import('./auth/reset-password/reset-password').then(m => m.ResetPasswordComponent) },

  // User dashboard
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./dashboard/dashboard').then(m => m.DashboardComponent),
    children: [
      { path: '',                loadComponent: () => import('./dashboard/home/home').then(m => m.HomeComponent) },
      { path: 'employees',       loadComponent: () => import('./dashboard/employees/employees').then(m => m.EmployeesComponent) },
      { path: 'employees/:id',   loadComponent: () => import('./dashboard/employees/employee-detail/employee-detail').then(m => m.EmployeeDetailComponent) },
      { path: 'visas',           loadComponent: () => import('./dashboard/visas/visas').then(m => m.VisasComponent) },
      { path: 'wps',             loadComponent: () => import('./dashboard/wps/wps').then(m => m.WpsComponent) },
      { path: 'org',             loadComponent: () => import('./dashboard/org-chart/org-chart').then(m => m.OrgChartComponent) },
      { path: 'chat',            loadComponent: () => import('./dashboard/chat/chat').then(m => m.ChatComponent) },
      { path: 'documents',       loadComponent: () => import('./dashboard/documents/documents').then(m => m.DocumentsComponent) },
      { path: 'settings',        loadComponent: () => import('./dashboard/settings/settings').then(m => m.SettingsComponent) },
    ],
  },

  // Admin dashboard
  {
    path: 'admin/dashboard',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/admin-layout').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', loadComponent: () => import('./admin/overview/overview').then(m => m.OverviewComponent) },
      { path: 'tenants', loadComponent: () => import('./admin/tenants/tenants').then(m => m.TenantsComponent) },
      { path: 'tenants/:tenantId', loadComponent: () => import('./admin/tenants/tenant-detail').then(m => m.TenantDetailComponent) },
      { path: 'users/:userId', loadComponent: () => import('./admin/users/user-detail').then(m => m.AdminUserDetailComponent) },
      { path: 'plans',   loadComponent: () => import('./admin/plans/plans').then(m => m.PlansComponent) },
      { path: 'admins',  loadComponent: () => import('./admin/admins/admins').then(m => m.AdminsComponent) },
      { path: 'audit',      loadComponent: () => import('./admin/audit/audit').then(m => m.AuditComponent) },
      { path: 'monitoring', loadComponent: () => import('./admin/monitoring/monitoring').then(m => m.MonitoringComponent) },
    ],
  },

  { path: '**', redirectTo: '' },
];
