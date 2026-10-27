/**
 * Mensajes de error propios del frontend para médicos (F-014, S9).
 *
 * Todos los textos visibles viven en este módulo. El `detail` y el `message`
 * del backend nunca se muestran tal cual (pueden estar en inglés o revelar
 * detalles internos). Solo se usan datos máquina-legibles:
 * - el estado HTTP;
 * - el `code` estable del envelope (`doctor_has_visits` para el bloqueo de
 *   desactivación, `doctor_exists` para la cédula duplicada), porque el `409`
 *   no rellena `errors[]`;
 * - `errors[].field` (`snake_case`) como respaldo del `409` y en el `422`.
 *
 * Mismo patrón que `patients-error.ts`/`users-error.ts`.
 */

import { HttpErrorResponse } from '@angular/common/http';

/** Errores propios bajo cada campo del formulario de médicos. */
export interface DoctorsFieldErrors {
  name?: string;
  cedula?: string;
  labShift?: string;
  specialty?: string;
}

/** Mensaje general más errores opcionales por campo. */
export interface DoctorsErrorMessage {
  message: string;
  fieldErrors?: DoctorsFieldErrors;
}

/** Forma mínima del cuerpo de error del backend que nos interesa. */
interface BackendErrorBody {
  code?: unknown;
  errors?: unknown;
}

const GENERIC_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.';
const VALIDATION_MESSAGE = 'Revisa los datos ingresados.';
const CEDULA_DUPLICATED = 'Ya existe un médico con esa cédula.';
const HAS_VISITS_MESSAGE = 'No se puede desactivar el médico porque tiene visitas registradas.';

/** Campo del formulario y texto propio para cada campo conocido del `422`. */
const VALIDATION_FIELDS: Record<string, { key: keyof DoctorsFieldErrors; message: string }> = {
  name: { key: 'name', message: 'Revisa el nombre' },
  cedula: { key: 'cedula', message: 'Revisa la cédula' },
  lab_shift: { key: 'labShift', message: 'Revisa la tanda' },
  specialty: { key: 'specialty', message: 'Revisa la especialidad' },
};

/** Fields known to the backend conflict response (fallback for `409`). */
const DUPLICATED_FIELDS: readonly string[] = ['cedula'];

/**
 * Elige el mensaje de cara al usuario a partir del error HTTP. Nunca incluye
 * token, `detail`, `code`, `WWW-Authenticate`, stack ni URLs internas.
 */
export function mapDoctorsError(error: unknown): DoctorsErrorMessage {
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
      return { message: 'No tienes permiso para gestionar médicos.' };
    case 404:
      return { message: 'El médico solicitado ya no existe. Actualiza la lista.' };
    case 409:
      return mapConflictError(error);
    case 422:
      return mapValidationError(error);
    default:
      return { message: GENERIC_MESSAGE };
  }
}

/**
 * `409`: distingue el bloqueo por visitas (S8) del duplicado de cédula (S2).
 * El envelope no trae `errors[]`, así que el campo duplicado se decide con el
 * `code` estable del backend (con `errors[].field` como respaldo). Sin dato
 * reconocible queda solo el mensaje general, sin inventar campo.
 */
function mapConflictError(error: HttpErrorResponse): DoctorsErrorMessage {
  const body = errorBody(error);

  if (body.code === 'doctor_has_visits') {
    return { message: HAS_VISITS_MESSAGE };
  }
  if (duplicatedField(body) === 'cedula') {
    return { message: CEDULA_DUPLICATED, fieldErrors: { cedula: CEDULA_DUPLICATED } };
  }
  return { message: 'Ya existe un médico con esos datos. Revisa la cédula.' };
}

/** Campo duplicado según el `code` del envelope, con `errors[].field` de respaldo. */
function duplicatedField(body: BackendErrorBody): string | null {
  if (body.code === 'doctor_exists' || body.code === 'doctor_cedula_exists') {
    return 'cedula';
  }
  if (!Array.isArray(body.errors)) {
    return null;
  }
  for (const entry of body.errors) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const field = (entry as { field?: unknown }).field;
    if (typeof field === 'string' && DUPLICATED_FIELDS.includes(field)) {
      return field;
    }
  }
  return null;
}

/**
 * `422`: mensaje general más el texto propio de cada campo conocido
 * (`name`, `cedula`, `lab_shift`, `specialty`). Los campos desconocidos se
 * ignoran (solo mensaje general) y el `message` del backend no se expone.
 */
function mapValidationError(error: HttpErrorResponse): DoctorsErrorMessage {
  const body = errorBody(error);

  if (!Array.isArray(body.errors)) {
    return { message: VALIDATION_MESSAGE };
  }

  const fieldErrors: DoctorsFieldErrors = {};
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
