# F-011 — Módulo para gestionar ubicaciones

CRUD del catálogo de ubicaciones físicas (RF-06, US-17, CA-CRUD). Tercer catálogo maestro de E2; con este módulo se completa la regla del tres (PQ-01) y se evalúa la extracción a `shared/` (US-08). Aprobada por Oscar Mora el 2026-10-27.

## Specs

- **S1** — Listado: paginado con `page`, `size`, `search` e `is_active`; respuesta `items/total/page/size/pages`; `size` 1-100 def. 20; `search` parcial máx. 100; `sort` def. `name`, prefijo `-` descendente. Opciones 10/20/50, def. 20; reset a página 1 al cambiar criterio; total = `total` del servidor. _(Realineado a `GET /v1/shelves`, 2026-10-27: `/v1/locations` no existe en el backend.)_
- **S2** — Crear: `name` (2..100) requerido; `description` (≤200) opcional; `is_active` del estante opcional (D-5, por defecto `true`); `201`; `409` en `name` duplicado. Body `ShelfCreate` con `additionalProperties: false` y **sin `cells`** (mandar `cells` responde `422`): las celdas se crean con `POST /v1/cells` una vez conocido el `id` del estante. _(Realineado 2026-10-27: las celdas tienen su propio CRUD.)_
- **S3** — Editar: `200`; el `PUT` es reemplazo completo **del estante** (`name`, `description`, `is_active`, sin `cells`) y no toca sus celdas. Las celdas se reconcilian por `/v1/cells`: `PUT /v1/cells/{id}` para las filas con `id`, `POST /v1/cells` para las nuevas y `DELETE /v1/cells/{id}` para las precargadas quitadas. Diálogo precargado con `GET /{id}`; Cancelar/Escape/backdrop sin efectos. _(Realineado 2026-10-27)_
- **S4** — Desactivar/activar: `DELETE /v1/shelves/{id}` = desactivación lógica; reactivar reenvía el estante con `is_active: true` en el `PUT` de reemplazo (sin `cells`); nunca borrado físico; confirmación explícita.
- **S5** — Por ID: `200` o `404`.
- **S6** — UI: tabla (nombre, descripción, celdas, estado, acciones), búsqueda, paginación, formulario con editor de celdas, confirmación, toast, loading, vacío y error con reintento. Texto de vacío: «No hay ubicaciones para mostrar.». Ítem de menú: «Ubicaciones». Ruta lazy `/locations`.
- **S7** — Permisos: escritura solo `ADMIN`; `403` si un médico intenta escribir. MEDICO ve menú y tabla en solo lectura, cero controles de escritura en el DOM.
- **S8** — Mensajes en español a nivel de campo; 400/404/409/422 mapeados sin exponer mensajes crudos del backend.
- **S9** — Diseño: solo tokens `--dm-*`, sin hex literales, sin `::ng-deep`; badge de estado con chips AA; `@include dm.dm-focus-ring`; scroll horizontal <768px; accesibilidad AA.
- **S10** — Carga sin parpadeo: loading contenido en región de la tabla (overlay absoluto, `pointer-events: none`), header/filtros/paginador montados, `aria-busy` solo en región, foco conservado en el buscador; error de carga inline con reintento (CA-06, patrón F-009), sin toast para fallo de carga.
- **S11** — Catálogo de celdas para terceros: `LocationsService.listAllCells(): Observable<CellOption[]>` devuelve `{ id, label }` de las celdas activas de estantes activos (etiqueta `«Estante · tramo / celda»`), recorriendo todas las páginas con `size: 100` para no truncar. Consumido por F-012 (`cell_id` → `cells.id`).
- **S12** — Copy con «estante» dentro del diálogo y su flujo: títulos «Nuevo estante»/«Editar estante», confirmación «Activar estante»/«Desactivar estante», toasts «Estante creado./actualizado./activado./desactivado.» y botón «Crear estante»/«Guardar cambios». El módulo, el menú, la ruta, el vacío «No hay ubicaciones para mostrar.» y los mensajes de error no cambian.
- **S13** — Editor de celdas en una sola fila: cada celda es una fila alineada con cabecera visible `[Tramo, Celda, Descripción, Estado, Eliminar]`; cabecera y filas comparten una única plantilla de rejilla; «Eliminar» es un botón de icono `delete` con nombre accesible «Eliminar celda N»; cada campo conserva su `mat-label` y la casilla su etiqueta; «Agregar celda» sigue disponible; en <768px la fila se apila sin perder etiquetas.
- **S14** — Reconciliación por `/v1/cells` con reintento seguro: el `id` devuelto por `POST /v1/shelves` se guarda en `savedShelfId` (estado «ya guardado») y el de cada `POST /v1/cells` se escribe en su fila, de modo que un reintento actualiza (`PUT`) en vez de duplicar; los upserts corren antes que las bajas; el primer fallo se reporta con su propio mensaje y el diálogo queda abierto; `409` de baja → «No se puede eliminar la celda porque tiene medicamentos asociados.»; el diálogo solo cierra con `'saved'` si el estante y todas las celdas se guardaron.

