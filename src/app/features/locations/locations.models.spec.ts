import {
  Shelf,
  ShelfCell,
  formatCells,
  toCellOption,
  toCellPayload,
  toShelf,
  toShelfListPage,
  toShelfPayload,
} from './locations.models';

function cellDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 11,
    shelf_id: 7,
    section: 'tramo 1',
    cell: 'celda 3',
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
    cells: [cellDto()],
    ...overrides,
  };
}

const shelf: Shelf = {
  id: 7,
  name: 'Estante A',
  description: 'Pasillo principal',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  cells: [
    {
      id: 11,
      shelfId: 7,
      section: 'tramo 1',
      cell: 'celda 3',
      description: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    },
  ],
};

describe('locations.models', () => {
  describe('toShelf', () => {
    it('mapea snake_case a camelCase incluidas las celdas anidadas', () => {
      expect(toShelf(shelfDto() as never)).toEqual(shelf);
    });

    it('conserva description null del estante y de la celda', () => {
      const mapped = toShelf(shelfDto({ description: null, cells: [cellDto()] }) as never);

      expect(mapped.description).toBeNull();
      expect(mapped.cells[0].description).toBeNull();
    });

    it('mapea defensivamente cuando el estante llega sin `cells` (campo no requerido)', () => {
      const dto = shelfDto();
      delete dto['cells'];

      expect(toShelf(dto as never).cells).toEqual([]);
    });

    it('mapea defensivamente cuando `cells` llega como null', () => {
      expect(toShelf(shelfDto({ cells: null }) as never).cells).toEqual([]);
    });
  });

  describe('toShelfListPage', () => {
    it('mapea el sobre paginado {items,total,page,size,pages}', () => {
      const page = toShelfListPage({
        items: [shelfDto() as never],
        total: 41,
        page: 2,
        size: 20,
        pages: 3,
      });

      expect(page.total).toBe(41);
      expect(page.page).toBe(2);
      expect(page.size).toBe(20);
      expect(page.pages).toBe(3);
      expect(page.items).toEqual([shelf]);
    });
  });

  describe('toShelfPayload (el body del estante no lleva `cells`)', () => {
    it('recorta name y normaliza description vacía a null', () => {
      const payload = toShelfPayload({
        name: '  Estante A  ',
        description: '   ',
        isActive: true,
      });

      expect(payload).toEqual({
        name: 'Estante A',
        description: null,
        is_active: true,
      });
    });

    it('no incluye `cells` ni marcas de tiempo: el contrato es additionalProperties false', () => {
      const payload = toShelfPayload({
        name: 'Estante A',
        description: 'Pasillo principal',
        isActive: false,
      });

      expect(Object.keys(payload)).toEqual(['name', 'description', 'is_active']);
      const body = payload as unknown as Record<string, unknown>;
      expect(body).not.toHaveProperty('cells');
      expect(body).not.toHaveProperty('id');
      expect(body).not.toHaveProperty('created_at');
      expect(body).not.toHaveProperty('updated_at');
    });
  });

  describe('toCellPayload (cada celda en /v1/cells)', () => {
    it('recorta section/cell, normaliza description y envía shelf_id', () => {
      const payload = toCellPayload(
        { section: '  tramo 1  ', cell: '  celda 3  ', description: '   ', isActive: true },
        7,
      );

      expect(payload).toEqual({
        section: 'tramo 1',
        cell: 'celda 3',
        description: null,
        shelf_id: 7,
        is_active: true,
      });
    });

    it('no envía id ni marcas de tiempo y respeta is_active false', () => {
      const payload = toCellPayload(
        { section: 'tramo 2', cell: 'celda 1', description: ' alta ', isActive: false },
        8,
      );

      expect(Object.keys(payload)).toEqual([
        'section',
        'cell',
        'description',
        'shelf_id',
        'is_active',
      ]);
      expect(payload.description).toBe('alta');
      expect(payload.is_active).toBe(false);
      expect(payload.shelf_id).toBe(8);
      expect(payload as unknown as Record<string, unknown>).not.toHaveProperty('id');
    });
  });

  describe('formatCells', () => {
    it('une las celdas como «tramo / celda» con separador « · »', () => {
      const cells: ShelfCell[] = [
        { ...shelf.cells[0], section: 'A', cell: '1' },
        { ...shelf.cells[0], id: 12, section: 'A', cell: '2' },
      ];

      expect(formatCells(cells)).toBe('A / 1 · A / 2');
    });

    it('un estante sin celdas se representa con una raya', () => {
      expect(formatCells([])).toBe('—');
    });
  });

  describe('toCellOption', () => {
    it('etiqueta la celda como «estante · tramo / celda»', () => {
      expect(toCellOption(shelf, shelf.cells[0])).toEqual({
        id: 11,
        label: 'Estante A · tramo 1 / celda 3',
      });
    });
  });
});
