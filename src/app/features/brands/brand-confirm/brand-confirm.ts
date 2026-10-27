/**
 * Confirmación de activar/desactivar marca (F-010, S4).
 *
 * Diálogo dedicado `dm-brand-confirm`: botón destructivo solo para
 * desactivar. Desactivar emite `DELETE /{id}` = `is_active: false` (sin
 * borrado físico); reactivar reenvía el registro con `is_active: true` en el
 * `PUT` de reemplazo completo. Devuelve `true` al confirmar y `undefined` al
 * cancelar o cerrar con Escape (comportamiento por defecto de `MatDialog`).
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

/** Datos de entrada: qué registro se afecta y en qué sentido. */
export interface BrandConfirmData {
  /** Descripción visible del marca. */
  description: string;
  /** `true` = activar; `false` = desactivar. */
  activate: boolean;
}

@Component({
  selector: 'dm-brand-confirm',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './brand-confirm.html',
  styleUrl: './brand-confirm.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandConfirmDialog {
  protected readonly data = inject<BrandConfirmData>(MAT_DIALOG_DATA);
}
