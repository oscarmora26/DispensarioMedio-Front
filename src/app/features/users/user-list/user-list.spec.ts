import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { UsersToast } from '../users-toast';
import { UserList } from './user-list';

const USERS_URL = `${environment.apiUrl}/v1/users`;
const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;

function userDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 12,
    username: 'aperez',
    email: 'aperez@example.test',
    role: 'MEDICO',
    doctor_id: 5,
    is_active: true,
    ...overrides,
  };
}

function pageResponse(items: Record<string, unknown>[]): Record<string, unknown> {
  return { items, total: items.length, page: 1, size: 20, pages: 1 };
}

function loginAsAdmin(): void {
  const auth = TestBed.inject(AuthService);
  const httpMock = TestBed.inject(HttpTestingController);
  auth.login({ email: 'admin.demo@example.test', password: 'Secreto-sintetico-1' }).subscribe();
  httpMock.expectOne(LOGIN_URL).flush({
    access_token: 'token-sintetico-de-prueba',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: 7,
      username: 'admin.demo',
      email: 'admin.demo@example.test',
      role: 'ADMIN',
      doctor_id: null,
    },
  });
}

function createToastStub(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    showUserCreated: vi.fn(),
    showUserUpdated: vi.fn(),
    showUserActivated: vi.fn(),
    showUserDeactivated: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
  };
}

