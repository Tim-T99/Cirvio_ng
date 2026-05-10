import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface NavLink {
  label: string;
  path: string;
  exact: boolean;
}

@Component({
  selector: 'app-nav-links',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    @for (link of links; track link.path) {
      <a [routerLink]="link.path" [routerLinkActive]="'nav-active'"
         [routerLinkActiveOptions]="{ exact: link.exact }"
         style="display:block;padding:8px 14px;border-radius:var(--radius-sm);font-size:14px;font-weight:500;color:var(--fg-2);text-decoration:none;transition:background var(--dur-fast) var(--ease-out),color var(--dur-fast) var(--ease-out);">
        {{ link.label }}
      </a>
    }
  `,
})
export class NavLinksComponent {
  @Input() links: NavLink[] = [];
}
