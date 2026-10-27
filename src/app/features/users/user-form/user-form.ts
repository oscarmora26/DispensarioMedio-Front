/**
 * Crear/editar usuario (F-006): diálogo `dm-user-form` sobre el listado.
 *
 * - Formulario reactivo tipado (`FormGroup` con `FormControl` `nonNullable`).
 * - Crear: `email`/`username` (`required` + formatos de F-005/R-02 provisional),
 *   `password` obligatoria (`required` + `maxlength(128)`), rol (`mat-select`
 *   `ADMIN`/`MEDICO` que el servicio convierte a `role_id`), `doctor_id` solo
 *   visible y habilitado para `MEDICO` (R-03: ID directo hasta el OpenAPI) y
 *   `is_active` con «Usuario activo» (por defecto activo).
 * - Editar: precarga con `GET /{id}`; sin campo de contraseña (el `PUT` nunca
 *   la envía: «No modifica la contraseña», el cambio vive en una feature
 *   posterior (`POST /users/{id}/reset-password`); `is_active` no se edita aquí (se cambia con
 *   Activar/Desactivar del listado). `404` al precargar cierra el diálogo con
 *   `{ notFound: true }` para que la lista avise en toast. «Cancelar», Escape
 *   o backdrop solo cierran sin valor: nunca es un 404 (F-007).
 * - Submit con `(ngSubmit)`: crear emite `POST` (→ `201`) y editar `PUT`
 *   (→ `200`, sin `PATCH`). `409` deja el diálogo abierto con el mensaje de
 *   duplicado en `role="alert"`; `422` marca errores `server` por campo. El
 *   pegado en la contraseña no se bloquea y el toggle no envía.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { mapUsersError, UsersFieldErrors } from '../users-error';
import { USER_ROLE_OPTIONS } from '../users.models';
import { UsersService } from '../users.service';

/** Abrir en modo creación (sin precarga). */
export interface UserFormCreateData {
  mode: 'create';
}

/** Abrir en modo edición (precarga con `GET /{id}`). */
export interface UserFormEditData {
  mode: 'edit';
  userId: number;
}

export type UserFormData = UserFormCreateData | UserFormEditData;

/** `saved` tras `201`/`200`; `{ notFound: true }` si el `GET /{id}` dio 404. */
export type UserFormResult = 'saved' | { notFound: true };

