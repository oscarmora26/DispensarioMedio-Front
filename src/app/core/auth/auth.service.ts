/**
 * Sesión de autenticación: único propietario de los tokens y del usuario activo.
 *
 * - Estado reactivo con signals: `user`, `token`, `expiresAt` e
 *   `isAuthenticated` (derivada: token vigente y no expirado).
 * - `login()` emite `POST /v1/auth/login` y guarda el par de tokens;
 *   `restoreSession()` hidrata la sesión una sola vez por arranque aunque
 *   varios guards la pidan a la vez; `ensureValidSession()` combina restauración,
 *   comprobación de vigencia y renovación.
 * - Renovación **reactiva** (decisión humana del 2026-10-27): sin temporizadores.
 *   `refreshSession()` rota el par con `POST /v1/auth/refresh` y es single-flight:
 *   N llamadas concurrentes comparten una sola petición. El interceptor la usa
 *   ante un 401 y `ensureValidSession()` en el arranque o al navegar.
 * - Persistencia (decisión humana del 2026-10-27, ampliada el mismo día): access,
 *   refresh y vencimiento viven en `localStorage`, así que la sesión sobrevive
 *   al cierre del navegador y se comparte entre pestañas. `refreshSession()`
 *   relee el token persistido en cada intento para adoptar el que rotó otra
 *   pestaña. Toda lectura/escritura está aislada en los helpers privados.
 * - `logout()` revoca el refresh en el servidor (`POST /v1/auth/logout`, 204
 *   idempotente) sin esperar la respuesta y limpia la sesión local.
 * - La contraseña nunca se guarda en signals ni en almacenamiento.
 */

import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthUser,
  LoginCredentials,
  MeResponseDto,
  RefreshRequestDto,
  TokenPairResponseDto,
  toAuthUser,
} from './auth.models';

/** Clave de `localStorage` para el access token. No es un secreto: solo el nombre. */
const ACCESS_TOKEN_KEY = 'dm.auth.token';

/** Clave de `localStorage` para el refresh token. */
const REFRESH_TOKEN_KEY = 'dm.auth.refresh';

/** Clave de `localStorage` para el vencimiento local del access token (ms). */
const EXPIRES_AT_KEY = 'dm.auth.expiresAt';

/** Margen de seguridad antes de considerar expirado el access token (30 s). */
const EXPIRY_MARGIN_MS = 30_000;

