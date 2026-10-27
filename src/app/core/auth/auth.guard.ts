/**
 * Guards de autenticación y saneo del `returnUrl`.
 *
 * - `authGuard`: protege la ruta padre del shell. Espera `restoreSession()`
 *   antes de decidir; sin sesión devuelve un `UrlTree` a
 *   `/login?returnUrl=<url>`, con `&reason=expired` cuando había token (la
 *   sesión terminó) en lugar de una primera visita anónima.
 * - `guestGuard`: protege `/login`. Con sesión válida redirige al `returnUrl`
 *   saneado o a `/`; sin sesión permite renderizar `dm-login`.
 * - `sanitizeReturnUrl()`: única función que acepta un `returnUrl`. Solo
 *   valen rutas internas que empiezan por `/` y no por `//` ni `/\`; URLs
 *   absolutas, `javascript:`, vacíos y ausentes se sustituyen por `/`. La
 *   reutilizan el guard invitado, el interceptor y el submit del login.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Acepta solo rutas internas; cualquier otro valor se sustituye por `/`. */
export function sanitizeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/')) {
    return '/';
  }
  if (value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }
  return value;
}

/** Ruta autenticada: sin sesión válida manda a `/login` con `returnUrl`. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const hadToken = auth.token() !== null;
  if (await auth.ensureValidSession()) {
    return true;
  }

  const queryParams: Record<string, string> = { returnUrl: state.url };
  if (hadToken) {
    queryParams['reason'] = 'expired';
  }
  return router.createUrlTree(['/login'], { queryParams });
};

/** `/login`: con sesión válida redirige al `returnUrl` saneado o a `/`. */
export const guestGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!(await auth.ensureValidSession())) {
    return true;
  }

  return router.parseUrl(sanitizeReturnUrl(route.queryParamMap.get('returnUrl')));
};
