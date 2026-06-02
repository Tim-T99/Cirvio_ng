import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-session-warning',
  standalone: true,
  templateUrl: './session-warning.html',
})
export class SessionWarningComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private sub!: Subscription;

  visible      = signal(false);
  secondsLeft  = signal(0);
  extending    = signal(false);

  ngOnInit() {
    this.sub = this.auth.sessionWarning$.subscribe((state) => {
      if (state) {
        this.secondsLeft.set(state.secondsLeft);
        this.visible.set(true);
      } else {
        this.visible.set(false);
      }
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  get minutesLeft(): number { return Math.floor(this.secondsLeft() / 60); }
  get secsRemainder(): string { return String(this.secondsLeft() % 60).padStart(2, '0'); }

  extend() {
    this.extending.set(true);
    this.auth.refresh().subscribe({
      next: () => { this.visible.set(false); this.extending.set(false); },
      error: () => { this.extending.set(false); this.auth.logout(); },
    });
  }

  logout() { this.auth.logout(); }
}
