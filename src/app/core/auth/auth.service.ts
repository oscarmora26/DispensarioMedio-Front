/**
 * Sesión de autenticación: único propietario del token y del usuario activo.
 *
 * - Estado reactivo con signals: `user`, `token`, `expiresAt` e
 *   `isAuthenticated` (derivada: token vigente y no expirado).
 * - `login()` emite `POST /v1/auth/login`; `restoreSession()` hidrata la
 *   sesión con `GET /v1/auth/me` una sola vez por arranque aunque varios
 *   guards la pidan a la vez; `ensureValidSession()` combina ambas y limpia
 *   cuando no hay sesión válida.
 * - El token expira localmente en `ahora + expires_in * 1000 - 30 s` de
 *   margen. No hay refresh token ni temporizadores: la expiración se detecta
 *   de forma proactiva en el guard (antes de navegar) y en el interceptor
 *   (antes de adjuntar la cabecera); si expira a mitad de pantalla, la
 *   siguiente petición devuelve 401 y se sigue el mismo camino.
 * - La persistencia vive SOLO en `readToken`/`writeToken`/`clearToken`
 *   (`localStorage`, decisión humana PA-02). Ningún componente, guard ni
 *   interceptor toca el almacenamiento directamente.
 * - La contraseña nunca se guarda en signals ni en almacenamiento.
 */

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthUser,
  LoginCredentials,
  LoginResponseDto,
  MeResponseDto,
  toAuthUser,
} from './auth.models';

/** Clave de `localStorage` para el token. No es un secreto: solo el nombre. */
const STORAGE_KEY = 'dm.auth.token';

/** Margen de seguridad antes de considerar expirado el token (30 s). */
const EXPIRY_MARGIN_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(null);
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _expiresAt = signal<number | null>(null);

  /** Usuario activo o `null` sin sesión. */
  readonly user: Signal<AuthUser | null> = this._user.asReadonly();

  /** Token Bearer vigente o `null` sin sesión. */
  readonly token: Signal<string | null> = this._token.asReadonly();

  /**
   * Marca temporal (ms) en que expira la sesión, o `null` cuando se desconoce
   * (sesión restaurada vía `/me`, que no informa el TTL restante).
   */
  readonly expiresAt: Signal<number | null> = this._expiresAt.asReadonly();

  /**
   * Vista reactiva de la sesión. Se reevalúa cuando cambian las señales de
   * sesión; la detección del instante exacto de expiración es proactiva y
   * vive en `hasValidSession()`/`ensureValidSession()`, usadas por el guard
   * y el interceptor (ver `docs/AUTH.md`).
   */
  readonly isAuthenticated: Signal<boolean> = computed(() => this.checkValidity());

  /**
   * Restauración en curso o ya resuelta. Garantiza una sola petición aunque
   * varios guards la pidan a la vez, y evita reintentar tras un arranque.
   */
  private restorePromise: Promise<AuthUser | null> | null = null;

  /**
   * Inicia sesión (variante `email`). Envía el `email` con `trim` en los
   * extremos y la contraseña sin transformar. Ante 200 guarda token,
   * `expiresAt` y usuario mapeado. Los errores se propagan para que el
   * formulario los traduzca con `mapAuthError()`.
   */
  login(credentials: LoginCredentials): Observable<AuthUser> {
    const body: LoginCredentials = {
      email: credentials.email.trim(),
      password: credentials.password,
    };

    return this.http.post<LoginResponseDto>(`${environment.apiUrl}/v1/auth/login`, body).pipe(
      map((response) => {
        const user = toAuthUser(response.user);
        this.writeToken(response.access_token);
        this._token.set(response.access_token);
        this._user.set(user);
        this._expiresAt.set(Date.now() + response.expires_in * 1000 - EXPIRY_MARGIN_MS);
        this.restorePromise = Promise.resolve(user);
        return user;
      }),
    );
  }

  /**
   * Cierra la sesión local: limpia token, usuario y `expiresAt` y navega a
   * `/login` con `replaceUrl` y sin `returnUrl`. No emite petición de logout:
   * el backend no ofrece revocación y el token sigue válido hasta expirar.
   */
  logout(): void {
    this.clearSession();
    void this.router.navigate(['/login'], { replaceUrl: true });
  }

  /** Limpia la sesión sin navegar. La usan el guard y el interceptor. */
  clearSession(): void {
    this.clearToken();
    this._token.set(null);
    this._user.set(null);
    this._expiresAt.set(null);
    this.restorePromise = null;
  }

  /**
   * Restaura la sesión desde el token persistido con `GET /v1/auth/me`
   * (cabecera `Authorization: Bearer` explícita). Idempotente: las llamadas
   * concurrentes comparten una sola petición y sin token no se emite ninguna.
   * `200` con `is_active: true` hidrata la sesión; `is_active: false`, `401`
   * y `403` —y cualquier otro fallo— la limpian. Nunca rechaza.
   */
  restoreSession(): Promise<AuthUser | null> {
    if (this.restorePromise) {
      return this.restorePromise;
    }

    const persisted = this.readToken();
    if (!persisted) {
      return Promise.resolve(null);
    }

    const headers = new HttpHeaders({ Authorization: `Bearer ${persisted}` });
    this.restorePromise = firstValueFrom(
      this.http.get<MeResponseDto>(`${environment.apiUrl}/v1/auth/me`, { headers }),
    ).then(
      (me) => {
        if (!me.is_active) {
          this.clearSession();
          return null;
        }
        const user = toAuthUser(me);
        this._token.set(persisted);
        this._user.set(user);
        // `/me` no informa el TTL restante: la sesión se asume vigente hasta
        // que el backend responda 401 o el guard detecte expiración local.
        this._expiresAt.set(null);
        return user;
      },
      () => {
        this.clearSession();
        return null;
      },
    );

    return this.restorePromise;
  }

  /**
   * Garantiza una sesión válida antes de decidir una navegación: restaura si
   * hace falta, comprueba vigencia con la hora actual y limpia en caso
   * contrario. Devuelve `true` solo con sesión vigente.
   */
  async ensureValidSession(): Promise<boolean> {
    await this.restoreSession();
    if (this.hasValidSession()) {
      return true;
    }
    this.clearSession();
    return false;
  }

  /**
   * Comprobación sincrónica e imperativa (lee `Date.now()` en cada llamada):
   * hay token y usuario, y la expiración —cuando se conoce— no se alcanzó.
   * La usan el guard y el interceptor antes de decidir.
   */
  hasValidSession(): boolean {
    return this.checkValidity();
  }

  /** Único lector de la validez; `isAuthenticated` y `hasValidSession()` lo comparten. */
  private checkValidity(): boolean {
    if (this._token() === null || this._user() === null) {
      return false;
    }
    const expiresAt = this._expiresAt();
    return expiresAt === null || Date.now() < expiresAt;
  }

  /** Único punto de lectura del almacenamiento. */
  private readToken(): string | null {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /** Único punto de escritura del almacenamiento. */
  private writeToken(token: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, token);
      }
    } catch {
      // Almacenamiento no disponible: la sesión vive solo en memoria.
    }
  }

  /** Único punto de borrado del almacenamiento. */
  private clearToken(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Sin almacenamiento no hay nada que limpiar.
    }
  }
}
