/**
 * Interceptor de autenticación (funcional).
 *
 * - Adjunta `Authorization: Bearer <access>` solo a peticiones cuya URL empieza
 *   por `environment.apiUrl` con sesión válida. No pisa una `Authorization` ya
 *   presente. Los endpoints de autenticación (`/auth/login`, `/auth/refresh`,
 *   `/auth/logout`, `/auth/me`) quedan fuera del adjuntado: el par de tokens
 *   viaja en el body de refresh/logout y `/auth/me` recibe su cabecera
 *   explícita desde `AuthService.restoreSession()`.
 * - Ante 401 de una petición protegida renueva una sola vez con
 *   `AuthService.refreshSession()` (single-flight: las peticiones concurrentes
 *   comparten un único `POST /auth/refresh`) y reintenta **una** vez la petición
 *   original con el access nuevo. Un segundo 401, o la ausencia de refresh
 *   token, cierra la sesión y navega a `/login?returnUrl=<url actual>`, con
 *   `reason=expired` solo cuando existía un refresh token que ya no sirve. No
 *   hay reintentos en bucle ni ante otros estados.
 * - El 401 de `/auth/login` se propaga intacto al formulario (son credenciales
 *   inválidas, no una sesión caída) y el de `/auth/me` lo resuelve
 *   `restoreSession()`.
 */

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { sanitizeReturnUrl } from './auth.guard';
import { AuthService } from './auth.service';

/** Endpoints de autenticación: sin Bearer adjunto y sin manejo de 401 aquí. */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/me'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApiRequest = req.url.startsWith(environment.apiUrl);
  const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => req.url.includes(path));

  /** Cierra la sesión y manda a `/login`; `expired` muestra el aviso de sesión. */
  const endSession = (expired: boolean): void => {
    auth.clearSession();
    const returnUrl = sanitizeReturnUrl(router.url);
    void router.navigate(['/login'], {
      queryParams: expired ? { returnUrl, reason: 'expired' } : { returnUrl },
    });
  };

  let outgoing = req;
  if (
    isApiRequest &&
    !isAuthEndpoint &&
    !req.headers.has('Authorization') &&
    auth.hasValidSession()
  ) {
    const token = auth.token();
    if (token !== null) {
      outgoing = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
  }

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !isApiRequest ||
        isAuthEndpoint
      ) {
        return throwError(() => error);
      }

      const hadRefreshToken = auth.canRefresh();

      return from(auth.refreshSession()).pipe(
        switchMap((renewed) => {
          if (!renewed) {
            // Solo se cierra una sesión realmente inservible: si el refresh
            // token sigue disponible, el fallo fue de red y la sesión se
            // conserva para el próximo intento.
            if (!auth.canRefresh()) {
              endSession(hadRefreshToken);
            }
            return throwError(() => error);
          }

          const token = auth.token();
          const retried =
            token === null ? req : req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

          return next(retried).pipe(
            catchError((retryError: unknown) => {
              if (retryError instanceof HttpErrorResponse && retryError.status === 401) {
                endSession(true);
              }
              return throwError(() => retryError);
            }),
          );
        }),
      );
    }),
  );
};
