import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { environment } from '../../../environments/environment';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';

const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;

function loginResponse(role: string, username: string): Record<string, unknown> {
  return {
    access_token: 'token-sintetico-de-prueba',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: 7,
      username,
      email: `${username}@example.test`,
      role,
      doctor_id: null,
    },
  };
}

function routeSnapshot(): ActivatedRouteSnapshot {
  return { queryParamMap: convertToParamMap({}) } as unknown as ActivatedRouteSnapshot;
}

function stateSnapshot(url: string): RouterStateSnapshot {
  return { url } as unknown as RouterStateSnapshot;
}

describe('adminGuard (F-006 CA-01/CA-09)', () => {
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

  function login(role: string, username: string): void {
    auth.login({ email: `${username}@example.test`, password: 'Secreto-sintetico-1' }).subscribe();
    httpMock.expectOne(LOGIN_URL).flush(loginResponse(role, username));
  }

  it('sin sesión redirige a /login?returnUrl=/users (CA-01)', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      adminGuard(routeSnapshot(), stateSnapshot('/users')),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/login?returnUrl=%2Fusers');
    expect(result).toEqual(
      router.createUrlTree(['/login'], { queryParams: { returnUrl: '/users' } }),
    );
    httpMock.expectNone(LOGIN_URL);
  });

  it('con sesión expirada o inválida también redirige al login (CA-01)', async () => {
    login('ADMIN', 'admin.demo');
    vi.spyOn(auth, 'ensureValidSession').mockResolvedValue(false);

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard(routeSnapshot(), stateSnapshot('/users')),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/login?returnUrl=%2Fusers');
  });

  it('con sesión MEDICO redirige a / sin renderizar la ruta (CA-01/CA-09)', async () => {
    login('MEDICO', 'medico.demo');

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard(routeSnapshot(), stateSnapshot('/users')),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(result).toEqual(router.parseUrl('/'));
  });

  it('con rol no previsto redirige a / (fallback sin permisos finos, CA-09)', async () => {
    login('ENFERMERIA', 'otro.demo');

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard(routeSnapshot(), stateSnapshot('/users')),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(result).toEqual(router.parseUrl('/'));
  });

  it('con sesión ADMIN devuelve true (CA-01)', async () => {
    login('ADMIN', 'admin.demo');

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard(routeSnapshot(), stateSnapshot('/users')),
    );

    expect(result).toBe(true);
  });
});
