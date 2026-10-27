import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Doctor } from './doctors.models';
import { DoctorsService } from './doctors.service';

const DOCTORS_URL = `${environment.apiUrl}/v1/doctors`;

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

/** Respuesta paginada sintética del servidor (`{items, total, page, size, pages}`). */
function pageResponse(items: Record<string, unknown>[] = []): Record<string, unknown> {
  return { items, total: items.length, page: 1, size: 20, pages: 1 };
}

describe('DoctorsService (F-014)', () => {
  let service: DoctorsService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(DoctorsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  describe('list (S1)', () => {
    it('emite GET con page=1&size=20 y mapea los seis campos planos más user', () => {
      let result: unknown;
      service.list({ page: 1, size: 20 }).subscribe((page) => {
        result = page;
      });

      const req = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.has('is_active')).toBe(false);
      expect(req.request.params.has('sort')).toBe(false);

      req.flush(pageResponse([doctorDto()]));

      expect(result).toEqual({
        items: [
          {
            id: 21,
            name: 'Dra. Sintética',
            cedula: '12345678901',
            labShift: 'MATUTINA',
            specialty: 'Medicina general',
            isActive: true,
            user: { id: 7, username: 'medico.demo', isActive: true },
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
        .list({ page: 2, size: 50, search: '  sintética  ', isActive: false, sort: '-cedula' })
        .subscribe();
      service.list({ page: 1, size: 10, search: '   ', isActive: true, sort: '  ' }).subscribe();

      const filtered = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.params.get('search') === 'sintética',
      );
      expect(filtered.request.params.get('page')).toBe('2');
      expect(filtered.request.params.get('size')).toBe('50');
      expect(filtered.request.params.get('is_active')).toBe('false');
      expect(filtered.request.params.get('sort')).toBe('-cedula');
      filtered.flush(pageResponse());

      const unfiltered = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.params.get('size') === '10',
      );
      expect(unfiltered.request.params.has('search')).toBe(false);
      expect(unfiltered.request.params.get('is_active')).toBe('true');
      expect(unfiltered.request.params.has('sort')).toBe(false);
      unfiltered.flush(pageResponse());
    });
  });

  describe('getById (S7)', () => {
    it('emite GET /{id} y mapea el recurso aunque esté inactivo (200)', () => {
      let result: Doctor | undefined;
      service.getById(21).subscribe((doctor) => {
        result = doctor;
      });

      const req = httpMock.expectOne(`${DOCTORS_URL}/21`);

      expect(req.request.method).toBe('GET');
      req.flush(doctorDto({ is_active: false, user: null }));

      expect(result?.isActive).toBe(false);
      expect(result?.user).toBeNull();
      expect(result?.labShift).toBe('MATUTINA');
    });

    it('propaga el 404 del servidor sin tragarlo', () => {
      let error: unknown;
      service.getById(99).subscribe({
        error: (httpError) => {
          error = httpError;
        },
      });

      httpMock
        .expectOne(`${DOCTORS_URL}/99`)
        .flush('ausente sintético', { status: 404, statusText: 'Not Found' });

      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect((error as HttpErrorResponse).status).toBe(404);
    });
  });

  describe('create (S2/S3/S4/S5)', () => {
    it('emite POST con la cédula sin máscara y la tanda del formulario (201)', () => {
      let result: Doctor | undefined;
      service
        .create({
          name: '  Dra. Sintética  ',
          cedula: '123-4567890-1',
          labShift: 'MATUTINA',
          specialty: ' Medicina general ',
          isActive: true,
        })
        .subscribe((doctor) => {
          result = doctor;
        });

      const req = httpMock.expectOne(DOCTORS_URL);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'Dra. Sintética',
        cedula: '12345678901',
        lab_shift: 'MATUTINA',
        specialty: 'Medicina general',
        is_active: true,
      });
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('created_at');
      expect(req.request.body).not.toHaveProperty('user');
      req.flush(doctorDto(), { status: 201, statusText: 'Created' });

      expect(result?.cedula).toBe('12345678901');
      expect(result?.user?.username).toBe('medico.demo');
    });

    it('envía is_active false cuando se desmarca (S2)', () => {
      service
        .create({
          name: 'Dr. Sintético',
          cedula: '12345678901',
          labShift: 'NOCTURNA',
          specialty: 'Pediatría',
          isActive: false,
        })
        .subscribe();

      const req = httpMock.expectOne(DOCTORS_URL);

      expect(req.request.body).toEqual({
        name: 'Dr. Sintético',
        cedula: '12345678901',
        lab_shift: 'NOCTURNA',
        specialty: 'Pediatría',
        is_active: false,
      });
      req.flush(doctorDto({ is_active: false }));
    });
  });

  describe('update (S7)', () => {
    it('emite PUT de reemplazo completo con los cinco campos y sin user (200)', () => {
      let result: Doctor | undefined;
      service
        .update(21, {
          name: '  Dra. Actualizada  ',
          cedula: '123-4567890-1',
          labShift: 'MIXTA',
          specialty: 'Cardiología',
          isActive: false,
        })
        .subscribe((doctor) => {
          result = doctor;
        });

      const req = httpMock.expectOne(`${DOCTORS_URL}/21`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Dra. Actualizada',
        cedula: '12345678901',
        lab_shift: 'MIXTA',
        specialty: 'Cardiología',
        is_active: false,
      });
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('user');
      req.flush(doctorDto({ name: 'Dra. Actualizada', lab_shift: 'MIXTA', is_active: false }));

      expect(result?.name).toBe('Dra. Actualizada');
      expect(result?.labShift).toBe('MIXTA');
    });
  });

  describe('deactivate (S8)', () => {
    it('emite DELETE = desactivación lógica, sin borrado físico ni patch', () => {
      let completed = false;
      service.deactivate(21).subscribe(() => {
        completed = true;
      });

      const req = httpMock.expectOne(`${DOCTORS_URL}/21`);

      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toBeNull();
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(completed).toBe(true);
    });

    it('es idempotente: un segundo DELETE del mismo médico también completa en 204', () => {
      service.deactivate(21).subscribe();

      const first = httpMock.expectOne(`${DOCTORS_URL}/21`);
      expect(first.request.method).toBe('DELETE');
      first.flush(null, { status: 204, statusText: 'No Content' });

      service.deactivate(21).subscribe();

      const second = httpMock.expectOne(`${DOCTORS_URL}/21`);
      expect(second.request.method).toBe('DELETE');
      second.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('propaga el 409 doctor_has_visits sin tragarlo (S8)', () => {
      let status = 0;
      service.deactivate(21).subscribe({
        error: (error: HttpErrorResponse) => {
          status = error.status;
        },
      });

      httpMock
        .expectOne(`${DOCTORS_URL}/21`)
        .flush({ code: 'doctor_has_visits' }, { status: 409, statusText: 'Conflict' });

      expect(status).toBe(409);
    });
  });

  describe('reactivate (S8)', () => {
    const inactiveDoctor: Doctor = {
      id: 21,
      name: 'Dra. Sintética',
      cedula: '12345678901',
      labShift: 'TARDE',
      specialty: 'Medicina general',
      isActive: false,
      user: { id: 7, username: 'medico.demo', isActive: true },
    };

    it('reenvía el registro completo con is_active true conservando tanda y especialidad', () => {
      service.reactivate(inactiveDoctor).subscribe();

      const req = httpMock.expectOne(`${DOCTORS_URL}/21`);

      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Dra. Sintética',
        cedula: '12345678901',
        lab_shift: 'TARDE',
        specialty: 'Medicina general',
        is_active: true,
      });
      req.flush(doctorDto());
    });

    it('no intenta modificar la asociación con usuarios al reactivar (S6)', () => {
      service.reactivate({ ...inactiveDoctor, user: null }).subscribe();

      const req = httpMock.expectOne(`${DOCTORS_URL}/21`);

      expect(req.request.body).not.toHaveProperty('user');
      expect(req.request.body).not.toHaveProperty('doctor_id');
      req.flush(doctorDto());
    });
  });

  describe('alcance (S6/S8)', () => {
    it('no expone verbo parcial ni escritura de la asociación en esta entrega', () => {
      const api = service as unknown as Record<string, unknown>;

      expect(api['patch']).toBeUndefined();
      expect(api['assignUser']).toBeUndefined();
    });
  });
});