## Tasks

- **T1** (S1, S2, S5, S8) — Modelo `locations.models.ts`, servicio `locations.service.ts` (todo el HTTP), `locations-error.ts`. Ruta: inline. Commit: work-unit 1. **Hecho.**
- **T2** (S1, S6, S9, S10) — Listado `location-list.{ts,html,scss}`. Ruta: inline. Commit: work-unit 2. **Hecho.**
- **T3** (S2, S3, S4, S6, S8) — Diálogos crear/editar + confirmación activar/desactivar + toasts. Ruta: inline. Commit: work-unit 2. **Hecho.**
- **T4** (S6, S7) — Ruta lazy `/locations`, ítem de menú ambos roles, escritura oculta a MEDICO. Ruta: inline. Commit: work-unit 2. **Hecho.**
- **T5** (S1-S10) — Reviewer: escribe `*.spec.ts`, full checks, PASS/FAIL por spec. Commit: work-unit 3. **Hecho.**
- **T6** — Documentación `docs/LOCATIONS.md` + cierre `done`. Commit: work-unit 3. **Hecho.**
- **T7** (S2, S3, S4, S12, S13, S14) — Segunda realineación: bodies del estante sin `cells`, CRUD de celdas en `/v1/cells`, copy «estante» y editor en una sola fila; specs del módulo actualizadas. Ruta: inline. Commit: work-unit 4. **Hecho.**

## Log

- **L1** — Pedido (2026-10-27): implementar módulo de ubicaciones siguiendo el patrón de F-009/F-010.
- **L2** — PQ-01 (Oscar Mora, 2026-10-25): regla del tres — con F-011 se completa el tercer caso; se evalúa la extracción a `shared/` (US-08).
- **L3** — Implementación T1-T4: models/service/error/toast/list/form/confirm + ruta + nav, clon del patrón F-009/F-010 con campos shelf/section/cell.
- **L4** — Reviewer T5: specs adaptadas, 510 tests verdes, sin defectos de producción.
- **L5** — Cierre T6: docs/LOCATIONS.md + F-011 done en feature-list.md.
- **L6** — Corrección de contrato (2026-10-27, reporte del humano): el backend vivo no expone `/api/v1/locations` (404); el catálogo real es `/api/v1/shelves` (estantes con `cells[]` anidadas) y `medications.cell_id` referencia `cells.id` (`fk_medications_location_id_cells`). Decisión del humano: mapear «Ubicaciones» a `/v1/shelves`. Reescritos models/service/error/list/form/confirm + specs + `docs/LOCATIONS.md`; añadido `listAllCells()` (S11); quitada del copy la afirmación «no elimina sus datos» (semántica de `DELETE` no verificada). Verificación: 122 tests de la feature, suite completa 645, lint y build en verde. Tareas T1-T6 reabiertas y cerradas con el contrato real.
- **L7** — Segunda realineación (2026-10-27, OpenAPI vivo): `ShelfCreate`/`ShelfUpdate` dejaron de admitir `cells` (`additionalProperties: false`, `422`) y aparecieron `GET/POST/PUT/DELETE /v1/cells`. Decisión del humano en el mismo pedido: llamar «estante» a la entidad del diálogo y rehacer el editor de celdas como una sola fila alineada por celda con cabecera visible. Implementado T7: models/service sin `cells` en el estante + `createCell()`/`updateCell()`/`deleteCell()`; el diálogo guarda el estante y reconcilia celdas (upserts y luego bajas) con `savedShelfId` para que el reintento actualice en lugar de duplicar; `409` de baja con texto propio de medicamentos asociados; `listAllCells()` intacto para F-012. Verificación: 147 tests de la feature, 108 de medicamentos (consumidor de `listAllCells()`), lint, `prettier --check` y build en verde.
