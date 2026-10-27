import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { environment } from '../environments/environment';
import { App } from './app';
import { routes } from './app.routes';
import { adminGuard } from './core/auth/admin.guard';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { AuthService } from './core/auth/auth.service';
import { AppShell } from './core/layout/app-shell';
import { UserList } from './features/users/user-list/user-list';

const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;
const USERS_URL = `${environment.apiUrl}/v1/users`;

let activeHttpMock: HttpTestingController | null = null;

function loginResponse(username: string, role = 'MEDICO'): Record<string, unknown> {
  return {
    access_token: 'token-sintetico-de-prueba',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: 7,
      username,
      email: 'medico.demo@example.test',
      role,
      doctor_id: 12,
    },
  };
}

async function configureApp(): Promise<{
  router: Router;
  auth: AuthService;
  httpMock: HttpTestingController;
}> {
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  activeHttpMock = httpMock;

  return {
    router: TestBed.inject(Router),
    auth: TestBed.inject(AuthService),
    httpMock,
  };
}

/** Deja una sesión válida en memoria usando solo el flujo público de login (vía email). */
function seedSession(
  auth: AuthService,
  httpMock: HttpTestingController,
  username = 'medico.demo',
  role = 'MEDICO',
): void {
  auth.login({ email: `${username}@example.test`, password: 'Secreto-sintetico-1' }).subscribe();
  httpMock.expectOne(LOGIN_URL).flush(loginResponse(username, role));
}

