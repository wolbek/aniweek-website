import { Routes } from '@angular/router';
import { AuthComponent } from './auth.component';
import { AuthCallbackComponent } from '../auth-callback/auth-callback.component';
import { noAuthGuard } from './guards/no-auth.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: AuthComponent,
    canActivate: [noAuthGuard],
  },
  {
    path: 'callback',
    component: AuthCallbackComponent,
  },
];
