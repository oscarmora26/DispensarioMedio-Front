/**
 * Avisos toast de visitas (F-015, S13): `VisitsToast` centraliza
 * `MatSnackBar` y los literales de éxito del módulo (mismo patrón que
 * `PatientsToast`/`DoctorsToast`).
 *
 * - Éxito (`role="status"` vía `politeness: 'polite'`): 2000 ms, sin acción,
 *   posición `bottom-center`.
 * - Error (`role="alert"` vía `politeness: 'assertive'`): 5000 ms con acción
 *   «Cerrar».
 * - No roba el foco: el snackbar solo anuncia por el `LiveAnnouncer` interno.
 * - Un solo contenedor: cada toast reemplaza al anterior; `MatSnackBarModule`
 *   se importa una sola vez en el ámbito del módulo (`VisitList` y
 *   `VisitDetail`).
 */

import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Duración del toast de éxito (2000 ms). */
const SUCCESS_DURATION_MS = 2000;

/** Duración del toast de error (5000 ms con acción «Cerrar»). */
const ERROR_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class VisitsToast {
  private readonly snackBar = inject(MatSnackBar);

  /** «Visita registrada.» tras `POST` → `201`. */
  showCreated(): void {
    this.showSuccess('Visita registrada.');
  }

  /** «Visita actualizada.» tras `PUT` → `200`. */
  showUpdated(): void {
    this.showSuccess('Visita actualizada.');
  }

  /** «Visita anulada.» tras `POST /{id}/annul` → `200`. */
  showAnnulled(): void {
    this.showSuccess('Visita anulada.');
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
