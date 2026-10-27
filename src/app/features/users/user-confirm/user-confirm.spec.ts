import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { UserConfirmData, UserConfirmDialog } from './user-confirm';

async function configure(data: UserConfirmData): Promise<{
  fixture: ComponentFixture<UserConfirmDialog>;
  dialogRefStub: { close: ReturnType<typeof vi.fn> };
}> {
  const dialogRefStub = { close: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [UserConfirmDialog],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRefStub },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(UserConfirmDialog);
  fixture.detectChanges();

  return { fixture, dialogRefStub };
}

describe('UserConfirmDialog (F-006 CA-08/CA-13)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('desactivar muestra título, usuario y botón destructivo sin eliminar datos (CA-08)', async () => {
    const { fixture } = await configure({
      username: 'aperez',
      activate: false,
      isLastVisibleAdmin: false,
    });

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Desactivar usuario');
    expect(compiled.textContent).toContain('aperez');
    expect(compiled.textContent).toContain('no elimina sus datos');

    const confirm = compiled.querySelector<HTMLButtonElement>('button.mat-warn');
    expect(confirm).not.toBeNull();
    expect(confirm?.textContent).toContain('Desactivar');
    const cancel = Array.from(compiled.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Cancelar'),
    );
    expect(cancel).not.toBeUndefined();
  });

  it('activar usa botón primario (no destructivo) e informa que vuelve a entrar (CA-08)', async () => {
    const { fixture } = await configure({
      username: 'aperez',
      activate: true,
      isLastVisibleAdmin: false,
    });

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Activar usuario');
    expect(compiled.textContent).toContain('Volverá a poder iniciar sesión');
    expect(compiled.querySelector('button.mat-warn')).toBeNull();

    const confirm = Array.from(compiled.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Activar'),
    );
    expect(confirm).not.toBeUndefined();
  });

  it('advierte en role=note solo al desactivar al último ADMIN visible (§7, CA-08)', async () => {
    const { fixture } = await configure({
      username: 'admin.demo',
      activate: false,
      isLastVisibleAdmin: true,
    });

    const note = (fixture.nativeElement as HTMLElement).querySelector('[role="note"]');
    expect(note).not.toBeNull();
    expect(note?.textContent).toContain('único administrador activo');
  });

  it('sin último ADMIN visible no muestra la advertencia (CA-08)', async () => {
    const { fixture } = await configure({
      username: 'aperez',
      activate: false,
      isLastVisibleAdmin: false,
    });

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="note"]')).toBeNull();
  });

  it('al activar no muestra la advertencia aunque sea último ADMIN (CA-08)', async () => {
    const { fixture } = await configure({
      username: 'admin.demo',
      activate: true,
      isLastVisibleAdmin: true,
    });

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="note"]')).toBeNull();
  });
});
