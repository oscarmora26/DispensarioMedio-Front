import {
  ANNULMENT_REASON_MAX_LENGTH,
  INSTRUCTIONS_MAX_LENGTH,
  QUERY_MAX_LENGTH,
  RECOMMENDATIONS_MAX_LENGTH,
  SYMPTOMS_MAX_LENGTH,
  SYMPTOMS_MIN_LENGTH,
  VISIT_STATUSES,
  combineVisitDateTime,
  formatVisitDateValue,
  formatVisitDateTime,
  isFutureVisitDateTime,
  normalizeQuantity,
  toAnnulPayload,
  toDateTimeLocalValue,
  toNaiveDateTime,
  toVisit,
  toVisitDateTimeParts,
  toVisitListPage,
  toVisitPayload,
  visitStatusLabel,
  endOfDayDateTime,
  startOfDayDateTime,
  type VisitFormInput,
  type VisitReadDto,
} from './visits.models';

/** Detalle sintético completo, con el mismo `snake_case` del contrato. */
function visitReadDto(overrides: Partial<VisitReadDto> = {}): VisitReadDto {
  return {
    id: 31,
    doctor: { id: 5, name: 'Dra. Sintética' },
    patient: { id: 9, name: 'Paciente Sintético', cedula: '12345678901' },
    visited_at: '2026-10-27T10:00:00',
    symptoms: 'Dolor de cabeza',
    recommendations: 'Reposo por 24 horas',
    status: 'ANULADA',
    created_by: 7,
    medications: [
      {
        medication_id: 3,
        description: 'Paracetamol sintético',
        dose: '500 mg',
        quantity: 2,
        instructions: 'Cada 8 horas',
      },
    ],
    annulled_at: '2026-10-28T09:00:00',
    annulled_by: 'admin.demo',
    annulment_reason: 'Registro duplicado',
    ...overrides,
  };
}

/** Entrada del formulario sintética (valores en hora de Santo Domingo). */
function formInput(overrides: Partial<VisitFormInput> = {}): VisitFormInput {
  return {
    patientId: 9,
    visitedAt: '2026-10-27T10:00',
    symptoms: '  Dolor de cabeza  ',
    recommendations: '   ',
    medications: [],
    ...overrides,
  };
}

