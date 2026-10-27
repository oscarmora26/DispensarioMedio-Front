import { HttpErrorResponse } from '@angular/common/http';
import { mapDoctorsError } from './doctors-error';

/**
 * Construye un `HttpErrorResponse` sintético con el cuerpo crudo que manda el
 * backend (`{detail, code, errors}`): ninguno de esos textos debe mostrarse.
 */
function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    statusText: 'Error sintético',
    url: 'http://backend-interno.test/v1/doctors',
    error: body,
  });
}

const RAW_BODY = {
  detail: 'RAW-DETAIL-LEAK internal server detail',
  message: 'RAW-MESSAGE-LEAK backend message',
  code: 'RAW_CODE_LEAK',
  errors: [],
};

describe('mapDoctorsError (F-014 S9)', () => {
  describe('mapeo por estado HTTP', () => {
    it('status 0 avisa de conexión sin exponer la URL interna', () => {
      const mapped = mapDoctorsError(httpError(0));

      expect(mapped.message).toBe(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      );
      expect(mapped.message).not.toContain('backend-interno.test');
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('400 devuelve el mensaje de datos no válidos', () => {
      expect(mapDoctorsError(httpError(400, RAW_BODY)).message).toBe(
        'Los datos enviados no son válidos. Revisa el formulario.',
      );
    });

    it('401 devuelve el mensaje de sesión expirada', () => {
      expect(mapDoctorsError(httpError(401, RAW_BODY)).message).toBe(
        'Tu sesión expiró. Inicia sesión de nuevo.',
      );
    });

    it('403 devuelve el mensaje de permisos (red de seguridad del backend, S11)', () => {
      expect(mapDoctorsError(httpError(403, RAW_BODY)).message).toBe(
        'No tienes permiso para gestionar médicos.',
      );
    });

    it('404 devuelve el mensaje de médico inexistente', () => {
      expect(mapDoctorsError(httpError(404, RAW_BODY)).message).toBe(
        'El médico solicitado ya no existe. Actualiza la lista.',
      );
    });

    it('estados no contemplados (500, 502…) caen al mensaje genérico', () => {
      for (const status of [500, 502, 503, 418]) {
        expect(mapDoctorsError(httpError(status, RAW_BODY)).message).toBe(
          'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
        );
      }
    });

    it('un error que no es HttpErrorResponse cae al mensaje genérico', () => {
      for (const error of [new Error('boom'), 'fallo de red', 42, null, undefined]) {
        expect(mapDoctorsError(error).message).toBe(
          'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
        );
      }
    });
  });

  describe('409 (S2/S8)', () => {
    it('code doctor_has_visits traduce el bloqueo de desactivación por visitas (S8)', () => {
      const mapped = mapDoctorsError(
        httpError(409, { detail: 'RAW-DETAIL-LEAK', code: 'doctor_has_visits', errors: [] }),
      );

      expect(mapped.message).toBe(
        'No se puede desactivar el médico porque tiene visitas registradas.',
      );
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('cédula duplicada marca el campo cedula (S2)', () => {
      const mapped = mapDoctorsError(
        httpError(409, { detail: 'RAW-DETAIL-LEAK', code: 'doctor_exists', errors: [] }),
      );

      expect(mapped.message).toBe('Ya existe un médico con esa cédula.');
      expect(mapped.fieldErrors).toEqual({ cedula: 'Ya existe un médico con esa cédula.' });
    });

    it('reconoce el campo cedula desde errors[] cuando el code no viene', () => {
      const mapped = mapDoctorsError(
        httpError(409, { detail: 'RAW-DETAIL-LEAK', errors: [{ field: 'cedula' }] }),
      );

      expect(mapped.fieldErrors).toEqual({ cedula: 'Ya existe un médico con esa cédula.' });
    });

    it('un 409 sin code conocido (conflicto genérico) no inventa campo', () => {
      const mapped = mapDoctorsError(httpError(409, RAW_BODY));

      expect(mapped.message).toBe('Ya existe un médico con esos datos. Revisa la cédula.');
      expect(mapped.fieldErrors).toBeUndefined();
    });
  });

  describe('422 validación (S9)', () => {
    it('mapea los campos conocidos a mensajes propios en español', () => {
      const mapped = mapDoctorsError(
        httpError(422, {
          detail: 'RAW-DETAIL-LEAK',
          errors: [
            { field: 'name', message: 'RAW field detail' },
            { field: 'cedula', message: 'RAW field detail' },
            { field: 'lab_shift', message: 'RAW field detail' },
            { field: 'specialty', message: 'RAW field detail' },
          ],
        }),
      );

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toEqual({
        name: 'Revisa el nombre',
        cedula: 'Revisa la cédula',
        labShift: 'Revisa la tanda',
        specialty: 'Revisa la especialidad',
      });
    });

    it('conserva solo la primera ocurrencia de cada campo conocido', () => {
      const mapped = mapDoctorsError(
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
      const mapped = mapDoctorsError(
        httpError(422, {
          errors: [
            { field: 'is_active', message: 'unknown' },
            { field: 'user', message: 'x' },
          ],
        }),
      );

      expect(mapped.message).toBe('Revisa los datos ingresados.');
      expect(mapped.fieldErrors).toBeUndefined();
    });

    it('ignora entradas que no son objetos dentro de errors[] y los bodies sin array', () => {
      for (const body of [{ errors: ['cadena', null, 7] }, { errors: 'no-array' }, {}, null]) {
        const mapped = mapDoctorsError(httpError(422, body));

        expect(mapped.message).toBe('Revisa los datos ingresados.');
        expect(mapped.fieldErrors).toBeUndefined();
      }
    });
  });

  describe('los mensajes crudos del backend nunca se exponen (S9)', () => {
    it('ningún estado deja escapar detail/message/code ni URLs internas', () => {
      for (const status of [0, 400, 401, 403, 404, 409, 422, 500]) {
        const visible = JSON.stringify(mapDoctorsError(httpError(status, RAW_BODY)));

        expect(visible).not.toContain('RAW-DETAIL-LEAK');
        expect(visible).not.toContain('RAW-MESSAGE-LEAK');
        expect(visible).not.toContain('RAW_CODE_LEAK');
        expect(visible).not.toContain('backend-interno.test');
      }
    });

    it('el message crudo dentro de errors[] del 422 tampoco se expone', () => {
      const mapped = mapDoctorsError(
        httpError(422, { errors: [{ field: 'name', message: 'RAW-MESSAGE-LEAK' }] }),
      );

      expect(JSON.stringify(mapped)).not.toContain('RAW-MESSAGE-LEAK');
    });
  });
});
