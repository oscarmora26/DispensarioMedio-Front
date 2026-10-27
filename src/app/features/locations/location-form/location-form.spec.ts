import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { LocationFormData, LocationFormDialog } from './location-form';

const SHELVES_URL = `${environment.apiUrl}/v1/shelves`;
const CELLS_URL = `${environment.apiUrl}/v1/cells`;

function cellDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 11,
    shelf_id: 7,
    section: 'A',
    cell: '1',
    description: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function shelfDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 7,
    name: 'Estante A',
    description: 'Pasillo principal',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    cells: [cellDto(), cellDto({ id: 12, section: 'A', cell: '2', description: 'alta' })],
    ...overrides,
  };
}

async function configure(data: LocationFormData): Promise<{
  fixture: ComponentFixture<LocationFormDialog>;
  component: LocationFormDialog;
  httpMock: HttpTestingController;
  dialogRefStub: { close: ReturnType<typeof vi.fn> };
}> {
  const dialogRefStub = { close: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [LocationFormDialog],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRefStub },
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(LocationFormDialog);
  const component = fixture.componentInstance;

  return { fixture, component, httpMock, dialogRefStub };
}

describe('LocationFormDialog (F-011 S2/S3/S8, estante en /v1/shelves y celdas en /v1/cells)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('modo creación (S2)', () => {
    let fixture: ComponentFixture<LocationFormDialog>;
    let component: LocationFormDialog;
    let httpMock: HttpTestingController;
    let dialogRefStub: { close: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      TestBed.resetTestingModule();
      ({ fixture, component, httpMock, dialogRefStub } = await configure({ mode: 'create' }));
      fixture.detectChanges();
    });

    afterEach(() => {
      httpMock.verify();
    });

    function compiled(): HTMLElement {
      return fixture.nativeElement as HTMLElement;
    }

    function addCell(values: { section?: string; cell?: string; description?: string } = {}): void {
      compiled().querySelector<HTMLButtonElement>('.dm-location-form__add-cell')?.click();
      fixture.detectChanges();
      const index = component.form.controls.cells.length - 1;
      const group = component.form.controls.cells.at(index);
      group.controls.section.setValue(values.section ?? 'A');
      group.controls.cell.setValue(values.cell ?? '1');
      group.controls.description.setValue(values.description ?? '');
      fixture.detectChanges();
    }

    function dataRows(): Element[] {
      return Array.from(compiled().querySelectorAll('.dm-location-form__cell-row'));
    }

    /**
     * CSS compilado propio del formulario que Angular inyecta en el documento
     * (encapsulación emulada → `<style>` en `<head>`).
     */
    function ownStyleText(): string {
      return Array.from(document.querySelectorAll('style'))
        .map((style) => style.textContent ?? '')
        .filter((css) => css.includes('.dm-location-form'))
        .join('\n');
    }

    it('nombra al estante en el título y en el botón de envío (cambio 1)', () => {
      expect(compiled().textContent).toContain('Nuevo estante');
      expect(compiled().textContent).not.toContain('Nueva ubicación');
      expect(compiled().textContent).toContain('Crear estante');
      expect(compiled().querySelector('button[type="submit"]')?.textContent).toContain(
        'Crear estante',
      );
    });

    it('muestra etiquetas, hints y maxlength del contrato (S2/S9)', () => {
      const nameInput = compiled().querySelector('input[formControlName="name"]');
      const descriptionInput = compiled().querySelector('input[formControlName="description"]');

      expect(compiled().textContent).toContain('Nombre del estante');
      expect(compiled().textContent).toContain('Entre 2 y 100 caracteres.');
      expect(nameInput?.getAttribute('maxlength')).toBe('100');
      expect(nameInput?.getAttribute('autocomplete')).toBe('off');
      expect(compiled().textContent).toContain('Descripción');
      expect(compiled().textContent).toContain('Máximo 200 caracteres.');
      expect(descriptionInput?.getAttribute('maxlength')).toBe('200');
      expect(compiled().textContent).toContain('Agregar celda');
    });

    it('el checkbox «Estante activo» existe y nace marcado (D-5)', () => {
      const activeCheckbox = compiled().querySelector('.dm-location-form__active');

      expect(activeCheckbox?.textContent).toContain('Estante activo');
      expect(component.form.controls.isActive.value).toBe(true);
    });

    it('el editor de celdas es una tabla de una sola fila por celda con cabecera visible (cambio 2)', () => {
      addCell({ section: 'A', cell: '1' });
      addCell({ section: 'A', cell: '2', description: 'alta' });

      const head = compiled().querySelector('.dm-location-form__cell-head');
      expect(head).not.toBeNull();
      const headings = Array.from(
        compiled().querySelectorAll('.dm-location-form__cell-heading'),
      ).map((heading) => heading.textContent?.trim());
      expect(headings).toEqual(['Tramo', 'Celda', 'Descripción', 'Estado', 'Eliminar']);
      expect(headings.filter((text) => text === 'Tramo')).toHaveLength(1);

      // Una fila de datos por celda, y la cabecera no cuenta como fila.
      const rows = dataRows();
      expect(rows).toHaveLength(2);
      expect(head?.classList.contains('dm-location-form__cell-row')).toBe(false);

      // Cada fila es una sola línea alineada: 5 columnas, 3 campos de texto,
      // la casilla de estado y el botón de eliminar.
      for (const row of rows) {
        expect(row.querySelectorAll('[role="cell"]')).toHaveLength(5);
        expect(row.querySelectorAll('mat-form-field')).toHaveLength(3);
        expect(row.querySelectorAll('mat-checkbox')).toHaveLength(1);
        expect(row.querySelectorAll('button')).toHaveLength(1);
      }

      const firstLabels = Array.from(rows[0].querySelectorAll('mat-label')).map((label) =>
        label.textContent?.trim(),
      );
      expect(firstLabels).toEqual(['Tramo', 'Celda', 'Descripción']);
      expect(rows[0].querySelector('mat-checkbox')?.textContent).toContain('Activa');
    });

    it('la cabecera y las filas comparten una única plantilla de rejilla (cambio 2)', () => {
      addCell();

      const css = ownStyleText();

      expect(css).toContain('.dm-location-form__cell-head');
      expect(css).toContain('--dm-location-form-cells-columns');
      expect(css).toMatch(
        /--dm-location-form-cells-columns:\s*[^;]*minmax\(6rem, 1fr\)\s+minmax\(6rem, 1fr\)\s+minmax\(10rem, 2fr\)/,
      );
      // Cabecera y filas usan la misma variable: las columnas quedan alineadas.
      expect(css).toMatch(/grid-template-columns:\s*var\(--dm-location-form-cells-columns\)/);
      // Solo tokens del sistema: sin hex literales ni `::ng-deep`.
      expect(css).toContain('var(--dm-');
      expect(css).not.toContain('::ng-deep');
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });

    it('el botón de eliminar es un icono con nombre accesible «Eliminar celda N» (cambio 2)', () => {
      addCell({ section: 'A', cell: '1' });
      addCell({ section: 'A', cell: '2' });

      const removeButtons = Array.from(
        compiled().querySelectorAll<HTMLButtonElement>('.dm-location-form__remove-cell'),
      );

      expect(removeButtons).toHaveLength(2);
      expect(removeButtons[0].getAttribute('aria-label')).toBe('Eliminar celda 1');
      expect(removeButtons[0].getAttribute('title')).toBe('Eliminar celda 1');
      expect(removeButtons[1].getAttribute('aria-label')).toBe('Eliminar celda 2');
      expect(removeButtons[0].querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
      expect(removeButtons[0].getAttribute('type')).toBe('button');
    });

    it('el editor agrega y quita filas, y quitar deja el orden de las restantes', () => {
      expect(component.form.controls.cells.length).toBe(0);

      addCell({ section: 'A', cell: '1' });
      addCell({ section: 'A', cell: '2' });

      expect(component.form.controls.cells.length).toBe(2);
      expect(dataRows()).toHaveLength(2);

      compiled().querySelector<HTMLButtonElement>('.dm-location-form__remove-cell')?.click();
      fixture.detectChanges();

      expect(component.form.controls.cells.length).toBe(1);
      expect(dataRows()).toHaveLength(1);
      expect(component.form.controls.cells.at(0).controls.cell.value).toBe('2');
    });

    it('bloquea el envío vacío con el error propio «Ingresa el nombre del estante» (S2/S8)', () => {
      component.onSubmit();
      fixture.detectChanges();

      expect(component.form.invalid).toBe(true);
      expect(component.form.controls.name.hasError('required')).toBe(true);
      httpMock.expectNone(SHELVES_URL);
      httpMock.expectNone(CELLS_URL);
      expect(compiled().textContent).toContain('Ingresa el nombre del estante');
    });

    it('un nombre de solo espacios cuenta como vacío y no emite POST (S2)', () => {
      component.form.controls.name.setValue('    ');
      component.onSubmit();
      fixture.detectChanges();

      expect(component.form.controls.name.hasError('required')).toBe(true);
      httpMock.expectNone(SHELVES_URL);
      expect(compiled().textContent).toContain('Ingresa el nombre del estante');
    });

    it('exige al menos 2 caracteres en el nombre (rango 2..100)', () => {
      component.form.controls.name.setValue('A');
      component.onSubmit();
      fixture.detectChanges();

      expect(component.form.controls.name.hasError('minlength')).toBe(true);
      httpMock.expectNone(SHELVES_URL);
      expect(compiled().textContent).toContain('El nombre debe tener al menos 2 caracteres.');
    });

    it('rechaza más de 100 caracteres en el nombre con el error propio de longitud', () => {
      component.form.controls.name.setValue('a'.repeat(101));
      component.onSubmit();
      fixture.detectChanges();

      expect(component.form.controls.name.hasError('maxlength')).toBe(true);
      httpMock.expectNone(SHELVES_URL);
      expect(compiled().textContent).toContain('El nombre no debe superar los 100 caracteres.');
    });

    it('la descripción es opcional pero no puede superar los 200 caracteres', () => {
      component.form.controls.name.setValue('Estante A');
      component.form.controls.description.setValue('a'.repeat(201));
      component.onSubmit();
      fixture.detectChanges();

      expect(component.form.controls.description.hasError('maxlength')).toBe(true);
      httpMock.expectNone(SHELVES_URL);
      expect(compiled().textContent).toContain(
        'La descripción no debe superar los 200 caracteres.',
      );
    });

    it('una celda sin tramo invalida el formulario y no emite POST', () => {
      component.form.controls.name.setValue('Estante A');
      compiled().querySelector<HTMLButtonElement>('.dm-location-form__add-cell')?.click();
      fixture.detectChanges();
      component.form.controls.cells.at(0).controls.cell.setValue('1');
      component.onSubmit();
      fixture.detectChanges();

      expect(component.form.invalid).toBe(true);
      expect(component.form.controls.cells.at(0).controls.section.hasError('required')).toBe(true);
      httpMock.expectNone(SHELVES_URL);
      expect(compiled().textContent).toContain('Ingresa el tramo');
    });

    it('el tramo y la celda aceptan hasta 50 caracteres', () => {
      component.form.controls.name.setValue('Estante A');
      compiled().querySelector<HTMLButtonElement>('.dm-location-form__add-cell')?.click();
      fixture.detectChanges();
      const group = component.form.controls.cells.at(0);
      group.controls.section.setValue('a'.repeat(51));
      group.controls.cell.setValue('b'.repeat(51));
      component.onSubmit();
      fixture.detectChanges();

      expect(group.controls.section.hasError('maxlength')).toBe(true);
      expect(group.controls.cell.hasError('maxlength')).toBe(true);
      httpMock.expectNone(SHELVES_URL);
      expect(compiled().textContent).toContain('El tramo no debe superar los 50 caracteres.');
      expect(compiled().textContent).toContain('La celda no debe superar los 50 caracteres.');
    });

    it('el POST del estante viaja sin `cells` y cada celda se crea por /v1/cells (cambio 3)', () => {
      component.form.controls.name.setValue('  Estante A  ');
      component.form.controls.description.setValue('   ');
      addCell({ section: '  A  ', cell: '  1  ', description: '  ' });
      addCell({ section: 'B', cell: '2', description: ' alta ' });

      const form = compiled().querySelector('form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));
      form.dispatchEvent(new Event('submit'));

      const shelfReq = httpMock.expectOne(SHELVES_URL);
      expect(shelfReq.request.method).toBe('POST');
      expect(shelfReq.request.body).toEqual({
        name: 'Estante A',
        description: null,
        is_active: true,
      });
      expect(shelfReq.request.body).not.toHaveProperty('cells');
      expect(Object.keys(shelfReq.request.body)).toEqual(['name', 'description', 'is_active']);

      shelfReq.flush(shelfDto({ cells: [] }), { status: 201, statusText: 'Created' });

      const firstCell = httpMock.expectOne(CELLS_URL);
      expect(firstCell.request.method).toBe('POST');
      expect(firstCell.request.body).toEqual({
        section: 'A',
        cell: '1',
        description: null,
        shelf_id: 7,
        is_active: true,
      });
      firstCell.flush(cellDto({ id: 21 }), { status: 201, statusText: 'Created' });

      const secondCell = httpMock.expectOne(CELLS_URL);
      expect(secondCell.request.body).toEqual({
        section: 'B',
        cell: '2',
        description: 'alta',
        shelf_id: 7,
        is_active: true,
      });
      secondCell.flush(cellDto({ id: 22, section: 'B', cell: '2' }), {
        status: 201,
        statusText: 'Created',
      });

      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('un estante sin celdas solo emite el POST del estante', () => {
      component.form.controls.name.setValue('Estante A');
      component.onSubmit();

      const shelfReq = httpMock.expectOne(SHELVES_URL);
      expect(shelfReq.request.body).toEqual({
        name: 'Estante A',
        description: null,
        is_active: true,
      });
      shelfReq.flush(shelfDto({ cells: [] }), { status: 201, statusText: 'Created' });

      httpMock.expectNone(CELLS_URL);
      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('respeta el estado del estante y el de cada celda cuando se desmarcan', () => {
      component.form.controls.name.setValue('Estante B');
      component.form.controls.isActive.setValue(false);
      addCell({ section: 'A', cell: '1' });
      component.form.controls.cells.at(0).controls.isActive.setValue(false);

      component.onSubmit();

      const shelfReq = httpMock.expectOne(SHELVES_URL);
      expect(shelfReq.request.body).toEqual({
        name: 'Estante B',
        description: null,
        is_active: false,
      });
      shelfReq.flush(shelfDto({ name: 'Estante B', is_active: false, cells: [] }), {
        status: 201,
        statusText: 'Created',
      });

      const cellReq = httpMock.expectOne(CELLS_URL);
      expect(cellReq.request.body).toEqual({
        section: 'A',
        cell: '1',
        description: null,
        shelf_id: 7,
        is_active: false,
      });
      cellReq.flush(cellDto({ is_active: false }), { status: 201, statusText: 'Created' });
      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('muestra aria-busy, deshabilita el envío y las filas durante el guardado (S9)', () => {
      component.form.controls.name.setValue('Estante A');
      addCell();
      component.onSubmit();
      fixture.detectChanges();

      expect(compiled().querySelector('form')?.getAttribute('aria-busy')).toBe('true');
      expect(compiled().querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(
        true,
      );
      expect(compiled().textContent).toContain('Guardando…');
      expect(
        compiled().querySelector('.dm-location-form__add-cell')?.hasAttribute('disabled'),
      ).toBe(true);
      expect(
        compiled().querySelector('.dm-location-form__remove-cell')?.hasAttribute('disabled'),
      ).toBe(true);

      httpMock.expectOne(SHELVES_URL).flush(shelfDto({ cells: [] }), {
        status: 201,
        statusText: 'Created',
      });
      httpMock.expectOne(CELLS_URL).flush(cellDto(), { status: 201, statusText: 'Created' });
    });

    it('ante 409 del estante deja el diálogo abierto con el duplicado bajo Nombre (S2/S8)', () => {
      component.form.controls.name.setValue('Estante A');
      component.onSubmit();

      httpMock
        .expectOne(SHELVES_URL)
        .flush('duplicado sintético', { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      expect(dialogRefStub.close).not.toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
      expect(component.fieldErrors().name).toBe('Ya existe una ubicación con ese nombre.');
      expect(component.form.controls.name.hasError('server')).toBe(true);
      httpMock.expectNone(CELLS_URL);

      expect(compiled().querySelector('.dm-location-form__error')?.getAttribute('role')).toBe(
        'alert',
      );
      expect(compiled().textContent).toContain('Ya existe una ubicación con ese nombre.');
    });

    it('el reintento tras un 409 limpia el error de servidor y vuelve a enviar', () => {
      component.form.controls.name.setValue('Estante A');
      component.onSubmit();

      httpMock
        .expectOne(SHELVES_URL)
        .flush('duplicado sintético', { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(component.form.controls.name.hasError('server')).toBe(true);

      component.form.controls.name.setValue('Estante B');
      component.onSubmit();

      expect(component.fieldErrors()).toEqual({});
      expect(component.form.controls.name.hasError('server')).toBe(false);
      httpMock.expectOne(SHELVES_URL).flush(shelfDto({ name: 'Estante B', cells: [] }), {
        status: 201,
        statusText: 'Created',
      });
      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('ante 422 del estante marca name/description sin exponer el backend (S8)', () => {
      component.form.controls.name.setValue('Estante A');
      component.onSubmit();

      httpMock.expectOne(SHELVES_URL).flush(
        {
          errors: [
            { field: 'name', message: 'RAW-LEAK name' },
            { field: 'description', message: 'RAW-LEAK description' },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      fixture.detectChanges();

      expect(component.fieldErrors()).toEqual({
        name: 'Revisa el nombre',
        description: 'Revisa la descripción',
      });
      expect(component.form.controls.name.hasError('server')).toBe(true);
      expect(component.form.controls.description.hasError('server')).toBe(true);
      expect(component.form.invalid).toBe(true);
      expect(compiled().textContent).toContain('Revisa los datos ingresados.');
      expect(compiled().textContent).not.toContain('RAW-LEAK');
      expect(component.submitting()).toBe(false);
      expect(dialogRefStub.close).not.toHaveBeenCalled();
    });

    it('ante 409 de una celda avisa de la posición duplicada y guarda el estante una sola vez', () => {
      component.form.controls.name.setValue('Estante A');
      addCell({ section: 'A', cell: '1' });
      component.onSubmit();

      httpMock.expectOne(SHELVES_URL).flush(shelfDto({ cells: [] }), {
        status: 201,
        statusText: 'Created',
      });
      httpMock
        .expectOne(CELLS_URL)
        .flush('duplicado sintético', { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      expect(component.savedShelfId()).toBe(7);
      expect(component.error()).toBe('Ya existe una celda con ese tramo y celda en el estante.');
      expect(component.submitting()).toBe(false);
      expect(dialogRefStub.close).not.toHaveBeenCalled();
      expect(compiled().textContent).not.toContain('Ya existe una ubicación con ese nombre.');
    });

    it('el reintento tras un fallo de celda actualiza el estante con PUT en vez de duplicarlo (cambio 3)', () => {
      component.form.controls.name.setValue('Estante A');
      addCell({ section: 'A', cell: '1' });
      component.onSubmit();

      httpMock.expectOne(SHELVES_URL).flush(shelfDto({ cells: [] }), {
        status: 201,
        statusText: 'Created',
      });
      httpMock.expectOne(CELLS_URL).flush('caída sintética', { status: 500, statusText: 'Error' });
      fixture.detectChanges();

      expect(component.savedShelfId()).toBe(7);
      expect(dialogRefStub.close).not.toHaveBeenCalled();

      component.onSubmit();

      const shelfReq = httpMock.expectOne(`${SHELVES_URL}/7`);
      expect(shelfReq.request.method).toBe('PUT');
      expect(shelfReq.request.body).toEqual({
        name: 'Estante A',
        description: null,
        is_active: true,
      });
      expect(shelfReq.request.body).not.toHaveProperty('cells');
      shelfReq.flush(shelfDto({ cells: [] }));

      // La celda que nunca se creó se vuelve a crear con POST.
      const cellReq = httpMock.expectOne(CELLS_URL);
      expect(cellReq.request.method).toBe('POST');
      cellReq.flush(cellDto({ id: 21 }), { status: 201, statusText: 'Created' });

      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('una celda ya creada se actualiza con PUT en el reintento, no se duplica (cambio 3)', () => {
      component.form.controls.name.setValue('Estante A');
      addCell({ section: 'A', cell: '1' });
      addCell({ section: 'A', cell: '2' });
      component.onSubmit();

      httpMock.expectOne(SHELVES_URL).flush(shelfDto({ cells: [] }), {
        status: 201,
        statusText: 'Created',
      });
      // La primera celda sí se crea y su id queda escrito en la fila.
      const firstCell = httpMock.expectOne(CELLS_URL);
      expect(firstCell.request.body).toMatchObject({ cell: '1' });
      firstCell.flush(cellDto({ id: 21 }), { status: 201, statusText: 'Created' });
      httpMock.expectOne(CELLS_URL).flush('caída sintética', { status: 500, statusText: 'Error' });
      fixture.detectChanges();

      expect(component.form.controls.cells.at(0).controls.id.value).toBe(21);
      expect(component.form.controls.cells.at(1).controls.id.value).toBeNull();

      component.onSubmit();

      httpMock.expectOne(`${SHELVES_URL}/7`).flush(shelfDto({ cells: [] }));

      const updatedCell = httpMock.expectOne(`${CELLS_URL}/21`);
      expect(updatedCell.request.method).toBe('PUT');
      expect(updatedCell.request.body).toEqual({
        section: 'A',
        cell: '1',
        description: null,
        shelf_id: 7,
        is_active: true,
      });
      updatedCell.flush(cellDto({ id: 21 }));

      const createdCell = httpMock.expectOne(CELLS_URL);
      expect(createdCell.request.method).toBe('POST');
      createdCell.flush(cellDto({ id: 22, cell: '2' }), { status: 201, statusText: 'Created' });

      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });
  });

  describe('modo edición (S3)', () => {
    let fixture: ComponentFixture<LocationFormDialog>;
    let component: LocationFormDialog;
    let httpMock: HttpTestingController;
    let dialogRefStub: { close: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      TestBed.resetTestingModule();
      ({ fixture, component, httpMock, dialogRefStub } = await configure({
        mode: 'edit',
        locationId: 7,
      }));
    });

    afterEach(() => {
      httpMock.verify();
    });

    function compiled(): HTMLElement {
      return fixture.nativeElement as HTMLElement;
    }

    it('precarga con GET /{id}, muestra aria-busy y el título «Editar estante» (S3, cambio 1)', () => {
      expect(component.loadingLocation()).toBe(true);
      fixture.detectChanges();

      expect(compiled().querySelector('form')?.getAttribute('aria-busy')).toBe('true');
      expect(compiled().querySelector('.dm-location-form__loading')?.getAttribute('role')).toBe(
        'status',
      );
      expect(compiled().textContent).toContain('Cargando estante…');
      expect(compiled().textContent).toContain('Editar estante');
      expect(compiled().textContent).not.toContain('Editar ubicación');
      expect(compiled().querySelector('button[type="submit"]')?.textContent).toContain(
        'Guardar cambios',
      );

      httpMock.expectOne(`${SHELVES_URL}/7`).flush(shelfDto());
      fixture.detectChanges();

      expect(component.loadingLocation()).toBe(false);
      expect(component.form.controls.name.value).toBe('Estante A');
      expect(component.form.controls.description.value).toBe('Pasillo principal');
      expect(component.form.controls.cells.length).toBe(2);
      expect(component.form.controls.cells.at(1).controls.cell.value).toBe('2');
      expect(component.form.controls.cells.at(1).controls.description.value).toBe('alta');
      // Las filas precargadas conservan el id del servidor: al guardar se
      // actualizan con PUT en vez de recrearse.
      expect(component.form.controls.cells.at(0).controls.id.value).toBe(11);
      expect(component.form.controls.cells.at(1).controls.id.value).toBe(12);
      // Sin control de estado del estante en edición (las celdas sí conservan
      // su propia casilla «Activa»).
      expect(compiled().querySelector('.dm-location-form__active')).toBeNull();
      expect(compiled().textContent).not.toContain('Estante activo');
      expect(compiled().querySelectorAll('.dm-location-form__cell-active')).toHaveLength(2);
      expect(compiled().querySelectorAll('.dm-location-form__cell-row')).toHaveLength(2);
      expect(component.form.controls.isActive.disabled).toBe(true);
    });

    it('el PUT del estante reenvía is_active precargado y no toca las celdas (cambio 3)', () => {
      httpMock.expectOne(`${SHELVES_URL}/7`).flush(shelfDto({ is_active: false }));
      fixture.detectChanges();

      component.form.controls.name.setValue('  Estante B  ');
      component.form.controls.description.setValue('   ');
      component.onSubmit();

      const shelfReq = httpMock.expectOne(`${SHELVES_URL}/7`);
      expect(shelfReq.request.method).toBe('PUT');
      expect(shelfReq.request.body).toEqual({
        name: 'Estante B',
        description: null,
        is_active: false,
      });
      expect(shelfReq.request.body).not.toHaveProperty('cells');
      shelfReq.flush(shelfDto({ name: 'Estante B', is_active: false }));

      // Cada fila precargada se actualiza con su propio id.
      const firstCell = httpMock.expectOne(`${CELLS_URL}/11`);
      expect(firstCell.request.method).toBe('PUT');
      expect(firstCell.request.body).toEqual({
        section: 'A',
        cell: '1',
        description: null,
        shelf_id: 7,
        is_active: true,
      });
      firstCell.flush(cellDto());

      const secondCell = httpMock.expectOne(`${CELLS_URL}/12`);
      expect(secondCell.request.method).toBe('PUT');
      expect(secondCell.request.body).toEqual({
        section: 'A',
        cell: '2',
        description: 'alta',
        shelf_id: 7,
        is_active: true,
      });
      secondCell.flush(cellDto({ id: 12, cell: '2' }));

      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('quitar una celda precargada la da de baja con DELETE, después de los upserts', () => {
      httpMock.expectOne(`${SHELVES_URL}/7`).flush(shelfDto());
      fixture.detectChanges();

      compiled().querySelector<HTMLButtonElement>('.dm-location-form__remove-cell')?.click();
      fixture.detectChanges();
      expect(component.form.controls.cells.length).toBe(1);

      component.form.controls.cells.at(0).controls.cell.setValue('9');
      component.onSubmit();

      httpMock.expectOne(`${SHELVES_URL}/7`).flush(shelfDto());
      const updatedCell = httpMock.expectOne(`${CELLS_URL}/12`);
      expect(updatedCell.request.method).toBe('PUT');
      expect(updatedCell.request.body).toMatchObject({ cell: '9', shelf_id: 7 });
      updatedCell.flush(cellDto({ id: 12, cell: '9' }));

      // La baja va al final: la celda 11 se borra solo cuando las escrituras
      // anteriores terminaron.
      const deletedCell = httpMock.expectOne(`${CELLS_URL}/11`);
      expect(deletedCell.request.method).toBe('DELETE');
      deletedCell.flush(null, { status: 204, statusText: 'No Content' });

      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('ante 409 de la baja avisa de los medicamentos asociados sin mostrar el backend', () => {
      httpMock.expectOne(`${SHELVES_URL}/7`).flush(shelfDto({ cells: [cellDto()] }));
      fixture.detectChanges();

      compiled().querySelector<HTMLButtonElement>('.dm-location-form__remove-cell')?.click();
      fixture.detectChanges();
      component.onSubmit();

      httpMock.expectOne(`${SHELVES_URL}/7`).flush(shelfDto({ cells: [cellDto()] }));
      httpMock
        .expectOne(`${CELLS_URL}/11`)
        .flush(
          { detail: 'RAW-DETAIL-LEAK cell has medications', code: 'RAW_CODE_LEAK' },
          { status: 409, statusText: 'Conflict' },
        );
      fixture.detectChanges();

      expect(component.error()).toBe(
        'No se puede eliminar la celda porque tiene medicamentos asociados.',
      );
      expect(compiled().querySelector('.dm-location-form__error')?.getAttribute('role')).toBe(
        'alert',
      );
      expect(compiled().textContent).not.toContain('RAW-DETAIL-LEAK');
      expect(compiled().textContent).not.toContain('RAW_CODE_LEAK');
      expect(component.submitting()).toBe(false);
      expect(dialogRefStub.close).not.toHaveBeenCalled();
    });

    it('agregar una fila en edición la crea con POST y conserva las existentes con PUT', () => {
      httpMock.expectOne(`${SHELVES_URL}/7`).flush(shelfDto({ cells: [cellDto()] }));
      fixture.detectChanges();

      compiled().querySelector<HTMLButtonElement>('.dm-location-form__add-cell')?.click();
      fixture.detectChanges();
      component.form.controls.cells.at(1).controls.section.setValue('B');
      component.form.controls.cells.at(1).controls.cell.setValue('9');
      component.onSubmit();

      httpMock.expectOne(`${SHELVES_URL}/7`).flush(shelfDto());

      const updatedCell = httpMock.expectOne(`${CELLS_URL}/11`);
      expect(updatedCell.request.method).toBe('PUT');
      updatedCell.flush(cellDto());

      const createdCell = httpMock.expectOne(CELLS_URL);
      expect(createdCell.request.method).toBe('POST');
      expect(createdCell.request.body).toEqual({
        section: 'B',
        cell: '9',
        description: null,
        shelf_id: 7,
        is_active: true,
      });
      createdCell.flush(cellDto({ id: 33, section: 'B', cell: '9' }), {
        status: 201,
        statusText: 'Created',
      });

      expect(dialogRefStub.close).toHaveBeenCalledWith('saved');
    });

    it('ante 404 de precarga cierra con { notFound: true } para que la lista avise (S3/S5)', () => {
      httpMock
        .expectOne(`${SHELVES_URL}/7`)
        .flush('ausente sintético', { status: 404, statusText: 'Not Found' });

      expect(dialogRefStub.close).toHaveBeenCalledWith({ notFound: true });
    });
  });

  describe('cancelar sin efectos (S3)', () => {
    it('en creación «Cancelar» cierra sin valor y sin emitir peticiones', async () => {
      TestBed.resetTestingModule();
      const { fixture, httpMock, dialogRefStub } = await configure({ mode: 'create' });
      fixture.detectChanges();

      httpMock.expectNone(SHELVES_URL);
      httpMock.expectNone(CELLS_URL);

      const cancel = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        'button[mat-dialog-close]',
      );
      expect(cancel).not.toBeNull();
      expect(cancel?.textContent).toContain('Cancelar');
      expect(cancel?.getAttribute('type')).toBe('button');

      cancel?.click();

      expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
      const cancelArg = dialogRefStub.close.mock.calls[0][0];
      expect(cancelArg).toBeFalsy();
      expect(cancelArg).not.toEqual({ notFound: true });
      httpMock.expectNone(SHELVES_URL);
      httpMock.expectNone(CELLS_URL);
      httpMock.verify();
    });

    it('en edición «Cancelar» tras la precarga cierra sin valor y sin escrituras', async () => {
      TestBed.resetTestingModule();
      const { fixture, httpMock, dialogRefStub } = await configure({
        mode: 'edit',
        locationId: 7,
      });
      fixture.detectChanges();

      httpMock.expectOne(`${SHELVES_URL}/7`).flush(shelfDto());
      fixture.detectChanges();

      const cancel = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        'button[mat-dialog-close]',
      );
      cancel?.click();

      expect(dialogRefStub.close).toHaveBeenCalledTimes(1);
      const editCancelArg = dialogRefStub.close.mock.calls[0][0];
      expect(editCancelArg).toBeFalsy();
      expect(editCancelArg).not.toEqual({ notFound: true });
      httpMock.expectNone((request) => request.method !== 'GET');
      httpMock.verify();
    });

    it('Escape cierra el diálogo real sin emitir peticiones (MatDialog por defecto)', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      }).compileComponents();

      const httpMock = TestBed.inject(HttpTestingController);
      const dialog = TestBed.inject(MatDialog);
      const data: LocationFormData = { mode: 'create' };
      const ref = dialog.open(LocationFormDialog, { data });

      // `MatDialogContainer` cierra cuando el overlay recibe un `keydown` con
      // `keyCode === 27` (CDK `dialog.mjs`), no por el `key` moderno: jsdom
      // deja `keyCode` en 0 si solo se pasa `key`, y el diálogo no cerraría.
      const closed = new Promise<unknown>((resolve) => {
        ref.afterClosed().subscribe((value) => resolve(value));
      });

      // El `OverlayKeyboardDispatcher` escucha `keydown` en `body`.
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
      );

      await expect(closed).resolves.toBeUndefined();
      httpMock.expectNone(SHELVES_URL);
      httpMock.verify();
    });
  });
});
