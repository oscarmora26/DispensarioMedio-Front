import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;
const REFRESH_URL = `${environment.apiUrl}/v1/auth/refresh`;
const LOGOUT_URL = `${environment.apiUrl}/v1/auth/logout`;
const ME_URL = `${environment.apiUrl}/v1/auth/me`;
const PROTECTED_URL = `${environment.apiUrl}/v1/pacientes`;
const TOKEN_KEY = 'dm.auth.token';
const REFRESH_KEY = 'dm.auth.refresh';

const INVALID_TOKEN_BODY = { detail: 'Token inválido', code: 'invalid_token', errors: [] };

function tokenPair(
  overrides: Record<string, unknown> = {},
  userOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    access_token: 'access-sintetico-1',
    token_type: 'bearer',
    expires_in: 900,
    refresh_token: 'refresh-sintetico-1',
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

function unauthorized(): { status: number; statusText: string } {
  return { status: 401, statusText: 'Unauthorized' };
}

describe('authInterceptor (CA-09/CA-10, S6)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  function seedSession(expiresIn = 900): void {
    auth
      .login({ email: 'medico.demo@example.test', password: 'Secreto-sintetico-1' })
      .subscribe({ error: () => undefined });
    httpMock.expectOne(LOGIN_URL).flush(tokenPair({ expires_in: expiresIn }));
  }

  function rotate(accessToken: string, refreshToken: string): void {
    httpMock
      .expectOne(REFRESH_URL)
      .flush(tokenPair({ access_token: accessToken, refresh_token: refreshToken }));
  }

  it('no adjunta Bearer a /auth/me: la cabecera la pone restoreSession (S6)', () => {
    seedSession();

    http.get(ME_URL).subscribe();
    const req = httpMock.expectOne(ME_URL);

    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('no adjunta cabecera en el propio /auth/login (CA-09)', () => {
    seedSession();

    http.post(LOGIN_URL, { email: 'a@example.test', password: 'b' }).subscribe();
    const req = httpMock.expectOne(LOGIN_URL);

    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(tokenPair());
  });

  it('no adjunta cabecera a /auth/refresh ni /auth/logout (S6)', () => {
    seedSession();

    http
      .post(REFRESH_URL, { refresh_token: 'refresh-sintetico-1' })
      .subscribe({ error: () => undefined });
    http.post(LOGOUT_URL, { refresh_token: 'refresh-sintetico-1' }).subscribe();

    const refreshReq = httpMock.expectOne(REFRESH_URL);
    const logoutReq = httpMock.expectOne(LOGOUT_URL);

    expect(refreshReq.request.headers.has('Authorization')).toBe(false);
    expect(logoutReq.request.headers.has('Authorization')).toBe(false);
    refreshReq.flush(INVALID_TOKEN_BODY, unauthorized());
    logoutReq.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('adjunta Bearer a una petición protegida de apiUrl', () => {
    seedSession();

    http.get(PROTECTED_URL).subscribe();
    const req = httpMock.expectOne(PROTECTED_URL);

    expect(req.request.headers.get('Authorization')).toBe('Bearer access-sintetico-1');
    req.flush({});
  });

  it('no adjunta cabecera a URLs externas (CA-09)', () => {
    seedSession();

    http.get('https://terceros.test/recurso').subscribe();
    const req = httpMock.expectOne('https://terceros.test/recurso');

    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('no adjunta cabecera sin sesión (CA-09)', () => {
    http.get(PROTECTED_URL).subscribe();
    const req = httpMock.expectOne(PROTECTED_URL);

    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('no pisa una Authorization ya presente', () => {
    seedSession();

    http.get(ME_URL, { headers: { Authorization: 'Bearer previo' } }).subscribe();
    const req = httpMock.expectOne(ME_URL);

    expect(req.request.headers.get('Authorization')).toBe('Bearer previo');
    req.flush({});
  });

  it('con token vencido localmente renueva y reintenta con el access nuevo (S6)', async () => {
    seedSession(0);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let responseBody: unknown;

    http.get(PROTECTED_URL).subscribe({ next: (body) => (responseBody = body) });

    const first = httpMock.expectOne(PROTECTED_URL);

    expect(first.request.headers.has('Authorization')).toBe(false);
    first.flush({ detail: 'No autenticado', code: 'not_authenticated' }, unauthorized());

    rotate('access-sintetico-2', 'refresh-sintetico-2');
    await nextTask();

    const retry = httpMock.expectOne(PROTECTED_URL);

    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-sintetico-2');
    retry.flush({ items: [] });

    expect(responseBody).toEqual({ items: [] });
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-sintetico-2');
  });

  it('ante 401 protegido renueva una vez y reintenta con el token nuevo (S6)', async () => {
    seedSession();
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let responseBody: unknown;

    http.get(PROTECTED_URL).subscribe({ next: (body) => (responseBody = body) });

    httpMock
      .expectOne(PROTECTED_URL)
      .flush({ detail: 'No autenticado', code: 'not_authenticated' }, unauthorized());

    const refreshReq = httpMock.expectOne(REFRESH_URL);

    expect(refreshReq.request.body).toEqual({ refresh_token: 'refresh-sintetico-1' });
    refreshReq.flush(
      tokenPair({ access_token: 'access-sintetico-2', refresh_token: 'refresh-sintetico-2' }),
    );

    await nextTask();
    const retry = httpMock.expectOne(PROTECTED_URL);

    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-sintetico-2');
    retry.flush({ items: [] });

    expect(responseBody).toEqual({ items: [] });
    expect(auth.token()).toBe('access-sintetico-2');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('dos 401 concurrentes comparten un solo refresh y ambos se reintentan (S6)', async () => {
    seedSession();
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get(PROTECTED_URL).subscribe({ error: () => undefined });
    http.get(PROTECTED_URL).subscribe({ error: () => undefined });

    const pending = httpMock.match(PROTECTED_URL);

    expect(pending).toHaveLength(2);
    pending[0].flush({ detail: 'No autenticado', code: 'not_authenticated' }, unauthorized());
    pending[1].flush(INVALID_TOKEN_BODY, unauthorized());

    rotate('access-sintetico-2', 'refresh-sintetico-2');
    await nextTask();

    const retries = httpMock.match(PROTECTED_URL);

    expect(retries).toHaveLength(2);
    for (const retry of retries) {
      expect(retry.request.headers.get('Authorization')).toBe('Bearer access-sintetico-2');
      retry.flush({});
    }
  });

  it('si el refresh falla con 401 limpia y navega con reason=expired (S6)', async () => {
    seedSession();
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let status = 0;

    http.get(PROTECTED_URL).subscribe({
      error: (error: HttpErrorResponse) => {
        status = error.status;
      },
    });

    httpMock
      .expectOne(PROTECTED_URL)
      .flush({ detail: 'No autenticado', code: 'not_authenticated' }, unauthorized());
    httpMock.expectOne(REFRESH_URL).flush(INVALID_TOKEN_BODY, unauthorized());
    await nextTask();

    expect(status).toBe(401);
    expect(auth.token()).toBeNull();
    expect(auth.user()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: router.url, reason: 'expired' },
    });
    httpMock.expectNone(PROTECTED_URL);
  });

  it('si el refresh falla por red conserva la sesión y propaga el error (S6)', async () => {
    seedSession();
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let status = 0;

    http.get(PROTECTED_URL).subscribe({
      error: (error: HttpErrorResponse) => {
        status = error.status;
      },
    });

    httpMock
      .expectOne(PROTECTED_URL)
      .flush({ detail: 'No autenticado', code: 'not_authenticated' }, unauthorized());
    httpMock.expectOne(REFRESH_URL).error(new ProgressEvent('error'));
    await nextTask();

    expect(status).toBe(401);
    expect(auth.token()).toBe('access-sintetico-1');
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-sintetico-1');
    expect(navigateSpy).not.toHaveBeenCalled();
    httpMock.expectNone(PROTECTED_URL);
  });

  it('ante 401 sin sesión limpia y navega sin reason (S6)', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let status = 0;

    http.get(PROTECTED_URL).subscribe({
      error: (error: HttpErrorResponse) => {
        status = error.status;
      },
    });
    httpMock
      .expectOne(PROTECTED_URL)
      .flush({ detail: 'No autenticado', code: 'not_authenticated' }, unauthorized());
    await nextTask();

    expect(status).toBe(401);
    httpMock.expectNone(REFRESH_URL);
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: router.url },
    });
  });

  it('ante 401 de /auth/login propaga el error sin limpiar ni redirigir (CA-10)', () => {
    seedSession();
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let status = 0;

    http
      .post(LOGIN_URL, { email: 'nadie@example.test', password: 'Secreto-sintetico-1' })
      .subscribe({
        error: (error: HttpErrorResponse) => {
          status = error.status;
        },
      });
    httpMock
      .expectOne(LOGIN_URL)
      .flush(
        { detail: 'Usuario o contraseña incorrectos', code: 'invalid_credentials', errors: [] },
        unauthorized(),
      );

    expect(status).toBe(401);
    httpMock.expectNone(REFRESH_URL);
    expect(auth.token()).toBe('access-sintetico-1');
    expect(navigateSpy).not.toHaveBeenCalled();
    httpMock.expectNone(LOGIN_URL);
  });

  it('el reintento que vuelve a dar 401 cierra la sesión sin un segundo refresh (S6)', async () => {
    seedSession();
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get(PROTECTED_URL).subscribe({ error: () => undefined });
    httpMock.expectOne(PROTECTED_URL).flush(INVALID_TOKEN_BODY, unauthorized());
    rotate('access-sintetico-2', 'refresh-sintetico-2');
    await nextTask();

    httpMock.expectOne(PROTECTED_URL).flush(INVALID_TOKEN_BODY, unauthorized());

    httpMock.expectNone(REFRESH_URL);
    httpMock.expectNone(PROTECTED_URL);
    expect(auth.token()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: router.url, reason: 'expired' },
    });
  });

  it('un 401 de /auth/me no dispara refresh ni navegación: lo resuelve restoreSession (S6)', () => {
    seedSession();
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let status = 0;

    http.get(ME_URL, { headers: { Authorization: 'Bearer access-sintetico-1' } }).subscribe({
      error: (error: HttpErrorResponse) => {
        status = error.status;
      },
    });
    httpMock
      .expectOne(ME_URL)
      .flush({ detail: 'No autenticado', code: 'not_authenticated', errors: [] }, unauthorized());

    expect(status).toBe(401);
    httpMock.expectNone(REFRESH_URL);
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(auth.token()).toBe('access-sintetico-1');
  });

  it('un 401 de /auth/logout no dispara refresh ni navegación (S6)', () => {
    seedSession();
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.post(LOGOUT_URL, { refresh_token: 'refresh-sintetico-1' }).subscribe({
      error: () => undefined,
    });
    httpMock.expectOne(LOGOUT_URL).flush(INVALID_TOKEN_BODY, unauthorized());

    httpMock.expectNone(REFRESH_URL);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('un error que no es 401 no se reintenta ni navega', () => {
    seedSession();
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get(PROTECTED_URL).subscribe({ error: () => undefined });
    httpMock
      .expectOne(PROTECTED_URL)
      .flush({ detail: 'Error interno' }, { status: 500, statusText: 'Server Error' });

    httpMock.expectNone(PROTECTED_URL);
    httpMock.expectNone(REFRESH_URL);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
