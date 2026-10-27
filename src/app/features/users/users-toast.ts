/**
 * Avisos toast de usuarios (F-007): `UsersToast` centraliza `MatSnackBar` y
 * los literales de éxito del listado (así `user-list/` no conserva restos
 * inline de esos mensajes, CA-05).
 *
 * - Éxito (`role="status"` vía `politeness: 'polite'`): 2000 ms, sin acción,
 *   posición `bottom-center` (por defecto de Material; evita la colisión del
 *   `top-left` literal con el sidenav persistente de 240 px y la topbar navy
 *   en ≥1280 px, ver PA-01 en `docs/USERS.md`).
 * - Error (`role="alert"` vía `politeness: 'assertive'`): 5000 ms con acción
 *   «Cerrar» (PA-02: los errores necesitan tiempo de lectura y cierre manual).
 * - No roba el foco: el snackbar solo anuncia por el `LiveAnnouncer` interno.
 * - Un solo contenedor (PA-04): cada toast reemplaza al anterior; `MatSnackBar`
 *   se importa una sola vez en el ámbito de users (`UserList`).
 */

import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Duración del toast de éxito (PA-02: 2000 ms). */
const SUCCESS_DURATION_MS = 2000;

/** Duración del toast de error (PA-02: 5000 ms con acción «Cerrar»). */
const ERROR_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class UsersToast {
  private readonly snackBar = inject(MatSnackBar);

  /** «Usuario creado.» tras `POST` → `201` (listado). */
  showUserCreated(): void {
    this.showSuccess('Usuario creado.');
  }

  /** «Usuario actualizado.» tras `PUT` → `200` (listado). */
  showUserUpdated(): void {
    this.showSuccess('Usuario actualizado.');
  }

  /** «Usuario activado.» tras reactivar (listado). */
  showUserActivated(): void {
    this.showSuccess('Usuario activado.');
  }

  /** «Usuario desactivado.» tras `DELETE` (listado). */
  showUserDeactivated(): void {
    this.showSuccess('Usuario desactivado.');
  }

  /** Éxito genérico: anuncio `polite` (`role="status"`), 2000 ms, sin acción. */
  showSuccess(message: string): void {
    this.snackBar.open(message, undefined, {
      duration: SUCCESS_DURATION_MS,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      politeness: 'polite',
    });
  }

  /** Error genérico: anuncio `assertive` (`role="alert"`), 5000 ms, «Cerrar». */
  showError(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: ERROR_DURATION_MS,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      politeness: 'assertive',
    });
  }
}
