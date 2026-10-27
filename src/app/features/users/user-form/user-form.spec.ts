import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { UserFormDialog, UserFormData } from './user-form';

const USERS_URL = `${environment.apiUrl}/v1/users`;

function userDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 12,
    username: 'aperez',
    email: 'aperez@example.test',
    role: 'MEDICO',
    doctor_id: 5,
    is_active: true,
    ...overrides,
  };
}

async function configure(data: UserFormData): Promise<{
  fixture: ComponentFixture<UserFormDialog>;
  component: UserFormDialog;
  httpMock: HttpTestingController;
  dialogRefStub: { close: ReturnType<typeof vi.fn> };
}> {
  const dialogRefStub = { close: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [UserFormDialog],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRefStub },
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(UserFormDialog);
  const component = fixture.componentInstance;

  return { fixture, component, httpMock, dialogRefStub };
}

describe('UserFormDialog (F-006 CA-05/CA-06/CA-07/CA-10/CA-13)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('modo creación', () => {
    let fixture: ComponentFixture<UserFormDialog>;
    let component: UserFormDialog;
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

    function fillValid(overrides: { role?: 'ADMIN' | 'MEDICO' } = {}): void {
      component.form.controls.username.setValue('aperez');
      component.form.controls.email.setValue('aperez@example.test');
      component.form.controls.password.setValue('Secreto-sintetico-1');
      component.form.controls.role.setValue(overrides.role ?? 'MEDICO');
      component.form.controls.doctorId.setValue(5);
      fixture.detectChanges();
    }

    it('expone etiquetas visibles, autocomplete y maxlength coherentes con F-005 (CA-10/CA-13)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const username = compiled.querySelector('input[formControlName="username"]');
      const email = compiled.querySelector('input[formControlName="email"]');
      const password = compiled.querySelector('input[formControlName="password"]');

      expect(compiled.textContent).toContain('Usuario');
      expect(compiled.textContent).toContain('Correo electrónico');
      expect(username?.getAttribute('autocomplete')).toBe('username');
      expect(username?.getAttribute('maxlength')).toBe('50');
      expect(email?.getAttribute('autocomplete')).toBe('email');
      expect(email?.getAttribute('maxlength')).toBe('255');
      expect(password?.getAttribute('autocomplete')).toBe('new-password');
      expect(password?.getAttribute('maxlength')).toBe('128');
    });

    it('ofrece solo ADMIN/MEDICO con etiquetas en español (CA-07)', () => {
      // Las opciones de `mat-select` se renderizan en el overlay (fuera del
      // fixture); se verifica el modelo que las alimenta y el `mat-select`.
      const roleOptions = (component as unknown as { roleOptions: unknown }).roleOptions;
      expect(roleOptions).toEqual([
        { value: 'ADMIN', label: 'Administrador' },
        { value: 'MEDICO', label: 'Médico' },
      ]);
      expect(fixture.nativeElement.querySelector('mat-select')).not.toBeNull();
    });

    it('muestra doctor_id solo con rol MEDICO y lo deshabilita con ADMIN (CA-10, R-03)', () => {
      let compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('input[formControlName="doctorId"]')).not.toBeNull();

      component.form.controls.role.setValue('ADMIN');
      fixture.detectChanges();

      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('input[formControlName="doctorId"]')).toBeNull();
      expect(component.form.controls.doctorId.disabled).toBe(true);
      expect(component.form.controls.doctorId.value).toBeNull();
    });

    it('bloquea el envío con errores propios por campo tras markAllAsTouched (CA-10)', () => {
      component.onSubmit();

      expect(component.form.invalid).toBe(true);
      httpMock.expectNone(USERS_URL);

      component.form.controls.email.setValue('sin-arroba');
      component.form.controls.email.markAsTouched();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Ingresa un correo electrónico válido.');
    });

    it('envía una sola vez con Enter y emite el POST exacto con role_id (CA-05/CA-07)', () => {
      fillValid();
      const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;

      form.dispatchEvent(new Event('submit'));
      form.dispatchEvent(new Event('submit'));

      const req = httpMock.expectOne(USERS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        username: 'aperez',
        email: 'aperez@example.test',
        password: 'Secreto-sintetico-1',
        role_id: 2,
        doctor_id: 5,
        is_active: true,
      });

      req.flush(userDto());
      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('con ADMIN envía role_id 1 y doctor_id null aunque se informe (CA-07, §7)', () => {
      fillValid({ role: 'ADMIN' });
      component.form.controls.doctorId.enable();
      component.form.controls.doctorId.setValue(9);

      component.onSubmit();

      const req = httpMock.expectOne(USERS_URL);
      expect(req.request.body).toMatchObject({ role_id: 1, doctor_id: null });
      req.flush(userDto({ role: 'ADMIN', doctor_id: null }));
    });

    it('marca aria-busy durante el envío y deshabilita el botón (CA-13)', () => {
      fillValid();
      component.onSubmit();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
      expect(
        compiled.querySelector('button[type="submit"]')?.getAttribute('disabled'),
      ).not.toBeNull();

      httpMock.expectOne(USERS_URL).flush(userDto());
    });

    it('ante 409 deja el diálogo abierto con el mensaje de duplicado en alert (CA-05)', () => {
      fillValid();
      component.onSubmit();

      httpMock
        .expectOne(USERS_URL)
        .flush('duplicado sintético', { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      expect(dialogRefStub.close).not.toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.dm-user-form__error')?.getAttribute('role')).toBe('alert');
      expect(compiled.textContent).toContain('Ya existe un usuario con ese correo electrónico.');
    });

    it('ante 422 conserva los errores por campo y avisa en alert sin exponer el backend (CA-10/CA-11)', () => {
      fillValid();
      component.onSubmit();

      httpMock
        .expectOne(USERS_URL)
        .flush(
          { errors: [{ field: 'email', message: 'taken' }] },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      fixture.detectChanges();

      expect(component.fieldErrors().email).toBe('Revisa el correo electrónico');
      expect(fixture.nativeElement.textContent).toContain('Revisa los datos ingresados.');
      expect(fixture.nativeElement.textContent).not.toContain('taken');
      expect(component.submitting()).toBe(false);
      expect(dialogRefStub.close).not.toHaveBeenCalled();
    });

    // CA-10 (verificado tras F-03): tras fijar `fieldErrors`, el diálogo
    // revalida cada control con `refreshServerValidity()` (`formGroup.
    // updateValueAndValidity()` no propaga a los hijos), así que las ramas
    // `mat-error` con `hasError('server')` se muestran correctamente.
    it('ante 422 el control afectado queda inválido con error server', () => {
      fillValid();
      component.onSubmit();

      httpMock
        .expectOne(USERS_URL)
        .flush(
          { errors: [{ field: 'email', message: 'taken' }] },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      fixture.detectChanges();

      expect(component.form.controls.email.invalid).toBe(true);
      expect(component.form.controls.email.hasError('server')).toBe(true);
    });

    it('el toggle no envía, alterna aria-pressed y el type, y el pegado no se bloquea (CA-10/CA-13)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const toggle = compiled.querySelector<HTMLButtonElement>('.dm-user-form__toggle');
      const password = compiled.querySelector<HTMLInputElement>(
        'input[formControlName="password"]',
      );

      expect(toggle?.getAttribute('type')).toBe('button');
      expect(toggle?.getAttribute('aria-pressed')).toBe('false');

      toggle?.click();
      fixture.detectChanges();

      expect(component.showPassword()).toBe(true);
      expect(toggle?.getAttribute('aria-pressed')).toBe('true');
      expect(password?.getAttribute('type')).toBe('text');
      expect(password?.onpaste).toBeNull();
      httpMock.expectNone(USERS_URL);
    });
  });

  describe('modo edición', () => {
    let fixture: ComponentFixture<UserFormDialog>;
    let component: UserFormDialog;
    let httpMock: HttpTestingController;
    let dialogRefStub: { close: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      TestBed.resetTestingModule();
      ({ fixture, component, httpMock, dialogRefStub } = await configure({
        mode: 'edit',
        userId: 12,
      }));
    });

    afterEach(() => {
      httpMock.verify();
    });

    it('precarga con GET /{id} y oculta is_active en edición (CA-06)', () => {
      expect(component.loadingUser()).toBe(true);

      httpMock.expectOne(`${USERS_URL}/12`).flush(userDto());
      fixture.detectChanges();

      expect(component.loadingUser()).toBe(false);
      expect(component.form.controls.username.value).toBe('aperez');
      expect(component.form.controls.email.value).toBe('aperez@example.test');
      expect(component.form.controls.role.value).toBe('MEDICO');
      expect(component.form.controls.doctorId.value).toBe(5);
      expect(fixture.nativeElement.querySelector('input[formControlName="isActive"]')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Editar usuario');
    });

    it('la contraseña es opcional y vacía se omite del PUT (CA-06/CA-10)', () => {
      httpMock.expectOne(`${USERS_URL}/12`).flush(userDto());
      fixture.detectChanges();

      component.form.controls.password.setValue('');

      component.onSubmit();

      const req = httpMock.expectOne(`${USERS_URL}/12`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        username: 'aperez',
        email: 'aperez@example.test',
        role_id: 2,
        doctor_id: 5,
        is_active: true,
      });
      expect(req.request.body).not.toHaveProperty('password');

      req.flush(userDto());
      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('ante 404 de precarga cierra con notFound para que la lista avise (CA-06)', () => {
      httpMock
        .expectOne(`${USERS_URL}/12`)
        .flush('ausente sintético', { status: 404, statusText: 'Not Found' });

      expect(dialogRefStub.close).toHaveBeenCalledWith({ notFound: true });
    });
  });

  describe('cancelar sin 404 (F-007 CA-06, no-regresión)', () => {
    it('en creación no emite GET y «Cancelar» cierra sin valor (nunca notFound)', async () => {
      TestBed.resetTestingModule();
      const { fixture, httpMock, dialogRefStub } = await configure({ mode: 'create' });
      fixture.detectChanges();

      httpMock.expectNone(USERS_URL);

      const compiled = fixture.nativeElement as HTMLElement;
      const cancel = compiled.querySelector<HTMLButtonElement>('button[mat-dialog-close]');
      expect(cancel).not.toBeNull();
      expect(cancel?.textContent).toContain('Cancelar');
      // `mat-dialog-close` sin valor: cierra con `undefined`, no con `{ notFound: true }`.
      expect(cancel?.getAttribute('mat-dialog-close')).toBe('');
      expect(cancel?.getAttribute('type')).toBe('button');

      cancel?.click();

      // `mat-dialog-close` sin valor resuelve `""` (falsy, nunca `{ notFound: true }`):
      // CA-06 cubre `undefined`/`""`/`false` como cierres sin efecto.
      expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
      const cancelArg = dialogRefStub.close.mock.calls[0][0];
      expect(cancelArg).toBeFalsy();
      expect(cancelArg).not.toEqual({ notFound: true });
      httpMock.expectNone(USERS_URL);
      httpMock.verify();
    });

    it('en edición «Cancelar» tras la precarga cierra sin valor y sin GET adicional', async () => {
      TestBed.resetTestingModule();
      const { fixture, httpMock, dialogRefStub } = await configure({ mode: 'edit', userId: 12 });
      fixture.detectChanges();

      httpMock.expectOne(`${USERS_URL}/12`).flush(userDto());
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const cancel = compiled.querySelector<HTMLButtonElement>('button[mat-dialog-close]');
      expect(cancel).not.toBeNull();

      cancel?.click();

      expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
      const editCancelArg = dialogRefStub.close.mock.calls[0][0];
      expect(editCancelArg).toBeFalsy();
      expect(editCancelArg).not.toEqual({ notFound: true });
      httpMock.expectNone(`${USERS_URL}/12`);
      httpMock.verify();
    });
  });
});
