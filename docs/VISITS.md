# Visitas — Dispensario Médico Frontend

Gestión de las visitas del dispensario (`src/app/features/visits/`, F-015):
listado con filtros combinables y paginación de servidor, registro y edición en
un diálogo amplio con editor de medicamentos, anulación con motivo y auditoría,
y página de detalle `/visits/:id`. Máquina de estados `REGISTRADA` → `ANULADA`
**sin vuelta atrás**: una visita anulada no se edita y no se vuelve a anular. No
hay borrado físico. Sin datos reales: los ejemplos usan valores sintéticos.

Reutiliza el patrón de catálogo fijado por F-009 y continuado por F-010…F-014:
servicio con todo el HTTP, `visits-error.ts` como única fuente de textos,
`visits-toast.ts` para las mutaciones, carga contenida con `aria-busy` en la
región y permisos por rol. Los catálogos de paciente, médico y medicamento se
consumen desde sus servicios existentes (`PatientsService`, `DoctorsService`,
`MedicationsService`): no se duplicó ningún acceso HTTP y nada se extrajo a
`shared/` (regla del tres).

## Contrato aplicado (OpenAPI vivo, verificado 2026-10-27)

Base: `environment.apiUrl + '/v1/visits'` compuesta en un solo lugar
(`VisitsService`). La cabecera `Authorization: Bearer` la adjunta el
`authInterceptor` de F-002; el servicio no conoce almacenamiento.

- `GET /v1/visits` — `page` (desde 1), `size` (1-100, def. 20), `doctor_id`
  (**solo ADMIN**; un MEDICO no puede filtrar por médico), `patient_id`,
  `date_from`/`date_to` (date-time; **sin zona el backend asume UTC-4**),
  `medication_id` (fuera de esta entrega), `status` ∈ `REGISTRADA|ANULADA`, `q`
  (≤200, parcial sobre síntomas o recomendaciones) y `sort`
  (`visited_at|created_at|id|status`, prefijo `-`, def. `-visited_at`);
  `200` `{items, total, page, size, pages}` de `VisitListItem { id, doctor{id,
name}, patient{id, name, cedula}, visited_at, symptoms, status, created_by }`.
  Un MEDICO solo ve sus propias visitas. `q` sigue en el contrato y el servicio
  lo soporta, pero **la UI ya no lo expone**: el campo «Buscar visitas» se
  retiró por decisión humana (2026-10-27) y los criterios del listado son
  estado, rango de fechas, paciente y médico.
- `POST /v1/visits` — **sin `doctor_id`**: el frontend no envía esa clave y el
  médico sale del token del usuario que registra; `patient_id` debe existir y
  estar activo; `visited_at` obligatoria y **no futura**; `symptoms` 3..2000;
  `recommendations` ≤2000; `medications` opcional, sin duplicados, con
  `{ medication_id, quantity? (>0, numérica o texto), instructions? (≤255) }`;
  `201`; `404` si el paciente o un medicamento no existen/están inactivos;
  `422`. Lo ejecuta un MEDICO.
- `GET /v1/visits/{id}` — detalle con `VisitMedicationRead { medication_id,
description, dose, quantity, instructions }` y, si está anulada, `status`,
  `annulled_at`, `annulled_by` y `annulment_reason`. Un MEDICO solo alcanza las
  propias; cualquier otro id responde `404`. **`VisitRead` viaja como
  `additionalProperties: true` sin esquema publicado**: el mapeo es defensivo.
- `PUT /v1/visits/{id}` — reemplazo completo de `patient_id`, `visited_at`,
  `symptoms`, `recommendations` y `medications` (la lista enviada **sustituye**
  a la anterior; `doctor_id` ya no viaja); `200`; **`409 visit_annulled`** si la
  visita está anulada; `404`; `422`.
- `POST /v1/visits/{id}/annul` — body `{ reason }` obligatorio (≤500); `200` con
  `{ id, status, annulled_at, annulled_by, annulment_reason }`; **`409
visit_already_annulled`** (se anula una sola vez); `404`; `422`.

