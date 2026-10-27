/**
 * Mensajes de error propios del frontend para visitas (F-015, S12).
 *
 * Todos los textos visibles viven en este módulo. El `detail`, el `code` y el
 * `message` del backend nunca se muestran tal cual. Solo se usan datos
 * máquina-legibles: el estado HTTP, el `code` estable del envelope
 * (`visit_annulled` / `visit_already_annulled`) y `errors[].field`
 * (`snake_case`) del `422`. Mismo patrón que `patients-error.ts`.
 */

import { HttpErrorResponse } from '@angular/common/http';

/** Códigos de conflicto del contrato que la UI necesita distinguir (S7/S8). */
export type VisitsErrorCode = 'visit_annulled' | 'visit_already_annulled';

/** Errores propios bajo cada campo del formulario o del diálogo de anulación. */
export interface VisitsFieldErrors {
  doctorId?: string;
  patientId?: string;
  visitedAt?: string;
  symptoms?: string;
  recommendations?: string;
  medications?: string;
  reason?: string;
}

/** Mensaje general, errores por campo y código de conflicto reconocido. */
export interface VisitsErrorMessage {
  message: string;
  fieldErrors?: VisitsFieldErrors;
  code?: VisitsErrorCode;
}

/** Texto propio del `409 visit_annulled` (una visita anulada no se edita, S8). */
export const VISIT_ANNULLED_MESSAGE = 'La visita está anulada y no se puede editar.';

/** Texto propio del `409 visit_already_annulled` (se anula una sola vez, S7). */
export const VISIT_ALREADY_ANNULLED_MESSAGE = 'La visita ya estaba anulada.';

/** Texto propio del `404` de una visita inexistente o ajena (S9). */
export const VISIT_NOT_FOUND_MESSAGE = 'La visita solicitada ya no existe. Actualiza la lista.';

const GENERIC_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.';
const VALIDATION_MESSAGE = 'Revisa los datos ingresados.';

/** Campo del formulario y texto propio para cada campo conocido del `422`. */
const VALIDATION_FIELDS: Record<string, { key: keyof VisitsFieldErrors; message: string }> = {
  doctor_id: { key: 'doctorId', message: 'Revisa el médico' },
  patient_id: { key: 'patientId', message: 'Revisa el paciente' },
  visited_at: { key: 'visitedAt', message: 'Revisa la fecha y hora de la visita' },
  symptoms: { key: 'symptoms', message: 'Revisa los síntomas' },
  recommendations: { key: 'recommendations', message: 'Revisa las recomendaciones' },
  medications: { key: 'medications', message: 'Revisa los medicamentos' },
  reason: { key: 'reason', message: 'Revisa el motivo de la anulación' },
};

/** Forma mínima del cuerpo de error del backend que nos interesa. */
interface BackendErrorBody {
  code?: unknown;
  errors?: unknown;
}

/**
 * Elige el mensaje de cara al usuario a partir del error HTTP. Nunca incluye
 * token, `detail`, `code`, stack ni URLs internas.
 */
export function mapVisitsError(error: unknown): VisitsErrorMessage {
  if (!(error instanceof HttpErrorResponse)) {
    return { message: GENERIC_MESSAGE };
  }

  switch (error.status) {
    case 0:
      return {
        message: 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      };
    case 400:
      return { message: 'Los datos enviados no son válidos. Revisa el formulario.' };
    case 401:
      return { message: 'Tu sesión expiró. Inicia sesión de nuevo.' };
    case 403:
      return { message: 'No tienes permiso para gestionar visitas.' };
    case 404:
      return { message: VISIT_NOT_FOUND_MESSAGE };
    case 409:
      return mapConflictError(error);
    case 422:
      return mapValidationError(error);
    default:
      return { message: GENERIC_MESSAGE };
  }
}

/** `409`: solo se distinguen los dos códigos estables del contrato. */
function mapConflictError(error: HttpErrorResponse): VisitsErrorMessage {
  const code = errorBody(error).code;

  if (code === 'visit_annulled') {
    return { message: VISIT_ANNULLED_MESSAGE, code: 'visit_annulled' };
  }
  if (code === 'visit_already_annulled') {
    return { message: VISIT_ALREADY_ANNULLED_MESSAGE, code: 'visit_already_annulled' };
  }
  return { message: 'La visita cambió de estado. Actualiza la lista.' };
}

/**
 * `422`: mensaje general más el texto propio de cada campo conocido. Los
 * campos desconocidos se ignoran y el `message` del backend no se expone.
 */
function mapValidationError(error: HttpErrorResponse): VisitsErrorMessage {
  const body = errorBody(error);

  if (!Array.isArray(body.errors)) {
    return { message: VALIDATION_MESSAGE };
  }

  const fieldErrors: VisitsFieldErrors = {};
  for (const entry of body.errors) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const field = (entry as { field?: unknown }).field;
    if (typeof field !== 'string') {
      continue;
    }
    const known = VALIDATION_FIELDS[field];
    if (known !== undefined && fieldErrors[known.key] === undefined) {
      fieldErrors[known.key] = known.message;
    }
  }

  return Object.keys(fieldErrors).length > 0
    ? { message: VALIDATION_MESSAGE, fieldErrors }
    : { message: VALIDATION_MESSAGE };
}

/** Cuerpo del error como objeto, sin asumir una forma concreta. */
function errorBody(error: HttpErrorResponse): BackendErrorBody {
  const body: unknown = error.error;
  return typeof body === 'object' && body !== null ? (body as BackendErrorBody) : {};
}
