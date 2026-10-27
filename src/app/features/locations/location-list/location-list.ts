/**
 * Listado de ubicaciones (F-011, S1/S6/S9/S10): `dm-location-list` dentro del
 * shell, visible para `ADMIN` y `MEDICO`.
 *
 * El backend no expone `/v1/locations`: el catálogo real es
 * **`/v1/shelves`** (estantes) con celdas anidadas, así que cada fila es un
 * estante y sus celdas se muestran juntas en una columna.
 *
 * - Tabla de Material con columnas nombre/descripción/celdas/estado(+acciones)
 *   y `mat-paginator` de servidor obligatorio (`page` desde 1, `size` 1-100;
 *   opciones 10/20/50, por defecto 20): cada cambio de página, tamaño,
 *   búsqueda, filtro o `sort` emite `GET /v1/shelves` y resetea a la primera
 *   página cuando cambia el criterio. El total mostrado es el `total` del
 *   servidor; sin paginación ni filtrado en cliente. Solo la columna Nombre es
 *   ordenable (`name` / `-name`).
 * - Permisos (S7, PQ-02): con `role === 'MEDICO'` no se renderiza ningún
 *   control de escritura en el DOM (ni «Nuevo», ni la columna de acciones):
 *   no es solo deshabilitar. El backend devuelve `403` como red de seguridad.
 * - Carga contenida (S10, patrón F-007/F-008): `loading` solo gobierna la
 *   región de la tabla; header, filtros y paginador permanecen montados, así
 *   no hay parpadeo del layout ni pérdida de foco en el buscador. `aria-busy`
 *   vive en la región de la tabla y el overlay de carga es absoluto, sin
 *   ocupar altura en flujo (el footer del shell no salta). El buscador
 *   conserva `debounceTime(300)` + `distinctUntilChanged` (un `GET` por gesto).
 * - Avisos en toast: los toasts quedan para las mutaciones (crear, editar,
 *   activar, desactivar). El fallo de carga del listado **no** va al toast:
 *   se anuncia inline en la región de la tabla (`role="alert"`) con
 *   `retry()`, para no duplicar el anuncio (CA-06). El vacío «No hay
 *   ubicaciones para mostrar.» también es inline y solo aparece cuando la
 *   carga terminó sin filas y sin error.
 * - «Nuevo ubicación» abre el diálogo de creación; «Editar» precarga con
 *   `GET /{id}`; «Desactivar»/«Activar» piden confirmación explícita
 *   (`DELETE`; reactivar reenvía el estante con `is_active: true` en el `PUT`
 *   de reemplazo completo). Cancelar/Escape/backdrop cierra sin efectos.
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
import { LocationConfirmData, LocationConfirmDialog } from '../location-confirm/location-confirm';
import {
  LocationFormData,
  LocationFormDialog,
  LocationFormResult,
} from '../location-form/location-form';
import { mapLocationsError } from '../locations-error';
import { Shelf, formatCells } from '../locations.models';
import { LocationsToast } from '../locations-toast';
import { LocationsService } from '../locations.service';

/** Filtro de estado: `Todos`/`Activos`/`Inactivos` → `is_active` del servidor. */
type LocationStatusFilter = 'all' | 'active' | 'inactive';

/** Tamaño de página por defecto (S1: opciones 10/20/50, def. 20). */
const DEFAULT_PAGE_SIZE = 20;

/** Columnas de solo lectura (MEDICO) frente a las de escritura (ADMIN). */
const READ_ONLY_COLUMNS = ['name', 'description', 'cells', 'status'];
const WRITABLE_COLUMNS = ['name', 'description', 'cells', 'status', 'actions'];

