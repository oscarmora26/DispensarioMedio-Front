import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CellOption, Shelf } from './locations.models';
import { LocationsService } from './locations.service';

const SHELVES_URL = `${environment.apiUrl}/v1/shelves`;
const CELLS_URL = `${environment.apiUrl}/v1/cells`;

/** Respuesta paginada sintética del servidor (`{items, total, page, size, pages}`). */
function pageResponse(
  items: Record<string, unknown>[] = [],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { items, total: items.length, page: 1, size: 20, pages: 1, ...overrides };
}

function cellDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 11,
    shelf_id: 7,
    section: 'tramo 1',
    cell: 'celda 3',
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
    cells: [cellDto()],
    ...overrides,
  };
}

describe('LocationsService (F-011, /v1/shelves + /v1/cells)', () => {
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

  describe('list', () => {
    it('emite GET /v1/shelves con page=1&size=20 y mapea estante + celdas', () => {
      let result: unknown;
      service.list({ page: 1, size: 20 }).subscribe((page) => {
        result = page;
      });

      const req = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.has('is_active')).toBe(false);
      expect(req.request.params.has('sort')).toBe(false);

      req.flush(pageResponse([shelfDto()]));

      expect(result).toEqual({
        items: [
          {
            id: 7,
            name: 'Estante A',
            description: 'Pasillo principal',
            isActive: true,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
            cells: [
              {
                id: 11,
                shelfId: 7,
                section: 'tramo 1',
                cell: 'celda 3',
                description: null,
                isActive: true,
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-02T00:00:00Z',
              },
            ],
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
        .list({ page: 2, size: 50, search: '  estante  ', isActive: false, sort: '-name' })
        .subscribe();
      service.list({ page: 1, size: 10, search: '   ', isActive: true, sort: '  ' }).subscribe();

      const filtered = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.params.get('search') === 'estante',
      );
      expect(filtered.request.params.get('page')).toBe('2');
      expect(filtered.request.params.get('size')).toBe('50');
      expect(filtered.request.params.get('is_active')).toBe('false');
      expect(filtered.request.params.get('sort')).toBe('-name');
      filtered.flush(pageResponse());

      const unfiltered = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.params.get('size') === '10',
      );
      expect(unfiltered.request.params.has('search')).toBe(false);
      expect(unfiltered.request.params.get('is_active')).toBe('true');
      expect(unfiltered.request.params.has('sort')).toBe(false);
      unfiltered.flush(pageResponse());
    });

    it('mapea un estante cuya respuesta no trae `cells` a una lista vacía', () => {
      let result: unknown;
      service.list({ page: 1, size: 20 }).subscribe((page) => {
        result = page;
      });

      const dto = shelfDto();
      delete dto['cells'];
      httpMock.expectOne((request) => request.url === SHELVES_URL).flush(pageResponse([dto]));

      expect((result as { items: Shelf[] }).items[0].cells).toEqual([]);
    });
  });

  describe('getById', () => {
    it('emite GET /{id} y mapea el estante con sus celdas (200)', () => {
      let result: unknown;
      service.getById(7).subscribe((shelf) => {
        result = shelf;
      });

      const req = httpMock.expectOne(`${SHELVES_URL}/7`);

      expect(req.request.method).toBe('GET');
      req.flush(shelfDto());

      expect(result).toMatchObject({ id: 7, name: 'Estante A', isActive: true });
      expect((result as Shelf).cells[0].section).toBe('tramo 1');
    });

    it('propaga el 404 del servidor sin tragarlo', () => {
      let error: unknown;
      service.getById(99).subscribe({
        error: (httpError) => {
          error = httpError;
        },
      });

      httpMock
        .expectOne(`${SHELVES_URL}/99`)
        .flush('ausente sintético', { status: 404, statusText: 'Not Found' });

      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect((error as HttpErrorResponse).status).toBe(404);
    });
  });

  describe('create (cambio 3: el body del estante no lleva `cells`)', () => {
    it('emite POST /v1/shelves con name recortado, description null y sin cells (201)', () => {
      let result: Shelf | undefined;
      service
        .create({ name: '  Estante A  ', description: '   ', isActive: true })
        .subscribe((shelf) => {
          result = shelf;
        });

      const req = httpMock.expectOne(SHELVES_URL);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'Estante A',
        description: null,
        is_active: true,
      });
      expect(req.request.body).not.toHaveProperty('cells');
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('created_at');
      req.flush(shelfDto({ cells: [] }), { status: 201, statusText: 'Created' });

      expect(result?.name).toBe('Estante A');
      expect(result?.cells).toEqual([]);
    });

    it('respeta is_active false en el estante', () => {
      service.create({ name: 'Estante B', description: 'Depósito', isActive: false }).subscribe();

      const req = httpMock.expectOne(SHELVES_URL);

      expect(req.request.body).toEqual({
        name: 'Estante B',
        description: 'Depósito',
        is_active: false,
      });
      req.flush(shelfDto({ is_active: false }));
    });
  });

  describe('update (cambio 3: reemplazo del estante, sin tocar celdas)', () => {
    it('emite PUT /v1/shelves/{id} con name recortado y description normalizada', () => {
      let result: Shelf | undefined;
      service
        .update(7, { name: '  Estante B  ', description: '', isActive: false })
        .subscribe((shelf) => {
          result = shelf;
        });

      const req = httpMock.expectOne(`${SHELVES_URL}/7`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Estante B',
        description: null,
        is_active: false,
      });
      expect(req.request.body).not.toHaveProperty('cells');
      req.flush(
        shelfDto({
          name: 'Estante B',
          description: null,
          is_active: false,
          created_at: '2025-12-31T00:00:00Z',
        }),
        { status: 200, statusText: 'OK' },
      );

      // El `PUT` no reescribe `created_at`: se conserva el del servidor.
      expect(result?.createdAt).toBe('2025-12-31T00:00:00Z');
    });
  });

  describe('deactivate', () => {
    it('emite DELETE /v1/shelves/{id} sin cuerpo', () => {
      let completed = false;
      service.deactivate(7).subscribe(() => {
        completed = true;
      });

      const req = httpMock.expectOne(`${SHELVES_URL}/7`);

      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(completed).toBe(true);
    });
  });

  describe('reactivate', () => {
    const inactiveShelf: Shelf = {
      id: 7,
      name: '  Estante A  ',
      description: 'Pasillo principal',
      isActive: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
      cells: [
        {
          id: 11,
          shelfId: 7,
          section: 'tramo 1',
          cell: 'celda 3',
          description: null,
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      ],
    };

    it('reenvía el estante con is_active true y sin celdas', () => {
      service.reactivate(inactiveShelf).subscribe();

      const req = httpMock.expectOne(`${SHELVES_URL}/7`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Estante A',
        description: 'Pasillo principal',
        is_active: true,
      });
      expect(req.request.body).not.toHaveProperty('cells');
      req.flush(shelfDto());
    });

    it('normaliza a null la descripción ausente del estante', () => {
      service.reactivate({ ...inactiveShelf, description: null }).subscribe();

      const req = httpMock.expectOne(`${SHELVES_URL}/7`);

      expect(req.request.body.description).toBeNull();
      req.flush(shelfDto());
    });
  });

  describe('cells (cambio 3: CRUD propio en /v1/cells)', () => {
    it('createCell emite POST /v1/cells con shelf_id y textos recortados (201)', () => {
      let result: unknown;
      service
        .createCell(
          { section: '  tramo 1  ', cell: '  celda 3  ', description: '   ', isActive: true },
          7,
        )
        .subscribe((cell) => {
          result = cell;
        });

      const req = httpMock.expectOne(CELLS_URL);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        section: 'tramo 1',
        cell: 'celda 3',
        description: null,
        shelf_id: 7,
        is_active: true,
      });
      expect(Object.keys(req.request.body)).toEqual([
        'section',
        'cell',
        'description',
        'shelf_id',
        'is_active',
      ]);
      req.flush(cellDto(), { status: 201, statusText: 'Created' });

      expect(result).toMatchObject({ id: 11, shelfId: 7, section: 'tramo 1', isActive: true });
    });

    it('createCell respeta is_active false de la celda', () => {
      service
        .createCell(
          { section: 'tramo 2', cell: 'celda 1', description: 'alta', isActive: false },
          9,
        )
        .subscribe();

      const req = httpMock.expectOne(CELLS_URL);

      expect(req.request.body).toEqual({
        section: 'tramo 2',
        cell: 'celda 1',
        description: 'alta',
        shelf_id: 9,
        is_active: false,
      });
      req.flush(cellDto({ shelf_id: 9, is_active: false }), {
        status: 201,
        statusText: 'Created',
      });
    });

    it('updateCell emite PUT /v1/cells/{id} con shelf_id (permite mover de estante)', () => {
      let result: unknown;
      service
        .updateCell(
          11,
          { section: ' tramo 9 ', cell: ' celda 9 ', description: ' alta ', isActive: false },
          8,
        )
        .subscribe((cell) => {
          result = cell;
        });

      const req = httpMock.expectOne(`${CELLS_URL}/11`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        section: 'tramo 9',
        cell: 'celda 9',
        description: 'alta',
        shelf_id: 8,
        is_active: false,
      });
      req.flush(cellDto({ id: 11, shelf_id: 8, section: 'tramo 9', cell: 'celda 9' }));

      expect(result).toMatchObject({ id: 11, shelfId: 8 });
    });

    it('deleteCell emite DELETE /v1/cells/{id} sin cuerpo (204)', () => {
      let completed = false;
      service.deleteCell(11).subscribe(() => {
        completed = true;
      });

      const req = httpMock.expectOne(`${CELLS_URL}/11`);

      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(completed).toBe(true);
    });

    it('deleteCell propaga el 409 de la celda con medicamentos asociados', () => {
      let error: unknown;
      service.deleteCell(11).subscribe({
        error: (httpError) => {
          error = httpError;
        },
      });

      httpMock
        .expectOne(`${CELLS_URL}/11`)
        .flush('conflicto sintético', { status: 409, statusText: 'Conflict' });

      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect((error as HttpErrorResponse).status).toBe(409);
    });
  });

  describe('listAllCells', () => {
    it('pide size=100 y solo devuelve celdas activas de estantes activos con la etiqueta pactada', () => {
      let result: CellOption[] | undefined;
      service.listAllCells().subscribe((options) => {
        result = options;
      });

      const req = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('100');

      req.flush(
        pageResponse([
          shelfDto({
            id: 7,
            name: 'Estante A',
            cells: [
              cellDto({ id: 11, section: 'tramo 1', cell: 'celda 3' }),
              cellDto({ id: 12, section: 'tramo 2', cell: 'celda 1', is_active: false }),
            ],
          }),
          shelfDto({ id: 8, name: 'Estante B', is_active: false, cells: [cellDto({ id: 13 })] }),
        ]),
      );

      expect(result).toEqual([{ id: 11, label: 'Estante A · tramo 1 / celda 3' }]);
    });

    it('no trunca: concatena las páginas siguientes hasta page === pages', () => {
      let result: CellOption[] | undefined;
      service.listAllCells().subscribe((options) => {
        result = options;
      });

      const first = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.params.get('page') === '1',
      );
      expect(first.request.params.get('size')).toBe('100');
      first.flush(
        pageResponse([shelfDto({ id: 7, name: 'Estante A', cells: [cellDto({ id: 11 })] })], {
          total: 2,
          page: 1,
          size: 100,
          pages: 2,
        }),
      );

      const second = httpMock.expectOne(
        (request) => request.url === SHELVES_URL && request.params.get('page') === '2',
      );
      expect(second.request.params.get('size')).toBe('100');
      second.flush(
        pageResponse(
          [
            shelfDto({
              id: 8,
              name: 'Estante B',
              cells: [cellDto({ id: 12, section: 'tramo 9', cell: 'celda 9' })],
            }),
          ],
          { total: 2, page: 2, size: 100, pages: 2 },
        ),
      );

      httpMock.expectNone(
        (request) => request.url === SHELVES_URL && request.params.get('page') === '3',
      );
      expect(result).toEqual([
        { id: 11, label: 'Estante A · tramo 1 / celda 3' },
        { id: 12, label: 'Estante B · tramo 9 / celda 9' },
      ]);
    });

    it('con una sola página emite un único GET', () => {
      service.listAllCells().subscribe();

      httpMock
        .expectOne((request) => request.url === SHELVES_URL)
        .flush(pageResponse([shelfDto()]));

      httpMock.expectNone((request) => request.url === SHELVES_URL);
    });
  });

  describe('alcance', () => {
    it('no expone verbo parcial en esta entrega', () => {
      const api = service as unknown as Record<string, unknown>;

      expect(api['patch']).toBeUndefined();
    });
  });
});
