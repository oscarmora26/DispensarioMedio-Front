import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PatientConfirmData, PatientConfirmDialog } from './patient-confirm';

async function configure(data: PatientConfirmData): Promise<{
  fixture: ComponentFixture<PatientConfirmDialog>;
  dialogRefStub: { close: ReturnType<typeof vi.fn> };
}> {
  const dialogRefStub = { close: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [PatientConfirmDialog],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRefStub },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(PatientConfirmDialog);
  fixture.detectChanges();

  return { fixture, dialogRefStub };
}

const PATIENT: PatientConfirmData = {
  name: 'Ana Sintética',
  cedula: '12345678901',
  activate: false,
};

describe('PatientConfirmDialog (F-013 S7)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('desactivar muestra título, paciente con cédula con máscara y botón destructivo sin borrar datos', async () => {
    const { fixture } = await configure(PATIENT);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Desactivar paciente');
    expect(compiled.textContent).toContain('Ana Sintética');
    expect(compiled.textContent).toContain('123-4567890-1');
    expect(compiled.textContent).toContain('Dejará de estar disponible');
    expect(compiled.textContent).toContain('no elimina sus datos');

    const confirm = compiled.querySelector<HTMLButtonElement>('button.mat-warn');
    expect(confirm).not.toBeNull();
    expect(confirm?.textContent).toContain('Desactivar');
    expect(compiled.querySelector('button.mat-primary')).toBeNull();
  });

  it('activar muestra título, paciente y botón primario (no destructivo)', async () => {
    const { fixture } = await configure({ ...PATIENT, activate: true });

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Activar paciente');
    expect(compiled.textContent).toContain('Ana Sintética');
    expect(compiled.textContent).toContain('Volverá a estar disponible');
    expect(compiled.querySelector('button.mat-warn')).toBeNull();

    const confirm = compiled.querySelector<HTMLButtonElement>('button.mat-primary');
    expect(confirm).not.toBeNull();
    expect(confirm?.textContent).toContain('Activar');
  });

  it('confirmar la desactivación devuelve true al listado', async () => {
    const { fixture, dialogRefStub } = await configure(PATIENT);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.mat-warn')
      ?.click();

    expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
    expect(dialogRefStub.close).toHaveBeenCalledWith(true);
  });

  it('confirmar la activación devuelve true al listado', async () => {
    const { fixture, dialogRefStub } = await configure({ ...PATIENT, activate: true });

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.mat-primary')
      ?.click();

    expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
    expect(dialogRefStub.close).toHaveBeenCalledWith(true);
  });

  it('«Cancelar» devuelve undefined (cierre sin efectos, como Escape/backdrop)', async () => {
    const { fixture, dialogRefStub } = await configure(PATIENT);

    const cancel = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Cancelar'));
    expect(cancel).not.toBeUndefined();
    expect(cancel?.getAttribute('type')).toBe('button');

    cancel?.click();

    expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
    expect(dialogRefStub.close).toHaveBeenCalledWith(undefined);
  });
});
