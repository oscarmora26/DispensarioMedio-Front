# Médicos — Dispensario Médico Frontend

Gestión del catálogo de médicos (`src/app/features/doctors/`, F-014): listado
con tabla de Material, búsqueda/filtros/orden de servidor, paginación de
servidor obligatoria, crear/editar con diálogos, cédula con máscara
`XXX-XXXXXXX-X`, tanda en select cerrado y desactivación lógica vía `DELETE`.
Módulo **solo para `ADMIN`**: la ruta `/doctors` usa `adminGuard` y el ítem
«Médicos» del menú solo existe para ese rol. Sin datos reales: los ejemplos
usan valores sintéticos. Fuera de alcance: visitas, consultas y el perfil
propio del rol `MEDICO`.

Reutiliza el patrón de catálogo fijado por F-009 (`docs/DRUG-TYPES.md`) y
continuado por F-010…F-013: servicio con todo el HTTP, `*-error.ts` como única
fuente de textos, `*-toast.ts` para las mutaciones, carga contenida con
`aria-busy` en la región y permisos. Por la **regla del tres** (PQ-01) no se
extrajo nada a `shared/`; los helpers de la máscara de cédula son la única
pieza compartida y se **reexportan** desde `patients.models.ts` (ver abajo).

## Contrato aplicado (OpenAPI vivo, verificado 2026-10-27)

Base: `environment.apiUrl + '/v1/doctors'` compuesta en un solo lugar
(`DoctorsService`). La cabecera `Authorization: Bearer` la adjunta el
`authInterceptor` de F-002; el servicio no conoce almacenamiento ni el rol.

- `GET /v1/doctors` — query params `page` (desde 1), `size` (1-100, por defecto
  20), `search` (≤100, parcial y case-insensitive sobre `name` o `cedula`),
  `is_active` (`true`/`false`) y `sort`
  (`name|cedula|lab_shift|specialty|created_at|is_active|id`, por defecto
  `name`, prefijo `-` para descendente); `200` `{items, total, page, size,
pages}`. Sin paginación ni filtrado en cliente.
- `DoctorRead` — **seis campos planos**: `id`, `name`, `cedula`, `lab_shift`,
  `specialty`, `is_active`, más `user` (`DoctorUserRead { id, username,
is_active } | null`), la cuenta asociada en solo lectura. **No devuelve
  `created_at`** aunque lo acepte como criterio de orden: por eso la tabla no
  expone esa columna y el modelo `Doctor` no la declara. `user` no está en
  `required`, así que se mapea defensivamente con `dto.user ?? null`.
- `POST /v1/doctors` — body `{name, cedula, lab_shift, specialty, is_active}`
  (`is_active` opcional, def. `true`); `name` 1..150, `cedula` 11 dígitos única,
  `lab_shift` 1..50, `specialty` 1..100; `201`; `409` si la cédula ya existe;
  `422` de validación. Solo `ADMIN`.
- `GET /v1/doctors/{id}` — `200` (también si el médico está inactivo) o `404`.
- `PUT /v1/doctors/{id}` — **reemplazo completo** de `name` + `cedula` +
  `lab_shift` + `specialty` + `is_active`; **no toca la asociación con
  usuarios**; `200`; `409`; `404`; `422`.
- `DELETE /v1/doctors/{id}` — desactivación lógica e **idempotente** (no borra
  la fila ni sus referencias); `204`; `404`; **`409 doctor_has_visits`** si el
  médico tiene visitas registradas.
- `page` del servidor es base 1; `mat-paginator` trabaja base 0 y el listado
  suma 1 al pedir (`pageIndex() + 1`).
- Mapeo `snake_case` ↔ `camelCase`, `trim` del nombre/tanda/especialidad y
  descarte de la máscara de la cédula viven en `doctors.models.ts`
  (`toDoctor()`, `toDoctorListPage()`, `toDoctorPayload()`); sin `any`.

## Decisiones

