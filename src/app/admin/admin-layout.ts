import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminSidenavComponent } from './admin-sidenav/admin-sidenav';
import { LogoComponent } from '../shared/logo/logo';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, AdminSidenavComponent, LogoComponent],
  templateUrl: './admin-layout.html',
})
export class AdminLayoutComponent {
  readonly mobileNavOpen = signal(false);
}
