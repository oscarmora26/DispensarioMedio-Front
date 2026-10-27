/**
 * Dominio del catálogo de medicamentos (F-012).
 *
 * El backend responde en `snake_case` y los componentes trabajan en `camelCase`.
 * Toda la conversión vive en este módulo (`toMedication()`, `toMedicationListPage()`,
 * `toMedicationPayload()`), mismo patrón que `users.models.ts`/`drug-types.models.ts`.
 * No se usa `any`.
 *
 * Contrato real del backend: `MedicationRead`, `MedicationCreate` y
 * `MedicationUpdate` llevan `cell_id` (no `location_id`) y **no** devuelven
 * `created_at`; por eso `createdAt` es opcional y ninguna vista lo muestra.
 * `cell_id` apunta a `cells.id` del catálogo de ubicaciones (`/v1/shelves`, F-011).
 *
 * El `PUT` es reemplazo completo de `description` + `drug_type_id` + `brand_id` +
 * `cell_id` + `dose` + `is_active` (sin `PATCH`): reactivar un medicamento
 * reenvía el registro completo con `is_active: true`.
 *
 * El backend solo devuelve IDs de los catálogos referenciados (D-4); los nombres
 * se resuelven en el frontend a partir de las listas de drug-types, brands y
 * celdas (cargadas una vez por el listado y el formulario).
 */

/** Medicamento tal como lo consume el frontend. */
export interface Medication {
  id: number;
  description: string;
  drugTypeId: number;
  brandId: number;
  /** `cells.id` del catálogo de ubicaciones. */
  cellId: number;
  dose: string;
  isActive: boolean;
  /** Opcional: `MedicationRead` ya no envía `created_at`. No se muestra. */
  createdAt?: string;
}

/** Ítem tal como lo devuelve el backend (`snake_case`). */
export interface MedicationDto {
  id: number;
  description: string;
  drug_type_id: number;
  brand_id: number;
  cell_id: number;
  dose: string;
  is_active: boolean;
  /** Opcional: el contrato de lectura ya no lo incluye. */
  created_at?: string;
}

/** Respuesta paginada de `GET /v1/medications` (`{items, total, page, size, pages}`). */
export interface MedicationListResponseDto {
  items: MedicationDto[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/** Página de medicamentos ya mapeada a `camelCase` para los componentes. */
export interface MedicationListPage {
  items: Medication[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * Parámetros de `GET /v1/medications`: `page` desde 1, `size` 1-100 (def. 20),
 * `search` parcial sobre `description` (máx. 100 caracteres), `is_active`,
 * `drug_type_id`, `brand_id`, `cell_id` y `sort`
 * (`description`|`dose`|`drug_type_id`|`brand_id`|`cell_id`|`created_at`|
 * `is_active`|`id`, prefijo `-` para descendente; por defecto `description`).
 */
export interface MedicationListParams {
  page: number;
  size: number;
  search?: string;
  isActive?: boolean;
  drugTypeId?: number;
  brandId?: number;
  cellId?: number;
  sort?: string;
}

/**
 * Body de escritura de `POST` y del `PUT` de reemplazo completo.
 * `is_active` es opcional al crear (por defecto `true`, D-5).
 */
export interface MedicationPayloadDto {
  description: string;
  drug_type_id: number;
  brand_id: number;
  cell_id: number;
  dose: string;
  is_active: boolean;
}

/** Entrada del formulario (valores `camelCase` sin recortar). */
export interface MedicationFormInput {
  description: string;
  drugTypeId: number;
  brandId: number;
  cellId: number;
  dose: string;
  isActive: boolean;
}

/** Opción de catálogo para selects del formulario. */
export interface CatalogOption {
  id: number;
  label: string;
}

/** Convierte un ítem del backend al modelo del frontend. */
export function toMedication(dto: MedicationDto): Medication {
  return {
    id: dto.id,
    description: dto.description,
    drugTypeId: dto.drug_type_id,
    brandId: dto.brand_id,
    cellId: dto.cell_id,
    dose: dto.dose,
    isActive: dto.is_active,
    createdAt: dto.created_at,
  };
}

/** Convierte la página del backend (`snake_case`) a `MedicationListPage`. */
export function toMedicationListPage(dto: MedicationListResponseDto): MedicationListPage {
  return {
    items: dto.items.map(toMedication),
    total: dto.total,
    page: dto.page,
    size: dto.size,
    pages: dto.pages,
  };
}

/**
 * Construye el body de escritura: `description` y `dose` con `trim` y el
 * `is_active` vigente. `id`/`created_at` nunca viajan: los gestiona el
 * servidor.
 */
export function toMedicationPayload(input: MedicationFormInput): MedicationPayloadDto {
  return {
    description: input.description.trim(),
    drug_type_id: input.drugTypeId,
    brand_id: input.brandId,
    cell_id: input.cellId,
    dose: input.dose.trim(),
    is_active: input.isActive,
  };
}