describe('UserList (F-006 base + F-007 carga/toast/cancelar)', () => {
  let fixture: ComponentFixture<UserList>;
  let component: UserList;
  let httpMock: HttpTestingController;
  let dialogStub: { open: ReturnType<typeof vi.fn> };
  let toastStub: Record<string, ReturnType<typeof vi.fn>>;

  function flushList(items: Record<string, unknown>[]): void {
    httpMock
      .expectOne((request) => request.url === USERS_URL && request.method === 'GET')
      .flush(pageResponse(items));
    fixture.detectChanges();
  }

  function searchInput(): HTMLInputElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.dm-user-list__search input');
  }

  beforeEach(async () => {
    localStorage.clear();
    dialogStub = { open: vi.fn() };
    toastStub = createToastStub();
    await TestBed.configureTestingModule({
      imports: [UserList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: dialogStub },
        { provide: UsersToast, useValue: toastStub },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    loginAsAdmin();
    fixture = TestBed.createComponent(UserList);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.nativeElement?.remove?.();
    httpMock.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('listado base (F-006 CA-02, carga incremental F-007 CA-01)', () => {
    it('emite GET page=1&size=20 y muestra usuario/correo/rol/estado/acciones', () => {
      fixture.detectChanges();

      const req = httpMock.expectOne(
        (request) => request.url === USERS_URL && request.method === 'GET',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      req.flush(
        pageResponse([
          userDto(),
          userDto({
            id: 13,
            username: 'admin.demo',
            email: 'admin.demo@example.test',
            role: 'ADMIN',
            doctor_id: null,
          }),
        ]),
      );
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('table[aria-label="Usuarios"]')).not.toBeNull();
      expect(compiled.textContent).toContain('aperez');
      expect(compiled.textContent).toContain('Médico');
      expect(compiled.textContent).toContain('Administrador');
      expect(compiled.textContent).toContain('Activo');
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Editar aperez"]')).not.toBeNull();
    });

    it('durante la carga inicial el aria-busy vive en la región de la tabla, no en la sección', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(component.loading()).toBe(true);
      expect(compiled.querySelector('[aria-label="Cargando usuarios"]')).not.toBeNull();
      expect(compiled.querySelector('.dm-user-list__table-region')?.getAttribute('aria-busy')).toBe(
        'true',
      );
      expect(compiled.querySelector('section.dm-user-list')?.getAttribute('aria-busy')).toBeNull();

      flushList([]);
    });

    it('sin resultados muestra el vacío propio inline con role=status (CA-02/CA-03/PA-03)', () => {
      fixture.detectChanges();
      flushList([]);

      const compiled = fixture.nativeElement as HTMLElement;
      const empty = compiled.querySelector('.dm-user-list__empty');
      expect(empty?.textContent).toContain('No hay usuarios para mostrar.');
      expect(empty?.getAttribute('role')).toBe('status');
    });

    it('ante fallo con filas previas conserva las filas y avisa en toast sin inline (CA-04)', () => {
      fixture.detectChanges();
      flushList([userDto()]);
      expect(toastStub['showError']).not.toHaveBeenCalled();

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === USERS_URL && request.method === 'GET')
        .flush('caída sintética', { status: 500, statusText: 'Error' });
      fixture.detectChanges();

      expect(toastStub['showError']).toHaveBeenCalledTimes(1);
      expect(toastStub['showError'].mock.calls[0][0]).toContain('Ocurrió un error inesperado');
      // Filas anteriores conservadas: sin parpadeo a vacío ni a error inline.
      expect(component.items()).toHaveLength(1);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('aperez');
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.dm-user-list__empty'),
      ).toBeNull();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.dm-user-list__error'),
      ).toBeNull();
      expect(component.loading()).toBe(false);
    });

    it('ante fallo sin filas previas muestra el vacío y avisa en toast (CA-04)', () => {
      fixture.detectChanges();

      httpMock
        .expectOne((request) => request.url === USERS_URL && request.method === 'GET')
        .flush('caída sintética', { status: 0, statusText: 'Unknown Error' });
      fixture.detectChanges();

      expect(toastStub['showError']).toHaveBeenCalledTimes(1);
      expect(toastStub['showError'].mock.calls[0][0]).toContain('No se pudo conectar');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'No hay usuarios para mostrar.',
      );
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
    });
  });

  describe('carga sin parpadeo (F-007 CA-01)', () => {
    it('header, filtros y paginador permanecen montados durante la recarga con foco conservado', () => {
      fixture.detectChanges();
      flushList([userDto()]);
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
      expect(compiled.querySelector('.dm-user-list__header')).not.toBeNull();
      expect(compiled.querySelector('.dm-user-list__filters')).not.toBeNull();
      expect(searchInput()).not.toBeNull();
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
      // Filas anteriores visibles + spinner contenido: sin parpadeo del layout.
      expect(compiled.textContent).toContain('aperez');
      expect(compiled.querySelector('[aria-label="Cargando usuarios"]')).not.toBeNull();
      expect(compiled.querySelector('.dm-user-list__table-region')?.getAttribute('aria-busy')).toBe(
        'true',
      );
      expect(compiled.querySelector('section.dm-user-list')?.getAttribute('aria-busy')).toBeNull();
      // El foco sigue en el buscador: la recarga no lo roba.
      expect(document.activeElement).toBe(searchInput());

      httpMock
        .expectOne((request) => request.url === USERS_URL && request.params.get('page') === '2')
        .flush({
          items: [userDto({ id: 99, username: 'nuevo' })],
          total: 45,
          page: 2,
          size: 20,
          pages: 3,
        });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('nuevo');
      expect(component.loading()).toBe(false);
      expect(
        (fixture.nativeElement as HTMLElement)
          .querySelector('.dm-user-list__table-region')
          ?.getAttribute('aria-busy'),
      ).toBe('false');
      expect(document.activeElement).toBe(searchInput());
    });

    it('el buscador conserva el foco tras el debounce y la respuesta', () => {
      fixture.detectChanges();
      flushList([userDto()]);
      document.body.appendChild(fixture.nativeElement as HTMLElement);
      fixture.detectChanges();

      const input = searchInput();
      input?.focus();
      expect(document.activeElement).toBe(input);

      vi.useFakeTimers();
      component.search.setValue('ana');
      vi.advanceTimersByTime(300);

      const req = httpMock.expectOne(
        (request) => request.url === USERS_URL && request.params.get('search') === 'ana',
      );
      req.flush(pageResponse([]));
      fixture.detectChanges();

      expect(document.activeElement).toBe(searchInput());
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'No hay usuarios para mostrar.',
      );
    });
  });

  describe('búsqueda, filtros y paginación: un GET por gesto (F-007 CA-02)', () => {
    it('escribir N caracteres con intervalos <300 ms emite una sola GET con el search final', () => {
      fixture.detectChanges();
      flushList([userDto()]);

      vi.useFakeTimers();
      component.search.setValue('a');
      vi.advanceTimersByTime(100);
      component.search.setValue('an');
      vi.advanceTimersByTime(100);
      component.search.setValue('ana');
      httpMock.expectNone(
        (request) => request.url === USERS_URL && request.params.get('search') === 'ana',
      );

      vi.advanceTimersByTime(300);

      const req = httpMock.expectOne(
        (request) => request.url === USERS_URL && request.params.get('search') === 'ana',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(component.pageIndex()).toBe(0);
      req.flush(pageResponse([]));
      fixture.detectChanges();

      httpMock.expectNone((request) => request.url === USERS_URL && request.method === 'GET');
    });

    it('el filtro de estado emite is_active y resetea a la primera página', () => {
      fixture.detectChanges();
      flushList([userDto()]);
      component.onPage({ pageIndex: 2, pageSize: 20, length: 60 } as PageEvent);
      flushList([userDto()]);
      expect(component.pageIndex()).toBe(2);

      component.statusFilter.setValue('inactive');

      const req = httpMock.expectOne(
        (request) => request.url === USERS_URL && request.params.get('is_active') === 'false',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(component.pageIndex()).toBe(0);
      req.flush(pageResponse([]));
    });

    it('el orden emite sort con prefijo descendente y resetea a la primera página', () => {
      fixture.detectChanges();
      flushList([userDto()]);

      component.onSort({ active: 'email', direction: 'desc' } as Sort);

      const req = httpMock.expectOne(
        (request) => request.url === USERS_URL && request.params.get('sort') === '-email',
      );
      expect(req.request.params.get('page')).toBe('1');
      req.flush(pageResponse([]));
    });

    it('cambiar de página emite page+1 del servidor y muestra su total', () => {
      fixture.detectChanges();
      flushList([userDto()]);

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);

      const req = httpMock.expectOne(
        (request) => request.url === USERS_URL && request.params.get('page') === '2',
      );
      req.flush({ items: [userDto({ id: 99 })], total: 45, page: 2, size: 20, pages: 3 });
      fixture.detectChanges();

      expect(component.total()).toBe(45);
      expect(component.items()[0].id).toBe(99);
    });

    it('cambiar el tamaño vuelve a la primera página (máximo 100, opciones 10/20/50)', () => {
      fixture.detectChanges();
      flushList([userDto()]);

      const pageSizeOptions = (component as unknown as { pageSizeOptions: number[] })
        .pageSizeOptions;
      expect(pageSizeOptions).toEqual([10, 20, 50]);
      expect(Math.max(...pageSizeOptions)).toBeLessThanOrEqual(100);

      component.onPage({ pageIndex: 2, pageSize: 50, length: 45 } as PageEvent);

      const req = httpMock.expectOne((request) => request.url === USERS_URL);
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('50');
      req.flush(pageResponse([]));
    });
  });

  describe('éxitos y errores en toast (F-007 CA-03/CA-04)', () => {
    it('«saved» en creación muestra toast de éxito y recarga sin inline', () => {
      fixture.detectChanges();
      flushList([userDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of('saved') });

      component.openCreate();

      expect(dialogStub.open).toHaveBeenCalledTimes(1);
      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({ data: { mode: 'create' } });
      expect(toastStub['showUserCreated']).toHaveBeenCalledTimes(1);
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.dm-user-list__error'),
      ).toBeNull();
      flushList([userDto()]);
    });

    it('«saved» en edición muestra toast de éxito y recarga', () => {
      fixture.detectChanges();
      flushList([userDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of('saved') });

      component.openEdit(component.items()[0]);

      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({
        data: { mode: 'edit', userId: 12 },
      });
      expect(toastStub['showUserUpdated']).toHaveBeenCalledTimes(1);
      flushList([userDto()]);
    });

    it('desactivar confirmado emite DELETE y avisa en toast «desactivado»', () => {
      fixture.detectChanges();
      flushList([userDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      httpMock.expectOne(`${USERS_URL}/12`).flush(null);
      expect(toastStub['showUserDeactivated']).toHaveBeenCalledTimes(1);
      flushList([]);
    });

    it('activar confirmado emite PUT y avisa en toast «activado»', () => {
      fixture.detectChanges();
      flushList([userDto({ is_active: false })]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      const req = httpMock.expectOne(`${USERS_URL}/12`);
      expect(req.request.method).toBe('PUT');
      req.flush(userDto());
      expect(toastStub['showUserActivated']).toHaveBeenCalledTimes(1);
      flushList([userDto()]);
    });

    it('fallo al desactivar avisa en toast sin recargar la lista', () => {
      fixture.detectChanges();
      flushList([userDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(true) });

      component.confirmToggleActive(component.items()[0]);

      httpMock
        .expectOne(`${USERS_URL}/12`)
        .flush('denegado sintético', { status: 403, statusText: 'Forbidden' });

      expect(toastStub['showError']).toHaveBeenCalledTimes(1);
      expect(toastStub['showError'].mock.calls[0][0]).toContain('No tienes permiso');
      httpMock.expectNone((request) => request.url === USERS_URL && request.method === 'GET');
    });

    it('404 real de edición ({ notFound: true }) recarga y muestra el toast 404', () => {
      fixture.detectChanges();
      flushList([userDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of({ notFound: true }) });

      component.openEdit(component.items()[0]);

      expect(toastStub['showError']).toHaveBeenCalledTimes(1);
      expect(toastStub['showError'].mock.calls[0][0]).toBe(
        'El usuario solicitado ya no existe. Actualiza la lista.',
      );
      flushList([userDto()]);
      fixture.detectChanges();
    });
  });

  describe('sin restos inline de esos mensajes (F-007 CA-05)', () => {
    it('los literales de éxito/error no viven en user-list y solo el vacío usa role=status', () => {
      fixture.detectChanges();
      flushList([userDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of('saved') });
      component.openCreate();
      flushList([userDto()]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      for (const literal of [
        'Usuario creado.',
        'Usuario actualizado.',
        'Usuario activado.',
        'Usuario desactivado.',
      ]) {
        expect(compiled.textContent).not.toContain(literal);
      }
      expect(compiled.querySelector('.dm-user-list__error')).toBeNull();
      expect(compiled.querySelector('.dm-user-list__notice')).toBeNull();
      expect(compiled.querySelector('[role="alert"]')).toBeNull();
      // Señales inline eliminadas del componente (el toast es la única vía).
      expect('notice' in component).toBe(false);
      expect('error' in component).toBe(false);
    });
  });

  describe('cancelar no es 404 (F-007 CA-06)', () => {
    it.each([undefined, '', false])(
      'cerrar creación con %p no emite GET, no recarga ni avisa',
      (cancelValue) => {
        fixture.detectChanges();
        flushList([userDto()]);
        dialogStub.open.mockReturnValue({ afterClosed: () => of(cancelValue) });

        component.openCreate();

        httpMock.expectNone((request) => request.url === USERS_URL && request.method === 'GET');
        expect(toastStub['showUserCreated']).not.toHaveBeenCalled();
        expect(toastStub['showError']).not.toHaveBeenCalled();
        expect(component.items()).toHaveLength(1);
      },
    );

    it('cerrar edición con undefined no emite GET, no recarga ni avisa', () => {
      fixture.detectChanges();
      flushList([userDto()]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(undefined) });

      component.openEdit(component.items()[0]);

      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({
        data: { mode: 'edit', userId: 12 },
      });
      httpMock.expectNone((request) => request.url === USERS_URL && request.method === 'GET');
      expect(toastStub['showUserUpdated']).not.toHaveBeenCalled();
      expect(toastStub['showError']).not.toHaveBeenCalled();
      expect(component.items()).toHaveLength(1);
    });
  });

  describe('desactivar y reactivar (F-006 CA-08, sin regresión)', () => {
    it('impide la autodesactivación: botón deshabilitado con etiqueta accesible', () => {
      fixture.detectChanges();
      flushList([
        userDto({
          id: 7,
          username: 'admin.demo',
          email: 'admin.demo@example.test',
          role: 'ADMIN',
          doctor_id: null,
        }),
      ]);

      const compiled = fixture.nativeElement as HTMLElement;
      const selfButton = compiled.querySelector<HTMLButtonElement>(
        'button[aria-label^="No puedes desactivar tu propio usuario"]',
      );

      expect(selfButton).not.toBeNull();
      expect(selfButton?.disabled).toBe(true);
      expect(selfButton?.getAttribute('aria-label')).toBe(
        'No puedes desactivar tu propio usuario (admin.demo)',
      );
    });

    it('advierte el último ADMIN visible en los datos de confirmación (§7)', () => {
      fixture.detectChanges();
      flushList([
        userDto({
          id: 7,
          username: 'admin.demo',
          email: 'a@example.test',
          role: 'ADMIN',
          doctor_id: null,
        }),
      ]);
      dialogStub.open.mockReturnValue({ afterClosed: () => of(false) });

      const target = component.items()[0];
      component.confirmToggleActive(target);

      expect(dialogStub.open.mock.calls[0][1]).toMatchObject({
        data: { username: 'admin.demo', activate: false, isLastVisibleAdmin: true },
      });
    });
  });

  describe('accesibilidad (F-006 CA-13 + F-007 CA-07)', () => {
    it('tabla etiquetada con cabeceras reales, acciones con nombre y foco visible', () => {
      fixture.detectChanges();
      flushList([userDto()]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('table[aria-label="Usuarios"]')).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Desactivar aperez"]')).not.toBeNull();
      expect(compiled.querySelector('button[aria-label="Editar aperez"]')).not.toBeNull();
      expect(compiled.querySelector('.dm-user-list__empty')).toBeNull();
    });

    it('el vacío expone role=status y la carga expone etiqueta accesible', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[aria-label="Cargando usuarios"]')).not.toBeNull();

      flushList([]);

      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.dm-user-list__empty[role="status"]'),
      ).not.toBeNull();
    });
  });

  describe('shell estable al filtrar (F-008 CA-01/CA-02)', () => {
    it('header, filtros, región y paginador conservan identidad de nodo durante load()', () => {
      fixture.detectChanges();
      flushList([userDto()]);

      const compiled = fixture.nativeElement as HTMLElement;
      const header = compiled.querySelector('.dm-user-list__header');
      const filters = compiled.querySelector('.dm-user-list__filters');
      const region = compiled.querySelector('.dm-user-list__table-region');
      const paginator = compiled.querySelector('mat-paginator');

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      expect(compiled.querySelector('.dm-user-list__header')).toBe(header);
      expect(compiled.querySelector('.dm-user-list__filters')).toBe(filters);
      expect(compiled.querySelector('.dm-user-list__table-region')).toBe(region);
      expect(compiled.querySelector('mat-paginator')).toBe(paginator);

      httpMock
        .expectOne((request) => request.url === USERS_URL && request.params.get('page') === '2')
        .flush({
          items: [userDto({ id: 99, username: 'nuevo' })],
          total: 45,
          page: 2,
          size: 20,
          pages: 3,
        });
      fixture.detectChanges();

      expect(compiled.querySelector('.dm-user-list__header')).toBe(header);
      expect(compiled.querySelector('.dm-user-list__filters')).toBe(filters);
      expect(compiled.querySelector('.dm-user-list__table-region')).toBe(region);
      expect(compiled.querySelector('mat-paginator')).toBe(paginator);
    });

    it('la carga vive contenida en la región como overlay, con tabla y paginador montados', () => {
      fixture.detectChanges();
      flushList([userDto()]);

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const region = compiled.querySelector('.dm-user-list__table-region');
      const loading = compiled.querySelector('.dm-user-list__loading');

      expect(region).not.toBeNull();
      expect(loading).not.toBeNull();
      // El overlay está dentro de la región y no sustituye a la tabla.
      expect(region?.contains(loading)).toBe(true);
      expect(compiled.querySelector('table[aria-label="Usuarios"]')).not.toBeNull();
      expect(compiled.querySelector('mat-paginator')).not.toBeNull();
      expect(compiled.textContent).toContain('aperez');
      // El overlay flota sobre la región: sin altura en flujo ni robo de puntero.
      expect(loading ? getComputedStyle(loading).position : null).toBe('absolute');
      expect(loading ? getComputedStyle(loading).pointerEvents : null).toBe('none');
      expect(region ? getComputedStyle(region).position : null).toBe('relative');

      httpMock
        .expectOne((request) => request.url === USERS_URL && request.params.get('page') === '2')
        .flush(pageResponse([userDto({ id: 99 })]));
      fixture.detectChanges();

      expect(compiled.querySelector('.dm-user-list__loading')).toBeNull();
    });

    it('filtrar por estado mantiene el foco en el buscador y aria-busy solo en la región', () => {
      fixture.detectChanges();
      flushList([userDto()]);
      document.body.appendChild(fixture.nativeElement as HTMLElement);
      fixture.detectChanges();

      searchInput()?.focus();
      expect(document.activeElement).toBe(searchInput());

      component.statusFilter.setValue('inactive');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.dm-user-list__table-region')?.getAttribute('aria-busy')).toBe(
        'true',
      );
      expect(compiled.querySelector('section.dm-user-list')?.getAttribute('aria-busy')).toBeNull();
      expect(compiled.querySelector('.dm-user-list__loading')).not.toBeNull();
      expect(document.activeElement).toBe(searchInput());

      httpMock
        .expectOne(
          (request) => request.url === USERS_URL && request.params.get('is_active') === 'false',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      expect(document.activeElement).toBe(searchInput());
    });

    it('buscar/filtrar/paginar/ordenar no disparan navegación (F-008 CA-02)', () => {
      fixture.detectChanges();
      flushList([userDto()]);

      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate');
      const navigateByUrl = vi.spyOn(router, 'navigateByUrl');
      const urlBefore = router.url;

      component.statusFilter.setValue('active');
      httpMock
        .expectOne(
          (request) => request.url === USERS_URL && request.params.get('is_active') === 'true',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      component.onPage({ pageIndex: 1, pageSize: 20, length: 45 } as PageEvent);
      httpMock
        .expectOne((request) => request.url === USERS_URL && request.params.get('page') === '2')
        .flush(pageResponse([userDto({ id: 99 })]));
      fixture.detectChanges();

      component.onSort({ active: 'email', direction: 'desc' } as Sort);
      httpMock
        .expectOne(
          (request) => request.url === USERS_URL && request.params.get('sort') === '-email',
        )
        .flush(pageResponse([]));
      fixture.detectChanges();

      // Filtrar solo emite `GET /v1/users`: la URL no cambia y no hay
      // navegación (grep de `router.navigate`/`queryParams` en `user-list/` → 0).
      expect(router.url).toBe(urlBefore);
      expect(navigate).not.toHaveBeenCalled();
      expect(navigateByUrl).not.toHaveBeenCalled();
      httpMock.expectNone((request) => request.url !== USERS_URL);
    });
  });
});
