/**
 * Crear/editar tipo de fármaco (F-009, S2/S3): diálogo `dm-drug-type-form`
 * sobre el listado.
 *
 * - Formulario reactivo tipado (`FormGroup` con `FormControl` `nonNullable`).
 * - Crear: `description` obligatoria (1-100 caracteres, recortada; una cadena
 *   solo de espacios cuenta como vacía) y «Tipo de fármaco activo» por
 *   defecto activo (`is_active` opcional, D-5). Emite `POST` → `201`.
 * - Editar: precarga con `GET /{id}`, sin control de `is_active` (se cambia
 *   con Activar/Desactivar del listado y viaja en el `PUT` con el valor
 *   vigente). Emite `PUT` de reemplazo completo → `200`, que conserva
 *   `created_at`. `404` al precargar cierra con `{ notFound: true }` para que
 *   el listado avise en toast; Cancelar/Escape/backdrop solo cierran.
 * - `409` (descripción duplicada) deja el diálogo abierto con el mensaje como
 *   error de campo de `description`; `422` marca errores `server` por campo
 *   sin exponer mensajes crudos del backend.
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
import { DrugTypesFieldErrors, mapDrugTypesError } from '../drug-types-error';
import { DrugTypesService } from '../drug-types.service';

/** Longitud máxima de `description` (1-100, S2). */
const DESCRIPTION_MAX_LENGTH = 100;

/**
 * `required` sobre el valor recortado: una descripción de solo espacios no es
 * válida (el body de escritura viaja con `trim`). Reutiliza la clave
 * `required` para que el mismo `mat-error` la muestre.
 */
const requiredTrimmed: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true };

/** Abrir en modo creación (sin precarga). */
export interface DrugTypeFormCreateData {
  mode: 'create';
}

/** Abrir en modo edición (precarga con `GET /{id}`). */
export interface DrugTypeFormEditData {
  mode: 'edit';
  drugTypeId: number;
}

export type DrugTypeFormData = DrugTypeFormCreateData | DrugTypeFormEditData;

/** `saved` tras `201`/`200`; `{ notFound: true }` si el `GET /{id}` dio 404. */
export type DrugTypeFormResult = 'saved' | { notFound: true };

@Component({
  selector: 'dm-drug-type-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './drug-type-form.html',
  styleUrl: './drug-type-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrugTypeFormDialog {
  private readonly drugTypes = inject(DrugTypesService);
  private readonly dialogRef =
    inject<MatDialogRef<DrugTypeFormDialog, DrugTypeFormResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<DrugTypeFormData>(MAT_DIALOG_DATA);

  /** Longitud máxima expuesta al template (`maxlength` del input). */
  protected readonly maxLength = DESCRIPTION_MAX_LENGTH;

  /** `true` en edición: sin control de `is_active` y con `description` precargada. */
  protected readonly isEdit = this.data.mode === 'edit';

  /** Precarga del registro en edición (`GET /{id}`). */
  readonly loadingDrugType = signal(this.isEdit);

  /** Envío en curso: deshabilita campos y botón, `aria-busy` y etiqueta. */
  readonly submitting = signal(false);

  /** Error general ya traducido para la región `role="alert"`. */
  readonly error = signal<string | null>(null);

  /** Errores 409/422 por campo ya traducidos (fuente del validador `server`). */
  readonly fieldErrors = signal<DrugTypesFieldErrors>({});

  /** `is_active` del registro en edición (no editable aquí; viaja en el `PUT`). */
  private loadedIsActive = true;

  readonly form = new FormGroup({
    description: new FormControl('', {
      nonNullable: true,
      validators: [
        requiredTrimmed,
        Validators.maxLength(DESCRIPTION_MAX_LENGTH),
        this.serverError('description'),
      ],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    if (this.data.mode === 'edit') {
      // En edición el estado se cambia desde el listado: el control no se
      // renderiza y su valor viaja tomado del registro precargado.
      this.form.controls.isActive.disable();
      this.loadDrugType(this.data.drugTypeId);
    }
  }

  onSubmit(): void {
    this.fieldErrors.set({});
    this.refreshServerValidity();
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting() || this.loadingDrugType()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const request =
      this.data.mode === 'create'
        ? this.drugTypes.create({ description: raw.description, isActive: raw.isActive })
        : this.drugTypes.update(this.data.drugTypeId, {
            description: raw.description,
            isActive: this.loadedIsActive,
          });

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialogRef.close('saved');
      },
      error: (error: unknown) => {
        const mapped = mapDrugTypesError(error);
        this.fieldErrors.set(mapped.fieldErrors ?? {});
        this.refreshServerValidity();
        this.error.set(mapped.message);
        this.submitting.set(false);
      },
    });
  }

  /** Precarga del diálogo de edición con `GET /{id}`. */
  private loadDrugType(drugTypeId: number): void {
    this.drugTypes
      .getById(drugTypeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (drugType) => {
          this.loadedIsActive = drugType.isActive;
          this.form.controls.description.setValue(drugType.description);
          this.loadingDrugType.set(false);
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
  private serverError(field: keyof DrugTypesFieldErrors): ValidatorFn {
    return () => (this.fieldErrors()[field] ? { server: true } : null);
  }
}
