# F-013 — Módulo para gestionar pacientes

CRUD del catálogo de pacientes (RF-05, US-16, CA-CRUD). Campos `name`, `cedula`, `carnet`, `patient_type`, `is_active`. Aprobada por Oscar Mora el 2026-10-27. Fuera de alcance: historia clínica, visitas y cualquier dato clínico.

## Specs

- **S1** — Listado: paginado 100% servidor con `page`, `size`, `search`, `is_active` y `sort`; respuesta `items/total/page/size/pages`; `size` 1-100 (def. 20), opciones 10/20/50; `search` ≤100 parcial y case-insensitive en `name`, `cedula` o `carnet`, con `debounceTime(300)` + `distinctUntilChanged` (un `GET` por gesto); `sort` ∈ `name|cedula|created_at|is_active|id` con prefijo `-` (def. `name`); reset a página 1 al cambiar criterio; total = `total` del servidor.
- **S2** — Crear: `name` (1..150, requerido, recortado), `cedula` (requerida), `patient_type` (requerido); `carnet` ≤50 opcional; `is_active` opcional (D-5, por defecto `true`); `201` cierra con toast y recarga; `409` si la cédula o el carnet ya existen.
- **S3** — Cédula con máscara: se captura y se muestra como `XXX-XXXXXXX-X` (3-7-1); la validación exige exactamente 11 dígitos tras descartar separadores; el body envía los 11 dígitos **sin** máscara; un valor incompleto o con letras bloquea el envío con mensaje propio.
- **S4** — Carnet: alfanumérico libre de hasta 50 caracteres; **obligatorio cuando `patient_type === 'ESTUDIANTE'`** y opcional en el resto (refleja el contrato); vacío se envía como `null`; `409` de carnet duplicado se muestra como error de campo `carnet`.
- **S5** — `patient_type`: catálogo cerrado `ESTUDIANTE|EMPLEADO|PROFESOR|OTROS` en `mat-select` con etiquetas capitalizadas (Estudiante, Empleado, Profesor, Otros); el body envía el valor en mayúsculas.
- **S6** — Editar: diálogo precargado con `GET /{id}` (`200` también con paciente inactivo); el `PUT` es reemplazo completo de `name`+`cedula`+`patient_type`+`is_active`; **un carnet vacío lo borra** (el contrato no envía `carnet`); Cancelar/Escape/backdrop sin efectos; `404` al precargar cierra con `{ notFound: true }` para que la lista avise.
- **S7** — Desactivar/activar: `DELETE` = desactivación lógica e idempotente (no borra la fila ni sus referencias); reactivar reenvía el registro con `is_active: true` en el `PUT` de reemplazo completo; confirmación explícita en ambos sentidos.
- **S8** — Mensajes en español a nivel de campo; 400/401/403/404/409/422 mapeados sin exponer `detail`, `code` ni mensajes crudos del backend.
- **S9** — UI: tabla (nombre, cédula, carnet, tipo, estado, acciones), buscador, filtro Todos/Activos/Inactivos, orden, paginación, diálogos, confirmación, toasts. Texto de vacío: «No hay pacientes para mostrar.». Ítem de menú: «Pacientes». Ruta lazy `/patients`.
- **S10** — Permisos: escritura solo `ADMIN`; con `MEDICO` no existe ningún control de escritura en el DOM (no se deshabilita ni se oculta por CSS). `403` como red de seguridad.
- **S11** — Diseño: solo tokens `--dm-*`, sin hex literales ni `::ng-deep`; `@include dm.dm-focus-ring`; badges de estado AA; scroll horizontal contenido <768px; accesibilidad AA (labels, foco visible, landmarks).
- **S12** — Carga sin parpadeo: loading contenido en la región de la tabla (overlay absoluto, `pointer-events: none`), header/filtros/paginador montados, `aria-busy` solo en la región, foco conservado en el buscador; error de carga inline con reintento (patrón F-009), sin toast para el fallo de carga.

## Tasks

