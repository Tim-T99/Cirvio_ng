import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AdminLoginResponse {
  token: string;
  admin: { id: string; email: string; name: string; role: string };
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private _token = signal<string | null>(this.readCookie('cirvio_admin_token'));
  readonly token = this._token.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  private _adminEmail = signal<string | null>(this.readCookie('cirvio_admin_email'));

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

  get adminEmail(): string {
    return this._adminEmail() ?? '';
  }

  login(email: string, password: string) {
    return this.http
      .post<AdminLoginResponse>(`${environment.apiUrl}/api/admin/login`, { email, password })
      .pipe(
        tap((res) => {
          this._token.set(res.token);
          this.setCookie('cirvio_admin_token', res.token);
          this._adminEmail.set(res.admin.email);
          this.setCookie('cirvio_admin_email', res.admin.email);
        })
      );
  }

  logout() {
    this.http.post(`${environment.apiUrl}/api/admin/logout`, {}).subscribe({ error: () => {} });
    this._token.set(null);
    this._adminEmail.set(null);
    this.deleteCookie('cirvio_admin_token');
    this.deleteCookie('cirvio_admin_email');
    this.router.navigate(['/admin']);
  }
}
