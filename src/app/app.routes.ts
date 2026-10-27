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
        path: 'medications',
        loadComponent: () =>
          import('./features/medications/medication-list/medication-list').then(
            (m) => m.MedicationList,
          ),
      },
      {
        path: 'patients',
        loadComponent: () =>
          import('./features/patients/patient-list/patient-list').then((m) => m.PatientList),
      },
      {
        path: 'doctors',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/doctors/doctor-list/doctor-list').then((m) => m.DoctorList),
      },
      {
        path: 'visits',
        loadComponent: () =>
          import('./features/visits/visit-list/visit-list').then((m) => m.VisitList),
      },
      {
        path: 'visits/:id',
        loadComponent: () =>
          import('./features/visits/visit-detail/visit-detail').then((m) => m.VisitDetail),
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
