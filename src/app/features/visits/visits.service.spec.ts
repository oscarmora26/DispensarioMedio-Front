import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { type VisitFormInput, type VisitReadDto } from './visits.models';
import { VisitsService } from './visits.service';

const VISITS_URL = `${environment.apiUrl}/v1/visits`;
const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;

function visitReadDto(overrides: Partial<VisitReadDto> = {}): VisitReadDto {
  return {
    id: 31,
    doctor: { id: 5, name: 'Dra. Sintética' },
    patient: { id: 9, name: 'Paciente Sintético', cedula: '12345678901' },
    visited_at: '2026-10-27T10:00:00',
    symptoms: 'Dolor de cabeza',
    status: 'REGISTRADA',
    created_by: 7,
    ...overrides,
  };
}

function formInput(overrides: Partial<VisitFormInput> = {}): VisitFormInput {
  return {
    patientId: 9,
    visitedAt: '2026-10-27T10:00',
    symptoms: '  Dolor de cabeza  ',
    recommendations: '',
    medications: [{ medicationId: 3, quantity: '2', instructions: 'Cada 8 horas' }],
    ...overrides,
  };
}

function pageResponse(items: Record<string, unknown>[] = []): Record<string, unknown> {
  return { items, total: items.length, page: 1, size: 20, pages: 1 };
}