- **Cédula con máscara (S3):** se captura y se muestra como `XXX-XXXXXXX-X`
  (bloques 3-7-1), la **misma regla de F-013 CA-03**. El control del formulario
  guarda el texto con máscara y `formatCedula()` la aplica al escribir o pegar
  (descarta todo lo que no sea dígito, recorta a 11, deja el cursor tras el
  último dígito). La validación exige exactamente 11 dígitos tras descartar
  separadores (`isCedulaComplete()`), el body envía los 11 dígitos sin máscara
  (`toDoctorPayload()` → `cedulaDigits()`) y un valor incompleto bloquea el
  envío con mensaje propio. No se valida dígito verificador (decisión humana
  L2 de F-013).
- **Una sola copia de la máscara:** `doctors.models.ts` **importa y reexporta**
  `CEDULA_DIGITS`, `cedulaDigits()`, `formatCedula()` e `isCedulaComplete()`
  desde `patients.models.ts` en lugar de duplicarlos. Dos copias de la misma
  regla del contrato se desincronizarían; el código de médicos importa siempre
  desde `doctors.models.ts`, así que cambiar de hogar la regla toca un archivo.
- **Tanda cerrada (S4):** `lab_shift` es texto ≤50 en el contrato, pero la UI
  ofrece un `mat-select` cerrado con cuatro opciones —Matutina, Vespertina,
  Nocturna, Mixta— que envía `MATUTINA|VESPERTINA|NOCTURNA|MIXTA`
  (`LAB_SHIFTS`/`LAB_SHIFT_LABELS`). `Doctor.labShift` se declara `string` (no
  `LabShift`) y `labShiftOptions(stored)` agrega el valor almacenado como
  opción extra cuando no es canónico, para no perderlo al guardar; la tabla lo
  muestra con `labShiftLabel()` (capitalizado si es canónico, crudo si no).
- **Especialidad (S5):** texto libre, 1..100 caracteres, recortado; obligatorio
  con mensaje propio y `maxlength` en el control.
- **Asociación usuario-médico (S6):** se **lee** de `DoctorRead.user` y se
  muestra en la columna «Usuario» (`user.username` o «Sin usuario»). Es de solo
  lectura: el formulario no la renderiza, `toDoctorPayload()` nunca incluye
  `user` y `reactivate()` tampoco, así que ningún `POST`/`PUT` intenta
  modificarla. La asignación vive en el módulo de Usuarios (F-006,
  `UserCreate.doctor_id` / `UserUpdate.doctor_id`); un médico sin cuenta es
  válido.
- **`PUT` de reemplazo completo (S7):** editar envía `name` + `cedula` +
  `lab_shift` + `specialty` + `is_active`. Reactivar reenvía el registro visible
  con `is_active: true`, conservando tanda y especialidad: un `PUT` parcial
  responde `422`.
- **`DELETE` = desactivación lógica e idempotente (S8):** nunca hay borrado
  físico ni método de borrado en el servicio; repetir la llamada también
  responde `204`. La confirmación lo dice explícitamente («Esta acción no
  elimina sus datos.»). El `409 doctor_has_visits` no recarga la lista (no hubo
  cambio) y se anuncia en toast con
  «No se puede desactivar el médico porque tiene visitas registradas.».
- **`is_active` opcional al crear:** por defecto `true`; el checkbox «Médico
  activo» solo se renderiza en creación. En edición el estado se cambia con
  Activar/Desactivar del listado y el `PUT` reenvía el valor precargado
  (`loadedIsActive`), sin control en el diálogo.
- **Orden de servidor (S1):** el contrato acepta
  `name|cedula|lab_shift|specialty|created_at|is_active|id` con prefijo `-`. La
  UI expone `mat-sort` en Nombre, Cédula, Tanda, Especialidad y Estado (el
  `mat-sort-header` de Estado usa el id `is_active`, que es el nombre del
  criterio en la API). `created_at` e `id` no se muestran porque el read model
  no los trae. Sin orden elegido, el listado no envía `sort` y aplica el valor
  por defecto del backend (`name`); cambiar de orden vuelve a la página 1.
- **Paginador:** opciones 10/20/50 (máx. 100 por RNF-06), por defecto 20.
  Cambiar el tamaño vuelve a la página 0 (base 1 en el `GET`); el total
  mostrado es el `total` del servidor.
