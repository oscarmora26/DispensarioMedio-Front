import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;
const REFRESH_URL = `${environment.apiUrl}/v1/auth/refresh`;
const LOGOUT_URL = `${environment.apiUrl}/v1/auth/logout`;
const ME_URL = `${environment.apiUrl}/v1/auth/me`;
const TOKEN_KEY = 'dm.auth.token';
const REFRESH_KEY = 'dm.auth.refresh';
const EXPIRES_KEY = 'dm.auth.expiresAt';
const EXPIRY_MARGIN_MS = 30_000;
const ACCESS_TOKEN = 'access-sintetico-1';
const REFRESH_TOKEN = 'refresh-sintetico-1';

const INVALID_TOKEN_BODY = { detail: 'Token inválido', code: 'invalid_token', errors: [] };

function tokenPair(
  overrides: Record<string, unknown> = {},
  userOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    access_token: ACCESS_TOKEN,
    token_type: 'bearer',
    expires_in: 900,
    refresh_token: REFRESH_TOKEN,
    refresh_expires_in: 2_592_000,
    user: {
      id: 7,
      username: 'medico.demo',
      email: 'medico.demo@example.test',
      role: 'MEDICO',
      doctor_id: 12,
      ...userOverrides,
    },
    ...overrides,
  };
}

/** Deja correr las continuaciones pendientes antes de inspeccionar peticiones. */
function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function meResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 7,
    username: 'medico.demo',
    email: 'medico.demo@example.test',
    role: 'MEDICO',
    doctor_id: 12,
    is_active: true,
    ...overrides,
  };
}

