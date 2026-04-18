import { Routes } from '@angular/router';
import { AuthComponent } from './auth.component';
import { AuthCallbackComponent } from '../auth-callback/auth-callback.component';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: AuthComponent,
  },
  {
    path: 'callback',
    component: AuthCallbackComponent,
  },
];
