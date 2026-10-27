/**
 * Confirmación de activar/desactivar estante (F-011, S4).
 *
 * Diálogo dedicado `dm-location-confirm`: botón destructivo solo para
 * desactivar. Desactivar emite `DELETE /v1/shelves/{id}`; reactivar reenvía el
 * estante con `is_active: true` en el `PUT` de reemplazo (sin `cells`). La
 * semántica lógica/física del `DELETE` no está verificada, así que el texto es
 * neutro: solo dice que la ubicación deja de estar disponible para asignar
 * medicamentos (no afirma nada sobre borrado ni conservación de datos).
 * Devuelve `true` al confirmar y `undefined` al cancelar o cerrar con Escape
 * (comportamiento por defecto de `MatDialog`).
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

/** Datos de entrada: qué estante se afecta y en qué sentido. */
export interface LocationConfirmData {
  /** Nombre visible del estante. */
  name: string;
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
