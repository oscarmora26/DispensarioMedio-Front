import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { type Patient } from '../../patients/patients.models';
import { toNaiveDateTime } from '../visits.models';
import { VisitFormData, VisitFormDialog } from './visit-form';

const VISITS_URL = `${environment.apiUrl}/v1/visits`;
const PATIENTS_URL = `${environment.apiUrl}/v1/patients`;
const MEDICATIONS_URL = `${environment.apiUrl}/v1/medications`;
const DOCTORS_URL = `${environment.apiUrl}/v1/doctors`;
const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;

function selectedPatient(): Patient {
  return {
    id: 9,
    name: 'Paciente Sintético',
    cedula: '12345678901',
    carnet: null,
    patientType: 'ESTUDIANTE',
    isActive: true,
  };
}

function visitReadDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 31,
    doctor: { id: 5, name: 'Dra. Sintética' },
    patient: { id: 9, name: 'Paciente Sintético', cedula: '12345678901' },
    visited_at: '2026-10-27T10:00:00',
    symptoms: 'Dolor de cabeza',
    recommendations: 'Reposo',
    status: 'REGISTRADA',
    created_by: 7,
    medications: [
      {
        medication_id: 3,
        description: 'Paracetamol sintético',
        dose: '500 mg',
        quantity: 2,
        instructions: 'Cada 8 horas',
      },
    ],
    ...overrides,
  };
}

function patientsPage(): Record<string, unknown> {
  return {
    items: [
      {
        id: 9,
        name: 'Paciente Sintético',
        cedula: '12345678901',
        carnet: null,
        patient_type: 'ESTUDIANTE',
        is_active: true,
      },
    ],
    total: 1,
    page: 1,
    size: 20,
    pages: 1,
  };
}

function medicationsPage(): Record<string, unknown> {
  return {
    items: [
      {
        id: 3,
        description: 'Paracetamol sintético',
        drug_type_id: 1,
        brand_id: 1,
        cell_id: 1,
        dose: '500 mg',
        is_active: true,
      },
    ],
    total: 1,
    page: 1,
    size: 20,
    pages: 1,
  };
}

interface Harness {
  fixture: ComponentFixture<VisitFormDialog>;
  component: VisitFormDialog;
  httpMock: HttpTestingController;
  dialogRefStub: { close: ReturnType<typeof vi.fn> };
  text: () => string;
  host: () => HTMLElement;
  /** Flushea la precarga `GET /visits/{id}` del modo edición. */
  flushVisit: (overrides?: Record<string, unknown>) => void;
}

async function configure(data: VisitFormData, role: 'ADMIN' | 'MEDICO'): Promise<Harness> {
  const dialogRefStub = { close: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [VisitFormDialog],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRefStub },
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
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

  const fixture = TestBed.createComponent(VisitFormDialog);
  const component = fixture.componentInstance;

  return {
    fixture,
    component,
    httpMock,
    dialogRefStub,
    text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
    host: () => fixture.nativeElement as HTMLElement,
    flushVisit: (overrides: Record<string, unknown> = {}) => {
      httpMock
        .expectOne((request) => request.url === `${VISITS_URL}/31` && request.method === 'GET')
        .flush(visitReadDto(overrides));
    },
  };
}

/** Fecha del calendario sintética (el datepicker trabaja con `Date`). */
function visitDate(): Date {
  return new Date(2026, 9, 27);
}

/** Rellena el formulario de creación con datos válidos. */
function fillValid(harness: Harness): void {
  harness.component.patientSearch.setValue('sin');
  harness.component.onPatientSelected(selectedPatient());
  harness.component.form.patchValue({
    visitedDate: visitDate(),
    visitedHour: '10',
    visitedMinute: '00',
    symptoms: 'Dolor de cabeza',
  });
}

