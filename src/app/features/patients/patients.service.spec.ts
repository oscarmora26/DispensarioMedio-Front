import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Patient } from './patients.models';
import { PatientsService } from './patients.service';

const PATIENTS_URL = `${environment.apiUrl}/v1/patients`;

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

/** Respuesta paginada sintética del servidor (`{items, total, page, size, pages}`). */
function pageResponse(items: Record<string, unknown>[] = []): Record<string, unknown> {
  return { items, total: items.length, page: 1, size: 20, pages: 1 };
}

describe('PatientsService (F-013)', () => {
  let service: PatientsService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(PatientsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  describe('list (S1)', () => {
    it('emite GET con page=1&size=20 y mapea los seis campos planos', () => {
      let result: unknown;
      service.list({ page: 1, size: 20 }).subscribe((page) => {
        result = page;
      });

      const req = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.has('is_active')).toBe(false);
      expect(req.request.params.has('sort')).toBe(false);

      req.flush(pageResponse([patientDto()]));

      expect(result).toEqual({
        items: [
          {
            id: 11,
            name: 'Ana Sintética',
            cedula: '12345678901',
            carnet: 'EST-001',
            patientType: 'ESTUDIANTE',
            isActive: true,
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
        .list({ page: 2, size: 50, search: '  ana  ', isActive: false, sort: '-cedula' })
        .subscribe();
      service.list({ page: 1, size: 10, search: '   ', isActive: true, sort: '  ' }).subscribe();

      const filtered = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.params.get('search') === 'ana',
      );
      expect(filtered.request.params.get('page')).toBe('2');
      expect(filtered.request.params.get('size')).toBe('50');
      expect(filtered.request.params.get('is_active')).toBe('false');
      expect(filtered.request.params.get('sort')).toBe('-cedula');
      filtered.flush(pageResponse());

      const unfiltered = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.params.get('size') === '10',
      );
      expect(unfiltered.request.params.has('search')).toBe(false);
      expect(unfiltered.request.params.get('is_active')).toBe('true');
      expect(unfiltered.request.params.has('sort')).toBe(false);
      unfiltered.flush(pageResponse());
    });
  });

  describe('getById (S6)', () => {
    it('emite GET /{id} y mapea el recurso aunque esté inactivo (200)', () => {
      let result: Patient | undefined;
      service.getById(11).subscribe((patient) => {
        result = patient;
      });

      const req = httpMock.expectOne(`${PATIENTS_URL}/11`);

      expect(req.request.method).toBe('GET');
      req.flush(patientDto({ is_active: false, carnet: null }));

      expect(result?.isActive).toBe(false);
      expect(result?.carnet).toBeNull();
      expect(result?.patientType).toBe('ESTUDIANTE');
    });

    it('propaga el 404 del servidor sin tragarlo', () => {
      let error: unknown;
      service.getById(99).subscribe({
        error: (httpError) => {
          error = httpError;
        },
      });

      httpMock
        .expectOne(`${PATIENTS_URL}/99`)
        .flush('ausente sintético', { status: 404, statusText: 'Not Found' });

      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect((error as HttpErrorResponse).status).toBe(404);
    });
  });

  describe('create (S2/S3/S4)', () => {
    it('emite POST con la cédula sin máscara y el carnet del formulario (201)', () => {
      let result: Patient | undefined;
      service
        .create({
          name: '  Ana Sintética  ',
          cedula: '123-4567890-1',
          carnet: ' EST-001 ',
          patientType: 'ESTUDIANTE',
          isActive: true,
        })
        .subscribe((patient) => {
          result = patient;
        });

      const req = httpMock.expectOne(PATIENTS_URL);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'Ana Sintética',
        cedula: '12345678901',
        patient_type: 'ESTUDIANTE',
        carnet: 'EST-001',
        is_active: true,
      });
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('created_at');
      req.flush(patientDto(), { status: 201, statusText: 'Created' });

      expect(result?.cedula).toBe('12345678901');
    });

    it('envía carnet null cuando viene vacío e is_active false cuando se desmarca (S4)', () => {
      service
        .create({
          name: 'Luis Sintético',
          cedula: '12345678901',
          carnet: '   ',
          patientType: 'EMPLEADO',
          isActive: false,
        })
        .subscribe();

      const req = httpMock.expectOne(PATIENTS_URL);

      expect(req.request.body).toEqual({
        name: 'Luis Sintético',
        cedula: '12345678901',
        patient_type: 'EMPLEADO',
        carnet: null,
        is_active: false,
      });
      req.flush(patientDto({ carnet: null, patient_type: 'EMPLEADO' }));
    });
  });

  describe('update (S6)', () => {
    it('emite PUT de reemplazo completo con los cuatro campos y la cédula sin máscara (200)', () => {
      let result: Patient | undefined;
      service
        .update(11, {
          name: '  Ana Actualizada  ',
          cedula: '123-4567890-1',
          carnet: 'EST-999',
          patientType: 'PROFESOR',
          isActive: false,
        })
        .subscribe((patient) => {
          result = patient;
        });

      const req = httpMock.expectOne(`${PATIENTS_URL}/11`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Ana Actualizada',
        cedula: '12345678901',
        patient_type: 'PROFESOR',
        carnet: 'EST-999',
        is_active: false,
      });
      expect(req.request.body).not.toHaveProperty('id');
      req.flush(
        patientDto({ name: 'Ana Actualizada', patient_type: 'PROFESOR', is_active: false }),
      );

      expect(result?.name).toBe('Ana Actualizada');
      expect(result?.patientType).toBe('PROFESOR');
    });

    it('un carnet vacío viaja como null y borra el carnet existente (S6)', () => {
      service
        .update(11, {
          name: 'Ana Sintética',
          cedula: '12345678901',
          carnet: '',
          patientType: 'OTROS',
          isActive: true,
        })
        .subscribe();

      const req = httpMock.expectOne(`${PATIENTS_URL}/11`);

      expect(req.request.body.carnet).toBeNull();
      req.flush(patientDto({ carnet: null, patient_type: 'OTROS' }));
    });
  });

  describe('deactivate (S7)', () => {
    it('emite DELETE = desactivación lógica, sin borrado físico ni patch', () => {
      let completed = false;
      service.deactivate(11).subscribe(() => {
        completed = true;
      });

      const req = httpMock.expectOne(`${PATIENTS_URL}/11`);

      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toBeNull();
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(completed).toBe(true);
    });

    it('es idempotente: un segundo DELETE del mismo paciente también completa en 204', () => {
      service.deactivate(11).subscribe();

      const first = httpMock.expectOne(`${PATIENTS_URL}/11`);
      expect(first.request.method).toBe('DELETE');
      first.flush(null, { status: 204, statusText: 'No Content' });

      service.deactivate(11).subscribe();

      const second = httpMock.expectOne(`${PATIENTS_URL}/11`);
      expect(second.request.method).toBe('DELETE');
      second.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  describe('reactivate (S7)', () => {
    const inactivePatient: Patient = {
      id: 11,
      name: 'Ana Sintética',
      cedula: '12345678901',
      carnet: 'EST-001',
      patientType: 'ESTUDIANTE',
      isActive: false,
    };

    it('reenvía el registro completo con is_active true conservando el carnet', () => {
      service.reactivate(inactivePatient).subscribe();

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
    });

    it('mantiene el carnet null de un paciente sin carnet', () => {
      service.reactivate({ ...inactivePatient, carnet: null, patientType: 'OTROS' }).subscribe();

      const req = httpMock.expectOne(`${PATIENTS_URL}/11`);

      expect(req.request.body.carnet).toBeNull();
      expect(req.request.body.patient_type).toBe('OTROS');
      req.flush(patientDto({ carnet: null, patient_type: 'OTROS' }));
    });
  });

  describe('alcance (S7)', () => {
    it('no expone verbo parcial en esta entrega', () => {
      const api = service as unknown as Record<string, unknown>;

      expect(api['patch']).toBeUndefined();
    });
  });
});
