# Pacientes — Dispensario Médico Frontend

Gestión del catálogo de pacientes (`src/app/features/patients/`, F-013):
listado con tabla de Material, búsqueda/filtros/orden de servidor, paginación
de servidor obligatoria, crear/editar con diálogos, cédula con máscara
`XXX-XXXXXXX-X` y carnet condicional, y desactivación lógica vía `DELETE`.
Accesible para `ADMIN` y `MEDICO`, con escritura solo para `ADMIN` (el médico
ve la tabla sin controles de escritura en el DOM). Sin datos reales: los
ejemplos usan valores sintéticos.

Reutiliza el patrón de catálogo fijado por F-009 (`docs/DRUG-TYPES.md`) y
continuado por F-010/F-011: servicio con todo el HTTP, `*-error.ts` como única
fuente de textos, `*-toast.ts` para las mutaciones, carga contenida con
`aria-busy` en la región y permisos ADMIN/MEDICO. Por la **regla del tres**
(PQ-01) no se extrajo nada a `shared/`.

## Contrato aplicado (OpenAPI vivo, verificado 2026-10-27)

Base: `environment.apiUrl + '/v1/patients'` compuesta en un solo lugar
(`PatientsService`). La cabecera `Authorization: Bearer` la adjunta el
`authInterceptor` de F-002; el servicio no conoce almacenamiento ni el rol.

- `GET /v1/patients` — query params `page` (desde 1), `size` (1-100, por
  defecto 20), `search` (parcial y case-insensitive sobre `name`, `cedula` o
  `carnet`), `is_active` (`true`/`false`) y `sort`
  (`name|cedula|created_at|is_active|id`, por defecto `name`, prefijo `-` para
  descendente); `200` `{items, total, page, size, pages}`. Sin paginación ni
  filtrado en cliente.
- `PatientRead` — **seis campos planos**: `id`, `name`, `cedula`, `carnet`
  (`string|null`), `patient_type`, `is_active`. **No devuelve `created_at`**
  aunque lo acepte como criterio de orden: por eso la tabla no expone esa
  columna y el modelo `Patient` no la declara.
- `POST /v1/patients` — body `{name, cedula, patient_type, carnet, is_active}`;
  `name` 1..150, `cedula` 11 dígitos única, `patient_type` del catálogo,
  `carnet` ≤50 (único cuando existe y **obligatorio para `ESTUDIANTE`**),
  `is_active` opcional (def. `true`); `201`; `409` si la cédula o el carnet ya
  existen; `422` de validación.
- `GET /v1/patients/{id}` — `200` (también si el paciente está inactivo) o
  `404`.
- `PUT /v1/patients/{id}` — **reemplazo completo** de `name` + `cedula` +
  `patient_type` + `is_active`; un carnet vacío se envía como `null` y **borra**
  el almacenado; `200`; `409`; `404`; `422`.
- `DELETE /v1/patients/{id}` — desactivación lógica e **idempotente** (no borra
  la fila ni sus referencias); `204`; `404`.
- `page` del servidor es base 1; `mat-paginator` trabaja base 0 y el listado
  suma 1 al pedir (`pageIndex() + 1`).
- Mapeo `snake_case` ↔ `camelCase`, `trim` del nombre y descarte de la máscara
  de la cédula viven en `patients.models.ts` (`toPatient()`,
  `toPatientListPage()`, `toPatientPayload()`); sin `any`.

## Decisiones

- **Cédula con máscara (S3):** se captura y se muestra como `XXX-XXXXXXX-X`
  (bloques 3-7-1). El control del formulario guarda el texto con máscara y
  `formatCedula()` la aplica al escribir o pegar (descarta todo lo que no sea
  dígito y recorta a 11, dejando el cursor tras el último dígito). La
  validación exige exactamente 11 dígitos tras descartar separadores
  (`isCedulaComplete()`), el body envía los 11 dígitos sin máscara
  (`toPatientPayload()` → `cedulaDigits()`) y un valor incompleto bloquea el
  envío con mensaje propio. No se valida dígito verificador (decisión humana
  L2).
- **Carnet condicional (S4):** alfanumérico libre de hasta 50 caracteres;
  obligatorio cuando `patient_type === 'ESTUDIANTE'` (espejo de la regla del
  contrato) y opcional en el resto. El requerido se evalúa con
  `carnetRequired(patientTypeControl)` y se revalida al cambiar el tipo, de
  modo que el error queda bajo el campo `carnet`. Un carnet vacío se envía como
  `null`.
