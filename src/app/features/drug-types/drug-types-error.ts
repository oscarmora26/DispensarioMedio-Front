/**
 * Mensajes de error propios del frontend para tipos de fármacos (F-009, S8).
 *
 * Todos los textos visibles viven en este módulo. El `detail`, el `code` y el
 * `message` del backend nunca se muestran tal cual (pueden estar en inglés o
 * revelar detalles internos); solo se usan el estado HTTP y —en el caso del
 * `422`— el campo `errors[].field` (`description` en `snake_case`) para elegir
 * el texto correspondiente. Mismo patrón que `users-error.ts`/`auth-error.ts`.
 */

import { HttpErrorResponse } from '@angular/common/http';

/** Errores propios bajo cada campo del formulario de tipos de fármacos. */
export interface DrugTypesFieldErrors {
  description?: string;
}

/** Mensaje general más errores opcionales por campo. */
export interface DrugTypesErrorMessage {
  message: string;
  fieldErrors?: DrugTypesFieldErrors;
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
export function mapDrugTypesError(error: unknown): DrugTypesErrorMessage {
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
      return { message: 'No tienes permiso para gestionar tipos de fármacos.' };
    case 404:
      return { message: 'El tipo de fármaco solicitado ya no existe. Actualiza la lista.' };
    case 409:
      // S2: el duplicado se marca como error de campo en `description`, no
      // solo como mensaje general (el diálogo lo muestra bajo el input).
      return {
        message: 'Ya existe un tipo de fármaco con esa descripción.',
        fieldErrors: { description: 'Ya existe un tipo de fármaco con esa descripción.' },
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
function mapValidationError(error: HttpErrorResponse): DrugTypesErrorMessage {
  const message = 'Revisa los datos ingresados.';
  const body = (error.error ?? {}) as BackendErrorBody;

  if (!Array.isArray(body.errors)) {
    return { message };
  }

  const fieldErrors: DrugTypesFieldErrors = {};
  for (const entry of body.errors) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const field = (entry as { field?: unknown }).field;
    if (field === 'description' && fieldErrors.description === undefined) {
      fieldErrors.description = 'Revisa la descripción';
    }
  }

  return Object.keys(fieldErrors).length > 0 ? { message, fieldErrors } : { message };
}
