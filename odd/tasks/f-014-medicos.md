# F-014 — Módulo para gestionar médicos

CRUD del catálogo de médicos (RF-04, US-15, CA-CRUD). Campos `name`, `cedula`, `lab_shift` (tanda), `specialty` (especialidad), `is_active`, más la cuenta asociada en solo lectura (`user`). Aprobada por Oscar Mora el 2026-10-27. Fuera de alcance: visitas, consultas y cualquier dato clínico; también el perfil propio del rol MEDICO.

## Specs

- **S1** — Listado: paginado 100% servidor con `page`, `size`, `search`, `is_active` y `sort`; respuesta `items/total/page/size/pages`; `size` 1-100 (def. 20), opciones 10/20/50; `search` ≤100 parcial y case-insensitive en `name` o `cedula`, con `debounceTime(300)` + `distinctUntilChanged` (un `GET` por gesto); `sort` ∈ `name|cedula|lab_shift|specialty|created_at|is_active|id` con prefijo `-` (def. `name`); reset a página 1 al cambiar criterio; total = `total` del servidor.
- **S2** — Crear: `name` (1..150, requerido, recortado), `cedula` (requerida), `lab_shift` (requerido), `specialty` (requerida, ≤100); `is_active` opcional (D-5, por defecto `true`); `201` cierra con toast y recarga; `409` por cédula duplicada como error de campo `cedula`.
- **S3** — Cédula con máscara: se captura y se muestra como `XXX-XXXXXXX-X` (3-7-1), misma regla que F-013 CA-03; la validación exige exactamente 11 dígitos tras descartar separadores; el body envía los 11 dígitos **sin** máscara.
- **S4** — Tanda (`lab_shift`): `mat-select` cerrado con cuatro opciones —Matutina, Vespertina, Nocturna, Mixta— que envía `MATUTINA|VESPERTINA|NOCTURNA|MIXTA` (el contrato la acepta como texto ≤50). Si el registro precargado trae un valor no canónico, ese valor se agrega como opción extra para no perderlo al guardar.
- **S5** — Especialidad (`specialty`): texto libre de 1 a 100 caracteres, recortado.
- **S6** — Asociación usuario-médico: se **lee** de `DoctorRead.user` (`DoctorUserRead { id, username, is_active } | null`); el listado muestra el `username` o «Sin usuario». El formulario no la edita y el `PUT /doctors/{id}` no la modifica; un médico sin cuenta asociada es válido. La asignación se hace en el módulo de Usuarios (F-006).
- **S7** — Editar: diálogo precargado con `GET /{id}` (`200` también con médico inactivo); el `PUT` es reemplazo completo de `name`+`cedula`+`lab_shift`+`specialty`+`is_active`; Cancelar/Escape/backdrop sin efectos; `404` al precargar cierra con `{ notFound: true }` para que la lista avise.
- **S8** — Desactivar/activar: `DELETE` = desactivación lógica e idempotente (no borra la fila ni sus referencias); reactivar reenvía el registro con `is_active: true` en el `PUT` de reemplazo completo; confirmación explícita en ambos sentidos. El `409 doctor_has_visits` se traduce a «No se puede desactivar el médico porque tiene visitas registradas.».
- **S9** — Mensajes en español a nivel de campo; 400/401/403/404/409/422 mapeados sin exponer `detail`, `code` ni mensajes crudos del backend.
- **S10** — UI: tabla (nombre, cédula, tanda, especialidad, usuario, estado, acciones), buscador, filtro Todos/Activos/Inactivos, orden, paginación, diálogos, confirmación, toasts. Texto de vacío: «No hay médicos para mostrar.». Ítem de menú: «Médicos». Ruta lazy `/doctors`.
- **S11** — Permisos: escritura solo `ADMIN`; el ítem de menú y la ruta `/doctors` son solo para ADMIN (`adminGuard`), igual que Usuarios. El módulo no renderiza ningún control de escritura a otros roles.
- **S12** — Diseño: solo tokens `--dm-*`, sin hex literales ni `::ng-deep`; `@include dm.dm-focus-ring`; badges de estado AA; scroll horizontal contenido <768px; accesibilidad AA (labels, foco visible, landmarks).
- **S13** — Carga sin parpadeo: loading contenido en la región de la tabla (overlay absoluto, `pointer-events: none`), header/filtros/paginador montados, `aria-busy` solo en la región, foco conservado en el buscador; error de carga inline con reintento (patrón F-009), sin toast para el fallo de carga.

