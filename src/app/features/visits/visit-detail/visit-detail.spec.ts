import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { VisitDetail } from './visit-detail';

const VISITS_URL = `${environment.apiUrl}/v1/visits`;

function visitReadDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 31,
    doctor: { id: 5, name: 'Dra. Sintética' },
    patient: { id: 9, name: 'Paciente Sintético', cedula: '12345678901' },
    visited_at: '2026-10-27T10:00:00',
    symptoms: 'Dolor de cabeza intenso desde ayer',
    recommendations: 'Reposo por 24 horas y control en una semana',
    status: 'REGISTRADA',
    created_by: 'admin.demo',
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

interface Harness {
  fixture: ComponentFixture<VisitDetail>;
  httpMock: HttpTestingController;
  host: () => HTMLElement;
  text: () => string;
}

async function configure(id: string | null): Promise<Harness> {
  await TestBed.configureTestingModule({
    imports: [VisitDetail],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(id === null ? {} : { id }) } },
      },
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(VisitDetail);

  return {
    fixture,
    httpMock,
    host: () => fixture.nativeElement as HTMLElement,
    text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
  };
}

describe('VisitDetail (F-015 S9/S16)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('carga GET /visits/{id} y muestra encabezado, síntomas, recomendaciones y medicamentos', async () => {
    const harness = await configure('31');
    harness.fixture.detectChanges();

    const req = harness.httpMock.expectOne(
      (request) => request.url === `${VISITS_URL}/31` && request.method === 'GET',
    );
    expect(
      harness.host().querySelector('.dm-visit-detail__table-region')?.getAttribute('aria-busy'),
    ).toBe('true');

    req.flush(visitReadDto());
    harness.fixture.detectChanges();

    expect(harness.text()).toContain('Paciente Sintético');
    expect(harness.text()).toContain('123-4567890-1');
    expect(harness.text()).toContain('Dra. Sintética');
    // 10:00 sin zona = hora de Santo Domingo.
    expect(harness.text()).toContain('10:00');
    expect(harness.text()).toContain('Dolor de cabeza intenso desde ayer');
    expect(harness.text()).toContain('Reposo por 24 horas y control en una semana');
    expect(harness.text()).toContain('Paracetamol sintético');
    expect(harness.text()).toContain('500 mg');
    expect(harness.text()).toContain('Cada 8 horas');
    expect(harness.text()).toContain('Registrada');
    // `created_by` sigue en el modelo, pero la vista ya no lo muestra.
    expect(harness.text()).not.toContain('Registrada por');
    expect(harness.text()).not.toContain('admin.demo');
    expect(
      harness.host().querySelector('table[aria-label="Medicamentos entregados"]'),
    ).not.toBeNull();

    const back = harness.host().querySelector<HTMLAnchorElement>('.dm-visit-detail__back');
    expect(back?.getAttribute('href')).toBe('/visits');
    harness.httpMock.verify();
  });

  it('muestra el bloque de anulación con motivo y auditoría (S9)', async () => {
    const harness = await configure('31');
    harness.fixture.detectChanges();

    harness.httpMock
      .expectOne((request) => request.url === `${VISITS_URL}/31`)
      .flush(
        visitReadDto({
          status: 'ANULADA',
          annulled_at: '2026-10-28T09:30:00',
          annulled_by: 'admin.demo',
          annulment_reason: 'Registro duplicado',
        }),
      );
    harness.fixture.detectChanges();

    const annulled = harness.host().querySelector('.dm-visit-detail__annulled');

    expect(annulled).not.toBeNull();
    expect(annulled?.textContent).toContain('Motivo de anulación');
    expect(annulled?.textContent).toContain('Registro duplicado');
    // El usuario que anuló no se muestra (decisión del 2026-10-27).
    expect(annulled?.textContent).not.toContain('Anulada por');
    expect(annulled?.textContent).not.toContain('admin.demo');
    expect(annulled?.textContent).toContain('09:30');
    expect(harness.text()).toContain('Anulada');
    harness.httpMock.verify();
  });

  it('tolera un detalle sin recommendations, medications ni campos de anulación (S16)', async () => {
    const harness = await configure('31');
    harness.fixture.detectChanges();

    harness.httpMock
      .expectOne((request) => request.url === `${VISITS_URL}/31`)
      .flush({ id: 31, symptoms: 'Control', visited_at: '2026-10-27T08:00:00' });
    harness.fixture.detectChanges();

    expect(harness.text()).toContain('Sin recomendaciones registradas.');
    expect(harness.text()).toContain('No se registraron medicamentos.');
    expect(harness.host().querySelector('.dm-visit-detail__annulled')).toBeNull();
    expect(harness.text()).toContain('Control');
    harness.httpMock.verify();
  });

  it('no muestra «Registrado por» en los datos de la visita (S9)', async () => {
    const harness = await configure('31');
    harness.fixture.detectChanges();

    harness.httpMock
      .expectOne((request) => request.url === `${VISITS_URL}/31`)
      .flush(
        visitReadDto({
          created_by: 'usuario.sintetico',
          annulled_at: '2026-10-28T09:30:00',
          annulled_by: 'usuario.sintetico',
          annulment_reason: 'Registro duplicado',
          status: 'ANULADA',
        }),
      );
    harness.fixture.detectChanges();

    const facts = Array.from(
      harness.host().querySelectorAll('.dm-visit-detail__summary .dm-visit-detail__term'),
    ).map((term) => (term.textContent ?? '').trim());

    expect(facts).toEqual(['Paciente', 'Médico', 'Fecha y hora', 'Estado']);
    expect(harness.text()).not.toContain('Registrado por');
    expect(harness.text()).not.toContain('Registrada por');
    // La auditoría de anulación se conserva (motivo y fecha); el usuario que
    // anuló no se muestra.
    expect(harness.text()).toContain('Motivo de anulación');
    expect(harness.text()).toContain('Anulada el');
    expect(harness.text()).not.toContain('Anulada por');
    expect(harness.text()).not.toContain('usuario.sintetico');
    harness.httpMock.verify();
  });

  it('un 404 (visita ajena para un MEDICO) muestra «no encontrada» con vuelta al listado', async () => {
    const harness = await configure('31');
    harness.fixture.detectChanges();

    harness.httpMock
      .expectOne((request) => request.url === `${VISITS_URL}/31`)
      .flush({ detail: 'Not Found' }, { status: 404, statusText: 'Not Found' });
    harness.fixture.detectChanges();

    const notFound = harness.host().querySelector('.dm-visit-detail__not-found');

    expect(notFound).not.toBeNull();
    expect(harness.text()).toContain('No se encontró la visita solicitada.');
    expect(harness.text()).not.toContain('Not Found');
    expect(harness.text()).not.toContain('Tabla de medicamentos');
    expect(notFound?.querySelector('a')?.getAttribute('href')).toBe('/visits');
    harness.httpMock.verify();
  });

  it('un error de carga se anuncia inline y el reintento republica el GET', async () => {
    const harness = await configure('31');
    harness.fixture.detectChanges();

    harness.httpMock
      .expectOne((request) => request.url === `${VISITS_URL}/31`)
      .flush({ detail: 'boom' }, { status: 500, statusText: 'Server Error' });
    harness.fixture.detectChanges();

    expect(harness.host().querySelector('[role="alert"]')?.textContent).toContain(
      'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
    );
    expect(harness.text()).not.toContain('boom');

    (harness.host().querySelector('.dm-visit-detail__retry') as HTMLButtonElement).click();

    harness.httpMock
      .expectOne((request) => request.url === `${VISITS_URL}/31`)
      .flush(visitReadDto());
    harness.fixture.detectChanges();

    expect(harness.host().querySelector('[role="alert"]')).toBeNull();
    expect(harness.text()).toContain('Paracetamol sintético');
    harness.httpMock.verify();
  });

  it('un id inválido resuelve «no encontrada» sin emitir peticiones', async () => {
    const harness = await configure('no-es-id');
    harness.fixture.detectChanges();

    expect(harness.host().querySelector('.dm-visit-detail__not-found')).not.toBeNull();
    harness.httpMock.expectNone((request) => request.url === VISITS_URL);
    harness.httpMock.verify();
  });

  it('el detalle es de solo lectura: no ofrece editar ni anular en el DOM', async () => {
    const harness = await configure('31');
    harness.fixture.detectChanges();

    harness.httpMock
      .expectOne((request) => request.url === `${VISITS_URL}/31`)
      .flush(visitReadDto());
    harness.fixture.detectChanges();

    const buttons = Array.from(harness.host().querySelectorAll('button'));

    expect(buttons.some((button) => button.textContent?.includes('Anular'))).toBe(false);
    expect(buttons.some((button) => button.textContent?.includes('Editar'))).toBe(false);
    harness.httpMock.verify();
  });
});