- **Estados vacío/carga/error (S13):** la tabla y el paginador solo se montan
  con filas (`items().length > 0`); el vacío «No hay médicos para mostrar.»
  aparece solo cuando terminó la carga sin filas y sin error. El error de carga
  se muestra inline dentro de la región de la tabla (`role="alert"`) con el
  mensaje de `mapDoctorsError` y un botón «Reintentar»; el reintento republica
  el `GET` con los criterios vigentes (página, tamaño, búsqueda, estado y orden)
  sin volver a la página 1 y queda `disabled` mientras `loading()` es `true`.
- **Presentación:** la cédula se muestra con máscara aunque el servidor la
  devuelva plana, la tanda con su etiqueta capitalizada y la cuenta asociada en
  tipografía monoespaciada (`dm-mono`) para distinguirla del nombre.

## Permisos (S11)

- `ADMIN`: CRUD completo. Ve «Nuevo médico», la columna Acciones (Editar,
  Desactivar/Activar) y el checkbox de estado al crear.
- Cualquier otro rol (`MEDICO`): aunque la ruta ya exige `adminGuard`, el
  componente es defensivo — **no existe ningún control de escritura en el DOM**
  (no es ocultar ni deshabilitar): `displayedColumns` se reduce a
  `['name', 'cedula', 'shift', 'specialty', 'user', 'status']` y el botón Nuevo
  no se renderiza. La tabla, el buscador y el paginador siguen disponibles.
- Ruta `/doctors`: hija lazy del shell con `canActivate: [adminGuard]` (el
  padre ya aplica `authGuard`), igual que Usuarios. Ítem «Médicos» del menú
  (`routerLink="/doctors"`, icono `medical_services`) visible solo para `ADMIN`,
  inmediatamente antes de «Usuarios».
- `403` como red de seguridad del backend: el frontend lo traduce a «No tienes
  permiso para gestionar médicos.» y nunca muestra el mensaje crudo.

## Dónde vive cada cosa

- `doctors.models.ts` — `Doctor`, `DoctorUser`, `LabShift`, `LAB_SHIFTS`,
  `LAB_SHIFT_LABELS`, límites (`NAME_MAX_LENGTH`, `SPECIALTY_MAX_LENGTH`,
  `LAB_SHIFT_MAX_LENGTH`, `SEARCH_MAX_LENGTH`, `CEDULA_DIGITS`), DTOs
  `snake_case` (`DoctorDto` con `user?: DoctorUserDto | null`,
  `DoctorListResponseDto`, `DoctorPayloadDto`), `DoctorListParams`,
  `DoctorFormInput`, `toDoctor()`, `toDoctorListPage()`, `toDoctorPayload()`,
  `labShiftLabel()`, `labShiftOptions()` y la reexportación de los helpers de
  máscara. Único punto de mapeo; sin `any`.
- `doctors.service.ts` — `list()` (`GET` con `page`/`size`/`search`/
  `is_active`/`sort`), `getById()`, `create()` (`POST` → `201`), `update()`
  (`PUT` → `200`), `deactivate()` (`DELETE` idempotente),
  `reactivate(doctor)` (`PUT` de reemplazo completo con `is_active: true`).
- `doctors-error.ts` — `mapDoctorsError()` (400/401/403/404/409/422/status
  0/resto). En `409` usa el `code` estable del envelope
  (`doctor_has_visits` → bloqueo por visitas; `doctor_exists` /
  `doctor_cedula_exists` → campo `cedula`, con `errors[].field` como respaldo)
  porque ese estado no rellena `errors[]`; en `422` lee `errors[].field` en
  `snake_case` y conoce `name`, `cedula`, `lab_shift` y `specialty`. Nunca
  expone `detail`, `code` ni `message`.
- `doctors-toast.ts` — `DoctorsToast` (`providedIn: 'root'`, único punto de
  toast y único hogar de los literales de éxito) con `showCreated()`,
  `showUpdated()`, `showActivated()` y `showDeactivated()` (`politeness:
'polite'` → `role="status"`, 2000 ms, sin acción) más los genéricos
  `showSuccess()` y `showError()` (`politeness: 'assertive'` →
  `role="alert"`, 5000 ms, acción «Cerrar»); posición `center`/`bottom`.
