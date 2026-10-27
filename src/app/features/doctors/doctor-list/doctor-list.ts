/**
 * Listado de médicos (F-014, S1/S8/S10/S11/S12/S13): `dm-doctor-list` dentro
 * del shell, visible solo para `ADMIN` (ruta con `adminGuard`).
 *
 * - Tabla de Material con columnas nombre/cédula/tanda/especialidad/usuario/
 *   estado y `mat-paginator` de servidor obligatorio (`page` desde 1, `size`
 *   1-100; opciones 10/20/50, por defecto 20): cada cambio de página, tamaño,
 *   búsqueda, filtro u orden emite `GET /v1/doctors` y resetea a la primera
 *   página cuando cambia el criterio. El total mostrado es el `total` del
 *   servidor; sin paginación ni filtrado en cliente.
 * - La cédula se muestra con la máscara `XXX-XXXXXXX-X` aunque el servidor la
 *   devuelva como 11 dígitos planos; la tanda se muestra capitalizada y una
 *   tanda no canónica conserva su valor almacenado (S4).
 * - La columna «Usuario» es **de solo lectura** (S6): muestra
 *   `user.username` o «Sin usuario» cuando el médico no tiene cuenta. Ni el
 *   listado ni el formulario editan esa asociación (vive en Usuarios, F-006).
 * - Permisos (S11): con un rol distinto de `ADMIN` no se renderiza ningún
 *   control de escritura en el DOM (ni «Nuevo médico», ni la columna de
 *   acciones): no es solo deshabilitar. El backend devuelve `403` como red de
 *   seguridad y la ruta ya exige `adminGuard`.
 * - Carga contenida (S13, patrón F-009/F-011): `loading` solo gobierna la
 *   región de la tabla; header, filtros y paginador permanecen montados, así
 *   no hay parpadeo del layout ni pérdida de foco en el buscador. `aria-busy`
 *   vive en la región de la tabla y el overlay de carga es absoluto, sin
 *   ocupar altura en flujo ni robar el puntero. El buscador conserva
 *   `debounceTime(300)` + `distinctUntilChanged` (un `GET` por gesto).
 * - Avisos en toast: los toasts quedan para las mutaciones (crear, editar,
 *   activar, desactivar). El fallo de carga del listado **no** va al toast: se
 *   anuncia inline en la región de la tabla (`role="alert"`) con `retry()`,
 *   para no duplicar el anuncio. El vacío «No hay médicos para mostrar.»
 *   también es inline.
 * - «Nuevo médico» abre el diálogo de creación; «Editar» precarga con
 *   `GET /{id}`; «Desactivar»/«Activar» piden confirmación explícita
 *   (`DELETE` = desactivación lógica e idempotente, con `409 doctor_has_visits`;
 *   reactivar reenvía el médico con `is_active: true` en el `PUT` de reemplazo
 *   completo). Cancelar/Escape/backdrop cierra sin efectos.
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
import { DoctorConfirmData, DoctorConfirmDialog } from '../doctor-confirm/doctor-confirm';
import { DoctorFormData, DoctorFormDialog, DoctorFormResult } from '../doctor-form/doctor-form';
import { mapDoctorsError } from '../doctors-error';
import { Doctor, SEARCH_MAX_LENGTH, formatCedula, labShiftLabel } from '../doctors.models';
import { DoctorsService } from '../doctors.service';
import { DoctorsToast } from '../doctors-toast';

/** Filtro de estado: `Todos`/`Activos`/`Inactivos` → `is_active` del servidor. */
type DoctorStatusFilter = 'all' | 'active' | 'inactive';

/** Tamaño de página por defecto (S1: opciones 10/20/50, def. 20). */
const DEFAULT_PAGE_SIZE = 20;

/** Columnas de solo lectura frente a las de escritura (ADMIN, S11). */
const READ_ONLY_COLUMNS = ['name', 'cedula', 'shift', 'specialty', 'user', 'status'];
const WRITABLE_COLUMNS = [...READ_ONLY_COLUMNS, 'actions'];

