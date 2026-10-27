import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PatientsToast } from './patients-toast';

describe('PatientsToast (F-013 S9, patrón F-009)', () => {
  let toast: PatientsToast;
  let snackStub: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    snackStub = { open: vi.fn() };
    await TestBed.configureTestingModule({
      providers: [PatientsToast, { provide: MatSnackBar, useValue: snackStub }],
    }).compileComponents();

    toast = TestBed.inject(PatientsToast);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('éxitos: 2000 ms, polite (role=status), sin acción, center/bottom', () => {
    it.each([
      ['showCreated', 'Paciente creado.'],
      ['showUpdated', 'Paciente actualizado.'],
      ['showActivated', 'Paciente activado.'],
      ['showDeactivated', 'Paciente desactivado.'],
    ])('%s anuncia %p sin acción de cierre', (method, message) => {
      (toast[method as keyof PatientsToast] as () => void)();

      expect(snackStub.open).toHaveBeenCalledTimes(1);
      expect(snackStub.open).toHaveBeenCalledWith(message, undefined, {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        politeness: 'polite',
      });
    });

    it('showSuccess genérico usa 2000 ms polite sin acción', () => {
      toast.showSuccess('Aviso sintético de éxito');

      expect(snackStub.open).toHaveBeenCalledWith('Aviso sintético de éxito', undefined, {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        politeness: 'polite',
      });
    });
  });

  describe('errores: 5000 ms, assertive (role=alert), con «Cerrar», center/bottom', () => {
    it('showError usa 5000 ms assertive con acción «Cerrar»', () => {
      toast.showError('Fallo sintético de mutación');

      expect(snackStub.open).toHaveBeenCalledTimes(1);
      expect(snackStub.open).toHaveBeenCalledWith('Fallo sintético de mutación', 'Cerrar', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        politeness: 'assertive',
      });
    });

    it('el error dura más que el éxito (5000 ms frente a 2000 ms)', () => {
      toast.showCreated();
      toast.showError('Error sintético');

      expect(snackStub.open.mock.calls[0][2]).toMatchObject({ duration: 2000 });
      expect(snackStub.open.mock.calls[1][2]).toMatchObject({ duration: 5000 });
      expect(snackStub.open.mock.calls[1][2].duration).toBeGreaterThan(
        snackStub.open.mock.calls[0][2].duration,
      );
    });
  });

  describe('sin robo de foco', () => {
    it('mostrar un toast no mueve el foco del control activo', () => {
      const guard = document.createElement('button');
      guard.type = 'button';
      guard.textContent = 'guardián de foco';
      guard.className = 'toast-focus-guard';
      document.body.appendChild(guard);
      guard.focus();
      expect(document.activeElement).toBe(guard);

      toast.showDeactivated();
      toast.showError('Fallo sintético');

      expect(document.activeElement).toBe(guard);
      guard.remove();
    });
  });
});
