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
import { authGuard, guestGuard, sanitizeReturnUrl } from './auth.guard';
import { AuthService } from './auth.service';

const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;
const ME_URL = `${environment.apiUrl}/v1/auth/me`;
const TOKEN_KEY = 'dm.auth.token';

function loginResponse(): Record<string, unknown> {
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
    },
  };
}

function meResponse(): Record<string, unknown> {
  return {
    id: 7,
    username: 'medico.demo',
    email: 'medico.demo@example.test',
    role: 'MEDICO',
    doctor_id: 12,
    is_active: true,
  };
}

function routeSnapshot(queryParams: Record<string, string> = {}): ActivatedRouteSnapshot {
  return {
    queryParamMap: convertToParamMap(queryParams),
  } as unknown as ActivatedRouteSnapshot;
}

function stateSnapshot(url: string): RouterStateSnapshot {
  return { url } as unknown as RouterStateSnapshot;
}

describe('sanitizeReturnUrl (CA-12)', () => {
  it.each([
    ['/', '/'],
    ['/origen', '/origen'],
    ['/login', '/login'],
    ['//evil.com', '/'],
    ['/\\evil', '/'],
    ['https://evil.test/phish', '/'],
    ['http://evil.test/', '/'],
    ['javascript:alert(1)', '/'],
    ['', '/'],
  ])('convierte %p en %p', (value, expected) => {
    expect(sanitizeReturnUrl(value)).toBe(expected);
  });

  it('sustituye null y undefined por /', () => {
    expect(sanitizeReturnUrl(null)).toBe('/');
    expect(sanitizeReturnUrl(undefined)).toBe('/');
  });
});

describe('authGuard y guestGuard', () => {
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

  function login(): void {
    auth.login({ email: 'medico.demo@example.test', password: 'Secreto-sintetico-1' }).subscribe();
    httpMock.expectOne(LOGIN_URL).flush(loginResponse());
  }

  describe('authGuard (CA-03/CA-04/CA-08)', () => {
    it('espera la restauración antes de decidir: no resuelve hasta que /me responde', async () => {
      localStorage.setItem(TOKEN_KEY, 'token-persistido');

      let settled = false;
      const pending = Promise.resolve(
        TestBed.runInInjectionContext(() =>
          authGuard(routeSnapshot(), stateSnapshot('/protegida')),
        ),
      ).then((result) => {
        settled = true;

        return result;
      });

      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);

      httpMock.expectOne(ME_URL).flush(meResponse());

      await expect(pending).resolves.toBe(true);
      expect(settled).toBe(true);
    });

    it('sin sesión redirige a /login?returnUrl=/ (CA-03)', async () => {
      const result = await TestBed.runInInjectionContext(() =>
        authGuard(routeSnapshot(), stateSnapshot('/')),
      );

      expect(result).toBeInstanceOf(UrlTree);
      expect(String(result)).toBe('/login?returnUrl=%2F');
      expect(result).toEqual(router.createUrlTree(['/login'], { queryParams: { returnUrl: '/' } }));
      httpMock.expectNone(ME_URL);
    });

    it('con sesión válida devuelve true (CA-04)', async () => {
      login();

      const result = await TestBed.runInInjectionContext(() =>
        authGuard(routeSnapshot(), stateSnapshot('/')),
      );

      expect(result).toBe(true);
      httpMock.expectNone(ME_URL);
    });

    it('con token previo pero sesión inválida añade reason=expired (CA-08)', async () => {
      login();
      vi.spyOn(auth, 'ensureValidSession').mockResolvedValue(false);

      const result = await TestBed.runInInjectionContext(() =>
        authGuard(routeSnapshot(), stateSnapshot('/tablero')),
      );

      expect(result).toBeInstanceOf(UrlTree);
      const tree = result as UrlTree;

      expect(tree.queryParams['returnUrl']).toBe('/tablero');
      expect(tree.queryParams['reason']).toBe('expired');
    });

    it('en primera visita anónima no añade reason=expired', async () => {
      const result = await TestBed.runInInjectionContext(() =>
        authGuard(routeSnapshot(), stateSnapshot('/tablero')),
      );

      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).queryParams['reason']).toBeUndefined();
    });
  });

  describe('guestGuard (CA-05/CA-12)', () => {
    it('sin sesión permite renderizar /login', async () => {
      const result = await TestBed.runInInjectionContext(() =>
        guestGuard(routeSnapshot({ returnUrl: '/' }), stateSnapshot('/login?returnUrl=/')),
      );

      expect(result).toBe(true);
    });

    it('con sesión redirige al returnUrl saneado', async () => {
      login();

      const result = await TestBed.runInInjectionContext(() =>
        guestGuard(routeSnapshot({ returnUrl: '/origen' }), stateSnapshot('/login')),
      );

      expect(result).toBeInstanceOf(UrlTree);
      expect(String(result)).toBe('/origen');
      expect(result).toEqual(router.parseUrl('/origen'));
    });

    it('con sesión y returnUrl hostil redirige a /', async () => {
      login();

      const result = await TestBed.runInInjectionContext(() =>
        guestGuard(
          routeSnapshot({ returnUrl: 'https://evil.test/phish' }),
          stateSnapshot('/login'),
        ),
      );

      expect(result).toBeInstanceOf(UrlTree);
      expect(String(result)).toBe('/');
    });

    it('con sesión y sin returnUrl redirige a /', async () => {
      login();

      const result = await TestBed.runInInjectionContext(() =>
        guestGuard(routeSnapshot(), stateSnapshot('/login')),
      );

      expect(result).toBeInstanceOf(UrlTree);
      expect(String(result)).toBe('/');
    });
  });
});
