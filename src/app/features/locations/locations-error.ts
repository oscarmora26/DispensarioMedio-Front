/**
 * Mensajes de error propios del frontend para ubicaciones (F-011, S8).
 *
 * Todos los textos visibles viven en este módulo. El `detail`, el `code` y el
 * `message` del backend nunca se muestran tal cual (pueden estar en inglés o
 * revelar detalles internos); solo se usan el estado HTTP y —en el caso del
 * `422`— el campo `errors[].field` (`description` en `snake_case`) para elegir
 * el texto correspondiente. Mismo patrón que `users-error.ts`/`auth-error.ts`.
 */

import { HttpErrorResponse } from '@angular/common/http';

/** Errores propios bajo cada campo del formulario de ubicaciones. */
export interface LocationsFieldErrors {
  description?: string;
  shelf?: string;
  section?: string;
  cell?: string;
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

const GENERIC_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.';

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
      // S2: el duplicado se marca como error de campo en `description`, no
      // solo como mensaje general (el diálogo lo muestra bajo el input).
      return {
        message: 'Ya existe una ubicación con esa descripción.',
        fieldErrors: { description: 'Ya existe una ubicación con esa descripción.' },
      };
    case 422:
      return mapValidationError(error);
    default:
      return { message: GENERIC_MESSAGE };
  }
}

/**
 * `422`: mensaje general más el texto propio del campo conocido
 * (`description`). Los campos desconocidos se ignoran (solo mensaje general)
 * y el `message` del backend no se expone.
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
    if (field === 'description' && fieldErrors.description === undefined) {
      fieldErrors.description = 'Revisa la descripción';
    } else if (field === 'shelf' && fieldErrors.shelf === undefined) {
      fieldErrors.shelf = 'Revisa el estante';
    } else if (field === 'section' && fieldErrors.section === undefined) {
      fieldErrors.section = 'Revisa el tramo';
    } else if (field === 'cell' && fieldErrors.cell === undefined) {
      fieldErrors.cell = 'Revisa la celda';
    }
  }

  return Object.keys(fieldErrors).length > 0 ? { message, fieldErrors } : { message };
}
