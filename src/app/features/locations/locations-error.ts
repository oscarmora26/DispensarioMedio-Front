/**
 * Mensajes de error propios del frontend para ubicaciones (F-011, S8).
 *
 * Todos los textos visibles viven en este módulo. El `detail`, el `code` y el
 * `message` del backend nunca se muestran tal cual (pueden estar en inglés o
 * revelar detalles internos); solo se usan el estado HTTP y —en el caso del
 * `422`— el campo `errors[].field`, que en el contrato de `/v1/shelves` es
 * `name` o `description` y en el editor de celdas `cells`. Mismo patrón que
 * `users-error.ts`.
 *
 * Los dos recursos del módulo tienen semántica de `409` distinta:
 * - `POST/PUT /v1/shelves`: el `name` del estante ya existe.
 * - `POST/PUT /v1/cells`: la posición `(shelf_id, section, cell)` ya existe.
 * - `DELETE /v1/cells/{id}`: la celda tiene medicamentos asociados.
 * Cada uno tiene su propio texto, así que la UI nunca enseña el mensaje de
 * otro recurso.
 */

import { HttpErrorResponse } from '@angular/common/http';

/** Errores propios bajo cada campo del formulario de ubicaciones. */
export interface LocationsFieldErrors {
  name?: string;
  description?: string;
  cells?: string;
}

/** Mensaje general más errores opcionales por campo. */
export interface LocationsErrorMessage {
  message: string;
  fieldErrors?: LocationsFieldErrors;
}

/** Forma mínima del cuerpo de error del backend que nos interesa. */
interface BackendErrorBody {
  errors?: unknown;
}

/** Texto propio por campo conocido del contrato de estantes. */
const FIELD_MESSAGES: Record<keyof LocationsFieldErrors, string> = {
  name: 'Revisa el nombre',
  description: 'Revisa la descripción',
  cells: 'Revisa las celdas',
};

const GENERIC_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.';

/** `409` de `POST/PUT /v1/shelves`: el `name` del estante es único. */
const DUPLICATE_NAME_MESSAGE = 'Ya existe una ubicación con ese nombre.';

/**
 * `409` de `POST/PUT /v1/cells`: la posición `(shelf_id, section, cell)` ya
 * existe en el estante (comparación sin distinguir mayúsculas).
 */
const DUPLICATE_CELL_MESSAGE = 'Ya existe una celda con ese tramo y celda en el estante.';

/**
 * `409` de `DELETE /v1/cells/{id}`: la celda tiene medicamentos asociados y el
 * backend rechaza la baja. Texto no técnico: el `detail` del backend no se
 * muestra nunca.
 */
export const CELL_HAS_MEDICATIONS_MESSAGE =
  'No se puede eliminar la celda porque tiene medicamentos asociados.';

/**
 * Elige el mensaje de cara al usuario a partir del error HTTP. Nunca incluye
 * token, `detail`, `code`, `WWW-Authenticate`, stack ni URLs internas.
 */
export function mapLocationsError(error: unknown): LocationsErrorMessage {
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
      return { message: 'No tienes permiso para gestionar ubicaciones.' };
    case 404:
      return { message: 'La ubicación solicitada ya no existe. Actualiza la lista.' };
    case 409:
      // El duplicado se marca como error de campo en `name`, no solo como
      // mensaje general (el diálogo lo muestra bajo el input).
      return {
        message: DUPLICATE_NAME_MESSAGE,
        fieldErrors: { name: DUPLICATE_NAME_MESSAGE },
      };
    case 422:
      return mapValidationError(error);
    default:
      return { message: GENERIC_MESSAGE };
  }
}

/**
 * Error de escritura de una celda (`POST`/`PUT /v1/cells`). Su `409` significa
 * «posición duplicada», no «nombre de estante duplicado»: se traduce con su
 * propio texto y sin marcar el campo `name`. El resto de estados conserva el
 * mapeo común.
 */
export function mapCellWriteError(error: unknown): LocationsErrorMessage {
  if (error instanceof HttpErrorResponse && error.status === 409) {
    return { message: DUPLICATE_CELL_MESSAGE };
  }

  return mapLocationsError(error);
}

/**
 * Error de `DELETE /v1/cells/{id}`: el `409` es «la celda tiene medicamentos
 * asociados», un texto propio y no técnico; el resto de estados usa el mapeo
 * común del módulo.
 */
export function mapCellDeleteError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 409) {
    return CELL_HAS_MEDICATIONS_MESSAGE;
  }

  return mapLocationsError(error).message;
}

/**
 * `422`: mensaje general más el texto propio de cada campo conocido
 * (`name`, `description`, `cells`). Los campos desconocidos se ignoran y el
 * `message` del backend no se expone.
 */
function mapValidationError(error: HttpErrorResponse): LocationsErrorMessage {
  const message = 'Revisa los datos ingresados.';
  const body = (error.error ?? {}) as BackendErrorBody;

  if (!Array.isArray(body.errors)) {
    return { message };
  }

  const fieldErrors: LocationsFieldErrors = {};
  for (const entry of body.errors) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const field = (entry as { field?: unknown }).field;
    if (isKnownField(field) && fieldErrors[field] === undefined) {
      fieldErrors[field] = FIELD_MESSAGES[field];
    }
  }

  return Object.keys(fieldErrors).length > 0 ? { message, fieldErrors } : { message };
}

/** Estrecha `errors[].field` a los campos que el contrato de estantes declara. */
function isKnownField(field: unknown): field is keyof LocationsFieldErrors {
  return field === 'name' || field === 'description' || field === 'cells';
}