/** Resultado interno de intentar hidratar la sesión con `/auth/me`. */
type MeOutcome = 'ok' | 'inactive' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(null);
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _expiresAt = signal<number | null>(null);
  private readonly _refreshToken = signal<string | null>(null);

  /** Usuario activo o `null` sin sesión. */
  readonly user: Signal<AuthUser | null> = this._user.asReadonly();

  /** Access token Bearer vigente o `null` sin sesión. */
  readonly token: Signal<string | null> = this._token.asReadonly();

  /**
   * Marca temporal (ms) en que expira el access token, o `null` cuando se
   * desconoce (sesión restaurada sin vencimiento persistido).
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
   * Restauración en curso o ya resuelta. Garantiza una sola cadena de
   * peticiones aunque varios guards la pidan a la vez, y evita reintentar
   * tras un arranque.
   */
  private restorePromise: Promise<AuthUser | null> | null = null;

  /** Renovación en vuelo. Compartida por todas las llamadas concurrentes. */
  private refreshPromise: Promise<TokenPairResponseDto> | null = null;

  /**
   * Inicia sesión (variante `email`). Envía el `email` con `trim` en los
   * extremos y la contraseña sin transformar. Ante 200 guarda el par de
   * tokens, `expiresAt` y el usuario mapeado. Los errores se propagan para que
   * el formulario los traduzca con `mapAuthError()`.
   */
  login(credentials: LoginCredentials): Observable<AuthUser> {
    const body: LoginCredentials = {
      email: credentials.email.trim(),
      password: credentials.password,
    };

    return this.http
      .post<TokenPairResponseDto>(`${environment.apiUrl}/v1/auth/login`, body)
      .pipe(map((response) => this.applyTokenPair(response)));
  }

  /**
   * Cierra la sesión: revoca el refresh token en el servidor (fire-and-forget,
   * 204 idempotente), limpia access, refresh y `expiresAt`, y navega a
   * `/login` con `replaceUrl` y sin `returnUrl`. Un fallo de red no impide el
   * cierre local.
   */
  logout(): void {
    this.revokeRefreshToken();
    this.clearSession();
    void this.router.navigate(['/login'], { replaceUrl: true });
  }

  /** Limpia la sesión sin navegar. La usan el guard y el interceptor. */
  clearSession(): void {
    this.writeItem(ACCESS_TOKEN_KEY, null);
    this.writeItem(REFRESH_TOKEN_KEY, null);
    this.writeItem(EXPIRES_AT_KEY, null);
    this._token.set(null);
    this._refreshToken.set(null);
    this._user.set(null);
    this._expiresAt.set(null);
    this.restorePromise = null;
  }

  /**
   * Restaura la sesión persistida. Con un access token vigente hidrata por
   * `GET /v1/auth/me`; si el access venció, falta o `/me` lo rechaza y hay un
   * refresh persistido, renueva primero y usa el `user` del refresh. Sin
   * refresh y sin `/me` válido limpia la sesión. Idempotente: las llamadas
   * concurrentes comparten una sola cadena de peticiones. Nunca rechaza.
   */
  restoreSession(): Promise<AuthUser | null> {
    if (this.restorePromise) {
      return this.restorePromise;
    }

    const accessToken = this.readAccessToken();
    const refreshToken = this.readRefreshToken();

    if (accessToken === null && refreshToken === null) {
      return Promise.resolve(null);
    }

    this._refreshToken.set(refreshToken);
    const expiresAt = this.readExpiresAt();
    this.restorePromise = this.restoreFrom(accessToken, refreshToken, expiresAt);

    return this.restorePromise;
  }

  /**
   * Garantiza una sesión válida antes de decidir una navegación: restaura si
   * hace falta, comprueba vigencia con la hora actual y, si venció, intenta
   * renovar con el refresh persistido antes de limpiar. Devuelve `true` solo
   * con sesión vigente.
   */
  async ensureValidSession(): Promise<boolean> {
    await this.restoreSession();
    if (this.hasValidSession()) {
      return true;
    }
    if (await this.refreshSession()) {
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

  /** `true` cuando existe un refresh token utilizable (persistido o en memoria). */
  canRefresh(): boolean {
    return (this.readRefreshToken() ?? this._refreshToken()) !== null;
  }

  /**
   * Renueva el par de tokens con `POST /v1/auth/refresh`. Single-flight: las
   * llamadas concurrentes comparten una sola petición. Ante 401/403 limpia la
   * sesión (el refresh ya no sirve); ante un fallo de red o 5xx devuelve
   * `false` sin borrar las credenciales persistidas.
   */
  async refreshSession(): Promise<boolean> {
    let refreshToken = this.readRefreshToken() ?? this._refreshToken();

    for (let attempt = 0; attempt < 2 && refreshToken !== null; attempt += 1) {
      try {
        this.applyTokenPair(await this.rotate(refreshToken));
        return true;
      } catch (error) {
        if (!isSessionEndingError(error)) {
          return false;
        }

        // Si otra pestaña rotó el token mientras este intento estaba en vuelo,
        // el backend rechaza el viejo: se adopta el persistido y se reintenta
        // una vez en lugar de cerrar una sesión que sigue viva.
        const latest = this.readRefreshToken();
        if (latest === null || latest === refreshToken) {
          this.clearSession();
          return false;
        }
        refreshToken = latest;
      }
    }

    this.clearSession();
    return false;
  }

  /** Hidrata con `/me` o informa que hay que renovar o cerrar la sesión. */
  private async restoreFrom(
    accessToken: string | null,
    refreshToken: string | null,
    expiresAt: number | null,
  ): Promise<AuthUser | null> {
    const accessIsFresh = accessToken !== null && (expiresAt === null || Date.now() < expiresAt);

    if (accessIsFresh) {
      const outcome = await this.fetchMe(accessToken, expiresAt);
      if (outcome === 'ok') {
        return this._user();
      }
      if (outcome === 'inactive') {
        this.clearSession();
        return null;
      }
    }

    if (refreshToken !== null && (await this.refreshSession())) {
      return this._user();
    }

    this.clearSession();
    return null;
  }

  /** `GET /v1/auth/me` con Bearer explícito. Nunca rechaza. */
  private async fetchMe(accessToken: string, expiresAt: number | null): Promise<MeOutcome> {
    try {
      const headers = new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
      const me = await firstValueFrom(
        this.http.get<MeResponseDto>(`${environment.apiUrl}/v1/auth/me`, { headers }),
      );
      if (!me.is_active) {
        return 'inactive';
      }
      this._token.set(accessToken);
      this._user.set(toAuthUser(me));
      this._expiresAt.set(expiresAt);
      return 'ok';
    } catch {
      return 'unavailable';
    }
  }

  /** Rotación single-flight: comparte la petición en vuelo. */
  private rotate(refreshToken: string): Promise<TokenPairResponseDto> {
    if (this.refreshPromise === null) {
      const body: RefreshRequestDto = { refresh_token: refreshToken };
      this.refreshPromise = firstValueFrom(
        this.http.post<TokenPairResponseDto>(`${environment.apiUrl}/v1/auth/refresh`, body),
      ).finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  /** Único punto que aplica un par de tokens a signals y almacenamiento. */
  private applyTokenPair(response: TokenPairResponseDto): AuthUser {
    const user = toAuthUser(response.user);
    const expiresAt = Date.now() + response.expires_in * 1000 - EXPIRY_MARGIN_MS;

    this.writeItem(ACCESS_TOKEN_KEY, response.access_token);
    this.writeItem(REFRESH_TOKEN_KEY, response.refresh_token);
    this.writeItem(EXPIRES_AT_KEY, String(expiresAt));
    this._token.set(response.access_token);
    this._refreshToken.set(response.refresh_token);
    this._user.set(user);
    this._expiresAt.set(expiresAt);
    this.restorePromise = Promise.resolve(user);

    return user;
  }

  /** Revoca el refresh token en el servidor sin bloquear el cierre local. */
  private revokeRefreshToken(): void {
    // Se prioriza el persistido: otra pestaña pudo rotarlo.
    const refreshToken = this.readRefreshToken() ?? this._refreshToken();
    if (refreshToken === null) {
      return;
    }
    const body: RefreshRequestDto = { refresh_token: refreshToken };
    this.http
      .post<void>(`${environment.apiUrl}/v1/auth/logout`, body)
      .subscribe({ error: () => undefined });
  }

  /** Único lector de la validez; `isAuthenticated` y `hasValidSession()` lo comparten. */
  private checkValidity(): boolean {
    if (this._token() === null || this._user() === null) {
      return false;
    }
    const expiresAt = this._expiresAt();
    return expiresAt === null || Date.now() < expiresAt;
  }

  private readAccessToken(): string | null {
    return this.readItem(ACCESS_TOKEN_KEY);
  }

  private readRefreshToken(): string | null {
    return this.readItem(REFRESH_TOKEN_KEY);
  }

  private readExpiresAt(): number | null {
    const raw = this.readItem(EXPIRES_AT_KEY);
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  /** Único acceso al almacenamiento: devuelve `null` si no está disponible. */
  private storage(): Storage | null {
    try {
      return localStorage;
    } catch {
      return null;
    }
  }

  private readItem(key: string): string | null {
    try {
      return this.storage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private writeItem(key: string, value: string | null): void {
    try {
      const store = this.storage();
      if (store === null) {
        return;
      }
      if (typeof value === 'string' && value.length > 0) {
        store.setItem(key, value);
      } else {
        store.removeItem(key);
      }
    } catch {
      // Almacenamiento no disponible: la sesión vive solo en memoria.
    }
  }
}

/** Un 401/403 del refresh significa que el refresh token ya no sirve. */
function isSessionEndingError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
}
