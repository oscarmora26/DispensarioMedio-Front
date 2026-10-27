/**
 * Dominio del catálogo de pacientes (F-013).
 *
 * CRUD del catálogo de pacientes (RF-05, US-16): el backend responde en
 * `snake_case` y los componentes trabajan en `camelCase`. Toda la conversión
 * vive en este módulo (`toPatient()`, `toPatientListPage()`,
 * `toPatientPayload()`), mismo patrón que `drug-types.models.ts`. Sin `any`.
 *
 * Contrato verificado contra el OpenAPI vivo (`/api/v1/patients`):
 * - `PatientRead` son **seis campos planos** (`id`, `name`, `cedula`,
 *   `carnet`, `patient_type`, `is_active`): **no** incluye `created_at`
 *   aunque el listado lo acepte como criterio de orden.
 * - `POST` exige `name` + `cedula` + `patient_type`; `carnet` es opcional
 *   (obligatorio para `ESTUDIANTE`) y `is_active` es opcional (def. `true`).
 * - `PUT` es reemplazo completo de `name` + `cedula` + `patient_type` +
 *   `is_active`; un `carnet` vacío se envía como `null` y **borra** el
 *   almacenado (el backend trata `null` y ausente de la misma forma).
 * - La cédula viaja siempre como 11 dígitos **sin** máscara; la máscara
 *   `XXX-XXXXXXX-X` (3-7-1) es solo de captura y presentación.
 */

/** Catálogo cerrado de tipos de paciente (S5). */
export type PatientType = 'ESTUDIANTE' | 'EMPLEADO' | 'PROFESOR' | 'OTROS';

/** Valores del catálogo cerrado, en el orden del contrato. */
export const PATIENT_TYPES: readonly PatientType[] = [
  'ESTUDIANTE',
  'EMPLEADO',
  'PROFESOR',
  'OTROS',
];

/** Etiqueta capitalizada de cada tipo (el body envía el valor en mayúsculas). */
export const PATIENT_TYPE_LABELS: Record<PatientType, string> = {
  ESTUDIANTE: 'Estudiante',
  EMPLEADO: 'Empleado',
  PROFESOR: 'Profesor',
  OTROS: 'Otros',
};

/** Dígitos exactos de una cédula (S3). */
export const CEDULA_DIGITS = 11;

/** Longitud máxima del nombre (1..150, contrato). */
export const NAME_MAX_LENGTH = 150;

/** Longitud máxima del carnet (≤50, contrato). */
export const CARNET_MAX_LENGTH = 50;

/** Longitud máxima del parámetro `search` del listado (S1). */
export const SEARCH_MAX_LENGTH = 100;

/** Paciente tal como lo consume el frontend. */
export interface Patient {
  id: number;
  name: string;
  /** Once dígitos sin máscara (la UI aplica `formatCedula()`). */
  cedula: string;
  /** `null` cuando el paciente no tiene carnet. */
  carnet: string | null;
  patientType: PatientType;
  isActive: boolean;
}

/** Ítem tal como lo devuelve el backend (`snake_case`). */
export interface PatientDto {
  id: number;
  name: string;
  cedula: string;
  carnet: string | null;
  patient_type: PatientType;
  is_active: boolean;
}

/** Respuesta paginada de `GET /v1/patients` (`{items, total, page, size, pages}`). */
export interface PatientListResponseDto {
  items: PatientDto[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/** Página de pacientes ya mapeada a `camelCase` para los componentes. */
export interface PatientListPage {
  items: Patient[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * Parámetros de `GET /v1/patients`: `page` desde 1, `size` 1-100 (def. 20),
 * `search` parcial y case-insensitive sobre `name`, `cedula` o `carnet`
 * (máx. 100 caracteres), `is_active` y `sort`
 * (`name|cedula|created_at|is_active|id`, prefijo `-` para descendente; por
 * defecto `name`).
 */
export interface PatientListParams {
  page: number;
  size: number;
  search?: string;
  isActive?: boolean;
  sort?: string;
}

/**
 * Body de escritura de `POST` y del `PUT` de reemplazo completo: la cédula va
 * sin máscara y `carnet` viaja como `null` cuando el paciente no tiene (lo que
 * borra el almacenado en el `PUT`).
 */
export interface PatientPayloadDto {
  name: string;
  cedula: string;
  patient_type: PatientType;
  carnet: string | null;
  is_active: boolean;
}

/** Entrada del formulario (`camelCase`, con la cédula tal como se capturó). */
export interface PatientFormInput {
  name: string;
  /** Puede llegar con máscara: el body la descarta. */
  cedula: string;
  /** Vacío = sin carnet (se envía `null`). */
  carnet: string;
  patientType: PatientType;
  isActive: boolean;
}

/** Convierte un ítem del backend al modelo del frontend. */
export function toPatient(dto: PatientDto): Patient {
  return {
    id: dto.id,
    name: dto.name,
    cedula: dto.cedula,
    carnet: dto.carnet,
    patientType: dto.patient_type,
    isActive: dto.is_active,
  };
}

/** Convierte la página del backend (`snake_case`) a `PatientListPage`. */
export function toPatientListPage(dto: PatientListResponseDto): PatientListPage {
  return {
    items: dto.items.map(toPatient),
    total: dto.total,
    page: dto.page,
    size: dto.size,
    pages: dto.pages,
  };
}

/**
 * Construye el body de escritura: `name` recortado, cédula con los 11 dígitos
 * sin máscara, `patient_type` en mayúsculas, `carnet` recortado o `null` si
 * quedó vacío, e `is_active` vigente. `id`/`created_at` nunca viajan.
 */
export function toPatientPayload(input: PatientFormInput): PatientPayloadDto {
  const carnet = input.carnet.trim();

  return {
    name: input.name.trim(),
    cedula: cedulaDigits(input.cedula),
    patient_type: input.patientType,
    carnet: carnet.length > 0 ? carnet : null,
    is_active: input.isActive,
  };
}

/** Descarta todo lo que no sea dígito y recorta a los 11 de la cédula (S3). */
export function cedulaDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '').slice(0, CEDULA_DIGITS);
}

/**
 * Aplica la máscara `XXX-XXXXXXX-X` (3-7-1) a los dígitos disponibles: los
 * bloques vacíos no dejan separadores colgando (`'1234'` → `'123-4'`), así el
 * valor parcial se puede seguir escribiendo y reformatear es idempotente.
 */
export function formatCedula(value: string | null | undefined): string {
  const digits = cedulaDigits(value);
  const blocks = [digits.slice(0, 3), digits.slice(3, 10), digits.slice(10, CEDULA_DIGITS)];

  return blocks.filter((block) => block.length > 0).join('-');
}

/** `true` solo con los 11 dígitos completos tras descartar separadores (S3). */
export function isCedulaComplete(value: string | null | undefined): boolean {
  return cedulaDigits(value).length === CEDULA_DIGITS;
}