@Component({
  selector: 'dm-location-list',
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
  templateUrl: './location-list.html',
  styleUrl: './location-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationList implements OnInit {
  private readonly locations = inject(LocationsService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(LocationsToast);
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

  /** Texto de la columna Celdas: `«tramo / celda»` unido por `« · »`. */
  protected readonly formatCells = formatCells;

  /** Filas de la página actual: un estante con sus celdas anidadas. */
  readonly items = signal<Shelf[]>([]);

  /** Total del servidor para el paginador. */
  readonly total = signal(0);

  /** Índice de página 0-based para `mat-paginator` (el servidor usa base 1). */
  readonly pageIndex = signal(0);

  /** Tamaño de página actual. */
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  /** Orden de servidor (`name` o `-name`); vacío = orden del backend. */
  readonly sortState = signal<Sort>({ active: '', direction: '' });

  /** Carga en curso: solo gobierna la región de la tabla (`aria-busy`). */
  readonly loading = signal(true);

  /**
   * Error de carga ya traducido (`mapLocationsError`), mostrado inline con
   * reintento (CA-06). Se limpia al arrancar una carga y al tener éxito; no se
   * duplica en toast.
   */
  readonly errorMessage = signal<string | null>(null);

  /** Buscador (query param `search`; emite con 300 ms de espera). */
  readonly search = new FormControl('', { nonNullable: true });

  /** Filtro por estado (query param `is_active`). */
  readonly statusFilter = new FormControl<LocationStatusFilter>('all', { nonNullable: true });

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

  /**
   * Reintento del fallo de carga (CA-06): limpia el error y republica el `GET`
   * con los criterios vigentes (página, tamaño, búsqueda, estado y orden), sin
   * volver a la página 1 y sin tocar el foco del buscador.
   */
  retry(): void {
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
    const data: LocationFormData = { mode: 'create' };
    this.dialog
      .open<LocationFormDialog, LocationFormData, LocationFormResult>(LocationFormDialog, {
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
          this.toast.showError('La ubicación solicitada ya no existe. Actualiza la lista.');
        }
        // Cancelar/Escape/backdrop (`undefined`/`""`/`false`): sin efectos,
        // sin `GET` y sin ningún aviso (misma corrección que F-007).
      });
  }

  /** Diálogo de edición con precarga (`GET /{id}` dentro del diálogo). */
  openEdit(shelf: Shelf): void {
    const data: LocationFormData = { mode: 'edit', locationId: shelf.id };
    this.dialog
      .open<LocationFormDialog, LocationFormData, LocationFormResult>(LocationFormDialog, {
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
          this.toast.showError('La ubicación solicitada ya no existe. Actualiza la lista.');
        }
      });
  }

  /** Confirmación explícita de activar/desactivar (S4). */
  confirmToggleActive(shelf: Shelf): void {
    const activate = !shelf.isActive;
    const data: LocationConfirmData = { name: shelf.name, activate };
    this.dialog
      .open<LocationConfirmDialog, LocationConfirmData, boolean>(LocationConfirmDialog, {
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
          this.locations
            .reactivate(shelf)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.handleToggleSuccess(true),
              error: (error: unknown) => this.handleToggleError(error),
            });
        } else {
          this.locations
            .deactivate(shelf.id)
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
    this.toast.showError(mapLocationsError(error).message);
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
   * Emite `GET /v1/shelves` con `page`/`size`/`search`/`is_active`/`sort`
   * como carga incremental (S10): no desmonta header/filtros/paginador,
   * conserva las filas visibles hasta que llega la página nueva y deja el foco
   * donde esté. Ante error conserva las filas anteriores y publica el mensaje
   * inline (`errorMessage`, con reintento); sin filas previas la región muestra
   * el mensaje de error en lugar del vacío (CA-06).
   */
  private load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const status = this.statusFilter.value;
    this.locations
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
          this.errorMessage.set(null);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(mapLocationsError(error).message);
        },
      });
  }
}

/**
 * Solo el 404 real del `GET /{id}` en edición cierra con `{ notFound: true }`.
 * Cancelar/Escape/backdrop resuelven `undefined`/`""`/`false` y no deben
 * recargar, avisar ni emitir ningún `GET`.
 */
function isNotFoundResult(result: LocationFormResult | undefined): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'notFound' in result &&
    result.notFound === true
  );
}
