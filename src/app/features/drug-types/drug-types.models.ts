/**
 * Dominio del catálogo de tipos de fármacos (F-009).
 *
 * Primer catálogo maestro de E2 (RF-04, US-07): el backend responde en
 * `snake_case` y los componentes trabajan en `camelCase`. Toda la conversión
 * vive en este módulo (`toDrugType()`, `toDrugTypeListPage()`,
 * `toDrugTypePayload()`), mismo patrón que `users.models.ts`. No se usa `any`.
 *
 * El `PUT` es reemplazo completo de `description` + `is_active` (sin `PATCH`)
 * y `created_at` lo gestiona el servidor: viaja en la respuesta, nunca en el
 * body de escritura.
 */

/** Tipo de fármaco tal como lo consume el frontend. */
export interface DrugType {
  id: number;
  description: string;
  isActive: boolean;
  /** Marca temporal del servidor; se conserva en el `PUT` (S3). */
  createdAt: string;
}

/** Ítem tal como lo devuelve el backend (`snake_case`). */
export interface DrugTypeDto {
  id: number;
  description: string;
  is_active: boolean;
  created_at: string;
}

/** Respuesta paginada de `GET /v1/drug-types` (`{items, total, page, size, pages}`). */
export interface DrugTypeListResponseDto {
  items: DrugTypeDto[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/** Página de tipos de fármacos ya mapeada a `camelCase` para los componentes. */
export interface DrugTypeListPage {
  items: DrugType[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * Parámetros de `GET /v1/drug-types`: `page` desde 1, `size` 1-100 (def. 20),
 * `search` parcial sobre `description` (máx. 100 caracteres), `is_active` y
 * `sort` (`description`|`created_at`|`is_active`|`id`, prefijo `-` para
 * descendente; por defecto `description`).
 */
export interface DrugTypeListParams {
  page: number;
  size: number;
  search?: string;
  isActive?: boolean;
  sort?: string;
}

/**
 * Body de escritura de `POST` y del `PUT` de reemplazo completo.
 * `is_active` es opcional al crear (por defecto `true`, D-5) y obligatorio
 * para el reemplazo completo del `PUT`.
 */
export interface DrugTypePayloadDto {
  description: string;
  is_active: boolean;
}

/** Entrada del formulario (valores `camelCase` sin recortar). */
export interface DrugTypeFormInput {
  description: string;
  isActive: boolean;
}

/** Convierte un ítem del backend al modelo del frontend. */
export function toDrugType(dto: DrugTypeDto): DrugType {
  return {
    id: dto.id,
    description: dto.description,
    isActive: dto.is_active,
    createdAt: dto.created_at,
  };
}

/** Convierte la página del backend (`snake_case`) a `DrugTypeListPage`. */
export function toDrugTypeListPage(dto: DrugTypeListResponseDto): DrugTypeListPage {
  return {
    items: dto.items.map(toDrugType),
    total: dto.total,
    page: dto.page,
    size: dto.size,
    pages: dto.pages,
  };
}

/**
 * Construye el body de escritura: `description` con `trim` (el validador de
 * longitud ya corrió sobre el valor recortado en el formulario) y el
 * `is_active` vigente. `id`/`created_at` nunca viajan: los gestiona el
 * servidor.
 */
export function toDrugTypePayload(input: DrugTypeFormInput): DrugTypePayloadDto {
  return {
    description: input.description.trim(),
    is_active: input.isActive,
  };
}
