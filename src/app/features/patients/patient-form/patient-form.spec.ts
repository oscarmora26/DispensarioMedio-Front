import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { PatientFormData, PatientFormDialog } from './patient-form';

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

interface Harness {
  fixture: ComponentFixture<PatientFormDialog>;
  component: PatientFormDialog;
  httpMock: HttpTestingController;
  dialogRefStub: { close: ReturnType<typeof vi.fn> };
  /** Escribe en el input de cédula como lo haría el usuario (input nativo). */
  typeCedula: (value: string) => void;
  /** Lee el input de cédula del DOM. */
  cedulaInput: () => HTMLInputElement;
  /** Texto visible del diálogo. */
  text: () => string;
}

async function configure(data: PatientFormData): Promise<Harness> {
  const dialogRefStub = { close: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [PatientFormDialog],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRefStub },
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(PatientFormDialog);
  const component = fixture.componentInstance;
  const host = () => fixture.nativeElement as HTMLElement;

  return {
    fixture,
    component,
    httpMock,
    dialogRefStub,
    typeCedula: (value: string) => {
      const input = host().querySelector<HTMLInputElement>('input[formControlName="cedula"]');
      if (input === null) {
        throw new Error('No se encontró el input de cédula');
      }
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
    cedulaInput: () => {
      const input = host().querySelector<HTMLInputElement>('input[formControlName="cedula"]');
      if (input === null) {
        throw new Error('No se encontró el input de cédula');
      }
      return input;
    },
    text: () => host().textContent ?? '',
  };
}

describe('PatientFormDialog (F-013 S2-S6/S8)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('modo creación (S2/S9)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'create' });
      harness.fixture.detectChanges();
    });

    afterEach(() => {
      harness.httpMock.verify();
    });

    it('muestra título, etiquetas visibles, hints y límites del contrato (S2/S9)', () => {
      const compiled = harness.fixture.nativeElement as HTMLElement;

      expect(harness.text()).toContain('Nuevo paciente');
      expect(harness.text()).toContain('Nombre completo');
      expect(harness.text()).toContain('Cédula');
      expect(harness.text()).toContain('Carnet');
      expect(harness.text()).toContain('Tipo de paciente');
      expect(harness.text()).toContain('Entre 1 y 150 caracteres.');
      expect(harness.text()).toContain('Formato 000-0000000-0 (11 dígitos).');
      expect(harness.text()).toContain('Hasta 50 caracteres. Obligatorio para estudiantes.');
      expect(harness.text()).toContain('Crear paciente');
      expect(
        compiled.querySelector('input[formControlName="name"]')?.getAttribute('maxlength'),
      ).toBe('150');
      expect(
        compiled.querySelector('input[formControlName="carnet"]')?.getAttribute('maxlength'),
      ).toBe('50');
    });

    it('el checkbox «Paciente activo» existe, nace marcado y envía is_active true (D-5)', () => {
      const compiled = harness.fixture.nativeElement as HTMLElement;

      expect(harness.text()).toContain('Paciente activo');
      expect(compiled.querySelector('mat-checkbox')).not.toBeNull();
      expect(harness.component.form.controls.isActive.value).toBe(true);
    });

    it('el selector de tipo muestra la etiqueta capitalizada del valor seleccionado (S5)', () => {
      const compiled = harness.fixture.nativeElement as HTMLElement;
      const triggerText = () =>
        compiled.querySelector('.mat-mdc-select-value-text')?.textContent?.trim();

      expect(compiled.querySelector('mat-select[formControlName="patientType"]')).not.toBeNull();
      expect(harness.component.patientTypes).toEqual([
        'ESTUDIANTE',
        'EMPLEADO',
        'PROFESOR',
        'OTROS',
      ]);

      harness.component.form.controls.patientType.setValue('ESTUDIANTE');
      harness.fixture.detectChanges();
      expect(triggerText()).toBe('Estudiante');

      harness.component.form.controls.patientType.setValue('PROFESOR');
      harness.fixture.detectChanges();
      expect(triggerText()).toBe('Profesor');
    });
  });

  describe('máscara de cédula XXX-XXXXXXX-X (S3)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'create' });
      harness.fixture.detectChanges();
    });

    afterEach(() => {
      harness.httpMock.verify();
    });

    it('al escribir dígitos aplica los bloques 3-7-1 en el input y en el control', () => {
      harness.typeCedula('1234567890');

      expect(harness.cedulaInput().value).toBe('123-4567890');
      expect(harness.component.form.controls.cedula.value).toBe('123-4567890');

      harness.typeCedula('12345678901');

      expect(harness.cedulaInput().value).toBe('123-4567890-1');
      expect(harness.component.form.controls.cedula.value).toBe('123-4567890-1');
    });

    it('al pegar los 11 dígitos en un solo gesto los muestra con máscara', () => {
      harness.typeCedula('12345678901');

      expect(harness.cedulaInput().value).toBe('123-4567890-1');
    });

    it('descarta letras y separadores escritos por el usuario', () => {
      harness.typeCedula('V-12.345.678-9');

      expect(harness.cedulaInput().value).toBe('123-456789');
      expect(harness.component.form.controls.cedula.value).toBe('123-456789');
    });

    it('recorta a 11 dígitos cuando se escribe de más', () => {
      harness.typeCedula('123456789012345');

      expect(harness.cedulaInput().value).toBe('123-4567890-1');
    });

    it('una cédula incompleta bloquea el envío con mensaje propio y sin POST (S3)', () => {
      harness.component.form.controls.name.setValue('Ana Sintética');
      harness.component.form.controls.patientType.setValue('EMPLEADO');
      harness.typeCedula('123-4567890');

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.cedula.hasError('cedula')).toBe(true);
      expect(harness.component.form.invalid).toBe(true);
      harness.httpMock.expectNone(PATIENTS_URL);
      expect(harness.text()).toContain('La cédula debe tener 11 dígitos.');
    });

    it('una cédula con letras se descarta y, al no llegar a 11 dígitos, bloquea el envío (S3)', () => {
      harness.component.form.controls.name.setValue('Ana Sintética');
      harness.component.form.controls.patientType.setValue('EMPLEADO');
      harness.typeCedula('abcdefghijk');

      // La máscara descarta todo lo que no sea dígito.
      expect(harness.cedulaInput().value).toBe('');

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.invalid).toBe(true);
      harness.httpMock.expectNone(PATIENTS_URL);
      expect(harness.text()).toContain('Ingresa la cédula');
    });

    it('una cédula vacía muestra el requerido propio (S3)', () => {
      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.cedula.hasError('required')).toBe(true);
      harness.httpMock.expectNone(PATIENTS_URL);
      expect(harness.text()).toContain('Ingresa la cédula');
    });
  });

  describe('validación de nombre y carnet (S2/S4)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'create' });
      harness.fixture.detectChanges();
    });

    afterEach(() => {
      harness.httpMock.verify();
    });

    it('bloquea el envío vacío con el error propio «Ingresa el nombre» (S2)', () => {
      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.name.hasError('required')).toBe(true);
      harness.httpMock.expectNone(PATIENTS_URL);
      expect(harness.text()).toContain('Ingresa el nombre');
    });

    it('un nombre de solo espacios cuenta como vacío y no emite POST (S2)', () => {
      harness.component.form.controls.name.setValue('     ');
      harness.component.onSubmit();

      expect(harness.component.form.controls.name.hasError('required')).toBe(true);
      harness.httpMock.expectNone(PATIENTS_URL);
    });

    it('rechaza más de 150 caracteres con el error propio de longitud (S2)', () => {
      harness.component.form.controls.name.setValue('a'.repeat(151));
      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.name.hasError('maxlength')).toBe(true);
      harness.httpMock.expectNone(PATIENTS_URL);
      expect(harness.text()).toContain('El nombre no debe superar los 150 caracteres.');
    });

    it('el carnet es obligatorio con patient_type ESTUDIANTE y bloquea el envío (S4)', () => {
      harness.component.form.controls.name.setValue('Ana Sintética');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.patientType.setValue('ESTUDIANTE');

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.carnet.hasError('required')).toBe(true);
      expect(harness.component.form.invalid).toBe(true);
      harness.httpMock.expectNone(PATIENTS_URL);
      expect(harness.text()).toContain('Ingresa el carnet del estudiante');
    });

    it('el carnet deja de ser obligatorio al cambiar a EMPLEADO y se envía como null (S4)', () => {
      harness.component.form.controls.name.setValue('Luis Sintético');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.patientType.setValue('EMPLEADO');
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.carnet.hasError('required')).toBe(false);

      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(PATIENTS_URL);
      expect(req.request.body.carnet).toBeNull();
      expect(req.request.body.patient_type).toBe('EMPLEADO');
      req.flush(patientDto({ carnet: null, patient_type: 'EMPLEADO' }));
    });

    it('volver a ESTUDIANTE vuelve a exigir el carnet (S4)', () => {
      harness.component.form.controls.patientType.setValue('EMPLEADO');
      harness.fixture.detectChanges();
      expect(harness.component.form.controls.carnet.hasError('required')).toBe(false);

      harness.component.form.controls.patientType.setValue('ESTUDIANTE');
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.carnet.hasError('required')).toBe(true);
    });

    it('rechaza un carnet de más de 50 caracteres (S4)', () => {
      harness.component.form.controls.name.setValue('Ana Sintética');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.patientType.setValue('EMPLEADO');
      harness.component.form.controls.carnet.setValue('C'.repeat(51));

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.carnet.hasError('maxlength')).toBe(true);
      harness.httpMock.expectNone(PATIENTS_URL);
      expect(harness.text()).toContain('El carnet no debe superar los 50 caracteres.');
    });
  });

  describe('envío en creación (S2/S3/S4/S5)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'create' });
      harness.fixture.detectChanges();
    });

    afterEach(() => {
      harness.httpMock.verify();
    });

    it('envía POST con la cédula sin máscara, el nombre recortado y el tipo en mayúsculas', () => {
      harness.component.form.controls.name.setValue('  Ana Sintética  ');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.patientType.setValue('ESTUDIANTE');
      harness.component.form.controls.carnet.setValue('  EST-001  ');

      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(PATIENTS_URL);
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
      expect(harness.dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('un segundo submit mientras guarda no emite otro POST', () => {
      harness.component.form.controls.name.setValue('Ana Sintética');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.patientType.setValue('EMPLEADO');

      harness.component.onSubmit();
      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(PATIENTS_URL);
      expect(req.request.method).toBe('POST');
      req.flush(patientDto());
      expect(harness.dialogRefStub.close).toHaveBeenCalledTimes(1);
    });

    it('envía is_active false cuando el checkbox se desmarca (S2)', () => {
      harness.component.form.controls.name.setValue('Luis Sintético');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.patientType.setValue('OTROS');
      harness.component.form.controls.isActive.setValue(false);

      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(PATIENTS_URL);
      expect(req.request.body.is_active).toBe(false);
      req.flush(patientDto({ is_active: false }));
    });

    it('marca aria-busy durante el envío y deshabilita botón y campos (S9)', () => {
      harness.component.form.controls.name.setValue('Ana Sintética');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.patientType.setValue('EMPLEADO');

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      const compiled = harness.fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
      expect(
        compiled.querySelector('button[type="submit"]')?.getAttribute('disabled'),
      ).not.toBeNull();
      expect(harness.text()).toContain('Guardando…');

      harness.httpMock.expectOne(PATIENTS_URL).flush(patientDto());
    });
  });

  describe('errores de servidor en el formulario (S8)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'create' });
      harness.fixture.detectChanges();
      harness.component.form.controls.name.setValue('Ana Sintética');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.patientType.setValue('ESTUDIANTE');
      harness.component.form.controls.carnet.setValue('EST-001');
    });

    afterEach(() => {
      harness.httpMock.verify();
    });

    it('un 409 de cédula duplicada queda bajo el campo cedula sin cerrar el diálogo (S2/S8)', () => {
      harness.component.onSubmit();

      harness.httpMock
        .expectOne(PATIENTS_URL)
        .flush(
          { detail: 'RAW-DETAIL-LEAK', code: 'patient_exists', errors: [] },
          { status: 409, statusText: 'Conflict' },
        );
      harness.fixture.detectChanges();

      expect(harness.dialogRefStub.close).not.toHaveBeenCalled();
      expect(harness.component.fieldErrors().cedula).toBe('Ya existe un paciente con esa cédula.');
      expect(harness.component.form.controls.cedula.hasError('server')).toBe(true);
      expect(harness.component.form.controls.carnet.hasError('server')).toBe(false);
      expect(harness.text()).toContain('Ya existe un paciente con esa cédula.');
      expect(harness.text()).not.toContain('RAW-DETAIL-LEAK');
    });

    it('un 409 de carnet duplicado queda bajo el campo carnet (S4/S8)', () => {
      harness.component.onSubmit();

      harness.httpMock
        .expectOne(PATIENTS_URL)
        .flush(
          { detail: 'RAW-DETAIL-LEAK', code: 'patient_carnet_exists', errors: [] },
          { status: 409, statusText: 'Conflict' },
        );
      harness.fixture.detectChanges();

      expect(harness.component.fieldErrors().carnet).toBe('Ya existe un paciente con ese carnet.');
      expect(harness.component.form.controls.carnet.hasError('server')).toBe(true);
      expect(harness.component.form.controls.cedula.hasError('server')).toBe(false);
      expect(harness.text()).toContain('Ya existe un paciente con ese carnet.');
    });

    it('el reintento tras un 409 limpia el error de servidor y vuelve a enviar (S8)', () => {
      harness.component.onSubmit();
      harness.httpMock
        .expectOne(PATIENTS_URL)
        .flush({ code: 'patient_exists', errors: [] }, { status: 409, statusText: 'Conflict' });
      harness.fixture.detectChanges();
      expect(harness.component.form.controls.cedula.hasError('server')).toBe(true);

      harness.typeCedula('98765432109');
      harness.component.onSubmit();

      expect(harness.component.fieldErrors()).toEqual({});
      expect(harness.component.form.controls.cedula.hasError('server')).toBe(false);
      harness.httpMock.expectOne(PATIENTS_URL).flush(patientDto({ cedula: '98765432109' }));
      expect(harness.dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('un 422 marca los campos conocidos y avisa en alert sin exponer el backend (S8)', () => {
      harness.component.onSubmit();

      harness.httpMock.expectOne(PATIENTS_URL).flush(
        {
          detail: 'RAW-DETAIL-LEAK',
          errors: [
            { field: 'name', message: 'RAW-MESSAGE-LEAK' },
            { field: 'patient_type', message: 'RAW-MESSAGE-LEAK' },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      harness.fixture.detectChanges();

      expect(harness.component.fieldErrors()).toEqual({
        name: 'Revisa el nombre',
        patientType: 'Revisa el tipo de paciente',
      });
      expect(harness.component.form.controls.name.hasError('server')).toBe(true);
      expect(harness.component.form.controls.patientType.hasError('server')).toBe(true);
      expect(harness.text()).toContain('Revisa los datos ingresados.');
      expect(harness.text()).not.toContain('RAW-MESSAGE-LEAK');
      expect(harness.component.submitting()).toBe(false);
      expect(harness.dialogRefStub.close).not.toHaveBeenCalled();
    });
  });

  describe('modo edición (S6)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'edit', patientId: 11 });
    });

    afterEach(() => {
      harness.httpMock.verify();
    });

    it('precarga con GET /{id} mostrando aria-busy, el título de edición y la cédula con máscara', () => {
      expect(harness.component.loadingPatient()).toBe(true);
      harness.fixture.detectChanges();

      expect(
        (harness.fixture.nativeElement as HTMLElement)
          .querySelector('form')
          ?.getAttribute('aria-busy'),
      ).toBe('true');
      expect(harness.text()).toContain('Cargando paciente…');
      expect(harness.text()).toContain('Editar paciente');
      expect(harness.text()).toContain('Guardar cambios');

      harness.httpMock.expectOne(`${PATIENTS_URL}/11`).flush(patientDto());
      harness.fixture.detectChanges();

      expect(harness.component.loadingPatient()).toBe(false);
      expect(harness.component.form.controls.name.value).toBe('Ana Sintética');
      expect(harness.component.form.controls.cedula.value).toBe('123-4567890-1');
      expect(harness.cedulaInput().value).toBe('123-4567890-1');
      expect(harness.component.form.controls.carnet.value).toBe('EST-001');
      expect(harness.component.form.controls.patientType.value).toBe('ESTUDIANTE');
      // El estado no se edita en el diálogo: se cambia con Activar/Desactivar.
      expect(
        (harness.fixture.nativeElement as HTMLElement).querySelector('mat-checkbox'),
      ).toBeNull();
      expect(harness.component.form.controls.isActive.disabled).toBe(true);
    });

    it('precarga un paciente inactivo (200) y conserva is_active false en el PUT (S6)', () => {
      harness.httpMock
        .expectOne(`${PATIENTS_URL}/11`)
        .flush(patientDto({ is_active: false, carnet: null, patient_type: 'OTROS' }));
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.isActive.value).toBe(false);

      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(`${PATIENTS_URL}/11`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Ana Sintética',
        cedula: '12345678901',
        patient_type: 'OTROS',
        carnet: null,
        is_active: false,
      });
      req.flush(patientDto({ is_active: false, carnet: null, patient_type: 'OTROS' }));
      expect(harness.dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('el PUT es reemplazo completo: nombre, cédula sin máscara, tipo y carnet vigentes (S6)', () => {
      harness.httpMock.expectOne(`${PATIENTS_URL}/11`).flush(patientDto());
      harness.fixture.detectChanges();

      harness.component.form.controls.name.setValue('  Ana Actualizada  ');
      harness.component.form.controls.carnet.setValue('EST-777');
      harness.component.form.controls.patientType.setValue('PROFESOR');
      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(`${PATIENTS_URL}/11`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Ana Actualizada',
        cedula: '12345678901',
        patient_type: 'PROFESOR',
        carnet: 'EST-777',
        is_active: true,
      });
      expect(req.request.body).not.toHaveProperty('id');
      req.flush(patientDto({ name: 'Ana Actualizada' }));
      expect(harness.dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('vaciar el carnet lo borra: el PUT envía carnet null (S6)', () => {
      harness.httpMock
        .expectOne(`${PATIENTS_URL}/11`)
        .flush(patientDto({ patient_type: 'PROFESOR', carnet: 'EMP-77' }));
      harness.fixture.detectChanges();

      harness.component.form.controls.carnet.setValue('');
      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(`${PATIENTS_URL}/11`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.carnet).toBeNull();
      expect(req.request.body.patient_type).toBe('PROFESOR');
      req.flush(patientDto({ patient_type: 'PROFESOR', carnet: null }));
      expect(harness.dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('ante 404 de precarga cierra con { notFound: true } para que la lista avise (S6)', () => {
      harness.httpMock
        .expectOne(`${PATIENTS_URL}/11`)
        .flush('ausente sintético', { status: 404, statusText: 'Not Found' });

      expect(harness.dialogRefStub.close).toHaveBeenCalledWith({ notFound: true });
    });
  });

  describe('cancelar sin efectos (S6)', () => {
    it('en creación «Cancelar» cierra sin valor y sin emitir peticiones', async () => {
      TestBed.resetTestingModule();
      const harness = await configure({ mode: 'create' });
      harness.fixture.detectChanges();

      harness.httpMock.expectNone(PATIENTS_URL);

      const cancel = (
        harness.fixture.nativeElement as HTMLElement
      ).querySelector<HTMLButtonElement>('button[mat-dialog-close]');
      expect(cancel).not.toBeNull();
      expect(cancel?.textContent).toContain('Cancelar');
      expect(cancel?.getAttribute('type')).toBe('button');

      cancel?.click();

      expect(harness.dialogRefStub.close).toHaveBeenCalledTimes(1);
      expect(harness.dialogRefStub.close.mock.calls[0][0]).toBeFalsy();
      expect(harness.dialogRefStub.close.mock.calls[0][0]).not.toEqual({ notFound: true });
      harness.httpMock.expectNone(PATIENTS_URL);
      harness.httpMock.verify();
    });

    it('en edición «Cancelar» tras la precarga cierra sin valor y sin PUT', async () => {
      TestBed.resetTestingModule();
      const harness = await configure({ mode: 'edit', patientId: 11 });
      harness.fixture.detectChanges();

      harness.httpMock.expectOne(`${PATIENTS_URL}/11`).flush(patientDto());
      harness.fixture.detectChanges();

      (harness.fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('button[mat-dialog-close]')
        ?.click();

      expect(harness.dialogRefStub.close).toHaveBeenCalledTimes(1);
      expect(harness.dialogRefStub.close.mock.calls[0][0]).toBeFalsy();
      harness.httpMock.expectNone(`${PATIENTS_URL}/11`);
      harness.httpMock.verify();
    });

    it('Escape cierra el diálogo real sin emitir peticiones (MatDialog por defecto)', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      }).compileComponents();

      const httpMock = TestBed.inject(HttpTestingController);
      const dialog = TestBed.inject(MatDialog);
      const data: PatientFormData = { mode: 'create' };
      const ref = dialog.open(PatientFormDialog, { data });

      // `MatDialogContainer` cierra con `keydown` y `keyCode === 27` (CDK), no
      // con el `key` moderno: jsdom deja `keyCode` en 0 si solo se pasa `key`.
      const closed = new Promise<unknown>((resolve) => {
        ref.afterClosed().subscribe((value) => resolve(value));
      });

      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
      );

      await expect(closed).resolves.toBeUndefined();
      httpMock.expectNone(PATIENTS_URL);
      httpMock.verify();
    });
  });
});
