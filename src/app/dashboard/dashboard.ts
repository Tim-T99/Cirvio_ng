import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SidenavComponent } from './ui/sidenav/sidenav';
import { SessionWarningComponent } from '../shared/session-warning/session-warning';
import { LogoComponent } from '../shared/logo/logo';
import { environment } from '../../environments/environment';

interface BillingBanner {
  status: string;
  trialEndsAt: string | null;
  trialExpired: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SidenavComponent, SessionWarningComponent, LogoComponent],
  templateUrl: './dashboard.html',
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);

  readonly mobileNavOpen = signal(false);
  private billing = signal<BillingBanner | null>(null);

  // Banner state: expired trial (hard wall) or trial ending within 5 days.
  readonly banner = computed<{ level: 'danger' | 'warning'; text: string } | null>(() => {
    const b = this.billing();
    if (!b) return null;
    if (b.trialExpired) {
      return { level: 'danger', text: 'Your free trial has ended. Your workspace is read-only until you subscribe.' };
    }
    if (b.status === 'TRIAL' && b.trialEndsAt) {
      const days = Math.ceil((new Date(b.trialEndsAt).getTime() - Date.now()) / 86400000);
      if (days >= 0 && days <= 5) {
        return { level: 'warning', text: `Your free trial ends in ${days} day${days === 1 ? '' : 's'}.` };
      }
    }
    return null;
  });

  ngOnInit() {
    this.http.get<BillingBanner>(`${environment.apiUrl}/api/billing/subscription`).subscribe({
      next: (b) => this.billing.set(b),
      error: () => {},
    });
  }
}
