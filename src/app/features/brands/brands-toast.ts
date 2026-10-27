/**
 * Avisos toast de marcas (F-010): `BrandsToast` centraliza
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
 *   (`BrandList`).
 */

import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Duración del toast de éxito (PA-02: 2000 ms). */
const SUCCESS_DURATION_MS = 2000;

/** Duración del toast de error (PA-02: 5000 ms con acción «Cerrar»). */
const ERROR_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class BrandsToast {
  private readonly snackBar = inject(MatSnackBar);

  /** «Marca creada.» tras `POST` → `201`. */
  showCreated(): void {
    this.showSuccess('Marca creada.');
  }

  /** «Marca actualizada.» tras `PUT` → `200`. */
  showUpdated(): void {
    this.showSuccess('Marca actualizada.');
  }

  /** «Marca activada.» tras reactivar. */
  showActivated(): void {
    this.showSuccess('Marca activada.');
  }

  /** «Marca desactivada.» tras `DELETE` (desactivación lógica). */
  showDeactivated(): void {
    this.showSuccess('Marca desactivada.');
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
