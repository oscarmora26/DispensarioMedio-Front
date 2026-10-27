import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

const SUCCESS_DURATION_MS = 2000;
const ERROR_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class MedicationsToast {
  private readonly snackBar = inject(MatSnackBar);

  showCreated(): void {
    this.showSuccess('Medicamento creado.');
  }
  showUpdated(): void {
    this.showSuccess('Medicamento actualizado.');
  }
  showActivated(): void {
    this.showSuccess('Medicamento activado.');
  }
  showDeactivated(): void {
    this.showSuccess('Medicamento desactivado.');
  }

  showSuccess(message: string): void {
    this.snackBar.open(message, undefined, {
      duration: SUCCESS_DURATION_MS,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      politeness: 'polite',
    });
  }

  showError(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: ERROR_DURATION_MS,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      politeness: 'assertive',
    });
  }
}
