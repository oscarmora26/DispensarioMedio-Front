/**
 * Mensajes de error propios del frontend para autenticación.
 *
 * Todos los textos visibles viven en este módulo. El `detail`, el `code` y el
 * `message` del backend nunca se muestran tal cual (pueden estar en inglés o
 * revelar detalles internos); solo se usan el estado HTTP y —en el caso del
 * 422— el campo `errors[].field` para elegir el texto correspondiente.
 */

import { HttpErrorResponse } from '@angular/common/http';

/** Errores propios bajo cada campo del formulario. */
export interface AuthFieldErrors {
  email?: string;
  password?: string;
}

/** Mensaje general más errores opcionales por campo. */
export interface AuthErrorMessage {
  message: string;
  fieldErrors?: AuthFieldErrors;
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
export function mapAuthError(error: unknown): AuthErrorMessage {
  if (!(error instanceof HttpErrorResponse)) {
    return { message: GENERIC_MESSAGE };
  }

  switch (error.status) {
    case 0:
      return {
        message: 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      };
    case 401:
      return { message: 'Correo electrónico o contraseña incorrectos.' };
    case 403:
      return { message: 'Tu cuenta está inactiva. Contacta al administrador del sistema.' };
    case 422:
      return mapValidationError(error);
    case 429:
      return {
        message: 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
      };
    default:
      return { message: GENERIC_MESSAGE };
  }
}

/**
 * 422: mensaje general más un texto propio bajo cada campo conocido
 * (`email`, `password`). Los campos desconocidos se ignoran y el `message`
 * del backend no se expone.
 */
function mapValidationError(error: HttpErrorResponse): AuthErrorMessage {
  const message = 'Revisa los datos ingresados.';
  const body = (error.error ?? {}) as BackendErrorBody;

  if (!Array.isArray(body.errors)) {
    return { message };
  }

  const fieldErrors: AuthFieldErrors = {};
  for (const entry of body.errors) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const field = (entry as { field?: unknown }).field;
    if (field === 'email' && fieldErrors.email === undefined) {
      fieldErrors.email = 'Revisa el correo electrónico';
    } else if (field === 'password' && fieldErrors.password === undefined) {
      fieldErrors.password = 'Revisa la contraseña';
    }
  }

  return Object.keys(fieldErrors).length > 0 ? { message, fieldErrors } : { message };
}