describe('VisitsService (F-015)', () => {
  let service: VisitsService;
  let httpMock: HttpTestingController;

  function loginAs(role: 'ADMIN' | 'MEDICO'): void {
    const auth = TestBed.inject(AuthService);
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

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(VisitsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('list (S1/S2)', () => {
    it('emite GET con page/size y sin criterios vacíos', () => {
      let result: unknown;
      service.list({ page: 1, size: 20 }).subscribe((page) => {
        result = page;
      });

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.has('q')).toBe(false);
      expect(req.request.params.has('status')).toBe(false);
      expect(req.request.params.has('doctor_id')).toBe(false);
      expect(req.request.params.has('patient_id')).toBe(false);
      expect(req.request.params.has('date_from')).toBe(false);
      expect(req.request.params.has('date_to')).toBe(false);
      expect(req.request.params.has('sort')).toBe(false);

      req.flush(
        pageResponse([
          {
            id: 31,
            doctor: { id: 5, name: 'Dra. Sintética' },
            patient: { id: 9, name: 'Paciente Sintético', cedula: '12345678901' },
            visited_at: '2026-10-27T10:00:00',
            symptoms: 'Dolor de cabeza',
            status: 'REGISTRADA',
            created_by: 7,
          },
        ]),
      );

      expect(result).toEqual({
        items: [
          {
            id: 31,
            doctor: { id: 5, name: 'Dra. Sintética' },
            patient: { id: 9, name: 'Paciente Sintético', cedula: '12345678901' },
            visitedAt: '2026-10-27T10:00:00',
            symptoms: 'Dolor de cabeza',
            status: 'REGISTRADA',
            createdBy: 7,
          },
        ],
        total: 1,
        page: 1,
        size: 20,
        pages: 1,
      });
    });

    it('compone los filtros combinables recortados en un solo punto', () => {
      service
        .list({
          page: 2,
          size: 50,
          doctorId: 5,
          patientId: 9,
          dateFrom: '2026-10-01T00:00:00',
          dateTo: '2026-10-31T23:59:59',
          status: 'ANULADA',
          q: '  dolores  ',
          sort: '-visited_at',
        })
        .subscribe();

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('50');
      expect(req.request.params.get('doctor_id')).toBe('5');
      expect(req.request.params.get('patient_id')).toBe('9');
      expect(req.request.params.get('date_from')).toBe('2026-10-01T00:00:00');
      expect(req.request.params.get('date_to')).toBe('2026-10-31T23:59:59');
      expect(req.request.params.get('status')).toBe('ANULADA');
      expect(req.request.params.get('q')).toBe('dolores');
      expect(req.request.params.get('sort')).toBe('-visited_at');

      req.flush(pageResponse());
    });

    it('descarta los criterios en blanco', () => {
      service.list({ page: 1, size: 10, q: '   ', sort: '  ' }).subscribe();

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.method === 'GET',
      );

      expect(req.request.params.has('q')).toBe(false);
      expect(req.request.params.has('sort')).toBe(false);

      req.flush(pageResponse());
    });
  });

  describe('getById (S9/S16)', () => {
    it('emite GET /{id} y mapea el detalle tolerando campos ausentes', () => {
      let result: unknown;
      service.getById(31).subscribe((visit) => {
        result = visit;
      });

      const req = httpMock.expectOne(`${VISITS_URL}/31`);

      expect(req.request.method).toBe('GET');
      req.flush(visitReadDto({ recommendations: undefined, medications: undefined }));

      expect(result).toMatchObject({
        id: 31,
        recommendations: null,
        medications: [],
        status: 'REGISTRADA',
      });
    });
  });

  describe('create (S3/S4/S11)', () => {
    it('el POST no envía doctor_id y devuelve el detalle mapeado (S3/S11)', () => {
      loginAs('MEDICO');

      let result: unknown;
      service.create(formInput()).subscribe((visit) => {
        result = visit;
      });

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.method === 'POST',
      );
      const body = req.request.body as Record<string, unknown>;

      expect('doctor_id' in body).toBe(false);
      expect(body['patient_id']).toBe(9);
      expect(body['visited_at']).toBe('2026-10-27T10:00:00');
      expect(body['symptoms']).toBe('Dolor de cabeza');
      expect(body['recommendations']).toBeNull();
      expect(body['medications']).toEqual([
        { medication_id: 3, quantity: 2, instructions: 'Cada 8 horas' },
      ]);

      req.flush(visitReadDto(), { status: 201, statusText: 'Created' });

      expect(result).toMatchObject({ id: 31, patient: { id: 9 } });
    });

    it('la sesión no decide el cuerpo: ADMIN tampoco envía doctor_id (S11)', () => {
      loginAs('ADMIN');

      service.create(formInput()).subscribe();

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.method === 'POST',
      );
      const body = req.request.body as Record<string, unknown>;

      expect('doctor_id' in body).toBe(false);
      expect(body['patient_id']).toBe(9);

      req.flush(visitReadDto(), { status: 201, statusText: 'Created' });
    });
  });

  describe('update (S6)', () => {
    it('envía PUT de reemplazo completo con la lista de medicamentos vigente', () => {
      loginAs('MEDICO');

      service
        .update(
          31,
          formInput({
            visitedAt: '2026-10-28T11:30',
            symptoms: 'Control',
            recommendations: 'Volver en una semana',
            medications: [{ medicationId: 4, quantity: '1', instructions: '' }],
          }),
        )
        .subscribe();

      const req = httpMock.expectOne(
        (request) => request.url === `${VISITS_URL}/31` && request.method === 'PUT',
      );
      const body = req.request.body as Record<string, unknown>;

      expect('doctor_id' in body).toBe(false);
      expect(body['patient_id']).toBe(9);
      expect(body['visited_at']).toBe('2026-10-28T11:30:00');
      expect(body['symptoms']).toBe('Control');
      expect(body['recommendations']).toBe('Volver en una semana');
      // La lista enviada sustituye a la anterior (no hay PATCH ni merge).
      expect(body['medications']).toEqual([{ medication_id: 4, quantity: 1, instructions: null }]);

      req.flush(visitReadDto({ symptoms: 'Control' }));
    });
  });

  describe('annul (S7)', () => {
    it('envía POST /{id}/annul con el motivo recortado y mapea la respuesta', () => {
      loginAs('ADMIN');

      let result: unknown;
      service.annul(31, '  Registro duplicado  ').subscribe((annulment) => {
        result = annulment;
      });

      const req = httpMock.expectOne(
        (request) => request.url === `${VISITS_URL}/31/annul` && request.method === 'POST',
      );

      expect(req.request.body).toEqual({ reason: 'Registro duplicado' });

      req.flush({
        id: 31,
        status: 'ANULADA',
        annulled_at: '2026-10-28T09:00:00',
        annulled_by: 'admin.demo',
        annulment_reason: 'Registro duplicado',
      });

      expect(result).toEqual({
        id: 31,
        status: 'ANULADA',
        annulledAt: '2026-10-28T09:00:00',
        annulledBy: 'admin.demo',
        annulmentReason: 'Registro duplicado',
      });
    });
  });
});
