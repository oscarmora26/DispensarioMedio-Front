/**
 * Confirmación de activar/desactivar usuario (F-006).
 *
 * Diálogo dedicado `dm-user-confirm`: botón destructivo solo para desactivar
 * (`DELETE` = desactivar vía `is_active`; sin borrado físico, RF-17). La
 * reactivación reenvía el usuario con `is_active: true` en el `PUT` de
 * reemplazo completo (R-04 resuelto por OpenAPI).
 * Devuelve `true` al confirmar y `undefined` al cancelar o cerrar con Escape
 * (Escape cierra sin guardar, por defecto de `MatDialog`).
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

/** Datos de entrada: a quién afecta, en qué sentido y contexto de riesgo. */
export interface UserConfirmData {
  /** Identificador visible del usuario (username). */
  username: string;
  /** `true` = activar; `false` = desactivar. */
  activate: boolean;
  /**
   * `true` cuando el objetivo es el único administrador activo entre los
   * usuarios cargados (heurística visible; el backend es la barrera real que
   * impide dejar el sistema sin administradores, §7).
   */
  isLastVisibleAdmin: boolean;
}

@Component({
  selector: 'dm-user-confirm',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './user-confirm.html',
  styleUrl: './user-confirm.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserConfirmDialog {
  protected readonly data = inject<UserConfirmData>(MAT_DIALOG_DATA);
}
