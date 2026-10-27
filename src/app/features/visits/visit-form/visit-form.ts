/**
 * Registrar/editar visita (F-015, S3-S6/S10/S12): diálogo `dm-visit-form`.
 *
 * - Formulario reactivo tipado. Crear: `patient_id` obligatorio (paciente
 *   activo, elegido con búsqueda de servidor), `visited_at` obligatoria y no
 *   futura, `symptoms` 3..2000, `recommendations` ≤2000 y `medications[]`
 *   opcional sin duplicados. **El médico no se elige**: sale del token del
 *   usuario que registra y `doctor_id` no viaja en el body (S3/S11).
 * - Selectores (S5): buscadores `mat-autocomplete` de servidor para paciente
 *   (`GET /v1/patients?search=&is_active=true&size=20`) y medicamento
 *   (`GET /v1/medications?search=&is_active=true&size=20`). Al enfocar o hacer
 *   clic se abre el panel con la primera página de activos y al escribir se
 *   filtra en el servidor con 300 ms de espera. Nunca se asume que el catálogo
 *   cabe en una página.
 * - Medicamentos (S4): cada fila tiene medicamento obligatorio, cantidad
 *   opcional (>0, numérica o texto) e indicaciones opcionales ≤255. La misma
 *   fila no se puede repetir (`duplicate`) y la lista enviada **sustituye** a
 *   la anterior en el `PUT`.
 * - Editar (S6): precarga con `GET /visits/{id}` y emite el `PUT` de
 *   reemplazo completo. Cancelar/Escape/backdrop solo cierran; un `404` al
 *   precargar cierra con `{ notFound: true }` para que la lista avise y un
 *   `409 visit_annulled` al guardar cierra con `{ annulled: true }` (S8).
 * - Fechas (S10): la fecha se elige en un calendario Material y la hora y el
 *   minuto en dos `mat-select` (`00`-`23` y `00`-`59`); el reloj de pared se
 *   compone con `combineVisitDateTime()` y se envía como `AAAA-MM-DDTHH:mm:ss`
 *   sin zona (el backend asume UTC-4).
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Patient, formatCedula } from '../../patients/patients.models';
import { PatientsService } from '../../patients/patients.service';
import { MedicationsService } from '../../medications/medications.service';
import { mapVisitsError, VisitsFieldErrors } from '../visits-error';
import {
  CATALOG_SEARCH_SIZE,
  INSTRUCTIONS_MAX_LENGTH,
  QUANTITY_MAX_LENGTH,
  RECOMMENDATIONS_MAX_LENGTH,
  SEARCH_DEBOUNCE_MS,
  SYMPTOMS_MAX_LENGTH,
  SYMPTOMS_MIN_LENGTH,
  VISIT_HOUR_OPTIONS,
  VISIT_MINUTE_OPTIONS,
  VisitFormInput,
  combineVisitDateTime,
  isFutureVisitDateTime,
  toVisitDateTimeParts,
} from '../visits.models';
import { VisitsService } from '../visits.service';

/** Abrir en modo creación (sin precarga). */
export interface VisitFormCreateData {
  mode: 'create';
}

/** Abrir en modo edición (precarga con `GET /visits/{id}`). */
export interface VisitFormEditData {
  mode: 'edit';
  visitId: number;
}

export type VisitFormData = VisitFormCreateData | VisitFormEditData;

/**
 * `saved` tras `201`/`200`; `{ notFound: true }` si el `GET /{id}` dio 404;
 * `{ annulled: true }` si el `PUT` respondió `409 visit_annulled`.
 */
export type VisitFormResult = 'saved' | { notFound: true } | { annulled: true };

/** Opción del autocompletar de medicamentos. */
export interface MedicationPickerOption {
  id: number;
  label: string;
}

/** Controles de una fila de medicamento (dentro del `FormArray`). */
export type VisitMedicationRowForm = FormGroup<{
  medicationId: FormControl<number | null>;
  quantity: FormControl<string>;
  instructions: FormControl<string>;
}>;

