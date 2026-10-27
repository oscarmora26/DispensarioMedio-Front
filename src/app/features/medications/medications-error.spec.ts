import { HttpErrorResponse } from '@angular/common/http';
import { mapMedicationsError } from './medications-error';

/**
 * Construye un `HttpErrorResponse` sintético con el cuerpo crudo que mandaría
 * el backend (con `detail`/`message`/`code` en inglés que nunca deben salir).
 */
function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    statusText: 'Error sintético',
    url: 'http://backend-interno.test/v1/medications',
    error: body,
  });
}

const RAW_BODY = {
  detail: 'RAW-DETAIL-LEAK internal server detail',
  message: 'RAW-MESSAGE-LEAK backend message',
  code: 'RAW_CODE_LEAK',
};

describe('mapMedicationsError (F-012 S8)', () => {
  describe('mapeo por estado HTTP', () => {
    it('status 0 avisa de conexión sin exponer la URL interna', () => {
      const mapped = mapMedicationsError(httpError(0));

      expect(mapped.message).toBe(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      );
      expect(mapped.message).not.toContain('backend-interno.test');
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('400 devuelve el mensaje de datos no válidos', () => {
      expect(mapMedicationsError(httpError(400, RAW_BODY)).message).toBe(
        'Los datos enviados no son válidos. Revisa el formulario.',
      );
    });

    it('401 devuelve el mensaje de sesión expirada', () => {
      expect(mapMedicationsError(httpError(401, RAW_BODY)).message).toBe(
        'Tu sesión expiró. Inicia sesión de nuevo.',
      );
    });

    it('403 devuelve el mensaje de permisos (red de seguridad del backend, S7)', () => {
      expect(mapMedicationsError(httpError(403, RAW_BODY)).message).toBe(
        'No tienes permiso para gestionar medicamentos.',
      );
    });

    it('404 devuelve el mensaje de recurso inexistente', () => {
      expect(mapMedicationsError(httpError(404, RAW_BODY)).message).toBe(
        'El medicamento solicitado ya no existe. Actualiza la lista.',
      );
    });

    it('estados no contemplados (500, 502…) caen al mensaje genérico', () => {
      for (const status of [500, 502, 503, 418]) {
        expect(mapMedicationsError(httpError(status, RAW_BODY)).message).toBe(
          'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
        );
      }
    });

    it('un error que no es HttpErrorResponse cae al mensaje genérico', () => {
      for (const error of [new Error('boom'), 'fallo de red', 42, null, undefined]) {
        expect(mapMedicationsError(error).message).toBe(
          'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
        );
      }
    });
  });

  describe('409 duplicado (S2)', () => {
    it('devuelve mensaje propio y error de campo en description', () => {
      const mapped = mapMedicationsError(httpError(409, RAW_BODY));

      expect(mapped.message).toBe('Ya existe un medicamento con esa descripción, marca y dosis.');
      expect(mapped.fieldErrors).toEqual({
        description: 'Ya existe un medicamento con esa descripción, marca y dosis.',
      });
    });
  });

  describe('422 validación (S8)', () => {
    it('mapea errors[].field description al texto propio del campo', () => {
      const mapped = mapMedicationsError(
        httpError(422, {
          errors: [{ field: 'description', message: 'RAW field detail' }],
          detail: 'RAW-DETAIL-LEAK',
        }),
      );

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toEqual({ description: 'Revisa la descripción' });
    });

    it('mapea errors[].field cell_id a cellId con el texto propio de ubicación', () => {
      const mapped = mapMedicationsError(
        httpError(422, { errors: [{ field: 'cell_id', message: 'RAW-CELL-LEAK' }] }),
      );

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toEqual({ cellId: 'Selecciona una ubicación válida' });
      expect(JSON.stringify(mapped)).not.toContain('RAW-CELL-LEAK');
    });

    it('ya no reconoce el campo location_id del contrato viejo', () => {
      const mapped = mapMedicationsError(
        httpError(422, { errors: [{ field: 'location_id', message: 'obsoleto' }] }),
      );

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('conserva solo la primera ocurrencia del campo conocido', () => {
      const mapped = mapMedicationsError(
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
      const mapped = mapMedicationsError(
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
      const mapped = mapMedicationsError(httpError(422, { errors: ['cadena', null, 7] }));

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('sin array errors devuelve solo el mensaje general', () => {
      for (const body of [{ errors: 'no-array' }, { errors: null }, {}, null]) {
        const mapped = mapMedicationsError(httpError(422, body));

        expect(mapped.message).toBe('Revisa los datos ingresados.');
        expect(mapped.fieldErrors).toBeUndefined();
      }
    });
  });

  describe('los mensajes crudos del backend nunca se exponen (S8)', () => {
    it('ningún estado deja escapar detail/message/code ni URLs internas', () => {
      for (const status of [0, 400, 401, 403, 404, 409, 422, 500]) {
        const mapped = mapMedicationsError(httpError(status, RAW_BODY));
        const visible = JSON.stringify(mapped);

        expect(visible).not.toContain('RAW-DETAIL-LEAK');
        expect(visible).not.toContain('RAW-MESSAGE-LEAK');
        expect(visible).not.toContain('RAW_CODE_LEAK');
        expect(visible).not.toContain('backend-interno.test');
      }
    });

    it('el message crudo dentro de errors[] del 422 tampoco se expone', () => {
      const mapped = mapMedicationsError(
        httpError(422, { errors: [{ field: 'description', message: 'RAW-MESSAGE-LEAK' }] }),
      );

      expect(JSON.stringify(mapped)).not.toContain('RAW-MESSAGE-LEAK');
    });
  });
});
