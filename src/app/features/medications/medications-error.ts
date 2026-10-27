/**
 * Mensajes de error propios del frontend para medicamentos (F-012, S8).
 */

import { HttpErrorResponse } from '@angular/common/http';

export interface MedicationsFieldErrors {
  description?: string;
  drugTypeId?: string;
  brandId?: string;
  locationId?: string;
  dose?: string;
}

export interface MedicationsErrorMessage {
  message: string;
  fieldErrors?: MedicationsFieldErrors;
}

interface BackendErrorBody {
  errors?: unknown;
}

const GENERIC_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.';

export function mapMedicationsError(error: unknown): MedicationsErrorMessage {
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
      return { message: 'No tienes permiso para gestionar medicamentos.' };
    case 404:
      return { message: 'El medicamento solicitado ya no existe. Actualiza la lista.' };
    case 409:
      return {
        message: 'Ya existe un medicamento con esa descripción, marca y dosis.',
        fieldErrors: {
          description: 'Ya existe un medicamento con esa descripción, marca y dosis.',
        },
      };
    case 422:
      return mapValidationError(error);
    default:
      return { message: GENERIC_MESSAGE };
  }
}

function mapValidationError(error: HttpErrorResponse): MedicationsErrorMessage {
  const message = 'Revisa los datos ingresados.';
  const body = (error.error ?? {}) as BackendErrorBody;

  if (!Array.isArray(body.errors)) {
    return { message };
  }

  const fieldErrors: MedicationsFieldErrors = {};
  for (const entry of body.errors) {
    if (typeof entry !== 'object' || entry === null) continue;
    const field = (entry as { field?: unknown }).field;
    if (field === 'description' && fieldErrors.description === undefined)
      fieldErrors.description = 'Revisa la descripción';
    else if (field === 'drug_type_id' && fieldErrors.drugTypeId === undefined)
      fieldErrors.drugTypeId = 'Selecciona un tipo válido';
    else if (field === 'brand_id' && fieldErrors.brandId === undefined)
      fieldErrors.brandId = 'Selecciona una marca válida';
    else if (field === 'location_id' && fieldErrors.locationId === undefined)
      fieldErrors.locationId = 'Selecciona una ubicación válida';
    else if (field === 'dose' && fieldErrors.dose === undefined)
      fieldErrors.dose = 'Revisa la dosis';
  }

  return Object.keys(fieldErrors).length > 0 ? { message, fieldErrors } : { message };
}
