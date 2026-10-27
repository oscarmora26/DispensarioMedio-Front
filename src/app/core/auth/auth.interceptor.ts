/**
 * Interceptor de autenticación (funcional).
 *
 * - Adjunta `Authorization: Bearer <token>` solo a peticiones cuya URL empieza
 *   por `environment.apiUrl` y que no son `/auth/login` (ni el propio login
 *   ni terceros reciben el token). No añade cabecera sin sesión válida ni
 *   pisa una `Authorization` ya presente (la restauración vía `/me` la fija
 *   explícitamente). Si el token caducó, limpia la sesión de forma proactiva
 *   sin navegar: el 401 que sigue aplica el camino único de sesión caída.
 * - Ante 401 de una petición protegida limpia la sesión y navega a
 *   `/login?returnUrl=<url actual>`; el 401 de `/auth/login` se propaga
 *   intacto al formulario (son credenciales inválidas, no sesión caída).
 *   La petición fallida nunca se reintenta.
 */

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { sanitizeReturnUrl } from './auth.guard';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApiRequest = req.url.startsWith(environment.apiUrl);
  const isLoginRequest = req.url.includes('/auth/login');

  let outgoing = req;
  if (isApiRequest && !isLoginRequest && !req.headers.has('Authorization')) {
    if (auth.hasValidSession()) {
      const token = auth.token();
      if (token !== null) {
        outgoing = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
      }
    } else if (auth.token() !== null) {
      auth.clearSession();
    }
  }

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiRequest &&
        !isLoginRequest
      ) {
        auth.clearSession();
        const returnUrl = sanitizeReturnUrl(router.url);
        void router.navigate(['/login'], { queryParams: { returnUrl } });
      }
      return throwError(() => error);
    }),
  );
};
