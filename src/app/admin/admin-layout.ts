import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminSidenavComponent } from './admin-sidenav/admin-sidenav';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, AdminSidenavComponent],
  templateUrl: './admin-layout.html',
})
export class AdminLayoutComponent {
  readonly mobileNavOpen = signal(false);
}
