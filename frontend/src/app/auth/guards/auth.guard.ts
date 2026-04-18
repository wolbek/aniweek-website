import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  // if returns true then the route is activated.

  if (authService.getToken()) {
    await authService.setUserData();
    return true;
  }

  return router.createUrlTree(['/auth']);
};
