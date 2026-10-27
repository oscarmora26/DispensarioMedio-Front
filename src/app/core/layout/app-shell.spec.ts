import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { AppShell } from './app-shell';

/** Breakpoint declarado en `_tokens.scss` (`$dm-breakpoint-desktop`). */
const DESKTOP_QUERY = '(min-width: 1280px)';

interface MatchMediaProbe {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  queries: () => string[];
  setMatches: (matches: boolean) => void;
  listenerCount: () => number;
}

/**
 * jsdom no implementa `matchMedia`. Se instala un doble controlable antes de
 * crear el componente, porque el shell resuelve el breakpoint en el
 * inicializador de campos (al construirse).
 */
function installMatchMedia(initialMatches: boolean): MatchMediaProbe {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const addEventListener = vi.fn(
    (type: string, listener: (event: MediaQueryListEvent) => void): void => {
      if (type === 'change') {
        listeners.add(listener);
      }
    },
  );

  const removeEventListener = vi.fn(
    (type: string, listener: (event: MediaQueryListEvent) => void): void => {
      if (type === 'change') {
        listeners.delete(listener);
      }
    },
  );

  const queryList = {
    matches: initialMatches,
    media: DESKTOP_QUERY,
    onchange: null,
    addEventListener,
    removeEventListener,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => true,
  };

  const queries: string[] = [];
  const matchMedia = vi.fn((query: string) => {
    queries.push(query);
    return queryList as unknown as MediaQueryList;
  });

  window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

  return {
    addEventListener,
    removeEventListener,
    queries: () => [...queries],
    setMatches(matches: boolean): void {
      queryList.matches = matches;
      for (const listener of [...listeners]) {
        listener({ matches } as MediaQueryListEvent);
      }
    },
    listenerCount: () => listeners.size,
  };
}

function query<T extends Element>(host: HTMLElement, selector: string): T {
  const element = host.querySelector<T>(selector);

  if (!element) {
    throw new Error(`No se encontró el elemento "${selector}"`);
  }

  return element;
}

interface ShellHarness {
  fixture: ComponentFixture<AppShell>;
  host: HTMLElement;
  media: MatchMediaProbe;
  toggle: HTMLButtonElement;
  nav: HTMLElement;
}

function createShell(desktop: boolean): ShellHarness {
  const media = installMatchMedia(desktop);
  const fixture = TestBed.createComponent(AppShell);
  fixture.detectChanges();

  const host = fixture.nativeElement as HTMLElement;

  return {
    fixture,
    host,
    media,
    toggle: query<HTMLButtonElement>(host, '.dm-topbar__toggle'),
    nav: query<HTMLElement>(host, 'nav'),
  };
}

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

/**
 * Texto del CSS compilado propio del shell que Angular inyecta en el documento
 * durante el test (encapsulación emulada → `<style>` en `<head>`). Se filtra
 * por `.dm-skip-link` para excluir los estilos de Angular Material, que
 * gestionan su propio foco con reemplazo y quedan fuera del alcance de CA-04.
 */
function ownStyleText(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .filter((css) => css.includes('.dm-skip-link'))
    .join('\n');
}

