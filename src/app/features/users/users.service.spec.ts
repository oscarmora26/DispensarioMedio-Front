import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ManagedUser } from './users.models';
import { UsersService } from './users.service';

const USERS_URL = `${environment.apiUrl}/v1/users`;

/** Respuesta paginada sintética del servidor (`{items, total, page, size, pages}`). */
function pageResponse(items: Record<string, unknown>[] = []): Record<string, unknown> {
  return { items, total: items.length, page: 1, size: 20, pages: 1 };
}

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

describe('UsersService (F-006)', () => {
  let service: UsersService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(UsersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  describe('list (CA-02/CA-03/CA-04)', () => {
    it('emite GET con page=1&size=20 por defecto y mapea snake_case a camelCase', () => {
      let result: unknown;
      service.list({ page: 1, size: 20 }).subscribe((page) => {
        result = page;
      });

      const req = httpMock.expectOne(
        (request) => request.url === USERS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.has('is_active')).toBe(false);
      expect(req.request.params.has('sort')).toBe(false);

      req.flush(pageResponse([userDto()]));

      expect(result).toEqual({
        items: [
          {
            id: 12,
            username: 'aperez',
            email: 'aperez@example.test',
            role: 'MEDICO',
            doctorId: 5,
            isActive: true,
          },
        ],
        total: 1,
        page: 1,
        size: 20,
        pages: 1,
      });
    });

    it('compone search/is_active/sort recortados en un solo punto', () => {
      service
        .list({ page: 2, size: 50, search: '  ana  ', isActive: false, sort: '-email' })
        .subscribe();
      service.list({ page: 1, size: 10, search: '   ', isActive: true, sort: '  ' }).subscribe();

      const filtered = httpMock.expectOne(
        (request) => request.url === USERS_URL && request.params.get('search') === 'ana',
      );
      expect(filtered.request.params.get('page')).toBe('2');
      expect(filtered.request.params.get('size')).toBe('50');
      expect(filtered.request.params.get('search')).toBe('ana');
      expect(filtered.request.params.get('is_active')).toBe('false');
      expect(filtered.request.params.get('sort')).toBe('-email');
      filtered.flush(pageResponse());

      const unfiltered = httpMock.expectOne(
        (request) => request.url === USERS_URL && request.params.get('size') === '10',
      );
      expect(unfiltered.request.params.has('search')).toBe(false);
      expect(unfiltered.request.params.get('is_active')).toBe('true');
      expect(unfiltered.request.params.has('sort')).toBe(false);
      unfiltered.flush(pageResponse());
    });
  });

  describe('getById (CA-06)', () => {
    it('emite GET /{id} y mapea el recurso', () => {
      let result: unknown;
      service.getById(12).subscribe((user) => {
        result = user;
      });

      const req = httpMock.expectOne(`${USERS_URL}/12`);

      expect(req.request.method).toBe('GET');
      req.flush(userDto());

      expect(result).toEqual({
        id: 12,
        username: 'aperez',
        email: 'aperez@example.test',
        role: 'MEDICO',
        doctorId: 5,
        isActive: true,
      });
    });
  });

  describe('create (CA-05/CA-07)', () => {
    it('emite POST exacto con trim, role_id de MEDICO y doctor_id', () => {
      service
        .create({
          username: '  aperez  ',
          email: '  aperez@example.test  ',
          password: '  Secreto-sintetico-1  ',
          role: 'MEDICO',
          doctorId: 5,
          isActive: true,
        })
        .subscribe();

      const req = httpMock.expectOne(USERS_URL);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        username: 'aperez',
        email: 'aperez@example.test',
        password: '  Secreto-sintetico-1  ',
        role_id: 2,
        doctor_id: 5,
        is_active: true,
      });
      req.flush(userDto());
    });

    it('convierte ADMIN a role_id 1 y fuerza doctor_id null aunque se informe (CA-07, §7)', () => {
      service
        .create({
          username: 'admin.demo',
          email: 'admin.demo@example.test',
          password: 'Secreto-sintetico-1',
          role: 'ADMIN',
          doctorId: 9,
          isActive: true,
        })
        .subscribe();

      const req = httpMock.expectOne(USERS_URL);

      expect(req.request.body).toMatchObject({ role_id: 1, doctor_id: null });
      req.flush(userDto({ role: 'ADMIN', doctor_id: null }));
    });
  });

  describe('update (CA-06/CA-07)', () => {
    it('emite PUT sin PATCH con el reemplazo recortado', () => {
      service
        .update(12, {
          username: '  aperez  ',
          email: '  aperez@example.test  ',
          password: '',
          role: 'MEDICO',
          doctorId: 5,
          isActive: true,
        })
        .subscribe();

      const req = httpMock.expectOne(`${USERS_URL}/12`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        username: 'aperez',
        email: 'aperez@example.test',
        role_id: 2,
        doctor_id: 5,
        is_active: true,
      });
      req.flush(userDto());
    });
  });

  describe('deactivate (CA-08)', () => {
    it('emite DELETE = desactivación lógica, sin borrado físico ni patch', () => {
      let completed = false;
      service.deactivate(12).subscribe(() => {
        completed = true;
      });

      const req = httpMock.expectOne(`${USERS_URL}/12`);

      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // R-04 resuelto por OpenAPI (`PUT /users/{user_id}`: «Reemplazo completo...
  // No modifica la contraseña»): `reactivate()` recibe el `ManagedUser`
  // visible y reenvía `username`, `email`, `role_id`, `doctor_id` e
  // `is_active: true`. Un `PUT {is_active: true}` parcial responde 422 por
  // los requeridos faltantes, así que el reemplazo completo es obligatorio.
  describe('reactivate (CA-08, R-04 resuelto por OpenAPI)', () => {
    const inactiveUser: ManagedUser = {
      id: 12,
      username: 'aperez',
      email: 'aperez@example.test',
      role: 'MEDICO',
      doctorId: 5,
      isActive: false,
    };

    it('emite PUT con el reemplazo completo de UserUpdate e is_active true', () => {
      service.reactivate(inactiveUser).subscribe();

      const req = httpMock.expectOne(`${USERS_URL}/12`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        username: 'aperez',
        email: 'aperez@example.test',
        role_id: 2,
        doctor_id: 5,
        is_active: true,
      });
      req.flush(userDto());
    });

    it('convierte ADMIN a role_id 1 con doctor_id null y sin password', () => {
      service.reactivate({ ...inactiveUser, role: 'ADMIN', doctorId: null }).subscribe();

      const req = httpMock.expectOne(`${USERS_URL}/12`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        username: 'aperez',
        email: 'aperez@example.test',
        role_id: 1,
        doctor_id: null,
        is_active: true,
      });
      expect(req.request.body).not.toHaveProperty('password');
      req.flush(userDto({ role: 'ADMIN', doctor_id: null }));
    });
  });

  describe('alcance (CA-06/CA-08/CA-09)', () => {
    it('no expone reset-password ni verbo parcial en esta entrega (PQ-01)', () => {
      const api = service as unknown as Record<string, unknown>;

      expect(api['resetPassword']).toBeUndefined();
      expect(api['patch']).toBeUndefined();
    });
  });
});
