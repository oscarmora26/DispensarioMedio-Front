import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { LocationsToast } from '../locations-toast';
import { LocationList } from './location-list';

const SHELVES_URL = `${environment.apiUrl}/v1/shelves`;
const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;

function cellDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 11,
    shelf_id: 7,
    section: 'A',
    cell: '1',
    description: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function shelfDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 7,
    name: 'Estante A',
    description: 'Pasillo principal',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    cells: [cellDto(), cellDto({ id: 12, section: 'A', cell: '2' })],
    ...overrides,
  };
}

function pageResponse(items: Record<string, unknown>[]): Record<string, unknown> {
  return { items, total: items.length, page: 1, size: 20, pages: 1 };
}

/** Siembra una sesión del rol indicado usando solo el flujo público de login. */
function loginAs(role: 'ADMIN' | 'MEDICO'): void {
  const auth = TestBed.inject(AuthService);
  const httpMock = TestBed.inject(HttpTestingController);
  const username = role === 'ADMIN' ? 'admin.demo' : 'medico.demo';
  auth.login({ email: `${username}@example.test`, password: 'Secreto-sintetico-1' }).subscribe();
  httpMock.expectOne(LOGIN_URL).flush({
    access_token: 'token-sintetico-de-prueba',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: 7,
      username,
      email: `${username}@example.test`,
      role,
      doctor_id: role === 'MEDICO' ? 5 : null,
    },
  });
}

function createToastStub(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    showCreated: vi.fn(),
    showUpdated: vi.fn(),
    showActivated: vi.fn(),
    showDeactivated: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
  };
}

