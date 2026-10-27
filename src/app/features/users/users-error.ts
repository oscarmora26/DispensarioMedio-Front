/**
 * Mensajes de error propios del frontend para la gestión de usuarios (F-006).
 *
 * Todos los textos visibles viven en este módulo. El `detail`, el `code` y el
 * `message` del backend nunca se muestran tal cual (pueden estar en inglés o
 * revelar detalles internos); solo se usan el estado HTTP y —en el caso del
 * 422— el campo `errors[].field` (en `snake_case`: `role_id`/`doctor_id`) para
 * elegir el texto correspondiente. Mismo patrón que `auth-error.ts`.
 */

import { HttpErrorResponse } from '@angular/common/http';

/** Errores propios bajo cada campo del formulario de usuarios. */
export interface UsersFieldErrors {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  doctorId?: string;
}

/** Mensaje general más errores opcionales por campo. */
export interface UsersErrorMessage {
  message: string;
  fieldErrors?: UsersFieldErrors;
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
export function mapUsersError(error: unknown): UsersErrorMessage {
  if (!(error instanceof HttpErrorResponse)) {
    return { message: GENERIC_MESSAGE };
  }

  switch (error.status) {
    case 0:
      return {
        message: 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      };
    case 401:
      return { message: 'Tu sesión expiró. Inicia sesión de nuevo.' };
    case 403:
      return { message: 'No tienes permiso para gestionar usuarios.' };
    case 404:
      return { message: 'El usuario solicitado ya no existe. Actualiza la lista.' };
    case 409:
      return { message: 'Ya existe un usuario con ese correo electrónico.' };
    case 422:
      return mapValidationError(error);
    default:
      return { message: GENERIC_MESSAGE };
  }
}

/**
 * 422: mensaje general más un texto propio bajo cada campo conocido
 * (`username`, `email`, `password`, `role_id`, `doctor_id`). `is_active` y los
 * campos desconocidos se ignoran (solo mensaje general) y el `message` del
 * backend no se expone.
 */
function mapValidationError(error: HttpErrorResponse): UsersErrorMessage {
  const message = 'Revisa los datos ingresados.';
  const body = (error.error ?? {}) as BackendErrorBody;

  if (!Array.isArray(body.errors)) {
    return { message };
  }

  const fieldErrors: UsersFieldErrors = {};
  for (const entry of body.errors) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const field = (entry as { field?: unknown }).field;
    if (field === 'username' && fieldErrors.username === undefined) {
      fieldErrors.username = 'Revisa el usuario';
    } else if (field === 'email' && fieldErrors.email === undefined) {
      fieldErrors.email = 'Revisa el correo electrónico';
    } else if (field === 'password' && fieldErrors.password === undefined) {
      fieldErrors.password = 'Revisa la contraseña';
    } else if (field === 'role_id' && fieldErrors.role === undefined) {
      fieldErrors.role = 'Selecciona un rol válido';
    } else if (field === 'doctor_id' && fieldErrors.doctorId === undefined) {
      fieldErrors.doctorId = 'Revisa el médico asociado';
    }
  }

  return Object.keys(fieldErrors).length > 0 ? { message, fieldErrors } : { message };
}
