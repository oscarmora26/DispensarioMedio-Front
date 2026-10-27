# F-009 — Módulo de tipos de fármacos

CRUD del catálogo de tipos de fármacos (RF-04, US-07, CA-CRUD). Primer catálogo maestro de E2; fija el patrón para marcas y ubicaciones. Aprobada por Oscar Mora el 2026-10-25. Fuente de verdad del repo: `feature-list.md` (F-009). Repo flow: implementer no toca `*.spec.ts`; los tests los escribe el reviewer al final.

## Specs

- **S1** — Listado: «Listado paginado con `page`, `size`, `search` y `is_active`.» y «Respuesta con `items`, `total`, `page`, `size` y `pages`.» (doc 01 §7.1-7.2). OpenAPI vivo: `page` ≥1; `size` 1-100 def. 20; `search` maxLength 100, «Busqueda parcial en description»; `sort`: «description, created_at, is_active o id; prefijo '-' descendente», def. `description`. Opciones de página 10/20/50, def. 20; reset a página 1 al cambiar criterio; total = `total` del servidor.
- **S2** — Crear: «Creación con validación, `201` y `409` en duplicados.» (§7.3). Body: `description` requerida, «Descripcion del tipo de farmaco, entre 1 y 100 caracteres»; «`is_active` es opcional (D-5, por defecto `true`)». Trim de description.
- **S3** — Editar: «Edición con `200`, conservando `created_at`.» (§7.4). Diálogo precargado con `GET /{id}`. Cancelar/Escape/backdrop cierra sin efectos.
- **S4** — Desactivar/activar: «Desactivación lógica mediante `is_active`.» (§7.5). DELETE = desactivar; reactivar reenvía el registro con `is_active: true` en el PUT de reemplazo completo (criterio R-04 de F-006). Nunca borrado físico. Confirmación explícita.
- **S5** — Por ID: «Consulta por ID con `200` o `404`.» (§7.6).
- **S6** — UI: «Interfaz con tabla, búsqueda, paginación, formulario, confirmación, toast, loading, vacío y error.» (§7.7). Texto de vacío: «No hay tipos de fármacos para mostrar.». Ítem de menú: «Tipos de fármacos». Ruta lazy `/drug-types`.
- **S7** — Permisos: «Escritura solo para `ADMIN`; el backend devuelve `403` si un médico intenta escribir.» (§7.8). Matriz: «Tipos de fármacos | CRUD | Consulta». PQ-02 resuelta (Oscar Mora, 2026-10-25): MEDICO ve menú y tabla en solo lectura, cero controles de escritura en el DOM (no solo deshabilitados).
- **S8** — Mensajes: «Validaciones y mensajes en español a nivel de campo.» (§7.9). Errores 400/404/409/422 mapeados a español sin exponer mensajes crudos del backend (patrón `users-error.ts`).
- **S9** — Diseño: solo tokens `--dm-*`, sin hex literales, sin `::ng-deep`; badge de estado con chips AA del sistema; `@include dm.dm-focus-ring`; scroll horizontal contenido en <768px; accesibilidad AA (labels, foco visible, `aria-busy`, teclado).
- **S10** — Carga sin parpadeo (F-007/F-008): loading contenido en la región de la tabla (overlay absoluto, `pointer-events: none`), header/filtros/paginador montados, `aria-busy` solo en región, foco conservado en el buscador; filtrar no navega ni toca señales del shell.

## Tasks

- **T1** (S1, S2, S5, S8) — Modelo `drug-types.models.ts`, servicio `drug-types.service.ts` (todo el HTTP), `drug-types-error.ts`. Ruta: inline (parent). Commit: work-unit 1. **Hecho.**
- **T2** (S1, S6, S9, S10) — Listado `drug-type-list.{ts,html,scss}`: tabla, búsqueda debounce 300, filtro estado, paginador/sort servidor, loading contenido, vacío/error. Ruta: inline. Commit: work-unit 2. **Hecho.**
- **T3** (S2, S3, S4, S6, S8) — Diálogos crear/editar + confirmación activar/desactivar + toasts. Ruta: inline. Commit: work-unit 2. **Hecho.**
- **T4** (S6, S7) — Ruta lazy `/drug-types`, ítem de menú ambos roles, escritura oculta a MEDICO. Ruta: inline. Commit: work-unit 2. **Hecho.**
- **T5** (S1-S10) — Reviewer: escribe `*.spec.ts` (servicio, listado, diálogos, permisos), full checks (`npm test`, `build`, `lint`, `format:check`, `features:validate`), PASS/FAIL por spec. Ruta: gentle-ai-worker (rol reviewer). Commit: work-unit 3. **Hecho.**
- **T6** — Documentación del módulo (`docs/DRUG-TYPES.md` o equivalente) + cierre: PASS → `done` en feature-list.md. Ruta: inline. Commit: work-unit 3. **Hecho.**

## Log

- **L1** — Pedido original (2026-10-25): «El proyecto se ve bien. Ahora continua la la implementacin de los siguientes modulos de la aplicacion. La info de la doc se encuentra aca: C:\Users\oscar\source\repos\IA\DispensarioMedicoDocs\docs Aca esta el back: http://localhost:8000/docs»
- **L2** — Decisiones (2026-10-25, Oscar Mora vía ask_user_question): F-009 aprobada con orden explícita de registrar `approved` + nombre. PQ-01: regla del tres (no extraer `shared/` ahora). PQ-02: módulo visible en solo lectura para MEDICO.
- **L3** — Implementación (2026-10-26/27): T1 en el commit `19b72a6` (modelo, servicio con todo el HTTP y `drug-types-error.ts`); T2-T4 en el commit `576dfc1` (listado con carga contenida, diálogos crear/editar y confirmación, toasts, ruta lazy `/drug-types` y ítem «Tipos de fármacos» para ambos roles). El implementer no tocó `*.spec.ts`.
- **L4** — Reviewer (2026-10-27, T5): **PASS por S1..S10**, 19 test files / **312 tests**, sin defectos de producción; `lint`, `build` (lazy chunk `drug-type-list`), `features:validate` (9 features) y Prettier en verde. El único test rojo inicial fue una suposición errónea de jsdom sobre `keyCode` en Escape, corregida en la spec.
- **L5** — Cierre (2026-10-27, T6): `docs/DRUG-TYPES.md` creado con contrato, decisiones, permisos, mapa de archivos, textos, carga contenida y notas para el reviewer; F-009 pasa a `done` en `feature-list.md` (CA-01..CA-08 y T-009-01..T-009-05 marcados). Sin cambios de código, specs ni configuración.
