import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const storageKey = 'rosewind.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly user = signal<string | null>(null);

  constructor() {
    if (this.hasStorage()) this.user.set(globalThis.localStorage.getItem(storageKey));
  }

  login(displayName: string): boolean {
    const normalized = displayName.trim();
    if (!normalized || !this.isBrowser()) return false;
    if (this.hasStorage()) globalThis.localStorage.setItem(storageKey, normalized);
    this.user.set(normalized);
    return true;
  }

  logout(): void {
    if (this.hasStorage()) globalThis.localStorage.removeItem(storageKey);
    this.user.set(null);
  }

  isBrowser(): boolean { return isPlatformBrowser(this.platformId); }

  private hasStorage(): boolean {
    return this.isBrowser() && typeof globalThis.localStorage !== 'undefined';
  }
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.user() ? true : inject(Router).createUrlTree(['/'], { queryParams: { login: 'required' } });
};
