import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LogoComponent } from '../../shared/logo/logo';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LogoComponent],
  templateUrl: './header.html',
})
export class HeaderComponent {
  open = signal(false);

  toggleMenu(): void {
    this.open.update(v => !v);
  }

  closeMenu(): void {
    this.open.set(false);
  }
}