function returnUrlOf(url: string): string | null {
  const query = url.split('?')[1] ?? '';

  return new URLSearchParams(query).get('returnUrl');
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    activeHttpMock?.verify();
    activeHttpMock = null;
    localStorage.clear();
  });

  describe('estructura de rutas (CA-01)', () => {
    it('declara exactamente tres entradas de primer nivel', () => {
      expect(routes.map((route) => route.path ?? '')).toEqual(['login', '', '**']);
    });

    it('expone /login como lazy con guestGuard y fuera del shell', () => {
      const login = routes[0];

      expect(login.path).toBe('login');
      expect(login.canActivate).toEqual([guestGuard]);
      expect(typeof login.loadComponent).toBe('function');
      expect(login.component).toBeUndefined();
    });

    it('monta el shell en la ruta padre protegida con Home y users como hijas (F-006 CA-01)', () => {
      const root = routes[1];

      expect(root.path).toBe('');
      expect(root.component).toBe(AppShell);
      expect(root.canActivate).toEqual([authGuard]);
      expect(root.children?.length).toBe(2);
      expect(root.children?.[0].path).toBe('');
      expect(typeof root.children?.[0].loadComponent).toBe('function');
    });

    it('declara users como hija lazy con adminGuard dentro del shell (F-006 CA-01)', () => {
      const users = routes[1].children?.[1];

      expect(users?.path).toBe('users');
      expect(users?.canActivate).toEqual([adminGuard]);
      expect(typeof users?.loadComponent).toBe('function');
      expect(users?.component).toBeUndefined();
    });

    it('redirige ** hacia la raíz', () => {
      expect(routes[2]).toMatchObject({ path: '**', redirectTo: '' });
    });
  });

  describe('sin sesión', () => {
    it('renderiza solo el outlet, sin shell en el arranque', async () => {
      await configureApp();
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('router-outlet')).not.toBeNull();
      expect(compiled.querySelector('dm-app-shell')).toBeNull();
    });

    // Presupuesto ampliado (F-007, solo spec): la primera navegación paga la
    // transformación del chunk lazy de `/login` y supera por poco los 5000 ms
    // por defecto bajo workers en paralelo; no es comportamiento de producto.
    it('navegar a / termina en /login?returnUrl=/ sin instanciar el shell (CA-03)', async () => {
      const { router } = await configureApp();
      const fixture = TestBed.createComponent(App);

      await router.navigateByUrl('/');
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(router.url.startsWith('/login?returnUrl=')).toBe(true);
      expect(returnUrlOf(router.url)).toBe('/');
      expect(compiled.querySelector('dm-app-shell')).toBeNull();
      expect(compiled.querySelector('dm-login')).not.toBeNull();
    }, 15000);

    it('/login renderiza dm-login y no el shell (CA-05)', async () => {
      const { router } = await configureApp();
      const fixture = TestBed.createComponent(App);

      await router.navigateByUrl('/login');
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('dm-login')).not.toBeNull();
      expect(compiled.querySelector('dm-app-shell')).toBeNull();
    });

    it('una ruta desconocida cae al login con returnUrl=/ (CA-02)', async () => {
      const { router } = await configureApp();
      const fixture = TestBed.createComponent(App);

      await router.navigateByUrl('/ruta-inexistente');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(router.url.startsWith('/login?returnUrl=')).toBe(true);
      expect(returnUrlOf(router.url)).toBe('/');
    });
  });

  describe('con sesión válida', () => {
    it("la ruta '' renderiza dm-home con mat-card dentro del shell (CA-02/CA-04)", async () => {
      const { router, auth, httpMock } = await configureApp();
      seedSession(auth, httpMock);
      const fixture = TestBed.createComponent(App);

      await router.navigateByUrl('/');
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const home = compiled.querySelector('dm-home');

      expect(router.url).toBe('/');
      expect(home).not.toBeNull();
      expect(home?.closest('dm-app-shell')).not.toBeNull();
      expect(home?.querySelector('mat-card')).not.toBeNull();
    });

    it('la topbar del shell muestra el username de la sesión (CA-06)', async () => {
      const { router, auth, httpMock } = await configureApp();
      seedSession(auth, httpMock, 'medico.demo');
      const fixture = TestBed.createComponent(App);

      await router.navigateByUrl('/');
      await fixture.whenStable();
      fixture.detectChanges();

      const topbar = (fixture.nativeElement as HTMLElement).querySelector(
        'dm-app-shell .dm-topbar',
      );

      expect(topbar?.textContent).toContain('medico.demo');
    });

    it('/login?returnUrl=/ redirige a / con sesión (CA-05)', async () => {
      const { router, auth, httpMock } = await configureApp();
      seedSession(auth, httpMock);
      const fixture = TestBed.createComponent(App);

      await router.navigateByUrl('/login?returnUrl=/');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(router.url).toBe('/');
      expect((fixture.nativeElement as HTMLElement).querySelector('dm-home')).not.toBeNull();
    });

    it('/login sin returnUrl redirige a / con sesión (CA-05)', async () => {
      const { router, auth, httpMock } = await configureApp();
      seedSession(auth, httpMock);
      const fixture = TestBed.createComponent(App);

      await router.navigateByUrl('/login');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(router.url).toBe('/');
    });

    it('una ruta desconocida termina en / con Home dentro del shell (CA-02)', async () => {
      const { router, auth, httpMock } = await configureApp();
      seedSession(auth, httpMock);
      const fixture = TestBed.createComponent(App);

      await router.navigateByUrl('/ruta-inexistente');
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(router.url).toBe('/');
      expect(compiled.querySelector('dm-home')).not.toBeNull();
      expect(compiled.querySelector('dm-home')?.closest('dm-app-shell')).not.toBeNull();
    });
  });

  describe('/users por rol (F-006 CA-01/CA-09)', () => {
    it('sin sesión termina en /login?returnUrl=%2Fusers sin shell ni lista', async () => {
      const { router } = await configureApp();
      const fixture = TestBed.createComponent(App);

      await router.navigateByUrl('/users');
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(router.url).toBe('/login?returnUrl=%2Fusers');
      expect(returnUrlOf(router.url)).toBe('/users');
      expect(compiled.querySelector('dm-app-shell')).toBeNull();
      expect(compiled.querySelector('dm-user-list')).toBeNull();
    });

    it('con sesión MEDICO termina en / con Home y sin la lista', async () => {
      const { router, auth, httpMock } = await configureApp();
      seedSession(auth, httpMock, 'medico.demo', 'MEDICO');
      const fixture = TestBed.createComponent(App);

      await router.navigateByUrl('/users');
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(router.url).toBe('/');
      expect(compiled.querySelector('dm-home')).not.toBeNull();
      expect(compiled.querySelector('dm-user-list')).toBeNull();
    });

    it('con sesión ADMIN renderiza dm-user-list dentro del shell', async () => {
      const { router, auth, httpMock } = await configureApp();
      seedSession(auth, httpMock, 'admin.demo', 'ADMIN');
      const fixture = TestBed.createComponent(App);

      await router.navigateByUrl('/users');
      await fixture.whenStable();
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === USERS_URL && request.method === 'GET')
        .flush({ items: [], total: 0, page: 1, size: 20, pages: 0 });
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(router.url).toBe('/users');
      expect(compiled.querySelector('dm-user-list')).not.toBeNull();
      expect(compiled.querySelector('dm-user-list')?.closest('dm-app-shell')).not.toBeNull();
    });
  });

  describe('/users con shell estable al filtrar (F-008 CA-01/CA-02)', () => {
    it('footer/header/nav/main conservan identidad de nodo durante load() sin navegar', async () => {
      const { router, auth, httpMock } = await configureApp();
      seedSession(auth, httpMock, 'admin.demo', 'ADMIN');
      const fixture = TestBed.createComponent(App);
      document.body.appendChild(fixture.nativeElement as HTMLElement);
      try {
        await router.navigateByUrl('/users');
        await fixture.whenStable();
        fixture.detectChanges();

        httpMock
          .expectOne((request) => request.url === USERS_URL && request.method === 'GET')
          .flush({
            items: [
              {
                id: 7,
                username: 'admin.demo',
                email: 'admin.demo@example.test',
                role: 'ADMIN',
                doctor_id: null,
                is_active: true,
              },
            ],
            total: 1,
            page: 1,
            size: 20,
            pages: 1,
          });
        await fixture.whenStable();
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const footer = compiled.querySelector('footer.dm-footer');
        const header = compiled.querySelector('header.dm-topbar');
        const nav = compiled.querySelector('nav#dm-primary-nav');
        const main = compiled.querySelector('main#dm-main-content');
        expect(footer?.textContent).toContain('Dispensario Médico — Sistema de gestión');

        const input = compiled.querySelector(
          'dm-user-list .dm-user-list__search input',
        ) as HTMLInputElement | null;
        expect(input).not.toBeNull();
        input?.focus();
        expect(document.activeElement).toBe(input);

        const list = fixture.debugElement.query(By.css('dm-user-list'))
          .componentInstance as UserList;
        list.statusFilter.setValue('inactive');
        fixture.detectChanges();

        expect(router.url).toBe('/users');
        expect(compiled.querySelector('footer.dm-footer')).toBe(footer);
        expect(compiled.querySelector('header.dm-topbar')).toBe(header);
        expect(compiled.querySelector('nav#dm-primary-nav')).toBe(nav);
        expect(compiled.querySelector('main#dm-main-content')).toBe(main);
        expect(
          compiled.querySelector('.dm-user-list__table-region')?.getAttribute('aria-busy'),
        ).toBe('true');
        expect(document.activeElement).toBe(
          compiled.querySelector('dm-user-list .dm-user-list__search input'),
        );

        httpMock
          .expectOne(
            (request) => request.url === USERS_URL && request.params.get('is_active') === 'false',
          )
          .flush({ items: [], total: 0, page: 1, size: 20, pages: 0 });
        await fixture.whenStable();
        fixture.detectChanges();

        expect(router.url).toBe('/users');
        expect(compiled.querySelector('footer.dm-footer')).toBe(footer);
        expect(footer?.textContent).toContain('Dispensario Médico — Sistema de gestión');
      } finally {
        (fixture.nativeElement as HTMLElement).remove();
      }
    }, 15000);
  });
});