describe('AuthService', () => {
  let auth: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  function login(overrides: Record<string, unknown> = {}): void {
    auth
      .login({ email: 'medico.demo@example.test', password: 'Secreto-sintetico-1' })
      .subscribe({ error: () => undefined });
    httpMock.expectOne(LOGIN_URL).flush(tokenPair(overrides));
  }

  describe('login', () => {
    it('emite POST exacto con el email recortado y la contraseña intacta (F-005 CA-01)', () => {
      let completed = false;
      auth
        .login({ email: '  medico.demo@example.test  ', password: '  Secreto-1  ' })
        .subscribe(() => {
          completed = true;
        });

      const req = httpMock.expectOne(LOGIN_URL);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 'medico.demo@example.test',
        password: '  Secreto-1  ',
      });

      req.flush(tokenPair());

      expect(completed).toBe(true);
    });

    it('guarda access, refresh y vencimiento en localStorage (S2, S3)', () => {
      login();

      expect(auth.token()).toBe(ACCESS_TOKEN);
      expect(auth.user()).toEqual({
        id: 7,
        username: 'medico.demo',
        email: 'medico.demo@example.test',
        role: 'MEDICO',
        doctorId: 12,
      });
      expect(auth.isAuthenticated()).toBe(true);
      expect(localStorage.getItem(TOKEN_KEY)).toBe(ACCESS_TOKEN);
      expect(localStorage.getItem(REFRESH_KEY)).toBe(REFRESH_TOKEN);
      expect(localStorage.getItem(EXPIRES_KEY)).toBe(String(auth.expiresAt()));
      expect(sessionStorage.getItem(REFRESH_KEY)).toBeNull();
    });

    it('mapea doctor_id null a doctorId null', () => {
      auth.login({ email: 'admin.demo@example.test', password: 'Secreto-sintetico-1' }).subscribe();
      httpMock
        .expectOne(LOGIN_URL)
        .flush(tokenPair({}, { username: 'admin.demo', role: 'ADMIN', doctor_id: null }));

      expect(auth.user()).toMatchObject({ username: 'admin.demo', role: 'ADMIN', doctorId: null });
    });

    it('conserva un rol no previsto tal cual', () => {
      auth.login({ email: 'otro.demo@example.test', password: 'Secreto-sintetico-1' }).subscribe();
      httpMock
        .expectOne(LOGIN_URL)
        .flush(tokenPair({}, { username: 'otro.demo', role: 'ENFERMERIA' }));

      expect(auth.user()).toMatchObject({ role: 'ENFERMERIA' });
    });

    it('calcula expiresAt con 30 s de margen (CA-08)', () => {
      const before = Date.now();
      login({ expires_in: 900 });
      const after = Date.now();

      const expiresAt = auth.expiresAt();

      expect(expiresAt).not.toBeNull();
      expect(expiresAt ?? 0).toBeGreaterThanOrEqual(before + 900 * 1000 - EXPIRY_MARGIN_MS);
      expect(expiresAt ?? 0).toBeLessThanOrEqual(after + 900 * 1000 - EXPIRY_MARGIN_MS);
    });

    it('propaga el 401 al suscriptor sin dejar sesión (CA-13)', () => {
      let status = 0;
      auth.login({ email: 'nadie@example.test', password: 'Secreto-sintetico-1' }).subscribe({
        error: (error: { status: number }) => {
          status = error.status;
        },
      });

      httpMock
        .expectOne(LOGIN_URL)
        .flush(
          { detail: 'Usuario o contraseña incorrectos', code: 'invalid_credentials', errors: [] },
          { status: 401, statusText: 'Unauthorized' },
        );

      expect(status).toBe(401);
      expect(auth.token()).toBeNull();
      expect(auth.user()).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    });

    it('nunca persiste la contraseña (CA-14)', () => {
      const password = 'Secreto-sintetico-1';
      auth.login({ email: 'medico.demo@example.test', password }).subscribe();
      httpMock.expectOne(LOGIN_URL).flush(tokenPair());

      const stored = [
        ...Object.keys(localStorage).map((key) => localStorage.getItem(key) ?? ''),
        ...Object.keys(sessionStorage).map((key) => sessionStorage.getItem(key) ?? ''),
      ].join(' ');

      expect(stored).not.toContain(password);
      expect(auth.user()).not.toHaveProperty('password');
    });
  });

  describe('logout (S7)', () => {
    it('revoca el refresh en el servidor, limpia la sesión y navega a /login con replaceUrl', () => {
      login();
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      auth.logout();

      const req = httpMock.expectOne(LOGOUT_URL);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refresh_token: REFRESH_TOKEN });
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(auth.token()).toBeNull();
      expect(auth.user()).toBeNull();
      expect(auth.expiresAt()).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
      expect(localStorage.getItem(EXPIRES_KEY)).toBeNull();
      expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
    });

    it('cierra la sesión local aunque la revocación falle por red', () => {
      login();
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      auth.logout();

      httpMock.expectOne(LOGOUT_URL).error(new ProgressEvent('error'));

      expect(auth.token()).toBeNull();
      expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
      expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
    });

    it('sin refresh persistido no emite petición y navega igual', () => {
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      auth.logout();

      httpMock.expectNone(LOGOUT_URL);
      expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
    });
  });

  describe('refreshSession (S4)', () => {
    it('es single-flight: dos llamadas concurrentes comparten un solo POST y aplican el par rotado', async () => {
      login();

      const first = auth.refreshSession();
      const second = auth.refreshSession();

      const req = httpMock.expectOne(REFRESH_URL);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refresh_token: REFRESH_TOKEN });

      req.flush(
        tokenPair(
          { access_token: 'access-sintetico-2', refresh_token: 'refresh-sintetico-2' },
          { username: 'medico.rotado', role: 'ADMIN', doctor_id: null },
        ),
      );

      await expect(first).resolves.toBe(true);
      await expect(second).resolves.toBe(true);
      httpMock.expectNone(REFRESH_URL);

      expect(auth.token()).toBe('access-sintetico-2');
      expect(auth.user()).toMatchObject({
        username: 'medico.rotado',
        role: 'ADMIN',
        doctorId: null,
      });
      expect(localStorage.getItem(TOKEN_KEY)).toBe('access-sintetico-2');
      expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-sintetico-2');
      expect(localStorage.getItem(EXPIRES_KEY)).toBe(String(auth.expiresAt()));
    });

    it('adopta el token rotado por otra pestaña en vez de cerrar la sesión (S2, S4)', async () => {
      login();

      const pending = auth.refreshSession();
      const first = httpMock.expectOne(REFRESH_URL);

      localStorage.setItem(REFRESH_KEY, 'refresh-otra-pestana');
      first.flush(INVALID_TOKEN_BODY, { status: 401, statusText: 'Unauthorized' });
      await nextTask();

      const second = httpMock.expectOne(REFRESH_URL);

      expect(second.request.body).toEqual({ refresh_token: 'refresh-otra-pestana' });
      second.flush(
        tokenPair({ access_token: 'access-otra-pestana', refresh_token: 'refresh-adoptado' }),
      );

      await expect(pending).resolves.toBe(true);
      expect(auth.token()).toBe('access-otra-pestana');
      expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-adoptado');
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('ante 401 limpia la sesión y devuelve false', async () => {
      login();

      const pending = auth.refreshSession();
      httpMock
        .expectOne(REFRESH_URL)
        .flush(INVALID_TOKEN_BODY, { status: 401, statusText: 'Unauthorized' });

      await expect(pending).resolves.toBe(false);
      expect(auth.token()).toBeNull();
      expect(auth.user()).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    });

    it('ante un fallo de red devuelve false sin borrar las credenciales persistidas', async () => {
      login();

      const pending = auth.refreshSession();
      httpMock.expectOne(REFRESH_URL).error(new ProgressEvent('error'));

      await expect(pending).resolves.toBe(false);
      expect(auth.token()).toBe(ACCESS_TOKEN);
      expect(localStorage.getItem(REFRESH_KEY)).toBe(REFRESH_TOKEN);
    });

    it('sin refresh persistido devuelve false sin emitir petición', async () => {
      await expect(auth.refreshSession()).resolves.toBe(false);

      httpMock.expectNone(REFRESH_URL);
    });
  });

  describe('restoreSession (S5)', () => {
    it('sin tokens persistidos no emite ninguna petición (CA-07)', async () => {
      await expect(auth.restoreSession()).resolves.toBeNull();

      httpMock.expectNone(ME_URL);
      httpMock.expectNone(REFRESH_URL);
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('hidrata con GET /me y Bearer cuando el access sigue vigente (CA-07)', async () => {
      const expiresAt = Date.now() + 10 * 60 * 1000;
      localStorage.setItem(TOKEN_KEY, 'token-persistido');
      localStorage.setItem(EXPIRES_KEY, String(expiresAt));

      const pending = auth.restoreSession();
      const req = httpMock.expectOne(ME_URL);

      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-persistido');

      req.flush(meResponse());

      await expect(pending).resolves.toMatchObject({ username: 'medico.demo', doctorId: 12 });
      expect(auth.token()).toBe('token-persistido');
      expect(auth.expiresAt()).toBe(expiresAt);
      expect(auth.isAuthenticated()).toBe(true);
      httpMock.expectNone(REFRESH_URL);
    });

    it('renueva primero cuando el access persistido ya venció (S5)', async () => {
      localStorage.setItem(TOKEN_KEY, 'token-vencido');
      localStorage.setItem(REFRESH_KEY, 'refresh-persistido');
      localStorage.setItem(EXPIRES_KEY, String(Date.now() - 1000));

      const pending = auth.restoreSession();
      httpMock.expectNone(ME_URL);

      httpMock
        .expectOne(REFRESH_URL)
        .flush(tokenPair({ access_token: 'access-renovado', refresh_token: 'refresh-renovado' }));

      await expect(pending).resolves.toMatchObject({ username: 'medico.demo' });
      expect(auth.token()).toBe('access-renovado');
      expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-renovado');
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('renueva cuando /me rechaza el access aunque no haya vencimiento local (S5)', async () => {
      localStorage.setItem(TOKEN_KEY, 'token-rechazado');
      localStorage.setItem(REFRESH_KEY, 'refresh-persistido');

      const pending = auth.restoreSession();
      httpMock
        .expectOne(ME_URL)
        .flush(
          { detail: 'No autenticado', code: 'not_authenticated', errors: [] },
          { status: 401, statusText: 'Unauthorized' },
        );

      await nextTask();
      const refreshReq = httpMock.expectOne(REFRESH_URL);

      expect(refreshReq.request.body).toEqual({ refresh_token: 'refresh-persistido' });
      refreshReq.flush(
        tokenPair({ access_token: 'access-renovado', refresh_token: 'refresh-renovado' }),
      );

      await expect(pending).resolves.toMatchObject({ username: 'medico.demo' });
      expect(auth.token()).toBe('access-renovado');
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('limpia la sesión ante 200 con is_active false sin intentar refrescar (CA-07)', async () => {
      localStorage.setItem(TOKEN_KEY, 'token-persistido');
      localStorage.setItem(REFRESH_KEY, 'refresh-persistido');

      const pending = auth.restoreSession();
      httpMock.expectOne(ME_URL).flush(meResponse({ is_active: false }));

      await expect(pending).resolves.toBeNull();
      httpMock.expectNone(REFRESH_URL);
      expect(auth.token()).toBeNull();
      expect(auth.user()).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
    });

    it.each([401, 403])(
      'limpia la sesión ante %i sin refresh persistido (CA-07)',
      async (status) => {
        localStorage.setItem(TOKEN_KEY, 'token-persistido');

        const pending = auth.restoreSession();
        httpMock
          .expectOne(ME_URL)
          .flush({ detail: 'x', code: 'y', errors: [] }, { status, statusText: 'Error' });

        await expect(pending).resolves.toBeNull();
        httpMock.expectNone(REFRESH_URL);
        expect(auth.token()).toBeNull();
        expect(auth.user()).toBeNull();
        expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
        expect(auth.isAuthenticated()).toBe(false);
      },
    );

    it('es idempotente: llamadas concurrentes producen una sola petición (CA-07)', async () => {
      localStorage.setItem(TOKEN_KEY, 'token-persistido');

      const first = auth.restoreSession();
      const second = auth.restoreSession();

      httpMock.expectOne(ME_URL).flush(meResponse());
      httpMock.expectNone(ME_URL);

      await expect(first).resolves.toMatchObject({ username: 'medico.demo' });
      await expect(second).resolves.toMatchObject({ username: 'medico.demo' });
    });

    it('tras login no emite /me aunque el token exista (caché de arranque)', async () => {
      login();

      await expect(auth.restoreSession()).resolves.toMatchObject({ username: 'medico.demo' });
      httpMock.expectNone(ME_URL);
    });
  });

  describe('expiración y renovación (S4, S5)', () => {
    it('isAuthenticated es false cuando expiresAt ya pasó (CA-08)', () => {
      login({ expires_in: 0 });

      expect(auth.expiresAt()).not.toBeNull();
      expect(auth.hasValidSession()).toBe(false);
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('ensureValidSession renueva y devuelve true con sesión vencida y refresh vigente (S5)', async () => {
      login({ expires_in: 0 });

      const pending = auth.ensureValidSession();
      await nextTask();
      httpMock
        .expectOne(REFRESH_URL)
        .flush(tokenPair({ access_token: 'access-renovado', refresh_token: 'refresh-renovado' }));

      await expect(pending).resolves.toBe(true);
      expect(auth.token()).toBe('access-renovado');
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('ensureValidSession limpia y devuelve false con sesión vencida sin refresh (CA-08)', async () => {
      localStorage.setItem(TOKEN_KEY, 'token-vencido');
      localStorage.setItem(EXPIRES_KEY, String(Date.now() - 1000));

      await expect(auth.ensureValidSession()).resolves.toBe(false);
      httpMock.expectNone(REFRESH_URL);
      expect(auth.token()).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('ensureValidSession devuelve true con sesión vigente sin emitir peticiones', async () => {
      login();

      await expect(auth.ensureValidSession()).resolves.toBe(true);
      httpMock.expectNone(ME_URL);
      httpMock.expectNone(REFRESH_URL);
    });
  });
});
