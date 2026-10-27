/**
 * Confirmación de activar/desactivar tipo de fármaco (F-009, S4).
 *
 * Diálogo dedicado `dm-drug-type-confirm`: botón destructivo solo para
 * desactivar. Desactivar emite `DELETE /{id}` = `is_active: false` (sin
 * borrado físico); reactivar reenvía el registro con `is_active: true` en el
 * `PUT` de reemplazo completo. Devuelve `true` al confirmar y `undefined` al
 * cancelar o cerrar con Escape (comportamiento por defecto de `MatDialog`).
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

/** Datos de entrada: qué registro se afecta y en qué sentido. */
export interface DrugTypeConfirmData {
  /** Descripción visible del tipo de fármaco. */
  description: string;
  /** `true` = activar; `false` = desactivar. */
  activate: boolean;
}

@Component({
  selector: 'dm-drug-type-confirm',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './drug-type-confirm.html',
  styleUrl: './drug-type-confirm.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrugTypeConfirmDialog {
  protected readonly data = inject<DrugTypeConfirmData>(MAT_DIALOG_DATA);
}
