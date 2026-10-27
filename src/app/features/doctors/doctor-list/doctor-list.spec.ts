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
import { DoctorList } from './doctor-list';
import { DoctorsToast } from '../doctors-toast';

const DOCTORS_URL = `${environment.apiUrl}/v1/doctors`;
const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;

function doctorDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 21,
    name: 'Dra. Sintética',
    cedula: '12345678901',
    lab_shift: 'MATUTINA',
    specialty: 'Medicina general',
    is_active: true,
    user: { id: 7, username: 'medico.demo', is_active: true },
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

describe('DoctorList (F-014 S1/S8/S10/S11/S12/S13)', () => {
  let fixture: ComponentFixture<DoctorList>;
  let component: DoctorList;
  let httpMock: HttpTestingController;
  let dialogStub: { open: ReturnType<typeof vi.fn> };
  let toastStub: Record<string, ReturnType<typeof vi.fn>>;

  function flushList(items: Record<string, unknown>[]): void {
    httpMock
      .expectOne((request) => request.url === DOCTORS_URL && request.method === 'GET')
      .flush(pageResponse(items));
    fixture.detectChanges();
  }

  function searchInput(): HTMLInputElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.dm-doctor-list__search input');
  }

  /** CSS compilado propio del listado (encapsulación emulada → `<style>`). */
  function ownStyleText(): string {
    return Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .filter((css) => css.includes('.dm-doctor-list'))
      .join('\n');
  }

  beforeEach(async () => {
    localStorage.clear();
    dialogStub = { open: vi.fn() };
    toastStub = createToastStub();
    await TestBed.configureTestingModule({
      imports: [DoctorList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: dialogStub },
        { provide: DoctorsToast, useValue: toastStub },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    loginAs('ADMIN');
    fixture = TestBed.createComponent(DoctorList);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.nativeElement?.remove?.();
    httpMock.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('listado base (S1/S10)', () => {
    it('emite GET page=1&size=20 y muestra nombre, cédula con máscara, tanda, especialidad, usuario, estado y acciones', () => {
      fixture.detectChanges();

      const req = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.method === 'GET',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.has('is_active')).toBe(false);
      expect(req.request.params.has('sort')).toBe(false);
      req.flush(
        pageResponse([
          doctorDto(),
          doctorDto({
            id: 22,
            name: 'Dr. Sintético',
            cedula: '98765432109',
            lab_shift: 'NOCTURNA',
            specialty: 'Pediatría',
            is_active: false,
            user: null,
          }),
        ]),
      );
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('table[aria-label="Médicos"]')).not.toBeNull();
      expect(compiled.textContent).toContain('Dra. Sintética');
      // La cédula se muestra con la máscara 3-7-1 aunque el servidor la envíe cruda.
      expect(compiled.textContent).toContain('123-4567890-1');
      expect(compiled.textContent).toContain('987-6543210-9');
      expect(compiled.textContent).not.toContain('12345678901');
      // La tanda se muestra capitalizada a partir del valor del contrato.
      expect(compiled.textContent).toContain('Matutina');
      expect(compiled.textContent).toContain('Nocturna');
      expect(compiled.textContent).toContain('Medicina general');
      expect(compiled.textContent).toContain('Pediatría');
      expect(compiled.textContent).toContain('Activo');
      expect(compiled.textContent).toContain('Inactivo');
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Editar Dra. Sintética"]')).not.toBeNull();
      expect(
        compiled.querySelector('button[aria-label="Desactivar Dra. Sintética"]'),
      ).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Activar Dr. Sintético"]')).not.toBeNull();
    });

    it('la columna «Usuario» es de solo lectura: muestra user.username o «Sin usuario» (S6)', () => {
      fixture.detectChanges();
      flushList([doctorDto(), doctorDto({ id: 22, name: 'Dr. Sintético', user: null })]);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Usuario');
      expect(compiled.textContent).toContain('medico.demo');
      expect(compiled.textContent).toContain('Sin usuario');
      // No hay ningún control que edite la asociación en el listado.
      expect(compiled.querySelector('.dm-doctor-list__user input')).toBeNull();
      expect(compiled.querySelector('.dm-doctor-list__user mat-select')).toBeNull();
    });

    it('una tanda no canónica se muestra con su valor almacenado (S4)', () => {
      fixture.detectChanges();
      flushList([doctorDto({ lab_shift: 'TARDE' })]);

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('TARDE');
    });

    it('durante la carga inicial el aria-busy vive en la región de la tabla, no en la sección (S13)', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(component.loading()).toBe(true);
      expect(compiled.querySelector('[aria-label="Cargando médicos"]')).not.toBeNull();
      expect(
        compiled.querySelector('.dm-doctor-list__table-region')?.getAttribute('aria-busy'),
      ).toBe('true');
      expect(
        compiled.querySelector('section.dm-doctor-list')?.getAttribute('aria-busy'),
      ).toBeNull();

      flushList([]);
    });

    it('sin resultados muestra el vacío propio «No hay médicos para mostrar.» con role=status (S10)', () => {
      fixture.detectChanges();
      flushList([]);

      const compiled = fixture.nativeElement as HTMLElement;
      const empty = compiled.querySelector('.dm-doctor-list__empty');
      expect(empty?.textContent).toContain('No hay médicos para mostrar.');
      expect(empty?.getAttribute('role')).toBe('status');
    });

    it('ante fallo con filas previas conserva las filas y anuncia el error inline sin toast (S13)', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      expect(toastStub['showError']).not.toHaveBeenCalled();

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === DOCTORS_URL && request.method === 'GET')
        .flush('caída sintética', { status: 500, statusText: 'Error' });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const region = compiled.querySelector('.dm-doctor-list__table-region');

      expect(component.errorMessage()).toBe(
        'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
      );
      expect(component.loading()).toBe(false);
      expect(region?.getAttribute('aria-busy')).toBe('false');
      expect(component.items()).toHaveLength(1);
      expect(compiled.textContent).toContain('Dra. Sintética');
      expect(compiled.querySelector('.dm-doctor-list__empty')).toBeNull();
      expect(region?.querySelector('[role="alert"]')?.textContent).toContain(
        'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
      );
      expect(toastStub['showError']).not.toHaveBeenCalled();
    });

    it('ante fallo sin filas previas no muestra el vacío y sí el error inline, sin toast (S13)', () => {
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === DOCTORS_URL && request.method === 'GET')
        .flush('caída sintética', { status: 0, statusText: 'Unknown Error' });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(component.errorMessage()).toBe(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      );
      expect(component.loading()).toBe(false);
      expect(compiled.querySelector('.dm-doctor-list__empty')).toBeNull();
      expect(
        compiled.querySelector('.dm-doctor-list__table-region [role="alert"]')?.textContent,
      ).toContain(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      );
      expect(toastStub['showError']).not.toHaveBeenCalled();
    });
  });

  describe('error de carga con reintento (S13)', () => {
    function failLoad(status = 500): void {
      httpMock
        .expectOne((request) => request.url === DOCTORS_URL && request.method === 'GET')
        .flush('caída sintética', { status, statusText: 'Error' });
      fixture.detectChanges();
    }

    it('el botón «Reintentar» tiene etiqueta accesible y se deshabilita mientras loading() es true', () => {
      fixture.detectChanges();
      failLoad();

      const compiled = fixture.nativeElement as HTMLElement;
      const retryButton = () =>
        compiled.querySelector(
          '.dm-doctor-list__table-region button.dm-doctor-list__retry',
        ) as HTMLButtonElement | null;

      expect(retryButton()).not.toBeNull();
      expect(retryButton()?.textContent?.trim()).toBe('Reintentar');
      expect(retryButton()?.getAttribute('aria-label')).toBe('Reintentar la carga de médicos');
      expect(retryButton()?.disabled).toBe(false);

      component.loading.set(true);
      fixture.detectChanges();

      expect(retryButton()?.disabled).toBe(true);
    });

    it('reintentar reemite GET con los criterios vigentes, sin volver a página 1, y limpia el error al arrancar', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      component.onPage({ pageIndex: 0, pageSize: 10, length: 45 } as PageEvent);
      flushList([doctorDto()]);
      component.onPage({ pageIndex: 1, pageSize: 10, length: 45 } as PageEvent);
      fixture.detectChanges();
      failLoad();

      expect(component.pageIndex()).toBe(1);
      expect(component.pageSize()).toBe(10);
      expect(component.errorMessage()).not.toBeNull();

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('.dm-doctor-list__retry')
        ?.click();
      fixture.detectChanges();

      expect(component.errorMessage()).toBeNull();
      expect(component.loading()).toBe(true);
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();

      const req = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.method === 'GET',
      );
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('10');
      expect(component.pageIndex()).toBe(1);
      req.flush({
        items: [doctorDto({ id: 99, name: 'Dra. Nueva' })],
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
        .querySelector<HTMLButtonElement>('.dm-doctor-list__retry')
        ?.click();
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === DOCTORS_URL && request.method === 'GET')
        .flush(pageResponse([doctorDto({ id: 99, name: 'Dra. Nueva' })]));
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(component.errorMessage()).toBeNull();
      expect(compiled.querySelector('[role="alert"]')).toBeNull();
      expect(compiled.textContent).toContain('Dra. Nueva');
      expect(compiled.querySelector('.dm-doctor-list__loading')).toBeNull();
    });

    it('el fallo de carga produce un solo anuncio: un role=alert en la región y ningún toast', () => {
      fixture.detectChanges();
      failLoad();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelectorAll('[role="alert"]')).toHaveLength(1);
      expect(compiled.querySelector('.dm-doctor-list__table-region [role="alert"]')).not.toBeNull();
      expect(toastStub['showError']).not.toHaveBeenCalled();
    });
  });

  describe('carga sin parpadeo (S13)', () => {
    it('header, filtros y paginador permanecen montados durante la recarga con foco conservado', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      document.body.appendChild(fixture.nativeElement as HTMLElement);
      fixture.detectChanges();

      const input = searchInput();
      expect(input).not.toBeNull();
      input?.focus();
      expect(document.activeElement).toBe(input);

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.dm-doctor-list__header')).not.toBeNull();
      expect(compiled.querySelector('.dm-doctor-list__filters')).not.toBeNull();
      expect(searchInput()).not.toBeNull();
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
      expect(compiled.textContent).toContain('Dra. Sintética');
      expect(compiled.querySelector('[aria-label="Cargando médicos"]')).not.toBeNull();
      expect(
        compiled.querySelector('.dm-doctor-list__table-region')?.getAttribute('aria-busy'),
      ).toBe('true');
      expect(
        compiled.querySelector('section.dm-doctor-list')?.getAttribute('aria-busy'),
      ).toBeNull();
      expect(document.activeElement).toBe(searchInput());

      httpMock
        .expectOne((request) => request.url === DOCTORS_URL && request.params.get('page') === '2')
        .flush({
          items: [doctorDto({ id: 99, name: 'Dra. Nueva' })],
          total: 45,
          page: 2,
          size: 20,
          pages: 3,
        });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Dra. Nueva');
      expect(component.loading()).toBe(false);
      expect(document.activeElement).toBe(searchInput());
    });

    it('header, filtros, región y paginador conservan identidad de nodo durante load()', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      const compiled = fixture.nativeElement as HTMLElement;
      const header = compiled.querySelector('.dm-doctor-list__header');
      const filters = compiled.querySelector('.dm-doctor-list__filters');
      const region = compiled.querySelector('.dm-doctor-list__table-region');
      const paginator = compiled.querySelector('mat-paginator');

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      expect(compiled.querySelector('.dm-doctor-list__header')).toBe(header);
      expect(compiled.querySelector('.dm-doctor-list__filters')).toBe(filters);
      expect(compiled.querySelector('.dm-doctor-list__table-region')).toBe(region);
      expect(compiled.querySelector('mat-paginator')).toBe(paginator);

      httpMock
        .expectOne((request) => request.url === DOCTORS_URL && request.params.get('page') === '2')
        .flush({ items: [doctorDto({ id: 99 })], total: 45, page: 2, size: 20, pages: 3 });
      fixture.detectChanges();

      expect(compiled.querySelector('.dm-doctor-list__header')).toBe(header);
      expect(compiled.querySelector('.dm-doctor-list__filters')).toBe(filters);
      expect(compiled.querySelector('.dm-doctor-list__table-region')).toBe(region);
      expect(compiled.querySelector('mat-paginator')).toBe(paginator);
    });

    it('la carga vive contenida en la región como overlay, con tabla y paginador montados', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const region = compiled.querySelector('.dm-doctor-list__table-region');
      const loading = compiled.querySelector('.dm-doctor-list__loading');

      expect(region).not.toBeNull();
      expect(loading).not.toBeNull();
      expect(region?.contains(loading)).toBe(true);
      expect(compiled.querySelector('table[aria-label="Médicos"]')).not.toBeNull();
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
      expect(compiled.textContent).toContain('Dra. Sintética');
      expect(loading ? getComputedStyle(loading).position : null).toBe('absolute');
      expect(loading ? getComputedStyle(loading).pointerEvents : null).toBe('none');
      expect(region ? getComputedStyle(region).position : null).toBe('relative');

      httpMock
        .expectOne((request) => request.url === DOCTORS_URL && request.params.get('page') === '2')
        .flush(pageResponse([doctorDto({ id: 99 })]));
      fixture.detectChanges();

      expect(compiled.querySelector('.dm-doctor-list__loading')).toBeNull();
    });

    it('el buscador conserva el foco tras el debounce y la respuesta', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      document.body.appendChild(fixture.nativeElement as HTMLElement);
      fixture.detectChanges();

      const input = searchInput();
      input?.focus();
      expect(document.activeElement).toBe(input);

      vi.useFakeTimers();
      component.search.setValue('sintética');
      vi.advanceTimersByTime(300);

      const req = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.params.get('search') === 'sintética',
      );
      req.flush(pageResponse([]));
      fixture.detectChanges();

      expect(document.activeElement).toBe(searchInput());
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'No hay médicos para mostrar.',
      );
    });

    it('filtrar por estado mantiene el foco en el buscador y aria-busy solo en la región', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      document.body.appendChild(fixture.nativeElement as HTMLElement);
      fixture.detectChanges();

      searchInput()?.focus();
      expect(document.activeElement).toBe(searchInput());

      component.statusFilter.setValue('inactive');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(
        compiled.querySelector('.dm-doctor-list__table-region')?.getAttribute('aria-busy'),
      ).toBe('true');
      expect(
        compiled.querySelector('section.dm-doctor-list')?.getAttribute('aria-busy'),
      ).toBeNull();
      expect(compiled.querySelector('.dm-doctor-list__loading')).not.toBeNull();
      expect(document.activeElement).toBe(searchInput());

      httpMock
        .expectOne(
          (request) => request.url === DOCTORS_URL && request.params.get('is_active') === 'false',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      expect(document.activeElement).toBe(searchInput());
    });

    it('buscar/filtrar/paginar/ordenar no disparan navegación (S13)', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate');
      const navigateByUrl = vi.spyOn(router, 'navigateByUrl');
      const urlBefore = router.url;

      component.statusFilter.setValue('active');
      httpMock
        .expectOne(
          (request) => request.url === DOCTORS_URL && request.params.get('is_active') === 'true',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      httpMock
        .expectOne((request) => request.url === DOCTORS_URL && request.params.get('page') === '2')
        .flush(pageResponse([doctorDto({ id: 99 })]));
      fixture.detectChanges();

      component.onSort({ active: 'name', direction: 'desc' } as Sort);
      httpMock
        .expectOne(
          (request) => request.url === DOCTORS_URL && request.params.get('sort') === '-name',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      expect(router.url).toBe(urlBefore);
      expect(navigate).not.toHaveBeenCalled();
      expect(navigateByUrl).not.toHaveBeenCalled();
      httpMock.expectNone((request) => request.url !== DOCTORS_URL);
    });
  });

  describe('búsqueda, filtros, orden y paginación: un GET por gesto (S1)', () => {
    it('escribir N caracteres con intervalos <300 ms emite una sola GET con el search final', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      vi.useFakeTimers();
      component.search.setValue('s');
      vi.advanceTimersByTime(100);
      component.search.setValue('si');
      vi.advanceTimersByTime(100);
      component.search.setValue('sin');
      httpMock.expectNone(
        (request) => request.url === DOCTORS_URL && request.params.get('search') === 'sin',
      );

      vi.advanceTimersByTime(300);

      const req = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.params.get('search') === 'sin',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(component.pageIndex()).toBe(0);
      req.flush(pageResponse([]));
      fixture.detectChanges();

      httpMock.expectNone((request) => request.url === DOCTORS_URL && request.method === 'GET');
    });

    it('repetir el mismo término no emite una segunda GET (distinctUntilChanged)', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      vi.useFakeTimers();
      component.search.setValue('dra');
      vi.advanceTimersByTime(300);
      httpMock
        .expectOne(
          (request) => request.url === DOCTORS_URL && request.params.get('search') === 'dra',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      component.search.setValue('dra');
      vi.advanceTimersByTime(300);

      httpMock.expectNone((request) => request.url === DOCTORS_URL && request.method === 'GET');
    });

    it('el filtro de estado emite is_active y resetea a la primera página', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      component.onPage({ pageIndex: 2, pageSize: 20, length: 60 } as PageEvent);
      flushList([doctorDto()]);
      expect(component.pageIndex()).toBe(2);

      component.statusFilter.setValue('inactive');

      const req = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.params.get('is_active') === 'false',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(component.pageIndex()).toBe(0);
      req.flush(pageResponse([]));
    });

    it('el filtro «Activos» emite is_active=true', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      component.statusFilter.setValue('active');

      const req = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.params.get('is_active') === 'true',
      );
      expect(req.request.params.get('page')).toBe('1');
      req.flush(pageResponse([doctorDto()]));
    });

    it.each([
      ['name', 'desc', '-name'],
      ['cedula', 'asc', 'cedula'],
      ['lab_shift', 'asc', 'lab_shift'],
      ['specialty', 'desc', '-specialty'],
      ['is_active', 'asc', 'is_active'],
    ])(
      'el orden por %s (%s) emite sort=%s y resetea a la primera página',
      (active, direction, expected) => {
        fixture.detectChanges();
        flushList([doctorDto()]);
        component.onPage({ pageIndex: 1, pageSize: 20, length: 60 } as PageEvent);
        flushList([doctorDto()]);

        component.onSort({ active, direction } as Sort);

        const req = httpMock.expectOne(
          (request) => request.url === DOCTORS_URL && request.params.get('sort') === expected,
        );
        expect(req.request.params.get('page')).toBe('1');
        expect(component.pageIndex()).toBe(0);
        req.flush(pageResponse([]));
      },
    );

    it('sin orden elegido no envía sort (el backend aplica su valor por defecto)', () => {
      fixture.detectChanges();

      const req = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.method === 'GET',
      );
      expect(req.request.params.has('sort')).toBe(false);
      req.flush(pageResponse([]));
    });

    it('cambiar de página emite page+1 del servidor y el total del servidor gobierna el paginador', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);

      const req = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.params.get('page') === '2',
      );
      req.flush({ items: [doctorDto({ id: 99 })], total: 45, page: 2, size: 20, pages: 3 });
      fixture.detectChanges();

      expect(component.total()).toBe(45);
      expect(component.items()[0].id).toBe(99);
      const paginator = fixture.debugElement.query(By.directive(MatPaginator))
        .componentInstance as MatPaginator;
      expect(paginator.length).toBe(45);
    });

    it('cambiar el tamaño vuelve a la primera página (máximo 100, opciones 10/20/50)', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      const pageSizeOptions = (component as unknown as { pageSizeOptions: number[] })
        .pageSizeOptions;
      expect(pageSizeOptions).toEqual([10, 20, 50]);
      expect(Math.max(...pageSizeOptions)).toBeLessThanOrEqual(100);

      component.onPage({ pageIndex: 2, pageSize: 50, length: 45 } as PageEvent);

      const req = httpMock.expectOne((request) => request.url === DOCTORS_URL);
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('50');
      req.flush(pageResponse([]));
    });
  });

  describe('permisos por rol (S11)', () => {
    it('con MEDICO no existe ningún control de escritura en el DOM (solo lectura)', () => {
      loginAs('MEDICO');
      fixture.detectChanges();
      flushList([
        doctorDto(),
        doctorDto({ id: 22, name: 'Dr. Sintético', is_active: false, user: null }),
      ]);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('table[aria-label="Médicos"]')).not.toBeNull();
      expect(compiled.textContent).toContain('Dra. Sintética');
      expect(compiled.textContent).toContain('Sin usuario');
      expect(compiled.querySelector('.dm-doctor-list__new')).toBeNull();
      expect(compiled.textContent).not.toContain('Nuevo médico');
      expect(compiled.textContent).not.toContain('Acciones');
      expect(compiled.querySelector('button[aria-label^="Editar"]')).toBeNull();
      expect(compiled.querySelector('button[aria-label^="Desactivar"]')).toBeNull();
      expect(compiled.querySelector('button[aria-label^="Activar"]')).toBeNull();
      // Consulta paginada intacta (S1).
      expect(compiled.querySelector('.dm-doctor-list__search input')).not.toBeNull();
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
    });

    it('con ADMIN existen el botón de alta y la columna de acciones', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      const compiled = fixture.nativeElement as HTMLElement;
      const newButton = compiled.querySelector('.dm-doctor-list__new');
      expect(newButton?.textContent).toContain('Nuevo médico');
      expect(compiled.textContent).toContain('Acciones');
      expect(compiled.querySelector('button[aria-label="Editar Dra. Sintética"]')).not.toBeNull();
      expect(
        compiled.querySelector('button[aria-label="Desactivar Dra. Sintética"]'),
      ).not.toBeNull();
    });
  });

  describe('flujos de escritura con toast (S2/S7/S8)', () => {
    it('«saved» en creación muestra «Médico creado.» y recarga', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of('saved') });

      component.openCreate();

      expect(dialogStub.open).toHaveBeenCalledTimes(1);
      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({ data: { mode: 'create' } });
      expect(toastStub['showCreated']).toHaveBeenCalledTimes(1);
      flushList([doctorDto()]);
    });

    it('«saved» en edición muestra «Médico actualizado.» y recarga', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of('saved') });

      component.openEdit(component.items()[0]);

      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({
        data: { mode: 'edit', doctorId: 21 },
      });
      expect(toastStub['showUpdated']).toHaveBeenCalledTimes(1);
      flushList([doctorDto()]);
    });

    it('desactivar confirmado emite DELETE y avisa «Médico desactivado.»', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      const req = httpMock.expectOne(`${DOCTORS_URL}/21`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(toastStub['showDeactivated']).toHaveBeenCalledTimes(1);
      flushList([]);
    });

    it('activar confirmado emite PUT de reemplazo completo con is_active true y conserva tanda y especialidad', () => {
      fixture.detectChanges();
      flushList([doctorDto({ is_active: false, lab_shift: 'TARDE', specialty: 'Pediatría' })]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      const req = httpMock.expectOne(`${DOCTORS_URL}/21`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Dra. Sintética',
        cedula: '12345678901',
        lab_shift: 'TARDE',
        specialty: 'Pediatría',
        is_active: true,
      });
      expect(req.request.body).not.toHaveProperty('user');
      req.flush(doctorDto());
      expect(toastStub['showActivated']).toHaveBeenCalledTimes(1);
      flushList([doctorDto()]);
    });

    it('la confirmación recibe el nombre, la cédula y el sentido correctos', () => {
      fixture.detectChanges();
      flushList([doctorDto({ is_active: false })]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(false) });

      component.confirmToggleActive(component.items()[0]);

      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({
        data: { name: 'Dra. Sintética', cedula: '12345678901', activate: true },
      });
      httpMock.expectNone(`${DOCTORS_URL}/21`);
      expect(toastStub['showActivated']).not.toHaveBeenCalled();
    });

    it('el 409 doctor_has_visits se anuncia con el mensaje propio de visitas (S8)', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      httpMock
        .expectOne(`${DOCTORS_URL}/21`)
        .flush(
          { detail: 'RAW-DETAIL-LEAK', code: 'doctor_has_visits', errors: [] },
          { status: 409, statusText: 'Conflict' },
        );

      expect(toastStub['showError']).toHaveBeenCalledTimes(1);
      expect(toastStub['showError'].mock.calls[0][0]).toBe(
        'No se puede desactivar el médico porque tiene visitas registradas.',
      );
      expect(JSON.stringify(toastStub['showError'].mock.calls)).not.toContain('RAW-DETAIL-LEAK');
      // La lista no recarga: el médico sigue activo.
      httpMock.expectNone((request) => request.url === DOCTORS_URL && request.method === 'GET');
      expect(component.items()[0].isActive).toBe(true);
    });

    it('fallo al desactivar por permisos avisa en toast sin recargar la lista', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      httpMock
        .expectOne(`${DOCTORS_URL}/21`)
        .flush('denegado sintético', { status: 403, statusText: 'Forbidden' });

      expect(toastStub['showError']).toHaveBeenCalledTimes(1);
      expect(toastStub['showError'].mock.calls[0][0]).toContain('No tienes permiso');
      httpMock.expectNone((request) => request.url === DOCTORS_URL && request.method === 'GET');
    });

    it('404 real de edición ({ notFound: true }) recarga y muestra el toast 404', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of({ notFound: true }) });

      component.openEdit(component.items()[0]);

      expect(toastStub['showError']).toHaveBeenCalledTimes(1);
      expect(toastStub['showError'].mock.calls[0][0]).toBe(
        'El médico solicitado ya no existe. Actualiza la lista.',
      );
      flushList([doctorDto()]);
      fixture.detectChanges();
    });
  });

  describe('cancelar no es 404 (S7)', () => {
    it.each([undefined, '', false])(
      'cerrar creación con %p no emite GET, no recarga ni avisa',
      (cancelValue) => {
        fixture.detectChanges();
        flushList([doctorDto()]);
        dialogStub.open.mockReturnValue({ afterClosed: () => of(cancelValue) });

        component.openCreate();

        httpMock.expectNone((request) => request.url === DOCTORS_URL && request.method === 'GET');
        expect(toastStub['showCreated']).not.toHaveBeenCalled();
        expect(toastStub['showError']).not.toHaveBeenCalled();
        expect(component.items()).toHaveLength(1);
      },
    );

    it('cerrar edición con undefined no emite GET, no recarga ni avisa', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(undefined) });

      component.openEdit(component.items()[0]);

      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({
        data: { mode: 'edit', doctorId: 21 },
      });
      httpMock.expectNone((request) => request.url === DOCTORS_URL && request.method === 'GET');
      expect(toastStub['showUpdated']).not.toHaveBeenCalled();
      expect(toastStub['showError']).not.toHaveBeenCalled();
      expect(component.items()).toHaveLength(1);
    });

    it('los diálogos se abren sin disableClose: Escape y backdrop cierran (defecto de MatDialog)', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(undefined) });

      component.openCreate();
      component.openEdit(component.items()[0]);
      component.confirmToggleActive(component.items()[0]);

      for (const call of dialogStub.open.mock.calls) {
        expect(call[1]?.disableClose ?? false).toBe(false);
      }
    });
  });

  describe('accesibilidad y diseño (S10/S12)', () => {
    it('tabla etiquetada con cabeceras reales y acciones con nombre accesible', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('table[aria-label="Médicos"]')).not.toBeNull();
      expect(
        compiled.querySelector('button[aria-label="Desactivar Dra. Sintética"]'),
      ).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Editar Dra. Sintética"]')).not.toBeNull();
    });

    it('el vacío expone role=status y la carga expone etiqueta accesible', () => {
      fixture.detectChanges();

      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[aria-label="Cargando médicos"]'),
      ).not.toBeNull();

      flushList([]);

      expect(
        (fixture.nativeElement as HTMLElement).querySelector(
          '.dm-doctor-list__empty[role="status"]',
        ),
      ).not.toBeNull();
    });

    it('el buscador tiene etiqueta accesible y el límite de 100 caracteres (S1)', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      const input = searchInput();
      expect(input?.getAttribute('aria-label')).toBe('Buscar médicos por nombre o cédula');
      expect(input?.getAttribute('maxlength')).toBe('100');
    });

    it('usa solo tokens --dm-*, sin hex literales ni ::ng-deep, con dm-focus-ring y scroll contenido (S12)', () => {
      fixture.detectChanges();
      flushList([doctorDto()]);

      const css = ownStyleText();

      expect(css).toContain('.dm-doctor-list');
      expect(css).toContain('var(--dm-');
      expect(css).toContain('--dm-focus-ring-width');
      expect(css).toContain('--dm-focus-ring-color');
      expect(css).not.toContain('::ng-deep');
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css).toContain('overflow-x: auto');
    });
  });
});
