/**
 * Mensajes de error propios del frontend para pacientes (F-013, S8).
 *
 * Todos los textos visibles viven en este módulo. El `detail` y el `message`
 * del backend nunca se muestran tal cual (pueden estar en inglés o revelar
 * detalles internos). Solo se usan datos máquina-legibles:
 * - el estado HTTP;
 * - el `code` estable del envelope (`patient_exists` /
 *   `patient_carnet_exists`) para decidir **bajo qué campo** va el `409`
 *   duplicado, porque ese estado no rellena `errors[]`;
 * - `errors[].field` (`snake_case`) en el `422`.
 *
 * Mismo patrón que `drug-types-error.ts`/`users-error.ts`.
 */

import { HttpErrorResponse } from '@angular/common/http';

/** Errores propios bajo cada campo del formulario de pacientes. */
export interface PatientsFieldErrors {
  name?: string;
  cedula?: string;
  carnet?: string;
  patientType?: string;
}

/** Mensaje general más errores opcionales por campo. */
export interface PatientsErrorMessage {
  message: string;
  fieldErrors?: PatientsFieldErrors;
}

/** Forma mínima del cuerpo de error del backend que nos interesa. */
interface BackendErrorBody {
  code?: unknown;
  errors?: unknown;
}

const GENERIC_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.';
const VALIDATION_MESSAGE = 'Revisa los datos ingresados.';
const CEDULA_DUPLICATED = 'Ya existe un paciente con esa cédula.';
const CARNET_DUPLICATED = 'Ya existe un paciente con ese carnet.';

/** Campo del formulario y texto propio para cada campo conocido del `422`. */
const VALIDATION_FIELDS: Record<string, { key: keyof PatientsFieldErrors; message: string }> = {
  name: { key: 'name', message: 'Revisa el nombre' },
  cedula: { key: 'cedula', message: 'Revisa la cédula' },
  carnet: { key: 'carnet', message: 'Revisa el carnet' },
  patient_type: { key: 'patientType', message: 'Revisa el tipo de paciente' },
};

/**
 * Elige el mensaje de cara al usuario a partir del error HTTP. Nunca incluye
 * token, `detail`, `code`, `WWW-Authenticate`, stack ni URLs internas.
 */
export function mapPatientsError(error: unknown): PatientsErrorMessage {
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
      return { message: 'No tienes permiso para gestionar pacientes.' };
    case 404:
      return { message: 'El paciente solicitado ya no existe. Actualiza la lista.' };
    case 409:
      return mapConflictError(error);
    case 422:
      return mapValidationError(error);
    default:
      return { message: GENERIC_MESSAGE };
  }
}

/**
 * `409`: el envelope no trae `errors[]`, así que el campo duplicado se decide
 * con el `code` estable del backend (con `errors[].field` como respaldo). Sin
 * dato reconocible queda solo el mensaje general, sin inventar campo.
 */
function mapConflictError(error: HttpErrorResponse): PatientsErrorMessage {
  const field = duplicatedField(errorBody(error));

  if (field === 'cedula') {
    return { message: CEDULA_DUPLICATED, fieldErrors: { cedula: CEDULA_DUPLICATED } };
  }
  if (field === 'carnet') {
    return { message: CARNET_DUPLICATED, fieldErrors: { carnet: CARNET_DUPLICATED } };
  }
  return { message: 'Ya existe un paciente con esos datos. Revisa la cédula y el carnet.' };
}

/** Campo duplicado según el `code` del envelope, con `errors[].field` de respaldo. */
function duplicatedField(body: BackendErrorBody): 'cedula' | 'carnet' | null {
  if (body.code === 'patient_exists') {
    return 'cedula';
  }
  if (body.code === 'patient_carnet_exists') {
    return 'carnet';
  }
  if (!Array.isArray(body.errors)) {
    return null;
  }
  for (const entry of body.errors) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const field = (entry as { field?: unknown }).field;
    if (field === 'cedula' || field === 'carnet') {
      return field;
    }
  }
  return null;
}

/**
 * `422`: mensaje general más el texto propio de cada campo conocido
 * (`name`, `cedula`, `carnet`, `patient_type`). Los campos desconocidos se
 * ignoran (solo mensaje general) y el `message` del backend no se expone.
 */
function mapValidationError(error: HttpErrorResponse): PatientsErrorMessage {
  const body = errorBody(error);

  if (!Array.isArray(body.errors)) {
    return { message: VALIDATION_MESSAGE };
  }

  const fieldErrors: PatientsFieldErrors = {};
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
