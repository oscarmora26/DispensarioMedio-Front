/**
 * Avisos toast de pacientes (F-013, S9): `PatientsToast` centraliza
 * `MatSnackBar` y los literales de éxito del catálogo (mismo patrón que
 * `DrugTypesToast`, F-009).
 *
 * - Éxito (`role="status"` vía `politeness: 'polite'`): 2000 ms, sin acción,
 *   posición `bottom-center` (evita la colisión del `top-left` con el sidenav
 *   persistente y la topbar navy, PA-01).
 * - Error (`role="alert"` vía `politeness: 'assertive'`): 5000 ms con acción
 *   «Cerrar» (PA-02: los errores necesitan tiempo de lectura y cierre manual).
 * - No roba el foco: el snackbar solo anuncia por el `LiveAnnouncer` interno.
 * - Un solo contenedor (PA-04): cada toast reemplaza al anterior;
 *   `MatSnackBar` se importa una sola vez en el ámbito del catálogo
 *   (`PatientList`).
 */

import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Duración del toast de éxito (PA-02: 2000 ms). */
const SUCCESS_DURATION_MS = 2000;

/** Duración del toast de error (PA-02: 5000 ms con acción «Cerrar»). */
const ERROR_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class PatientsToast {
  private readonly snackBar = inject(MatSnackBar);

  /** «Paciente creado.» tras `POST` → `201`. */
  showCreated(): void {
    this.showSuccess('Paciente creado.');
  }

  /** «Paciente actualizado.» tras `PUT` → `200`. */
  showUpdated(): void {
    this.showSuccess('Paciente actualizado.');
  }

  /** «Paciente activado.» tras reactivar. */
  showActivated(): void {
    this.showSuccess('Paciente activado.');
  }

  /** «Paciente desactivado.» tras `DELETE` (desactivación lógica). */
  showDeactivated(): void {
    this.showSuccess('Paciente desactivado.');
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
