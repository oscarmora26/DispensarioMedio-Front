/**
 * Dominio del catálogo de médicos (F-014).
 *
 * CRUD del catálogo de médicos (RF-04, US-15): el backend responde en
 * `snake_case` y los componentes trabajan en `camelCase`. Toda la conversión
 * vive en este módulo (`toDoctor()`, `toDoctorListPage()`, `toDoctorPayload()`),
 * mismo patrón que `patients.models.ts` / `drug-types.models.ts`. Sin `any`.
 *
 * Contrato verificado contra el OpenAPI vivo (`/api/v1/doctors`):
 * - `DoctorRead` son **seis campos planos** (`id`, `name`, `cedula`,
 *   `lab_shift`, `specialty`, `is_active`) más `user`
 *   (`DoctorUserRead { id, username, is_active } | null`), la cuenta asociada
 *   en **solo lectura**. **No** incluye `created_at` aunque el listado lo
 *   acepte como criterio de orden.
 * - `POST` exige `name` + `cedula` (11 dígitos, única) + `lab_shift` +
 *   `specialty`; `is_active` es opcional (def. `true`).
 * - `PUT` es reemplazo completo de `name` + `cedula` + `lab_shift` +
 *   `specialty` + `is_active` y **no** toca la asociación con usuarios: `user`
 *   nunca viaja en el body.
 * - `lab_shift` es texto ≤50 en el contrato; la UI ofrece el catálogo cerrado
 *   `MATUTINA|VESPERTINA|NOCTURNA|MIXTA` y conserva como opción extra cualquier
 *   valor no canónico que ya estuviera almacenado (S4).
 * - La cédula viaja siempre como 11 dígitos **sin** máscara; la máscara
 *   `XXX-XXXXXXX-X` (3-7-1) es solo de captura y presentación (S3).
 */

/**
 * Helpers de la máscara de cédula. Se reexportan desde el catálogo de
 * pacientes en lugar de copiarlos: la regla `XXX-XXXXXXX-X` (3-7-1) es la
 * misma de F-013 CA-03 y una copia divergente rompería la validación de los
 * dos módulos. Único punto de verdad (`patients.models.ts`).
 */
import {
  CEDULA_DIGITS,
  cedulaDigits,
  formatCedula,
  isCedulaComplete,
} from '../patients/patients.models';

export { CEDULA_DIGITS, cedulaDigits, formatCedula, isCedulaComplete };

/** Catálogo cerrado de tandas (S4). */
export type LabShift = 'MATUTINA' | 'VESPERTINA' | 'NOCTURNA' | 'MIXTA';

/** Valores canónicos del catálogo, en el orden en que se ofrecen. */
export const LAB_SHIFTS: readonly LabShift[] = ['MATUTINA', 'VESPERTINA', 'NOCTURNA', 'MIXTA'];

/** Etiqueta capitalizada de cada tanda (el body envía el valor en mayúsculas). */
export const LAB_SHIFT_LABELS: Record<LabShift, string> = {
  MATUTINA: 'Matutina',
  VESPERTINA: 'Vespertina',
  NOCTURNA: 'Nocturna',
  MIXTA: 'Mixta',
};

/** Longitud máxima del nombre (1..150, contrato). */
export const NAME_MAX_LENGTH = 150;

/** Longitud máxima de la especialidad (1..100, contrato). */
export const SPECIALTY_MAX_LENGTH = 100;

/** Longitud máxima de la tanda en el contrato (1..50). */
export const LAB_SHIFT_MAX_LENGTH = 50;

/** Longitud máxima del parámetro `search` del listado (S1). */
export const SEARCH_MAX_LENGTH = 100;

/** Cuenta asociada al médico, en solo lectura (S6). */
export interface DoctorUser {
  id: number;
  username: string;
  isActive: boolean;
}

/** Médico tal como lo consume el frontend. */
export interface Doctor {
  id: number;
  name: string;
  /** Once dígitos sin máscara (la UI aplica `formatCedula()`). */
  cedula: string;
  /**
   * Tanda tal como la devuelve el contrato (`MATUTINA|…`). Se declara `string`
   * y no `LabShift` a propósito: un registro antiguo puede traer un valor no
   * canónico y no debe perderse ni romper el tipo al editar (S4).
   */
  labShift: string;
  specialty: string;
  isActive: boolean;
  /** `null` cuando el médico no tiene cuenta asociada (caso válido, S6). */
  user: DoctorUser | null;
}

