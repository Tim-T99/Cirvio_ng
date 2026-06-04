import {
  Injectable, signal, computed, PLATFORM_ID, inject, NgZone,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: string; email: string;
  firstName?: string; lastName?: string;
  role: string; tenantId?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY  = 'cirvio_token';
const EXPIRY_KEY = 'cirvio_token_exp';
const WARN_BEFORE_SEC = 120; // show warning at 2 min remaining
const SESSION_MS = 15 * 60 * 1000; // 15 minutes

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http       = inject(HttpClient);
  private router     = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private zone       = inject(NgZone);

  private _token = signal<string | null>(this.readStorage(TOKEN_KEY));
  readonly token = this._token.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  /** Emits { secondsLeft } while in warning window; null when safe or logged out */
  readonly sessionWarning$ = new Subject<{ secondsLeft: number } | null>();

  private _expiresAt = 0;
  private _ticker: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(EXPIRY_KEY);
      if (stored) this._expiresAt = +stored;
      if (this._token()) this.startTicker();
    }
  }

  // ── Storage ───────────────────────────────────────────────────────────────

  private readStorage(key: string): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(key);
  }

  private persist(token: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    this._expiresAt = Date.now() + SESSION_MS;
    localStorage.setItem(TOKEN_KEY,  token);
    localStorage.setItem(EXPIRY_KEY, String(this._expiresAt));
  }

  private clearStorage() {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  }

  // ── Session ticker ────────────────────────────────────────────────────────

  private startTicker() {
    this.stopTicker();
    this.zone.runOutsideAngular(() => {
      this._ticker = setInterval(() => this.zone.run(() => this.tick()), 10_000);
    });
  }

  private stopTicker() {
    if (this._ticker) { clearInterval(this._ticker); this._ticker = null; }
  }

  private tick() {
    if (!this._token()) return;
    const secondsLeft = Math.floor((this._expiresAt - Date.now()) / 1000);
    if (secondsLeft <= 0) {
      this.sessionWarning$.next(null);
      this.forceLogout();
    } else if (secondsLeft <= WARN_BEFORE_SEC) {
      this.sessionWarning$.next({ secondsLeft });
    } else {
      this.sessionWarning$.next(null);
    }
  }

  private forceLogout() {
    this.stopTicker();
    this._token.set(null);
    this.clearStorage();
    this.router.navigate(['/login'], { queryParams: { reason: 'session_expired' } });
  }

  // ── Auth operations ───────────────────────────────────────────────────────

  private applyToken(res: LoginResponse) {
    this._token.set(res.token);
    this.persist(res.token);
    this.sessionWarning$.next(null);
    this.startTicker();
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/api/users/login`, { email, password })
      .pipe(tap((res) => this.applyToken(res)));
  }

  passkeyLoginOptions(email?: string) {
    return this.http.post<{ options: any; challengeId: string }>(
      `${environment.apiUrl}/api/auth/passkey/login/options`, { email }
    );
  }

  loginWithPasskey(challengeId: string, assertion: any) {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/api/auth/passkey/login`, { challengeId, ...assertion })
      .pipe(tap((res) => this.applyToken(res)));
  }

  register(payload: {
    organizationName: string; firstName: string; lastName: string;
    email: string; password: string; country: string; industry?: string;
  }) {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/api/tenant/register`, payload)
      .pipe(tap((res) => this.applyToken(res)));
  }

  refresh() {
    return this.http
      .post<{ token: string }>(`${environment.apiUrl}/api/users/refresh`, {})
      .pipe(tap((res) => {
        this._token.set(res.token);
        this.persist(res.token);
        this.sessionWarning$.next(null);
      }));
  }

  logout() {
    this.stopTicker();
    this.http.post(`${environment.apiUrl}/api/users/logout`, {}).subscribe({ error: () => {} });
    this._token.set(null);
    this.clearStorage();
    this.router.navigate(['/login']);
  }
}
