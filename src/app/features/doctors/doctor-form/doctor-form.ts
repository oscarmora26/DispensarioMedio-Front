/**
 * Crear/editar médico (F-014, S2-S7): diálogo `dm-doctor-form` sobre el listado.
 *
 * - Formulario reactivo tipado (`FormGroup` con `FormControl` `nonNullable`).
 * - Crear: `name` obligatorio (1-150, recortado), `cedula` obligatoria
 *   (11 dígitos tras descartar separadores), `lab_shift` del catálogo cerrado
 *   de cuatro tandas, `specialty` texto libre obligatorio (1-100, recortado) e
 *   `is_active` por defecto `true`. Emite `POST` → `201`.
 * - Cédula con máscara (S3): el control guarda el texto con máscara
 *   `XXX-XXXXXXX-X` (3-7-1) y el body envía los 11 dígitos sin máscara
 *   (`toDoctorPayload()`). Un valor incompleto o con letras bloquea el envío
 *   con mensaje propio.
 * - Tanda (S4): `mat-select` cerrado con Matutina/Vespertina/Nocturna/Mixta.
 *   Si el registro precargado trae un valor no canónico, se agrega como opción
 *   extra (`labShiftOptions()`) para no perderlo al guardar.
 * - La asociación con usuarios es de **solo lectura** (S6): el formulario no la
 *   muestra ni la edita y el body nunca la incluye.
 * - Editar (S7): precarga con `GET /{id}` (también si está inactivo) y emite el
 *   `PUT` de reemplazo completo. El estado no se edita aquí (se cambia con
 *   Activar/Desactivar del listado) y viaja con el valor precargado. `404` al
 *   precargar cierra con `{ notFound: true }` para que el listado avise;
 *   Cancelar/Escape/backdrop solo cierran.
 * - `409` (cédula duplicada) deja el diálogo abierto con el mensaje como error
 *   de campo propio; `422` marca errores `server` por campo sin exponer
 *   mensajes crudos del backend.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DoctorsFieldErrors, mapDoctorsError } from '../doctors-error';
import {
  DoctorFormInput,
  LAB_SHIFT_MAX_LENGTH,
  NAME_MAX_LENGTH,
  SPECIALTY_MAX_LENGTH,
  cedulaDigits,
  formatCedula,
  isCedulaComplete,
  labShiftLabel,
  labShiftOptions,
} from '../doctors.models';
import { DoctorsService } from '../doctors.service';

/**
 * `required` sobre el valor recortado: una cadena de solo espacios no es
 * válida (el body de escritura viaja con `trim`). Reutiliza la clave
 * `required` para que el mismo `mat-error` la muestre.
 */
const requiredTrimmed: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true };

/**
 * La cédula es válida solo con los 11 dígitos completos una vez descartados
 * los separadores (S3). El valor vacío lo cubre `requiredTrimmed`.
 */
const cedulaFormat: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = typeof control.value === 'string' ? control.value.trim() : '';

  // El valor vacío lo cubre `requiredTrimmed`: aquí solo se juzga el formato.
  return value.length === 0 || isCedulaComplete(value) ? null : { cedula: true };
};

/** Abrir en modo creación (sin precarga). */
export interface DoctorFormCreateData {
  mode: 'create';
}

/** Abrir en modo edición (precarga con `GET /{id}`). */
export interface DoctorFormEditData {
  mode: 'edit';
  doctorId: number;
}

export type DoctorFormData = DoctorFormCreateData | DoctorFormEditData;

/** `saved` tras `201`/`200`; `{ notFound: true }` si el `GET /{id}` dio 404. */
export type DoctorFormResult = 'saved' | { notFound: true };

