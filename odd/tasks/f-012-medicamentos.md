# F-012 — Módulo para gestionar medicamentos

CRUD del catálogo de medicamentos (RF-07, US-20, CA-CRUD). Primer módulo compuesto de E3: asocia tipo, marca y ubicación. Aprobación pendiente.

## Specs

- **S1** — Listado: paginado con `page`, `size`, `search` y `is_active`; filtros adicionales `drug_type_id`, `brand_id`, `cell_id`; respuesta `items/total/page/size/pages`; `size` 1-100 def. 20; `search` parcial en `description` o `dose` máx. 100; `sort`: `description, dose, drug_type_id, brand_id, cell_id, created_at, is_active o id`, prefijo `-` descendente, def. `description`. Opciones 10/20/50, def. 20; reset a página 1 al cambiar criterio; total = `total` del servidor. _(Realineado 2026-10-27: `location_id` → `cell_id`.)_
- **S2** — Crear: `description`, `drug_type_id`, `brand_id`, `cell_id`, `dose` requeridos; `is_active` opcional (D-5, por defecto `true`); `201`; `409` en duplicado (combinación description+brand_id+dose); `404` si algún catálogo referenciado no existe o está inactivo.
- **S3** — Editar: `200`; el `PUT` es reemplazo completo (`description`+`drug_type_id`+`brand_id`+`cell_id`+`dose`+`is_active`). `MedicationRead` **no** devuelve `created_at`, por lo que `createdAt` es opcional y no se muestra; diálogo precargado con `GET /{id}`; Cancelar/Escape/backdrop sin efectos.
- **S4** — Desactivar/activar: `DELETE` = desactivar lógico; reactivar reenvía el registro con `is_active: true` en el `PUT` de reemplazo completo; nunca borrado físico; confirmación explícita.
- **S5** — Por ID: `200` o `404`.
- **S6** — UI: tabla (descripción, tipo, marca, ubicación, dosis, estado, acciones), búsqueda, filtros por tipo/marca/ubicación, paginación, formulario con selects, confirmación, toast, loading, vacío y error con reintento. Texto de vacío: «No hay medicamentos para mostrar.». Ítem de menú: «Medicamentos». Ruta lazy `/medications`.
- **S7** — Permisos: escritura solo `ADMIN`; `403` si un médico intenta escribir. MEDICO ve menú y tabla en solo lectura, cero controles de escritura en el DOM.
- **S8** — Mensajes en español a nivel de campo; 400/404/409/422 mapeados sin exponer mensajes crudos del backend.
- **S9** — Diseño: solo tokens `--dm-*`, sin hex literales, sin `::ng-deep`; badge de estado con chips AA; `@include dm.dm-focus-ring`; scroll horizontal <768px; accesibilidad AA.
- **S10** — Carga sin parpadeo: loading contenido en región de la tabla (overlay absoluto, `pointer-events: none`), header/filtros/paginador montados, `aria-busy` solo en región, foco conservado en el buscador; error de carga inline con reintento (CA-06, patrón F-009), sin toast para fallo de carga.
- **S11** — Catálogos resilientes: los tres catálogos relacionados (tipos, marcas, celdas) se cargan con `forkJoin` pero cada fuente lleva su propio `catchError`, así el fallo de una no vacía las otras dos ni rompe el listado; la ubicación del medicamento es una **celda** (`listAllCells()` de F-011, etiqueta `«Estante · tramo / celda»`), no un endpoint `/v1/locations` inexistente.

## Tasks

- **T1** (S1, S2, S5, S8) — Modelo `medications.models.ts`, servicio `medications.service.ts` (todo el HTTP), `medications-error.ts`. Ruta: inline. Commit: work-unit 1.
- **T2** (S1, S6, S9, S10) — Listado `medication-list.{ts,html,scss}`. Ruta: inline. Commit: work-unit 2.
- **T3** (S2, S3, S4, S6, S8) — Diálogos crear/editar + confirmación activar/desactivar + toasts. Ruta: inline. Commit: work-unit 2.
- **T4** (S6, S7) — Ruta lazy `/medications`, ítem de menú ambos roles, escritura oculta a MEDICO. Ruta: inline. Commit: work-unit 2.
- **T5** (S1-S10) — Reviewer: escribe `*.spec.ts`, full checks, PASS/FAIL por spec. Commit: work-unit 3.
- **T6** — Documentación `docs/MEDICATIONS.md` + cierre `done`. Commit: work-unit 3.

## Log

- **L1** — Pedido (2026-10-27): implementar módulo de medicamentos siguiendo el patrón de F-009/F-010/F-011.
- **L2** — PQ-01 (Oscar Mora, 2026-10-25): regla del tres — los catálogos ya completaron 3 casos; medicamentos es un módulo compuesto, no un catálogo simple.
- **L3** — Cambio de contrato del backend (2026-10-27, reportado por el humano): body POST/PUT, respuesta, filtro de listado, `sort` y `422` pasan de `location_id` a `cell_id`; `MedicationRead` deja de devolver `created_at`; `cell_id` apunta a `cells.id`. Se renombró el dominio completo (`cellId`/`cell_id`), la ubicación pasó a celdas vía `listAllCells()` y se aisló cada catálogo con `catchError` para corregir el reporte «al agregar o actualizar un medicamento no carga tipo, marca ni ubicación». Verificación: 108 tests de la feature, suite completa 645, lint, build y `features:validate` en verde.
