import {
  CARNET_MAX_LENGTH,
  CEDULA_DIGITS,
  NAME_MAX_LENGTH,
  PATIENT_TYPES,
  PATIENT_TYPE_LABELS,
  PatientDto,
  cedulaDigits,
  formatCedula,
  isCedulaComplete,
  toPatient,
  toPatientListPage,
  toPatientPayload,
} from './patients.models';

function patientDto(overrides: Partial<PatientDto> = {}): PatientDto {
  return {
    id: 11,
    name: 'Ana Sintética',
    cedula: '12345678901',
    carnet: 'EST-001',
    patient_type: 'ESTUDIANTE',
    is_active: true,
    ...overrides,
  };
}

describe('patients.models (F-013 S3/S4/S5)', () => {
  describe('máscara de cédula XXX-XXXXXXX-X (S3)', () => {
    it('formatea 11 dígitos en bloques 3-7-1', () => {
      expect(formatCedula('12345678901')).toBe('123-4567890-1');
      expect(CEDULA_DIGITS).toBe(11);
    });

    it('formatea valores parciales sin separadores sobrantes', () => {
      expect(formatCedula('')).toBe('');
      expect(formatCedula('1')).toBe('1');
      expect(formatCedula('123')).toBe('123');
      expect(formatCedula('1234')).toBe('123-4');
      expect(formatCedula('1234567890')).toBe('123-4567890');
    });

    it('descarta separadores y cualquier carácter que no sea dígito', () => {
      expect(cedulaDigits('123-4567890-1')).toBe('12345678901');
      expect(cedulaDigits('V-12.345.678-9')).toBe('123456789');
      expect(cedulaDigits('  123 4567890 1  ')).toBe('12345678901');
      expect(cedulaDigits('abc')).toBe('');
    });

    it('recorta a 11 dígitos y es idempotente al reformatear', () => {
      expect(cedulaDigits('123456789012345')).toBe('12345678901');
      expect(formatCedula(formatCedula('12345678901'))).toBe('123-4567890-1');
      expect(formatCedula('123-4567890-1')).toBe('123-4567890-1');
    });

    it('isCedulaComplete exige exactamente 11 dígitos tras descartar separadores', () => {
      expect(isCedulaComplete('123-4567890-1')).toBe(true);
      expect(isCedulaComplete('123-4567890')).toBe(false);
      expect(isCedulaComplete('')).toBe(false);
      expect(isCedulaComplete('123456789012')).toBe(true);
    });

    it('tolera valores nulos o indefinidos sin romper', () => {
      expect(formatCedula(null)).toBe('');
      expect(formatCedula(undefined)).toBe('');
      expect(cedulaDigits(null)).toBe('');
      expect(isCedulaComplete(null)).toBe(false);
    });
  });

  describe('catálogo cerrado de tipos de paciente (S5)', () => {
    it('declara los cuatro valores del contrato en mayúsculas', () => {
      expect(PATIENT_TYPES).toEqual(['ESTUDIANTE', 'EMPLEADO', 'PROFESOR', 'OTROS']);
    });

    it('etiqueta cada valor con su forma capitalizada', () => {
      expect(PATIENT_TYPE_LABELS).toEqual({
        ESTUDIANTE: 'Estudiante',
        EMPLEADO: 'Empleado',
        PROFESOR: 'Profesor',
        OTROS: 'Otros',
      });
    });

    it('expone los límites del contrato', () => {
      expect(NAME_MAX_LENGTH).toBe(150);
      expect(CARNET_MAX_LENGTH).toBe(50);
    });
  });

  describe('mapeo snake_case ↔ camelCase (S1)', () => {
    it('toPatient mapea los seis campos planos sin created_at', () => {
      const patient = toPatient(patientDto());

      expect(patient).toEqual({
        id: 11,
        name: 'Ana Sintética',
        cedula: '12345678901',
        carnet: 'EST-001',
        patientType: 'ESTUDIANTE',
        isActive: true,
      });
      expect(patient).not.toHaveProperty('createdAt');
    });

    it('toPatient conserva carnet null', () => {
      expect(toPatient(patientDto({ carnet: null, patient_type: 'OTROS' })).carnet).toBeNull();
    });

    it('toPatientListPage mapea items/total/page/size/pages', () => {
      const page = toPatientListPage({
        items: [patientDto(), patientDto({ id: 12, is_active: false, patient_type: 'PROFESOR' })],
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
      expect(page.items[0].patientType).toBe('ESTUDIANTE');
      expect(page.items[1]).toEqual({
        id: 12,
        name: 'Ana Sintética',
        cedula: '12345678901',
        carnet: 'EST-001',
        patientType: 'PROFESOR',
        isActive: false,
      });
    });
  });

  describe('body de escritura (S3/S4/S5)', () => {
    it('envía la cédula sin máscara y el nombre recortado', () => {
      const payload = toPatientPayload({
        name: '  Ana Sintética  ',
        cedula: '123-4567890-1',
        carnet: 'EST-001',
        patientType: 'ESTUDIANTE',
        isActive: true,
      });

      expect(payload).toEqual({
        name: 'Ana Sintética',
        cedula: '12345678901',
        patient_type: 'ESTUDIANTE',
        carnet: 'EST-001',
        is_active: true,
      });
      expect(payload).not.toHaveProperty('id');
      expect(payload).not.toHaveProperty('created_at');
    });

    it('envía carnet null cuando el campo está vacío o solo tiene espacios (S4)', () => {
      for (const carnet of ['', '   ']) {
        expect(
          toPatientPayload({
            name: 'Luis Sintético',
            cedula: '12345678901',
            carnet,
            patientType: 'EMPLEADO',
            isActive: false,
          }).carnet,
        ).toBeNull();
      }
    });

    it('recorta el carnet cuando existe y respeta is_active false (S4)', () => {
      const payload = toPatientPayload({
        name: 'Luis Sintético',
        cedula: '12345678901',
        carnet: '  EMP-77  ',
        patientType: 'EMPLEADO',
        isActive: false,
      });

      expect(payload.carnet).toBe('EMP-77');
      expect(payload.is_active).toBe(false);
      expect(payload.patient_type).toBe('EMPLEADO');
    });

    it('nunca envía la cédula con letras ni separadores aunque lleguen crudos', () => {
      expect(
        toPatientPayload({
          name: 'Ana Sintética',
          cedula: 'V12345678901',
          carnet: '',
          patientType: 'OTROS',
          isActive: true,
        }).cedula,
      ).toBe('12345678901');
    });
  });
});
