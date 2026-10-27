/**
 * Crear/editar paciente (F-013, S2-S6): diálogo `dm-patient-form` sobre el
 * listado.
 *
 * - Formulario reactivo tipado (`FormGroup` con `FormControl` `nonNullable`).
 * - Crear: `name` obligatorio (1-150, recortado), `cedula` obligatoria
 *   (11 dígitos tras descartar separadores), `patient_type` del catálogo
 *   cerrado, `carnet` opcional (≤50, **obligatorio con `ESTUDIANTE`**) e
 *   `is_active` por defecto `true` (D-5). Emite `POST` → `201`.
 * - Cédula con máscara (S3): el control guarda el texto con máscara
 *   `XXX-XXXXXXX-X` (3-7-1) y el body envía los 11 dígitos sin máscara
 *   (`toPatientPayload()`). Un valor incompleto o con letras bloquea el envío
 *   con mensaje propio.
 * - Editar (S6): precarga con `GET /{id}` (también si está inactivo) y emite el
 *   `PUT` de reemplazo completo. El estado no se edita aquí (se cambia con
 *   Activar/Desactivar del listado) y viaja con el valor precargado. Un carnet
 *   vacío se envía como `null`, que **borra** el almacenado. `404` al precargar
 *   cierra con `{ notFound: true }` para que el listado avise;
 *   Cancelar/Escape/backdrop solo cierran.
 * - `409` (cédula o carnet duplicado) deja el diálogo abierto con el mensaje
 *   como error de campo propio; `422` marca errores `server` por campo sin
 *   exponer mensajes crudos del backend.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
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
import { PatientsFieldErrors, mapPatientsError } from '../patients-error';
import {
  CARNET_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PATIENT_TYPES,
  PATIENT_TYPE_LABELS,
  PatientFormInput,
  PatientType,
  cedulaDigits,
  formatCedula,
  isCedulaComplete,
} from '../patients.models';
import { PatientsService } from '../patients.service';

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

/**
 * El carnet es obligatorio cuando el tipo de paciente es `ESTUDIANTE` (S4,
 * espejo de la regla del contrato). Lee el control de tipo por referencia para
 * que el error quede bajo el campo `carnet`.
 */
function carnetRequired(typeControl: FormControl<PatientType>): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const required = typeControl.value === 'ESTUDIANTE';
    const value = typeof control.value === 'string' ? control.value.trim() : '';

    return required && value.length === 0 ? { required: true } : null;
  };
}

/** Abrir en modo creación (sin precarga). */
export interface PatientFormCreateData {
  mode: 'create';
}

/** Abrir en modo edición (precarga con `GET /{id}`). */
export interface PatientFormEditData {
  mode: 'edit';
  patientId: number;
}

export type PatientFormData = PatientFormCreateData | PatientFormEditData;

/** `saved` tras `201`/`200`; `{ notFound: true }` si el `GET /{id}` dio 404. */
export type PatientFormResult = 'saved' | { notFound: true };

@Component({
  selector: 'dm-patient-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './patient-form.html',
  styleUrl: './patient-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientFormDialog {
  private readonly patients = inject(PatientsService);
  private readonly dialogRef =
    inject<MatDialogRef<PatientFormDialog, PatientFormResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<PatientFormData>(MAT_DIALOG_DATA);

  /** Longitud máxima del nombre expuesta al template (`maxlength`). */
  protected readonly nameMaxLength = NAME_MAX_LENGTH;

  /** Longitud máxima del carnet expuesta al template (`maxlength`). */
  protected readonly carnetMaxLength = CARNET_MAX_LENGTH;

  /** Catálogo cerrado de tipos (S5): el `mat-select` envía el valor en mayúsculas. */
  readonly patientTypes = PATIENT_TYPES;

  /** Etiqueta capitalizada de cada tipo (S5). */
  protected readonly label = (type: PatientType): string => PATIENT_TYPE_LABELS[type];

  /** `true` en edición: sin control de `is_active` y con los campos precargados. */
  protected readonly isEdit = this.data.mode === 'edit';

  /** Precarga del registro en edición (`GET /{id}`). */
  readonly loadingPatient = signal(this.isEdit);

  /** Envío en curso: deshabilita campos y botón, `aria-busy` y etiqueta. */
  readonly submitting = signal(false);

  /** Error general ya traducido para la región `role="alert"`. */
  readonly error = signal<string | null>(null);

  /** Errores 409/422 por campo ya traducidos (fuente del validador `server`). */
  readonly fieldErrors = signal<PatientsFieldErrors>({});

  /** `is_active` del registro en edición (no editable aquí; viaja en el `PUT`). */
  private loadedIsActive = true;

  /**
   * Control del tipo de paciente: se declara aparte porque el validador del
   * carnet lo lee por referencia (el error debe quedar bajo `carnet`).
   */
  private readonly patientTypeControl = new FormControl<PatientType>('ESTUDIANTE', {
    nonNullable: true,
    validators: [this.serverError('patientType')],
  });

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
    carnet: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.maxLength(CARNET_MAX_LENGTH),
        carnetRequired(this.patientTypeControl),
        this.serverError('carnet'),
      ],
    }),
    patientType: this.patientTypeControl,
    isActive: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    // Cambiar el tipo reevalúa el requerido condicional del carnet (S4).
    this.patientTypeControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.carnet.updateValueAndValidity());

    if (this.data.mode === 'edit') {
      // En edición el estado se cambia desde el listado: el control no se
      // renderiza y su valor viaja tomado del registro precargado.
      this.form.controls.isActive.disable();
      this.loadPatient(this.data.patientId);
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
    if (this.form.invalid || this.submitting() || this.loadingPatient()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const input: PatientFormInput = {
      name: raw.name,
      cedula: raw.cedula,
      carnet: raw.carnet,
      patientType: raw.patientType,
      isActive: raw.isActive,
    };

    const request =
      this.data.mode === 'create'
        ? this.patients.create(input)
        : this.patients.update(this.data.patientId, {
            ...input,
            isActive: this.loadedIsActive,
          });

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialogRef.close('saved');
      },
      error: (error: unknown) => {
        const mapped = mapPatientsError(error);
        this.fieldErrors.set(mapped.fieldErrors ?? {});
        this.refreshServerValidity();
        this.error.set(mapped.message);
        this.submitting.set(false);
      },
    });
  }

  /** Precarga del diálogo de edición con `GET /{id}`. */
  private loadPatient(patientId: number): void {
    this.patients
      .getById(patientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (patient) => {
          this.loadedIsActive = patient.isActive;
          this.form.patchValue({
            name: patient.name,
            cedula: formatCedula(patient.cedula),
            carnet: patient.carnet ?? '',
            patientType: patient.patientType,
            isActive: patient.isActive,
          });
          this.form.controls.isActive.disable();
          this.loadingPatient.set(false);
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
  private serverError(field: keyof PatientsFieldErrors): ValidatorFn {
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
