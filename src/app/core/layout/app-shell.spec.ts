import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

describe('AppShell', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
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
});
