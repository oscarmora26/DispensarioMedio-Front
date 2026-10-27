import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Medication } from './medications.models';
import { MedicationsService } from './medications.service';

const MEDICATIONS_URL = `${environment.apiUrl}/v1/medications`;

/** Respuesta paginada sintética del servidor (`{items, total, page, size, pages}`). */
function pageResponse(items: Record<string, unknown>[] = []): Record<string, unknown> {
  return { items, total: items.length, page: 1, size: 20, pages: 1 };
}

// `MedicationRead` del backend real: `cell_id` y **sin** `created_at`.
function medicationDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 7,
    description: 'Analgésico',
    drug_type_id: 1,
    brand_id: 2,
    cell_id: 3,
    dose: '500 mg',
    is_active: true,
    ...overrides,
  };
}

describe('MedicationsService (F-012)', () => {
  let service: MedicationsService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(MedicationsService);
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
        (request) => request.url === MEDICATIONS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.has('is_active')).toBe(false);
      expect(req.request.params.has('cell_id')).toBe(false);
      expect(req.request.params.has('location_id')).toBe(false);
      expect(req.request.params.has('sort')).toBe(false);

      req.flush(pageResponse([medicationDto()]));

      expect(result).toEqual({
        items: [
          {
            id: 7,
            description: 'Analgésico',
            drugTypeId: 1,
            brandId: 2,
            cellId: 3,
            dose: '500 mg',
            isActive: true,
          },
        ],
        total: 1,
        page: 1,
        size: 20,
        pages: 1,
      });
    });

    it('compone el filtro cell_id del contrato nuevo y no envía location_id', () => {
      service.list({ page: 1, size: 20, cellId: 3 }).subscribe();

      const req = httpMock.expectOne((request) => request.url === MEDICATIONS_URL);

      expect(req.request.params.get('cell_id')).toBe('3');
      expect(req.request.params.has('location_id')).toBe(false);
      req.flush(pageResponse());
    });

    it('compone search/is_active/sort recortados en un solo punto, con prefijo - descendente', () => {
      service
        .list({ page: 2, size: 50, search: '  anti  ', isActive: false, sort: '-description' })
        .subscribe();
      service.list({ page: 1, size: 10, search: '   ', isActive: true, sort: '  ' }).subscribe();

      const filtered = httpMock.expectOne(
        (request) => request.url === MEDICATIONS_URL && request.params.get('search') === 'anti',
      );
      expect(filtered.request.params.get('page')).toBe('2');
      expect(filtered.request.params.get('size')).toBe('50');
      expect(filtered.request.params.get('search')).toBe('anti');
      expect(filtered.request.params.get('is_active')).toBe('false');
      expect(filtered.request.params.get('sort')).toBe('-description');
      filtered.flush(pageResponse());

      const unfiltered = httpMock.expectOne(
        (request) => request.url === MEDICATIONS_URL && request.params.get('size') === '10',
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
      service.getById(7).subscribe((medication) => {
        result = medication;
      });

      const req = httpMock.expectOne(`${MEDICATIONS_URL}/7`);

      expect(req.request.method).toBe('GET');
      req.flush(medicationDto());

      expect(result).toEqual({
        id: 7,
        description: 'Analgésico',
        drugTypeId: 1,
        brandId: 2,
        cellId: 3,
        dose: '500 mg',
        isActive: true,
      });
    });

    it('deja createdAt opcional: la lectura real no envía created_at', () => {
      let result: Medication | undefined;
      service.getById(7).subscribe((medication) => {
        result = medication;
      });

      httpMock.expectOne(`${MEDICATIONS_URL}/7`).flush(medicationDto());

      expect(result).toBeDefined();
      expect(result?.createdAt).toBeUndefined();
    });

    it('propaga el 404 del servidor sin tragarlo', () => {
      let error: unknown;
      service.getById(99).subscribe({
        error: (httpError) => {
          error = httpError;
        },
      });

      httpMock
        .expectOne(`${MEDICATIONS_URL}/99`)
        .flush('ausente sintético', { status: 404, statusText: 'Not Found' });

      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect((error as HttpErrorResponse).status).toBe(404);
    });
  });

  describe('create (S2)', () => {
    it('emite POST exacto con cell_id, trim de description e is_active, sin id ni created_at (201)', () => {
      let result: Medication | undefined;
      service
        .create({
          description: '  Analgésico  ',
          drugTypeId: 1,
          brandId: 2,
          cellId: 3,
          dose: '  500 mg  ',
          isActive: true,
        })
        .subscribe((medication) => {
          result = medication;
        });

      const req = httpMock.expectOne(MEDICATIONS_URL);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        description: 'Analgésico',
        drug_type_id: 1,
        brand_id: 2,
        cell_id: 3,
        dose: '500 mg',
        is_active: true,
      });
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('created_at');
      expect(req.request.body).not.toHaveProperty('location_id');
      req.flush(medicationDto(), { status: 201, statusText: 'Created' });

      expect(result?.description).toBe('Analgésico');
      expect(result?.cellId).toBe(3);
    });

    it('respeta is_active false cuando el checkbox viene desmarcado (D-5)', () => {
      service
        .create({
          description: 'Antibiótico',
          drugTypeId: 1,
          brandId: 2,
          cellId: 3,
          dose: '250 mg',
          isActive: false,
        })
        .subscribe();

      const req = httpMock.expectOne(MEDICATIONS_URL);

      expect(req.request.body).toEqual({
        description: 'Antibiótico',
        drug_type_id: 1,
        brand_id: 2,
        cell_id: 3,
        dose: '250 mg',
        is_active: false,
      });
      req.flush(medicationDto({ is_active: false }));
    });
  });

  describe('update (S3)', () => {
    it('emite PUT de reemplazo completo con cell_id y trim, sin PATCH, id ni created_at (200)', () => {
      let result: Medication | undefined;
      service
        .update(7, {
          description: '  Antibiótico  ',
          drugTypeId: 1,
          brandId: 2,
          cellId: 3,
          dose: '  250 mg  ',
          isActive: false,
        })
        .subscribe((medication) => {
          result = medication;
        });

      const req = httpMock.expectOne(`${MEDICATIONS_URL}/7`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        description: 'Antibiótico',
        drug_type_id: 1,
        brand_id: 2,
        cell_id: 3,
        dose: '250 mg',
        is_active: false,
      });
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('created_at');
      expect(req.request.body).not.toHaveProperty('location_id');
      req.flush(medicationDto({ description: 'Antibiótico', is_active: false }), {
        status: 200,
        statusText: 'OK',
      });

      // La lectura real no devuelve `created_at`: el modelo lo deja opcional y
      // ninguna vista lo muestra.
      expect(result?.createdAt).toBeUndefined();
      expect(result?.description).toBe('Antibiótico');
    });
  });

  describe('deactivate (S4)', () => {
    it('emite DELETE = desactivación lógica, sin borrado físico ni patch', () => {
      let completed = false;
      service.deactivate(7).subscribe(() => {
        completed = true;
      });

      const req = httpMock.expectOne(`${MEDICATIONS_URL}/7`);

      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // R-04 (mismo criterio de F-006): la reactivación reenvía el registro
  // visible con `is_active: true` en el PUT de reemplazo completo; un PUT
  // parcial `{is_active: true}` responde 422 por los requeridos faltantes.
  describe('reactivate (S4, R-04)', () => {
    const inactiveMedication: Medication = {
      id: 7,
      description: 'Analgésico',
      drugTypeId: 1,
      brandId: 2,
      cellId: 3,
      dose: '500 mg',
      isActive: false,
    };

    it('emite PUT con el reemplazo completo: description recortada e is_active true', () => {
      service
        .reactivate({
          ...inactiveMedication,
          description: '  Analgésico  ',
          drugTypeId: 1,
          brandId: 2,
          cellId: 3,
          dose: '  500 mg  ',
        })
        .subscribe();

      const req = httpMock.expectOne(`${MEDICATIONS_URL}/7`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        description: 'Analgésico',
        drug_type_id: 1,
        brand_id: 2,
        cell_id: 3,
        dose: '500 mg',
        is_active: true,
      });
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('created_at');
      req.flush(medicationDto());
    });
  });

  describe('alcance (S4)', () => {
    it('no expone verbo parcial en esta entrega', () => {
      const api = service as unknown as Record<string, unknown>;

      expect(api['patch']).toBeUndefined();
    });
  });
});
