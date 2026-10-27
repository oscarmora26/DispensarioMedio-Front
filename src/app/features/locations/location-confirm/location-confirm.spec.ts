import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LocationConfirmData, LocationConfirmDialog } from './location-confirm';

async function configure(data: LocationConfirmData): Promise<{
  fixture: ComponentFixture<LocationConfirmDialog>;
  dialogRefStub: { close: ReturnType<typeof vi.fn> };
}> {
  const dialogRefStub = { close: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [LocationConfirmDialog],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRefStub },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(LocationConfirmDialog);
  fixture.detectChanges();

  return { fixture, dialogRefStub };
}

describe('LocationConfirmDialog (F-011 S4)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('desactivar muestra título, descripción y botón destructivo sin eliminar datos', async () => {
    const { fixture } = await configure({ description: 'Analgésico', activate: false });

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Desactivar ubicación');
    expect(compiled.textContent).toContain('Analgésico');
    expect(compiled.textContent).toContain('Dejará de estar disponible para las recetas');
    expect(compiled.textContent).toContain('no elimina sus datos');

    const confirm = compiled.querySelector<HTMLButtonElement>('button.mat-warn');
    expect(confirm).not.toBeNull();
    expect(confirm?.textContent).toContain('Desactivar');
    expect(compiled.querySelector('button.mat-primary')).toBeNull();
  });

  it('activar muestra título, descripción y botón primario (no destructivo)', async () => {
    const { fixture } = await configure({ description: 'Analgésico', activate: true });

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Activar ubicación');
    expect(compiled.textContent).toContain('Analgésico');
    expect(compiled.textContent).toContain('Volverá a estar disponible para las recetas');
    expect(compiled.querySelector('button.mat-warn')).toBeNull();

    const confirm = compiled.querySelector<HTMLButtonElement>('button.mat-primary');
    expect(confirm).not.toBeNull();
    expect(confirm?.textContent).toContain('Activar');
  });

  it('confirmar la desactivación devuelve true al listado', async () => {
    const { fixture, dialogRefStub } = await configure({
      description: 'Analgésico',
      activate: false,
    });

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('button.mat-warn')?.click();

    expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
    expect(dialogRefStub.close).toHaveBeenCalledWith(true);
  });

  it('confirmar la activación devuelve true al listado', async () => {
    const { fixture, dialogRefStub } = await configure({
      description: 'Analgésico',
      activate: true,
    });

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('button.mat-primary')?.click();

    expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
    expect(dialogRefStub.close).toHaveBeenCalledWith(true);
  });

  it('«Cancelar» devuelve undefined (cierre sin efectos, como Escape/backdrop)', async () => {
    const { fixture, dialogRefStub } = await configure({
      description: 'Analgésico',
      activate: false,
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const cancel = Array.from(compiled.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Cancelar'),
    );
    expect(cancel).not.toBeUndefined();
    expect(cancel?.getAttribute('type')).toBe('button');

    cancel?.click();

    expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
    expect(dialogRefStub.close).toHaveBeenCalledWith(undefined);
  });
});