describe('VisitFormDialog (F-015 S3/S4/S5/S6/S10/S12)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('modo creación MEDICO (S3/S5/S11)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'create' }, 'MEDICO');
      harness.fixture.detectChanges();
    });

    afterEach(() => {
      harness.httpMock.verify();
    });

    it('muestra el diálogo amplio con etiquetas, hints y límites del contrato', () => {
      const compiled = harness.host();

      expect(harness.text()).toContain('Nueva visita');
      expect(harness.text()).toContain('Paciente');
      expect(harness.text()).toContain('Fecha y hora de la visita');
      expect(harness.text()).toContain('Síntomas');
      expect(harness.text()).toContain('Recomendaciones');
      expect(harness.text()).toContain('Medicamentos entregados');
      expect(harness.text()).toContain('Agregar medicamento');
      expect(harness.text()).toContain('Registrar visita');
      expect(
        compiled.querySelector('textarea[formControlName="symptoms"]')?.getAttribute('maxlength'),
      ).toBe('2000');
      expect(
        compiled
          .querySelector('textarea[formControlName="recommendations"]')
          ?.getAttribute('maxlength'),
      ).toBe('2000');
      expect(compiled.querySelector('.dm-visit-form__content')).not.toBeNull();
    });

    it('la fecha y la hora de la visita son calendario Material + selects de hora y minuto (S10)', () => {
      const host = harness.host();
      const dateInput = host.querySelector('input[formControlName="visitedDate"]');
      const hourSelect = host.querySelector('mat-select[formControlName="visitedHour"]');
      const minuteSelect = host.querySelector('mat-select[formControlName="visitedMinute"]');

      expect(dateInput).not.toBeNull();
      expect(dateInput?.getAttribute('type')).not.toBe('datetime-local');
      expect(host.querySelector('input[formControlName="visitedAt"]')).toBeNull();
      expect(host.querySelector('mat-datepicker')).not.toBeNull();
      expect(host.querySelector('mat-datepicker-toggle')?.getAttribute('aria-label')).toBe(
        'Abrir el calendario de la fecha de la visita',
      );
      expect(hourSelect).not.toBeNull();
      expect(minuteSelect).not.toBeNull();
      expect(dateInput?.getAttribute('aria-label')).toBe('Fecha de la visita');
      expect(hourSelect?.getAttribute('aria-label')).toBe('Hora de la visita');
      expect(minuteSelect?.getAttribute('aria-label')).toBe('Minuto de la visita');
      expect(harness.text()).toContain('Fecha y hora de la visita');
      expect(harness.text()).toContain('Hora');
      expect(harness.text()).toContain('Minuto');
      // 24 horas y 60 minutos en los catálogos cerrados del capturador.
      expect(harness.component.hourOptions).toHaveLength(24);
      expect(harness.component.minuteOptions).toHaveLength(60);
    });

    it('no existe ningún control de médico ni se pide el catálogo de médicos (S3/S11)', () => {
      expect(harness.host().querySelector('mat-select[formControlName="doctorId"]')).toBeNull();
      expect(harness.host().querySelector('input[formControlName="doctorId"]')).toBeNull();
      expect(harness.text()).not.toContain('Médico');
      harness.httpMock.expectNone((request) => request.url === DOCTORS_URL);
    });

    it('envía el POST sin doctor_id: el médico sale del token (S3/S11)', () => {
      fillValid(harness);
      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.method === 'POST',
      );
      const body = req.request.body as Record<string, unknown>;

      expect('doctor_id' in body).toBe(false);
      expect(body['patient_id']).toBe(9);
      expect(body['visited_at']).toBe('2026-10-27T10:00:00');
      expect(body['symptoms']).toBe('Dolor de cabeza');
      expect(body['recommendations']).toBeNull();
      expect(body['medications']).toEqual([]);

      req.flush(visitReadDto(), { status: 201, statusText: 'Created' });

      expect(harness.dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('valida paciente, síntomas y fecha con mensajes propios en español', () => {
      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.text()).toContain('Selecciona el paciente');
      expect(harness.text()).toContain('Ingresa los síntomas');
      expect(harness.text()).toContain('Ingresa la fecha y hora de la visita');
      expect(harness.text()).toContain('Elige la hora de la visita');
      expect(harness.text()).toContain('Elige el minuto de la visita');
      harness.httpMock.expectNone((request) => request.method === 'POST');
      expect(harness.dialogRefStub.close).not.toHaveBeenCalled();
    });

    it('exige al menos 3 caracteres en los síntomas', () => {
      fillValid(harness);
      harness.component.form.controls.symptoms.setValue('ab');
      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.text()).toContain('Ingresa al menos 3 caracteres en los síntomas.');
      harness.httpMock.expectNone((request) => request.method === 'POST');
    });

    it('rechaza una fecha futura con la tolerancia de un minuto (S10)', () => {
      fillValid(harness);
      const naive = toNaiveDateTime(new Date(Date.now() + 10 * 60_000));
      const [datePart, timePart] = naive.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':');
      harness.component.form.patchValue({
        visitedDate: new Date(year, month - 1, day),
        visitedHour: hour,
        visitedMinute: minute,
      });

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.text()).toContain('La fecha de la visita no puede estar en el futuro.');
      harness.httpMock.expectNone((request) => request.method === 'POST');
    });

    it('el buscador de paciente carga la primera página activa al enfocar (S5)', () => {
      const input = harness
        .host()
        .querySelector<HTMLInputElement>('input.dm-visit-form__patient-input');

      expect(input).not.toBeNull();

      input!.dispatchEvent(new FocusEvent('focus'));
      harness.fixture.detectChanges();

      const req = harness.httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.get('is_active')).toBe('true');
      expect(req.request.params.has('search')).toBe(false);
      req.flush(patientsPage());
      harness.fixture.detectChanges();

      expect(harness.component.patientOptions()).toHaveLength(1);
    });

    it('borrar el buscador de paciente suelta la selección y vuelve a ser obligatorio', () => {
      harness.component.onPatientSelected(selectedPatient());
      expect(harness.component.form.controls.patientId.value).toBe(9);

      vi.useFakeTimers();
      harness.component.patientSearch.setValue('');
      vi.advanceTimersByTime(300);

      harness.httpMock
        .expectOne((request) => request.url === PATIENTS_URL && request.method === 'GET')
        .flush(patientsPage());

      expect(harness.component.form.controls.patientId.value).toBeNull();

      vi.useRealTimers();
      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.text()).toContain('Selecciona el paciente');
      harness.httpMock.expectNone((request) => request.method === 'POST');
    });

    it('busca el paciente en el servidor con debounce de 300 ms (S5)', () => {
      vi.useFakeTimers();
      const input = harness
        .host()
        .querySelector<HTMLInputElement>('input.dm-visit-form__patient-input');

      expect(input).not.toBeNull();

      input!.value = 'sin';
      input!.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(300);

      const req = harness.httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('search')).toBe('sin');
      expect(req.request.params.get('is_active')).toBe('true');
      expect(req.request.params.get('size')).toBe('20');
      req.flush({ items: [], total: 0, page: 1, size: 20, pages: 0 });
    });

    it('el buscador de medicamento carga la primera página activa al enfocar (S5)', () => {
      harness.component.addMedication();
      harness.fixture.detectChanges();

      const input = harness
        .host()
        .querySelector<HTMLInputElement>('.dm-visit-form__medication-field input');

      expect(input).not.toBeNull();

      input!.dispatchEvent(new FocusEvent('focus'));
      harness.fixture.detectChanges();

      const req = harness.httpMock.expectOne(
        (request) => request.url === MEDICATIONS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.get('is_active')).toBe('true');
      expect(req.request.params.has('search')).toBe(false);
      req.flush(medicationsPage());
      harness.fixture.detectChanges();

      expect(harness.component.rows()[0].options()).toEqual([
        { id: 3, label: 'Paracetamol sintético' },
      ]);
    });

    it('borrar el buscador de medicamento suelta la elección de la fila', () => {
      harness.component.addMedication();
      const [row] = harness.component.rows();
      harness.component.onMedicationSelected(row, { id: 3, label: 'Paracetamol sintético' });
      expect(row.form.controls.medicationId.value).toBe(3);

      vi.useFakeTimers();
      row.search.setValue('');
      vi.advanceTimersByTime(300);

      harness.httpMock
        .expectOne((request) => request.url === MEDICATIONS_URL && request.method === 'GET')
        .flush(medicationsPage());

      expect(row.form.controls.medicationId.value).toBeNull();
      vi.useRealTimers();
    });

    it('agrega filas de medicamentos con búsqueda de servidor y evita duplicados (S4/S5)', () => {
      harness.component.addMedication();
      harness.component.addMedication();
      harness.fixture.detectChanges();

      expect(harness.host().querySelectorAll('.dm-visit-form__medication-row')).toHaveLength(2);

      const [first, second] = harness.component.rows();
      vi.useFakeTimers();
      first.search.setValue('para');
      vi.advanceTimersByTime(300);

      const req = harness.httpMock.expectOne(
        (request) => request.url === MEDICATIONS_URL && request.method === 'GET',
      );
      expect(req.request.params.get('search')).toBe('para');
      expect(req.request.params.get('is_active')).toBe('true');
      expect(req.request.params.get('size')).toBe('20');
      req.flush(medicationsPage());
      expect(first.options()).toEqual([{ id: 3, label: 'Paracetamol sintético' }]);

      vi.useRealTimers();
      harness.component.onMedicationSelected(first, { id: 3, label: 'Paracetamol sintético' });
      harness.component.onMedicationSelected(second, { id: 3, label: 'Paracetamol sintético' });
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.medications.hasError('duplicate')).toBe(true);
      expect(harness.text()).toContain('No se puede repetir el mismo medicamento en una visita.');

      fillValid(harness);
      harness.component.onSubmit();

      harness.httpMock.expectNone((request) => request.method === 'POST');
      expect(harness.dialogRefStub.close).not.toHaveBeenCalled();
    });

    it('envía cantidad numérica, texto libre o null y descarta las filas sin medicamento', () => {
      harness.component.addMedication();
      harness.component.addMedication();
      harness.component.addMedication();
      const [first, second, third] = harness.component.rows();

      harness.component.onMedicationSelected(first, { id: 3, label: 'Paracetamol sintético' });
      first.form.controls.quantity.setValue('2');
      first.form.controls.instructions.setValue('  Cada 8 horas  ');

      harness.component.onMedicationSelected(second, { id: 4, label: 'Ibuprofeno sintético' });
      second.form.controls.quantity.setValue('1 tableta');

      third.form.controls.quantity.setValue('5');

      fillValid(harness);
      harness.component.onSubmit();

      const req = harness.httpMock.expectOne((request) => request.method === 'POST');
      const body = req.request.body as Record<string, unknown>;

      expect(body['medications']).toEqual([
        { medication_id: 3, quantity: 2, instructions: 'Cada 8 horas' },
        { medication_id: 4, quantity: '1 tableta', instructions: null },
      ]);

      req.flush(visitReadDto(), { status: 201, statusText: 'Created' });
    });

    it('quitar una fila de medicamento la excluye del body', () => {
      harness.component.addMedication();
      harness.component.addMedication();
      const [first] = harness.component.rows();

      harness.component.onMedicationSelected(first, { id: 3, label: 'Paracetamol sintético' });
      harness.component.removeMedication(1);
      harness.fixture.detectChanges();

      expect(harness.component.rows()).toHaveLength(1);

      fillValid(harness);
      harness.component.onSubmit();

      const req = harness.httpMock.expectOne((request) => request.method === 'POST');
      const body = req.request.body as Record<string, unknown>;

      expect(body['medications']).toEqual([
        { medication_id: 3, quantity: null, instructions: null },
      ]);
      req.flush(visitReadDto(), { status: 201, statusText: 'Created' });
    });

    it('un 422 deja el diálogo abierto con el mensaje del sistema', () => {
      fillValid(harness);
      harness.component.onSubmit();

      const req = harness.httpMock.expectOne((request) => request.method === 'POST');
      req.flush(
        { message: 'raw backend', errors: [{ field: 'symptoms', message: 'too short' }] },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      harness.fixture.detectChanges();

      expect(harness.text()).toContain('Revisa los datos ingresados.');
      expect(harness.text()).toContain('Revisa los síntomas');
      expect(harness.text()).not.toContain('raw backend');
      expect(harness.component.submitting()).toBe(false);
      expect(harness.dialogRefStub.close).not.toHaveBeenCalled();
    });
  });

  describe('modo creación ADMIN (S11)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'create' }, 'ADMIN');
      harness.fixture.detectChanges();
    });

    afterEach(() => {
      harness.httpMock.verify();
    });

    it('tampoco ofrece un control de médico ni pide su catálogo', () => {
      expect(harness.host().querySelector('mat-select[formControlName="doctorId"]')).toBeNull();
      expect(harness.host().querySelector('input[formControlName="doctorId"]')).toBeNull();
      expect(harness.text()).not.toContain('Médico');
      harness.httpMock.expectNone((request) => request.url === DOCTORS_URL);
    });
  });

  describe('modo edición (S6)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'edit', visitId: 31 }, 'MEDICO');
      harness.fixture.detectChanges();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('precarga la visita y reemplaza la lista de medicamentos en el PUT', () => {
      const request = harness.httpMock.expectOne(
        (req) => req.url === `${VISITS_URL}/31` && req.method === 'GET',
      );
      request.flush(visitReadDto());
      harness.fixture.detectChanges();

      expect(harness.text()).toContain('Editar visita');
      expect(harness.component.form.controls.patientId.value).toBe(9);
      expect(harness.component.form.controls.visitedDate.value).toEqual(visitDate());
      expect(harness.component.form.controls.visitedHour.value).toBe('10');
      expect(harness.component.form.controls.visitedMinute.value).toBe('00');
      expect(harness.component.form.controls.symptoms.value).toBe('Dolor de cabeza');
      expect(harness.component.form.controls.recommendations.value).toBe('Reposo');
      expect(harness.component.rows()).toHaveLength(1);

      // El usuario quita el medicamento previo y deja uno distinto: la lista
      // enviada sustituye a la anterior (no se mezcla).
      harness.component.removeMedication(0);
      harness.component.addMedication();
      const [row] = harness.component.rows();
      harness.component.onMedicationSelected(row, { id: 4, label: 'Ibuprofeno sintético' });
      row.form.controls.quantity.setValue('3');

      harness.component.form.controls.symptoms.setValue('Control');
      harness.component.onSubmit();

      const put = harness.httpMock.expectOne(
        (req) => req.url === `${VISITS_URL}/31` && req.method === 'PUT',
      );
      const body = put.request.body as Record<string, unknown>;

      expect('doctor_id' in body).toBe(false);
      expect(body['patient_id']).toBe(9);
      expect(body['visited_at']).toBe('2026-10-27T10:00:00');
      expect(body['symptoms']).toBe('Control');
      expect(body['recommendations']).toBe('Reposo');
      expect(body['medications']).toEqual([{ medication_id: 4, quantity: 3, instructions: null }]);

      put.flush(visitReadDto({ symptoms: 'Control' }));
      expect(harness.dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('un 404 al precargar cierra el diálogo con { notFound: true }', () => {
      harness.httpMock
        .expectOne((req) => req.url === `${VISITS_URL}/31`)
        .flush({ detail: 'Not Found' }, { status: 404, statusText: 'Not Found' });

      expect(harness.dialogRefStub.close).toHaveBeenCalledWith({ notFound: true });
    });

    it('un 409 visit_annulled al guardar cierra con { annulled: true } (S8)', () => {
      harness.flushVisit();
      harness.fixture.detectChanges();

      harness.component.onSubmit();

      const put = harness.httpMock.expectOne((req) => req.method === 'PUT');
      put.flush(
        { code: 'visit_annulled', detail: 'Visit is annulled' },
        { status: 409, statusText: 'Conflict' },
      );

      expect(harness.dialogRefStub.close).toHaveBeenCalledWith({ annulled: true });
    });

    it('«Cancelar» cierra sin guardar ni emitir peticiones de escritura', () => {
      harness.flushVisit();
      harness.fixture.detectChanges();

      const cancel = harness
        .host()
        .querySelector<HTMLButtonElement>('mat-dialog-actions button[mat-dialog-close]');

      cancel?.click();

      expect(harness.dialogRefStub.close).toHaveBeenCalled();
      harness.httpMock.expectNone((req) => req.method === 'PUT' || req.method === 'POST');
    });
  });
});
