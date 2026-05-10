import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavLinksComponent } from '../nav-links/nav-links';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-sidenav',
  imports: [RouterLink, NavLinksComponent],
  templateUrl: './sidenav.html',
})
export class SidenavComponent {
  constructor(public auth: AuthService) {}
}
