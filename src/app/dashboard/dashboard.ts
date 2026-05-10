import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidenavComponent } from '../ui/sidenav/sidenav';

@Component({
  selector: 'app-dashboard',
  imports: [RouterOutlet, SidenavComponent],
  templateUrl: './dashboard.html',
})
export class DashboardComponent {}
