/**
 * Dominio del catálogo de ubicaciones (F-011).
 *
 * El backend responde en `snake_case` y los componentes trabajan en `camelCase`.
 * Toda la conversión vive en este módulo (`toLocation()`, `toLocationListPage()`,
 * `toLocationPayload()`), mismo patrón que `users.models.ts`/`drug-types.models.ts`.
 * No se usa `any`.
 *
 * El `PUT` es reemplazo completo de `description` + `shelf` + `section` +
 * `cell` + `is_active` (sin `PATCH`) y `created_at` lo gestiona el servidor:
 * viaja en la respuesta, nunca en el body de escritura.
 */

/** Ubicación tal como lo consume el frontend. */
export interface Location {
  id: number;
  description: string;
  shelf: string;
  section: string;
  cell: string;
  isActive: boolean;
  /** Marca temporal del servidor; se conserva en el `PUT` (S3). */
  createdAt: string;
}

/** Ítem tal como lo devuelve el backend (`snake_case`). */
export interface LocationDto {
  id: number;
  description: string;
  shelf: string;
  section: string;
  cell: string;
  is_active: boolean;
  created_at: string;
}

/** Respuesta paginada de `GET /v1/locations` (`{items, total, page, size, pages}`). */
export interface LocationListResponseDto {
  items: LocationDto[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/** Página de ubicaciones ya mapeada a `camelCase` para los componentes. */
export interface LocationListPage {
  items: Location[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * Parámetros de `GET /v1/locations`: `page` desde 1, `size` 1-100 (def. 20),
 * `search` parcial sobre `description` (máx. 100 caracteres), `is_active` y
 * `sort` (`description`|`created_at`|`is_active`|`id`, prefijo `-` para
 * descendente; por defecto `description`).
 */
export interface LocationListParams {
  page: number;
  size: number;
  search?: string;
  isActive?: boolean;
  sort?: string;
}

/**
 * Body de escritura de `POST` y del `PUT` de reemplazo completo.
 * `is_active` es opcional al crear (por defecto `true`, D-5).
 */
export interface LocationPayloadDto {
  description: string;
  shelf: string;
  section: string;
  cell: string;
  is_active: boolean;
}

/** Entrada del formulario (valores `camelCase` sin recortar). */
export interface LocationFormInput {
  description: string;
  shelf: string;
  section: string;
  cell: string;
  isActive: boolean;
}

/** Convierte un ítem del backend al modelo del frontend. */
export function toLocation(dto: LocationDto): Location {
  return {
    id: dto.id,
    description: dto.description,
    shelf: dto.shelf,
    section: dto.section,
    cell: dto.cell,
    isActive: dto.is_active,
    createdAt: dto.created_at,
  };
}

/** Convierte la página del backend (`snake_case`) a `LocationListPage`. */
export function toLocationListPage(dto: LocationListResponseDto): LocationListPage {
  return {
    items: dto.items.map(toLocation),
    total: dto.total,
    page: dto.page,
    size: dto.size,
    pages: dto.pages,
  };
}

/**
 * Construye el body de escritura: `description`, `shelf`, `section` y `cell`
 * con `trim` y el `is_active` vigente. `id`/`created_at` nunca viajan: los
 * gestiona el servidor.
 */
export function toLocationPayload(input: LocationFormInput): LocationPayloadDto {
  return {
    description: input.description.trim(),
    shelf: input.shelf.trim(),
    section: input.section.trim(),
    cell: input.cell.trim(),
    is_active: input.isActive,
  };
}
