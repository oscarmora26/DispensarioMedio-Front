import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Location } from './locations.models';
import { LocationsService } from './locations.service';

const LOCATIONS_URL = `${environment.apiUrl}/v1/locations`;

/** Respuesta paginada sintética del servidor (`{items, total, page, size, pages}`). */
function pageResponse(items: Record<string, unknown>[] = []): Record<string, unknown> {
  return { items, total: items.length, page: 1, size: 20, pages: 1 };
}

function locationDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 7,
    description: 'Analgésico',
    shelf: 'A',
    section: '1',
    cell: '2',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('LocationsService (F-011)', () => {
  let service: LocationsService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(LocationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  describe('list (S1)', () => {
    it('emite GET con page=1&size=20 y mapea snake_case a camelCase', () => {
      let result: unknown;
      service.list({ page: 1, size: 20 }).subscribe((page) => {
        result = page;
      });

      const req = httpMock.expectOne(
        (request) => request.url === LOCATIONS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.has('is_active')).toBe(false);
      expect(req.request.params.has('sort')).toBe(false);

      req.flush(pageResponse([locationDto()]));

      expect(result).toEqual({
        items: [
          {
            id: 7,
            description: 'Analgésico',
            shelf: 'A',
            section: '1',
            cell: '2',
            isActive: true,
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        size: 20,
        pages: 1,
      });
    });

    it('compone search/is_active/sort recortados en un solo punto, con prefijo - descendente', () => {
      service
        .list({ page: 2, size: 50, search: '  anti  ', isActive: false, sort: '-description' })
        .subscribe();
      service.list({ page: 1, size: 10, search: '   ', isActive: true, sort: '  ' }).subscribe();

      const filtered = httpMock.expectOne(
        (request) => request.url === LOCATIONS_URL && request.params.get('search') === 'anti',
      );
      expect(filtered.request.params.get('page')).toBe('2');
      expect(filtered.request.params.get('size')).toBe('50');
      expect(filtered.request.params.get('search')).toBe('anti');
      expect(filtered.request.params.get('is_active')).toBe('false');
      expect(filtered.request.params.get('sort')).toBe('-description');
      filtered.flush(pageResponse());

      const unfiltered = httpMock.expectOne(
        (request) => request.url === LOCATIONS_URL && request.params.get('size') === '10',
      );
      expect(unfiltered.request.params.has('search')).toBe(false);
      expect(unfiltered.request.params.get('is_active')).toBe('true');
      expect(unfiltered.request.params.has('sort')).toBe(false);
      unfiltered.flush(pageResponse());
    });
  });

  describe('getById (S5)', () => {
    it('emite GET /{id} y mapea el recurso (200)', () => {
      let result: unknown;
      service.getById(7).subscribe((location) => {
        result = location;
      });

      const req = httpMock.expectOne(`${LOCATIONS_URL}/7`);

      expect(req.request.method).toBe('GET');
      req.flush(locationDto());

      expect(result).toEqual({
        id: 7,
        description: 'Analgésico',
        shelf: 'A',
        section: '1',
        cell: '2',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      });
    });

    it('propaga el 404 del servidor sin tragarlo', () => {
      let error: unknown;
      service.getById(99).subscribe({
        error: (httpError) => {
          error = httpError;
        },
      });

      httpMock
        .expectOne(`${LOCATIONS_URL}/99`)
        .flush('ausente sintético', { status: 404, statusText: 'Not Found' });

      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect((error as HttpErrorResponse).status).toBe(404);
    });
  });

  describe('create (S2)', () => {
    it('emite POST exacto con trim de description e is_active, sin id ni created_at (201)', () => {
      let result: Location | undefined;
      service.create({ description: '  Analgésico  ', shelf: '  A  ', section: '  1  ', cell: '  2  ', isActive: true }).subscribe((location) => {
        result = location;
      });

      const req = httpMock.expectOne(LOCATIONS_URL);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ description: 'Analgésico', shelf: 'A', section: '1', cell: '2', is_active: true });
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('created_at');
      req.flush(locationDto(), { status: 201, statusText: 'Created' });

      expect(result?.description).toBe('Analgésico');
      expect(result?.createdAt).toBe('2026-01-01T00:00:00Z');
    });

    it('respeta is_active false cuando el checkbox viene desmarcado (D-5)', () => {
      service.create({ description: 'Antibiótico', shelf: 'B', section: '2', cell: '3', isActive: false }).subscribe();

      const req = httpMock.expectOne(LOCATIONS_URL);

      expect(req.request.body).toEqual({ description: 'Antibiótico', shelf: 'B', section: '2', cell: '3', is_active: false });
      req.flush(locationDto({ is_active: false }));
    });
  });

  describe('update (S3)', () => {
    it('emite PUT de reemplazo completo con trim, sin PATCH, id ni created_at y conserva created_at (200)', () => {
      let result: Location | undefined;
      service.update(7, { description: '  Antibiótico  ', shelf: '  B  ', section: '  2  ', cell: '  3  ', isActive: false }).subscribe((location) => {
        result = location;
      });

      const req = httpMock.expectOne(`${LOCATIONS_URL}/7`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ description: 'Antibiótico', shelf: 'B', section: '2', cell: '3', is_active: false });
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('created_at');
      req.flush(
        locationDto({
          description: 'Antibiótico',
          shelf: 'B',
          section: '2',
          cell: '3',
          is_active: false,
          created_at: '2025-12-31T00:00:00Z',
        }),
        { status: 200, statusText: 'OK' },
      );

      // El `PUT` no reescribe `created_at`: se conserva el del servidor (S3).
      expect(result?.createdAt).toBe('2025-12-31T00:00:00Z');
      expect(result?.description).toBe('Antibiótico');
    });
  });

  describe('deactivate (S4)', () => {
    it('emite DELETE = desactivación lógica, sin borrado físico ni patch', () => {
      let completed = false;
      service.deactivate(7).subscribe(() => {
        completed = true;
      });

      const req = httpMock.expectOne(`${LOCATIONS_URL}/7`);

      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // R-04 (mismo criterio de F-006): la reactivación reenvía el registro
  // visible con `is_active: true` en el PUT de reemplazo completo; un PUT
  // parcial `{is_active: true}` responde 422 por los requeridos faltantes.
  describe('reactivate (S4, R-04)', () => {
    const inactiveLocation: Location = {
      id: 7,
      description: 'Analgésico',
      shelf: 'A',
      section: '1',
      cell: '2',
      isActive: false,
      createdAt: '2026-01-01T00:00:00Z',
    };

    it('emite PUT con el reemplazo completo: description recortada e is_active true', () => {
      service.reactivate({ ...inactiveLocation, description: '  Analgésico  ', shelf: '  A  ', section: '  1  ', cell: '  2  ' }).subscribe();

      const req = httpMock.expectOne(`${LOCATIONS_URL}/7`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ description: 'Analgésico', shelf: 'A', section: '1', cell: '2', is_active: true });
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('created_at');
      req.flush(locationDto());
    });
  });

  describe('alcance (S4)', () => {
    it('no expone verbo parcial en esta entrega', () => {
      const api = service as unknown as Record<string, unknown>;

      expect(api['patch']).toBeUndefined();
    });
  });
});
