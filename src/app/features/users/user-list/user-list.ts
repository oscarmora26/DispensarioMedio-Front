/**
 * Listado de usuarios (F-006, carga/toast F-007): `dm-user-list` dentro del
 * shell, solo `ADMIN`.
 *
 * - Tabla de Material con columnas usuario/correo/rol/estado/acciones y
 *   `mat-paginator` de servidor obligatorio (`page` desde 1, `size` máx. 100;
 *   opciones 10/20/50, por defecto 20): cada cambio de página, tamaño,
 *   búsqueda, filtro o `sort` emite `GET /v1/users` y resetea a la primera
 *   página cuando cambia el criterio. El total mostrado es el `total` del
 *   servidor. Sin paginación ni filtrado en cliente.
 * - Carga incremental (F-007): `loading` solo gobierna la región de la tabla;
 *   header, filtros y paginador permanecen montados durante `load()`, así no
 *   hay parpadeo ni pérdida de foco en el buscador. `aria-busy` vive en la
 *   región de la tabla. El buscador conserva `debounceTime(300)` +
 *   `distinctUntilChanged` (un `GET` por gesto).
 * - Avisos en toast (F-007): éxitos y errores van a `UsersToast`
 *   (`MatSnackBar` centralizado); no quedan regiones inline `alert`/`status`
 *   salvo el vacío «No hay usuarios para mostrar.».
 * - «Nuevo usuario» abre el diálogo de creación; «Editar» precarga con
 *   `GET /{id}`; «Desactivar»/«Activar» piden confirmación (`DELETE` =
 *   desactivar vía `is_active`; reactivar reenvía el usuario con
 *   `is_active: true` en el `PUT` de reemplazo completo, R-04 resuelto por
 *   OpenAPI). La UI impide la autodesactivación y advierte el último ADMIN
 *   visible. Cancelar/Escape/backdrop cierra sin efectos (nunca es 404).
 * - Todo el HTTP vive en `UsersService`; la contraseña nunca pasa por este
 *   componente.
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
import { UserConfirmDialog, UserConfirmData } from '../user-confirm/user-confirm';
import { UserFormDialog, UserFormData, UserFormResult } from '../user-form/user-form';
import { mapUsersError } from '../users-error';
import { ManagedUser, roleLabel } from '../users.models';
import { UsersToast } from '../users-toast';
import { UsersService } from '../users.service';

/** Filtro de estado: `Todos`/`Activos`/`Inactivos` → `is_active` del servidor. */
type UserStatusFilter = 'all' | 'active' | 'inactive';

