import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LoginResponse {
  token: string;
  user: { id: string; email: string; username: string; role: string };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private _token = signal<string | null>(this.loadToken());
  readonly token = this._token.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  private loadToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token');
    }
    return null;
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/api/users/login`, { email, password })
      .pipe(
        tap((res) => {
          this._token.set(res.token);
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('token', res.token);
          }
        })
      );
  }

  signup(email: string, username: string, password: string) {
    return this.http.post(`${environment.apiUrl}/api/users/signup`, {
      email,
      username,
      password,
    });
  }

  logout() {
    this._token.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('token');
    }
    this.router.navigate(['/']);
  }
}