> **Nota de contrato (permisos, 2026-10-27).** En el OpenAPI vigente `PUT
/v1/visits/{id}` y `POST /v1/visits/{id}/annul` están publicados como **solo
> ADMIN**. El humano decidió invertir el modelo —el MEDICO registra, edita y
> anula; el ADMIN solo consulta— y **cambiará el backend**. El frontend se
> implementa contra ese contrato objetivo: hasta que el backend lo conceda,
> esas dos llamadas responderán `403` y el módulo mostrará «No tienes permiso
> para gestionar visitas.».

- `page` del servidor es base 1; `mat-paginator` trabaja base 0 y el listado
  suma 1 al pedir (`pageIndex() + 1`).
- Mapeo `snake_case` ↔ `camelCase`, `trim` y normalización de la cantidad viven
  en `visits.models.ts` (`toVisit()`, `toVisitListPage()`, `toVisitPayload()`,
  `toAnnulPayload()`); sin `any`.

## Fechas (S10)

- **Captura:** la fecha de la visita se elige en un **calendario Material**
  (`matInput` + `[matDatepicker]` + `mat-datepicker-toggle`) y la hora y el
  minuto en dos `mat-select` (`00`-`23` y `00`-`59`). `combineVisitDateTime()`
  compone el reloj de pared (`AAAA-MM-DDTHH:mm`) y `toVisitDateTime()` lo
  normaliza a `AAAA-MM-DDTHH:mm:ss` **sin zona**, que es el formato en que el
  backend asume UTC-4. El body nunca lleva `Z` ni offset. El adaptador nativo
  se provee localmente con `provideNativeDateAdapter()` en los componentes que
  usan el calendario (nunca en `app.config.ts`) y sin dependencias nuevas.
- **Presentación:** `formatVisitDateTime()` usa
  `Intl.DateTimeFormat('es-DO', { timeZone: 'America/Santo_Domingo', … })` y
  **nunca** la zona del navegador. Un valor que llega con zona (`Z`/`±HH:MM`) se
  convierte al reloj de Santo Domingo; un valor sin zona se asume ya en UTC-4.
- **Precarga en edición:** `toVisitDateTimeParts()` descompone el valor guardado
  en el día del calendario (sin desplazar la fecha si el navegador vive en otra
  zona) más la hora y el minuto de los selects, así reabrir el diálogo no mueve
  la hora.
- **Validación de cliente:** `isFutureVisitDateTime()` rechaza una fecha futura
  con **1 minuto de tolerancia**; el validador vive en el grupo porque la regla
  depende de las tres piezas combinadas y se muestra como error propio del
  campo (`future`), no como 422 del backend.
- **Filtros de fecha:** «Desde» y «Hasta» también son calendarios Material;
  `formatVisitDateValue()` toma el día que el usuario ve y se envía
  `date_from` `00:00:00` y `date_to` `23:59:59` (rango inclusivo).

## Decisiones

- **Un diálogo amplio para registro y edición (PQ-01):** `MatDialog` de 64rem
  con `mat-dialog-content` desplazable (`max-block-size: 70vh`), consistente con
  F-009…F-014. El mismo componente `dm-visit-form` cubre `POST` y
  `PUT` de reemplazo completo.
- **Sin control de médico (S3/S11):** como el médico sale del token, ningún
  campo del formulario puede elegirlo. Se eliminaron el `FormControl`
  `doctorId`, su `<mat-select>`, sus validadores y el `GET /v1/doctors` del
  diálogo. `toVisitPayload()` construye el body **sin `doctor_id`** y
  `VisitsService.create()`/`update()` ya no ramifican por rol: el body es
  idéntico para cualquier sesión y la llave nunca viaja (tampoco como `null`).