@Component({
  selector: 'dm-doctor-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './doctor-form.html',
  styleUrl: './doctor-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorFormDialog {
  private readonly doctors = inject(DoctorsService);
  private readonly dialogRef =
    inject<MatDialogRef<DoctorFormDialog, DoctorFormResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<DoctorFormData>(MAT_DIALOG_DATA);

  /** Longitud máxima del nombre expuesta al template (`maxlength`). */
  protected readonly nameMaxLength = NAME_MAX_LENGTH;

  /** Longitud máxima de la especialidad expuesta al template (`maxlength`). */
  protected readonly specialtyMaxLength = SPECIALTY_MAX_LENGTH;

  /** Longitud máxima de la tanda en el contrato. */
  protected readonly labShiftMaxLength = LAB_SHIFT_MAX_LENGTH;

  /** `true` en edición: sin control de `is_active` y con los campos precargados. */
  protected readonly isEdit = this.data.mode === 'edit';

  /** Etiqueta visible de cada tanda (S4). */
  protected readonly label = labShiftLabel;

  /**
   * Tanda del registro precargado. Alimenta las opciones del `mat-select`: un
   * valor no canónico se agrega como opción extra para no perderlo (S4).
   */
  private readonly loadedLabShift = signal('');

  /** Opciones del select cerrado de tanda (S4). */
  readonly shiftOptions = computed(() => labShiftOptions(this.loadedLabShift()));

  /** Precarga del registro en edición (`GET /{id}`). */
  readonly loadingDoctor = signal(this.isEdit);

  /** Envío en curso: deshabilita campos y botón, `aria-busy` y etiqueta. */
  readonly submitting = signal(false);

  /** Error general ya traducido para la región `role="alert"`. */
  readonly error = signal<string | null>(null);

  /** Errores 409/422 por campo ya traducidos (fuente del validador `server`). */
  readonly fieldErrors = signal<DoctorsFieldErrors>({});

  /** `is_active` del registro en edición (no editable aquí; viaja en el `PUT`). */
  private loadedIsActive = true;

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        requiredTrimmed,
        Validators.maxLength(NAME_MAX_LENGTH),
        this.serverError('name'),
      ],
    }),
    cedula: new FormControl('', {
      nonNullable: true,
      validators: [requiredTrimmed, cedulaFormat, this.serverError('cedula')],
    }),
    labShift: new FormControl('', {
      nonNullable: true,
      validators: [
        requiredTrimmed,
        Validators.maxLength(LAB_SHIFT_MAX_LENGTH),
        this.serverError('labShift'),
      ],
    }),
    specialty: new FormControl('', {
      nonNullable: true,
      validators: [
        requiredTrimmed,
        Validators.maxLength(SPECIALTY_MAX_LENGTH),
        this.serverError('specialty'),
      ],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    if (this.data.mode === 'edit') {
      // En edición el estado se cambia desde el listado: el control no se
      // renderiza y su valor viaja tomado del registro precargado.
      this.form.controls.isActive.disable();
      this.loadDoctor(this.data.doctorId);
    }
  }

  /**
   * Aplica la máscara `XXX-XXXXXXX-X` mientras se escribe o se pega (S3):
   * descarta lo que no sea dígito, recorta a 11 y deja el cursor tras el
   * último dígito escrito.
   */
  protected onCedulaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const caretDigits = digitsBeforeCaret(input);
    const masked = formatCedula(input.value);

    input.value = masked;
    this.form.controls.cedula.setValue(masked, { emitEvent: false });

    if (caretDigits !== null) {
      const caret = caretAfterDigits(masked, caretDigits);
      input.setSelectionRange(caret, caret);
    }
  }

  onSubmit(): void {
    this.fieldErrors.set({});
    this.refreshServerValidity();
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting() || this.loadingDoctor()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const input: DoctorFormInput = {
      name: raw.name,
      cedula: raw.cedula,
      labShift: raw.labShift,
      specialty: raw.specialty,
      isActive: raw.isActive,
    };

    const request =
      this.data.mode === 'create'
        ? this.doctors.create(input)
        : this.doctors.update(this.data.doctorId, { ...input, isActive: this.loadedIsActive });

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialogRef.close('saved');
      },
      error: (error: unknown) => {
        const mapped = mapDoctorsError(error);
        this.fieldErrors.set(mapped.fieldErrors ?? {});
        this.refreshServerValidity();
        this.error.set(mapped.message);
        this.submitting.set(false);
      },
    });
  }

  /** Precarga del diálogo de edición con `GET /{id}`. */
  private loadDoctor(doctorId: number): void {
    this.doctors
      .getById(doctorId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (doctor) => {
          this.loadedIsActive = doctor.isActive;
          this.loadedLabShift.set(doctor.labShift);
          this.form.patchValue({
            name: doctor.name,
            cedula: formatCedula(doctor.cedula),
            labShift: doctor.labShift,
            specialty: doctor.specialty,
            isActive: doctor.isActive,
          });
          this.form.controls.isActive.disable();
          this.loadingDoctor.set(false);
        },
        error: () => {
          // 404 u otro fallo: el listado informa; el diálogo no sirve vacío.
          this.dialogRef.close({ notFound: true });
        },
      });
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
   * Validador que refleja el rechazo 409/422 del backend para el campo:
   * mientras `fieldErrors` conserve mensaje para ese campo, el control es
   * inválido con error `server`. Se limpia al iniciar cada submit, de modo que
   * nunca bloquea un reintento.
   */
  private serverError(field: keyof DoctorsFieldErrors): ValidatorFn {
    return () => (this.fieldErrors()[field] ? { server: true } : null);
  }
}

/** Dígitos escritos antes del cursor (para no saltar al final al enmascarar). */
function digitsBeforeCaret(input: HTMLInputElement): number | null {
  const start = input.selectionStart;
  if (start === null) {
    return null;
  }
  return cedulaDigits(input.value.slice(0, start)).length;
}

/** Posición del cursor en el texto enmascarado tras `digits` dígitos. */
function caretAfterDigits(masked: string, digits: number): number {
  if (digits <= 0) {
    return 0;
  }

  let seen = 0;
  for (let index = 0; index < masked.length; index += 1) {
    if (cedulaDigits(masked[index]).length === 1) {
      seen += 1;
      if (seen === digits) {
        return index + 1;
      }
    }
  }
  return masked.length;
}
