import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { type Patient } from '../../patients/patients.models';
import { VISIT_ALREADY_ANNULLED_MESSAGE, VISIT_ANNULLED_MESSAGE } from '../visits-error';
import { VisitsToast } from '../visits-toast';
import { VisitList } from './visit-list';

const VISITS_URL = `${environment.apiUrl}/v1/visits`;
const PATIENTS_URL = `${environment.apiUrl}/v1/patients`;
const DOCTORS_URL = `${environment.apiUrl}/v1/doctors`;
const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;

function visitItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

function pageResponse(items: Record<string, unknown>[]): Record<string, unknown> {
  return { items, total: items.length, page: 1, size: 20, pages: 1 };
}

function patientCatalogue(): Record<string, unknown> {
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

function doctorsCatalogue(): Record<string, unknown> {
  return {
    items: [
      {
        id: 5,
        name: 'Dra. Sintética',
        cedula: '12345678901',
        lab_shift: 'MATUTINA',
        specialty: 'Medicina general',
        is_active: true,
        user: null,
      },
    ],
    total: 1,
    page: 1,
    size: 20,
    pages: 1,
  };
}

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

function createToastStub(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    showCreated: vi.fn(),
    showUpdated: vi.fn(),
    showAnnulled: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
  };
}

describe('VisitList (F-015 S1/S2/S5/S8/S11/S13/S14)', () => {
  let fixture: ComponentFixture<VisitList>;
  let component: VisitList;
  let httpMock: HttpTestingController;
  let dialogStub: { open: ReturnType<typeof vi.fn> };
  let toastStub: Record<string, ReturnType<typeof vi.fn>>;

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

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function flushList(items: Record<string, unknown>[] = [visitItem()]): void {
    httpMock
      .expectOne((request) => request.url === VISITS_URL && request.method === 'GET')
      .flush(pageResponse(items));
    fixture.detectChanges();
  }

  function ownStyleText(): string {
    return Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .filter((css) => css.includes('.dm-visit-list'))
      .join('\n');
  }

  async function configure(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [VisitList],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: dialogStub },
        { provide: VisitsToast, useValue: toastStub },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VisitList);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    localStorage.clear();
    dialogStub = { open: vi.fn() };
    toastStub = createToastStub();
  });

  afterEach(() => {
    fixture?.nativeElement?.remove?.();
    httpMock?.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('listado base (S1)', () => {
    beforeEach(async () => {
      await configure();
      loginAs('MEDICO');
      fixture.detectChanges();
    });

    it('emite un único GET page=1&size=20 sin criterios por defecto', () => {
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

      req.flush(pageResponse([]));
    });

    it('muestra paciente con cédula enmascarada, médico, fecha en UTC-4 y estado', () => {
      flushList();

      const text = host().textContent ?? '';

      expect(host().querySelector('table[aria-label="Visitas"]')).not.toBeNull();
      expect(text).toContain('Paciente Sintético');
      expect(text).toContain('123-4567890-1');
      expect(text).not.toContain('12345678901');
      expect(text).toContain('Dra. Sintética');
      // 10:00 sin zona se interpreta como hora de Santo Domingo.
      expect(text).toContain('10:00');
      expect(text).toContain('Registrada');
    });

    it('la tabla no tiene columna de síntomas ni de detalle', () => {
      flushList([visitItem({ symptoms: 'Dolor de cabeza' })]);

      const headers = Array.from(host().querySelectorAll('th.mat-mdc-header-cell')).map((cell) =>
        (cell.textContent ?? '').trim(),
      );

      expect(headers).toEqual(['Paciente', 'Médico', 'Fecha y hora', 'Estado', 'Acciones']);
      expect(headers).not.toContain('Síntomas');
      expect(headers).not.toContain('Detalle');
      // Los síntomas siguen disponibles en el detalle y en el formulario.
      expect(host().textContent).not.toContain('Dolor de cabeza');
    });

    it('el nombre del paciente es un ancla real al detalle, para teclado y lectores (S14)', () => {
      flushList();

      const link = host().querySelector<HTMLAnchorElement>('a.dm-visit-list__patient-link');

      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe('/visits/31');
      expect(link?.getAttribute('aria-label')).toBe(
        'Ver el detalle de la visita de Paciente Sintético',
      );
    });

    it('al hacer clic en la fila se navega al detalle de la visita (S9)', () => {
      flushList();

      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const row = host().querySelector<HTMLElement>('tr.dm-visit-list__row');

      expect(row).not.toBeNull();
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(navigate).toHaveBeenCalledWith(['/visits', 31]);
    });

    it('un MEDICO ve «Registrar visita» y las acciones de editar y anular (S11)', () => {
      flushList();

      expect(host().querySelector('.dm-visit-list__new')?.textContent).toContain(
        'Registrar visita',
      );
      const row = host().querySelector('tr.mat-mdc-row');

      expect(host().textContent).toContain('Acciones');
      expect(row?.querySelector('[aria-label*="Editar"]')).not.toBeNull();
      expect(row?.querySelector('[aria-label*="Anular"]')).not.toBeNull();
    });

    it('marca la fila anulada con su badge y sin controles de edición ni anulación (S8)', () => {
      flushList([visitItem({ id: 32, status: 'ANULADA', symptoms: 'Control anulado' })]);

      const row = host().querySelector('tr.mat-mdc-row');

      expect(row?.textContent).toContain('Anulada');
      expect(row?.querySelector('.dm-visit-list__status-badge--annulled')).not.toBeNull();
      expect(row?.querySelector('[aria-label*="Editar"]')).toBeNull();
      expect(row?.querySelector('[aria-label*="Anular"]')).toBeNull();
      // El detalle sigue disponible: ahí se consulta el motivo de anulación.
      expect(row?.querySelector('a.dm-visit-list__patient-link')?.getAttribute('href')).toBe(
        '/visits/32',
      );
    });

    it('ofrece orden de servidor por fecha y estado con reset a la primera página', () => {
      flushList([visitItem()]);
      component.onPage({ pageIndex: 2, pageSize: 20, length: 100 } as PageEvent);

      const secondPage = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.params.get('page') === '3',
      );
      secondPage.flush(pageResponse([visitItem()]));

      component.onSort({ active: 'visited_at', direction: 'desc' } as Sort);
      const sorted = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.params.get('page') === '1',
      );
      expect(sorted.request.params.get('sort')).toBe('-visited_at');
      sorted.flush(pageResponse([visitItem()]));
    });

    it('cambiar el tamaño de página vuelve a la primera página', () => {
      flushList([visitItem()]);
      component.onPage({ pageIndex: 3, pageSize: 50, length: 200 } as PageEvent);

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.params.get('size') === '50',
      );
      expect(req.request.params.get('page')).toBe('1');
      req.flush(pageResponse([]));
    });
  });

  describe('filtros combinables (S2)', () => {
    beforeEach(async () => {
      await configure();
      loginAs('ADMIN');
      fixture.detectChanges();
      flushList([visitItem()]);
    });

    it('no tiene campo de búsqueda libre y el GET nunca envía q (S2)', () => {
      expect(host().querySelector('.dm-visit-list__search')).toBeNull();
      expect(host().textContent).not.toContain('Buscar visitas');
      expect(host().querySelector('input[type="search"]')).toBeNull();

      component.statusFilter.setValue('REGISTRADA');

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.params.get('status') === 'REGISTRADA',
      );
      expect(req.request.params.has('q')).toBe(false);
      req.flush(pageResponse([]));
    });

    it('«Desde» y «Hasta» son calendarios Material y se combinan en un solo GET inclusivo', () => {
      const dateFields = Array.from(host().querySelectorAll('.dm-visit-list__date-filter'));

      expect(dateFields).toHaveLength(2);
      expect(host().querySelectorAll('.dm-visit-list__date-filter mat-datepicker')).toHaveLength(2);
      expect(
        host().querySelectorAll('.dm-visit-list__date-filter mat-datepicker-toggle'),
      ).toHaveLength(2);
      expect(
        dateFields.map((field) => field.querySelector('input')?.getAttribute('type')),
      ).not.toContain('date');
      expect(host().textContent).toContain('Desde');
      expect(host().textContent).toContain('Hasta');

      component.statusFilter.setValue('ANULADA');
      httpMock
        .expectOne(
          (request) => request.url === VISITS_URL && request.params.get('status') === 'ANULADA',
        )
        .flush(pageResponse([]));

      component.dateFrom.setValue(new Date(2026, 9, 1));
      httpMock
        .expectOne(
          (request) =>
            request.url === VISITS_URL && request.params.get('date_from') === '2026-10-01T00:00:00',
        )
        .flush(pageResponse([]));

      component.dateTo.setValue(new Date(2026, 9, 31));
      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.params.get('status') === 'ANULADA',
      );

      expect(req.request.params.get('date_from')).toBe('2026-10-01T00:00:00');
      expect(req.request.params.get('date_to')).toBe('2026-10-31T23:59:59');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(pageResponse([]));
    });

    it('permite limpiar el rango de fechas y vuelve a pedir la primera página', () => {
      component.dateFrom.setValue(new Date(2026, 9, 1));
      httpMock
        .expectOne((request) => request.url === VISITS_URL && request.params.has('date_from'))
        .flush(pageResponse([]));
      component.dateTo.setValue(new Date(2026, 9, 31));
      httpMock
        .expectOne((request) => request.url === VISITS_URL && request.params.has('date_to'))
        .flush(pageResponse([]));

      component.clearDateFrom();
      const clearedFrom = httpMock.expectOne(
        (request) => request.url === VISITS_URL && !request.params.has('date_from'),
      );
      expect(clearedFrom.request.params.get('date_to')).toBe('2026-10-31T23:59:59');
      clearedFrom.flush(pageResponse([]));

      component.clearDateTo();
      const clearedBoth = httpMock.expectOne(
        (request) =>
          request.url === VISITS_URL &&
          !request.params.has('date_from') &&
          !request.params.has('date_to'),
      );
      expect(component.dateFrom.value).toBeNull();
      expect(component.dateTo.value).toBeNull();
      clearedBoth.flush(pageResponse([]));
    });

    it('el buscador de paciente carga la primera página de activos al abrir el panel (S5)', () => {
      const input = host().querySelector<HTMLInputElement>('.dm-visit-list__patient-filter input');

      expect(input).not.toBeNull();

      input!.dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();

      const req = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.get('is_active')).toBe('true');
      expect(req.request.params.has('search')).toBe(false);
      req.flush(patientCatalogue());
      fixture.detectChanges();

      expect(component.patientOptions()).toHaveLength(1);
    });

    it('el buscador de paciente filtra en el servidor al escribir y aplica patient_id', () => {
      vi.useFakeTimers();
      component.patientFilter.setValue('sin');
      vi.advanceTimersByTime(300);

      const search = httpMock.expectOne(
        (request) => request.url === PATIENTS_URL && request.method === 'GET',
      );
      expect(search.request.params.get('search')).toBe('sin');
      expect(search.request.params.get('is_active')).toBe('true');
      expect(search.request.params.get('size')).toBe('20');
      search.flush(patientCatalogue());
      expect(component.patientOptions()).toHaveLength(1);

      // Ningún GET de visitas mientras solo se escribe en el buscador.
      expect(
        httpMock.expectNone(
          (request) => request.url === VISITS_URL && request.params.has('patient_id'),
        ),
      ).toBeUndefined();

      vi.useRealTimers();
      component.onPatientSelected(selectedPatient());

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.params.get('patient_id') === '9',
      );
      expect(req.request.params.get('page')).toBe('1');
      expect(component.patientFilter.value).toBe('Paciente Sintético');
      req.flush(pageResponse([]));
    });

    it('permite limpiar el filtro de paciente', () => {
      component.onPatientSelected(selectedPatient());
      httpMock
        .expectOne((request) => request.url === VISITS_URL && request.params.has('patient_id'))
        .flush(pageResponse([]));

      component.clearPatientFilter();

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && !request.params.has('patient_id'),
      );
      expect(component.selectedPatient()).toBeNull();
      expect(component.patientFilter.value).toBe('');
      req.flush(pageResponse([]));
    });

    it('borrar el texto del buscador de paciente suelta el filtro aplicado', () => {
      component.onPatientSelected(selectedPatient());
      httpMock
        .expectOne((request) => request.url === VISITS_URL && request.params.has('patient_id'))
        .flush(pageResponse([]));

      vi.useFakeTimers();
      component.patientFilter.setValue('');
      vi.advanceTimersByTime(300);

      const list = httpMock.expectOne(
        (request) => request.url === VISITS_URL && !request.params.has('patient_id'),
      );
      expect(component.selectedPatient()).toBeNull();
      list.flush(pageResponse([]));

      // Y el panel vuelve a ofrecer la primera página de activos.
      httpMock
        .expectOne((request) => request.url === PATIENTS_URL && request.method === 'GET')
        .flush(patientCatalogue());
    });

    it('el filtro de médico es una búsqueda que carga la primera página activa al abrirse (S2/S5)', () => {
      const field = host().querySelector('.dm-visit-list__doctor-filter');

      expect(field).not.toBeNull();
      expect(field?.textContent).toContain('Médico');
      expect(field?.querySelector('mat-select')).toBeNull();

      const input = field?.querySelector<HTMLInputElement>('input');
      expect(input).not.toBeNull();

      input!.dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();

      const req = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.get('is_active')).toBe('true');
      expect(req.request.params.has('search')).toBe(false);
      req.flush(doctorsCatalogue());
      fixture.detectChanges();

      expect(component.doctorOptions()).toEqual([{ id: 5, name: 'Dra. Sintética' }]);

      component.onDoctorSelected({ id: 5, name: 'Dra. Sintética' });

      const list = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.params.get('doctor_id') === '5',
      );
      expect(list.request.params.get('page')).toBe('1');
      expect(component.doctorFilter.value).toBe('Dra. Sintética');
      list.flush(pageResponse([]));
    });

    it('el filtro de médico filtra en el servidor al escribir (S5)', () => {
      vi.useFakeTimers();
      component.doctorFilter.setValue('sin');
      vi.advanceTimersByTime(300);

      const req = httpMock.expectOne(
        (request) => request.url === DOCTORS_URL && request.method === 'GET',
      );

      expect(req.request.params.get('search')).toBe('sin');
      expect(req.request.params.get('is_active')).toBe('true');
      expect(req.request.params.get('size')).toBe('20');
      req.flush(doctorsCatalogue());
      expect(component.doctorOptions()).toHaveLength(1);
      // Escribir no filtra el listado: solo elegir una opción.
      httpMock.expectNone(
        (request) => request.url === VISITS_URL && request.params.has('doctor_id'),
      );
    });

    it('permite limpiar el filtro de médico', () => {
      component.onDoctorSelected({ id: 5, name: 'Dra. Sintética' });
      httpMock
        .expectOne((request) => request.url === VISITS_URL && request.params.has('doctor_id'))
        .flush(pageResponse([]));

      component.clearDoctorFilter();

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && !request.params.has('doctor_id'),
      );
      expect(component.selectedDoctor()).toBeNull();
      expect(component.doctorFilter.value).toBe('');
      req.flush(pageResponse([]));
    });

    it('borrar el texto del buscador de médico suelta el filtro aplicado', () => {
      component.onDoctorSelected({ id: 5, name: 'Dra. Sintética' });
      httpMock
        .expectOne((request) => request.url === VISITS_URL && request.params.has('doctor_id'))
        .flush(pageResponse([]));

      vi.useFakeTimers();
      component.doctorFilter.setValue('');
      vi.advanceTimersByTime(300);

      const list = httpMock.expectOne(
        (request) => request.url === VISITS_URL && !request.params.has('doctor_id'),
      );
      expect(component.selectedDoctor()).toBeNull();
      list.flush(pageResponse([]));

      httpMock
        .expectOne((request) => request.url === DOCTORS_URL && request.method === 'GET')
        .flush(doctorsCatalogue());
    });
  });

  describe('permisos ADMIN de solo lectura (S11)', () => {
    beforeEach(async () => {
      await configure();
      loginAs('ADMIN');
      fixture.detectChanges();
      flushList([visitItem()]);
    });

    it('no tiene ningún control de escritura en el DOM', () => {
      expect(host().querySelector('.dm-visit-list__new')).toBeNull();
      expect(host().textContent).not.toContain('Registrar visita');
      expect(host().textContent).not.toContain('Acciones');
      expect(host().querySelector('[aria-label*="Editar"]')).toBeNull();
      expect(host().querySelector('[aria-label*="Anular"]')).toBeNull();
      // Sigue supervisando con el filtro de médico y consultando el detalle.
      expect(host().querySelector('.dm-visit-list__doctor-filter')).not.toBeNull();
      expect(host().querySelector('a.dm-visit-list__patient-link')).not.toBeNull();
    });

    it('su listado sigue funcionando sin enviar doctor_id cuando no elige médico', () => {
      component.statusFilter.setValue('REGISTRADA');

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.params.get('status') === 'REGISTRADA',
      );
      expect(req.request.params.has('doctor_id')).toBe(false);
      req.flush(pageResponse([]));
    });
  });

  describe('permisos MEDICO (S11)', () => {
    beforeEach(async () => {
      await configure();
      loginAs('MEDICO');
      fixture.detectChanges();
      flushList([visitItem()]);
    });

    it('no ve el filtro de médico ni lo envía al listar', () => {
      expect(host().querySelector('.dm-visit-list__doctor-filter')).toBeNull();
      expect(host().querySelector('input[aria-label="Filtrar por médico"]')).toBeNull();

      component.statusFilter.setValue('REGISTRADA');

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.params.get('status') === 'REGISTRADA',
      );
      expect(req.request.params.has('doctor_id')).toBe(false);
      req.flush(pageResponse([]));
    });
  });

  describe('estados de UI (S13/S14)', () => {
    beforeEach(async () => {
      await configure();
      loginAs('ADMIN');
      fixture.detectChanges();
    });

    it('muestra el vacío propio cuando la carga termina sin filas', () => {
      flushList([]);

      expect(host().textContent).toContain('No hay visitas para mostrar.');
    });

    it('anuncia la carga en la región de la tabla y la superpone sin robar el puntero', () => {
      const region = host().querySelector('.dm-visit-list__table-region');

      expect(region?.getAttribute('aria-busy')).toBe('true');
      expect(host().querySelector('.dm-visit-list__loading')).not.toBeNull();
      expect(ownStyleText()).toContain('pointer-events: none');
      // Solo tokens: sin hex literales ni ::ng-deep (S14).
      expect(ownStyleText()).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(ownStyleText()).not.toContain('::ng-deep');

      flushList([]);
      expect(host().querySelector('.dm-visit-list__table-region')?.getAttribute('aria-busy')).toBe(
        'false',
      );
    });

    it('muestra el error de carga inline con reintento que republica los criterios vigentes', () => {
      httpMock
        .expectOne((request) => request.url === VISITS_URL)
        .flush({ detail: 'boom' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      const alert = host().querySelector('[role="alert"]');
      expect(alert?.textContent).toContain(
        'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
      );
      expect(alert?.textContent).not.toContain('boom');
      expect(host().textContent).not.toContain('No hay visitas para mostrar.');

      const retry = host().querySelector('.dm-visit-list__retry') as HTMLButtonElement;
      retry.click();

      const req = httpMock.expectOne(
        (request) => request.url === VISITS_URL && request.params.get('page') === '1',
      );
      req.flush(pageResponse([visitItem()]));
      fixture.detectChanges();

      expect(host().querySelector('[role="alert"]')).toBeNull();
      expect(host().textContent).toContain('Paciente Sintético');
    });
  });

  describe('diálogos y toasts (S3/S6/S7)', () => {
    beforeEach(async () => {
      await configure();
      loginAs('MEDICO');
      fixture.detectChanges();
      flushList([visitItem()]);
    });

    it('«Registrar visita» recarga con el toast de creación al guardar', () => {
      dialogStub.open.mockReturnValue({ afterClosed: () => of('saved') });

      component.openCreate();
      fixture.detectChanges();

      expect(dialogStub.open).toHaveBeenCalledTimes(1);
      expect(toastStub['showCreated']).toHaveBeenCalledTimes(1);

      const req = httpMock.expectOne((request) => request.url === VISITS_URL);
      req.flush(pageResponse([visitItem()]));
    });

    it('editar con 404 al precargar avisa y recarga sin abrir un segundo diálogo', () => {
      dialogStub.open.mockReturnValue({ afterClosed: () => of({ notFound: true }) });

      component.openEdit(component.items()[0]);
      fixture.detectChanges();

      expect(toastStub['showError']).toHaveBeenCalledWith(
        'La visita solicitada ya no existe. Actualiza la lista.',
      );
      httpMock.expectOne((request) => request.url === VISITS_URL).flush(pageResponse([]));
    });

    it('editar una visita anulada traduce el 409 y recarga (S8)', () => {
      dialogStub.open.mockReturnValue({ afterClosed: () => of({ annulled: true }) });

      component.openEdit(component.items()[0]);
      fixture.detectChanges();

      expect(toastStub['showError']).toHaveBeenCalledWith(VISIT_ANNULLED_MESSAGE);
      httpMock.expectOne((request) => request.url === VISITS_URL).flush(pageResponse([]));
    });

    it('anular recarga con el toast propio y avisa si ya estaba anulada (S7)', () => {
      const visit = component.items()[0];
      dialogStub.open.mockReturnValue({ afterClosed: () => of('annulled') });

      component.openAnnul(visit);
      fixture.detectChanges();

      expect(toastStub['showAnnulled']).toHaveBeenCalledTimes(1);
      httpMock
        .expectOne((request) => request.url === VISITS_URL)
        .flush(pageResponse([visitItem()]));

      dialogStub.open.mockReturnValue({ afterClosed: () => of({ alreadyAnnulled: true }) });

      component.openAnnul(component.items()[0]);
      fixture.detectChanges();

      expect(toastStub['showError']).toHaveBeenCalledWith(VISIT_ALREADY_ANNULLED_MESSAGE);
      httpMock
        .expectOne((request) => request.url === VISITS_URL)
        .flush(pageResponse([visitItem()]));
    });

    it('cancelar el diálogo no emite ningún GET ni toast', () => {
      dialogStub.open.mockReturnValue({ afterClosed: () => of(undefined) });

      component.openCreate();
      fixture.detectChanges();

      httpMock.expectNone((request) => request.url === VISITS_URL);
      expect(toastStub['showCreated']).not.toHaveBeenCalled();
      expect(toastStub['showError']).not.toHaveBeenCalled();
    });
  });
});