- **«Buscar y seleccionar a la vez» (PQ-02, S5):** los cuatro selectores
  (filtro de Paciente, filtro de Médico, buscador de Paciente del formulario y
  buscador de Medicamento de cada fila) son **combobox** con
  `mat-autocomplete` sobre un `input` de texto:
  - al enfocar o hacer clic se pide la **primera página de activos**
    (`page=1&size=20&is_active=true`, sin `search`), así el panel abre con
    opciones de inmediato;
  - al escribir se filtra **en el servidor** con `debounceTime(300)` +
    `distinctUntilChanged`;
  - elegir una opción escribe su etiqueta en el control; borrar el texto
    suelta la selección (el `patient_id`/`doctor_id`/`medicationId` se limpia y
    vuelve la primera página de activos).
    Rutas usadas: `GET /v1/patients`, `GET /v1/medications` y `GET /v1/doctors`
    con `search`, `is_active=true` y `size=20`. Nunca se asume que el catálogo
    cabe en una página; el filtro de Médico sigue siendo **solo ADMIN**.
- **Editor de medicamentos (S4):** filas con medicamento obligatorio, cantidad
  opcional y indicaciones opcionales ≤255. La cantidad viaja como número cuando
  el texto es numérico y mayor que 0 (`2` → `2`) y como texto en cualquier otro
  caso (`1 tableta`); vacía → `null`. El `FormArray` validado como conjunto
  (`uniqueMedications`) impide repetir el mismo medicamento con el mensaje «No
  se puede repetir el mismo medicamento en una visita.» y las filas sin
  medicamento se descartan del body.
- **Edición por reemplazo completo (S6):** el `PUT` envía `patient_id`,
  `visited_at`, `symptoms`, `recommendations` y **toda** la lista de
  medicamentos vigente (sin `doctor_id`); quitar una fila la elimina del
  servidor (no hay `PATCH` ni merge). Un `404` al precargar cierra el diálogo
  con `{ notFound: true }` y el listado avisa; un `409 visit_annulled` al
  guardar cierra con `{ annulled: true }` y el listado traduce el mensaje y
  recarga.
- **Anulación de una sola vez (S7/S8):** `POST /{id}/annul` con motivo
  obligatorio y ≤500. `409 visit_already_annulled` se traduce a un mensaje
  propio, cierra el diálogo y recarga la lista. Las filas anuladas no ofrecen
  editar ni anular; su motivo y auditoría se consultan en el detalle.
- **Página de detalle (PQ-03, S9):** elegida porque la lista no trae
  medicamentos ni motivo de anulación y un MEDICO no tiene otra vía para verlos.
  Es de solo lectura para ambos roles: la escritura vive en el listado (MEDICO).
- **Filtros (PQ-04, S2; corregido el 2026-10-27):** estado, rango de fechas
  (calendarios Material enviados como `date_from` `00:00:00` y `date_to`
  `23:59:59`), paciente y médico. El filtro de médico se renderiza **solo para
  ADMIN** y el MEDICO nunca lo envía. El campo «Buscar visitas» (`q`) se retiró
  por decisión humana: ni el control ni su `debounceTime` existen ya y el
  `GET` del listado nunca envía `q`. El filtro por medicamento queda fuera de
  esta entrega aunque el contrato lo acepte.
- **Tabla del listado (2026-10-27):** columnas Paciente (con cédula enmascarada),
  Médico, Fecha y hora y Estado, más Acciones solo para MEDICO. Se retiraron
  «Síntomas» (viven en el detalle y en el formulario) y «Detalle». Cada
  `mat-row` navega a `/visits/{id}` con ratón, y el nombre del paciente es un
  **ancla real** (`a[routerLink]`) que conserva la operación por teclado y de
  tecnología de asistencia; los botones de editar/anular cortan la propagación
  para no navegar sin querer.
- **Detalle sin «Registrado por» (2026-10-27):** el dato `created_by` sigue en
  el modelo (lo usa el mapeo defensivo), pero ya no se renderiza; la auditoría
  de anulación (`annulled_at`, `annulled_by`, `annulment_reason`) se conserva.
- **Mapeo defensivo de `VisitRead` (S16):** como el read model no publica
  esquema, `toVisit()` tolera que falten `recommendations`, `medications`,
  `annulled_at`, `annulled_by`, `annulment_reason`, `created_by`, `doctor` y
  `patient`. La vista sustituye la ausencia con «—», «Sin recomendaciones
  registradas.» o «No se registraron medicamentos.» y nunca rompe.

## Permisos (S11, modelo invertido el 2026-10-27)