- **T1** (S1, S2, S6, S8) — `patients.models.ts` (DTOs `snake_case`, `toPatient`, `toPatientListPage`, `toPatientPayload`, `CedulaMask` helpers), `patients.service.ts` (`list`/`getById`/`create`/`update`/`deactivate`/`reactivate`), `patients-error.ts`. Ruta: inline. Commit: work-unit 1. **[x] hecho**
- **T2** (S1, S9, S11, S12) — Listado `patient-list.{ts,html,scss}`. Ruta: inline. Commit: work-unit 2. **[x] hecho**
- **T3** (S2, S3, S4, S5, S6, S8) — Diálogos crear/editar con máscara de cédula y carnet condicional, confirmación y `patients-toast.ts`. Ruta: inline. Commit: work-unit 2. **[x] hecho**
- **T4** (S9, S10) — Ruta lazy `/patients`, ítem de menú ambos roles, escritura oculta a MEDICO. Ruta: inline. Commit: work-unit 2. **[x] hecho**
- **T5** (S1-S12) — Reviewer: specs completas, full checks, PASS/FAIL por spec. Commit: work-unit 3. **[x] specs escritas y verdes para `src/app/features/patients/**`; el PASS final y el full siguen en manos del reviewer**
- **T6** — Documentación `docs/PATIENTS.md` + cierre `done`. Commit: work-unit 3. **[x] `docs/PATIENTS.md` escrito; el cierre `done` requiere actualizar `feature-list.md`, fuera de las superficies de edición del implementer**

## Log

- **L1** — Pedido (2026-10-27): continuar con el módulo de Pacientes (F-013) con cédula de 11 dígitos, carnet y tipo.
- **L2** — Humano (2026-10-27): aprobó F-013; cédula mostrada con máscara `XXX-XXXXXXX-X` (sin validar dígito verificador) y carnet alfanumérico libre de hasta 50 caracteres.
- **L3** — Contrato verificado contra el OpenAPI vivo (`/api/v1/patients`): `PatientRead` de seis campos planos sin `created_at`; `POST` requiere `name`+`cedula`+`patient_type`; `PUT` es reemplazo completo y un carnet ausente lo borra; `DELETE` desactiva de forma lógica e idempotente; escritura solo `ADMIN`.
- **L4** — Implementer (2026-10-27): T1-T4 implementadas en `src/app/features/patients/**` (models, service, error, toast, listado, diálogos, confirmación), ruta lazy `/patients` en `app.routes.ts` e ítem «Pacientes» en `app-shell.html` (ambos roles). T5: specs de la feature escritas y verdes (`npx ng test --watch=false --include="src/app/features/patients/**/*.spec.ts"` → 7 archivos / 135 tests). T6: `docs/PATIENTS.md` escrito.
- **L5** — Implementer (2026-10-27): dos specs existentes fuera de las superficies de edición autorizadas (propiedad del reviewer) fijan la estructura y fallan con la ruta y el ítem nuevos: `src/app/app.spec.ts` (2 tests: `children.length` 6 → 7 y `users` en el índice 5 → 6) y `src/app/core/layout/app-shell.spec.ts` (3 tests: 5/5/6 enlaces → 6/6/7). Quedan pendientes de autorización para actualizarse; ver `risks` del handoff.
- **L6** — Parent/team-lead (2026-10-27): autorizó y aplicó la actualización de las dos specs estructurales derivadas de la ruta y el ítem nuevos — `src/app/app.spec.ts` (7 hijas, `patients` en el índice 5, `users` en el 6, nueva aserción de `/patients` lazy sin `adminGuard`) y `src/app/core/layout/app-shell.spec.ts` (6/6/7 enlaces con «Pacientes» antes de «Usuarios»). Ambas en verde (66 tests entre las dos).
- **L7** — Cierre (2026-10-27): F-013 en `done`. Verificación final: `npm test` 45 archivos / **806 tests** verdes, `npm run lint`, `npm run build`, `npm run features:validate` (13 features) y Prettier sobre los archivos tocados. `docs/PATIENTS.md` escrito.
