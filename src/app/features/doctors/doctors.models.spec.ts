import {
  CEDULA_DIGITS,
  DoctorDto,
  LAB_SHIFTS,
  LAB_SHIFT_LABELS,
  LAB_SHIFT_MAX_LENGTH,
  NAME_MAX_LENGTH,
  SEARCH_MAX_LENGTH,
  SPECIALTY_MAX_LENGTH,
  cedulaDigits,
  formatCedula,
  isCedulaComplete,
  labShiftLabel,
  labShiftOptions,
  toDoctor,
  toDoctorListPage,
  toDoctorPayload,
} from './doctors.models';

function doctorDto(overrides: Partial<DoctorDto> = {}): DoctorDto {
  return {
    id: 21,
    name: 'Dra. Sintética',
    cedula: '12345678901',
    lab_shift: 'MATUTINA',
    specialty: 'Medicina general',
    is_active: true,
    user: { id: 7, username: 'medico.demo', is_active: true },
    ...overrides,
  };
}

describe('doctors.models (F-014 S3/S4/S5/S6)', () => {
  describe('máscara de cédula XXX-XXXXXXX-X compartida con F-013 (S3)', () => {
    it('formatea 11 dígitos en bloques 3-7-1', () => {
      expect(formatCedula('12345678901')).toBe('123-4567890-1');
      expect(CEDULA_DIGITS).toBe(11);
    });

    it('formatea valores parciales sin separadores sobrantes', () => {
      expect(formatCedula('')).toBe('');
      expect(formatCedula('1')).toBe('1');
      expect(formatCedula('1234')).toBe('123-4');
      expect(formatCedula('1234567890')).toBe('123-4567890');
    });

    it('descarta separadores y cualquier carácter que no sea dígito', () => {
      expect(cedulaDigits('123-4567890-1')).toBe('12345678901');
      expect(cedulaDigits('V-12.345.678-9')).toBe('123456789');
      expect(cedulaDigits('abc')).toBe('');
    });

    it('recorta a 11 dígitos y es idempotente al reformatear', () => {
      expect(cedulaDigits('123456789012345')).toBe('12345678901');
      expect(formatCedula(formatCedula('12345678901'))).toBe('123-4567890-1');
    });

    it('isCedulaComplete exige exactamente 11 dígitos tras descartar separadores', () => {
      expect(isCedulaComplete('123-4567890-1')).toBe(true);
      expect(isCedulaComplete('123-4567890')).toBe(false);
      expect(isCedulaComplete('')).toBe(false);
    });
  });

  describe('tanda cerrada (S4)', () => {
    it('declara las cuatro tandas del contrato y su etiqueta', () => {
      expect(LAB_SHIFTS).toEqual(['MATUTINA', 'VESPERTINA', 'NOCTURNA', 'MIXTA']);
      expect(LAB_SHIFT_LABELS).toEqual({
        MATUTINA: 'Matutina',
        VESPERTINA: 'Vespertina',
        NOCTURNA: 'Nocturna',
        MIXTA: 'Mixta',
      });
    });

    it('etiqueta cada tanda con su forma capitalizada y respeta un valor no canónico', () => {
      expect(labShiftLabel('MATUTINA')).toBe('Matutina');
      expect(labShiftLabel('MIXTA')).toBe('Mixta');
      expect(labShiftLabel('TARDE')).toBe('TARDE');
    });

    it('ofrece solo las cuatro opciones canónicas cuando no hay registro precargado', () => {
      expect(labShiftOptions()).toEqual(LAB_SHIFTS);
      expect(labShiftOptions(null)).toEqual(LAB_SHIFTS);
      expect(labShiftOptions('')).toEqual(LAB_SHIFTS);
      expect(labShiftOptions('  ')).toEqual(LAB_SHIFTS);
      expect(labShiftOptions('VESPERTINA')).toEqual(LAB_SHIFTS);
    });

    it('agrega el valor almacenado no canónico como opción extra para no perderlo (S4)', () => {
      expect(labShiftOptions('TARDE')).toEqual([...LAB_SHIFTS, 'TARDE']);
      expect(labShiftOptions('  TARDE  ')).toEqual([...LAB_SHIFTS, 'TARDE']);
    });

    it('expone los límites del contrato', () => {
      expect(NAME_MAX_LENGTH).toBe(150);
      expect(SPECIALTY_MAX_LENGTH).toBe(100);
      expect(LAB_SHIFT_MAX_LENGTH).toBe(50);
      expect(SEARCH_MAX_LENGTH).toBe(100);
    });
  });

  describe('mapeo snake_case ↔ camelCase (S1/S6)', () => {
    it('toDoctor mapea los seis campos planos y la cuenta asociada de solo lectura', () => {
      const doctor = toDoctor(doctorDto());

      expect(doctor).toEqual({
        id: 21,
        name: 'Dra. Sintética',
        cedula: '12345678901',
        labShift: 'MATUTINA',
        specialty: 'Medicina general',
        isActive: true,
        user: { id: 7, username: 'medico.demo', isActive: true },
      });
      expect(doctor).not.toHaveProperty('createdAt');
    });

    it('toDoctor deja user en null cuando el médico no tiene cuenta asociada (S6)', () => {
      expect(toDoctor(doctorDto({ user: null })).user).toBeNull();
      // `user` no es obligatorio en `required`: se mapea defensivamente.
      const withoutUser = doctorDto();
      delete (withoutUser as { user?: unknown }).user;
      expect(toDoctor(withoutUser).user).toBeNull();
    });

    it('toDoctor conserva una tanda no canónica sin normalizarla (S4)', () => {
      expect(toDoctor(doctorDto({ lab_shift: 'TARDE' })).labShift).toBe('TARDE');
    });

    it('toDoctorListPage mapea items/total/page/size/pages', () => {
      const page = toDoctorListPage({
        items: [doctorDto(), doctorDto({ id: 22, user: null, is_active: false })],
        total: 42,
        page: 2,
        size: 20,
        pages: 3,
      });

      expect(page.total).toBe(42);
      expect(page.page).toBe(2);
      expect(page.size).toBe(20);
      expect(page.pages).toBe(3);
      expect(page.items).toHaveLength(2);
      expect(page.items[1]).toEqual({
        id: 22,
        name: 'Dra. Sintética',
        cedula: '12345678901',
        labShift: 'MATUTINA',
        specialty: 'Medicina general',
        isActive: false,
        user: null,
      });
    });
  });

  describe('body de escritura (S2/S3/S4/S5/S6)', () => {
    it('envía la cédula sin máscara y recorta nombre, tanda y especialidad', () => {
      const payload = toDoctorPayload({
        name: '  Dra. Sintética  ',
        cedula: '123-4567890-1',
        labShift: '  MATUTINA  ',
        specialty: '  Medicina general  ',
        isActive: true,
      });

      expect(payload).toEqual({
        name: 'Dra. Sintética',
        cedula: '12345678901',
        lab_shift: 'MATUTINA',
        specialty: 'Medicina general',
        is_active: true,
      });
      expect(payload).not.toHaveProperty('id');
      expect(payload).not.toHaveProperty('created_at');
      // La asociación es de solo lectura: nunca viaja en el body (S6).
      expect(payload).not.toHaveProperty('user');
    });

    it('respeta is_active false', () => {
      const payload = toDoctorPayload({
        name: 'Dr. Sintético',
        cedula: '12345678901',
        labShift: 'NOCTURNA',
        specialty: 'Pediatría',
        isActive: false,
      });

      expect(payload.is_active).toBe(false);
      expect(payload.lab_shift).toBe('NOCTURNA');
    });

    it('nunca envía la cédula con letras ni separadores aunque lleguen crudos', () => {
      expect(
        toDoctorPayload({
          name: 'Dr. Sintético',
          cedula: 'V-12.345.678-9',
          labShift: 'MIXTA',
          specialty: 'Cardiología',
          isActive: true,
        }).cedula,
      ).toBe('123456789');
    });

    it('conserva una tanda no canónica tal como se capturó (S4)', () => {
      expect(
        toDoctorPayload({
          name: 'Dr. Sintético',
          cedula: '12345678901',
          labShift: ' TARDE ',
          specialty: 'Cardiología',
          isActive: true,
        }).lab_shift,
      ).toBe('TARDE');
    });
  });
});