- `MEDICO`: **registra, edita y anula** (su médico sale del token). Ve
  «Registrar visita» y la columna Acciones (Editar, Anular) solo en filas
  `REGISTRADA`. Solo ve sus propias visitas y **no** filtra por médico.
- `ADMIN`: **solo lectura en todo el módulo**. No existe «Registrar visita», ni
  la columna Acciones, ni el diálogo de registro/edición, ni el botón de
  anulación — no es ocultar ni deshabilitar: `displayedColumns` se reduce a
  `['patient', 'doctor', 'visitedAt', 'symptoms', 'status', 'detail']` y
  `canWrite()` es `false`, así que ningún control de escritura se renderiza.
  Conserva el **filtro de médico** para supervisión y el enlace de detalle.
- Ambos roles consultan `/visits/:id`; el detalle es de solo lectura.
- Rutas: `/visits` (índice 7) y `/visits/:id` (índice 8) son hijas **lazy** del
  shell **sin `adminGuard`**; el padre ya aplica `authGuard`. Ítem «Visitas»
  (`routerLink="/visits"`, icono `event_note`) visible para ADMIN y MEDICO,
  inmediatamente antes de «Usuarios» (solo ADMIN).
- `403` como red de seguridad del backend: se traduce a «No tienes permiso para
  gestionar visitas.» sin mostrar el mensaje crudo.

## Dónde vive cada cosa

- `visits.models.ts` — `VisitStatus`, `VISIT_STATUSES`, `VISIT_STATUS_LABELS`,
  límites (`SYMPTOMS_MIN_LENGTH`, `SYMPTOMS_MAX_LENGTH`,
  `RECOMMENDATIONS_MAX_LENGTH`, `ANNULMENT_REASON_MAX_LENGTH`,
  `INSTRUCTIONS_MAX_LENGTH`, `QUANTITY_MAX_LENGTH`, `QUERY_MAX_LENGTH`,
  `DEFAULT_PAGE_SIZE`, `PAGE_SIZE_OPTIONS`, `CATALOG_SEARCH_SIZE`), opciones de
  captura (`VISIT_HOUR_OPTIONS`, `VISIT_MINUTE_OPTIONS`), modelos
  (`VisitListItem`, `VisitListPage`,
  `VisitMedication`, `Visit`, `VisitAnnulment`, `VisitPerson`, `VisitPatient`),
  DTOs `snake_case` (`VisitListItemDto`, `VisitReadDto`, `VisitPayloadDto`,
  `VisitAnnulPayloadDto`), mapeadores (`toVisit`, `toVisitListPage`,
  `toVisitPayload`, `toAnnulPayload`, `toVisitListItem`, `toVisitMedication`,
  `toVisitAnnulment`, `toVisitStatus`, `visitStatusLabel`) y helpers de fecha
  (`VISIT_TIME_ZONE`, `toNaiveDateTime`, `toVisitDateTime`,
  `toDateTimeLocalValue`, `toVisitDateTimeParts`, `combineVisitDateTime`,
  `formatVisitDateValue`, `formatVisitDateTime`, `isFutureVisitDateTime`,
  `startOfDayDateTime`, `endOfDayDateTime`) y de cantidad
  (`normalizeQuantity`). Único punto de mapeo; sin `any`.
- `visits.service.ts` — `list()` (GET con filtros combinables; acepta `q` del
  contrato aunque la UI ya no lo envíe), `getById()`, `create()` (POST **sin
  `doctor_id`**), `update()` (PUT de reemplazo completo, también sin
  `doctor_id`) y `annul()` (POST `/{id}/annul`). Todo el transporte del módulo
  vive aquí y el servicio ya no lee la sesión.
- `visits-error.ts` — `mapVisitsError()` (400/401/403/404/409/422/status 0/resto)
  con `code` reconocido para los dos `409` del contrato
  (`visit_annulled`, `visit_already_annulled`), errores por campo del `422`
  (`doctor_id`, `patient_id`, `visited_at`, `symptoms`, `recommendations`,
  `medications`, `reason`) y los textos compartidos
  `VISIT_ANNULLED_MESSAGE`, `VISIT_ALREADY_ANNULLED_MESSAGE` y
  `VISIT_NOT_FOUND_MESSAGE`. Nunca expone `detail`, `code` ni `message`.
