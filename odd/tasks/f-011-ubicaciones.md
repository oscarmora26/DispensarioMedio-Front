# F-011 — Módulo para gestionar ubicaciones

CRUD del catálogo de ubicaciones físicas (RF-06, US-17, CA-CRUD). Tercer catálogo maestro de E2; con este módulo se completa la regla del tres (PQ-01) y se evalúa la extracción a `shared/` (US-08). Aprobada por Oscar Mora el 2026-10-27.

## Specs

- **S1** — Listado: paginado con `page`, `size`, `search` y `is_active`; respuesta `items/total/page/size/pages`; `size` 1-100 def. 20; `search` parcial en `description` máx. 100; `sort`: `description, created_at, is_active o id`, prefijo `-` descendente, def. `description`. Opciones 10/20/50, def. 20; reset a página 1 al cambiar criterio; total = `total` del servidor.
- **S2** — Crear: `description`, `shelf`, `section`, `cell` requeridos; `is_active` opcional (D-5, por defecto `true`); `201`; `409` en duplicado (descripción o combinación shelf/section/cell).
- **S3** — Editar: `200`, conservando `created_at`; diálogo precargado con `GET /{id}`; Cancelar/Escape/backdrop sin efectos.
- **S4** — Desactivar/activar: `DELETE` = desactivar lógico; reactivar reenvía el registro con `is_active: true` en el `PUT` de reemplazo completo; nunca borrado físico; confirmación explícita.
- **S5** — Por ID: `200` o `404`.
- **S6** — UI: tabla (descripción, estante, tramo, celda, estado, acciones), búsqueda, paginación, formulario, confirmación, toast, loading, vacío y error con reintento. Texto de vacío: «No hay ubicaciones para mostrar.». Ítem de menú: «Ubicaciones». Ruta lazy `/locations`.
- **S7** — Permisos: escritura solo `ADMIN`; `403` si un médico intenta escribir. MEDICO ve menú y tabla en solo lectura, cero controles de escritura en el DOM.
- **S8** — Mensajes en español a nivel de campo; 400/404/409/422 mapeados sin exponer mensajes crudos del backend.
- **S9** — Diseño: solo tokens `--dm-*`, sin hex literales, sin `::ng-deep`; badge de estado con chips AA; `@include dm.dm-focus-ring`; scroll horizontal <768px; accesibilidad AA.
- **S10** — Carga sin parpadeo: loading contenido en región de la tabla (overlay absoluto, `pointer-events: none`), header/filtros/paginador montados, `aria-busy` solo en región, foco conservado en el buscador; error de carga inline con reintento (CA-06, patrón F-009), sin toast para fallo de carga.

## Tasks

- **T1** (S1, S2, S5, S8) — Modelo `locations.models.ts`, servicio `locations.service.ts` (todo el HTTP), `locations-error.ts`. Ruta: inline. Commit: work-unit 1. **Hecho.**
- **T2** (S1, S6, S9, S10) — Listado `location-list.{ts,html,scss}`. Ruta: inline. Commit: work-unit 2. **Hecho.**
- **T3** (S2, S3, S4, S6, S8) — Diálogos crear/editar + confirmación activar/desactivar + toasts. Ruta: inline. Commit: work-unit 2. **Hecho.**
- **T4** (S6, S7) — Ruta lazy `/locations`, ítem de menú ambos roles, escritura oculta a MEDICO. Ruta: inline. Commit: work-unit 2. **Hecho.**
- **T5** (S1-S10) — Reviewer: escribe `*.spec.ts`, full checks, PASS/FAIL por spec. Commit: work-unit 3. **Hecho.**
- **T6** — Documentación `docs/LOCATIONS.md` + cierre `done`. Commit: work-unit 3. **Hecho.**

## Log

- **L1** — Pedido (2026-10-27): implementar módulo de ubicaciones siguiendo el patrón de F-009/F-010.
- **L2** — PQ-01 (Oscar Mora, 2026-10-25): regla del tres — con F-011 se completa el tercer caso; se evalúa la extracción a `shared/` (US-08).
- **L3** — Implementación T1-T4: models/service/error/toast/list/form/confirm + ruta + nav, clon del patrón F-009/F-010 con campos shelf/section/cell.
- **L4** — Reviewer T5: specs adaptadas, 510 tests verdes, sin defectos de producción.
- **L5** — Cierre T6: docs/LOCATIONS.md + F-011 done en feature-list.md.
