import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { VisitAnnulData, VisitAnnulDialog } from './visit-annul';

const VISITS_URL = `${environment.apiUrl}/v1/visits`;

function data(): VisitAnnulData {
  return {
    visitId: 31,
    patientName: 'Paciente Sintético',
    visitedAt: '2026-10-27T10:00:00',
  };
}

interface Harness {
  fixture: ComponentFixture<VisitAnnulDialog>;
  component: VisitAnnulDialog;
  httpMock: HttpTestingController;
  dialogRefStub: { close: ReturnType<typeof vi.fn> };
  host: () => HTMLElement;
  text: () => string;
}

async function configure(): Promise<Harness> {
  const dialogRefStub = { close: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [VisitAnnulDialog],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data() },
      { provide: MatDialogRef, useValue: dialogRefStub },
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(VisitAnnulDialog);
  fixture.detectChanges();

  return {
    fixture,
    component: fixture.componentInstance,
    httpMock,
    dialogRefStub,
    host: () => fixture.nativeElement as HTMLElement,
    text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
  };
}

describe('VisitAnnulDialog (F-015 S7/S9/S12)', () => {
  let harness: Harness;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    harness = await configure();
  });

  afterEach(() => {
    harness.httpMock.verify();
    vi.restoreAllMocks();
  });

  it('pide el motivo en un textarea obligatorio de hasta 500 caracteres', () => {
    const textarea = harness
      .host()
      .querySelector<HTMLTextAreaElement>('textarea[formControlName="reason"]');

    expect(harness.text()).toContain('Anular visita');
    expect(harness.text()).toContain('Paciente Sintético');
    expect(textarea).not.toBeNull();
    expect(textarea?.getAttribute('maxlength')).toBe('500');
    expect(harness.text()).toContain('Hasta 500 caracteres.');
    expect(harness.text()).toContain('Cancelar');
    expect(harness.text()).toContain('Anular');
  });

  it('no envía nada cuando el motivo está vacío o solo tiene espacios', () => {
    harness.component.reason.setValue('   ');
    harness.component.onSubmit();
    harness.fixture.detectChanges();

    expect(harness.text()).toContain('Ingresa el motivo de la anulación.');
    harness.httpMock.expectNone((request) => request.method === 'POST');
    expect(harness.dialogRefStub.close).not.toHaveBeenCalled();
  });

  it('envía POST /{id}/annul con el motivo recortado y cierra con «annulled»', () => {
    harness.component.reason.setValue('  Registro duplicado  ');
    harness.component.onSubmit();

    const req = harness.httpMock.expectOne(
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

    expect(harness.dialogRefStub.close).toHaveBeenCalledWith('annulled');
  });

  it('traduce el 409 visit_already_annulled y cierra avisando (S7)', () => {
    harness.component.reason.setValue('Registro duplicado');
    harness.component.onSubmit();

    harness.httpMock
      .expectOne((request) => request.url === `${VISITS_URL}/31/annul`)
      .flush(
        { code: 'visit_already_annulled', detail: 'Visit already annulled' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(harness.dialogRefStub.close).toHaveBeenCalledWith({ alreadyAnnulled: true });
  });

  it('un 404 deja el diálogo abierto con el mensaje del sistema', () => {
    harness.component.reason.setValue('Registro duplicado');
    harness.component.onSubmit();

    harness.httpMock
      .expectOne((request) => request.url === `${VISITS_URL}/31/annul`)
      .flush({ detail: 'Not Found' }, { status: 404, statusText: 'Not Found' });
    harness.fixture.detectChanges();

    expect(harness.text()).toContain('La visita solicitada ya no existe. Actualiza la lista.');
    expect(harness.text()).not.toContain('Not Found');
    expect(harness.component.submitting()).toBe(false);
    expect(harness.dialogRefStub.close).not.toHaveBeenCalled();
  });

  it('un 403 se traduce sin exponer el mensaje del backend', () => {
    harness.component.reason.setValue('Registro duplicado');
    harness.component.onSubmit();

    harness.httpMock
      .expectOne((request) => request.url === `${VISITS_URL}/31/annul`)
      .flush({ detail: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    harness.fixture.detectChanges();

    expect(harness.text()).toContain('No tienes permiso para gestionar visitas.');
    expect(harness.text()).not.toContain('Forbidden');
  });
});