- `visits-toast.ts` — `VisitsToast` (`showCreated`, `showUpdated`,
  `showAnnulled`, más `showSuccess`/`showError`): `politeness: 'polite'` →
  `role="status"`, 2000 ms, sin acción; errores `assertive` → `role="alert"`,
  5000 ms con «Cerrar»; posición `center`/`bottom`.
- `visit-list/` — `dm-visit-list`: tabla (Paciente con cédula enmascarada y
  ancla al detalle, Médico, Fecha y hora, Estado con badge y, solo MEDICO,
  Acciones), fila clicable que navega a `/visits/{id}`, filtros estado, fechas
  (calendario Material con limpieza propia), paciente y médico (combobox de
  servidor; el de médico solo ADMIN), `mat-sort` de servidor (`visited_at`,
  `status`), `mat-paginator`, botón «Registrar visita» solo para MEDICO, error
  de carga con reintento, vacío, diálogos y toasts.
- `visit-form/` — `dm-visit-form` (`MatDialog`, solo alcanzable por MEDICO):
  crear (`POST` → `201`) y editar (`PUT` → `200`, precargado con `GET /{id}`),
  combobox de paciente y de medicamento con búsqueda de servidor, editor de
  medicamentos sin duplicados, calendario Material + selects de hora y minuto
  con validador de fecha no futura y errores 409/422 sin mensajes crudos. No
  tiene control de médico.
- `visit-annul/` — `dm-visit-annul`: confirmación con motivo obligatorio y ≤500;
  devuelve `'annulled'`, `{ alreadyAnnulled: true }` o `undefined` al cancelar.
- `visit-detail/` — `dm-visit-detail`: página `/visits/:id` con encabezado
  (paciente, médico, fecha/hora y estado), síntomas, recomendaciones, tabla de
  medicamentos, bloque de anulación y estados «no encontrada»/error con
  reintento.
- `app.routes.ts` — hijas `visits` (índice 7) y `visits/:id` (índice 8), lazy y
  sin `adminGuard`; `users` pasa al índice 9.
- `core/layout/app-shell.html` — ítem «Visitas» (`routerLink="/visits"`, icono
  `event_note`) para ADMIN y MEDICO, inmediatamente antes de «Usuarios».

## Textos propios (español)

- Listado: «Visitas», «Registrar visita» (solo MEDICO), «Estado»,
  «Todos/Registrada/Anulada», «Desde», «Hasta», «Paciente» («Filtrar por
  paciente», «Quitar el filtro de paciente»), «Médico» («Filtrar por médico»,
  «Quitar el filtro de médico», solo ADMIN), «Reintentar», vacío «No hay
  visitas para mostrar.».
- Calendarios del listado: «Abrir el calendario de la fecha inicial», «Abrir el
  calendario de la fecha final», «Quitar la fecha inicial del rango» y «Quitar
  la fecha final del rango».
- Registro/edición: «Nueva visita» / «Editar visita», «Paciente» («Buscar
  paciente por nombre o cédula», «Elige un paciente activo; escribe para
  buscarlo en el servidor.»), «Fecha y hora de la visita» («Abrir el calendario
  de la fecha de la visita», «Fecha de la visita»), «Hora», «Minuto»,
  «Síntomas», «Recomendaciones», «Medicamentos entregados», «Agregar
  medicamento», «Sin medicamentos agregados.», «Cantidad», «Indicaciones»,
  «Escribe para buscarlo en el servidor.», «Cancelar», «Registrar visita» /
  «Guardar cambios» (con «Guardando…» durante el envío) y «Cargando visita…».
- Validación de campo: «Selecciona el paciente», «Ingresa la fecha y hora de la
  visita», «Elige la hora de la visita», «Elige el minuto de la visita», «La
  fecha de la visita no puede estar en el futuro.», «Ingresa los síntomas»,
  «Ingresa al menos 3 caracteres en los síntomas.», «Los síntomas no deben
  superar los 2000 caracteres.», «Las recomendaciones no deben superar los 2000
  caracteres.» y «No se puede repetir el mismo medicamento en una visita.».
