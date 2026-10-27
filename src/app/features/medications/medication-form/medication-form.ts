import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MedicationsFieldErrors, mapMedicationsError } from '../medications-error';
import { MedicationsService } from '../medications.service';
import { CatalogOption } from '../medications.models';
import { catchError, forkJoin, map, of } from 'rxjs';
import { DrugTypesService } from '../../drug-types/drug-types.service';
import { BrandsService } from '../../brands/brands.service';
import { LocationsService } from '../../locations/locations.service';
import { CellOption } from '../../locations/locations.models';

const TEXT_MAX_LENGTH = 100;

const requiredTrimmed: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true };

export interface MedicationFormCreateData {
  mode: 'create';
}
export interface MedicationFormEditData {
  mode: 'edit';
  medicationId: number;
}
export type MedicationFormData = MedicationFormCreateData | MedicationFormEditData;
export type MedicationFormResult = 'saved' | { notFound: true };

@Component({
  selector: 'dm-medication-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './medication-form.html',
  styleUrl: './medication-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicationFormDialog {
  private readonly medications = inject(MedicationsService);
  private readonly dialogRef =
    inject<MatDialogRef<MedicationFormDialog, MedicationFormResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<MedicationFormData>(MAT_DIALOG_DATA);

  protected readonly maxLength = TEXT_MAX_LENGTH;
  protected readonly isEdit = this.data.mode === 'edit';

  readonly loadingMedication = signal(this.isEdit);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<MedicationsFieldErrors>({});

  readonly drugTypeOptions = signal<CatalogOption[]>([]);
  readonly brandOptions = signal<CatalogOption[]>([]);
  readonly cellOptions = signal<CellOption[]>([]);

  private loadedIsActive = true;

  readonly form = new FormGroup({
    description: new FormControl('', {
      nonNullable: true,
      validators: [
        requiredTrimmed,
        Validators.maxLength(TEXT_MAX_LENGTH),
        this.serverError('description'),
      ],
    }),
    drugTypeId: new FormControl<number | null>(null, {
      validators: [Validators.required, this.serverError('drugTypeId')],
    }),
    brandId: new FormControl<number | null>(null, {
      validators: [Validators.required, this.serverError('brandId')],
    }),
    cellId: new FormControl<number | null>(null, {
      validators: [Validators.required, this.serverError('cellId')],
    }),
    dose: new FormControl('', {
      nonNullable: true,
      validators: [
        requiredTrimmed,
        Validators.maxLength(TEXT_MAX_LENGTH),
        this.serverError('dose'),
      ],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    const drugTypesService = inject(DrugTypesService);
    const brandsService = inject(BrandsService);
    const locationsService = inject(LocationsService);

    // Cada catálogo se aísla con `catchError`: si una fuente falla (por ejemplo
    // `/v1/shelves`), las otras dos conservan sus opciones y el formulario sigue
    // usable. Las celdas vienen de `listAllCells()` (`cells.id`).
    forkJoin({
      drugTypes: drugTypesService.list({ page: 1, size: 100 }).pipe(
        map((page) => page.items.map((item) => ({ id: item.id, label: item.description }))),
        catchError(() => of<CatalogOption[]>([])),
      ),
      brands: brandsService.list({ page: 1, size: 100 }).pipe(
        map((page) => page.items.map((item) => ({ id: item.id, label: item.description }))),
        catchError(() => of<CatalogOption[]>([])),
      ),
      cells: locationsService.listAllCells().pipe(catchError(() => of<CellOption[]>([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ drugTypes, brands, cells }) => {
        this.drugTypeOptions.set(drugTypes);
        this.brandOptions.set(brands);
        this.cellOptions.set(cells);
      });

    if (this.data.mode === 'edit') {
      this.form.controls.isActive.disable();
      this.loadMedication(this.data.medicationId);
    }
  }

  onSubmit(): void {
    this.fieldErrors.set({});
    this.refreshServerValidity();
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting() || this.loadingMedication()) return;

    this.submitting.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const request =
      this.data.mode === 'create'
        ? this.medications.create({
            description: raw.description,
            drugTypeId: raw.drugTypeId!,
            brandId: raw.brandId!,
            cellId: raw.cellId!,
            dose: raw.dose,
            isActive: raw.isActive,
          })
        : this.medications.update(this.data.medicationId, {
            description: raw.description,
            drugTypeId: raw.drugTypeId!,
            brandId: raw.brandId!,
            cellId: raw.cellId!,
            dose: raw.dose,
            isActive: this.loadedIsActive,
          });

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.dialogRef.close('saved'),
      error: (error: unknown) => {
        const mapped = mapMedicationsError(error);
        this.fieldErrors.set(mapped.fieldErrors ?? {});
        this.refreshServerValidity();
        this.error.set(mapped.message);
        this.submitting.set(false);
      },
    });
  }

  private loadMedication(medicationId: number): void {
    this.medications
      .getById(medicationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (medication) => {
          this.loadedIsActive = medication.isActive;
          this.form.controls.description.setValue(medication.description);
          this.form.controls.drugTypeId.setValue(medication.drugTypeId);
          this.form.controls.brandId.setValue(medication.brandId);
          this.form.controls.cellId.setValue(medication.cellId);
          this.form.controls.dose.setValue(medication.dose);
          this.loadingMedication.set(false);
        },
        error: () => this.dialogRef.close({ notFound: true }),
      });
  }

  private refreshServerValidity(): void {
    Object.values(this.form.controls).forEach((control) => control.updateValueAndValidity());
  }

  private serverError(field: keyof MedicationsFieldErrors): ValidatorFn {
    return () => (this.fieldErrors()[field] ? { server: true } : null);
  }
}
