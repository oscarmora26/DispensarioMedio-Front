import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { AppShell } from './core/layout/app-shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'drug-types',
        loadComponent: () =>
          import('./features/drug-types/drug-type-list/drug-type-list').then((m) => m.DrugTypeList),
      },
      {
        path: 'brands',
        loadComponent: () =>
          import('./features/brands/brand-list/brand-list').then((m) => m.BrandList),
      },
      {
        path: 'locations',
        loadComponent: () =>
          import('./features/locations/location-list/location-list').then((m) => m.LocationList),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/users/user-list/user-list').then((m) => m.UserList),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
