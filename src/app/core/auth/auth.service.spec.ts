import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;
const ME_URL = `${environment.apiUrl}/v1/auth/me`;
const TOKEN_KEY = 'dm.auth.token';
const EXPIRY_MARGIN_MS = 30_000;

function loginResponse(
  overrides: Record<string, unknown> = {},
  userOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    access_token: 'token-sintetico-de-prueba',
    token_type: 'bearer',
    expires_in: 3600,
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
  });

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

      req.flush(loginResponse());

      expect(completed).toBe(true);
    });

    it('guarda token, usuario mapeado e isAuthenticated en true (F-005 CA-01)', () => {
      auth
        .login({ email: 'medico.demo@example.test', password: 'Secreto-sintetico-1' })
        .subscribe();
      httpMock.expectOne(LOGIN_URL).flush(loginResponse());

      expect(auth.token()).toBe('token-sintetico-de-prueba');
      expect(auth.user()).toEqual({
        id: 7,
        username: 'medico.demo',
        email: 'medico.demo@example.test',
        role: 'MEDICO',
        doctorId: 12,
      });
      expect(auth.isAuthenticated()).toBe(true);
      expect(localStorage.getItem(TOKEN_KEY)).toBe('token-sintetico-de-prueba');
    });

    it('mapea doctor_id null a doctorId null', () => {
      auth.login({ email: 'admin.demo@example.test', password: 'Secreto-sintetico-1' }).subscribe();
      httpMock
        .expectOne(LOGIN_URL)
        .flush(loginResponse({}, { username: 'admin.demo', role: 'ADMIN', doctor_id: null }));

      expect(auth.user()).toMatchObject({ username: 'admin.demo', role: 'ADMIN', doctorId: null });
    });

    it('conserva un rol no previsto tal cual', () => {
      auth.login({ email: 'otro.demo@example.test', password: 'Secreto-sintetico-1' }).subscribe();
      httpMock
        .expectOne(LOGIN_URL)
        .flush(loginResponse({}, { username: 'otro.demo', role: 'ENFERMERIA' }));

      expect(auth.user()).toMatchObject({ role: 'ENFERMERIA' });
    });

    it('calcula expiresAt con 30 s de margen (CA-08)', () => {
      const before = Date.now();
      auth
        .login({ email: 'medico.demo@example.test', password: 'Secreto-sintetico-1' })
        .subscribe();
      httpMock.expectOne(LOGIN_URL).flush(loginResponse({ expires_in: 3600 }));
      const after = Date.now();

      const expiresAt = auth.expiresAt();

      expect(expiresAt).not.toBeNull();
      expect(expiresAt ?? 0).toBeGreaterThanOrEqual(before + 3600 * 1000 - EXPIRY_MARGIN_MS);
      expect(expiresAt ?? 0).toBeLessThanOrEqual(after + 3600 * 1000 - EXPIRY_MARGIN_MS);
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
    });

    it('nunca persiste la contraseña (CA-14)', () => {
      const password = 'Secreto-sintetico-1';
      auth.login({ email: 'medico.demo@example.test', password }).subscribe();
      httpMock.expectOne(LOGIN_URL).flush(loginResponse());

      const stored = Object.keys(localStorage)
        .map((key) => localStorage.getItem(key) ?? '')
        .join(' ');

      expect(stored).not.toContain(password);
      expect(auth.user()).not.toHaveProperty('password');
    });
  });

  describe('logout', () => {
    it('limpia token, usuario y expiresAt y navega a /login con replaceUrl sin petición (CA-11)', () => {
      auth
        .login({ email: 'medico.demo@example.test', password: 'Secreto-sintetico-1' })
        .subscribe();
      httpMock.expectOne(LOGIN_URL).flush(loginResponse());
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      auth.logout();

      expect(auth.token()).toBeNull();
      expect(auth.user()).toBeNull();
      expect(auth.expiresAt()).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
      httpMock.expectNone(LOGIN_URL);
    });
  });

  describe('restoreSession', () => {
    it('sin token persistido no emite ninguna petición (CA-07)', async () => {
      await expect(auth.restoreSession()).resolves.toBeNull();

      httpMock.expectNone(ME_URL);
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('hidrata la sesión con GET /me y Bearer ante is_active true (CA-07)', async () => {
      localStorage.setItem(TOKEN_KEY, 'token-persistido');

      const pending = auth.restoreSession();
      const req = httpMock.expectOne(ME_URL);

      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-persistido');

      req.flush(meResponse());

      await expect(pending).resolves.toMatchObject({ username: 'medico.demo', doctorId: 12 });
      expect(auth.token()).toBe('token-persistido');
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('limpia la sesión ante 200 con is_active false (CA-07)', async () => {
      localStorage.setItem(TOKEN_KEY, 'token-persistido');

      const pending = auth.restoreSession();
      httpMock.expectOne(ME_URL).flush(meResponse({ is_active: false }));

      await expect(pending).resolves.toBeNull();
      expect(auth.token()).toBeNull();
      expect(auth.user()).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
    });

    it.each([401, 403])('limpia la sesión ante %i (CA-07)', async (status) => {
      localStorage.setItem(TOKEN_KEY, 'token-persistido');

      const pending = auth.restoreSession();
      httpMock
        .expectOne(ME_URL)
        .flush({ detail: 'x', code: 'y', errors: [] }, { status, statusText: 'Error' });

      await expect(pending).resolves.toBeNull();
      expect(auth.token()).toBeNull();
      expect(auth.user()).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
    });

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
      auth
        .login({ email: 'medico.demo@example.test', password: 'Secreto-sintetico-1' })
        .subscribe();
      httpMock.expectOne(LOGIN_URL).flush(loginResponse());

      await expect(auth.restoreSession()).resolves.toMatchObject({ username: 'medico.demo' });
      httpMock.expectNone(ME_URL);
    });
  });

  describe('expiración', () => {
    it('isAuthenticated es false cuando expiresAt ya pasó (CA-08)', () => {
      auth
        .login({ email: 'medico.demo@example.test', password: 'Secreto-sintetico-1' })
        .subscribe();
      httpMock.expectOne(LOGIN_URL).flush(loginResponse({ expires_in: 0 }));

      expect(auth.expiresAt()).not.toBeNull();
      expect(auth.hasValidSession()).toBe(false);
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('ensureValidSession limpia y devuelve false con sesión expirada (CA-08)', async () => {
      auth
        .login({ email: 'medico.demo@example.test', password: 'Secreto-sintetico-1' })
        .subscribe();
      httpMock.expectOne(LOGIN_URL).flush(loginResponse({ expires_in: 0 }));

      await expect(auth.ensureValidSession()).resolves.toBe(false);
      expect(auth.token()).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('ensureValidSession devuelve true con sesión vigente', async () => {
      auth
        .login({ email: 'medico.demo@example.test', password: 'Secreto-sintetico-1' })
        .subscribe();
      httpMock.expectOne(LOGIN_URL).flush(loginResponse({ expires_in: 3600 }));

      await expect(auth.ensureValidSession()).resolves.toBe(true);
      httpMock.expectNone(ME_URL);
    });
  });
});
