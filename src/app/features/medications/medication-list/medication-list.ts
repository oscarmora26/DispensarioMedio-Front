import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, map, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import {
  MedicationConfirmData,
  MedicationConfirmDialog,
} from '../medication-confirm/medication-confirm';
import {
  MedicationFormData,
  MedicationFormDialog,
  MedicationFormResult,
} from '../medication-form/medication-form';
import { mapMedicationsError } from '../medications-error';
import { CatalogOption, Medication } from '../medications.models';
import { MedicationsToast } from '../medications-toast';
import { MedicationsService } from '../medications.service';
import { DrugTypesService } from '../../drug-types/drug-types.service';
import { BrandsService } from '../../brands/brands.service';
import { LocationsService } from '../../locations/locations.service';
import { CellOption } from '../../locations/locations.models';

type MedicationStatusFilter = 'all' | 'active' | 'inactive';

const DEFAULT_PAGE_SIZE = 20;

const READ_ONLY_COLUMNS = ['description', 'drugType', 'brand', 'location', 'dose', 'status'];
const WRITABLE_COLUMNS = [
  'description',
  'drugType',
  'brand',
  'location',
  'dose',
  'status',
  'actions',
];

@Component({
  selector: 'dm-medication-list',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
  ],
  templateUrl: './medication-list.html',
  styleUrl: './medication-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicationList implements OnInit {
  private readonly medications = inject(MedicationsService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(MedicationsToast);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drugTypesService = inject(DrugTypesService);
  private readonly brandsService = inject(BrandsService);
  private readonly locationsService = inject(LocationsService);

  protected readonly isAdmin = computed(() => this.auth.user()?.role === 'ADMIN');
  protected readonly displayedColumns = computed(() =>
    this.isAdmin() ? WRITABLE_COLUMNS : READ_ONLY_COLUMNS,
  );
  protected readonly pageSizeOptions = [10, 20, 50];

  readonly items = signal<Medication[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sortState = signal<Sort>({ active: '', direction: '' });
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly search = new FormControl('', { nonNullable: true });
  readonly statusFilter = new FormControl<MedicationStatusFilter>('all', { nonNullable: true });
  readonly drugTypeFilter = new FormControl<number | null>(null);
  readonly brandFilter = new FormControl<number | null>(null);
  readonly cellFilter = new FormControl<number | null>(null);

  readonly drugTypeOptions = signal<CatalogOption[]>([]);
  readonly brandOptions = signal<CatalogOption[]>([]);
  readonly cellOptions = signal<CellOption[]>([]);

  drugTypeLabel(id: number): string {
    return this.drugTypeOptions().find((o) => o.id === id)?.label ?? String(id);
  }
  brandLabel(id: number): string {
    return this.brandOptions().find((o) => o.id === id)?.label ?? String(id);
  }
  cellLabel(id: number): string {
    return this.cellOptions().find((o) => o.id === id)?.label ?? String(id);
  }

  ngOnInit(): void {
    // Catálogos para selects y mapeo de nombres. Cada fuente se aísla con
    // `catchError`: si una falla (por ejemplo `/v1/shelves`), las otras dos
    // conservan sus opciones y el listado de medicamentos nunca se rompe.
    // Las celdas vienen de `listAllCells()` (`cells.id`), no de un endpoint de
    // ubicaciones, que no existe en el backend.
    forkJoin({
      drugTypes: this.drugTypesService.list({ page: 1, size: 100 }).pipe(
        map((page) => page.items.map((item) => ({ id: item.id, label: item.description }))),
        catchError(() => of<CatalogOption[]>([])),
      ),
      brands: this.brandsService.list({ page: 1, size: 100 }).pipe(
        map((page) => page.items.map((item) => ({ id: item.id, label: item.description }))),
        catchError(() => of<CatalogOption[]>([])),
      ),
      cells: this.locationsService.listAllCells().pipe(catchError(() => of<CellOption[]>([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ drugTypes, brands, cells }) => {
        this.drugTypeOptions.set(drugTypes);
        this.brandOptions.set(brands);
        this.cellOptions.set(cells);
      });

    this.load();

    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pageIndex.set(0);
        this.load();
      });

    this.statusFilter.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageIndex.set(0);
      this.load();
    });
    this.drugTypeFilter.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageIndex.set(0);
      this.load();
    });
    this.brandFilter.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageIndex.set(0);
      this.load();
    });
    this.cellFilter.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageIndex.set(0);
      this.load();
    });
  }

  onPage(event: PageEvent): void {
    if (event.pageSize !== this.pageSize()) {
      this.pageSize.set(event.pageSize);
      this.pageIndex.set(0);
    } else {
      this.pageIndex.set(event.pageIndex);
    }
    this.load();
  }

  onSort(sort: Sort): void {
    this.sortState.set(sort);
    this.pageIndex.set(0);
    this.load();
  }

  openCreate(): void {
    const data: MedicationFormData = { mode: 'create' };
    this.dialog
      .open<MedicationFormDialog, MedicationFormData, MedicationFormResult>(MedicationFormDialog, {
        data,
        width: '32rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === 'saved') {
          this.toast.showCreated();
          this.load();
        } else if (isNotFoundResult(result)) {
          this.load();
          this.toast.showError('El medicamento solicitado ya no existe. Actualiza la lista.');
        }
      });
  }

  openEdit(medication: Medication): void {
    const data: MedicationFormData = { mode: 'edit', medicationId: medication.id };
    this.dialog
      .open<MedicationFormDialog, MedicationFormData, MedicationFormResult>(MedicationFormDialog, {
        data,
        width: '32rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === 'saved') {
          this.toast.showUpdated();
          this.load();
        } else if (isNotFoundResult(result)) {
          this.load();
          this.toast.showError('El medicamento solicitado ya no existe. Actualiza la lista.');
        }
      });
  }

  confirmToggleActive(medication: Medication): void {
    const activate = !medication.isActive;
    const data: MedicationConfirmData = { description: medication.description, activate };
    this.dialog
      .open<MedicationConfirmDialog, MedicationConfirmData, boolean>(MedicationConfirmDialog, {
        data,
        width: '28rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        if (activate) {
          this.medications
            .reactivate(medication)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.handleToggleSuccess(true),
              error: (error: unknown) => this.toast.showError(mapMedicationsError(error).message),
            });
        } else {
          this.medications
            .deactivate(medication.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.handleToggleSuccess(false),
              error: (error: unknown) => this.toast.showError(mapMedicationsError(error).message),
            });
        }
      });
  }

  private handleToggleSuccess(activated: boolean): void {
    if (activated) this.toast.showActivated();
    else this.toast.showDeactivated();
    this.load();
  }

  private sortParam(): string | undefined {
    const sort = this.sortState();
    if (!sort.active || !sort.direction) return undefined;
    return sort.direction === 'desc' ? `-${sort.active}` : sort.active;
  }

  retry(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const status = this.statusFilter.value;
    this.medications
      .list({
        page: this.pageIndex() + 1,
        size: this.pageSize(),
        search: this.search.value,
        isActive: status === 'all' ? undefined : status === 'active',
        drugTypeId: this.drugTypeFilter.value ?? undefined,
        brandId: this.brandFilter.value ?? undefined,
        cellId: this.cellFilter.value ?? undefined,
        sort: this.sortParam(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.items.set(page.items);
          this.total.set(page.total);
          this.errorMessage.set(null);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(mapMedicationsError(error).message);
        },
      });
  }
}

function isNotFoundResult(result: MedicationFormResult | undefined): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'notFound' in result &&
    result.notFound === true
  );
}
