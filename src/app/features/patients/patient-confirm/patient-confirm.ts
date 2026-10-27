/**
 * Confirmación de activar/desactivar paciente (F-013, S7).
 *
 * Diálogo dedicado `dm-patient-confirm`: botón destructivo solo para
 * desactivar. Desactivar emite `DELETE /{id}` = `is_active: false`, lógico e
 * idempotente (sin borrado físico ni de sus referencias); reactivar reenvía el
 * paciente con `is_active: true` en el `PUT` de reemplazo completo. Devuelve
 * `true` al confirmar y `undefined` al cancelar o cerrar con Escape
 * (comportamiento por defecto de `MatDialog`).
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { formatCedula } from '../patients.models';

/** Datos de entrada: qué paciente se afecta y en qué sentido. */
export interface PatientConfirmData {
  /** Nombre visible del paciente. */
  name: string;
  /** Cédula sin máscara (se muestra con `formatCedula()`). */
  cedula: string;
  /** `true` = activar; `false` = desactivar. */
  activate: boolean;
}

@Component({
  selector: 'dm-patient-confirm',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './patient-confirm.html',
  styleUrl: './patient-confirm.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientConfirmDialog {
  protected readonly data = inject<PatientConfirmData>(MAT_DIALOG_DATA);

  /** Cédula del paciente con la máscara `XXX-XXXXXXX-X` (S3). */
  protected readonly cedulaLabel = formatCedula(this.data.cedula);
}