describe('AppShell', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('desktop (>=1280px)', () => {
    it('parte con el drawer persistente expandido, sin backdrop y sin inert', () => {
      const { fixture, host, nav, toggle } = createShell(true);

      expect(fixture.componentInstance.isDesktop()).toBe(true);
      expect(nav.hasAttribute('inert')).toBe(false);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(toggle.getAttribute('aria-label')).toBe('Ocultar navegación');
      expect(host.querySelector('.dm-shell__backdrop')).toBeNull();
      expect(nav.classList.contains('dm-sidenav--collapsed')).toBe(false);
      expect(nav.classList.contains('dm-sidenav--open')).toBe(false);
    });

    it('consulta el breakpoint documentado de 1280px', () => {
      const { media } = createShell(true);

      expect(media.queries()).toEqual([DESKTOP_QUERY]);
    });

    it('colapsa y expande el drawer alternando aria-expanded y la clase de colapso', () => {
      const { fixture, nav, toggle } = createShell(true);

      toggle.click();
      fixture.detectChanges();

      expect(nav.classList.contains('dm-sidenav--collapsed')).toBe(true);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.getAttribute('aria-label')).toBe('Mostrar navegación');
      // El drawer persistente sigue accesible: nunca queda `inert` en desktop.
      expect(nav.hasAttribute('inert')).toBe(false);

      toggle.click();
      fixture.detectChanges();

      expect(nav.classList.contains('dm-sidenav--collapsed')).toBe(false);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
    });

    it('Escape no colapsa el drawer persistente', () => {
      const { fixture, nav, toggle } = createShell(true);

      pressEscape();
      fixture.detectChanges();

      expect(nav.classList.contains('dm-sidenav--collapsed')).toBe(false);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
    });

    it('excluye el backdrop del DOM cuando el drawer es persistente', () => {
      const { fixture, toggle, host } = createShell(true);

      toggle.click();
      fixture.detectChanges();

      expect(host.querySelector('.dm-shell__backdrop')).toBeNull();
    });
  });

  describe('tablet y mobile (<1280px)', () => {
    it('arranca con el off-canvas cerrado, inert y sin backdrop', () => {
      const { fixture, host, nav, toggle } = createShell(false);

      expect(fixture.componentInstance.isDesktop()).toBe(false);
      expect(nav.hasAttribute('inert')).toBe(true);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.getAttribute('aria-label')).toBe('Mostrar navegación');
      expect(host.querySelector('.dm-shell__backdrop')).toBeNull();
      expect(nav.classList.contains('dm-sidenav--open')).toBe(false);
    });

    it('abre el off-canvas y retira inert al pulsar el botón de menú', () => {
      const { fixture, host, nav, toggle } = createShell(false);

      toggle.click();
      fixture.detectChanges();

      expect(nav.hasAttribute('inert')).toBe(false);
      expect(nav.classList.contains('dm-sidenav--open')).toBe(true);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');

      const backdrop = query<HTMLButtonElement>(host, '.dm-shell__backdrop');
      expect(backdrop.getAttribute('aria-label')).toBe('Cerrar navegación');
      expect(backdrop.getAttribute('type')).toBe('button');
    });

    it('cierra el off-canvas con Escape enviado al documento', () => {
      const { fixture, host, nav, toggle } = createShell(false);

      toggle.click();
      fixture.detectChanges();
      expect(nav.hasAttribute('inert')).toBe(false);

      pressEscape();
      fixture.detectChanges();

      expect(nav.hasAttribute('inert')).toBe(true);
      expect(nav.classList.contains('dm-sidenav--open')).toBe(false);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(host.querySelector('.dm-shell__backdrop')).toBeNull();
    });

    it('mantiene el off-canvas cerrado si Escape se pulsa estando ya cerrado', () => {
      const { fixture, host, nav, toggle } = createShell(false);

      expect(() => {
        pressEscape();
        fixture.detectChanges();
      }).not.toThrow();

      expect(nav.hasAttribute('inert')).toBe(true);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(host.querySelector('.dm-shell__backdrop')).toBeNull();
    });

    it('cierra el off-canvas al pulsar el backdrop', () => {
      const { fixture, host, nav, toggle } = createShell(false);

      toggle.click();
      fixture.detectChanges();

      query<HTMLButtonElement>(host, '.dm-shell__backdrop').click();
      fixture.detectChanges();

      expect(nav.hasAttribute('inert')).toBe(true);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(host.querySelector('.dm-shell__backdrop')).toBeNull();
    });

    it('cierra el off-canvas al navegar con un enlace del sidenav', () => {
      const { fixture, host, nav, toggle } = createShell(false);

      toggle.click();
      fixture.detectChanges();

      query<HTMLAnchorElement>(host, '.dm-nav__link').click();
      fixture.detectChanges();

      expect(nav.hasAttribute('inert')).toBe(true);
      expect(host.querySelector('.dm-shell__backdrop')).toBeNull();
    });

    it('reutiliza el estado colapsado de desktop solo en desktop', () => {
      const { fixture, nav, toggle, media } = createShell(true);

      toggle.click();
      fixture.detectChanges();
      expect(nav.classList.contains('dm-sidenav--collapsed')).toBe(true);

      media.setMatches(false);
      fixture.detectChanges();

      // En off-canvas cerrado el colapso no aplica y la nav queda inerte.
      expect(nav.classList.contains('dm-sidenav--collapsed')).toBe(false);
      expect(nav.hasAttribute('inert')).toBe(true);

      media.setMatches(true);
      fixture.detectChanges();

      // Al volver a desktop se recupera el estado de colapso previo.
      expect(nav.classList.contains('dm-sidenav--collapsed')).toBe(true);
      expect(nav.hasAttribute('inert')).toBe(false);
    });

    it('cierra el off-canvas si el viewport pasa a desktop', () => {
      const { fixture, host, media, nav } = createShell(false);

      query<HTMLButtonElement>(fixture.nativeElement as HTMLElement, '.dm-topbar__toggle').click();
      fixture.detectChanges();
      expect(nav.hasAttribute('inert')).toBe(false);

      media.setMatches(true);
      fixture.detectChanges();

      expect(fixture.componentInstance.mobileOpen()).toBe(false);
      expect(nav.hasAttribute('inert')).toBe(false);
      expect(host.querySelector('.dm-shell__backdrop')).toBeNull();
    });

    it('elimina el listener de matchMedia al destruir el componente', () => {
      const { fixture, media } = createShell(false);

      expect(media.addEventListener).toHaveBeenCalledTimes(1);
      expect(media.listenerCount()).toBe(1);

      fixture.destroy();

      expect(media.removeEventListener).toHaveBeenCalledTimes(1);
      expect(media.listenerCount()).toBe(0);
    });

    it('deja de escuchar Escape en el documento tras destruirse', () => {
      const addSpy = vi.spyOn(document, 'addEventListener');
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      const { fixture } = createShell(false);
      const registrados = addSpy.mock.calls.filter(([type]) => type === 'keydown').length;

      expect(registrados).toBeGreaterThan(0);

      fixture.destroy();

      const liberados = removeSpy.mock.calls.filter(([type]) => type === 'keydown').length;
      expect(liberados).toBe(registrados);
      expect(() => pressEscape()).not.toThrow();

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe('accesibilidad del andamiaje', () => {
    it('el primer elemento enfocable es el skip link hacia #dm-main-content', () => {
      const { host } = createShell(false);

      const focusables = Array.from(
        host.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'),
      );
      const skipLink = query<HTMLAnchorElement>(host, '.dm-skip-link');

      expect(focusables[0]).toBe(skipLink);
      expect(skipLink.getAttribute('href')).toBe('#dm-main-content');
      expect(skipLink.textContent?.trim()).toBe('Saltar al contenido principal');
    });

    it('el main es el destino del skip link y es programáticamente enfocable', () => {
      const { host } = createShell(false);

      const main = query<HTMLElement>(host, 'main');

      expect(main.id).toBe('dm-main-content');
      expect(main.getAttribute('tabindex')).toBe('-1');
      expect(host.querySelectorAll('#dm-main-content')).toHaveLength(1);
    });

    it('expone landmarks header/nav/main/footer únicos y una nav etiquetada', () => {
      const { host, nav } = createShell(false);

      expect(host.querySelectorAll('header')).toHaveLength(1);
      expect(host.querySelectorAll('nav')).toHaveLength(1);
      expect(host.querySelectorAll('main')).toHaveLength(1);
      expect(host.querySelectorAll('footer')).toHaveLength(1);
      expect(nav.getAttribute('aria-label')).toBe('Navegación principal');
    });

    it('el toggle referencia con aria-controls al nav del shell', () => {
      const { host, toggle } = createShell(false);

      const controls = toggle.getAttribute('aria-controls');

      expect(controls).toBe('dm-primary-nav');

      const target = query<HTMLElement>(host, `#${controls ?? 'inexistente'}`);
      expect(target).toBe(query<HTMLElement>(host, 'nav'));
      expect(target.tagName).toBe('NAV');
    });

    it('los iconos decorativos quedan fuera del árbol de accesibilidad', () => {
      const { host } = createShell(false);

      const iconos = Array.from(host.querySelectorAll('mat-icon'));

      expect(iconos.length).toBeGreaterThan(0);
      for (const icono of iconos) {
        expect(icono.getAttribute('aria-hidden')).toBe('true');
      }
    });

    it('renderiza el outlet y el enlace Inicio con su etiqueta', () => {
      const { host } = createShell(false);

      expect(host.querySelector('router-outlet')).not.toBeNull();

      const enlace = query<HTMLAnchorElement>(host, '.dm-nav__link');

      expect(enlace.getAttribute('href')).toBe('/');
      expect(enlace.textContent).toContain('Inicio');
    });
  });

  describe('bloque de usuario y sesión', () => {
    const loginUrl = `${environment.apiUrl}/v1/auth/login`;

    function seedSession(username: string, role: string): AuthService {
      const auth = TestBed.inject(AuthService);
      const httpMock = TestBed.inject(HttpTestingController);

      auth
        .login({ email: `${username}@example.test`, password: 'Secreto-sintetico-1' })
        .subscribe();
      httpMock.expectOne(loginUrl).flush({
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
      });

      return auth;
    }

    it('sin sesión no renderiza el bloque de usuario', () => {
      const { host } = createShell(true);

      expect(host.querySelector('.dm-user-block')).toBeNull();
      expect(host.querySelector('.dm-user-block__logout')).toBeNull();
    });

    it('con sesión ADMIN muestra username y la etiqueta «Administrador»', () => {
      seedSession('admin.demo', 'ADMIN');
      const { host } = createShell(true);

      expect(host.querySelector('.dm-user-block__name')?.textContent).toContain('admin.demo');
      expect(host.querySelector('.dm-user-block__role')?.textContent).toContain('Administrador');

      const logout = query<HTMLButtonElement>(host, '.dm-user-block__logout');

      expect(logout.textContent).toContain('Salir');
      expect(logout.getAttribute('type')).toBe('button');
    });

    it('con sesión MEDICO muestra la etiqueta «Médico»', () => {
      seedSession('medico.demo', 'MEDICO');
      const { host } = createShell(true);

      expect(host.querySelector('.dm-user-block__name')?.textContent).toContain('medico.demo');
      expect(host.querySelector('.dm-user-block__role')?.textContent).toContain('Médico');
    });

    it('un rol no previsto se muestra tal cual (fallback documentado)', () => {
      seedSession('otro.demo', 'ENFERMERIA');
      const { host } = createShell(true);

      expect(host.querySelector('.dm-user-block__role')?.textContent).toContain('ENFERMERIA');
    });

    it('«Salir» limpia la sesión, navega a /login sin returnUrl y oculta el bloque', () => {
      const auth = seedSession('medico.demo', 'MEDICO');
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const { fixture, host } = createShell(true);

      expect(host.querySelector('.dm-user-block')).not.toBeNull();

      query<HTMLButtonElement>(host, '.dm-user-block__logout').click();
      fixture.detectChanges();

      expect(auth.token()).toBeNull();
      expect(auth.user()).toBeNull();
      expect(localStorage.getItem('dm.auth.token')).toBeNull();
      expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
      expect(host.querySelector('.dm-user-block')).toBeNull();

      TestBed.inject(HttpTestingController).expectNone(loginUrl);
    });

    it('«Salir» es alcanzable por teclado como botón nativo', () => {
      seedSession('medico.demo', 'MEDICO');
      const { host } = createShell(true);

      const logout = query<HTMLButtonElement>(host, '.dm-user-block__logout');

      expect(logout.tagName).toBe('BUTTON');
      expect(logout.disabled).toBe(false);

      logout.focus();

      expect(document.activeElement).toBe(logout);
    });

    describe('ítem «Usuarios» solo ADMIN (F-006 CA-09)', () => {
      it('sin sesión muestra Inicio/Tipos de fármacos/Marcas/Ubicaciones pero no Usuarios', () => {
        const { host } = createShell(true);

        const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('.dm-nav__link'));

        expect(links).toHaveLength(4);
        expect(links[0].textContent).toContain('Inicio');
        expect(links[1].textContent).toContain('Tipos de fármacos');
        expect(links[2].textContent).toContain('Marcas');
        expect(links[3].textContent).toContain('Ubicaciones');
        expect(host.textContent).not.toContain('Usuarios');
      });

      it('con sesión MEDICO muestra Inicio, Tipos de fármacos, Marcas y Ubicaciones, no Usuarios', () => {
        seedSession('medico.demo', 'MEDICO');
        const { host } = createShell(true);

        const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('.dm-nav__link'));

        expect(links).toHaveLength(4);
        expect(links[0].textContent).toContain('Inicio');
        expect(links[1].textContent).toContain('Tipos de fármacos');
        expect(links[2].textContent).toContain('Marcas');
        expect(links[3].textContent).toContain('Ubicaciones');
        expect(host.textContent).not.toContain('Usuarios');
      });

      it('con sesión ADMIN muestra Inicio, Tipos de fármacos, Marcas y Usuarios con su ruta', () => {
        seedSession('admin.demo', 'ADMIN');
        const { host } = createShell(true);

        const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('.dm-nav__link'));

        expect(links).toHaveLength(5);
        expect(links[0].textContent).toContain('Inicio');
        expect(links[1].textContent).toContain('Tipos de fármacos');
        expect(links[1].getAttribute('href')).toBe('/drug-types');
        expect(links[2].textContent).toContain('Marcas');
        expect(links[2].getAttribute('href')).toBe('/brands');
        expect(links[3].textContent).toContain('Ubicaciones');
        expect(links[3].getAttribute('href')).toBe('/locations');
        expect(links[4].textContent).toContain('Usuarios');
        expect(links[4].getAttribute('href')).toBe('/users');
      });

      it('con sesión ADMIN el enlace a Usuarios cierra el off-canvas al navegar', () => {
        seedSession('admin.demo', 'ADMIN');
        // El harness declara `provideRouter([])`: se intercepta la navegación
        // real para no ensuciar la suite con NG04002; el cierre del drawer lo
        // gestiona el `(click)` propio del enlace, no el router.
        const router = TestBed.inject(Router);
        const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
        const { fixture, host, nav, toggle } = createShell(false);

        toggle.click();
        fixture.detectChanges();
        expect(nav.hasAttribute('inert')).toBe(false);

        const usersLink = Array.from(
          host.querySelectorAll<HTMLAnchorElement>('.dm-nav__link'),
        ).find((link) => link.textContent?.includes('Usuarios'));

        expect(usersLink).toBeDefined();
        usersLink?.click();
        fixture.detectChanges();

        expect(navigateSpy).toHaveBeenCalled();
        expect(nav.hasAttribute('inert')).toBe(true);
        expect(host.querySelector('.dm-shell__backdrop')).toBeNull();
      });
    });

    describe('ítem «Tipos de fármacos» para ADMIN y MEDICO (F-009 S6/S7)', () => {
      it('con sesión MEDICO enlaza a /drug-types', () => {
        seedSession('medico.demo', 'MEDICO');
        const { host } = createShell(true);

        const link = Array.from(host.querySelectorAll<HTMLAnchorElement>('.dm-nav__link')).find(
          (item) => item.textContent?.includes('Tipos de fármacos'),
        );

        expect(link).toBeDefined();
        expect(link?.getAttribute('href')).toBe('/drug-types');
      });

      it('con sesión ADMIN enlaza a /drug-types', () => {
        seedSession('admin.demo', 'ADMIN');
        const { host } = createShell(true);

        const link = Array.from(host.querySelectorAll<HTMLAnchorElement>('.dm-nav__link')).find(
          (item) => item.textContent?.includes('Tipos de fármacos'),
        );

        expect(link).toBeDefined();
        expect(link?.getAttribute('href')).toBe('/drug-types');
      });

      it('el enlace cierra el off-canvas al navegar (MEDICO)', () => {
        seedSession('medico.demo', 'MEDICO');
        const router = TestBed.inject(Router);
        const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
        const { fixture, host, nav, toggle } = createShell(false);

        toggle.click();
        fixture.detectChanges();
        expect(nav.hasAttribute('inert')).toBe(false);

        const link = Array.from(host.querySelectorAll<HTMLAnchorElement>('.dm-nav__link')).find(
          (item) => item.textContent?.includes('Tipos de fármacos'),
        );

        expect(link).toBeDefined();
        link?.click();
        fixture.detectChanges();

        expect(navigateSpy).toHaveBeenCalled();
        expect(nav.hasAttribute('inert')).toBe(true);
        expect(host.querySelector('.dm-shell__backdrop')).toBeNull();
      });
    });
  });

  describe('blindaje de foco (F-003)', () => {
    it('el CSS compilado acota :focus-visible con :not(.mat-mdc-input-element)', () => {
      createShell(true);

      expect(ownStyleText()).toContain(':focus-visible:not(.mat-mdc-input-element)');
    });

    it('skip-link, toggle y enlaces conservan el anillo genérico', () => {
      const { host, toggle } = createShell(true);
      const skipLink = query<HTMLAnchorElement>(host, '.dm-skip-link');
      const navLink = query<HTMLAnchorElement>(host, '.dm-nav__link');

      for (const control of [skipLink, toggle, navLink]) {
        expect(control.matches(':not(.mat-mdc-input-element)')).toBe(true);
      }
    });

    it('«Salir» conserva el anillo genérico', () => {
      const auth = TestBed.inject(AuthService);
      const httpMock = TestBed.inject(HttpTestingController);

      auth
        .login({ email: 'medico.demo@example.test', password: 'Secreto-sintetico-1' })
        .subscribe();
      httpMock.expectOne(`${environment.apiUrl}/v1/auth/login`).flush({
        access_token: 'token-sintetico-de-prueba',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: 7,
          username: 'medico.demo',
          email: 'medico.demo@example.test',
          role: 'MEDICO',
          doctor_id: null,
        },
      });

      const { host } = createShell(true);
      const logout = query<HTMLButtonElement>(host, '.dm-user-block__logout');

      expect(logout.matches(':not(.mat-mdc-input-element)')).toBe(true);
    });

    it('el shell no contiene .mat-mdc-input-element: el blindaje no altera nada visible (PQ-01)', () => {
      const { host } = createShell(true);

      expect(host.querySelector('.mat-mdc-input-element')).toBeNull();
    });

    it('el foco por teclado alcanza skip-link, toggle y navegación en orden (CA-05)', () => {
      const { host, toggle } = createShell(false);
      const skipLink = query<HTMLAnchorElement>(host, '.dm-skip-link');
      const navLink = query<HTMLAnchorElement>(host, '.dm-nav__link');

      for (const control of [skipLink, toggle, navLink]) {
        control.focus();
        expect(document.activeElement).toBe(control);
      }
    });

    it('ningún estilo inyectado elimina el outline sin reemplazo (CA-04)', () => {
      createShell(true);

      // Patrón construido por partes para no introducir el literal en este
      // spec y no interferir con el grep de CA-04 sobre las fuentes.
      const outlineNone = new RegExp(`out${'line'}\\s*:\\s*no${'ne'}`);

      expect(outlineNone.test(ownStyleText())).toBe(false);
    });
  });
});