- **`patient_type` (S5):** catálogo cerrado `ESTUDIANTE|EMPLEADO|PROFESOR|
OTROS` en `mat-select` con etiquetas capitalizadas (Estudiante, Empleado,
  Profesor, Otros) desde `PATIENT_TYPE_LABELS`; el body envía el valor en
  mayúsculas.
- **Nombre único:** el contrato no separa nombres y apellidos, así que el
  formulario tiene un solo campo `name` («Nombre completo»), recortado, de 1 a
  150 caracteres.
- **`PUT` de reemplazo completo (S6):** editar envía `name` + `cedula` +
  `patient_type` + `is_active` (+ `carnet`). Un carnet vacío viaja como `null`
  y el backend lo borra (`PatientUpdate.carnet` por defecto `None`, mismo
  efecto que omitirlo). Reactivar reenvía el registro visible con
  `is_active: true`, **conservando el carnet**: un `PUT` parcial responde `422`
  y un carnet ausente lo borraría.
- **`DELETE` = desactivación lógica e idempotente (S7):** nunca hay borrado
  físico ni método de borrado en el servicio; repetir la llamada también
  responde `204`. La confirmación lo dice explícitamente («Esta acción no
  elimina sus datos.»). Reactivar es un `PUT` de reemplazo completo con
  `is_active: true`.
- **`is_active` opcional al crear (D-5):** por defecto `true`; el checkbox
  «Paciente activo» solo se renderiza en creación. En edición el estado se
  cambia con Activar/Desactivar del listado y el `PUT` reenvía el valor
  precargado (`loadedIsActive`), sin control en el diálogo.
- **Orden de servidor (S1):** el contrato acepta
  `name|cedula|created_at|is_active|id` con prefijo `-`; la UI expone
  `mat-sort` en Nombre y Cédula (las columnas del `PatientRead`; `created_at`
  no se muestra). Sin orden elegido, el listado no envía `sort` y aplica el
  valor por defecto del backend (`name`); cambiar de orden vuelve a la página 1.
- **Paginador:** opciones 10/20/50 (máx. 100 por RNF-06), por defecto 20.
  Cambiar el tamaño vuelve a la página 0 (base 1 en el `GET`); el total
  mostrado es el `total` del servidor.
- **Estados vacío/carga/error (S12):** la tabla y el paginador solo se montan
  con filas (`items().length > 0`); el vacío «No hay pacientes para mostrar.»
  aparece solo cuando terminó la carga sin filas y sin error. El error de carga
  se muestra inline dentro de la región de la tabla (`role="alert"`) con el
  mensaje de `mapPatientsError` y un botón «Reintentar»; el reintento republica
  el `GET` con los criterios vigentes (página, tamaño, búsqueda, estado y orden)
  sin volver a la página 1 y queda `disabled` mientras `loading()` es `true`.
- **Presentación:** la cédula se muestra con máscara aunque el servidor la
  devuelva plana, y un paciente sin carnet muestra «—» en su celda.

## Permisos (S10)

- `ADMIN`: CRUD completo. Ve «Nuevo paciente», la columna Acciones (Editar,
  Desactivar/Activar) y el checkbox de estado al crear.
- `MEDICO`: solo lectura. Con `role === 'MEDICO'` **no existe ningún control de
  escritura en el DOM** (no es ocultar ni deshabilitar): `displayedColumns` se
  reduce a `['name', 'cedula', 'carnet', 'type', 'status']` y el botón Nuevo no
  se renderiza.
- Ruta `/patients` sin guard de rol (hija lazy del shell con `authGuard` del
  padre): accesible para ambos roles autenticados. Ítem «Pacientes» del menú
  visible para ambos.
- `403` como red de seguridad del backend: el frontend lo traduce a «No tienes
  permiso para gestionar pacientes.» y nunca muestra el mensaje crudo.

## Dónde vive cada cosa

- `patients.models.ts` — `Patient`, `PatientType`, `PATIENT_TYPES`,
  `PATIENT_TYPE_LABELS`, límites (`CEDULA_DIGITS`, `NAME_MAX_LENGTH`,
  `CARNET_MAX_LENGTH`, `SEARCH_MAX_LENGTH`), DTOs `snake_case`
  (`PatientDto`/`PatientListResponseDto`/`PatientPayloadDto`),
  `PatientListParams`, `PatientFormInput`, `toPatient()`,
  `toPatientListPage()`, `toPatientPayload()` y los helpers de máscara
  `cedulaDigits()`, `formatCedula()`, `isCedulaComplete()`. Único punto de
  mapeo; sin `any`.
- `patients.service.ts` — `list()` (`GET` con `page`/`size`/`search`/
  `is_active`/`sort`), `getById()`, `create()` (`POST` → `201`), `update()`
  (`PUT` → `200`), `deactivate()` (`DELETE` idempotente),
  `reactivate(patient)` (`PUT` de reemplazo completo con `is_active: true`).
