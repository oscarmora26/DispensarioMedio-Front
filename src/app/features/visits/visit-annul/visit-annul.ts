/**
 * Diálogo de anulación de visita (F-015, S7/S9/S12): `dm-visit-annul`.
 *
 * - El motivo es obligatorio (≤500, contrato) y se recorta antes de enviarlo:
 *   `POST /v1/visits/{id}/annul` con `{ reason }`.
 * - La anulación ocurre **una sola vez**: `409 visit_already_annulled` se
 *   traduce a un mensaje propio y el diálogo cierra con
 *   `{ alreadyAnnulled: true }` para que el listado avise y recargue.
 * - `404`/`403`/`422` dejan el diálogo abierto con el mensaje del sistema, sin
 *   exponer `detail` ni mensajes crudos del backend.
 * - Cancelar/Escape/backdrop cierran sin efectos.
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
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { mapVisitsError } from '../visits-error';
import { ANNULMENT_REASON_MAX_LENGTH, formatVisitDateTime } from '../visits.models';
import { VisitsService } from '../visits.service';

/** Datos con los que el listado abre la confirmación de anulación. */
export interface VisitAnnulData {
  visitId: number;
  patientName: string;
  /** Fecha de la visita tal como la devolvió el servidor. */
  visitedAt: string;
}

/** `annulled` tras `200`; `{ alreadyAnnulled: true }` ante el `409`. */
export type VisitAnnulResult = 'annulled' | { alreadyAnnulled: true };

/** `required` sobre el valor recortado: un motivo de espacios no es válido. */
const requiredTrimmed: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true };

@Component({
  selector: 'dm-visit-annul',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './visit-annul.html',
  styleUrl: './visit-annul.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitAnnulDialog {
  private readonly visits = inject(VisitsService);
  private readonly dialogRef =
    inject<MatDialogRef<VisitAnnulDialog, VisitAnnulResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<VisitAnnulData>(MAT_DIALOG_DATA);

  /** Longitud máxima del motivo (≤500, contrato). */
  protected readonly reasonMaxLength = ANNULMENT_REASON_MAX_LENGTH;

  /** Fecha de la visita en hora de Santo Domingo (S10). */
  protected readonly formatVisitedAt = formatVisitDateTime;

  /** Envío en curso: deshabilita campos y botón. */
  readonly submitting = signal(false);

  /** Error general ya traducido para la región `role="alert"`. */
  readonly error = signal<string | null>(null);

  /** Motivo obligatorio y acotado a 500 caracteres. */
  readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [requiredTrimmed, Validators.maxLength(ANNULMENT_REASON_MAX_LENGTH)],
  });

  readonly form = new FormGroup({ reason: this.reason });

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.visits
      .annul(this.data.visitId, this.reason.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.dialogRef.close('annulled'),
        error: (error: unknown) => {
          const mapped = mapVisitsError(error);
          if (mapped.code === 'visit_already_annulled') {
            this.dialogRef.close({ alreadyAnnulled: true });
            return;
          }
          this.error.set(mapped.message);
          this.submitting.set(false);
        },
      });
  }
}