- `doctor-list/` — `dm-doctor-list`: tabla (Nombre, Cédula con máscara, Tanda,
  Especialidad, Usuario de solo lectura, Estado con badge, Acciones), buscador
  (`debounceTime(300)` + `distinctUntilChanged`), filtro Todos/Activos/
  Inactivos, `mat-sort` de servidor, `mat-paginator`, botón Nuevo, error de
  carga con reintento, diálogos y toasts. Delega todo el HTTP en el servicio.
- `doctor-form/` — `dm-doctor-form` (`MatDialog`): crear (`POST` → `201`, con
  checkbox de estado) y editar (`PUT` de reemplazo completo → `200`, precargado
  con `GET /{id}`, sin control de estado); máscara de cédula, select cerrado de
  tanda con el valor no canónico preservado y validador `server` para 409/422;
  Enter envía una vez, Escape cierra sin guardar.
- `doctor-confirm/` — `dm-doctor-confirm`: confirmación dedicada, botón
  destructivo (`color="warn"`) solo al desactivar; devuelve `true` al confirmar
  y `undefined` al cancelar/Escape/backdrop.
- `app.routes.ts` — hija `doctors` lazy dentro del shell con `adminGuard`
  (índice 6, justo antes de `users`).
- `core/layout/app-shell.html` — ítem «Médicos» (`routerLink="/doctors"`,
  icono `medical_services`) visible solo para `ADMIN`, antes de «Usuarios».

## Textos propios (español)

- Crear/editar: hints «Entre 1 y 150 caracteres.», «Formato 000-0000000-0 (11
  dígitos).», «Matutina, Vespertina, Nocturna o Mixta.» y «Entre 1 y 100
  caracteres.»; errores «Ingresa el nombre», «El nombre no debe superar los 150
  caracteres.», «Ingresa la cédula», «La cédula debe tener 11 dígitos.»,
  «Selecciona la tanda», «Ingresa la especialidad» y «La especialidad no debe
  superar los 100 caracteres.». Títulos «Nuevo médico» / «Editar médico»;
  botones «Cancelar», «Crear médico» (con «Guardando…» durante el envío) y
  «Guardar cambios»; checkbox «Médico activo»; precarga «Cargando médico…»;
  nota de edición «La cuenta asociada se gestiona en Usuarios; este formulario
  no la modifica.».
- Confirmación: «Activar médico» / «Desactivar médico»; «¿Activar <nombre>
  (<cédula con máscara>)? Volverá a estar disponible en el sistema.» /
  «¿Desactivar <nombre> (<cédula con máscara>)? Dejará de estar disponible en
  el sistema. Esta acción no elimina sus datos.»; botones «Cancelar» y
  «Activar» / «Desactivar».
- 400 → «Los datos enviados no son válidos. Revisa el formulario.»
- 401 → «Tu sesión expiró. Inicia sesión de nuevo.»
- 403 → «No tienes permiso para gestionar médicos.»
- 404 → «El médico solicitado ya no existe. Actualiza la lista.»
- 409 cédula → «Ya existe un médico con esa cédula.» (además error de campo
  `cedula`); 409 visitas → «No se puede desactivar el médico porque tiene
  visitas registradas.»; 409 genérico → «Ya existe un médico con esos datos.
  Revisa la cédula.»
- 422 → general «Revisa los datos ingresados.» + por campo «Revisa el nombre»,
  «Revisa la cédula», «Revisa la tanda» y «Revisa la especialidad» (solo los
  campos conocidos; los desconocidos se ignoran).
- Red/0 → «No se pudo conectar con el servidor. Verifica tu conexión e
  inténtalo de nuevo.»; resto de estados → «Ocurrió un error inesperado.
  Inténtalo de nuevo en unos segundos.»
- Éxitos en toast (`role="status"`, 2000 ms): «Médico creado.» / «Médico
  actualizado.» / «Médico activado.» / «Médico desactivado.».
