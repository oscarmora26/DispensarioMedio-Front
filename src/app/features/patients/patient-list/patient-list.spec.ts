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
import { PatientsToast } from '../patients-toast';
import { PatientList } from './patient-list';

const PATIENTS_URL = `${environment.apiUrl}/v1/patients`;
const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;

function patientDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 11,
    name: 'Ana Sintética',
    cedula: '12345678901',
    carnet: 'EST-001',
    patient_type: 'ESTUDIANTE',
    is_active: true,
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

describe('PatientList (F-013 S1-S12)', () => {
  let fixture: ComponentFixture<PatientList>;
  let component: PatientList;
  let httpMock: HttpTestingController;
  let dialogStub: { open: ReturnType<typeof vi.fn> };
  let toastStub: Record<string, ReturnType<typeof vi.fn>>;

  function flushList(items: Record<string, unknown>[]): void {
    httpMock
      .expectOne((request) => request.url === PATIENTS_URL && request.method === 'GET')
      .flush(pageResponse(items));
    fixture.detectChanges();
  }

  function searchInput(): HTMLInputElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.dm-patient-list__search input');
  }

  /** CSS compilado propio del listado (encapsulación emulada → `<style>`). */
  function ownStyleText(): string {
    return Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .filter((css) => css.includes('.dm-patient-list'))
      .join('\n');
  }

  beforeEach(async () => {
    localStorage.clear();
    dialogStub = { open: vi.fn() };
    toastStub = createToastStub();
    await TestBed.configureTestingModule({
      imports: [PatientList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: dialogStub },
        { provide: PatientsToast, useValue: toastStub },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    loginAs('ADMIN');
    fixture = TestBed.createComponent(PatientList);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.nativeElement?.remove?.();
    httpMock.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('listado base (S1/S9)', () => {
    it('emite GET page=1&size=20 y muestra nombre, cédula con máscara, carnet, tipo, estado y acciones', () => {
      fixture.detectChanges();

      const req = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.method === 'GET',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.has('is_active')).toBe(false);
      req.flush(
        pageResponse([
          patientDto(),
          patientDto({
            id: 12,
            name: 'Luis Sintético',
            cedula: '98765432109',
            carnet: null,
            patient_type: 'PROFESOR',
            is_active: false,
          }),
        ]),
      );
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('table[aria-label="Pacientes"]')).not.toBeNull();
      expect(compiled.textContent).toContain('Ana Sintética');
      // La cédula se muestra con la máscara 3-7-1 aunque el servidor la envíe cruda.
      expect(compiled.textContent).toContain('123-4567890-1');
      expect(compiled.textContent).toContain('987-6543210-9');
      expect(compiled.textContent).not.toContain('12345678901');
      expect(compiled.textContent).toContain('EST-001');
      expect(compiled.textContent).toContain('Estudiante');
      expect(compiled.textContent).toContain('Profesor');
      expect(compiled.textContent).toContain('Activo');
      expect(compiled.textContent).toContain('Inactivo');
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Editar Ana Sintética"]')).not.toBeNull();
      expect(
        compiled.querySelector('button[aria-label="Desactivar Ana Sintética"]'),
      ).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Activar Luis Sintético"]')).not.toBeNull();
    });

    it('un paciente sin carnet muestra un marcador en lugar de una celda vacía (S9)', () => {
      fixture.detectChanges();
      flushList([patientDto({ carnet: null })]);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('—');
    });

    it('durante la carga inicial el aria-busy vive en la región de la tabla, no en la sección (S12)', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(component.loading()).toBe(true);
      expect(compiled.querySelector('[aria-label="Cargando pacientes"]')).not.toBeNull();
      expect(
        compiled.querySelector('.dm-patient-list__table-region')?.getAttribute('aria-busy'),
      ).toBe('true');
      expect(
        compiled.querySelector('section.dm-patient-list')?.getAttribute('aria-busy'),
      ).toBeNull();

      flushList([]);
    });

    it('sin resultados muestra el vacío propio «No hay pacientes para mostrar.» con role=status (S9)', () => {
      fixture.detectChanges();
      flushList([]);

      const compiled = fixture.nativeElement as HTMLElement;
      const empty = compiled.querySelector('.dm-patient-list__empty');
      expect(empty?.textContent).toContain('No hay pacientes para mostrar.');
      expect(empty?.getAttribute('role')).toBe('status');
    });

    it('ante fallo con filas previas conserva las filas y anuncia el error inline sin toast (S12)', () => {
      fixture.detectChanges();
      flushList([patientDto()]);
      expect(toastStub['showError']).not.toHaveBeenCalled();

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === PATIENTS_URL && request.method === 'GET')
        .flush('caída sintética', { status: 500, statusText: 'Error' });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const region = compiled.querySelector('.dm-patient-list__table-region');

      expect(component.errorMessage()).toBe(
        'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
      );
      expect(component.loading()).toBe(false);
      expect(region?.getAttribute('aria-busy')).toBe('false');
      expect(component.items()).toHaveLength(1);
      expect(compiled.textContent).toContain('Ana Sintética');
      expect(compiled.querySelector('.dm-patient-list__empty')).toBeNull();
      expect(region?.querySelector('[role="alert"]')?.textContent).toContain(
        'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
      );
      expect(toastStub['showError']).not.toHaveBeenCalled();
    });

    it('ante fallo sin filas previas no muestra el vacío y sí el error inline, sin toast (S12)', () => {
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === PATIENTS_URL && request.method === 'GET')
        .flush('caída sintética', { status: 0, statusText: 'Unknown Error' });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(component.errorMessage()).toBe(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      );
      expect(component.loading()).toBe(false);
      expect(compiled.textContent).not.toContain('No hay pacientes para mostrar.');
      expect(compiled.querySelector('.dm-patient-list__empty')).toBeNull();
      expect(
        compiled.querySelector('.dm-patient-list__table-region [role="alert"]')?.textContent,
      ).toContain(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      );
      expect(toastStub['showError']).not.toHaveBeenCalled();
    });
  });

  describe('error de carga con reintento (S12)', () => {
    function failLoad(status = 500): void {
      httpMock
        .expectOne((request) => request.url === PATIENTS_URL && request.method === 'GET')
        .flush('caída sintética', { status, statusText: 'Error' });
      fixture.detectChanges();
    }

    it('el botón «Reintentar» tiene etiqueta accesible y se deshabilita mientras loading() es true', () => {
      fixture.detectChanges();
      failLoad();

      const compiled = fixture.nativeElement as HTMLElement;
      const retryButton = () =>
        compiled.querySelector(
          '.dm-patient-list__table-region button.dm-patient-list__retry',
        ) as HTMLButtonElement | null;

      expect(retryButton()).not.toBeNull();
      expect(retryButton()?.textContent?.trim()).toBe('Reintentar');
      expect(retryButton()?.getAttribute('aria-label')).toBe('Reintentar la carga de pacientes');
      expect(retryButton()?.disabled).toBe(false);

      component.loading.set(true);
      fixture.detectChanges();

      expect(retryButton()?.disabled).toBe(true);
    });

    it('reintentar reemite GET con los criterios vigentes, sin volver a página 1, y limpia el error al arrancar', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      component.onPage({ pageIndex: 0, pageSize: 10, length: 45 } as PageEvent);
      flushList([patientDto()]);
      component.onPage({ pageIndex: 1, pageSize: 10, length: 45 } as PageEvent);
      fixture.detectChanges();
      failLoad();

      expect(component.pageIndex()).toBe(1);
      expect(component.pageSize()).toBe(10);
      expect(component.errorMessage()).not.toBeNull();

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('.dm-patient-list__retry')
        ?.click();
      fixture.detectChanges();

      expect(component.errorMessage()).toBeNull();
      expect(component.loading()).toBe(true);
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();

      const req = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.method === 'GET',
      );
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('10');
      expect(component.pageIndex()).toBe(1);
      req.flush({
        items: [patientDto({ id: 99, name: 'Eva Sintética' })],
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
        .querySelector<HTMLButtonElement>('.dm-patient-list__retry')
        ?.click();
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === PATIENTS_URL && request.method === 'GET')
        .flush(pageResponse([patientDto({ id: 99, name: 'Eva Sintética' })]));
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(component.errorMessage()).toBeNull();
      expect(compiled.querySelector('[role="alert"]')).toBeNull();
      expect(compiled.querySelector('.dm-patient-list__empty')).toBeNull();
      expect(compiled.textContent).toContain('Eva Sintética');
      expect(compiled.querySelector('.dm-patient-list__loading')).toBeNull();
    });

    it('el fallo de carga produce un solo anuncio: un role=alert en la región y ningún toast', () => {
      fixture.detectChanges();
      failLoad();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelectorAll('[role="alert"]')).toHaveLength(1);
      expect(
        compiled.querySelector('.dm-patient-list__table-region [role="alert"]'),
      ).not.toBeNull();
      expect(toastStub['showError']).not.toHaveBeenCalled();
    });
  });

  describe('carga sin parpadeo (S12)', () => {
    it('header, filtros y paginador permanecen montados durante la recarga con foco conservado', () => {
      fixture.detectChanges();
      flushList([patientDto()]);
      document.body.appendChild(fixture.nativeElement as HTMLElement);
      fixture.detectChanges();

      const input = searchInput();
      expect(input).not.toBeNull();
      input?.focus();
      expect(document.activeElement).toBe(input);

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.dm-patient-list__header')).not.toBeNull();
      expect(compiled.querySelector('.dm-patient-list__filters')).not.toBeNull();
      expect(searchInput()).not.toBeNull();
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
      expect(compiled.textContent).toContain('Ana Sintética');
      expect(compiled.querySelector('[aria-label="Cargando pacientes"]')).not.toBeNull();
      expect(
        compiled.querySelector('.dm-patient-list__table-region')?.getAttribute('aria-busy'),
      ).toBe('true');
      expect(
        compiled.querySelector('section.dm-patient-list')?.getAttribute('aria-busy'),
      ).toBeNull();
      expect(document.activeElement).toBe(searchInput());

      httpMock
        .expectOne((request) => request.url === PATIENTS_URL && request.params.get('page') === '2')
        .flush({
          items: [patientDto({ id: 99, name: 'Eva Sintética' })],
          total: 45,
          page: 2,
          size: 20,
          pages: 3,
        });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Eva Sintética');
      expect(component.loading()).toBe(false);
      expect(
        (fixture.nativeElement as HTMLElement)
          .querySelector('.dm-patient-list__table-region')
          ?.getAttribute('aria-busy'),
      ).toBe('false');
      expect(document.activeElement).toBe(searchInput());
    });

    it('header, filtros, región y paginador conservan identidad de nodo durante load()', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      const compiled = fixture.nativeElement as HTMLElement;
      const header = compiled.querySelector('.dm-patient-list__header');
      const filters = compiled.querySelector('.dm-patient-list__filters');
      const region = compiled.querySelector('.dm-patient-list__table-region');
      const paginator = compiled.querySelector('mat-paginator');

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      expect(compiled.querySelector('.dm-patient-list__header')).toBe(header);
      expect(compiled.querySelector('.dm-patient-list__filters')).toBe(filters);
      expect(compiled.querySelector('.dm-patient-list__table-region')).toBe(region);
      expect(compiled.querySelector('mat-paginator')).toBe(paginator);

      httpMock
        .expectOne((request) => request.url === PATIENTS_URL && request.params.get('page') === '2')
        .flush({
          items: [patientDto({ id: 99 })],
          total: 45,
          page: 2,
          size: 20,
          pages: 3,
        });
      fixture.detectChanges();

      expect(compiled.querySelector('.dm-patient-list__header')).toBe(header);
      expect(compiled.querySelector('.dm-patient-list__filters')).toBe(filters);
      expect(compiled.querySelector('.dm-patient-list__table-region')).toBe(region);
      expect(compiled.querySelector('mat-paginator')).toBe(paginator);
    });

    it('la carga vive contenida en la región como overlay, con tabla y paginador montados', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const region = compiled.querySelector('.dm-patient-list__table-region');
      const loading = compiled.querySelector('.dm-patient-list__loading');

      expect(region).not.toBeNull();
      expect(loading).not.toBeNull();
      expect(region?.contains(loading)).toBe(true);
      expect(compiled.querySelector('table[aria-label="Pacientes"]')).not.toBeNull();
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
      expect(compiled.textContent).toContain('Ana Sintética');
      expect(loading ? getComputedStyle(loading).position : null).toBe('absolute');
      expect(loading ? getComputedStyle(loading).pointerEvents : null).toBe('none');
      expect(region ? getComputedStyle(region).position : null).toBe('relative');

      httpMock
        .expectOne((request) => request.url === PATIENTS_URL && request.params.get('page') === '2')
        .flush(pageResponse([patientDto({ id: 99 })]));
      fixture.detectChanges();

      expect(compiled.querySelector('.dm-patient-list__loading')).toBeNull();
    });

    it('el buscador conserva el foco tras el debounce y la respuesta', () => {
      fixture.detectChanges();
      flushList([patientDto()]);
      document.body.appendChild(fixture.nativeElement as HTMLElement);
      fixture.detectChanges();

      const input = searchInput();
      input?.focus();
      expect(document.activeElement).toBe(input);

      vi.useFakeTimers();
      component.search.setValue('ana');
      vi.advanceTimersByTime(300);

      const req = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.params.get('search') === 'ana',
      );
      req.flush(pageResponse([]));
      fixture.detectChanges();

      expect(document.activeElement).toBe(searchInput());
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'No hay pacientes para mostrar.',
      );
    });

    it('filtrar por estado mantiene el foco en el buscador y aria-busy solo en la región', () => {
      fixture.detectChanges();
      flushList([patientDto()]);
      document.body.appendChild(fixture.nativeElement as HTMLElement);
      fixture.detectChanges();

      searchInput()?.focus();
      expect(document.activeElement).toBe(searchInput());

      component.statusFilter.setValue('inactive');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(
        compiled.querySelector('.dm-patient-list__table-region')?.getAttribute('aria-busy'),
      ).toBe('true');
      expect(
        compiled.querySelector('section.dm-patient-list')?.getAttribute('aria-busy'),
      ).toBeNull();
      expect(compiled.querySelector('.dm-patient-list__loading')).not.toBeNull();
      expect(document.activeElement).toBe(searchInput());

      httpMock
        .expectOne(
          (request) => request.url === PATIENTS_URL && request.params.get('is_active') === 'false',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      expect(document.activeElement).toBe(searchInput());
    });

    it('buscar/filtrar/paginar/ordenar no disparan navegación (S12)', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate');
      const navigateByUrl = vi.spyOn(router, 'navigateByUrl');
      const urlBefore = router.url;

      component.statusFilter.setValue('active');
      httpMock
        .expectOne(
          (request) => request.url === PATIENTS_URL && request.params.get('is_active') === 'true',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      httpMock
        .expectOne((request) => request.url === PATIENTS_URL && request.params.get('page') === '2')
        .flush(pageResponse([patientDto({ id: 99 })]));
      fixture.detectChanges();

      component.onSort({ active: 'name', direction: 'desc' } as Sort);
      httpMock
        .expectOne(
          (request) => request.url === PATIENTS_URL && request.params.get('sort') === '-name',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      expect(router.url).toBe(urlBefore);
      expect(navigate).not.toHaveBeenCalled();
      expect(navigateByUrl).not.toHaveBeenCalled();
      httpMock.expectNone((request) => request.url !== PATIENTS_URL);
    });
  });

  describe('búsqueda, filtros y paginación: un GET por gesto (S1)', () => {
    it('escribir N caracteres con intervalos <300 ms emite una sola GET con el search final', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      vi.useFakeTimers();
      component.search.setValue('a');
      vi.advanceTimersByTime(100);
      component.search.setValue('an');
      vi.advanceTimersByTime(100);
      component.search.setValue('ana');
      httpMock.expectNone(
        (request) => request.url === PATIENTS_URL && request.params.get('search') === 'ana',
      );

      vi.advanceTimersByTime(300);

      const req = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.params.get('search') === 'ana',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(component.pageIndex()).toBe(0);
      req.flush(pageResponse([]));
      fixture.detectChanges();

      httpMock.expectNone((request) => request.url === PATIENTS_URL && request.method === 'GET');
    });

    it('el filtro de estado emite is_active y resetea a la primera página', () => {
      fixture.detectChanges();
      flushList([patientDto()]);
      component.onPage({ pageIndex: 2, pageSize: 20, length: 60 } as PageEvent);
      flushList([patientDto()]);
      expect(component.pageIndex()).toBe(2);

      component.statusFilter.setValue('inactive');

      const req = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.params.get('is_active') === 'false',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(component.pageIndex()).toBe(0);
      req.flush(pageResponse([]));
    });

    it('el filtro «Activos» emite is_active=true', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      component.statusFilter.setValue('active');

      const req = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.params.get('is_active') === 'true',
      );
      expect(req.request.params.get('page')).toBe('1');
      req.flush(pageResponse([patientDto()]));
    });

    it('el orden por nombre emite sort con prefijo descendente y resetea a la primera página', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      component.onSort({ active: 'name', direction: 'desc' } as Sort);

      const req = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.params.get('sort') === '-name',
      );
      expect(req.request.params.get('page')).toBe('1');
      req.flush(pageResponse([]));
    });

    it('el orden por cédula ascendente emite sort sin prefijo', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      component.onSort({ active: 'cedula', direction: 'asc' } as Sort);

      const req = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.params.get('sort') === 'cedula',
      );
      req.flush(pageResponse([]));
    });

    it('sin orden elegido no envía sort (el backend aplica su valor por defecto)', () => {
      fixture.detectChanges();

      const req = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.method === 'GET',
      );
      expect(req.request.params.has('sort')).toBe(false);
      req.flush(pageResponse([]));
    });

    it('cambiar de página emite page+1 del servidor y el total del servidor gobierna el paginador', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);

      const req = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.params.get('page') === '2',
      );
      req.flush({
        items: [patientDto({ id: 99 })],
        total: 45,
        page: 2,
        size: 20,
        pages: 3,
      });
      fixture.detectChanges();

      expect(component.total()).toBe(45);
      expect(component.items()[0].id).toBe(99);
      const paginator = fixture.debugElement.query(By.directive(MatPaginator))
        .componentInstance as MatPaginator;
      expect(paginator.length).toBe(45);
    });

    it('cambiar el tamaño vuelve a la primera página (máximo 100, opciones 10/20/50)', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      const pageSizeOptions = (component as unknown as { pageSizeOptions: number[] })
        .pageSizeOptions;
      expect(pageSizeOptions).toEqual([10, 20, 50]);
      expect(Math.max(...pageSizeOptions)).toBeLessThanOrEqual(100);

      component.onPage({ pageIndex: 2, pageSize: 50, length: 45 } as PageEvent);

      const req = httpMock.expectOne((request) => request.url === PATIENTS_URL);
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('50');
      req.flush(pageResponse([]));
    });
  });

  describe('permisos por rol (S10)', () => {
    it('con MEDICO no existe ningún control de escritura en el DOM (solo lectura)', () => {
      loginAs('MEDICO');
      fixture.detectChanges();
      flushList([
        patientDto(),
        patientDto({ id: 12, name: 'Luis Sintético', is_active: false, patient_type: 'OTROS' }),
      ]);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('table[aria-label="Pacientes"]')).not.toBeNull();
      expect(compiled.textContent).toContain('Ana Sintética');
      expect(compiled.querySelector('.dm-patient-list__new')).toBeNull();
      expect(compiled.textContent).not.toContain('Nuevo paciente');
      expect(compiled.textContent).not.toContain('Acciones');
      expect(compiled.querySelector('button[aria-label^="Editar"]')).toBeNull();
      expect(compiled.querySelector('button[aria-label^="Desactivar"]')).toBeNull();
      expect(compiled.querySelector('button[aria-label^="Activar"]')).toBeNull();
      // Consulta paginada intacta (S1).
      expect(compiled.querySelector('.dm-patient-list__search input')).not.toBeNull();
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
    });

    it('con ADMIN existen el botón de alta y la columna de acciones', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      const compiled = fixture.nativeElement as HTMLElement;
      const newButton = compiled.querySelector('.dm-patient-list__new');
      expect(newButton?.textContent).toContain('Nuevo paciente');
      expect(compiled.textContent).toContain('Acciones');
      expect(compiled.querySelector('button[aria-label="Editar Ana Sintética"]')).not.toBeNull();
      expect(
        compiled.querySelector('button[aria-label="Desactivar Ana Sintética"]'),
      ).not.toBeNull();
    });
  });

  describe('flujos de escritura con toast (S2/S6/S7)', () => {
    it('«saved» en creación muestra «Paciente creado.» y recarga', () => {
      fixture.detectChanges();
      flushList([patientDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of('saved') });

      component.openCreate();

      expect(dialogStub.open).toHaveBeenCalledTimes(1);
      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({ data: { mode: 'create' } });
      expect(toastStub['showCreated']).toHaveBeenCalledTimes(1);
      flushList([patientDto()]);
    });

    it('«saved» en edición muestra «Paciente actualizado.» y recarga', () => {
      fixture.detectChanges();
      flushList([patientDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of('saved') });

      component.openEdit(component.items()[0]);

      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({
        data: { mode: 'edit', patientId: 11 },
      });
      expect(toastStub['showUpdated']).toHaveBeenCalledTimes(1);
      flushList([patientDto()]);
    });

    it('desactivar confirmado emite DELETE y avisa «Paciente desactivado.»', () => {
      fixture.detectChanges();
      flushList([patientDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      const req = httpMock.expectOne(`${PATIENTS_URL}/11`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(toastStub['showDeactivated']).toHaveBeenCalledTimes(1);
      flushList([]);
    });

    it('activar confirmado emite PUT de reemplazo completo con is_active true y conserva el carnet', () => {
      fixture.detectChanges();
      flushList([patientDto({ is_active: false })]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      const req = httpMock.expectOne(`${PATIENTS_URL}/11`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Ana Sintética',
        cedula: '12345678901',
        patient_type: 'ESTUDIANTE',
        carnet: 'EST-001',
        is_active: true,
      });
      req.flush(patientDto());
      expect(toastStub['showActivated']).toHaveBeenCalledTimes(1);
      flushList([patientDto()]);
    });

    it('la confirmación recibe el nombre, la cédula y el sentido correctos', () => {
      fixture.detectChanges();
      flushList([patientDto({ is_active: false })]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(false) });

      component.confirmToggleActive(component.items()[0]);

      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({
        data: { name: 'Ana Sintética', cedula: '12345678901', activate: true },
      });
      httpMock.expectNone(`${PATIENTS_URL}/11`);
      expect(toastStub['showActivated']).not.toHaveBeenCalled();
    });

    it('fallo al desactivar avisa en toast sin recargar la lista', () => {
      fixture.detectChanges();
      flushList([patientDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      httpMock
        .expectOne(`${PATIENTS_URL}/11`)
        .flush('denegado sintético', { status: 403, statusText: 'Forbidden' });

      expect(toastStub['showError']).toHaveBeenCalledTimes(1);
      expect(toastStub['showError'].mock.calls[0][0]).toContain('No tienes permiso');
      httpMock.expectNone((request) => request.url === PATIENTS_URL && request.method === 'GET');
    });

    it('404 real de edición ({ notFound: true }) recarga y muestra el toast 404', () => {
      fixture.detectChanges();
      flushList([patientDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of({ notFound: true }) });

      component.openEdit(component.items()[0]);

      expect(toastStub['showError']).toHaveBeenCalledTimes(1);
      expect(toastStub['showError'].mock.calls[0][0]).toBe(
        'El paciente solicitado ya no existe. Actualiza la lista.',
      );
      flushList([patientDto()]);
      fixture.detectChanges();
    });
  });

  describe('cancelar no es 404 (S6)', () => {
    it.each([undefined, '', false])(
      'cerrar creación con %p no emite GET, no recarga ni avisa',
      (cancelValue) => {
        fixture.detectChanges();
        flushList([patientDto()]);
        dialogStub.open.mockReturnValue({ afterClosed: () => of(cancelValue) });

        component.openCreate();

        httpMock.expectNone((request) => request.url === PATIENTS_URL && request.method === 'GET');
        expect(toastStub['showCreated']).not.toHaveBeenCalled();
        expect(toastStub['showError']).not.toHaveBeenCalled();
        expect(component.items()).toHaveLength(1);
      },
    );

    it('cerrar edición con undefined no emite GET, no recarga ni avisa', () => {
      fixture.detectChanges();
      flushList([patientDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(undefined) });

      component.openEdit(component.items()[0]);

      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({
        data: { mode: 'edit', patientId: 11 },
      });
      httpMock.expectNone((request) => request.url === PATIENTS_URL && request.method === 'GET');
      expect(toastStub['showUpdated']).not.toHaveBeenCalled();
      expect(toastStub['showError']).not.toHaveBeenCalled();
      expect(component.items()).toHaveLength(1);
    });

    it('los diálogos se abren sin disableClose: Escape y backdrop cierran (defecto de MatDialog)', () => {
      fixture.detectChanges();
      flushList([patientDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(undefined) });

      component.openCreate();
      component.openEdit(component.items()[0]);
      component.confirmToggleActive(component.items()[0]);

      for (const call of dialogStub.open.mock.calls) {
        expect(call[1]?.disableClose ?? false).toBe(false);
      }
    });
  });

  describe('accesibilidad y diseño (S9/S11)', () => {
    it('tabla etiquetada con cabeceras reales y acciones con nombre accesible', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('table[aria-label="Pacientes"]')).not.toBeNull();
      expect(
        compiled.querySelector('button[aria-label="Desactivar Ana Sintética"]'),
      ).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Editar Ana Sintética"]')).not.toBeNull();
      expect(compiled.querySelector('.dm-patient-list__empty')).toBeNull();
    });

    it('el vacío expone role=status y la carga expone etiqueta accesible', () => {
      fixture.detectChanges();

      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[aria-label="Cargando pacientes"]'),
      ).not.toBeNull();

      flushList([]);

      expect(
        (fixture.nativeElement as HTMLElement).querySelector(
          '.dm-patient-list__empty[role="status"]',
        ),
      ).not.toBeNull();
    });

    it('el buscador tiene etiqueta accesible y el límite de 100 caracteres (S1/S9)', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      const input = searchInput();
      expect(input?.getAttribute('aria-label')).toBe(
        'Buscar pacientes por nombre, cédula o carnet',
      );
      expect(input?.getAttribute('maxlength')).toBe('100');
    });

    it('usa solo tokens --dm-*, sin hex literales ni ::ng-deep, con dm-focus-ring y scroll contenido (S11)', () => {
      fixture.detectChanges();
      flushList([patientDto()]);

      const css = ownStyleText();

      expect(css).toContain('.dm-patient-list');
      expect(css).toContain('var(--dm-');
      expect(css).toContain('--dm-focus-ring-width');
      expect(css).toContain('--dm-focus-ring-color');
      expect(css).not.toContain('::ng-deep');
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css).toContain('overflow-x: auto');
    });
  });
});
