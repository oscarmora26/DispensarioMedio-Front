import { HttpErrorResponse } from '@angular/common/http';
import {
  VISIT_ALREADY_ANNULLED_MESSAGE,
  VISIT_ANNULLED_MESSAGE,
  mapVisitsError,
} from './visits-error';

function httpError(status: number, error: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error, url: 'http://127.0.0.1:8000/api/v1/visits' });
}

describe('mapVisitsError (F-015 S12)', () => {
  it('traduce los estados HTTP sin exponer mensajes del backend', () => {
    expect(mapVisitsError(httpError(0)).message).toContain('No se pudo conectar con el servidor');
    expect(mapVisitsError(httpError(400)).message).toBe(
      'Los datos enviados no son válidos. Revisa el formulario.',
    );
    expect(mapVisitsError(httpError(401)).message).toBe(
      'Tu sesión expiró. Inicia sesión de nuevo.',
    );
    expect(mapVisitsError(httpError(403)).message).toBe(
      'No tienes permiso para gestionar visitas.',
    );
    expect(mapVisitsError(httpError(404)).message).toBe(
      'La visita solicitada ya no existe. Actualiza la lista.',
    );
    expect(mapVisitsError(httpError(500, { detail: 'internal' })).message).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
    );
    expect(mapVisitsError(new Error('boom')).message).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
    );
  });

  it('nunca incluye detail, code ni mensajes crudos del backend', () => {
    const mapped = mapVisitsError(
      httpError(409, { code: 'visit_annulled', detail: 'Visit is annulled', message: 'raw' }),
    );

    expect(mapped.message).toBe(VISIT_ANNULLED_MESSAGE);
    expect(mapped.message).not.toContain('annulled');
    expect(mapped.message).not.toContain('detail');
  });

  it('traduce el 409 visit_annulled con código propio (S8)', () => {
    const mapped = mapVisitsError(httpError(409, { code: 'visit_annulled' }));

    expect(mapped.code).toBe('visit_annulled');
    expect(mapped.message).toBe(VISIT_ANNULLED_MESSAGE);
    expect(mapped.message).toBe('La visita está anulada y no se puede editar.');
  });

  it('traduce el 409 visit_already_annulled con código propio (S7)', () => {
    const mapped = mapVisitsError(httpError(409, { code: 'visit_already_annulled' }));

    expect(mapped.code).toBe('visit_already_annulled');
    expect(mapped.message).toBe(VISIT_ALREADY_ANNULLED_MESSAGE);
    expect(mapped.message).toBe('La visita ya estaba anulada.');
  });

  it('deja un 409 desconocido con mensaje general y sin código', () => {
    const mapped = mapVisitsError(httpError(409, { code: 'otro_codigo' }));

    expect(mapped.code).toBeUndefined();
    expect(mapped.message).toBe('La visita cambió de estado. Actualiza la lista.');
  });

  it('marca los campos conocidos del 422 sin exponer el mensaje del backend', () => {
    const mapped = mapVisitsError(
      httpError(422, {
        message: 'Validation error',
        errors: [
          { field: 'visited_at', message: 'must not be in the future' },
          { field: 'symptoms', message: 'too short' },
          { field: 'medications', message: 'duplicated' },
          { field: 'reason', message: 'required' },
          { field: 'desconocido', message: 'x' },
        ],
      }),
    );

    expect(mapped.message).toBe('Revisa los datos ingresados.');
    expect(mapped.fieldErrors).toEqual({
      visitedAt: 'Revisa la fecha y hora de la visita',
      symptoms: 'Revisa los síntomas',
      medications: 'Revisa los medicamentos',
      reason: 'Revisa el motivo de la anulación',
    });
    expect(mapped.message).not.toContain('Validation error');
  });

  it('devuelve solo el mensaje general cuando el 422 no trae campos conocidos', () => {
    const mapped = mapVisitsError(httpError(422, { errors: [{ field: 'otro' }] }));

    expect(mapped.message).toBe('Revisa los datos ingresados.');
    expect(mapped.fieldErrors).toBeUndefined();
  });
});