- Vacío inline: «No hay médicos para mostrar.» (`role="status"`).
- Error de carga inline (`role="alert"`, región de la tabla): el mensaje de
  `mapDoctorsError` (mismos textos que el resto del módulo) más el botón
  «Reintentar» (`mat-stroked-button`, `aria-label="Reintentar la carga de
médicos"`, `disabled` durante la carga).

## Avisos toast y carga contenida

Los cuatro éxitos y los errores de **mutación** (activar/desactivar, incluido
el `409 doctor_has_visits`, y el 404 real de edición) van a `DoctorsToast`;
`doctors-error.ts` sigue siendo la única fuente de textos y el toast solo los
muestra. El **fallo de carga del listado no se anuncia por toast**: se muestra
inline en la región de la tabla con reintento, así el mismo fallo no se anuncia
dos veces. `MatSnackBarModule` se importa una sola vez en el ámbito del catálogo
(`DoctorList`). Posición `center`/`bottom`, sin robo de foco (solo anuncio por
el `LiveAnnouncer` interno), un solo contenedor. Los mensajes no incluyen
token, `detail`, `code`, stack ni URLs internas.

Carga contenida sin parpadeo (S13, patrón F-009/F-011): `loading` solo gobierna
la región de la tabla (`dm-doctor-list__table-region` con `aria-busy`); header
(«Médicos» + «Nuevo médico»), filtros (buscador + estado) y paginador
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

## Diseño y accesibilidad (S12)

- Solo tokens `--dm-*`: sin hex literales y sin `::ng-deep`; `@include
dm.dm-focus-ring` en el listado y tipografía con `dm-typescale`.
- Badges de estado con los chips AA del sistema (Activo 4.57:1 / Inactivo
  5.30:1); el error de carga usa el texto del sistema sobre el contenedor de
  error (nunca el color de error sobre su propio fondo).
- Tabla con `aria-label="Médicos"`, cabeceras reales y botones con `aria-label`
  que incluye el nombre del médico; buscador y filtros con `mat-label` visible y
  `aria-label` propio; `role="status"` en vacío y precarga; `role="alert"` en el
  error; scroll horizontal contenido en la tabla (`overflow-x: auto`) por
  debajo de 768px.
- La cédula con máscara usa `white-space: nowrap` y cifras tabulares para no
  partirse entre bloques; la columna «Usuario» no se parte y usa `dm-mono` para
  distinguir la cuenta del nombre.

## Notas para el reviewer

- Evidencia de implementación (2026-10-27): specs en `doctors.models.spec.ts`,
  `doctors.service.spec.ts`, `doctors-error.spec.ts`, `doctors-toast.spec.ts`,
  `doctor-list/doctor-list.spec.ts`, `doctor-form/doctor-form.spec.ts` y
  `doctor-confirm/doctor-confirm.spec.ts`; cubren S1-S13, la máscara
  (escritura, pegado de 11 dígitos, descarte de letras, bloqueo del envío), el
  select cerrado de tanda con el valor no canónico preservado, la columna
  «Usuario» de solo lectura con «Sin usuario», el `409 doctor_has_visits` con
  su mensaje propio sin recargar, el mapeo de `409` de cédula al campo `cedula`,
  el `PUT` que no envía `user` y el DOM de solo lectura para roles distintos de
  `ADMIN`.
- Las specs estructurales quedan actualizadas: `app.spec.ts` fija ahora 8 hijas
  del shell y `doctors` en el índice 6 con `canActivate === [adminGuard]`
  (`users` pasa al índice 7); `app-shell.spec.ts` fija 8 enlaces para `ADMIN`
  con `/doctors` justo antes de `/users` y mantiene 6 para sesión anónima y
  `MEDICO` (el ítem «Médicos» es solo `ADMIN`).
- Códigos `409` asumidos por simetría con F-013 (`doctor_exists`) porque el
  OpenAPI no los publica; `doctor_has_visits` sí está verificado. El mapeo cae
  al mensaje general si el backend usa otro `code`, sin inventar campo.