- `patients-error.ts` — `mapPatientsError()` (400/401/403/404/409/422/status
  0/resto). En `409` usa el `code` estable del envelope
  (`patient_exists` → campo `cedula`, `patient_carnet_exists` → campo `carnet`,
  con `errors[].field` como respaldo) porque ese estado no rellena `errors[]`;
  en `422` lee `errors[].field` en `snake_case` y conoce `name`, `cedula`,
  `carnet` y `patient_type`. Nunca expone `detail`, `code` ni `message`.
- `patients-toast.ts` — `PatientsToast` (`providedIn: 'root'`, único punto de
  toast y único hogar de los literales de éxito) con `showCreated()`,
  `showUpdated()`, `showActivated()` y `showDeactivated()` (`politeness:
'polite'` → `role="status"`, 2000 ms, sin acción) más los genéricos
  `showSuccess()` y `showError()` (`politeness: 'assertive'` →
  `role="alert"`, 5000 ms, acción «Cerrar»); posición `center`/`bottom`.
- `patient-list/` — `dm-patient-list`: tabla (Nombre, Cédula con máscara,
  Carnet, Tipo, Estado con badge, Acciones), buscador (`debounceTime(300)` +
  `distinctUntilChanged`), filtro Todos/Activos/Inactivos, `mat-sort` de
  servidor, `mat-paginator`, botón Nuevo, error de carga con reintento,
  diálogos y toasts. Delega todo el HTTP en el servicio.
- `patient-form/` — `dm-patient-form` (`MatDialog`): crear (`POST` → `201`,
  con checkbox de estado) y editar (`PUT` de reemplazo completo → `200`,
  precargado con `GET /{id}`, sin control de estado); máscara de cédula,
  carnet condicional y validador `server` para 409/422; Enter envía una vez,
  Escape cierra sin guardar.
- `patient-confirm/` — `dm-patient-confirm`: confirmación dedicada, botón
  destructivo (`color="warn"`) solo al desactivar; devuelve `true` al confirmar
  y `undefined` al cancelar/Escape/backdrop.
- `app.routes.ts` — hija `patients` lazy dentro del shell (sin guard de rol).
- `core/layout/app-shell.html` — ítem «Pacientes» (`routerLink="/patients"`,
  icono `person`) visible para ambos roles; «Usuarios» sigue solo para `ADMIN`.

## Textos propios (español)

- Crear/editar: hints «Entre 1 y 150 caracteres.», «Formato 000-0000000-0 (11
  dígitos).» y «Hasta 50 caracteres. Obligatorio para estudiantes.»; errores
  «Ingresa el nombre», «El nombre no debe superar los 150 caracteres.»,
  «Ingresa la cédula», «La cédula debe tener 11 dígitos.», «Ingresa el carnet
  del estudiante» y «El carnet no debe superar los 50 caracteres.». Títulos
  «Nuevo paciente» / «Editar paciente»; botones «Cancelar», «Crear paciente»
  (con «Guardando…» durante el envío) y «Guardar cambios»; checkbox «Paciente
  activo»; precarga «Cargando paciente…».
- Confirmación: «Activar paciente» / «Desactivar paciente»; «¿Activar <nombre>
  (<cédula con máscara>)? Volverá a estar disponible en el sistema.» /
  «¿Desactivar <nombre> (<cédula con máscara>)? Dejará de estar disponible en
  el sistema. Esta acción no elimina sus datos.»; botones «Cancelar» y
  «Activar» / «Desactivar».
- 400 → «Los datos enviados no son válidos. Revisa el formulario.»
- 401 → «Tu sesión expiró. Inicia sesión de nuevo.»
- 403 → «No tienes permiso para gestionar pacientes.»
- 404 → «El paciente solicitado ya no existe. Actualiza la lista.»
- 409 cédula → «Ya existe un paciente con esa cédula.» (además error de campo
  `cedula`); 409 carnet → «Ya existe un paciente con ese carnet.» (además error
  de campo `carnet`); 409 genérico → «Ya existe un paciente con esos datos.
  Revisa la cédula y el carnet.»
- 422 → general «Revisa los datos ingresados.» + por campo «Revisa el nombre»,
  «Revisa la cédula», «Revisa el carnet» y «Revisa el tipo de paciente» (solo
  los campos conocidos; los desconocidos se ignoran).
- Red/0 → «No se pudo conectar con el servidor. Verifica tu conexión e
  inténtalo de nuevo.»; resto de estados → «Ocurrió un error inesperado.
  Inténtalo de nuevo en unos segundos.»
