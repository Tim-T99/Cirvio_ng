import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidenavComponent } from './ui/sidenav/sidenav';
import { SessionWarningComponent } from '../shared/session-warning/session-warning';
import { LogoComponent } from '../shared/logo/logo';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterOutlet, SidenavComponent, SessionWarningComponent, LogoComponent],
  templateUrl: './dashboard.html',
})
export class DashboardComponent {
  readonly mobileNavOpen = signal(false);
}