describe('LocationList (F-011 S1-S10, contrato /v1/shelves)', () => {
  let fixture: ComponentFixture<LocationList>;
  let component: LocationList;
  let httpMock: HttpTestingController;
  let dialogStub: { open: ReturnType<typeof vi.fn> };
  let toastStub: Record<string, ReturnType<typeof vi.fn>>;

  function flushList(items: Record<string, unknown>[]): void {
    httpMock
      .expectOne((request) => request.url === SHELVES_URL && request.method === 'GET')
      .flush(pageResponse(items));
    fixture.detectChanges();
  }

  function searchInput(): HTMLInputElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.dm-location-list__search input');
  }

  /**
   * CSS compilado propio del listado que Angular inyecta en el documento
   * (encapsulación emulada → `<style>` en `<head>`). Se filtra por la clase
   * raíz para excluir los estilos de Angular Material.
   */
  function ownStyleText(): string {
    return Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .filter((css) => css.includes('.dm-location-list'))
      .join('\n');
  }

  beforeEach(async () => {
    localStorage.clear();
    dialogStub = { open: vi.fn() };
    toastStub = createToastStub();
    await TestBed.configureTestingModule({
      imports: [LocationList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: dialogStub },
        { provide: LocationsToast, useValue: toastStub },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    loginAs('ADMIN');
    fixture = TestBed.createComponent(LocationList);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.nativeElement?.remove?.();
    httpMock.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('listado base (S1/S6)', () => {
    it('emite GET /v1/shelves con page=1&size=20 y muestra nombre/descripción/celdas/estado/acciones', () => {
      fixture.detectChanges();

      const req = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.method === 'GET',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.has('is_active')).toBe(false);
      expect(req.request.params.has('sort')).toBe(false);
      req.flush(
        pageResponse([
          shelfDto(),
          shelfDto({ id: 8, name: 'Estante B', description: null, is_active: false }),
        ]),
      );
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('table[aria-label="Ubicaciones"]')).not.toBeNull();
      expect(compiled.textContent).toContain('Estante A');
      expect(compiled.textContent).toContain('Pasillo principal');
      expect(compiled.textContent).toContain('Estante B');
      expect(compiled.textContent).toContain('Activo');
      expect(compiled.textContent).toContain('Inactivo');
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Editar Estante A"]')).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Desactivar Estante A"]')).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Activar Estante B"]')).not.toBeNull();
    });

    it('la columna Celdas lista las celdas como «tramo / celda» y su cantidad', () => {
      fixture.detectChanges();
      flushList([shelfDto(), shelfDto({ id: 8, name: 'Estante B', cells: [] })]);

      const compiled = fixture.nativeElement as HTMLElement;
      const rows = compiled.querySelectorAll('tbody tr');

      expect(rows[0].querySelector('.dm-location-list__cells')?.textContent).toContain(
        'A / 1 · A / 2',
      );
      expect(rows[0].querySelector('.dm-location-list__cell-count')?.textContent).toContain('2');
      // Un estante sin celdas no inventa contenido ni cantidad.
      expect(rows[1].querySelector('.dm-location-list__cells')?.textContent).toContain('—');
      expect(rows[1].querySelector('.dm-location-list__cell-count')).toBeNull();
    });

    it('la descripción nula del estante se muestra como raya', () => {
      fixture.detectChanges();
      flushList([shelfDto({ description: null })]);

      const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
      expect(rows[0].querySelector('.dm-location-list__description')?.textContent).toContain('—');
    });

    it('solo la columna Nombre es ordenable (mat-sort envía name / -name)', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      const headerCells = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('th[mat-sort-header]'),
      );
      expect(headerCells).toHaveLength(1);
      expect(headerCells[0].getAttribute('mat-sort-header')).toBe('name');
    });

    it('durante la carga inicial el aria-busy vive en la región de la tabla, no en la sección (S10)', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(component.loading()).toBe(true);
      expect(compiled.querySelector('[aria-label="Cargando ubicaciones"]')).not.toBeNull();
      expect(
        compiled.querySelector('.dm-location-list__table-region')?.getAttribute('aria-busy'),
      ).toBe('true');
      expect(
        compiled.querySelector('section.dm-location-list')?.getAttribute('aria-busy'),
      ).toBeNull();

      flushList([]);
    });

    it('sin resultados muestra el vacío propio «No hay ubicaciones para mostrar.» con role=status (S6)', () => {
      fixture.detectChanges();
      flushList([]);

      const compiled = fixture.nativeElement as HTMLElement;
      const empty = compiled.querySelector('.dm-location-list__empty');
      expect(empty?.textContent?.trim()).toBe('No hay ubicaciones para mostrar.');
      expect(empty?.getAttribute('role')).toBe('status');
    });

    it('un 404 del catálogo se muestra como error inline, nunca como vacío (bug reportado)', () => {
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === SHELVES_URL && request.method === 'GET')
        .flush('ausente sintético', { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(component.errorMessage()).toBe(
        'La ubicación solicitada ya no existe. Actualiza la lista.',
      );
      expect(compiled.textContent).not.toContain('No hay ubicaciones para mostrar.');
      expect(compiled.querySelector('.dm-location-list__empty')).toBeNull();
      expect(
        compiled.querySelector('.dm-location-list__table-region [role="alert"]')?.textContent,
      ).toContain('La ubicación solicitada ya no existe. Actualiza la lista.');
    });

    it('ante fallo con filas previas conserva las filas y anuncia el error inline sin toast (S6/CA-06)', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      expect(toastStub['showError']).not.toHaveBeenCalled();

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === SHELVES_URL && request.method === 'GET')
        .flush('caída sintética', { status: 500, statusText: 'Error' });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const region = compiled.querySelector('.dm-location-list__table-region');

      // Mensaje propio de `mapLocationsError` (500 → genérico), ya traducido.
      expect(component.errorMessage()).toBe(
        'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
      );
      expect(component.loading()).toBe(false);
      expect(region?.getAttribute('aria-busy')).toBe('false');
      // Filas anteriores conservadas: sin parpadeo a vacío.
      expect(component.items()).toHaveLength(1);
      expect(compiled.textContent).toContain('Estante A');
      expect(compiled.querySelector('.dm-location-list__empty')).toBeNull();
      // Error inline dentro de la región, nunca en toast (un solo anuncio).
      expect(region?.querySelector('[role="alert"]')?.textContent).toContain(
        'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
      );
      expect(toastStub['showError']).not.toHaveBeenCalled();
    });

    it('ante fallo sin filas previas no muestra el vacío y sí el error inline, sin toast (S6/CA-06)', () => {
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === SHELVES_URL && request.method === 'GET')
        .flush('caída sintética', { status: 0, statusText: 'Unknown Error' });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(component.errorMessage()).toBe(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      );
      expect(component.loading()).toBe(false);
      // El vacío no sustituye al error: solo hay mensaje de error con reintento.
      expect(compiled.textContent).not.toContain('No hay ubicaciones para mostrar.');
      expect(compiled.querySelector('.dm-location-list__empty')).toBeNull();
      expect(
        compiled.querySelector('.dm-location-list__table-region [role="alert"]')?.textContent,
      ).toContain(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      );
      expect(toastStub['showError']).not.toHaveBeenCalled();
    });
  });

  describe('error de carga con reintento (S6, CA-06)', () => {
    function failLoad(status = 500): void {
      httpMock
        .expectOne((request) => request.url === SHELVES_URL && request.method === 'GET')
        .flush('caída sintética', { status, statusText: 'Error' });
      fixture.detectChanges();
    }

    it('el botón «Reintentar» tiene etiqueta accesible y se deshabilita mientras loading() es true', () => {
      fixture.detectChanges();
      failLoad();

      const compiled = fixture.nativeElement as HTMLElement;
      const retryButton = () =>
        compiled.querySelector(
          '.dm-location-list__table-region button.dm-location-list__retry',
        ) as HTMLButtonElement | null;

      expect(retryButton()).not.toBeNull();
      expect(retryButton()?.textContent?.trim()).toBe('Reintentar');
      expect(retryButton()?.getAttribute('aria-label')).toBe('Reintentar la carga de ubicaciones');
      expect(retryButton()?.disabled).toBe(false);

      component.loading.set(true);
      fixture.detectChanges();

      expect(retryButton()?.disabled).toBe(true);
    });

    it('reintentar reemite GET con los criterios vigentes, sin volver a página 1, y limpia el error al arrancar', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      // Criterios vigentes antes del fallo: página 2 con tamaño 10 (cambiar el
      // tamaño vuelve a página 1, así que primero se ajusta y luego se navega).
      component.onPage({ pageIndex: 0, pageSize: 10, length: 45 } as PageEvent);
      flushList([shelfDto()]);
      component.onPage({ pageIndex: 1, pageSize: 10, length: 45 } as PageEvent);
      fixture.detectChanges();
      failLoad();

      expect(component.pageIndex()).toBe(1);
      expect(component.pageSize()).toBe(10);
      expect(component.errorMessage()).not.toBeNull();

      const retryButton = (fixture.nativeElement as HTMLElement).querySelector(
        '.dm-location-list__retry',
      ) as HTMLButtonElement;
      retryButton.click();
      fixture.detectChanges();

      // Limpieza inmediata del error al arrancar la carga (sin doble anuncio).
      expect(component.errorMessage()).toBeNull();
      expect(component.loading()).toBe(true);
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();

      const req = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.method === 'GET',
      );
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('10');
      // Sin reset a la primera página ni cambio de criterios.
      expect(component.pageIndex()).toBe(1);
      expect(component.pageSize()).toBe(10);
      req.flush({
        items: [shelfDto({ id: 99, name: 'Estante Z' })],
        total: 45,
        page: 2,
        size: 10,
        pages: 5,
      });
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
      expect(component.errorMessage()).toBeNull();
    });

    it('si el reintento tiene éxito el error desaparece y se muestran las filas nuevas', () => {
      fixture.detectChanges();
      failLoad();
      expect(component.items()).toHaveLength(0);

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('.dm-location-list__retry')
        ?.click();
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === SHELVES_URL && request.method === 'GET')
        .flush(pageResponse([shelfDto({ id: 99, name: 'Estante Z' })]));
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(component.errorMessage()).toBeNull();
      expect(compiled.querySelector('[role="alert"]')).toBeNull();
      expect(compiled.querySelector('.dm-location-list__empty')).toBeNull();
      expect(component.items()).toHaveLength(1);
      expect(compiled.textContent).toContain('Estante Z');
      expect(compiled.querySelector('.dm-location-list__loading')).toBeNull();
    });

    it('el fallo de carga produce un solo anuncio: un role=alert en la región y ningún toast', () => {
      fixture.detectChanges();
      failLoad();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelectorAll('[role="alert"]')).toHaveLength(1);
      expect(
        compiled.querySelector('.dm-location-list__table-region [role="alert"]'),
      ).not.toBeNull();
      expect(toastStub['showError']).not.toHaveBeenCalled();
    });
  });

  describe('carga sin parpadeo (S10)', () => {
    it('header, filtros y paginador permanecen montados durante la recarga con foco conservado', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      document.body.appendChild(fixture.nativeElement as HTMLElement);
      fixture.detectChanges();

      const input = searchInput();
      expect(input).not.toBeNull();
      input?.focus();
      expect(document.activeElement).toBe(input);

      // Recarga (página 2) sin resolver todavía: solo la región conmuta.
      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.dm-location-list__header')).not.toBeNull();
      expect(compiled.querySelector('.dm-location-list__filters')).not.toBeNull();
      expect(searchInput()).not.toBeNull();
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
      // Filas anteriores visibles + spinner contenido: sin parpadeo del layout.
      expect(compiled.textContent).toContain('Estante A');
      expect(compiled.querySelector('[aria-label="Cargando ubicaciones"]')).not.toBeNull();
      expect(
        compiled.querySelector('.dm-location-list__table-region')?.getAttribute('aria-busy'),
      ).toBe('true');
      expect(
        compiled.querySelector('section.dm-location-list')?.getAttribute('aria-busy'),
      ).toBeNull();
      // El foco sigue en el buscador: la recarga no lo roba.
      expect(document.activeElement).toBe(searchInput());

      httpMock
        .expectOne((request) => request.url === SHELVES_URL && request.params.get('page') === '2')
        .flush({
          items: [shelfDto({ id: 99, name: 'Estante Z' })],
          total: 45,
          page: 2,
          size: 20,
          pages: 3,
        });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Estante Z');
      expect(component.loading()).toBe(false);
      expect(
        (fixture.nativeElement as HTMLElement)
          .querySelector('.dm-location-list__table-region')
          ?.getAttribute('aria-busy'),
      ).toBe('false');
      expect(document.activeElement).toBe(searchInput());
    });

    it('header, filtros, región y paginador conservan identidad de nodo durante load()', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      const compiled = fixture.nativeElement as HTMLElement;
      const header = compiled.querySelector('.dm-location-list__header');
      const filters = compiled.querySelector('.dm-location-list__filters');
      const region = compiled.querySelector('.dm-location-list__table-region');
      const paginator = compiled.querySelector('mat-paginator');

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      expect(compiled.querySelector('.dm-location-list__header')).toBe(header);
      expect(compiled.querySelector('.dm-location-list__filters')).toBe(filters);
      expect(compiled.querySelector('.dm-location-list__table-region')).toBe(region);
      expect(compiled.querySelector('mat-paginator')).toBe(paginator);

      httpMock
        .expectOne((request) => request.url === SHELVES_URL && request.params.get('page') === '2')
        .flush({
          items: [shelfDto({ id: 99 })],
          total: 45,
          page: 2,
          size: 20,
          pages: 3,
        });
      fixture.detectChanges();

      expect(compiled.querySelector('.dm-location-list__header')).toBe(header);
      expect(compiled.querySelector('.dm-location-list__filters')).toBe(filters);
      expect(compiled.querySelector('.dm-location-list__table-region')).toBe(region);
      expect(compiled.querySelector('mat-paginator')).toBe(paginator);
    });

    it('la carga vive contenida en la región como overlay, con tabla y paginador montados', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const region = compiled.querySelector('.dm-location-list__table-region');
      const loading = compiled.querySelector('.dm-location-list__loading');

      expect(region).not.toBeNull();
      expect(loading).not.toBeNull();
      // El overlay está dentro de la región y no sustituye a la tabla.
      expect(region?.contains(loading)).toBe(true);
      expect(compiled.querySelector('table[aria-label="Ubicaciones"]')).not.toBeNull();
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
      expect(compiled.textContent).toContain('Estante A');
      // El overlay flota sobre la región: sin altura en flujo ni robo de puntero.
      expect(loading ? getComputedStyle(loading).position : null).toBe('absolute');
      expect(loading ? getComputedStyle(loading).pointerEvents : null).toBe('none');
      expect(region ? getComputedStyle(region).position : null).toBe('relative');

      httpMock
        .expectOne((request) => request.url === SHELVES_URL && request.params.get('page') === '2')
        .flush(pageResponse([shelfDto({ id: 99 })]));
      fixture.detectChanges();

      expect(compiled.querySelector('.dm-location-list__loading')).toBeNull();
    });

    it('el buscador conserva el foco tras el debounce y la respuesta', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      document.body.appendChild(fixture.nativeElement as HTMLElement);
      fixture.detectChanges();

      const input = searchInput();
      input?.focus();
      expect(document.activeElement).toBe(input);

      vi.useFakeTimers();
      component.search.setValue('estante');
      vi.advanceTimersByTime(300);

      const req = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.params.get('search') === 'estante',
      );
      req.flush(pageResponse([]));
      fixture.detectChanges();

      expect(document.activeElement).toBe(searchInput());
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'No hay ubicaciones para mostrar.',
      );
    });

    it('filtrar por estado mantiene el foco en el buscador y aria-busy solo en la región', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      document.body.appendChild(fixture.nativeElement as HTMLElement);
      fixture.detectChanges();

      searchInput()?.focus();
      expect(document.activeElement).toBe(searchInput());

      component.statusFilter.setValue('inactive');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(
        compiled.querySelector('.dm-location-list__table-region')?.getAttribute('aria-busy'),
      ).toBe('true');
      expect(
        compiled.querySelector('section.dm-location-list')?.getAttribute('aria-busy'),
      ).toBeNull();
      expect(compiled.querySelector('.dm-location-list__loading')).not.toBeNull();
      expect(document.activeElement).toBe(searchInput());

      httpMock
        .expectOne(
          (request) => request.url === SHELVES_URL && request.params.get('is_active') === 'false',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      expect(document.activeElement).toBe(searchInput());
    });

    it('buscar/filtrar/paginar/ordenar no disparan navegación (S10)', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate');
      const navigateByUrl = vi.spyOn(router, 'navigateByUrl');
      const urlBefore = router.url;

      component.statusFilter.setValue('active');
      httpMock
        .expectOne(
          (request) => request.url === SHELVES_URL && request.params.get('is_active') === 'true',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      httpMock
        .expectOne((request) => request.url === SHELVES_URL && request.params.get('page') === '2')
        .flush(pageResponse([shelfDto({ id: 99 })]));
      fixture.detectChanges();

      component.onSort({ active: 'name', direction: 'desc' } as Sort);
      httpMock
        .expectOne(
          (request) => request.url === SHELVES_URL && request.params.get('sort') === '-name',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      // Filtrar solo emite `GET /v1/shelves`: la URL no cambia y no hay
      // navegación (el componente no conoce al router ni toca el shell).
      expect(router.url).toBe(urlBefore);
      expect(navigate).not.toHaveBeenCalled();
      expect(navigateByUrl).not.toHaveBeenCalled();
      httpMock.expectNone((request) => request.url !== SHELVES_URL);
    });
  });

  describe('búsqueda, filtros y paginación: un GET por gesto (S1)', () => {
    it('escribir N caracteres con intervalos <300 ms emite una sola GET con el search final', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      vi.useFakeTimers();
      component.search.setValue('e');
      vi.advanceTimersByTime(100);
      component.search.setValue('es');
      vi.advanceTimersByTime(100);
      component.search.setValue('est');
      httpMock.expectNone(
        (request) => request.url === SHELVES_URL && request.params.get('search') === 'est',
      );

      vi.advanceTimersByTime(300);

      const req = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.params.get('search') === 'est',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(component.pageIndex()).toBe(0);
      req.flush(pageResponse([]));
      fixture.detectChanges();

      httpMock.expectNone((request) => request.url === SHELVES_URL && request.method === 'GET');
    });

    it('repetir el mismo término no reemite GET (distinctUntilChanged)', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      vi.useFakeTimers();
      component.search.setValue('est');
      vi.advanceTimersByTime(300);
      httpMock
        .expectOne(
          (request) => request.url === SHELVES_URL && request.params.get('search') === 'est',
        )
        .flush(pageResponse([]));

      component.search.setValue('est');
      vi.advanceTimersByTime(300);

      httpMock.expectNone((request) => request.url === SHELVES_URL);
    });

    it('el filtro de estado emite is_active y resetea a la primera página', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      component.onPage({ pageIndex: 2, pageSize: 20, length: 60 } as PageEvent);
      flushList([shelfDto()]);
      expect(component.pageIndex()).toBe(2);

      component.statusFilter.setValue('inactive');

      const req = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.params.get('is_active') === 'false',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(component.pageIndex()).toBe(0);
      req.flush(pageResponse([]));
    });

    it('el filtro «Activos» emite is_active=true', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      component.statusFilter.setValue('active');

      const req = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.params.get('is_active') === 'true',
      );
      expect(req.request.params.get('page')).toBe('1');
      req.flush(pageResponse([shelfDto()]));
    });

    it('el orden por nombre emite sort=-name y resetea a la primera página', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      component.onSort({ active: 'name', direction: 'desc' } as Sort);

      const req = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.params.get('sort') === '-name',
      );
      expect(req.request.params.get('page')).toBe('1');
      req.flush(pageResponse([]));
    });

    it('el orden ascendente emite sort=name sin prefijo', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      component.onSort({ active: 'name', direction: 'asc' } as Sort);

      const req = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.params.get('sort') === 'name',
      );
      req.flush(pageResponse([]));
    });

    it('cambiar de página emite page+1 del servidor y el total del servidor gobierna el paginador', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);

      const req = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.params.get('page') === '2',
      );
      req.flush({ items: [shelfDto({ id: 99 })], total: 45, page: 2, size: 20, pages: 3 });
      fixture.detectChanges();

      expect(component.total()).toBe(45);
      expect(component.items()[0].id).toBe(99);
      const paginator = fixture.debugElement.query(By.directive(MatPaginator))
        .componentInstance as MatPaginator;
      expect(paginator.length).toBe(45);
    });

    it('cambiar el tamaño vuelve a la primera página (máximo 100, opciones 10/20/50)', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      const pageSizeOptions = (component as unknown as { pageSizeOptions: number[] })
        .pageSizeOptions;
      expect(pageSizeOptions).toEqual([10, 20, 50]);
      expect(Math.max(...pageSizeOptions)).toBeLessThanOrEqual(100);

      component.onPage({ pageIndex: 2, pageSize: 50, length: 45 } as PageEvent);

      const req = httpMock.expectOne((request) => request.url === SHELVES_URL);
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('50');
      req.flush(pageResponse([]));
    });
  });

  describe('permisos por rol (S7, PQ-02)', () => {
    it('con MEDICO no existe ningún control de escritura en el DOM (solo lectura)', () => {
      loginAs('MEDICO');
      fixture.detectChanges();
      flushList([shelfDto(), shelfDto({ id: 8, name: 'Estante B', is_active: false })]);

      const compiled = fixture.nativeElement as HTMLElement;
      // La tabla y las filas siguen visibles (consulta).
      expect(compiled.querySelector('table[aria-label="Ubicaciones"]')).not.toBeNull();
      expect(compiled.textContent).toContain('Estante A');
      // Cero controles de escritura en el DOM: no es solo deshabilitar.
      expect(compiled.querySelector('.dm-location-list__new')).toBeNull();
      expect(compiled.textContent).not.toContain('Nuevo estante');
      expect(compiled.textContent).not.toContain('Acciones');
      expect(compiled.querySelector('button[aria-label^="Editar"]')).toBeNull();
      expect(compiled.querySelector('button[aria-label^="Desactivar"]')).toBeNull();
      expect(compiled.querySelector('button[aria-label^="Activar"]')).toBeNull();
      // Búsqueda, filtro y paginador permanecen (consulta paginada, S1).
      expect(compiled.querySelector('.dm-location-list__search input')).not.toBeNull();
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
    });

    it('con ADMIN existen el botón de alta y la columna de acciones', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      const compiled = fixture.nativeElement as HTMLElement;
      const newButton = compiled.querySelector('.dm-location-list__new');
      expect(newButton?.textContent).toContain('Nuevo estante');
      expect(compiled.textContent).toContain('Acciones');
      expect(compiled.querySelector('button[aria-label="Editar Estante A"]')).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Desactivar Estante A"]')).not.toBeNull();
    });
  });

  describe('flujos de escritura con toast (S2/S3/S4/S6)', () => {
    it('«saved» en creación muestra «Estante creado.» y recarga', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of('saved') });

      component.openCreate();

      expect(dialogStub.open).toHaveBeenCalledTimes(1);
      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({ data: { mode: 'create' } });
      expect(toastStub['showCreated']).toHaveBeenCalledTimes(1);
      flushList([shelfDto()]);
    });

    it('«saved» en edición muestra «Estante actualizado.» y recarga', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of('saved') });

      component.openEdit(component.items()[0]);

      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({
        data: { mode: 'edit', locationId: 7 },
      });
      expect(toastStub['showUpdated']).toHaveBeenCalledTimes(1);
      flushList([shelfDto()]);
    });

    it('desactivar confirmado emite DELETE y avisa «Ubicación desactivada.»', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      const req = httpMock.expectOne(`${SHELVES_URL}/7`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(toastStub['showDeactivated']).toHaveBeenCalledTimes(1);
      flushList([]);
    });

    it('activar confirmado emite PUT de reemplazo del estante sin celdas y avisa', () => {
      fixture.detectChanges();
      flushList([shelfDto({ is_active: false })]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      const req = httpMock.expectOne(`${SHELVES_URL}/7`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Estante A',
        description: 'Pasillo principal',
        is_active: true,
      });
      // Las celdas ya no viajan en el body del estante: tienen su propio CRUD.
      expect(req.request.body).not.toHaveProperty('cells');
      req.flush(shelfDto());
      expect(toastStub['showActivated']).toHaveBeenCalledTimes(1);
      flushList([shelfDto()]);
    });

    it('la confirmación recibe el nombre del estante y el sentido correctos', () => {
      fixture.detectChanges();
      flushList([shelfDto({ is_active: false })]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(false) });

      component.confirmToggleActive(component.items()[0]);

      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({
        data: { name: 'Estante A', activate: true },
      });
      // Confirmación cancelada: ni DELETE ni PUT ni recarga.
      httpMock.expectNone(`${SHELVES_URL}/7`);
      expect(toastStub['showActivated']).not.toHaveBeenCalled();
    });

    it('fallo al desactivar avisa en toast sin recargar la lista', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      httpMock
        .expectOne(`${SHELVES_URL}/7`)
        .flush('denegado sintético', { status: 403, statusText: 'Forbidden' });

      expect(toastStub['showError']).toHaveBeenCalledTimes(1);
      expect(toastStub['showError'].mock.calls[0][0]).toContain('No tienes permiso');
      httpMock.expectNone((request) => request.url === SHELVES_URL && request.method === 'GET');
    });

    it('404 real de edición ({ notFound: true }) recarga y muestra el toast 404', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of({ notFound: true }) });

      component.openEdit(component.items()[0]);

      expect(toastStub['showError']).toHaveBeenCalledTimes(1);
      expect(toastStub['showError'].mock.calls[0][0]).toBe(
        'La ubicación solicitada ya no existe. Actualiza la lista.',
      );
      flushList([shelfDto()]);
      fixture.detectChanges();
    });
  });

  describe('cancelar no es 404 (S3)', () => {
    it.each([undefined, '', false])(
      'cerrar creación con %p no emite GET, no recarga ni avisa',
      (cancelValue) => {
        fixture.detectChanges();
        flushList([shelfDto()]);
        dialogStub.open.mockReturnValue({ afterClosed: () => of(cancelValue) });

        component.openCreate();

        httpMock.expectNone((request) => request.url === SHELVES_URL && request.method === 'GET');
        expect(toastStub['showCreated']).not.toHaveBeenCalled();
        expect(toastStub['showError']).not.toHaveBeenCalled();
        expect(component.items()).toHaveLength(1);
      },
    );

    it('cerrar edición con undefined no emite GET, no recarga ni avisa', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(undefined) });

      component.openEdit(component.items()[0]);

      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({
        data: { mode: 'edit', locationId: 7 },
      });
      httpMock.expectNone((request) => request.url === SHELVES_URL && request.method === 'GET');
      expect(toastStub['showUpdated']).not.toHaveBeenCalled();
      expect(toastStub['showError']).not.toHaveBeenCalled();
      expect(component.items()).toHaveLength(1);
    });

    it('los diálogos se abren sin disableClose: Escape y backdrop cierran (defecto de MatDialog)', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(undefined) });

      component.openCreate();
      component.openEdit(component.items()[0]);
      component.confirmToggleActive(component.items()[0]);

      for (const call of dialogStub.open.mock.calls) {
        expect(call[1]?.disableClose ?? false).toBe(false);
      }
    });
  });

  describe('accesibilidad (S6/S9)', () => {
    it('tabla etiquetada con cabeceras reales y acciones con nombre accesible', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('table[aria-label="Ubicaciones"]')).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Desactivar Estante A"]')).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Editar Estante A"]')).not.toBeNull();
      expect(compiled.querySelector('.dm-location-list__empty')).toBeNull();
    });

    it('el vacío expone role=status y la carga expone etiqueta accesible', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[aria-label="Cargando ubicaciones"]')).not.toBeNull();

      flushList([]);

      expect(
        (fixture.nativeElement as HTMLElement).querySelector(
          '.dm-location-list__empty[role="status"]',
        ),
      ).not.toBeNull();
    });

    it('el buscador tiene etiqueta accesible por nombre y el límite de 100 caracteres (S1/S9)', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      const input = searchInput();
      expect(input?.getAttribute('aria-label')).toBe('Buscar ubicaciones por nombre');
      expect(input?.getAttribute('maxlength')).toBe('100');
    });

    it('usa solo tokens --dm-*, sin hex literales ni ::ng-deep, con dm-focus-ring y scroll contenido (S9)', () => {
      fixture.detectChanges();
      flushList([shelfDto()]);

      const css = ownStyleText();

      expect(css).toContain('.dm-location-list');
      expect(css).toContain('var(--dm-');
      expect(css).toContain('--dm-focus-ring-width');
      expect(css).toContain('--dm-focus-ring-color');
      expect(css).not.toContain('::ng-deep');
      // Ningún color/valor literal: el hex `#1e5bb0` solo existe en los tokens.
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      // <768px: la tabla desborda en su contenedor, no en el documento.
      expect(css).toContain('overflow-x: auto');
    });
  });
});