/** Fila de medicamento: controles, texto del buscador y resultados vigentes. */
export interface VisitMedicationRow {
  readonly form: VisitMedicationRowForm;
  readonly search: FormControl<string>;
  readonly options: WritableSignal<MedicationPickerOption[]>;
}

/** `required` sobre el valor recortado (una cadena de espacios no es válida). */
const requiredTrimmed: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true };

/**
 * La fecha de la visita (calendario + hora + minuto) no puede estar en el
 * futuro, con un minuto de tolerancia (S10). El error vive en el grupo porque
 * la regla depende de las tres piezas combinadas.
 */
const notFutureVisit: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as {
    visitedDate?: Date | null;
    visitedHour?: string;
    visitedMinute?: string;
  } | null;

  return isFutureVisitDateTime(
    combineVisitDateTime(
      value?.visitedDate ?? null,
      value?.visitedHour ?? '',
      value?.visitedMinute ?? '',
    ),
  )
    ? { future: true }
    : null;
};

/** Sin medicamentos repetidos dentro de la misma visita (S4). */
const uniqueMedications: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const rows: unknown = control.value;
  if (!Array.isArray(rows)) {
    return null;
  }

  const seen = new Set<number>();
  for (const row of rows) {
    const id = (row as { medicationId?: unknown } | null)?.medicationId;
    if (typeof id !== 'number') {
      continue;
    }
    if (seen.has(id)) {
      return { duplicate: true };
    }
    seen.add(id);
  }
  return null;
};

