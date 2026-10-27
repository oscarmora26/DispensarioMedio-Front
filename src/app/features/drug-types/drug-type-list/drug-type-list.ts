/**
 * Listado de tipos de fármacos (F-009, S1/S6/S9/S10): `dm-drug-type-list`
 * dentro del shell, visible para `ADMIN` y `MEDICO`.
 *
 * - Tabla de Material con columnas descripción/estado y `mat-paginator` de
 *   servidor obligatorio (`page` desde 1, `size` 1-100; opciones 10/20/50, por
 *   defecto 20): cada cambio de página, tamaño, búsqueda, filtro o `sort`
 *   emite `GET /v1/drug-types` y resetea a la primera página cuando cambia el
 *   criterio. El total mostrado es el `total` del servidor; sin paginación ni
 *   filtrado en cliente.
 * - Permisos (S7, PQ-02): con `role === 'MEDICO'` no se renderiza ningún
 *   control de escritura en el DOM (ni «Nuevo», ni la columna de acciones):
 *   no es solo deshabilitar. El backend devuelve `403` como red de seguridad.
 * - Carga contenida (S10, patrón F-007/F-008): `loading` solo gobierna la
 *   región de la tabla; header, filtros y paginador permanecen montados, así
 *   no hay parpadeo del layout ni pérdida de foco en el buscador. `aria-busy`
 *   vive en la región de la tabla y el overlay de carga es absoluto, sin
 *   ocupar altura en flujo (el footer del shell no salta). El buscador
 *   conserva `debounceTime(300)` + `distinctUntilChanged` (un `GET` por gesto).
 * - Avisos en toast: éxitos y errores van a `DrugTypesToast`; queda inline
 *   solo el vacío «No hay tipos de fármacos para mostrar.».
 * - «Nuevo tipo de fármaco» abre el diálogo de creación; «Editar» precarga con
 *   `GET /{id}`; «Desactivar»/«Activar» piden confirmación explícita
 *   (`DELETE` = desactivación lógica; reactivar reenvía el registro con
 *   `is_active: true` en el `PUT` de reemplazo completo). Cancelar/Escape/
 *   backdrop cierra sin efectos.
 */

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
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DrugTypeConfirmData, DrugTypeConfirmDialog } from '../drug-type-confirm/drug-type-confirm';
import {
  DrugTypeFormData,
  DrugTypeFormDialog,
  DrugTypeFormResult,
} from '../drug-type-form/drug-type-form';
import { mapDrugTypesError } from '../drug-types-error';
import { DrugType } from '../drug-types.models';
import { DrugTypesToast } from '../drug-types-toast';
import { DrugTypesService } from '../drug-types.service';

/** Filtro de estado: `Todos`/`Activos`/`Inactivos` → `is_active` del servidor. */
type DrugTypeStatusFilter = 'all' | 'active' | 'inactive';

/** Tamaño de página por defecto (S1: opciones 10/20/50, def. 20). */
const DEFAULT_PAGE_SIZE = 20;

/** Columnas de solo lectura (MEDICO) frente a las de escritura (ADMIN). */
const READ_ONLY_COLUMNS = ['description', 'status'];
const WRITABLE_COLUMNS = ['description', 'status', 'actions'];