- Éxitos en toast (`role="status"`, 2000 ms): «Paciente creado.» / «Paciente
  actualizado.» / «Paciente activado.» / «Paciente desactivado.».
- Vacío inline: «No hay pacientes para mostrar.» (`role="status"`).
- Error de carga inline (`role="alert"`, región de la tabla): el mensaje de
  `mapPatientsError` (mismos textos que el resto del módulo) más el botón
  «Reintentar» (`mat-stroked-button`, `aria-label="Reintentar la carga de
pacientes"`, `disabled` durante la carga).

## Avisos toast y carga contenida

Los cuatro éxitos y los errores de **mutación** (activar/desactivar y el 404
real de edición) van a `PatientsToast`; `patients-error.ts` sigue siendo la
única fuente de textos y el toast solo los muestra. El **fallo de carga del
listado no se anuncia por toast**: se muestra inline en la región de la tabla
con reintento, así el mismo fallo no se anuncia dos veces.
`MatSnackBarModule` se importa una sola vez en el ámbito del catálogo
(`PatientList`). Posición `center`/`bottom`, sin robo de foco (solo anuncio por
el `LiveAnnouncer` interno), un solo contenedor. Los mensajes no incluyen
token, `detail`, `code`, stack ni URLs internas.

Carga contenida sin parpadeo (S12, patrón F-009/F-011): `loading` solo gobierna
la región de la tabla (`dm-patient-list__table-region` con `aria-busy`); header
(«Pacientes» + «Nuevo paciente»), filtros (buscador + estado) y paginador
permanecen montados durante `load()`: sin parpadeo del layout y sin pérdida de
foco en el buscador. Las filas visibles se conservan hasta que llega la página
nueva; ante error de carga se conservan las filas anteriores y el fallo se
muestra inline con reintento, no en toast. El overlay de carga es absoluto
(`pointer-events: none`), así no ocupa altura en flujo ni roba el puntero. Un
`GET` por gesto (búsqueda con 300 ms de espera, filtro, página, tamaño u
orden), con reset a la primera página cuando cambia el criterio.

Corrección heredada del falso 404 al cancelar (F-007): el listado solo recarga y
avisa cuando el diálogo cierra con `{ notFound: true }` —el 404 real del
`GET /{id}` en edición—; «Cancelar», Escape o backdrop (`undefined`/`""`/
`false`) no recargan, no avisan y no emiten ningún `GET`.

## Diseño y accesibilidad (S11)

- Solo tokens `--dm-*`: sin hex literales y sin `::ng-deep`; `@include
dm.dm-focus-ring` en el listado y tipografía con `dm-typescale`.
- Badges de estado con los chips AA del sistema (Activo 4.57:1 / Inactivo
  5.30:1); el error de carga usa el texto del sistema sobre el contenedor de
  error (nunca el color de error sobre su propio fondo).
- Tabla con `aria-label="Pacientes"`, cabeceras reales y botones con
  `aria-label` que incluye el nombre del paciente; buscador y filtros con
  `mat-label` visible y `aria-label` propio; `role="status"` en vacío y
  precarga; `role="alert"` en el error; scroll horizontal contenido en la
  tabla (`overflow-x: auto`) por debajo de 768px.
- La cédula con máscara usa `white-space: nowrap` y cifras tabulares para no
  partirse entre bloques.

## Notas para el reviewer

- Evidencia de implementación (2026-10-27): specs nuevas en
  `patients.models.spec.ts`, `patients.service.spec.ts`,
  `patients-error.spec.ts`, `patients-toast.spec.ts`,
  `patient-list/patient-list.spec.ts`, `patient-form/patient-form.spec.ts` y
  `patient-confirm/patient-confirm.spec.ts`; cubren S1-S12, la máscara
  (escritura, pegado de 11 dígitos, descarte de letras, bloqueo del envío), el
  carnet condicional, el mapeo de `409` a `cedula`/`carnet`, el `PUT` que borra
  el carnet, la desactivación idempotente y el DOM de solo lectura de `MEDICO`.
- Pendiente fuera del alcance del implementer (superficies no autorizadas, specs
  propiedad del reviewer): `app-shell.spec.ts` fija el número y el orden de los
  enlaces del menú (5 sin sesión / 5 `MEDICO` / 6 `ADMIN`) y necesita
  incorporar el ítem «Pacientes» (6/6/7); `app.spec.ts` fija
  `children.length === 6` y `users` en el índice 5 y necesita la hija
  `patients` (7 hijos, `users` en el índice 6). Ambas quedan sin tocar desde la
  implementación.
