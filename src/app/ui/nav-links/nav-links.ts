import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavLink {
  name: string;
  href: string;
}

@Component({
  selector: 'app-nav-links',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-links.html',
})
export class NavLinksComponent {
  links: NavLink[] = [
    { name: 'Chat', href: '/dashboard' },
    { name: 'Documents', href: '/dashboard/documents' },
    { name: 'Settings', href: '/dashboard/settings' },
  ];
}