@Component({
  selector: 'dm-drug-type-list',
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
  templateUrl: './drug-type-list.html',
  styleUrl: './drug-type-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrugTypeList implements OnInit {
  private readonly drugTypes = inject(DrugTypesService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(DrugTypesToast);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * `true` solo con `role === 'ADMIN'`. Con `MEDICO` el listado es de solo
   * lectura y los controles de escritura no existen en el DOM (S7/PQ-02).
   */
  protected readonly isAdmin = computed(() => this.auth.user()?.role === 'ADMIN');

  /** Columnas visibles: la de acciones solo existe para `ADMIN`. */
  protected readonly displayedColumns = computed(() =>
    this.isAdmin() ? WRITABLE_COLUMNS : READ_ONLY_COLUMNS,
  );

  /** Opciones del paginador (`size` 1-100 según S1). */
  protected readonly pageSizeOptions = [10, 20, 50];

  /** Filas de la página actual (fuente: el servidor, nunca filtrado local). */
  readonly items = signal<DrugType[]>([]);

  /** Total del servidor para el paginador. */
  readonly total = signal(0);

  /** Índice de página 0-based para `mat-paginator` (el servidor usa base 1). */
  readonly pageIndex = signal(0);

  /** Tamaño de página actual. */
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  /** Orden de servidor (`campo` o `-campo`); vacío = orden del backend. */
  readonly sortState = signal<Sort>({ active: '', direction: '' });

  /** Carga en curso: solo gobierna la región de la tabla (`aria-busy`). */
  readonly loading = signal(true);

  /** Buscador (query param `search`; emite con 300 ms de espera). */
  readonly search = new FormControl('', { nonNullable: true });

  /** Filtro por estado (query param `is_active`). */
  readonly statusFilter = new FormControl<DrugTypeStatusFilter>('all', { nonNullable: true });

  ngOnInit(): void {
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
  }

  /** Cambio de página o tamaño: el tamaño nuevo vuelve a la primera página. */
  onPage(event: PageEvent): void {
    if (event.pageSize !== this.pageSize()) {
      this.pageSize.set(event.pageSize);
      this.pageIndex.set(0);
    } else {
      this.pageIndex.set(event.pageIndex);
    }
    this.load();
  }

  /** Orden clicado en la cabecera: emite `sort` y vuelve a la primera página. */
  onSort(sort: Sort): void {
    this.sortState.set(sort);
    this.pageIndex.set(0);
    this.load();
  }

  /** Diálogo de creación; ante `201` recarga la lista con toast de éxito. */
  openCreate(): void {
    const data: DrugTypeFormData = { mode: 'create' };
    this.dialog
      .open<DrugTypeFormDialog, DrugTypeFormData, DrugTypeFormResult>(DrugTypeFormDialog, {
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
          // 404 real del `GET /{id}` en edición: recarga y avisa en toast.
          this.load();
          this.toast.showError('El tipo de fármaco solicitado ya no existe. Actualiza la lista.');
        }
        // Cancelar/Escape/backdrop (`undefined`/`""`/`false`): sin efectos,
        // sin `GET` y sin ningún aviso (misma corrección que F-007).
      });
  }

  /** Diálogo de edición con precarga (`GET /{id}` dentro del diálogo). */
  openEdit(drugType: DrugType): void {
    const data: DrugTypeFormData = { mode: 'edit', drugTypeId: drugType.id };
    this.dialog
      .open<DrugTypeFormDialog, DrugTypeFormData, DrugTypeFormResult>(DrugTypeFormDialog, {
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
          this.toast.showError('El tipo de fármaco solicitado ya no existe. Actualiza la lista.');
        }
      });
  }

  /** Confirmación explícita de activar/desactivar (S4). */
  confirmToggleActive(drugType: DrugType): void {
    const activate = !drugType.isActive;
    const data: DrugTypeConfirmData = { description: drugType.description, activate };
    this.dialog
      .open<DrugTypeConfirmDialog, DrugTypeConfirmData, boolean>(DrugTypeConfirmDialog, {
        data,
        width: '28rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        if (activate) {
          this.drugTypes
            .reactivate(drugType)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.handleToggleSuccess(true),
              error: (error: unknown) => this.handleToggleError(error),
            });
        } else {
          this.drugTypes
            .deactivate(drugType.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.handleToggleSuccess(false),
              error: (error: unknown) => this.handleToggleError(error),
            });
        }
      });
  }

  /** Fallo de activar/desactivar: mensaje propio en toast de error. */
  private handleToggleError(error: unknown): void {
    this.toast.showError(mapDrugTypesError(error).message);
  }

  /** Éxito de activar/desactivar: toast de éxito y recarga. */
  private handleToggleSuccess(activated: boolean): void {
    if (activated) {
      this.toast.showActivated();
    } else {
      this.toast.showDeactivated();
    }
    this.load();
  }

  /** Parámetro `sort` del servidor a partir del estado de `mat-sort`. */
  private sortParam(): string | undefined {
    const sort = this.sortState();
    if (!sort.active || !sort.direction) {
      return undefined;
    }
    return sort.direction === 'desc' ? `-${sort.active}` : sort.active;
  }

  /**
   * Emite `GET /v1/drug-types` con `page`/`size`/`search`/`is_active`/`sort`
   * como carga incremental (S10): no desmonta header/filtros/paginador,
   * conserva las filas visibles hasta que llega la página nueva y deja el foco
   * donde esté. Ante error conserva las filas anteriores y avisa en toast; sin
   * filas previas la región muestra el vacío.
   */
  private load(): void {
    this.loading.set(true);

    const status = this.statusFilter.value;
    this.drugTypes
      .list({
        page: this.pageIndex() + 1,
        size: this.pageSize(),
        search: this.search.value,
        isActive: status === 'all' ? undefined : status === 'active',
        sort: this.sortParam(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.items.set(page.items);
          this.total.set(page.total);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.toast.showError(mapDrugTypesError(error).message);
        },
      });
  }
}

/**
 * Solo el 404 real del `GET /{id}` en edición cierra con `{ notFound: true }`.
 * Cancelar/Escape/backdrop resuelven `undefined`/`""`/`false` y no deben
 * recargar, avisar ni emitir ningún `GET`.
 */
function isNotFoundResult(result: DrugTypeFormResult | undefined): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'notFound' in result &&
    result.notFound === true
  );
}