describe('visits.models (F-015)', () => {
  describe('catálogo de estados (S1/S8)', () => {
    it('expone solo REGISTRADA y ANULADA con etiqueta capitalizada', () => {
      expect(VISIT_STATUSES).toEqual(['REGISTRADA', 'ANULADA']);
      expect(visitStatusLabel('REGISTRADA')).toBe('Registrada');
      expect(visitStatusLabel('ANULADA')).toBe('Anulada');
    });

    it('publica los límites del contrato', () => {
      expect(SYMPTOMS_MIN_LENGTH).toBe(3);
      expect(SYMPTOMS_MAX_LENGTH).toBe(2000);
      expect(RECOMMENDATIONS_MAX_LENGTH).toBe(2000);
      expect(ANNULMENT_REASON_MAX_LENGTH).toBe(500);
      expect(INSTRUCTIONS_MAX_LENGTH).toBe(255);
      expect(QUERY_MAX_LENGTH).toBe(200);
    });
  });

  describe('mapeo defensivo de VisitRead (S16)', () => {
    it('mapea el detalle completo con medicamentos y auditoría de anulación', () => {
      expect(toVisit(visitReadDto())).toEqual({
        id: 31,
        doctor: { id: 5, name: 'Dra. Sintética' },
        patient: { id: 9, name: 'Paciente Sintético', cedula: '12345678901' },
        visitedAt: '2026-10-27T10:00:00',
        symptoms: 'Dolor de cabeza',
        recommendations: 'Reposo por 24 horas',
        status: 'ANULADA',
        createdBy: 7,
        medications: [
          {
            medicationId: 3,
            description: 'Paracetamol sintético',
            dose: '500 mg',
            quantity: 2,
            instructions: 'Cada 8 horas',
          },
        ],
        annulledAt: '2026-10-28T09:00:00',
        annulledBy: 'admin.demo',
        annulmentReason: 'Registro duplicado',
      });
    });

    it('tolera un VisitRead sin recommendations, medications ni campos de anulación', () => {
      const visit = toVisit({
        id: 40,
        symptoms: 'Control',
        visited_at: '2026-10-27T08:00:00',
        status: 'REGISTRADA',
      });

      expect(visit.recommendations).toBeNull();
      expect(visit.medications).toEqual([]);
      expect(visit.annulledAt).toBeNull();
      expect(visit.annulledBy).toBeNull();
      expect(visit.annulmentReason).toBeNull();
      expect(visit.createdBy).toBeNull();
    });

    it('tolera un detalle sin doctor ni patient y un estado no previsto', () => {
      const visit = toVisit({ id: 41, symptoms: 'Control', status: 'EN_REVISION' });

      expect(visit.doctor).toEqual({ id: 0, name: '' });
      expect(visit.patient).toEqual({ id: 0, name: '', cedula: '' });
      expect(visit.status).toBe('REGISTRADA');
      expect(visit.visitedAt).toBe('');
    });

    it('tolera medicamentos con campos opcionales ausentes', () => {
      const visit = toVisit(visitReadDto({ medications: [{ medication_id: 3 }] }));

      expect(visit.medications).toEqual([
        { medicationId: 3, description: '', dose: '', quantity: null, instructions: null },
      ]);
    });

    it('ignora un medications que no es arreglo', () => {
      const visit = toVisit({
        id: 42,
        medications: null as unknown as VisitReadDto['medications'],
      });

      expect(visit.medications).toEqual([]);
    });
  });

  describe('listado paginado (S1)', () => {
    it('mapea items/total/page/size/pages con visitante y paciente', () => {
      const page = toVisitListPage({
        items: [
          {
            id: 31,
            doctor: { id: 5, name: 'Dra. Sintética' },
            patient: { id: 9, name: 'Paciente Sintético', cedula: '12345678901' },
            visited_at: '2026-10-27T10:00:00',
            symptoms: 'Dolor de cabeza',
            status: 'REGISTRADA',
            created_by: 7,
          },
        ],
        total: 1,
        page: 1,
        size: 20,
        pages: 1,
      });

      expect(page).toEqual({
        items: [
          {
            id: 31,
            doctor: { id: 5, name: 'Dra. Sintética' },
            patient: { id: 9, name: 'Paciente Sintético', cedula: '12345678901' },
            visitedAt: '2026-10-27T10:00:00',
            symptoms: 'Dolor de cabeza',
            status: 'REGISTRADA',
            createdBy: 7,
          },
        ],
        total: 1,
        page: 1,
        size: 20,
        pages: 1,
      });
    });
  });

  describe('payload de registro y edición (S3/S4/S10)', () => {
    it('nunca envía doctor_id: el médico sale del token y no se elige en el formulario (S3/S11)', () => {
      const payload = toVisitPayload(formInput());

      expect('doctor_id' in payload).toBe(false);
      expect(Object.keys(payload)).toEqual([
        'patient_id',
        'visited_at',
        'symptoms',
        'recommendations',
        'medications',
      ]);
      expect(payload.patient_id).toBe(9);
      expect(payload.symptoms).toBe('Dolor de cabeza');
      expect(payload.recommendations).toBeNull();
      expect(payload.medications).toEqual([]);
    });

    it('tolera un paciente sin seleccionar sin agregar claves extrañas', () => {
      const payload = toVisitPayload(formInput({ patientId: null }));

      expect(Object.keys(payload)).toEqual([
        'patient_id',
        'visited_at',
        'symptoms',
        'recommendations',
        'medications',
      ]);
      expect(JSON.stringify(payload)).not.toContain('doctor_id');
    });

    it('envía visited_at sin zona y con segundos', () => {
      expect(toVisitPayload(formInput()).visited_at).toBe('2026-10-27T10:00:00');
      expect(toVisitPayload(formInput({ visitedAt: '2026-10-27T10:00:30' })).visited_at).toBe(
        '2026-10-27T10:00:30',
      );
      expect(toVisitPayload(formInput()).visited_at).not.toMatch(/Z|[+-]\d{2}:\d{2}$/);
    });

    it('recorta recomendaciones y las envía como null cuando quedan vacías', () => {
      expect(toVisitPayload(formInput({ recommendations: '  Reposo  ' })).recommendations).toBe(
        'Reposo',
      );
      expect(toVisitPayload(formInput({ recommendations: '' })).recommendations).toBeNull();
    });

    it('normaliza los medicamentos y descarta las filas sin medicamento', () => {
      const payload = toVisitPayload(
        formInput({
          medications: [
            { medicationId: 3, quantity: '2', instructions: '  Cada 8 horas  ' },
            { medicationId: null, quantity: '5', instructions: '' },
            { medicationId: 4, quantity: '', instructions: '   ' },
          ],
        }),
      );

      expect(payload.medications).toEqual([
        { medication_id: 3, quantity: 2, instructions: 'Cada 8 horas' },
        { medication_id: 4, quantity: null, instructions: null },
      ]);
    });
  });

  describe('cantidad de la visita (S4)', () => {
    it('convierte a número solo cuando el texto es un número mayor que cero', () => {
      expect(normalizeQuantity('2')).toBe(2);
      expect(normalizeQuantity(' 2.5 ')).toBe(2.5);
      expect(normalizeQuantity('1 tableta')).toBe('1 tableta');
      expect(normalizeQuantity('0')).toBe('0');
      expect(normalizeQuantity('   ')).toBeNull();
      expect(normalizeQuantity('')).toBeNull();
    });
  });

  describe('rango de fechas de los filtros (S2)', () => {
    it('convierte los campos tipo date en el rango inclusivo del día', () => {
      expect(startOfDayDateTime('2026-10-01')).toBe('2026-10-01T00:00:00');
      expect(endOfDayDateTime('2026-10-31')).toBe('2026-10-31T23:59:59');
      expect(startOfDayDateTime(' 2026-10-01 ')).toBe('2026-10-01T00:00:00');
    });
  });

  describe('payload de anulación (S7)', () => {
    it('recorta el motivo', () => {
      expect(toAnnulPayload('  Registro duplicado  ')).toEqual({ reason: 'Registro duplicado' });
    });
  });

  describe('fechas en America/Santo_Domingo (S10)', () => {
    it('convierte un instante al reloj de Santo Domingo sin zona', () => {
      expect(toNaiveDateTime(new Date('2026-10-27T14:00:00Z'))).toBe('2026-10-27T10:00:00');
      // Cambio de día hacia atrás: 02:00 UTC del 28 son las 22:00 del 27 en UTC-4.
      expect(toNaiveDateTime(new Date('2026-10-28T02:00:00Z'))).toBe('2026-10-27T22:00:00');
    });

    it('muestra las fechas siempre en UTC-4, también cuando el valor trae zona', () => {
      expect(formatVisitDateTime('2026-10-27T10:00:00')).toContain('10:00');
      expect(formatVisitDateTime('2026-10-27T10:00:00')).toContain('2026');
      // El mismo instante expresado en UTC se muestra en hora de Santo Domingo.
      expect(formatVisitDateTime('2026-10-27T14:00:00Z')).toContain('10:00');
      expect(formatVisitDateTime('2026-10-27T14:00:00Z')).toContain('27/10/2026');
    });

    it('devuelve el marcador de ausencia para valores vacíos o inválidos', () => {
      expect(formatVisitDateTime(null)).toBe('—');
      expect(formatVisitDateTime('')).toBe('—');
      expect(formatVisitDateTime('no-es-fecha')).toBe('—');
    });

    it('precarga el input datetime-local en hora de Santo Domingo', () => {
      expect(toDateTimeLocalValue('2026-10-27T10:00:00')).toBe('2026-10-27T10:00');
      expect(toDateTimeLocalValue('2026-10-27T14:00:00Z')).toBe('2026-10-27T10:00');
      expect(toDateTimeLocalValue(null)).toBe('');
      expect(toDateTimeLocalValue('')).toBe('');
    });

    it('rechaza una visita futura con una tolerancia de un minuto', () => {
      const now = new Date('2026-10-27T10:00:00-04:00');

      expect(isFutureVisitDateTime('2026-10-27T09:59:00', now)).toBe(false);
      expect(isFutureVisitDateTime('2026-10-27T10:00:30', now)).toBe(false);
      expect(isFutureVisitDateTime('2026-10-27T10:02:00', now)).toBe(true);
      // El valor vacío lo resuelve `required`, no esta regla.
      expect(isFutureVisitDateTime('', now)).toBe(false);
      expect(isFutureVisitDateTime('no-es-fecha', now)).toBe(false);
    });

    it('compone el reloj de pared con la fecha del calendario y los selects (S10)', () => {
      expect(combineVisitDateTime(new Date(2026, 9, 27), '10', '05')).toBe('2026-10-27T10:05');
      expect(combineVisitDateTime(new Date(2026, 0, 3), '00', '00')).toBe('2026-01-03T00:00');
      // Falta alguna pieza: el validador `required` decide, no se inventa la hora.
      expect(combineVisitDateTime(null, '10', '05')).toBe('');
      expect(combineVisitDateTime(new Date(2026, 9, 27), '', '05')).toBe('');
      expect(combineVisitDateTime(new Date(2026, 9, 27), '10', '')).toBe('');
      // Fuera de los rangos cerrados 00-23 y 00-59 no se compone nada.
      expect(combineVisitDateTime(new Date(2026, 9, 27), '24', '00')).toBe('');
      expect(combineVisitDateTime(new Date(2026, 9, 27), '10', '60')).toBe('');
    });

    it('publica el día del calendario del datepicker sin desplazarlo de zona', () => {
      expect(formatVisitDateValue(new Date(2026, 9, 1))).toBe('2026-10-01');
      expect(formatVisitDateValue(new Date(2026, 0, 1))).toBe('2026-01-01');
      expect(formatVisitDateValue(null)).toBe('');
      expect(formatVisitDateValue(new Date('no-es-fecha'))).toBe('');
    });

    it('descompone un visited_at guardado en fecha, hora y minuto', () => {
      expect(toVisitDateTimeParts('2026-10-27T10:00:00')).toEqual({
        date: new Date(2026, 9, 27),
        hour: '10',
        minute: '00',
      });
      // El mismo instante en UTC se descompone en el reloj de Santo Domingo.
      expect(toVisitDateTimeParts('2026-10-27T14:00:00Z')).toEqual({
        date: new Date(2026, 9, 27),
        hour: '10',
        minute: '00',
      });
      expect(toVisitDateTimeParts('')).toEqual({ date: null, hour: '', minute: '' });
      expect(toVisitDateTimeParts(null)).toEqual({ date: null, hour: '', minute: '' });
    });
  });
});
