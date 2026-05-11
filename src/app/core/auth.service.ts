import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private _token = signal<string | null>(this.readCookie('cirvio_token'));
  readonly token = this._token.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  private readCookie(name: string): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  private setCookie(name: string, value: string) {
    if (isPlatformBrowser(this.platformId)) {
      document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
    }
  }

  private deleteCookie(name: string) {
    if (isPlatformBrowser(this.platformId)) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/api/auth/login`, { email, password })
      .pipe(
        tap((res) => {
          this._token.set(res.token);
          this.setCookie('cirvio_token', res.token);
        })
      );
  }

  register(payload: {
    organizationName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    country: string;
  }) {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/api/auth/register`, payload).pipe(
      tap((res) => {
        this._token.set(res.token);
        this.setCookie('cirvio_token', res.token);
      })
    );
  }

  logout() {
    this.http.post(`${environment.apiUrl}/api/auth/logout`, {}).subscribe({ error: () => {} });
    this._token.set(null);
    this.deleteCookie('cirvio_token');
    this.router.navigate(['/login']);
  }
}
