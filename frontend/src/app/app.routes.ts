import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { authGuard } from './auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'video',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./video/video-list/video-list.component').then(
            (m) => m.VideoListComponent,
          ),
      },
      {
        path: 'upload',
        loadComponent: () =>
          import('./video/video-upload/video-upload.component').then(
            (m) => m.VideoUploadComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./video/video-player/video-player.component').then(
            (m) => m.VideoPlayerComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'auth',
  },
];