- Anulación: «Anular visita», «¿Anular la visita de <paciente> del <fecha>? Esta
  acción no se puede revertir.», «Motivo de la anulación», «Hasta 500
  caracteres.», «Ingresa el motivo de la anulación.», «El motivo no debe superar
  los 500 caracteres.», «Anular» (con «Anulando…»).
- Detalle: «Volver al listado», «Datos de la visita», «Paciente», «Médico»,
  «Fecha y hora», «Estado», «Síntomas», «Recomendaciones»,
  «Sin recomendaciones registradas.», «Medicamentos entregados» (Medicamento,
  Dosis, Cantidad, Indicaciones), «No se registraron medicamentos.»,
  «Anulación», «Motivo de anulación», «Anulada el», «Visita no
  encontrada» y «No se encontró la visita solicitada. Puede que no exista o que
  pertenezca a otro médico.».
- 400 → «Los datos enviados no son válidos. Revisa el formulario.»
- 401 → «Tu sesión expiró. Inicia sesión de nuevo.»
- 403 → «No tienes permiso para gestionar visitas.»
- 404 → «La visita solicitada ya no existe. Actualiza la lista.»
- 409 `visit_annulled` → «La visita está anulada y no se puede editar.»;
  409 `visit_already_annulled` → «La visita ya estaba anulada.»; 409 genérico →
  «La visita cambió de estado. Actualiza la lista.»
- 422 → general «Revisa los datos ingresados.» + por campo «Revisa el
  paciente», «Revisa la fecha y hora de la visita», «Revisa los síntomas»,
  «Revisa las recomendaciones», «Revisa los medicamentos» y «Revisa el motivo
  de la anulación» (los campos desconocidos se ignoran; `doctor_id` sigue
  mapeado como red de seguridad si el backend lo reportara).
- Red/0 → «No se pudo conectar con el servidor. Verifica tu conexión e inténtalo
  de nuevo.»; resto de estados → «Ocurrió un error inesperado. Inténtalo de
  nuevo en unos segundos.»
- Éxitos en toast (`role="status"`, 2000 ms): «Visita registrada.», «Visita
  actualizada.» y «Visita anulada.».

## Avisos toast, carga contenida y un solo GET por gesto

Los tres éxitos y los errores de **mutación** (incluido el 409 de una visita ya
anulada y el 404 real del `GET /{id}`) van a `VisitsToast`; `visits-error.ts`
sigue siendo la única fuente de textos. El **fallo de carga del listado y del
detalle no se anuncia por toast**: se muestra inline con reintento, para no
duplicar el anuncio. `MatSnackBarModule` se importa una sola vez en cada ámbito
(`VisitList` y `VisitDetail`).

Carga contenida sin parpadeo: `loading` solo gobierna la región de contenido
(`.dm-visit-list__table-region` / `.dm-visit-detail__table-region` con
`aria-busy`); header, filtros y paginador permanecen montados durante `load()` y
las filas visibles se conservan hasta que llega la página nueva. El overlay de
carga es absoluto (`pointer-events: none`), así no ocupa altura en flujo ni roba
el puntero ni el foco.

Un solo `GET` por gesto: cualquier cambio de filtro (estado, fechas, paciente,
médico), de orden o de tamaño de página vuelve a la página 1 y emite una única
petición con todos los criterios vigentes. Escribir en los combobox de paciente
o médico **no** dispara el `GET` del listado: solo la selección (o la limpieza)
filtra; ese texto emite su propia búsqueda de catálogo con `size=20`.

Corrección heredada del falso 404 al cancelar (F-007): el listado solo recarga y
avisa cuando el diálogo cierra con un resultado explícito (`'saved'`,
`{ notFound: true }`, `{ annulled: true }`, `'annulled'`,
`{ alreadyAnnulled: true }`); «Cancelar», Escape o backdrop (`undefined`) no
recargan, no avisan y no emiten ningún `GET`.

## Diseño y accesibilidad (S14)

