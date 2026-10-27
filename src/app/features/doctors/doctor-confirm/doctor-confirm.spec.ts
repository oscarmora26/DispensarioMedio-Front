import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DoctorConfirmData, DoctorConfirmDialog } from './doctor-confirm';

async function configure(data: DoctorConfirmData): Promise<{
  fixture: ComponentFixture<DoctorConfirmDialog>;
  dialogRefStub: { close: ReturnType<typeof vi.fn> };
}> {
  const dialogRefStub = { close: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [DoctorConfirmDialog],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRefStub },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(DoctorConfirmDialog);
  fixture.detectChanges();

  return { fixture, dialogRefStub };
}

const DOCTOR: DoctorConfirmData = {
  name: 'Dra. Sintética',
  cedula: '12345678901',
  activate: false,
};

describe('DoctorConfirmDialog (F-014 S8)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('desactivar muestra título, médico con cédula con máscara y botón destructivo sin borrar datos (S8)', async () => {
    const { fixture } = await configure(DOCTOR);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Desactivar médico');
    expect(compiled.textContent).toContain('Dra. Sintética');
    expect(compiled.textContent).toContain('123-4567890-1');
    expect(compiled.textContent).toContain('Dejará de estar disponible');
    expect(compiled.textContent).toContain('no elimina sus datos');

    const confirm = compiled.querySelector<HTMLButtonElement>('button.mat-warn');
    expect(confirm).not.toBeNull();
    expect(confirm?.textContent).toContain('Desactivar');
    expect(compiled.querySelector('button.mat-primary')).toBeNull();
  });

  it('activar muestra título, médico y botón primario (no destructivo)', async () => {
    const { fixture } = await configure({ ...DOCTOR, activate: true });

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Activar médico');
    expect(compiled.textContent).toContain('Dra. Sintética');
    expect(compiled.textContent).toContain('Volverá a estar disponible');
    expect(compiled.querySelector('button.mat-warn')).toBeNull();

    const confirm = compiled.querySelector<HTMLButtonElement>('button.mat-primary');
    expect(confirm).not.toBeNull();
    expect(confirm?.textContent).toContain('Activar');
  });

  it('confirmar la desactivación devuelve true al listado', async () => {
    const { fixture, dialogRefStub } = await configure(DOCTOR);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.mat-warn')
      ?.click();

    expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
    expect(dialogRefStub.close).toHaveBeenCalledWith(true);
  });

  it('confirmar la activación devuelve true al listado', async () => {
    const { fixture, dialogRefStub } = await configure({ ...DOCTOR, activate: true });

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.mat-primary')
      ?.click();

    expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
    expect(dialogRefStub.close).toHaveBeenCalledWith(true);
  });

  it('«Cancelar» devuelve undefined (cierre sin efectos, como Escape/backdrop)', async () => {
    const { fixture, dialogRefStub } = await configure(DOCTOR);

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
