import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VisitsToast } from './visits-toast';

describe('VisitsToast (F-015 S13)', () => {
  let toast: VisitsToast;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    open = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: { open } }],
    });
    toast = TestBed.inject(VisitsToast);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('anuncia los éxitos como role="status" (polite) durante 2000 ms sin acción', () => {
    toast.showCreated();
    toast.showUpdated();
    toast.showAnnulled();

    expect(open).toHaveBeenNthCalledWith(1, 'Visita registrada.', undefined, {
      duration: 2000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      politeness: 'polite',
    });
    expect(open).toHaveBeenNthCalledWith(2, 'Visita actualizada.', undefined, {
      duration: 2000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      politeness: 'polite',
    });
    expect(open).toHaveBeenNthCalledWith(3, 'Visita anulada.', undefined, {
      duration: 2000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      politeness: 'polite',
    });
  });

  it('anuncia los errores como role="alert" (assertive) durante 5000 ms con «Cerrar»', () => {
    toast.showError('La visita ya estaba anulada.');

    expect(open).toHaveBeenCalledWith('La visita ya estaba anulada.', 'Cerrar', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      politeness: 'assertive',
    });
  });

  it('permite un éxito con mensaje propio', () => {
    toast.showSuccess('Visita sincronizada.');

    expect(open).toHaveBeenCalledWith(
      'Visita sincronizada.',
      undefined,
      expect.objectContaining({ politeness: 'polite' }),
    );
  });
});
