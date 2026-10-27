/**
 * Guard de administración (F-006): protege `/users` por sesión + rol.
 *
 * - Espera `restoreSession()`/`ensureValidSession()` como `authGuard`.
 * - Sin sesión: delega en el mismo destino que `authGuard`
 *   (`/login?returnUrl=/users`).
 * - Con sesión y rol distinto de `ADMIN`: redirige a `/` (PQ-02, opción (a)
 *   aprobada: sin páginas propias de 403/404 en esta entrega).
 *
 * No toca `authGuard` ni `guestGuard`; vive en su propio módulo para no
 * modificar los guards existentes.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** `/users`: solo sesión válida con `role === 'ADMIN'`. */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!(await auth.ensureValidSession())) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (auth.user()?.role !== 'ADMIN') {
    return router.parseUrl('/');
  }

  return true;
};
