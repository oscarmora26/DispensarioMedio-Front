/**
 * Avisos toast de ubicaciones (F-011): `LocationsToast` centraliza
 * `MatSnackBar` y los literales de éxito del catálogo (mismo patrón que
 * `UsersToast`, F-007).
 *
 * - Éxito (`role="status"` vía `politeness: 'polite'`): 2000 ms, sin acción,
 *   posición `bottom-center` (por defecto de Material; evita la colisión del
 *   `top-left` con el sidenav persistente y la topbar navy, PA-01).
 * - Error (`role="alert"` vía `politeness: 'assertive'`): 5000 ms con acción
 *   «Cerrar» (PA-02: los errores necesitan tiempo de lectura y cierre manual).
 * - No roba el foco: el snackbar solo anuncia por el `LiveAnnouncer` interno.
 * - Un solo contenedor (PA-04): cada toast reemplaza al anterior;
 *   `MatSnackBar` se importa una sola vez en el ámbito del catálogo
 *   (`LocationList`).
 */

import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Duración del toast de éxito (PA-02: 2000 ms). */
const SUCCESS_DURATION_MS = 2000;

/** Duración del toast de error (PA-02: 5000 ms con acción «Cerrar»). */
const ERROR_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class LocationsToast {
  private readonly snackBar = inject(MatSnackBar);

  /** «Estante creado.» tras `POST /v1/shelves` → `201`. */
  showCreated(): void {
    this.showSuccess('Estante creado.');
  }

  /** «Estante actualizado.» tras `PUT /v1/shelves/{id}` → `200`. */
  showUpdated(): void {
    this.showSuccess('Estante actualizado.');
  }

  /** «Estante activado.» tras reactivar. */
  showActivated(): void {
    this.showSuccess('Estante activado.');
  }

  /** «Estante desactivado.» tras `DELETE /v1/shelves/{id}`. */
  showDeactivated(): void {
    this.showSuccess('Estante desactivado.');
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
