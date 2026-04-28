import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getToken()) {
    await authService.setUserData();
    return true;
  }

  return router.createUrlTree(['/auth']);
};

export const optionalAuthGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);

  if (authService.getToken()) {
    try {
      await authService.setUserData();
    } catch {
      authService.clearToken();
    }
  }

  return true;
};