@Component({
  selector: 'dm-doctor-list',
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
  templateUrl: './doctor-list.html',
  styleUrl: './doctor-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorList implements OnInit {
  private readonly doctors = inject(DoctorsService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(DoctorsToast);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * `true` solo con `role === 'ADMIN'`. Con otro rol el listado es de solo
   * lectura y los controles de escritura no existen en el DOM (S11).
   */
  protected readonly isAdmin = computed(() => this.auth.user()?.role === 'ADMIN');

  /** Columnas visibles: la de acciones solo existe para `ADMIN`. */
  protected readonly displayedColumns = computed(() =>
    this.isAdmin() ? WRITABLE_COLUMNS : READ_ONLY_COLUMNS,
  );

  /** Opciones del paginador (`size` 1-100 según S1). */
  protected readonly pageSizeOptions = [10, 20, 50];

  /** Límite del parámetro `search` (S1). */
  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;

  /** Formato de la cédula en tabla (`XXX-XXXXXXX-X`, S3). */
  protected readonly formatCedula = formatCedula;

  /** Etiqueta de la tanda: capitalizada si es canónica, cruda si no (S4). */
  protected readonly labShiftLabel = labShiftLabel;

  /** Filas de la página actual (fuente: el servidor, nunca filtrado local). */
  readonly items = signal<Doctor[]>([]);

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

  /**
   * Error de carga ya traducido (`mapDoctorsError`), mostrado inline con
   * reintento (S13). Se limpia al arrancar una carga y al tener éxito; no se
   * duplica en toast.
   */
  readonly errorMessage = signal<string | null>(null);

  /** Buscador (query param `search`; emite con 300 ms de espera). */
  readonly search = new FormControl('', { nonNullable: true });

  /** Filtro por estado (query param `is_active`). */
  readonly statusFilter = new FormControl<DoctorStatusFilter>('all', { nonNullable: true });

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
   * Reintento del fallo de carga (S13): limpia el error y republica el `GET`
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
    const data: DoctorFormData = { mode: 'create' };
    this.dialog
      .open<DoctorFormDialog, DoctorFormData, DoctorFormResult>(DoctorFormDialog, {
        data,
        width: '34rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) =>
        this.handleFormResult(result, this.toast.showCreated.bind(this.toast)),
      );
  }

  /** Diálogo de edición con precarga (`GET /{id}` dentro del diálogo). */
  openEdit(doctor: Doctor): void {
    const data: DoctorFormData = { mode: 'edit', doctorId: doctor.id };
    this.dialog
      .open<DoctorFormDialog, DoctorFormData, DoctorFormResult>(DoctorFormDialog, {
        data,
        width: '34rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) =>
        this.handleFormResult(result, this.toast.showUpdated.bind(this.toast)),
      );
  }

  /** Confirmación explícita de activar/desactivar (S8). */
  confirmToggleActive(doctor: Doctor): void {
    const activate = !doctor.isActive;
    const data: DoctorConfirmData = { name: doctor.name, cedula: doctor.cedula, activate };
    this.dialog
      .open<DoctorConfirmDialog, DoctorConfirmData, boolean>(DoctorConfirmDialog, {
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
          this.doctors
            .reactivate(doctor)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.handleToggleSuccess(true),
              error: (error: unknown) => this.handleToggleError(error),
            });
        } else {
          this.doctors
            .deactivate(doctor.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.handleToggleSuccess(false),
              error: (error: unknown) => this.handleToggleError(error),
            });
        }
      });
  }

  /**
   * Resultado del diálogo de crear/editar: `saved` recarga con el toast de
   * éxito; `{ notFound: true }` (404 real del `GET /{id}`) recarga y avisa.
   * Cancelar/Escape/backdrop (`undefined`/`''`/`false`) no tienen efectos.
   */
  private handleFormResult(result: DoctorFormResult | undefined, showSuccess: () => void): void {
    if (result === 'saved') {
      showSuccess();
      this.load();
      return;
    }
    if (isNotFoundResult(result)) {
      this.load();
      this.toast.showError('El médico solicitado ya no existe. Actualiza la lista.');
    }
  }

  /**
   * Fallo de activar/desactivar: mensaje propio en toast de error. Incluye el
   * `409 doctor_has_visits` («No se puede desactivar el médico porque tiene
   * visitas registradas.»), que no recarga la lista porque no hubo cambio.
   */
  private handleToggleError(error: unknown): void {
    this.toast.showError(mapDoctorsError(error).message);
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
   * Emite `GET /v1/doctors` con `page`/`size`/`search`/`is_active`/`sort` como
   * carga incremental (S13): no desmonta header/filtros/paginador, conserva las
   * filas visibles hasta que llega la página nueva y deja el foco donde esté.
   * Ante error conserva las filas anteriores y publica el mensaje inline
   * (`errorMessage`, con reintento); sin filas previas la región muestra el
   * mensaje de error en lugar del vacío.
   */
  private load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const status = this.statusFilter.value;
    this.doctors
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
          this.errorMessage.set(mapDoctorsError(error).message);
        },
      });
  }
}

/**
 * Solo el 404 real del `GET /{id}` en edición cierra con `{ notFound: true }`.
 * Cancelar/Escape/backdrop resuelven `undefined`/`''`/`false` y no deben
 * recargar, avisar ni emitir ningún `GET`.
 */
function isNotFoundResult(result: DoctorFormResult | undefined): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'notFound' in result &&
    result.notFound === true
  );
}
