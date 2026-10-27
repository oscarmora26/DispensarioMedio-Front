/**
 * Dominio de visitas (F-015).
 *
 * Registro de la atención (RF-08, US-21). El backend responde en `snake_case` y
 * los componentes trabajan en `camelCase`; toda la conversión vive en este
 * módulo (`toVisit()`, `toVisitListPage()`, `toVisitPayload()`,
 * `toAnnulPayload()`), mismo patrón que `patients.models.ts`. Sin `any`.
 *
 * Contrato verificado contra el OpenAPI vivo (`/api/v1/visits`, 2026-10-27):
 * - `VisitListItem` (`{id, doctor{id,name}, patient{id,name,cedula},
 *   visited_at, symptoms, status, created_by}`) alimenta el listado paginado
 *   `{items, total, page, size, pages}`.
 * - `VisitRead` viaja como `additionalProperties: true` **sin esquema
 *   publicado**: por eso `toVisit()` mapea de forma defensiva y tolera que
 *   falten `recommendations`, `medications`, `annulled_at`, `annulled_by` y
 *   `annulment_reason` (S16).
 * - Máquina de estados `REGISTRADA` → `ANULADA` sin vuelta atrás.
 * - `POST` y `PUT` **nunca** llevan `doctor_id`: el backend lo toma del token
 *   del usuario que registra (un MEDICO). Ningún formulario puede elegir
 *   médico, así que `toVisitPayload()` no tiene ramas por rol.
 * - `PUT` es reemplazo completo: la lista de `medications` enviada sustituye a
 *   la anterior.
 *
 * Fechas (S10): el backend asume UTC-4 cuando `visited_at` viaja **sin zona**,
 * así que el payload se envía como `AAAA-MM-DDTHH:mm:ss` sin offset y toda
 * fecha se muestra en `America/Santo_Domingo`, nunca en la zona del navegador.
 * La captura usa calendario Material (fecha) + selects de hora y minuto: el
 * reloj de pared resultante se compone con `combineVisitDateTime()` y se
 * descompone con `toVisitDateTimeParts()` al precargar la edición.
 */

/** Zona única de captura y presentación de fechas de visita (S10). */
export const VISIT_TIME_ZONE = 'America/Santo_Domingo';

/** Santo Domingo no aplica horario de verano: el offset es fijo (S10). */
const SANTO_DOMINGO_OFFSET = '-04:00';

/** Tolerancia de un minuto para considerar una fecha futura (S10). */
const FUTURE_TOLERANCE_MS = 60_000;

/** Marcador visual de ausencia de dato (mismo criterio que F-013/F-014). */
const EMPTY_VALUE = '—';

/** Estado de la visita: nace `REGISTRADA` y puede pasar una sola vez a `ANULADA`. */
export type VisitStatus = 'REGISTRADA' | 'ANULADA';

/** Valores del catálogo cerrado, en el orden del contrato. */
export const VISIT_STATUSES: readonly VisitStatus[] = ['REGISTRADA', 'ANULADA'];

/** Etiqueta capitalizada de cada estado (el body envía el valor en mayúsculas). */
export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  REGISTRADA: 'Registrada',
  ANULADA: 'Anulada',
};

/** Rango permitido de `size` (1-100, contrato) y valor por defecto (20). */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Opciones del paginador del listado. */
export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];

/** Longitud máxima de `q` (≤200, contrato). */
export const QUERY_MAX_LENGTH = 200;

/** Síntomas: obligatorio 3..2000 (contrato). */
export const SYMPTOMS_MIN_LENGTH = 3;
export const SYMPTOMS_MAX_LENGTH = 2000;

/** Recomendaciones: opcional ≤2000 (contrato). */
export const RECOMMENDATIONS_MAX_LENGTH = 2000;

/** Motivo de anulación: obligatorio ≤500 (contrato). */
export const ANNULMENT_REASON_MAX_LENGTH = 500;

/** Indicaciones de un medicamento: opcional ≤255 (contrato). */
export const INSTRUCTIONS_MAX_LENGTH = 255;

/** Longitud máxima de la cantidad en texto (evita valores absurdos). */
export const QUANTITY_MAX_LENGTH = 50;

/** `size` de la búsqueda de servidor de los selectores (S5). */
export const CATALOG_SEARCH_SIZE = 20;

/** Espera del autocompletar antes de emitir el `GET` de catálogo. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Opciones del select de hora de la visita (`00`-`23`). */
export const VISIT_HOUR_OPTIONS: readonly string[] = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, '0'),
);