- Solo tokens `--dm-*`: sin hex literales y sin `::ng-deep`;
  `@include dm.dm-focus-ring` en listado, formulario, anulación y detalle;
  tipografía con `dm-typescale` y cédulas con `dm-mono` + cifras tabulares.
- Badges de estado con los chips AA del sistema (Registrada 4.57:1 / Anulada
  5.30:1); el rojo institucional queda para la anulación (borde del bloque y
  acción destructiva).
- Tablas con `aria-label` («Visitas», «Medicamentos entregados»), cabeceras
  reales (`scope="col"` en el detalle), botones con `aria-label` que incluye el
  paciente, buscadores y filtros con `mat-label` visible más `aria-label`,
  `role="status"` en vacíos/precargas y `role="alert"` en errores.
- La tabla sigue siendo operable sin ratón: la fila navega al detalle con clic,
  pero la vía real es el ancla del nombre del paciente (`a.dm-visit-list__patient-link`,
  `aria-label` «Ver el detalle de la visita de <paciente>», foco visible del
  mixin `dm-focus-ring`). Ninguna fila queda inalcanzable por teclado.
- Cada `mat-datepicker-toggle` lleva nombre legible («Abrir el calendario de la
  fecha inicial/final/de la visita») y los selects de hora y minuto tienen
  `mat-label` (`Hora`, `Minuto`) más `aria-label` («Hora de la visita», «Minuto
  de la visita»); cada extremo del rango tiene su botón de limpieza propio.
- El error del campo paciente se asocia al input con `aria-describedby`
  (`dm-visit-form-patient-error`), porque el control visible es el buscador del
  autocompletar.
- Scroll horizontal contenido en tablas (`overflow-x: auto` con
  `min-inline-size` declarado) por debajo de 768px; áreas táctiles de 44px en
  mobile y `prefers-reduced-motion` respetado en las transiciones de fila.

## Notas para el reviewer

- Evidencia de implementación (2026-10-27, modelo de permisos invertido,
  comboboxes y las seis correcciones de UI): specs en `visits.models.spec.ts`,
  `visits.service.spec.ts`, `visits-error.spec.ts`, `visits-toast.spec.ts`,
  `visit-list/visit-list.spec.ts`, `visit-form/visit-form.spec.ts`,
  `visit-annul/visit-annul.spec.ts` y `visit-detail/visit-detail.spec.ts`
  (8 archivos / 108 tests).
  Cubren S1-S16: parámetros combinables del listado y reset a página 1,
  **MEDICO con «Registrar visita» y acciones**, **ADMIN sin ningún control de
  escritura y conservando el filtro de médico**, **cada combobox abriendo la
  primera página de activos al enfocar y filtrando en el servidor al escribir**,
  borrar el texto soltando la selección, **«Desde»/«Hasta» como calendarios
  Material con rango inclusivo y limpieza**, **fecha de la visita con calendario
  más selects de hora y minuto**, **sin campo «Buscar visitas» ni `q` en el
  `GET`**, **tabla sin columnas «Síntomas» ni «Detalle»**, **clic de fila que
  navega a `/visits/{id}` con ancla real en el paciente**, **detalle sin
  «Registrado por»**, cantidad normalizada y sin medicamentos repetidos, `PUT`
  que sustituye la lista anterior y **sin `doctor_id`**, fecha no futura, envío
  de `visited_at` sin zona, presentación en UTC-4, `409 visit_annulled`, `409
visit_already_annulled`, auditoría de anulación en el detalle, `404` «no
  encontrada» y mapeo defensivo de `VisitRead`.
- Las specs estructurales quedan actualizadas: `app.spec.ts` fija 10 hijas del
  shell con `visits` en el índice 7 y `visits/:id` en el 8, ambas lazy y sin
  `adminGuard` (`users` pasa al índice 9); `app-shell.spec.ts` fija 9 enlaces
  para ADMIN con `/visits` justo antes de `/users`, y 7 para sesión anónima y
  MEDICO.
- Límite conocido: el filtro por medicamento (`medication_id`) no se expone en
  esta entrega por decisión de producto (PQ-04) aunque el contrato lo acepte.
