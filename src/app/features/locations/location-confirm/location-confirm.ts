/**
 * Confirmación de activar/desactivar ubicación (F-011, S4).
 *
 * Diálogo dedicado `dm-location-confirm`: botón destructivo solo para
 * desactivar. Desactivar emite `DELETE /{id}` = `is_active: false` (sin
 * borrado físico); reactivar reenvía el registro con `is_active: true` en el
 * `PUT` de reemplazo completo. Devuelve `true` al confirmar y `undefined` al
 * cancelar o cerrar con Escape (comportamiento por defecto de `MatDialog`).
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

/** Datos de entrada: qué registro se afecta y en qué sentido. */
export interface LocationConfirmData {
  /** Descripción visible del ubicación. */
  description: string;
  /** `true` = activar; `false` = desactivar. */
  activate: boolean;
}

@Component({
  selector: 'dm-location-confirm',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './location-confirm.html',
  styleUrl: './location-confirm.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationConfirmDialog {
  protected readonly data = inject<LocationConfirmData>(MAT_DIALOG_DATA);
}
