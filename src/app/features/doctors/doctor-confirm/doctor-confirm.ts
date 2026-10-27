/**
 * Confirmación de activar/desactivar médico (F-014, S8).
 *
 * Diálogo dedicado `dm-doctor-confirm`: botón destructivo solo para
 * desactivar. Desactivar emite `DELETE /{id}` = `is_active: false`, lógico e
 * idempotente (sin borrado físico ni de sus referencias); el backend responde
 * `409 doctor_has_visits` si el médico tiene visitas registradas. Reactivar
 * reenvía el médico con `is_active: true` en el `PUT` de reemplazo completo.
 * Devuelve `true` al confirmar y `undefined` al cancelar o cerrar con Escape
 * (comportamiento por defecto de `MatDialog`).
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { formatCedula } from '../doctors.models';

/** Datos de entrada: qué médico se afecta y en qué sentido. */
export interface DoctorConfirmData {
  /** Nombre visible del médico. */
  name: string;
  /** Cédula sin máscara (se muestra con `formatCedula()`). */
  cedula: string;
  /** `true` = activar; `false` = desactivar. */
  activate: boolean;
}

@Component({
  selector: 'dm-doctor-confirm',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './doctor-confirm.html',
  styleUrl: './doctor-confirm.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorConfirmDialog {
  protected readonly data = inject<DoctorConfirmData>(MAT_DIALOG_DATA);

  /** Cédula del médico con la máscara `XXX-XXXXXXX-X` (S3). */
  protected readonly cedulaLabel = formatCedula(this.data.cedula);
}
