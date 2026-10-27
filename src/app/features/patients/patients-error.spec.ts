import { HttpErrorResponse } from '@angular/common/http';
import { mapPatientsError } from './patients-error';

/**
 * Construye un `HttpErrorResponse` sintético con el cuerpo crudo que manda el
 * backend (`{detail, code, errors}`): ninguno de esos textos debe mostrarse.
 */
function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    statusText: 'Error sintético',
    url: 'http://backend-interno.test/v1/patients',
    error: body,
  });
}

const RAW_BODY = {
  detail: 'RAW-DETAIL-LEAK internal server detail',
  message: 'RAW-MESSAGE-LEAK backend message',
  code: 'RAW_CODE_LEAK',
  errors: [],
};

describe('mapPatientsError (F-013 S8)', () => {
  describe('mapeo por estado HTTP', () => {
    it('status 0 avisa de conexión sin exponer la URL interna', () => {
      const mapped = mapPatientsError(httpError(0));

      expect(mapped.message).toBe(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      );
      expect(mapped.message).not.toContain('backend-interno.test');
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('400 devuelve el mensaje de datos no válidos', () => {
      expect(mapPatientsError(httpError(400, RAW_BODY)).message).toBe(
        'Los datos enviados no son válidos. Revisa el formulario.',
      );
    });

    it('401 devuelve el mensaje de sesión expirada', () => {
      expect(mapPatientsError(httpError(401, RAW_BODY)).message).toBe(
        'Tu sesión expiró. Inicia sesión de nuevo.',
      );
    });

    it('403 devuelve el mensaje de permisos (red de seguridad del backend, S10)', () => {
      expect(mapPatientsError(httpError(403, RAW_BODY)).message).toBe(
        'No tienes permiso para gestionar pacientes.',
      );
    });

    it('404 devuelve el mensaje de paciente inexistente', () => {
      expect(mapPatientsError(httpError(404, RAW_BODY)).message).toBe(
        'El paciente solicitado ya no existe. Actualiza la lista.',
      );
    });

    it('estados no contemplados (500, 502…) caen al mensaje genérico', () => {
      for (const status of [500, 502, 503, 418]) {
        expect(mapPatientsError(httpError(status, RAW_BODY)).message).toBe(
          'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
        );
      }
    });

    it('un error que no es HttpErrorResponse cae al mensaje genérico', () => {
      for (const error of [new Error('boom'), 'fallo de red', 42, null, undefined]) {
        expect(mapPatientsError(error).message).toBe(
          'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
        );
      }
    });
  });

  describe('409 duplicado mapeado al campo correcto (S2/S4)', () => {
    it('code patient_exists marca la cédula duplicada', () => {
      const mapped = mapPatientsError(
        httpError(409, { detail: 'RAW-DETAIL-LEAK', code: 'patient_exists', errors: [] }),
      );

      expect(mapped.message).toBe('Ya existe un paciente con esa cédula.');
      expect(mapped.fieldErrors).toEqual({ cedula: 'Ya existe un paciente con esa cédula.' });
    });

    it('code patient_carnet_exists marca el carnet duplicado', () => {
      const mapped = mapPatientsError(
        httpError(409, { detail: 'RAW-DETAIL-LEAK', code: 'patient_carnet_exists', errors: [] }),
      );

      expect(mapped.message).toBe('Ya existe un paciente con ese carnet.');
      expect(mapped.fieldErrors).toEqual({ carnet: 'Ya existe un paciente con ese carnet.' });
    });

    it('un 409 sin code conocido (conflicto genérico) no inventa campo', () => {
      const mapped = mapPatientsError(httpError(409, RAW_BODY));

      expect(mapped.message).toBe(
        'Ya existe un paciente con esos datos. Revisa la cédula y el carnet.',
      );
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('también reconoce el campo desde errors[] cuando el code no viene', () => {
      const mapped = mapPatientsError(
        httpError(409, { detail: 'RAW-DETAIL-LEAK', errors: [{ field: 'carnet' }] }),
      );

      expect(mapped.fieldErrors).toEqual({ carnet: 'Ya existe un paciente con ese carnet.' });
    });
  });

  describe('422 validación (S8)', () => {
    it('mapea los campos conocidos a mensajes propios en español', () => {
      const mapped = mapPatientsError(
        httpError(422, {
          detail: 'RAW-DETAIL-LEAK',
          errors: [
            { field: 'name', message: 'RAW field detail' },
            { field: 'cedula', message: 'RAW field detail' },
            { field: 'carnet', message: 'RAW field detail' },
            { field: 'patient_type', message: 'RAW field detail' },
          ],
        }),
      );

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toEqual({
        name: 'Revisa el nombre',
        cedula: 'Revisa la cédula',
        carnet: 'Revisa el carnet',
        patientType: 'Revisa el tipo de paciente',
      });
    });

    it('conserva solo la primera ocurrencia de cada campo conocido', () => {
      const mapped = mapPatientsError(
        httpError(422, {
          errors: [
            { field: 'cedula', message: 'primera' },
            { field: 'cedula', message: 'segunda' },
          ],
        }),
      );

      expect(mapped.fieldErrors).toEqual({ cedula: 'Revisa la cédula' });
    });

    it('ignora campos desconocidos: solo mensaje general, sin fieldErrors', () => {
      const mapped = mapPatientsError(
        httpError(422, {
          errors: [
            { field: 'is_active', message: 'unknown' },
            { field: 'sort', message: 'x' },
          ],
        }),
      );

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('ignora entradas que no son objetos dentro de errors[]', () => {
      const mapped = mapPatientsError(httpError(422, { errors: ['cadena', null, 7] }));

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('sin array errors devuelve solo el mensaje general', () => {
      for (const body of [{ errors: 'no-array' }, { errors: null }, {}, null]) {
        const mapped = mapPatientsError(httpError(422, body));

        expect(mapped.message).toBe('Revisa los datos ingresados.');
        expect(mapped.fieldErrors).toBeUndefined();
      }
    });
  });

  describe('los mensajes crudos del backend nunca se exponen (S8)', () => {
    it('ningún estado deja escapar detail/message/code ni URLs internas', () => {
      for (const status of [0, 400, 401, 403, 404, 409, 422, 500]) {
        const visible = JSON.stringify(mapPatientsError(httpError(status, RAW_BODY)));

        expect(visible).not.toContain('RAW-DETAIL-LEAK');
        expect(visible).not.toContain('RAW-MESSAGE-LEAK');
        expect(visible).not.toContain('RAW_CODE_LEAK');
        expect(visible).not.toContain('backend-interno.test');
      }
    });

    it('el message crudo dentro de errors[] del 422 tampoco se expone', () => {
      const mapped = mapPatientsError(
        httpError(422, { errors: [{ field: 'name', message: 'RAW-MESSAGE-LEAK' }] }),
      );

      expect(JSON.stringify(mapped)).not.toContain('RAW-MESSAGE-LEAK');
    });
  });
});
