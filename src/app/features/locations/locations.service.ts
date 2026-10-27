/**
 * Acceso HTTP al catálogo de ubicaciones (F-011), alineado al contrato vivo
 * del backend: **`/v1/shelves`** (estantes) y **`/v1/cells`** (celdas con CRUD
 * propio).
 *
 * - Bases `environment.apiUrl + '/v1/shelves'` y `.../v1/cells` compuestas en
 *   un solo lugar (mismo patrón que `AuthService`/`UsersService`). La cabecera
 *   `Authorization: Bearer` la adjunta el `authInterceptor` de F-002; este
 *   servicio no conoce almacenamiento ni el rol del usuario.
 * - `list()` arma los query params (`page` desde 1, `size` 1-100, `search`,
 *   `is_active`, `sort`) en un único punto y devuelve la página mapeada a
 *   `camelCase`. Sin paginación ni filtrado en cliente.
 * - El body del estante (`ShelfCreate`/`ShelfUpdate`) viaja **sin `cells`**:
 *   el contrato es `additionalProperties: false` y manda `cells` responde
 *   `422`. Las celdas se escriben con `createCell()`, `updateCell()` y
 *   `deleteCell()` contra `/v1/cells`.
 * - `deactivate()` emite `DELETE /v1/shelves/{id}`. Su semántica lógica/física
 *   no está verificada: la UI no afirma nada sobre borrado de datos.
 * - `reactivate()` emite el `PUT` de reemplazo completo del estante con
 *   `is_active: true`, porque un `PUT` parcial responde `422` por los campos
 *   requeridos faltantes (mismo criterio R-04 de F-006).
 * - `listAllCells()` aplana estantes activos y celdas activas en
 *   `CellOption[]` para los catálogos que referencian `cells.id`
 *   (medicamentos), sin truncar: recorre todas las páginas.
 */

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CellOption,
  CellWriteInput,
  Shelf,
  ShelfCell,
  ShelfCellDto,
  ShelfDto,
  ShelfListPage,
  ShelfListParams,
  ShelfListResponseDto,
  ShelfWriteInput,
  toCellOption,
  toCellPayload,
  toShelf,
  toShelfCell,
  toShelfListPage,
  toShelfPayload,
} from './locations.models';

/**
 * `size` máximo aceptado por el backend (1-100). `listAllCells()` lo usa para
 * necesitar la menor cantidad de páginas posibles.
 */
const MAX_PAGE_SIZE = 100;

@Injectable({ providedIn: 'root' })
export class LocationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/shelves`;
  private readonly cellsUrl = `${environment.apiUrl}/v1/cells`;

  /**
   * Lista paginada del servidor (`GET /v1/shelves` → `200` con
   * `{items, total, page, size, pages}`).
   */
  list(params: ShelfListParams): Observable<ShelfListPage> {
    let query = new HttpParams().set('page', String(params.page)).set('size', String(params.size));

    const search = params.search?.trim();
    if (search) {
      query = query.set('search', search);
    }
    if (params.isActive !== undefined) {
      query = query.set('is_active', String(params.isActive));
    }
    const sort = params.sort?.trim();
    if (sort) {
      query = query.set('sort', sort);
    }

    return this.http
      .get<ShelfListResponseDto>(this.baseUrl, { params: query })
      .pipe(map(toShelfListPage));
  }

  /** Detalle (`GET /v1/shelves/{id}` → `200`; `404` si ya no existe). */
  getById(id: number): Observable<Shelf> {
    return this.http.get<ShelfDto>(`${this.baseUrl}/${id}`).pipe(map(toShelf));
  }

  /**
   * Creación (`POST /v1/shelves` → `201`; `409` si el `name` ya existe).
   * El body lleva solo `name`, `description` e `is_active`: las celdas se
   * crean después con `createCell()`.
   */
  create(input: ShelfWriteInput): Observable<Shelf> {
    return this.http.post<ShelfDto>(this.baseUrl, toShelfPayload(input)).pipe(map(toShelf));
  }

  /**
   * Actualización (`PUT /v1/shelves/{id}` → `200`; sin `PATCH`). Reemplazo
   * completo del estante y **no toca sus celdas**.
   */
  update(id: number, input: ShelfWriteInput): Observable<Shelf> {
    return this.http
      .put<ShelfDto>(`${this.baseUrl}/${id}`, toShelfPayload(input))
      .pipe(map(toShelf));
  }

  /** `DELETE /v1/shelves/{id}` → `204` sin cuerpo. */
  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Reactivación: reenvía el estante visible con `is_active: true` en el `PUT`
   * de reemplazo completo (`name` + `description`). Un `PUT` parcial
   * `{is_active}` responde `422` por los requeridos faltantes.
   */
  reactivate(shelf: Shelf): Observable<Shelf> {
    return this.http
      .put<ShelfDto>(
        `${this.baseUrl}/${shelf.id}`,
        toShelfPayload({
          name: shelf.name,
          description: shelf.description ?? '',
          isActive: true,
        }),
      )
      .pipe(map(toShelf));
  }

  /** Crea una celda del estante (`POST /v1/cells` → `201`; `409` duplicado). */
  createCell(input: CellWriteInput, shelfId: number): Observable<ShelfCell> {
    return this.http
      .post<ShelfCellDto>(this.cellsUrl, toCellPayload(input, shelfId))
      .pipe(map(toShelfCell));
  }

  /**
   * Reemplaza una celda existente (`PUT /v1/cells/{id}` → `200`; `409` si la
   * posición `(shelf_id, section, cell)` ya existe). `shelf_id` permite
   * moverla a otro estante.
   */
  updateCell(id: number, input: CellWriteInput, shelfId: number): Observable<ShelfCell> {
    return this.http
      .put<ShelfCellDto>(`${this.cellsUrl}/${id}`, toCellPayload(input, shelfId))
      .pipe(map(toShelfCell));
  }

  /**
   * `DELETE /v1/cells/{id}` → `204`. Responde `409` cuando la celda tiene
   * medicamentos asociados (baja lógica rechazada); el mensaje propio lo
   * traduce `locations-error.ts`.
   */
  deleteCell(id: number): Observable<void> {
    return this.http.delete<void>(`${this.cellsUrl}/${id}`);
  }

  /**
   * Celdas activas de estantes activos, para catálogos que referencian
   * `cells.id`. Recorre todas las páginas (`size` 100) antes de aplanar, así
   * nunca trunca el catálogo en silencio.
   */
  listAllCells(): Observable<CellOption[]> {
    return this.list({ page: 1, size: MAX_PAGE_SIZE }).pipe(
      expand((page) =>
        page.page < page.pages ? this.list({ page: page.page + 1, size: MAX_PAGE_SIZE }) : EMPTY,
      ),
      reduce((pages, page) => [...pages, page], [] as ShelfListPage[]),
      map((pages) =>
        pages
          .flatMap((page) => page.items)
          .filter((shelf) => shelf.isActive)
          .flatMap((shelf) =>
            shelf.cells.filter((cell) => cell.isActive).map((cell) => toCellOption(shelf, cell)),
          ),
      ),
    );
  }
}
