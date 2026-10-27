import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { LocationFormData, LocationFormDialog } from './location-form';

const LOCATIONS_URL = `${environment.apiUrl}/v1/locations`;

function locationDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 7,
    description: 'Analgésico',
    shelf: 'A',
    section: '1',
    cell: '2',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

async function configure(data: LocationFormData): Promise<{
  fixture: ComponentFixture<LocationFormDialog>;
  component: LocationFormDialog;
  httpMock: HttpTestingController;
  dialogRefStub: { close: ReturnType<typeof vi.fn> };
}> {
  const dialogRefStub = { close: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [LocationFormDialog],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRefStub },
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(LocationFormDialog);
  const component = fixture.componentInstance;

  return { fixture, component, httpMock, dialogRefStub };
}

describe('LocationFormDialog (F-011 S2/S3/S8)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('modo creación (S2)', () => {
    let fixture: ComponentFixture<LocationFormDialog>;
    let component: LocationFormDialog;
    let httpMock: HttpTestingController;
    let dialogRefStub: { close: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      TestBed.resetTestingModule();
      ({ fixture, component, httpMock, dialogRefStub } = await configure({ mode: 'create' }));
      fixture.detectChanges();
    });

    afterEach(() => {
      httpMock.verify();
    });

    function fillValid(description = 'Analgésico'): void {
      component.form.controls.description.setValue(description);
      component.form.controls.shelf.setValue('A');
      component.form.controls.section.setValue('1');
      component.form.controls.cell.setValue('2');
      fixture.detectChanges();
    }

    it('muestra título, etiqueta visible, hint y maxlength coherentes (S2/S9)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const input = compiled.querySelector('input[formControlName="description"]');

      expect(compiled.textContent).toContain('Nueva ubicación');
      expect(compiled.textContent).toContain('Descripción');
      expect(compiled.textContent).toContain('Entre 1 y 100 caracteres.');
      expect(input?.getAttribute('maxlength')).toBe('100');
      expect(input?.getAttribute('autocomplete')).toBe('off');
      expect(compiled.textContent).toContain('Crear ubicación');
    });

    it('el checkbox «Ubicación activa» existe y nace marcado (D-5)', () => {
      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.textContent).toContain('Ubicación activa');
      expect(compiled.querySelector('mat-checkbox')).not.toBeNull();
      expect(component.form.controls.isActive.value).toBe(true);
    });

    it('bloquea el envío vacío con el error propio «Ingresa la descripción» (S2/S8)', () => {
      component.onSubmit();

      expect(component.form.invalid).toBe(true);
      expect(component.form.controls.description.hasError('required')).toBe(true);
      httpMock.expectNone(LOCATIONS_URL);

      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Ingresa la descripción');
    });

    it('una descripción de solo espacios cuenta como vacía y no emite POST (S2)', () => {
      fillValid('     ');
      component.onSubmit();

      expect(component.form.invalid).toBe(true);
      expect(component.form.controls.description.hasError('required')).toBe(true);
      httpMock.expectNone(LOCATIONS_URL);

      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Ingresa la descripción');
    });

    it('rechaza más de 100 caracteres con el error propio de longitud (S2)', () => {
      fillValid('a'.repeat(101));
      component.onSubmit();

      expect(component.form.invalid).toBe(true);
      expect(component.form.controls.description.hasError('maxlength')).toBe(true);
      httpMock.expectNone(LOCATIONS_URL);

      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(
        'La descripción no debe superar los 100 caracteres.',
      );
    });

    it('envía el POST recortado con is_active del checkbox por defecto (true) y cierra saved', () => {
      fillValid('  Analgésico  ');
      const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;

      form.dispatchEvent(new Event('submit'));
      form.dispatchEvent(new Event('submit'));

      const req = httpMock.expectOne(LOCATIONS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ description: 'Analgésico', shelf: 'A', section: '1', cell: '2', is_active: true });
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('created_at');

      req.flush(locationDto(), { status: 201, statusText: 'Created' });
      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('envía is_active false cuando el checkbox se desmarca', () => {
      fillValid('Antibiótico');
      component.form.controls.isActive.setValue(false);

      component.onSubmit();

      const req = httpMock.expectOne(LOCATIONS_URL);
      expect(req.request.body).toEqual({ description: 'Antibiótico', shelf: 'A', section: '1', cell: '2', is_active: false });
      req.flush(locationDto({ description: 'Antibiótico', shelf: 'A', section: '1', cell: '2', is_active: false }));
      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('muestra aria-busy durante el envío y deshabilita campos y botón (S9)', () => {
      fillValid();
      component.onSubmit();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
      expect(
        compiled.querySelector('button[type="submit"]')?.getAttribute('disabled'),
      ).not.toBeNull();
      expect(compiled.textContent).toContain('Guardando…');

      httpMock.expectOne(LOCATIONS_URL).flush(locationDto());
    });

    it('ante 409 deja el diálogo abierto con el duplicado bajo el campo description (S2/S8)', () => {
      fillValid();
      component.onSubmit();

      httpMock
        .expectOne(LOCATIONS_URL)
        .flush('duplicado sintético', { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      expect(dialogRefStub.close).not.toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
      expect(component.fieldErrors().description).toBe('Ya existe una ubicación con esa descripción.');
      expect(component.form.controls.description.invalid).toBe(true);
      expect(component.form.controls.description.hasError('server')).toBe(true);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.dm-location-form__error')?.getAttribute('role')).toBe('alert');
      expect(compiled.querySelector('mat-error')?.textContent).toContain(
        'Ya existe una ubicación con esa descripción.',
      );
    });

    it('el reintento tras un 409 limpia el error de servidor y vuelve a enviar (S2)', () => {
      fillValid();
      component.onSubmit();

      httpMock
        .expectOne(LOCATIONS_URL)
        .flush('duplicado sintético', { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(component.form.controls.description.hasError('server')).toBe(true);

      component.form.controls.description.setValue('Antibiótico');
      component.onSubmit();

      expect(component.fieldErrors()).toEqual({});
      expect(component.form.controls.description.hasError('server')).toBe(false);
      httpMock.expectOne(LOCATIONS_URL).flush(locationDto({ description: 'Antibiótico' }));
      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('ante 422 ubicación el error por campo y avisa en alert sin exponer el backend (S8)', () => {
      fillValid();
      component.onSubmit();

      httpMock
        .expectOne(LOCATIONS_URL)
        .flush(
          { errors: [{ field: 'description', message: 'RAW-LEAK too short' }] },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      fixture.detectChanges();

      expect(component.fieldErrors().description).toBe('Revisa la descripción');
      expect(component.form.controls.description.invalid).toBe(true);
      expect(component.form.controls.description.hasError('server')).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Revisa los datos ingresados.');
      expect(fixture.nativeElement.textContent).not.toContain('RAW-LEAK');
      expect(component.submitting()).toBe(false);
      expect(dialogRefStub.close).not.toHaveBeenCalled();
    });
  });

  describe('modo edición (S3)', () => {
    let fixture: ComponentFixture<LocationFormDialog>;
    let component: LocationFormDialog;
    let httpMock: HttpTestingController;
    let dialogRefStub: { close: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      TestBed.resetTestingModule();
      ({ fixture, component, httpMock, dialogRefStub } = await configure({
        mode: 'edit',
        locationId: 7,
      }));
    });

    afterEach(() => {
      httpMock.verify();
    });

    it('precarga con GET /{id}, muestra aria-busy y no renderiza is_active (S3)', () => {
      expect(component.loadingLocation()).toBe(true);
      fixture.detectChanges();

      let compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
      expect(compiled.querySelector('.dm-location-form__loading')?.getAttribute('role')).toBe(
        'status',
      );
      expect(compiled.textContent).toContain('Cargando ubicación…');
      expect(compiled.textContent).toContain('Editar ubicación');
      expect(compiled.textContent).toContain('Guardar cambios');

      httpMock.expectOne(`${LOCATIONS_URL}/7`).flush(locationDto());
      fixture.detectChanges();

      compiled = fixture.nativeElement as HTMLElement;
      expect(component.loadingLocation()).toBe(false);
      expect(component.form.controls.description.value).toBe('Analgésico');
      // Sin control de is_active en edición: ni en el DOM ni habilitado.
      expect(compiled.querySelector('mat-checkbox')).toBeNull();
      expect(component.form.controls.isActive.disabled).toBe(true);
    });

    it('el PUT conserva el is_active del registro precargado (inactivo) y recorta (S3)', () => {
      httpMock
        .expectOne(`${LOCATIONS_URL}/7`)
        .flush(locationDto({ description: 'Analgésico', shelf: 'A', section: '1', cell: '2', is_active: false }));
      fixture.detectChanges();

      component.form.controls.description.setValue('  Antibiótico  ');
      component.onSubmit();

      const req = httpMock.expectOne(`${LOCATIONS_URL}/7`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ description: 'Antibiótico', shelf: 'A', section: '1', cell: '2', is_active: false });
      expect(req.request.body).not.toHaveProperty('id');
      expect(req.request.body).not.toHaveProperty('created_at');

      req.flush(locationDto({ description: 'Antibiótico', shelf: 'A', section: '1', cell: '2', is_active: false }));
      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('el PUT conserva el is_active true de un registro activo (S3)', () => {
      httpMock.expectOne(`${LOCATIONS_URL}/7`).flush(locationDto());
      fixture.detectChanges();

      component.form.controls.description.setValue('Analgésico');
      component.onSubmit();

      const req = httpMock.expectOne(`${LOCATIONS_URL}/7`);
      expect(req.request.body).toEqual({ description: 'Analgésico', shelf: 'A', section: '1', cell: '2', is_active: true });
      req.flush(locationDto());
      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('ante 404 de precarga cierra con { notFound: true } para que la lista avise (S3/S5)', () => {
      httpMock
        .expectOne(`${LOCATIONS_URL}/7`)
        .flush('ausente sintético', { status: 404, statusText: 'Not Found' });

      expect(dialogRefStub.close).toHaveBeenCalledWith({ notFound: true });
    });
  });

  describe('cancelar sin efectos (S3)', () => {
    it('en creación «Cancelar» cierra sin valor y sin emitir peticiones', async () => {
      TestBed.resetTestingModule();
      const { fixture, httpMock, dialogRefStub } = await configure({ mode: 'create' });
      fixture.detectChanges();

      httpMock.expectNone(LOCATIONS_URL);

      const compiled = fixture.nativeElement as HTMLElement;
      const cancel = compiled.querySelector<HTMLButtonElement>('button[mat-dialog-close]');
      expect(cancel).not.toBeNull();
      expect(cancel?.textContent).toContain('Cancelar');
      expect(cancel?.getAttribute('type')).toBe('button');

      cancel?.click();

      expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
      const cancelArg = dialogRefStub.close.mock.calls[0][0];
      expect(cancelArg).toBeFalsy();
      expect(cancelArg).not.toEqual({ notFound: true });
      httpMock.expectNone(LOCATIONS_URL);
      httpMock.verify();
    });

    it('en edición «Cancelar» tras la precarga cierra sin valor y sin GET adicional', async () => {
      TestBed.resetTestingModule();
      const { fixture, httpMock, dialogRefStub } = await configure({
        mode: 'edit',
        locationId: 7,
      });
      fixture.detectChanges();

      httpMock.expectOne(`${LOCATIONS_URL}/7`).flush(locationDto());
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const cancel = compiled.querySelector<HTMLButtonElement>('button[mat-dialog-close]');
      expect(cancel).not.toBeNull();

      cancel?.click();

      expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
      const editCancelArg = dialogRefStub.close.mock.calls[0][0];
      expect(editCancelArg).toBeFalsy();
      expect(editCancelArg).not.toEqual({ notFound: true });
      httpMock.expectNone(`${LOCATIONS_URL}/7`);
      httpMock.verify();
    });

    it('Escape cierra el diálogo real sin emitir peticiones (MatDialog por defecto)', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      }).compileComponents();

      const httpMock = TestBed.inject(HttpTestingController);
      const dialog = TestBed.inject(MatDialog);
      const data: LocationFormData = { mode: 'create' };
      const ref = dialog.open(LocationFormDialog, { data });

      // `MatDialogContainer` cierra cuando el overlay recibe un `keydown` con
      // `keyCode === 27` (CDK `dialog.mjs`), no por el `key` moderno: jsdom
      // deja `keyCode` en 0 si solo se pasa `key`, y el diálogo no cerraría.
      const closed = new Promise<unknown>((resolve) => {
        ref.afterClosed().subscribe((value) => resolve(value));
      });

      // El `OverlayKeyboardDispatcher` escucha `keydown` en `body`.
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
      );

      await expect(closed).resolves.toBeUndefined();
      httpMock.expectNone(LOCATIONS_URL);
      httpMock.verify();
    });
  });
});