## Tasks

- **T1** (S1, S2, S5, S6, S9) — `doctors.models.ts` (DTOs `snake_case` incluido `user`, `toDoctor`, `toDoctorListPage`, `toDoctorPayload`, reutilizar los helpers de máscara de cédula), `doctors.service.ts` (`list`/`getById`/`create`/`update`/`deactivate`/`reactivate`), `doctors-error.ts`. Ruta: inline. Commit: work-unit 1.
- **T2** (S1, S10, S12, S13) — Listado `doctor-list.{ts,html,scss}`. Ruta: inline. Commit: work-unit 2.
- **T3** (S2, S3, S4, S5, S7, S8, S9) — Diálogos crear/editar (máscara de cédula, select de tanda), confirmación y `doctors-toast.ts`. Ruta: inline. Commit: work-unit 2.
- **T4** (S10, S11) — Ruta lazy `/doctors` con `adminGuard`, ítem de menú solo ADMIN y actualización de las specs estructurales (`app.spec.ts`, `app-shell.spec.ts`). Ruta: inline. Commit: work-unit 2.
- **T5** (S1-S13) — Reviewer: specs completas, full checks, PASS/FAIL por spec. Commit: work-unit 3.
- **T6** — Documentación `docs/DOCTORS.md` + cierre `done`. Commit: work-unit 3.

## Log

- **L1** — Pedido (2026-10-27): implementar el módulo de Médicos (F-014) con cédula, tanda, especialidad y asociación usuario-médico.
- **L2** — Humano (2026-10-27): instruyó implementar y resolvió las cuatro preguntas abiertas — asociación leída desde el contrato re-verificado (`DoctorRead.user`, tras modificar la entidad `doctors` en el backend), tanda como select cerrado de cuatro opciones, especialidad como texto libre y módulo visible solo para ADMIN.
- **L3** — Contrato verificado contra el OpenAPI vivo (`/api/v1/doctors`): `DoctorRead` de seis campos planos más `user` (`DoctorUserRead | null`); `POST` requiere `name`+`cedula`+`lab_shift`+`specialty`; `PUT` es reemplazo completo y no toca la asociación; `DELETE` desactiva de forma lógica, idempotente, con `409 doctor_has_visits`; escritura solo `ADMIN`.
- **L4** — implementer (2026-10-27): T1-T4 implementadas con specs escritas primero (RED observado: módulos inexistentes; GREEN: 141 tests de las 7 specs del feature en verde) y T5-T6 cubiertas por las mismas specs y `docs/DOCTORS.md`. Decisiones de implementación: (a) los helpers de la máscara de cédula se **importan y reexportan** desde `patients.models.ts` para no tener una segunda copia de la regla de F-013 CA-03; (b) `Doctor.labShift` se declara `string` y `labShiftOptions(stored)` agrega el valor no canónico como opción extra (S4); (c) `mat-sort` se expone en Nombre, Cédula, Tanda, Especialidad y Estado (el header de Estado usa el id `is_active`, el nombre del criterio en la API) y no en `created_at`/`id`, que el read model no trae; (d) `409` de cédula duplicada se mapea con `code` `doctor_exists`/`doctor_cedula_exists` y `errors[].field` como respaldo, porque el OpenAPI no publica ese `code` (sí está verificado `doctor_has_visits`); (e) los dos specs estructurales quedan actualizados: `app.spec.ts` con 8 hijas y `doctors` en el índice 6 con `adminGuard` (`users` al 7), `app-shell.spec.ts` con 8 enlaces para `ADMIN` y `/doctors` justo antes de `/users`, y 6 para anónimo/`MEDICO`.