/** Opciones del select de minuto de la visita (`00`-`59`). */
export const VISIT_MINUTE_OPTIONS: readonly string[] = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, '0'),
);

/** Médico de la visita (nombre para mostrar). */
export interface VisitPerson {
  id: number;
  name: string;
}

/** Paciente de la visita (la cédula viaja con 11 dígitos sin máscara). */
export interface VisitPatient {
  id: number;
  name: string;
  cedula: string;
}

/** Fila del listado (`VisitListItem`). */
export interface VisitListItem {
  id: number;
  doctor: VisitPerson;
  patient: VisitPatient;
  /** Cadena tal como la envía el backend (se formatea al mostrar). */
  visitedAt: string;
  symptoms: string;
  status: VisitStatus;
  /** Usuario que registró la visita, cuando el backend lo informa. */
  createdBy: string | number | null;
}

/** Página de visitas ya mapeada a `camelCase` para los componentes. */
export interface VisitListPage {
  items: VisitListItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/** Medicamento entregado en la visita (`VisitMedicationRead`). */
export interface VisitMedication {
  medicationId: number;
  description: string;
  dose: string;
  quantity: number | string | null;
  instructions: string | null;
}

/** Detalle de una visita (`VisitRead`, sin esquema publicado). */
export interface Visit {
  id: number;
  doctor: VisitPerson;
  patient: VisitPatient;
  visitedAt: string;
  symptoms: string;
  recommendations: string | null;
  status: VisitStatus;
  medications: VisitMedication[];
  createdBy: string | number | null;
  annulledAt: string | null;
  annulledBy: string | number | null;
  annulmentReason: string | null;
}

/** Respuesta de `POST /v1/visits/{id}/annul` (`VisitAnnulResponse`). */
export interface VisitAnnulment {
  id: number;
  status: VisitStatus;
  annulledAt: string | null;
  annulledBy: string | number | null;
  annulmentReason: string | null;
}

/** Referencia a médico o paciente en las respuestas del backend. */
export interface VisitPartyDto {
  id: number;
  name: string;
  /** Solo la trae el paciente (`patient{id,name,cedula}`). */
  cedula?: string;
}

/** Ítem tal como lo devuelve el backend (`snake_case`). */
export interface VisitListItemDto {
  id: number;
  doctor?: VisitPartyDto | null;
  patient?: VisitPartyDto | null;
  visited_at?: string;
  symptoms?: string;
  status?: string;
  created_by?: string | number | null;
}

/** Respuesta paginada de `GET /v1/visits` (`{items, total, page, size, pages}`). */
export interface VisitListResponseDto {
  items: VisitListItemDto[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * Parámetros de `GET /v1/visits`: `page` desde 1, `size` 1-100 (def. 20),
 * `doctor_id` (**solo ADMIN**; un MEDICO no puede filtrar por médico),
 * `patient_id`, `date_from`/`date_to` (date-time sin zona = UTC-4),
 * `medication_id` (fuera de esta entrega), `status`, `q` (≤200, parcial sobre
 * síntomas o recomendaciones) y `sort` (`visited_at|created_at|id|status`, con
 * prefijo `-`; por defecto `-visited_at`).
 *
 * `q` sigue soportado por el contrato y por el servicio, pero el listado ya no
 * lo expone: el humano retiró el campo «Buscar visitas» (2026-10-27), así que
 * los criterios de la UI son estado, rango de fechas, paciente y médico.
 */
export interface VisitListParams {
  page: number;
  size: number;
  doctorId?: number;
  patientId?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: VisitStatus;
  q?: string;
  sort?: string;
}

/** Medicamento entregado tal como lo devuelve el backend (`snake_case`). */
export interface VisitMedicationReadDto {
  medication_id: number;
  description?: string;
  dose?: string;
  quantity?: number | string | null;
  instructions?: string | null;
}

/**
 * Detalle tal como lo devuelve el backend. `VisitRead` no publica esquema
 * (`additionalProperties: true`), así que **todos** los campos salvo `id` se
 * declaran opcionales y se mapean con respaldo (S16).
 */
export interface VisitReadDto {
  id: number;
  doctor?: VisitPartyDto | null;
  patient?: VisitPartyDto | null;
  visited_at?: string;
  symptoms?: string;
  recommendations?: string | null;
  status?: string;
  created_by?: string | number | null;
  medications?: VisitMedicationReadDto[] | null;
  annulled_at?: string | null;
  annulled_by?: string | number | null;
  annulment_reason?: string | null;
}

/** Respuesta de `POST /v1/visits/{id}/annul`. */
export interface VisitAnnulResponseDto {
  id: number;
  status?: string;
  annulled_at?: string | null;
  annulled_by?: string | number | null;
  annulment_reason?: string | null;
}

/** Medicamento a enviar en el body (`quantity` numérica o texto). */
export interface VisitMedicationPayloadDto {
  medication_id: number;
  quantity: number | string | null;
  instructions: string | null;
}

/**
 * Body de escritura de `POST` y del `PUT` de reemplazo completo. **No incluye
 * `doctor_id`**: el médico de la visita sale del token (S3/S11).
 */
export interface VisitPayloadDto {
  patient_id: number | null;
  visited_at: string;
  symptoms: string;
  recommendations: string | null;
  medications: VisitMedicationPayloadDto[];
}

/** Motivo de anulación (`POST /v1/visits/{id}/annul`). */
export interface VisitAnnulPayloadDto {
  reason: string;
}

/** Medicamento capturado en el formulario. */
export interface VisitMedicationInput {
  medicationId: number | null;
  /** Texto libre: se normaliza a número cuando aplica. */
  quantity: string;
  instructions: string;
}

/** Entrada del formulario (`camelCase`; `visitedAt` es el reloj de pared capturado). */
export interface VisitFormInput {
  patientId: number | null;
  /** `AAAA-MM-DDTHH:mm` en hora de Santo Domingo (sin zona). */
  visitedAt: string;
  symptoms: string;
  recommendations: string;
  medications: VisitMedicationInput[];
}

/** Convierte un estado del backend al catálogo cerrado (desconocido = REGISTRADA). */
export function toVisitStatus(value: unknown): VisitStatus {
  return value === 'ANULADA' ? 'ANULADA' : 'REGISTRADA';
}

/** Etiqueta visible del estado. */
export function visitStatusLabel(status: VisitStatus): string {
  return VISIT_STATUS_LABELS[status];
}

/** Actor de auditoría (`created_by`/`annulled_by`) tolerante a un campo ausente. */
function toAuditActor(value: unknown): string | number | null {
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

/** Médico de la visita con respaldo para un campo ausente (S16). */
export function toVisitPerson(dto?: VisitPartyDto | null): VisitPerson {
  return {
    id: typeof dto?.id === 'number' ? dto.id : 0,
    name: typeof dto?.name === 'string' ? dto.name : '',
  };
}

/** Paciente de la visita con respaldo para un campo ausente (S16). */
export function toVisitPatient(dto?: VisitPartyDto | null): VisitPatient {
  return {
    id: typeof dto?.id === 'number' ? dto.id : 0,
    name: typeof dto?.name === 'string' ? dto.name : '',
    cedula: typeof dto?.cedula === 'string' ? dto.cedula : '',
  };
}

/** Medicamento entregado, tolerando los campos opcionales ausentes (S16). */
export function toVisitMedication(dto: VisitMedicationReadDto): VisitMedication {
  return {
    medicationId: typeof dto.medication_id === 'number' ? dto.medication_id : 0,
    description: typeof dto.description === 'string' ? dto.description : '',
    dose: typeof dto.dose === 'string' ? dto.dose : '',
    quantity: dto.quantity ?? null,
    instructions: typeof dto.instructions === 'string' ? dto.instructions : null,
  };
}

/** Convierte una fila del listado del backend al modelo del frontend. */
export function toVisitListItem(dto: VisitListItemDto): VisitListItem {
  return {
    id: dto.id,
    doctor: toVisitPerson(dto.doctor),
    patient: toVisitPatient(dto.patient),
    visitedAt: typeof dto.visited_at === 'string' ? dto.visited_at : '',
    symptoms: typeof dto.symptoms === 'string' ? dto.symptoms : '',
    status: toVisitStatus(dto.status),
    createdBy: toAuditActor(dto.created_by),
  };
}

/** Convierte la página del backend (`snake_case`) a `VisitListPage`. */
export function toVisitListPage(dto: VisitListResponseDto): VisitListPage {
  return {
    items: Array.isArray(dto.items) ? dto.items.map(toVisitListItem) : [],
    total: dto.total,
    page: dto.page,
    size: dto.size,
    pages: dto.pages,
  };
}

/** Convierte el detalle del backend (`VisitRead`) al modelo del frontend (S16). */
export function toVisit(dto: VisitReadDto): Visit {
  return {
    id: dto.id,
    doctor: toVisitPerson(dto.doctor),
    patient: toVisitPatient(dto.patient),
    visitedAt: typeof dto.visited_at === 'string' ? dto.visited_at : '',
    symptoms: typeof dto.symptoms === 'string' ? dto.symptoms : '',
    recommendations: typeof dto.recommendations === 'string' ? dto.recommendations : null,
    status: toVisitStatus(dto.status),
    medications: Array.isArray(dto.medications) ? dto.medications.map(toVisitMedication) : [],
    createdBy: toAuditActor(dto.created_by),
    annulledAt: typeof dto.annulled_at === 'string' ? dto.annulled_at : null,
    annulledBy: toAuditActor(dto.annulled_by),
    annulmentReason: typeof dto.annulment_reason === 'string' ? dto.annulment_reason : null,
  };
}

/** Convierte la respuesta de anulación al modelo del frontend. */
export function toVisitAnnulment(dto: VisitAnnulResponseDto): VisitAnnulment {
  return {
    id: dto.id,
    status: toVisitStatus(dto.status),
    annulledAt: typeof dto.annulled_at === 'string' ? dto.annulled_at : null,
    annulledBy: toAuditActor(dto.annulled_by),
    annulmentReason: typeof dto.annulment_reason === 'string' ? dto.annulment_reason : null,
  };
}

/**
 * Construye el body de escritura:
 * - **Sin `doctor_id`**: el médico de la visita lo toma el backend del token
 *   del usuario que registra, así que ningún formulario puede elegirlo (S3).
 * - `visited_at` normalizado a `AAAA-MM-DDTHH:mm:ss` **sin zona** (S10).
 * - `symptoms` recortado; `recommendations` recortadas o `null` si quedan
 *   vacías.
 * - `medications` normalizados y sin filas vacías; la lista enviada sustituye
 *   a la anterior en el `PUT` (S4).
 */
export function toVisitPayload(input: VisitFormInput): VisitPayloadDto {
  const recommendations = input.recommendations.trim();
  const medications = input.medications
    .filter((medication) => medication.medicationId !== null)
    .map((medication) => {
      const instructions = medication.instructions.trim();

      return {
        medication_id: medication.medicationId as number,
        quantity: normalizeQuantity(medication.quantity),
        instructions: instructions.length > 0 ? instructions : null,
      };
    });

  return {
    patient_id: input.patientId,
    visited_at: toVisitDateTime(input.visitedAt),
    symptoms: input.symptoms.trim(),
    recommendations: recommendations.length > 0 ? recommendations : null,
    medications,
  };
}

/** Construye el body de anulación con el motivo recortado (S7). */
export function toAnnulPayload(reason: string): VisitAnnulPayloadDto {
  return { reason: reason.trim() };
}

/** Cantidad numérica positiva como número; el resto del texto viaja como texto. */
export function normalizeQuantity(value: string | null | undefined): number | string | null {
  const text = (value ?? '').trim();

  if (text.length === 0) {
    return null;
  }
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    return numeric > 0 ? numeric : text;
  }
  return text;
}

/** Normaliza el texto de fecha: quita espacios y admite el separador de espacio. */
function normalizeDateTimeText(value: string): string {
  return value.trim().replace(' ', 'T');
}

/** `true` cuando el texto ya declara zona (`Z`, `+HH:MM` o `-HHMM`). */
function hasExplicitOffset(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

/**
 * Interpreta el valor como instante: si viene sin zona se asume UTC-4, que es
 * exactamente lo que hace el backend con `visited_at` (S10).
 */
function parseVisitInstant(value: string | null | undefined): Date | null {
  const text = normalizeDateTimeText(value ?? '');

  if (text.length === 0) {
    return null;
  }

  const iso = hasExplicitOffset(text) ? text : `${text}${SANTO_DOMINGO_OFFSET}`;
  const milliseconds = Date.parse(iso);

  return Number.isNaN(milliseconds) ? null : new Date(milliseconds);
}

const NAIVE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: VISIT_TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const DISPLAY_FORMATTER = new Intl.DateTimeFormat('es-DO', {
  timeZone: VISIT_TIME_ZONE,
  hour12: false,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Parte numérica de la fecha/hora ya proyectada a `America/Santo_Domingo`. */
function santoDomingoParts(value: Date): Record<string, string> {
  const parts: Record<string, string> = {};

  for (const part of NAIVE_FORMATTER.formatToParts(value)) {
    parts[part.type] = part.value;
  }
  // `en-CA` puede devolver «24» a medianoche con `hour12: false`.
  if (parts['hour'] === '24') {
    parts['hour'] = '00';
  }
  return parts;
}

/**
 * Reloj de pared de Santo Domingo (`AAAA-MM-DDTHH:mm:ss`), el formato que el
 * backend interpreta como UTC-4 cuando viaja sin zona (S10).
 */
export function toNaiveDateTime(value: Date): string {
  const parts = santoDomingoParts(value);

  return `${parts['year']}-${parts['month']}-${parts['day']}T${parts['hour']}:${parts['minute']}:${parts['second']}`;
}

/**
 * Normaliza un valor de captura al `visited_at` del contrato: sin zona y con
 * segundos. Un valor con zona se convierte antes al reloj de Santo Domingo.
 */
export function toVisitDateTime(value: string): string {
  const text = normalizeDateTimeText(value);

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    return `${text}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(text)) {
    return text;
  }

  const instant = parseVisitInstant(text);

  return instant === null ? text : toNaiveDateTime(instant);
}

/** Reloj de pared de Santo Domingo (`AAAA-MM-DDTHH:mm`) de un valor guardado. */
export function toDateTimeLocalValue(value: string | null | undefined): string {
  const instant = parseVisitInstant(value);

  return instant === null ? '' : toNaiveDateTime(instant).slice(0, 16);
}

/**
 * Descompone un `visited_at` en las tres piezas del capturador: la fecha del
 * calendario (en el día de Santo Domingo, sin desplazar el día si el navegador
 * vive en otra zona) y la hora y el minuto ya en texto.
 */
export function toVisitDateTimeParts(value: string | null | undefined): {
  date: Date | null;
  hour: string;
  minute: string;
} {
  const local = toDateTimeLocalValue(value);

  if (local.length === 0) {
    return { date: null, hour: '', minute: '' };
  }

  const [datePart, timePart = ''] = local.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour = '', minute = ''] = timePart.split(':');
  const date = new Date(year, month - 1, day);

  return {
    date: Number.isNaN(date.getTime()) ? null : date,
    hour,
    minute,
  };
}

/**
 * `AAAA-MM-DD` del calendario que muestra el datepicker. Usa los componentes
 * locales del `Date` elegido (el día que el usuario ve), no la zona del
 * backend, para no desplazar la fecha del filtro ni la de la visita.
 */
export function formatVisitDateValue(value: Date | null | undefined): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return '';
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Compone el reloj de pared de la visita (`AAAA-MM-DDTHH:mm`) a partir de la
 * fecha del calendario y de los selects de hora y minuto. Devuelve `''` cuando
 * falta alguna pieza, para que el validador `required` decida.
 */
export function combineVisitDateTime(
  date: Date | null | undefined,
  hour: string,
  minute: string,
): string {
  const datePart = formatVisitDateValue(date);
  const hourPart = hour.trim();
  const minutePart = minute.trim();

  if (
    datePart.length === 0 ||
    !/^(?:[01]\d|2[0-3])$/.test(hourPart) ||
    !/^[0-5]\d$/.test(minutePart)
  ) {
    return '';
  }

  return `${datePart}T${hourPart}:${minutePart}`;
}

/** Fecha y hora visibles, siempre en `America/Santo_Domingo` (S10). */
export function formatVisitDateTime(value: string | null | undefined): string {
  const instant = parseVisitInstant(value);

  return instant === null ? EMPTY_VALUE : DISPLAY_FORMATTER.format(instant);
}

/**
 * `true` cuando la fecha capturada está en el futuro, con un minuto de
 * tolerancia (S10). Un valor vacío o ilegible no es futuro: eso lo resuelve el
 * validador `required`.
 */
export function isFutureVisitDateTime(value: string, now: Date = new Date()): boolean {
  const instant = parseVisitInstant(value);

  return instant === null ? false : instant.getTime() > now.getTime() + FUTURE_TOLERANCE_MS;
}

/** Inicio del día elegido en un filtro de fecha (sin zona = UTC-4). */
export function startOfDayDateTime(date: string): string {
  return `${date.trim()}T00:00:00`;
}

/** Fin del día elegido en un filtro de fecha (sin zona = UTC-4). */
export function endOfDayDateTime(date: string): string {
  return `${date.trim()}T23:59:59`;
}
