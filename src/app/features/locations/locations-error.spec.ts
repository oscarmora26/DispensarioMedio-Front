import { HttpErrorResponse } from '@angular/common/http';
import { mapCellDeleteError, mapCellWriteError, mapLocationsError } from './locations-error';

/**
 * Construye un `HttpErrorResponse` sintético con el cuerpo crudo que mandaría
 * el backend (con `detail`/`message`/`code` en inglés que nunca deben salir).
 */
function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    statusText: 'Error sintético',
    url: 'http://backend-interno.test/v1/shelves',
    error: body,
  });
}

const RAW_BODY = {
  detail: 'RAW-DETAIL-LEAK internal server detail',
  message: 'RAW-MESSAGE-LEAK backend message',
  code: 'RAW_CODE_LEAK',
};

describe('mapLocationsError (F-011 S8)', () => {
  describe('mapeo por estado HTTP', () => {
    it('status 0 avisa de conexión sin exponer la URL interna', () => {
      const mapped = mapLocationsError(httpError(0));

      expect(mapped.message).toBe(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      );
      expect(mapped.message).not.toContain('backend-interno.test');
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('400 devuelve el mensaje de datos no válidos', () => {
      expect(mapLocationsError(httpError(400, RAW_BODY)).message).toBe(
        'Los datos enviados no son válidos. Revisa el formulario.',
      );
    });

    it('401 devuelve el mensaje de sesión expirada', () => {
      expect(mapLocationsError(httpError(401, RAW_BODY)).message).toBe(
        'Tu sesión expiró. Inicia sesión de nuevo.',
      );
    });

    it('403 devuelve el mensaje de permisos (red de seguridad del backend, S7)', () => {
      expect(mapLocationsError(httpError(403, RAW_BODY)).message).toBe(
        'No tienes permiso para gestionar ubicaciones.',
      );
    });

    it('404 devuelve el mensaje de recurso inexistente', () => {
      expect(mapLocationsError(httpError(404, RAW_BODY)).message).toBe(
        'La ubicación solicitada ya no existe. Actualiza la lista.',
      );
    });

    it('estados no contemplados (500, 502…) caen al mensaje genérico', () => {
      for (const status of [500, 502, 503, 418]) {
        expect(mapLocationsError(httpError(status, RAW_BODY)).message).toBe(
          'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
        );
      }
    });

    it('un error que no es HttpErrorResponse cae al mensaje genérico', () => {
      for (const error of [new Error('boom'), 'fallo de red', 42, null, undefined]) {
        expect(mapLocationsError(error).message).toBe(
          'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
        );
      }
    });
  });

  describe('409 duplicado de estante', () => {
    it('devuelve mensaje propio y error de campo en name (nombre duplicado)', () => {
      const mapped = mapLocationsError(httpError(409, RAW_BODY));

      expect(mapped.message).toBe('Ya existe una ubicación con ese nombre.');
      expect(mapped.fieldErrors).toEqual({ name: 'Ya existe una ubicación con ese nombre.' });
    });
  });

  describe('escritura de celdas (409 de posición duplicada)', () => {
    it('traduce el 409 a la posición duplicada, no al nombre del estante', () => {
      const mapped = mapCellWriteError(httpError(409, RAW_BODY));

      expect(mapped.message).toBe('Ya existe una celda con ese tramo y celda en el estante.');
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('el resto de estados conserva el mapeo común del módulo', () => {
      expect(mapCellWriteError(httpError(422, { errors: [{ field: 'cells' }] }))).toEqual({
        message: 'Revisa los datos ingresados.',
        fieldErrors: { cells: 'Revisa las celdas' },
      });
      expect(mapCellWriteError(httpError(0)).message).toBe(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      );
      expect(mapCellWriteError(new Error('boom')).message).toBe(
        'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
      );
    });
  });

  describe('baja de celdas (409 con medicamentos asociados)', () => {
    it('el 409 avisa de los medicamentos asociados con un texto no técnico', () => {
      const message = mapCellDeleteError(httpError(409, RAW_BODY));

      expect(message).toBe('No se puede eliminar la celda porque tiene medicamentos asociados.');
      expect(message).not.toContain('RAW-DETAIL-LEAK');
      expect(message).not.toContain('RAW_CODE_LEAK');
      expect(message).not.toContain('backend-interno.test');
    });

    it('el resto de estados usa el mensaje común del módulo', () => {
      expect(mapCellDeleteError(httpError(404, RAW_BODY))).toBe(
        'La ubicación solicitada ya no existe. Actualiza la lista.',
      );
      expect(mapCellDeleteError(httpError(0))).toBe(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      );
      expect(mapCellDeleteError(httpError(500, RAW_BODY))).toBe(
        'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
      );
      expect(mapCellDeleteError(new Error('boom'))).toBe(
        'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
      );
    });
  });

  describe('422 validación', () => {
    it.each([
      ['name', 'Revisa el nombre'],
      ['description', 'Revisa la descripción'],
      ['cells', 'Revisa las celdas'],
    ])('mapea errors[].field %p al texto propio del campo', (field, expected) => {
      const mapped = mapLocationsError(
        httpError(422, {
          errors: [{ field, message: 'RAW field detail' }],
          detail: 'RAW-DETAIL-LEAK',
        }),
      );

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toEqual({ [field]: expected });
    });

    it('conserva solo la primera ocurrencia de cada campo conocido', () => {
      const mapped = mapLocationsError(
        httpError(422, {
          errors: [
            { field: 'name', message: 'primera' },
            { field: 'name', message: 'segunda' },
            { field: 'cells', message: 'primera' },
          ],
        }),
      );

      expect(mapped.fieldErrors).toEqual({
        name: 'Revisa el nombre',
        cells: 'Revisa las celdas',
      });
    });

    it('ignora campos que no existen en el contrato de estantes: solo mensaje general', () => {
      const mapped = mapLocationsError(
        httpError(422, {
          errors: [
            { field: 'is_active', message: 'unknown' },
            { field: 'shelf_id', message: 'x' },
            { field: 'otro', message: 'x' },
          ],
        }),
      );

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('ignora entradas que no son objetos dentro de errors[]', () => {
      const mapped = mapLocationsError(httpError(422, { errors: ['cadena', null, 7] }));

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('sin array errors devuelve solo el mensaje general', () => {
      for (const body of [{ errors: 'no-array' }, { errors: null }, {}, null]) {
        const mapped = mapLocationsError(httpError(422, body));

        expect(mapped.message).toBe('Revisa los datos ingresados.');
        expect(mapped.fieldErrors).toBeUndefined();
      }
    });
  });

  describe('los mensajes crudos del backend nunca se exponen (S8)', () => {
    it('ningún estado deja escapar detail/message/code ni URLs internas', () => {
      for (const status of [0, 400, 401, 403, 404, 409, 422, 500]) {
        const mapped = mapLocationsError(httpError(status, RAW_BODY));
        const visible = JSON.stringify(mapped);

        expect(visible).not.toContain('RAW-DETAIL-LEAK');
        expect(visible).not.toContain('RAW-MESSAGE-LEAK');
        expect(visible).not.toContain('RAW_CODE_LEAK');
        expect(visible).not.toContain('backend-interno.test');
      }
    });

    it('tampoco en los errores propios de las celdas', () => {
      for (const status of [409, 422, 500]) {
        const write = JSON.stringify(mapCellWriteError(httpError(status, RAW_BODY)));
        const remove = mapCellDeleteError(httpError(status, RAW_BODY));

        for (const visible of [write, remove]) {
          expect(visible).not.toContain('RAW-DETAIL-LEAK');
          expect(visible).not.toContain('RAW-MESSAGE-LEAK');
          expect(visible).not.toContain('RAW_CODE_LEAK');
          expect(visible).not.toContain('backend-interno.test');
        }
      }
    });

    it('el message crudo dentro de errors[] del 422 tampoco se expone', () => {
      const mapped = mapLocationsError(
        httpError(422, { errors: [{ field: 'name', message: 'RAW-MESSAGE-LEAK' }] }),
      );

      expect(JSON.stringify(mapped)).not.toContain('RAW-MESSAGE-LEAK');
    });
  });
});
