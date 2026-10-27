import { HttpErrorResponse } from '@angular/common/http';
import { mapLocationsError } from './locations-error';

/**
 * Construye un `HttpErrorResponse` sintético con el cuerpo crudo que mandaría
 * el backend (con `detail`/`message`/`code` en inglés que nunca deben salir).
 */
function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    statusText: 'Error sintético',
    url: 'http://backend-interno.test/v1/locations',
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

  describe('409 duplicado (S2)', () => {
    it('devuelve mensaje propio y error de campo en description', () => {
      const mapped = mapLocationsError(httpError(409, RAW_BODY));

      expect(mapped.message).toBe('Ya existe una ubicación con esa descripción.');
      expect(mapped.fieldErrors).toEqual({
        description: 'Ya existe una ubicación con esa descripción.',
      });
    });
  });

  describe('422 validación (S8)', () => {
    it('mapea errors[].field description al texto propio del campo', () => {
      const mapped = mapLocationsError(
        httpError(422, {
          errors: [{ field: 'description', message: 'RAW field detail' }],
          detail: 'RAW-DETAIL-LEAK',
        }),
      );

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toEqual({ description: 'Revisa la descripción' });
    });

    it('conserva solo la primera ocurrencia del campo conocido', () => {
      const mapped = mapLocationsError(
        httpError(422, {
          errors: [
            { field: 'description', message: 'primera' },
            { field: 'description', message: 'segunda' },
          ],
        }),
      );

      expect(mapped.fieldErrors).toEqual({ description: 'Revisa la descripción' });
    });

    it('ignora campos desconocidos: solo mensaje general, sin fieldErrors', () => {
      const mapped = mapLocationsError(
        httpError(422, {
          errors: [
            { field: 'is_active', message: 'unknown' },
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

    it('el message crudo dentro de errors[] del 422 tampoco se expone', () => {
      const mapped = mapLocationsError(
        httpError(422, { errors: [{ field: 'description', message: 'RAW-MESSAGE-LEAK' }] }),
      );

      expect(JSON.stringify(mapped)).not.toContain('RAW-MESSAGE-LEAK');
    });
  });
});
