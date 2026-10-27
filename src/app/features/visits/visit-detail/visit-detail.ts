/**
 * Detalle de una visita (F-015, S9/S16): página lazy `/visits/:id`.
 *
 * - Encabezado con paciente (nombre y cédula enmascarada), médico, fecha/hora
 *   siempre en `America/Santo_Domingo` (S10) y badge de estado. `created_by`
 *   sigue en el modelo pero **no se renderiza**: el humano retiró «Registrado
 *   por» el 2026-10-27.
 * - Síntomas y recomendaciones completos (nada truncado como en la tabla).
 * - Tabla de medicamentos entregados (`description`, `dose`, `quantity`,
 *   `instructions`).
 * - Si la visita está anulada, bloque con `annulment_reason`, `annulled_at` y
 *   `annulled_by` (S9): es el único lugar donde se consulta la auditoría.
 * - Un `404` (visita ajena para un MEDICO) muestra el estado «no encontrada»
 *   con vuelta al listado; un fallo de carga se anuncia inline con reintento.
 * - `VisitRead` no publica esquema (S16): todos los campos opcionales se
 *   muestran con respaldo y su ausencia no rompe la vista.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { formatCedula } from '../../patients/patients.models';
import { mapVisitsError } from '../visits-error';
import { Visit, formatVisitDateTime, visitStatusLabel } from '../visits.models';
import { VisitsService } from '../visits.service';

@Component({
  selector: 'dm-visit-detail',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './visit-detail.html',
  styleUrl: './visit-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitDetail implements OnInit {
  private readonly visits = inject(VisitsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** Cédula con máscara (misma regla de F-013). */
  protected readonly maskCedula = formatCedula;

  /** Fecha y hora siempre en `America/Santo_Domingo` (S10). */
  protected readonly formatVisitDateTime = formatVisitDateTime;

  /** Etiqueta del estado (Registrada / Anulada). */
  protected readonly statusLabel = visitStatusLabel;

  /** Identificador de la ruta (`/visits/:id`); `null` si no es numérico. */
  readonly visitId = toVisitId(this.route.snapshot.paramMap.get('id'));

  /** Detalle cargado. */
  readonly visit = signal<Visit | null>(null);

  /** Carga en curso: gobierna la región de contenido (`aria-busy`). */
  readonly loading = signal(true);

  /** Error de carga ya traducido, mostrado inline con reintento. */
  readonly errorMessage = signal<string | null>(null);

  /** `true` cuando el servidor responde `404` (visita inexistente o ajena). */
  readonly notFound = signal(false);

  ngOnInit(): void {
    if (this.visitId === null) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }
    this.load();
  }

  /** Reintento del fallo de carga con el mismo id. */
  retry(): void {
    this.load();
  }

  private load(): void {
    const id = this.visitId;
    if (id === null) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.notFound.set(false);

    this.visits
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (visit) => {
          this.visit.set(visit);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          const mapped = mapVisitsError(error);
          if (isNotFound(error)) {
            this.notFound.set(true);
            this.visit.set(null);
            return;
          }
          this.errorMessage.set(mapped.message);
        },
      });
  }
}

/** `id` numérico de la ruta o `null` cuando el parámetro no es válido. */
function toVisitId(raw: string | null): number | null {
  const value = Number(raw);

  return raw !== null && raw.trim().length > 0 && Number.isInteger(value) && value > 0
    ? value
    : null;
}

/** El 404 se resuelve con el estado «no encontrada», no con un error inline. */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 404
  );
}