/** Tamaño de página por defecto (documentado en `docs/USERS.md`). */
const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'dm-user-list',
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
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserList implements OnInit {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(UsersToast);
  private readonly destroyRef = inject(DestroyRef);

  /** Columnas visibles de `mat-table`. */
  protected readonly displayedColumns = ['username', 'email', 'role', 'status', 'actions'];

  /** Opciones del paginador (máximo 100 por página según RNF-06). */
  protected readonly pageSizeOptions = [10, 20, 50];

  /** Etiqueta legible del rol con fallback al valor crudo. */
  protected readonly roleLabel = roleLabel;

  /** Filas de la página actual (fuente: el servidor, nunca filtrado local). */
  readonly items = signal<ManagedUser[]>([]);

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
  readonly statusFilter = new FormControl<UserStatusFilter>('all', { nonNullable: true });

  /** Id del usuario activo para impedir la autodesactivación. */
  private readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

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
    const data: UserFormData = { mode: 'create' };
    this.dialog
      .open<UserFormDialog, UserFormData, UserFormResult>(UserFormDialog, {
        data,
        width: '32rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === 'saved') {
          this.toast.showUserCreated();
          this.load();
        } else if (isNotFoundResult(result)) {
          // 404 real del `GET /{id}` en edición: recarga y avisa en toast.
          this.load();
          this.toast.showError('El usuario solicitado ya no existe. Actualiza la lista.');
        }
        // Cancelar/Escape/backdrop (`undefined`/`""`/`false`): sin efectos,
        // sin `GET` y sin ningún aviso (nunca es un 404).
      });
  }

  /** Diálogo de edición con precarga (`GET /{id}` dentro del diálogo). */
  openEdit(user: ManagedUser): void {
    const data: UserFormData = { mode: 'edit', userId: user.id };
    this.dialog
      .open<UserFormDialog, UserFormData, UserFormResult>(UserFormDialog, {
        data,
        width: '32rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === 'saved') {
          this.toast.showUserUpdated();
          this.load();
        } else if (isNotFoundResult(result)) {
          // 404 real del `GET /{id}` en edición: recarga y avisa en toast.
          this.load();
          this.toast.showError('El usuario solicitado ya no existe. Actualiza la lista.');
        }
        // Cancelar/Escape/backdrop (`undefined`/`""`/`false`): sin efectos,
        // sin `GET` y sin ningún aviso (nunca es un 404).
      });
  }

  /**
   * Confirmación de activar/desactivar. La autodesactivación está impedida
   * desde el botón (deshabilitado); aquí se resuelve la mutación y el toast
   * correspondiente.
   */
  confirmToggleActive(user: ManagedUser): void {
    const activate = !user.isActive;
    const data: UserConfirmData = {
      username: user.username,
      activate,
      isLastVisibleAdmin: this.isLastVisibleAdmin(user),
    };
    this.dialog
      .open<UserConfirmDialog, UserConfirmData, boolean>(UserConfirmDialog, {
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
          this.users
            .reactivate(user)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.handleToggleSuccess(true),
              error: (error: unknown) => this.handleToggleError(error),
            });
        } else {
          this.users
            .deactivate(user.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.handleToggleSuccess(false),
              error: (error: unknown) => this.handleToggleError(error),
            });
        }
      });
  }

  /** Éxito de activar/desactivar: toast de éxito y recarga. */
  private handleToggleSuccess(activated: boolean): void {
    if (activated) {
      this.toast.showUserActivated();
    } else {
      this.toast.showUserDeactivated();
    }
    this.load();
  }

  /** Fallo de activar/desactivar: mensaje propio en toast de error. */
  private handleToggleError(error: unknown): void {
    this.toast.showError(mapUsersError(error).message);
  }

  /**
   * La UI impide desactivarse a sí mismo: el botón de desactivar propio va
   * deshabilitado (activar al propio es imposible: un inactivo no inicia
   * sesión y por tanto no es el usuario activo).
   */
  isSelfDeactivationDisabled(user: ManagedUser): boolean {
    return user.isActive && user.id === this.currentUserId();
  }

  /** Etiqueta accesible del botón de desactivar propio deshabilitado. */
  selfDeactivateLabel(user: ManagedUser): string {
    return `No puedes desactivar tu propio usuario (${user.username})`;
  }

  /**
   * Heurística visible del último ADMIN (§7 advierte el caso; el backend es la
   * barrera real): el objetivo es admin activo y solo hay uno entre los
   * usuarios cargados.
   */
  private isLastVisibleAdmin(user: ManagedUser): boolean {
    if (user.role !== 'ADMIN' || !user.isActive) {
      return false;
    }
    const activeAdmins = this.items().filter((item) => item.role === 'ADMIN' && item.isActive);
    return activeAdmins.length <= 1;
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
   * Emite `GET /v1/users` con `page`/`size`/`search`/`is_active`/`sort` como
   * carga incremental (F-007): no desmonta header/filtros/paginador, conserva
   * las filas visibles hasta que llega la página nueva (sin parpadeo) y deja
   * el foco donde esté (p. ej. en el buscador). Ante error conserva las filas
   * anteriores y avisa en toast; sin filas previas la región muestra el vacío.
   */
  private load(): void {
    this.loading.set(true);

    const status = this.statusFilter.value;
    this.users
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
          this.toast.showError(mapUsersError(error).message);
        },
      });
  }
}

/**
 * Solo el 404 real del `GET /{id}` en edición cierra con `{ notFound: true }`.
 * Cancelar/Escape/backdrop resuelven `undefined`/`""`/`false` y no deben
 * recargar, avisar ni emitir ningún `GET` (corrección del falso 404, F-007).
 * El `typeof` basta para descartar `undefined`, cadenas y booleanos.
 */
function isNotFoundResult(result: UserFormResult | undefined): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'notFound' in result &&
    result.notFound === true
  );
}
