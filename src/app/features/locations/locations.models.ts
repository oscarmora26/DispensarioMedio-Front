/**
 * Dominio del catálogo de ubicaciones (F-011), alineado al contrato vivo del
 * backend: `/api/v1/shelves` (estantes) y `/api/v1/cells` (celdas con CRUD
 * propio).
 *
 * Una «ubicación» es el **estante** (`Shelf`); sus celdas (`ShelfCell`) se
 * leen anidadas en `ShelfRead`, pero se escriben en su propio recurso
 * `/v1/cells`. `medications.cell_id` apunta a `cells.id`, así que la celda
 * —no el estante— es lo que referencia un medicamento.
 *
 * El backend responde en `snake_case` y los componentes trabajan en
 * `camelCase`. Toda la conversión vive en este módulo (`toShelf()`,
 * `toShelfCell()`, `toShelfListPage()`, `toShelfPayload()`,
 * `toCellPayload()`, `toCellOption()`). No se usa `any`.
 *
 * Reglas de contrato que este mapeo respeta:
 * - `ShelfCreate`/`ShelfUpdate` son `additionalProperties: false` y **no**
 *   admiten `cells`: mandar `cells` en el body del estante responde `422`.
 * - `CellCreate`/`CellUpdate` son `additionalProperties: false` y exigen
 *   `shelf_id`; el `PUT` de una celda la reemplaza por completo y también
 *   permite moverla a otro estante.
 * - `ShelfRead.cells` viaja en las respuestas (`CellRead[]`) pero no es un
 *   campo requerido: se mapea de forma defensiva (`dto.cells ?? []`).
 * - `description` es `string|null` en el contrato: una cadena vacía se
 *   normaliza a `null` en el body.
 */

/** Celda tal como la consume el frontend (`CellRead` mapeada). */
export interface ShelfCell {
  id: number;
  shelfId: number;
  section: string;
  cell: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Estante (la «ubicación» del módulo) con sus celdas anidadas de lectura. */
export interface Shelf {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  cells: ShelfCell[];
}

/**
 * Opción de catálogo para selectores que referencian `cells.id` (medicamentos).
 * `label` = `«estante · tramo / celda»`, por ejemplo `Estante A · tramo 1 / celda 3`.
 */
export interface CellOption {
  id: number;
  label: string;
}

/** Celda tal como la devuelve el backend (`snake_case`). */
export interface ShelfCellDto {
  id: number;
  shelf_id: number;
  section: string;
  cell: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Estante tal como lo devuelve el backend (`snake_case`). */
export interface ShelfDto {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  cells?: ShelfCellDto[];
}

/** Respuesta paginada de `GET /v1/shelves` (`{items, total, page, size, pages}`). */
export interface ShelfListResponseDto {
  items: ShelfDto[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/** Página de estantes ya mapeada a `camelCase` para los componentes. */
export interface ShelfListPage {
  items: Shelf[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * Parámetros de `GET /v1/shelves`: `page` desde 1, `size` 1-100 (def. 20),
 * `search` parcial (máx. 100 caracteres), `is_active` y `sort` (`name` por
 * defecto, prefijo `-` para descendente).
 */
export interface ShelfListParams {
  page: number;
  size: number;
  search?: string;
  isActive?: boolean;
  sort?: string;
}

/**
 * Body de `POST /v1/shelves` y del `PUT /v1/shelves/{id}`.
 * `additionalProperties: false`: `cells` ya **no** viaja aquí (responde `422`).
 */
export interface ShelfPayloadDto {
  name: string;
  description: string | null;
  is_active: boolean;
}

/** Body de `POST /v1/cells` y del `PUT /v1/cells/{id}` (`CellCreate`/`CellUpdate`). */
export interface CellPayloadDto {
  section: string;
  cell: string;
  description: string | null;
  shelf_id: number;
  is_active: boolean;
}

/** Estante tal como lo captura el formulario (textos sin recortar). */
export interface ShelfWriteInput {
  name: string;
  description: string;
  isActive: boolean;
}

/** Celda tal como la captura una fila del editor (textos sin recortar). */
export interface CellWriteInput {
  section: string;
  cell: string;
  description: string;
  isActive: boolean;
}

/** Convierte una celda del backend al modelo del frontend. */
export function toShelfCell(dto: ShelfCellDto): ShelfCell {
  return {
    id: dto.id,
    shelfId: dto.shelf_id,
    section: dto.section,
    cell: dto.cell,
    description: dto.description,
    isActive: dto.is_active,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

/**
 * Convierte un estante del backend al modelo del frontend. `cells` no es
 * requerido en `ShelfRead`: se mapea defensivamente a `[]`.
 */
export function toShelf(dto: ShelfDto): Shelf {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    isActive: dto.is_active,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    cells: (dto.cells ?? []).map(toShelfCell),
  };
}

/** Convierte la página del backend (`snake_case`) a `ShelfListPage`. */
export function toShelfListPage(dto: ShelfListResponseDto): ShelfListPage {
  return {
    items: dto.items.map(toShelf),
    total: dto.total,
    page: dto.page,
    size: dto.size,
    pages: dto.pages,
  };
}

/** `description` opcional: recorta y convierte la cadena vacía en `null`. */
function toOptionalText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();

  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Construye el body del estante con `trim` en el nombre y `null` en la
 * descripción vacía. Ni `cells` ni `id`/`created_at` viajan: las celdas se
 * crean por `/v1/cells` y las marcas de tiempo las gestiona el servidor.
 */
export function toShelfPayload(input: ShelfWriteInput): ShelfPayloadDto {
  return {
    name: input.name.trim(),
    description: toOptionalText(input.description),
    is_active: input.isActive,
  };
}

/**
 * Construye el body de una celda con `trim` en `section`/`cell`, `null` en la
 * descripción vacía y el `shelf_id` del estante al que pertenece.
 */
export function toCellPayload(input: CellWriteInput, shelfId: number): CellPayloadDto {
  return {
    section: input.section.trim(),
    cell: input.cell.trim(),
    description: toOptionalText(input.description),
    shelf_id: shelfId,
    is_active: input.isActive,
  };
}

/** Raya con la que se representa «sin datos» en la tabla. */
const EMPTY_PLACEHOLDER = '—';

/**
 * Texto de la columna `cells`: las celdas del estante como `«tramo / celda»`
 * separadas por `« · »` (por ejemplo `A / 1 · A / 2`), o `—` si no tiene.
 */
export function formatCells(cells: ShelfCell[]): string {
  if (cells.length === 0) {
    return EMPTY_PLACEHOLDER;
  }

  return cells.map((cell) => `${cell.section} / ${cell.cell}`).join(' · ');
}

/** Opción de catálogo de una celda concreta de un estante. */
export function toCellOption(shelf: Shelf, cell: ShelfCell): CellOption {
  return { id: cell.id, label: `${shelf.name} · ${cell.section} / ${cell.cell}` };
}