/** Cuenta asociada tal como la devuelve el backend (`snake_case`). */
export interface DoctorUserDto {
  id: number;
  username: string;
  is_active: boolean;
}

/** Ítem tal como lo devuelve el backend (`snake_case`). */
export interface DoctorDto {
  id: number;
  name: string;
  cedula: string;
  lab_shift: string;
  specialty: string;
  is_active: boolean;
  /** `user` no está en `required`: se mapea defensivamente con `?? null`. */
  user?: DoctorUserDto | null;
}

/** Respuesta paginada de `GET /v1/doctors` (`{items, total, page, size, pages}`). */
export interface DoctorListResponseDto {
  items: DoctorDto[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/** Página de médicos ya mapeada a `camelCase` para los componentes. */
export interface DoctorListPage {
  items: Doctor[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * Parámetros de `GET /v1/doctors`: `page` desde 1, `size` 1-100 (def. 20),
 * `search` parcial y case-insensitive sobre `name` o `cedula` (máx. 100),
 * `is_active` y `sort` (`name|cedula|lab_shift|specialty|created_at|is_active|
 * id`, prefijo `-` para descendente; por defecto `name`).
 */
export interface DoctorListParams {
  page: number;
  size: number;
  search?: string;
  isActive?: boolean;
  sort?: string;
}

/**
 * Body de escritura de `POST` y del `PUT` de reemplazo completo: la cédula va
 * sin máscara y la asociación con usuarios (`user`) nunca viaja en el body.
 */
export interface DoctorPayloadDto {
  name: string;
  cedula: string;
  lab_shift: string;
  specialty: string;
  is_active: boolean;
}

/** Entrada del formulario (`camelCase`, con la cédula tal como se capturó). */
export interface DoctorFormInput {
  name: string;
  /** Puede llegar con máscara: el body la descarta. */
  cedula: string;
  labShift: string;
  specialty: string;
  isActive: boolean;
}

/** Etiqueta visible de una tanda: capitalizada si es canónica, cruda si no (S4). */
export function labShiftLabel(value: string): string {
  const known = LAB_SHIFTS.find((shift) => shift === value);

  return known === undefined ? value : LAB_SHIFT_LABELS[known];
}

/**
 * Opciones del `mat-select` cerrado de tanda (S4): las cuatro canónicas y,
 * cuando el registro precargado trae un valor no canónico, ese valor como
 * opción extra para no perderlo al guardar.
 */
export function labShiftOptions(stored?: string | null): readonly string[] {
  const value = (stored ?? '').trim();

  if (value.length === 0 || LAB_SHIFTS.some((shift) => shift === value)) {
    return LAB_SHIFTS;
  }
  return [...LAB_SHIFTS, value];
}

/** Convierte un ítem del backend al modelo del frontend. */
export function toDoctor(dto: DoctorDto): Doctor {
  return {
    id: dto.id,
    name: dto.name,
    cedula: dto.cedula,
    labShift: dto.lab_shift,
    specialty: dto.specialty,
    isActive: dto.is_active,
    user: toDoctorUser(dto.user),
  };
}

/** Cuenta asociada en solo lectura, o `null` cuando el médico no tiene (S6). */
function toDoctorUser(dto: DoctorUserDto | null | undefined): DoctorUser | null {
  if (dto === null || dto === undefined) {
    return null;
  }
  return { id: dto.id, username: dto.username, isActive: dto.is_active };
}

/** Convierte la página del backend (`snake_case`) a `DoctorListPage`. */
export function toDoctorListPage(dto: DoctorListResponseDto): DoctorListPage {
  return {
    items: dto.items.map(toDoctor),
    total: dto.total,
    page: dto.page,
    size: dto.size,
    pages: dto.pages,
  };
}

/**
 * Construye el body de escritura: `name`, `lab_shift` y `specialty` recortados,
 * cédula con los 11 dígitos sin máscara e `is_active` vigente. `id`,
 * `created_at` y `user` nunca viajan.
 */
export function toDoctorPayload(input: DoctorFormInput): DoctorPayloadDto {
  return {
    name: input.name.trim(),
    cedula: cedulaDigits(input.cedula),
    lab_shift: input.labShift.trim(),
    specialty: input.specialty.trim(),
    is_active: input.isActive,
  };
}
