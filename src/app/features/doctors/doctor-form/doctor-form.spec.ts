import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { DoctorFormData, DoctorFormDialog } from './doctor-form';

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

interface Harness {
  fixture: ComponentFixture<DoctorFormDialog>;
  component: DoctorFormDialog;
  httpMock: HttpTestingController;
  dialogRefStub: { close: ReturnType<typeof vi.fn> };
  /** Escribe en el input de cédula como lo haría el usuario (input nativo). */
  typeCedula: (value: string) => void;
  /** Lee el input de cédula del DOM. */
  cedulaInput: () => HTMLInputElement;
  /** Texto visible del diálogo. */
  text: () => string;
}

async function configure(data: DoctorFormData): Promise<Harness> {
  const dialogRefStub = { close: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [DoctorFormDialog],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRefStub },
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(DoctorFormDialog);
  const component = fixture.componentInstance;
  const host = () => fixture.nativeElement as HTMLElement;
  const cedulaInput = () => {
    const input = host().querySelector<HTMLInputElement>('input[formControlName="cedula"]');
    if (input === null) {
      throw new Error('No se encontró el input de cédula');
    }
    return input;
  };

  return {
    fixture,
    component,
    httpMock,
    dialogRefStub,
    typeCedula: (value: string) => {
      const input = cedulaInput();
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
    cedulaInput,
    text: () => host().textContent ?? '',
  };
}

describe('DoctorFormDialog (F-014 S2-S7/S9)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('modo creación (S2/S5/S10)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'create' });
      harness.fixture.detectChanges();
    });

    afterEach(() => {
      harness.httpMock.verify();
    });

    it('muestra título, etiquetas visibles, hints y límites del contrato (S2/S5)', () => {
      const compiled = harness.fixture.nativeElement as HTMLElement;

      expect(harness.text()).toContain('Nuevo médico');
      expect(harness.text()).toContain('Nombre completo');
      expect(harness.text()).toContain('Cédula');
      expect(harness.text()).toContain('Tanda');
      expect(harness.text()).toContain('Especialidad');
      expect(harness.text()).toContain('Entre 1 y 150 caracteres.');
      expect(harness.text()).toContain('Formato 000-0000000-0 (11 dígitos).');
      expect(harness.text()).toContain('Entre 1 y 100 caracteres.');
      expect(harness.text()).toContain('Crear médico');
      expect(
        compiled.querySelector('input[formControlName="name"]')?.getAttribute('maxlength'),
      ).toBe('150');
      expect(
        compiled.querySelector('input[formControlName="specialty"]')?.getAttribute('maxlength'),
      ).toBe('100');
    });

    it('el checkbox «Médico activo» existe, nace marcado y envía is_active true (S2)', () => {
      const compiled = harness.fixture.nativeElement as HTMLElement;

      expect(harness.text()).toContain('Médico activo');
      expect(compiled.querySelector('mat-checkbox')).not.toBeNull();
      expect(harness.component.form.controls.isActive.value).toBe(true);
    });

    it('la tanda es un select cerrado con las cuatro tandas canónicas (S4)', () => {
      const compiled = harness.fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('mat-select[formControlName="labShift"]')).not.toBeNull();
      // Cerrado: no hay campo de texto libre para la tanda.
      expect(compiled.querySelector('input[formControlName="labShift"]')).toBeNull();
      expect(harness.component.shiftOptions()).toEqual([
        'MATUTINA',
        'VESPERTINA',
        'NOCTURNA',
        'MIXTA',
      ]);
    });

    it('el select de tanda muestra la etiqueta capitalizada del valor vigente (S4)', () => {
      const compiled = harness.fixture.nativeElement as HTMLElement;
      const triggerText = () =>
        compiled.querySelector('.mat-mdc-select-value-text')?.textContent?.trim();

      harness.component.form.controls.labShift.setValue('MATUTINA');
      harness.fixture.detectChanges();
      expect(triggerText()).toBe('Matutina');

      harness.component.form.controls.labShift.setValue('MIXTA');
      harness.fixture.detectChanges();
      expect(triggerText()).toBe('Mixta');
    });

    it('sin tanda elegida el envío se bloquea con error propio de campo (S4)', () => {
      harness.component.form.controls.name.setValue('Dra. Sintética');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.specialty.setValue('Medicina general');
      harness.component.form.controls.labShift.setValue('');

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.labShift.hasError('required')).toBe(true);
      harness.component.form.controls.labShift.markAsTouched();
      harness.fixture.detectChanges();
      expect(harness.text()).toContain('Selecciona la tanda');
      harness.httpMock.expectNone(DOCTORS_URL);
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
      harness.component.form.controls.name.setValue('Dra. Sintética');
      harness.component.form.controls.labShift.setValue('MATUTINA');
      harness.component.form.controls.specialty.setValue('Medicina general');
      harness.typeCedula('123-4567890');

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.cedula.hasError('cedula')).toBe(true);
      expect(harness.component.form.invalid).toBe(true);
      harness.httpMock.expectNone(DOCTORS_URL);
      expect(harness.text()).toContain('La cédula debe tener 11 dígitos.');
    });

    it('una cédula con letras se descarta y, al no llegar a 11 dígitos, bloquea el envío (S3)', () => {
      harness.component.form.controls.name.setValue('Dra. Sintética');
      harness.component.form.controls.labShift.setValue('MATUTINA');
      harness.component.form.controls.specialty.setValue('Medicina general');
      harness.typeCedula('abcdefghijk');

      expect(harness.cedulaInput().value).toBe('');

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.invalid).toBe(true);
      harness.httpMock.expectNone(DOCTORS_URL);
      expect(harness.text()).toContain('Ingresa la cédula');
    });
  });

  describe('validación de nombre y especialidad (S2/S5)', () => {
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
      harness.httpMock.expectNone(DOCTORS_URL);
      expect(harness.text()).toContain('Ingresa el nombre');
    });

    it('un nombre de solo espacios cuenta como vacío y no emite POST (S2)', () => {
      harness.component.form.controls.name.setValue('     ');
      harness.component.onSubmit();

      expect(harness.component.form.controls.name.hasError('required')).toBe(true);
      harness.httpMock.expectNone(DOCTORS_URL);
    });

    it('rechaza más de 150 caracteres con el error propio de longitud (S2)', () => {
      harness.component.form.controls.name.setValue('a'.repeat(151));
      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.name.hasError('maxlength')).toBe(true);
      harness.httpMock.expectNone(DOCTORS_URL);
      expect(harness.text()).toContain('El nombre no debe superar los 150 caracteres.');
    });

    it('la especialidad es obligatoria y se recorta al enviar (S5)', () => {
      harness.component.form.controls.name.setValue('Dra. Sintética');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.labShift.setValue('MATUTINA');

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.specialty.hasError('required')).toBe(true);
      harness.httpMock.expectNone(DOCTORS_URL);
      expect(harness.text()).toContain('Ingresa la especialidad');

      harness.component.form.controls.specialty.setValue('  Medicina general  ');
      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(DOCTORS_URL);
      expect(req.request.body.specialty).toBe('Medicina general');
      req.flush(doctorDto());
    });

    it('una especialidad de solo espacios cuenta como vacía (S5)', () => {
      harness.component.form.controls.specialty.setValue('   ');
      harness.component.onSubmit();

      expect(harness.component.form.controls.specialty.hasError('required')).toBe(true);
      harness.httpMock.expectNone(DOCTORS_URL);
    });

    it('rechaza más de 100 caracteres de especialidad (S5)', () => {
      harness.component.form.controls.name.setValue('Dra. Sintética');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.labShift.setValue('MATUTINA');
      harness.component.form.controls.specialty.setValue('E'.repeat(101));

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.specialty.hasError('maxlength')).toBe(true);
      harness.httpMock.expectNone(DOCTORS_URL);
      expect(harness.text()).toContain('La especialidad no debe superar los 100 caracteres.');
    });
  });

  describe('envío en creación (S2/S3/S4/S5/S6)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'create' });
      harness.fixture.detectChanges();
    });

    afterEach(() => {
      harness.httpMock.verify();
    });

    it('envía POST con la cédula sin máscara, la tanda canónica y sin tocar la asociación con usuarios', () => {
      harness.component.form.controls.name.setValue('  Dra. Sintética  ');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.labShift.setValue('VESPERTINA');
      harness.component.form.controls.specialty.setValue('  Medicina general  ');

      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(DOCTORS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'Dra. Sintética',
        cedula: '12345678901',
        lab_shift: 'VESPERTINA',
        specialty: 'Medicina general',
        is_active: true,
      });
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('created_at');
      expect(req.request.body).not.toHaveProperty('user');
      expect(req.request.body).not.toHaveProperty('doctor_id');

      req.flush(doctorDto(), { status: 201, statusText: 'Created' });
      expect(harness.dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('un segundo submit mientras guarda no emite otro POST', () => {
      harness.component.form.controls.name.setValue('Dra. Sintética');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.labShift.setValue('MATUTINA');
      harness.component.form.controls.specialty.setValue('Medicina general');

      harness.component.onSubmit();
      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(DOCTORS_URL);
      expect(req.request.method).toBe('POST');
      req.flush(doctorDto());
      expect(harness.dialogRefStub.close).toHaveBeenCalledTimes(1);
    });

    it('envía is_active false cuando el checkbox se desmarca (S2)', () => {
      harness.component.form.controls.name.setValue('Dr. Sintético');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.labShift.setValue('NOCTURNA');
      harness.component.form.controls.specialty.setValue('Pediatría');
      harness.component.form.controls.isActive.setValue(false);

      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(DOCTORS_URL);
      expect(req.request.body.is_active).toBe(false);
      req.flush(doctorDto({ is_active: false }));
    });

    it('marca aria-busy durante el envío y deshabilita botón y campos (S10)', () => {
      harness.component.form.controls.name.setValue('Dra. Sintética');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.labShift.setValue('MATUTINA');
      harness.component.form.controls.specialty.setValue('Medicina general');

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      const compiled = harness.fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
      expect(
        compiled.querySelector('button[type="submit"]')?.getAttribute('disabled'),
      ).not.toBeNull();
      expect(harness.text()).toContain('Guardando…');

      harness.httpMock.expectOne(DOCTORS_URL).flush(doctorDto());
    });
  });

  describe('errores de servidor en el formulario (S2/S9)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'create' });
      harness.fixture.detectChanges();
      harness.component.form.controls.name.setValue('Dra. Sintética');
      harness.typeCedula('123-4567890-1');
      harness.component.form.controls.labShift.setValue('MATUTINA');
      harness.component.form.controls.specialty.setValue('Medicina general');
    });

    afterEach(() => {
      harness.httpMock.verify();
    });

    it('un 409 de cédula duplicada queda bajo el campo cedula sin cerrar el diálogo (S2/S9)', () => {
      harness.component.onSubmit();

      harness.httpMock
        .expectOne(DOCTORS_URL)
        .flush(
          { detail: 'RAW-DETAIL-LEAK', code: 'doctor_exists', errors: [] },
          { status: 409, statusText: 'Conflict' },
        );
      harness.fixture.detectChanges();

      expect(harness.dialogRefStub.close).not.toHaveBeenCalled();
      expect(harness.component.fieldErrors().cedula).toBe('Ya existe un médico con esa cédula.');
      expect(harness.component.form.controls.cedula.hasError('server')).toBe(true);
      expect(harness.component.form.controls.name.hasError('server')).toBe(false);
      expect(harness.text()).toContain('Ya existe un médico con esa cédula.');
      expect(harness.text()).not.toContain('RAW-DETAIL-LEAK');
    });

    it('el reintento tras un 409 limpia el error de servidor y vuelve a enviar (S9)', () => {
      harness.component.onSubmit();
      harness.httpMock
        .expectOne(DOCTORS_URL)
        .flush({ code: 'doctor_exists', errors: [] }, { status: 409, statusText: 'Conflict' });
      harness.fixture.detectChanges();
      expect(harness.component.form.controls.cedula.hasError('server')).toBe(true);

      harness.typeCedula('98765432109');
      harness.component.onSubmit();

      expect(harness.component.fieldErrors()).toEqual({});
      expect(harness.component.form.controls.cedula.hasError('server')).toBe(false);
      harness.httpMock.expectOne(DOCTORS_URL).flush(doctorDto({ cedula: '98765432109' }));
      expect(harness.dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('un 422 marca los campos conocidos y avisa en alert sin exponer el backend (S9)', () => {
      harness.component.onSubmit();

      harness.httpMock.expectOne(DOCTORS_URL).flush(
        {
          detail: 'RAW-DETAIL-LEAK',
          errors: [
            { field: 'name', message: 'RAW-MESSAGE-LEAK' },
            { field: 'lab_shift', message: 'RAW-MESSAGE-LEAK' },
            { field: 'specialty', message: 'RAW-MESSAGE-LEAK' },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      harness.fixture.detectChanges();

      expect(harness.component.fieldErrors()).toEqual({
        name: 'Revisa el nombre',
        labShift: 'Revisa la tanda',
        specialty: 'Revisa la especialidad',
      });
      expect(harness.component.form.controls.name.hasError('server')).toBe(true);
      expect(harness.component.form.controls.labShift.hasError('server')).toBe(true);
      expect(harness.component.form.controls.specialty.hasError('server')).toBe(true);
      expect(harness.text()).toContain('Revisa los datos ingresados.');
      expect(harness.text()).not.toContain('RAW-MESSAGE-LEAK');
      expect(harness.component.submitting()).toBe(false);
      expect(harness.dialogRefStub.close).not.toHaveBeenCalled();
    });
  });

  describe('modo edición (S4/S6/S7)', () => {
    let harness: Harness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      harness = await configure({ mode: 'edit', doctorId: 21 });
    });

    afterEach(() => {
      harness.httpMock.verify();
    });

    it('precarga con GET /{id} mostrando aria-busy, el título de edición y la cédula con máscara', () => {
      expect(harness.component.loadingDoctor()).toBe(true);
      harness.fixture.detectChanges();

      expect(
        (harness.fixture.nativeElement as HTMLElement)
          .querySelector('form')
          ?.getAttribute('aria-busy'),
      ).toBe('true');
      expect(harness.text()).toContain('Cargando médico…');
      expect(harness.text()).toContain('Editar médico');
      expect(harness.text()).toContain('Guardar cambios');

      harness.httpMock.expectOne(`${DOCTORS_URL}/21`).flush(doctorDto());
      harness.fixture.detectChanges();

      expect(harness.component.loadingDoctor()).toBe(false);
      expect(harness.component.form.controls.name.value).toBe('Dra. Sintética');
      expect(harness.component.form.controls.cedula.value).toBe('123-4567890-1');
      expect(harness.cedulaInput().value).toBe('123-4567890-1');
      expect(harness.component.form.controls.labShift.value).toBe('MATUTINA');
      expect(harness.component.form.controls.specialty.value).toBe('Medicina general');
      // El estado no se edita en el diálogo: se cambia con Activar/Desactivar.
      expect(
        (harness.fixture.nativeElement as HTMLElement).querySelector('mat-checkbox'),
      ).toBeNull();
      expect(harness.component.form.controls.isActive.disabled).toBe(true);
    });

    it('agrega la tanda no canónica del registro como opción extra para no perderla (S4)', () => {
      harness.httpMock.expectOne(`${DOCTORS_URL}/21`).flush(doctorDto({ lab_shift: 'TARDE' }));
      harness.fixture.detectChanges();

      expect(harness.component.shiftOptions()).toEqual([
        'MATUTINA',
        'VESPERTINA',
        'NOCTURNA',
        'MIXTA',
        'TARDE',
      ]);
      expect(harness.component.form.controls.labShift.value).toBe('TARDE');

      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(`${DOCTORS_URL}/21`);
      expect(req.request.body.lab_shift).toBe('TARDE');
      req.flush(doctorDto({ lab_shift: 'TARDE' }));
      expect(harness.dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('precarga un médico inactivo (200) y conserva is_active false en el PUT sin tocar la asociación (S6/S7)', () => {
      harness.httpMock
        .expectOne(`${DOCTORS_URL}/21`)
        .flush(doctorDto({ is_active: false, user: null }));
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.isActive.value).toBe(false);

      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(`${DOCTORS_URL}/21`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Dra. Sintética',
        cedula: '12345678901',
        lab_shift: 'MATUTINA',
        specialty: 'Medicina general',
        is_active: false,
      });
      expect(req.request.body).not.toHaveProperty('user');
      req.flush(doctorDto({ is_active: false, user: null }));
      expect(harness.dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('el PUT es reemplazo completo: nombre, cédula sin máscara, tanda y especialidad vigentes (S7)', () => {
      harness.httpMock.expectOne(`${DOCTORS_URL}/21`).flush(doctorDto());
      harness.fixture.detectChanges();

      harness.component.form.controls.name.setValue('  Dra. Actualizada  ');
      harness.component.form.controls.labShift.setValue('MIXTA');
      harness.component.form.controls.specialty.setValue('  Cardiología  ');
      harness.component.onSubmit();

      const req = harness.httpMock.expectOne(`${DOCTORS_URL}/21`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Dra. Actualizada',
        cedula: '12345678901',
        lab_shift: 'MIXTA',
        specialty: 'Cardiología',
        is_active: true,
      });
      expect(req.request.body).not.toHaveProperty('id');
      req.flush(doctorDto({ name: 'Dra. Actualizada' }));
      expect(harness.dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('ante 404 de precarga cierra con { notFound: true } para que la lista avise (S7)', () => {
      harness.httpMock
        .expectOne(`${DOCTORS_URL}/21`)
        .flush('ausente sintético', { status: 404, statusText: 'Not Found' });

      expect(harness.dialogRefStub.close).toHaveBeenCalledWith({ notFound: true });
    });
  });

  describe('cancelar sin efectos (S7)', () => {
    it('en creación «Cancelar» cierra sin valor y sin emitir peticiones', async () => {
      TestBed.resetTestingModule();
      const harness = await configure({ mode: 'create' });
      harness.fixture.detectChanges();

      harness.httpMock.expectNone(DOCTORS_URL);

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
      harness.httpMock.expectNone(DOCTORS_URL);
      harness.httpMock.verify();
    });

    it('en edición «Cancelar» tras la precarga cierra sin valor y sin PUT', async () => {
      TestBed.resetTestingModule();
      const harness = await configure({ mode: 'edit', doctorId: 21 });
      harness.fixture.detectChanges();

      harness.httpMock.expectOne(`${DOCTORS_URL}/21`).flush(doctorDto());
      harness.fixture.detectChanges();

      (harness.fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('button[mat-dialog-close]')
        ?.click();

      expect(harness.dialogRefStub.close).toHaveBeenCalledTimes(1);
      expect(harness.dialogRefStub.close.mock.calls[0][0]).toBeFalsy();
      harness.httpMock.expectNone(`${DOCTORS_URL}/21`);
      harness.httpMock.verify();
    });

    it('Escape cierra el diálogo real sin emitir peticiones (MatDialog por defecto)', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      }).compileComponents();

      const httpMock = TestBed.inject(HttpTestingController);
      const dialog = TestBed.inject(MatDialog);
      const data: DoctorFormData = { mode: 'create' };
      const ref = dialog.open(DoctorFormDialog, { data });

      // `MatDialogContainer` cierra con `keydown` y `keyCode === 27` (CDK), no
      // con el `key` moderno: jsdom deja `keyCode` en 0 si solo se pasa `key`.
      const closed = new Promise<unknown>((resolve) => {
        ref.afterClosed().subscribe((value) => resolve(value));
      });

      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
      );

      await expect(closed).resolves.toBeUndefined();
      httpMock.expectNone(DOCTORS_URL);
      httpMock.verify();
    });
  });
});
