import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface User {
  userId: string;
  displayName: string;
  email: string;
  photo: string;
  role: 'admin' | 'user';
}

const TOKEN_KEY_NAME = 'auth_token';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  private http = inject(HttpClient);

  userDataSignal = signal<User | null>(null); // Will use to set user details here which you can use throughout the application.

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY_NAME, token);
  }
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY_NAME);
  }
  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY_NAME);
  }
  loginWithGoogle() {
    window.location.href = '/api/auth/google';
  }
  logout() {
    this.clearToken();
    this.router.navigate(['/auth']);
  }

  async setUserData(): Promise<void> {
    const token = this.getToken();
    if (!token) {
      this.userDataSignal.set(null);
      return;
    }
    const user = await firstValueFrom(this.http.get<User>('/api/auth/user'));
    this.userDataSignal.set(user);
  }
}