@Component({
  selector: 'dm-visit-form',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './visit-form.html',
  styleUrl: './visit-form.scss',
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitFormDialog {
  private readonly visits = inject(VisitsService);
  private readonly patients = inject(PatientsService);
  private readonly medicationsCatalog = inject(MedicationsService);
  private readonly dialogRef = inject<MatDialogRef<VisitFormDialog, VisitFormResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<VisitFormData>(MAT_DIALOG_DATA);

  /** `true` en edición: precarga y `PUT` de reemplazo completo. */
  protected readonly isEdit = this.data.mode === 'edit';

  /** Límites del contrato expuestos al template (`maxlength`). */
  protected readonly symptomsMinLength = SYMPTOMS_MIN_LENGTH;
  protected readonly symptomsMaxLength = SYMPTOMS_MAX_LENGTH;
  protected readonly recommendationsMaxLength = RECOMMENDATIONS_MAX_LENGTH;
  protected readonly instructionsMaxLength = INSTRUCTIONS_MAX_LENGTH;
  protected readonly quantityMaxLength = QUANTITY_MAX_LENGTH;

  /** Opciones de los selects de hora (`00`-`23`) y minuto (`00`-`59`). */
  readonly hourOptions = VISIT_HOUR_OPTIONS;
  readonly minuteOptions = VISIT_MINUTE_OPTIONS;

  /** Cédula con máscara en las opciones del autocompletar. */
  protected readonly maskCedula = formatCedula;

  /** Filas de medicamentos y su `FormArray` (validado como conjunto). */
  readonly medications = new FormArray<VisitMedicationRowForm>([], uniqueMedications);

  /** Vista de las filas para el template (controles + resultados). */
  readonly rows = signal<VisitMedicationRow[]>([]);

  /** Texto del autocompletar de paciente (búsqueda de servidor, S5). */
  readonly patientSearch = new FormControl('', { nonNullable: true });

  /** Resultados vigentes del buscador de paciente. */
  readonly patientOptions = signal<Patient[]>([]);

  /** Precarga del registro en edición (`GET /visits/{id}`). */
  readonly loadingVisit = signal(this.isEdit);

  /** Envío en curso: deshabilita campos y botón, `aria-busy` y etiqueta. */
  readonly submitting = signal(false);

  /** Error general ya traducido para la región `role="alert"`. */
  readonly error = signal<string | null>(null);

  /** Errores 422 por campo ya traducidos. */
  readonly fieldErrors = signal<VisitsFieldErrors>({});

  readonly form = new FormGroup(
    {
      patientId: new FormControl<number | null>(null, { validators: [Validators.required] }),
      visitedDate: new FormControl<Date | null>(null, { validators: [Validators.required] }),
      visitedHour: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      visitedMinute: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      symptoms: new FormControl('', {
        nonNullable: true,
        validators: [
          requiredTrimmed,
          Validators.minLength(SYMPTOMS_MIN_LENGTH),
          Validators.maxLength(SYMPTOMS_MAX_LENGTH),
        ],
      }),
      recommendations: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(RECOMMENDATIONS_MAX_LENGTH)],
      }),
      medications: this.medications,
    },
    { validators: [notFutureVisit] },
  );

  constructor() {
    this.patientSearch.valueChanges
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((text) => this.onPatientSearchText(text));

    if (this.data.mode === 'edit') {
      this.loadVisit(this.data.visitId);
    }
  }

  /** Errores de campo ya traducidos, en orden de declaración. */
  protected fieldErrorMessages(): string[] {
    return Object.values(this.fieldErrors()).filter(
      (message): message is string => typeof message === 'string',
    );
  }

  /**
   * `patientId` no está montado en un control visible (el input es el buscador
   * del autocompletar), así que su error se anuncia junto al campo cuando el
   * envío ya lo marcó como tocado.
   */
  protected patientError(): boolean {
    const control = this.form.controls.patientId;

    return control.invalid && control.touched;
  }

  /**
   * Apertura del panel de paciente (foco o clic): sin opciones se pide la
   * primera página de activos, así el buscador también es un select inmediato
   * (S5).
   */
  onPatientPanelOpened(): void {
    if (this.patientOptions().length === 0) {
      this.searchPatients(this.patientSearch.value);
    }
  }

  /** Aplica el paciente elegido en el buscador (S5). */
  onPatientSelected(patient: Patient): void {
    this.form.controls.patientId.setValue(patient.id);
    this.patientSearch.setValue(patientLabel(patient), { emitEvent: false });
  }

  /** Agrega una fila de medicamento y devuelve sus controles (S4). */
  addMedication(): VisitMedicationRow {
    const form: VisitMedicationRowForm = new FormGroup({
      medicationId: new FormControl<number | null>(null),
      quantity: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(QUANTITY_MAX_LENGTH)],
      }),
      instructions: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(INSTRUCTIONS_MAX_LENGTH)],
      }),
    });
    const row: VisitMedicationRow = {
      form,
      search: new FormControl('', { nonNullable: true }),
      options: signal<MedicationPickerOption[]>([]),
    };

    this.medications.push(form);
    this.rows.update((rows) => [...rows, row]);
    row.search.valueChanges
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((text) => this.onMedicationSearchText(row, text));

    return row;
  }

  /** Quita una fila de medicamento del `FormArray` y de la vista. */
  removeMedication(index: number): void {
    if (index < 0 || index >= this.rows().length) {
      return;
    }
    this.medications.removeAt(index);
    this.rows.update((rows) => rows.filter((_, position) => position !== index));
  }

  /** Aplica el medicamento elegido en una fila. */
  onMedicationSelected(row: VisitMedicationRow, option: MedicationPickerOption): void {
    row.form.controls.medicationId.setValue(option.id);
    row.search.setValue(option.label, { emitEvent: false });
  }

  /**
   * Apertura del panel de medicamento de una fila: sin opciones se pide la
   * primera página de activos (S5).
   */
  onMedicationPanelOpened(row: VisitMedicationRow): void {
    if (row.options().length === 0) {
      this.searchMedications(row, row.search.value);
    }
  }

  onSubmit(): void {
    this.fieldErrors.set({});
    this.form.markAllAsTouched();
    this.form.controls.patientId.markAsTouched();
    if (this.form.invalid || this.submitting() || this.loadingVisit()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const input: VisitFormInput = {
      patientId: raw.patientId,
      visitedAt: combineVisitDateTime(raw.visitedDate, raw.visitedHour, raw.visitedMinute),
      symptoms: raw.symptoms,
      recommendations: raw.recommendations,
      medications: this.rows().map((row) => ({
        medicationId: row.form.controls.medicationId.value,
        quantity: row.form.controls.quantity.value,
        instructions: row.form.controls.instructions.value,
      })),
    };

    const request =
      this.data.mode === 'create'
        ? this.visits.create(input)
        : this.visits.update(this.data.visitId, input);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.dialogRef.close('saved'),
      error: (error: unknown) => {
        const mapped = mapVisitsError(error);
        if (mapped.code === 'visit_annulled') {
          this.dialogRef.close({ annulled: true });
          return;
        }
        this.fieldErrors.set(mapped.fieldErrors ?? {});
        this.error.set(mapped.message);
        this.submitting.set(false);
      },
    });
  }

  /** Precarga del diálogo de edición con `GET /visits/{id}` (S6). */
  private loadVisit(visitId: number): void {
    this.visits
      .getById(visitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (visit) => {
          const visitedAt = toVisitDateTimeParts(visit.visitedAt);
          this.form.patchValue({
            patientId: visit.patient.id > 0 ? visit.patient.id : null,
            visitedDate: visitedAt.date,
            visitedHour: visitedAt.hour,
            visitedMinute: visitedAt.minute,
            symptoms: visit.symptoms,
            recommendations: visit.recommendations ?? '',
          });
          this.patientSearch.setValue(
            `${visit.patient.name} — ${formatCedula(visit.patient.cedula)}`,
            { emitEvent: false },
          );
          for (const medication of visit.medications) {
            const row = this.addMedication();
            row.form.controls.medicationId.setValue(medication.medicationId);
            row.search.setValue(medication.description, { emitEvent: false });
            row.form.controls.quantity.setValue(
              medication.quantity === null ? '' : String(medication.quantity),
            );
            row.form.controls.instructions.setValue(medication.instructions ?? '');
          }
          this.loadingVisit.set(false);
        },
        // 404 u otro fallo: el listado informa; el diálogo no sirve vacío.
        error: () => this.dialogRef.close({ notFound: true }),
      });
  }

  /**
   * Texto del buscador de paciente: al borrarlo se suelta la selección (el
   * `required` vuelve a aplicar) y se pide la primera página de activos.
   */
  private onPatientSearchText(text: string): void {
    if (text.trim().length === 0 && this.form.controls.patientId.value !== null) {
      this.form.controls.patientId.setValue(null);
      this.form.controls.patientId.markAsTouched();
    }
    this.searchPatients(text);
  }

  /** Texto del buscador de medicamento de una fila: borrarlo suelta la elección. */
  private onMedicationSearchText(row: VisitMedicationRow, text: string): void {
    if (text.trim().length === 0 && row.form.controls.medicationId.value !== null) {
      row.form.controls.medicationId.setValue(null);
    }
    this.searchMedications(row, text);
  }

  /** Búsqueda de servidor del buscador de paciente (S5). */
  private searchPatients(text: string): void {
    this.patients
      .list({ page: 1, size: CATALOG_SEARCH_SIZE, search: text.trim(), isActive: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.patientOptions.set(page.items),
        error: () => this.patientOptions.set([]),
      });
  }

  /** Búsqueda de servidor del buscador de medicamento de una fila (S5). */
  private searchMedications(row: VisitMedicationRow, text: string): void {
    this.medicationsCatalog
      .list({ page: 1, size: CATALOG_SEARCH_SIZE, search: text.trim(), isActive: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) =>
          row.options.set(
            page.items.map((medication) => ({ id: medication.id, label: medication.description })),
          ),
        error: () => row.options.set([]),
      });
  }
}

/** Texto visible de una opción de paciente. */
function patientLabel(patient: Patient): string {
  return `${patient.name} — ${formatCedula(patient.cedula)}`;
}
