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
const ME_URL = `${environment.apiUrl}/v1/auth/me`;
const PROTECTED_URL = `${environment.apiUrl}/v1/pacientes`;
const TOKEN_KEY = 'dm.auth.token';

function loginResponse(expiresIn = 3600): Record<string, unknown> {
  return {
    access_token: 'token-sintetico-de-prueba',
    token_type: 'bearer',
    expires_in: expiresIn,
    user: {
      id: 7,
      username: 'medico.demo',
      email: 'medico.demo@example.test',
      role: 'MEDICO',
      doctor_id: 12,
    },
  };
}

describe('authInterceptor (CA-09/CA-10)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
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
  });

  function seedSession(expiresIn = 3600): void {
    auth.login({ email: 'medico.demo@example.test', password: 'Secreto-sintetico-1' }).subscribe();
    httpMock.expectOne(LOGIN_URL).flush(loginResponse(expiresIn));
  }

  it('adjunta Bearer solo a apiUrl sin /auth/login con sesión válida (CA-09)', () => {
    seedSession();

    http.get(ME_URL).subscribe();
    const req = httpMock.expectOne(ME_URL);

    expect(req.request.headers.get('Authorization')).toBe('Bearer token-sintetico-de-prueba');
    req.flush({});
  });

  it('no adjunta cabecera en el propio /auth/login (CA-09)', () => {
    seedSession();

    http.post(LOGIN_URL, { email: 'a@example.test', password: 'b' }).subscribe();
    const req = httpMock.expectOne(LOGIN_URL);

    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(loginResponse());
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

  it('con token expirado limpia la sesión sin navegar (CA-08)', () => {
    seedSession(0);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get(PROTECTED_URL).subscribe();
    const req = httpMock.expectOne(PROTECTED_URL);

    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(auth.token()).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
    req.flush({});
  });

  it('ante 401 protegido limpia y navega a /login?returnUrl=<actual> (CA-10)', () => {
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
      .flush(
        { detail: 'No autenticado', code: 'not_authenticated', errors: [] },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(status).toBe(401);
    expect(auth.token()).toBeNull();
    expect(auth.user()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: router.url },
    });
    httpMock.expectNone(PROTECTED_URL);
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
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(status).toBe(401);
    expect(auth.token()).toBe('token-sintetico-de-prueba');
    expect(navigateSpy).not.toHaveBeenCalled();
    httpMock.expectNone(LOGIN_URL);
  });

  it('la petición fallida no se reintenta (CA-10)', () => {
    seedSession();
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get(PROTECTED_URL).subscribe({ error: () => undefined });
    const req = httpMock.expectOne(PROTECTED_URL);
    req.flush({ detail: 'x', code: 'y', errors: [] }, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(PROTECTED_URL);
  });
});