@Component({
  selector: 'dm-user-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormDialog {
  private readonly users = inject(UsersService);
  private readonly dialogRef = inject(MatDialogRef<UserFormDialog, UserFormResult>);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<UserFormData>(MAT_DIALOG_DATA);

  /** Opciones de rol del `mat-select` (etiquetas en español). */
  protected readonly roleOptions = USER_ROLE_OPTIONS;

  /** `true` en edición: la contraseña es opcional y no se muestra `is_active`. */
  protected readonly isEdit = this.data.mode === 'edit';

  /** Precarga del usuario en edición (`GET /{id}`). */
  readonly loadingUser = signal(this.isEdit);

  /** Envío en curso: deshabilita campos y botón, `aria-busy` y etiqueta. */
  readonly submitting = signal(false);

  /** Error general ya traducido para la región `role="alert"`. */
  readonly error = signal<string | null>(null);

  /** Errores 422 por campo ya traducidos (fuente del validador `server`). */
  readonly fieldErrors = signal<UsersFieldErrors>({});

  /** Visibilidad de la contraseña. */
  readonly showPassword = signal(false);

  /** `is_active` del usuario en edición (no editable aquí; viaja en el PUT). */
  private loadedIsActive = true;

  readonly form = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50), this.serverError('username')],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
        Validators.maxLength(255),
        this.serverError('email'),
      ],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: this.isEdit
        ? [Validators.maxLength(128), this.serverError('password')]
        : [Validators.required, Validators.maxLength(128), this.serverError('password')],
    }),
    role: new FormControl<'ADMIN' | 'MEDICO'>('MEDICO', {
      nonNullable: true,
      validators: [Validators.required, this.serverError('role')],
    }),
    doctorId: new FormControl<number | null>(null, {
      validators: [this.serverError('doctorId')],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    if (this.data.mode === 'edit') {
      // En edición no hay campo de contraseña (el PUT no la modifica):
      // se inhabilita para que no participe en la validación ni en el envío.
      this.form.controls.password.disable();
      this.loadUser(this.data.userId);
    }
    this.syncDoctorIdWithRole();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  onSubmit(): void {
    this.fieldErrors.set({});
    this.refreshServerValidity();
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting() || this.loadingUser()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const request =
      this.data.mode === 'create'
        ? this.users.create({
            username: raw.username,
            email: raw.email,
            password: raw.password,
            role: raw.role,
            doctorId: raw.doctorId,
            isActive: raw.isActive,
          })
        : this.users.update(this.data.userId, {
            username: raw.username,
            email: raw.email,
            role: raw.role,
            doctorId: raw.doctorId,
            isActive: this.loadedIsActive,
          });

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialogRef.close('saved');
      },
      error: (error: unknown) => {
        // El 404 en edición ya se resolvió en `loadUser()`; cualquier otro
        // fallo mantiene el diálogo abierto con su mensaje propio.
        const mapped = mapUsersError(error);
        this.fieldErrors.set(mapped.fieldErrors ?? {});
        this.refreshServerValidity();
        this.error.set(mapped.message);
        this.submitting.set(false);
      },
    });
  }

  /** Precarga del diálogo de edición con `GET /{id}`. */
  private loadUser(userId: number): void {
    this.users
      .getById(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.loadedIsActive = user.isActive;
          this.form.controls.username.setValue(user.username);
          this.form.controls.email.setValue(user.email);
          if (user.role === 'ADMIN') {
            this.form.controls.role.setValue('ADMIN');
          } else if (user.role === 'MEDICO') {
            this.form.controls.role.setValue('MEDICO');
          }
          // Otro valor: se conserva el valor por defecto; la edición efectiva
          // a roles conocidos la valida el backend (`role_id`, R-01).
          this.form.controls.doctorId.setValue(user.doctorId);
          this.syncDoctorIdWithRole();
          this.loadingUser.set(false);
        },
        error: () => {
          // 404 u otro fallo: la lista informa; el diálogo no sirve vacío.
          this.dialogRef.close({ notFound: true });
        },
      });
  }

  /**
   * `doctor_id` solo para `MEDICO` (§7): con `ADMIN` se limpia y deshabilita
   * (el mapper envía `null`); con `MEDICO` se habilita como ID directo (R-03).
   */
  private syncDoctorIdWithRole(): void {
    const role = this.form.controls.role;
    const doctorId = this.form.controls.doctorId;

    const apply = (): void => {
      if (role.value === 'MEDICO') {
        doctorId.enable({ emitEvent: false });
      } else {
        doctorId.setValue(null, { emitEvent: false });
        doctorId.disable({ emitEvent: false });
      }
    };

    apply();
    role.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(apply);
  }

  /**
   * Revalida cada control tras fijar/limpiar `fieldErrors`: el
   * `updateValueAndValidity()` del `FormGroup` no propaga a los hijos, así que
   * sin este recorrido el validador `serverError` nunca se reevalúa y los
   * `mat-error` con `hasError('server')` jamás se muestran.
   */
  private refreshServerValidity(): void {
    Object.values(this.form.controls).forEach((control) => control.updateValueAndValidity());
  }

  /**
   * Validador que refleja el rechazo 422 del backend para el campo: mientras
   * `fieldErrors` conserve mensaje para ese campo, el control es inválido con
   * error `server` (así `mat-error` lo muestra con el estado correcto). Se
   * limpia al iniciar cada submit, de modo que nunca bloquea un reintento.
   */
  private serverError(field: keyof UsersFieldErrors): ValidatorFn {
    return () => (this.fieldErrors()[field] ? { server: true } : null);
  }
}
