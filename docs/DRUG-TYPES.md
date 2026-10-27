# Tipos de fármacos — Dispensario Médico Frontend

Gestión del catálogo de tipos de fármacos (`src/app/features/drug-types/`,
F-009): listado con tabla de Material, búsqueda/filtros/orden de servidor,
paginación de servidor obligatoria, crear/editar con diálogos y desactivación
lógica vía `DELETE`. Primer catálogo maestro de la épica E2 (RF-04, US-07):
accesible para `ADMIN` y `MEDICO`, con escritura solo para `ADMIN` (el médico
ve la tabla sin controles de escritura en el DOM). Sin datos reales: los
ejemplos usan valores sintéticos.

Este módulo **fija el patrón** que reutilizan marcas (F-010) y ubicaciones
(F-011). Por la **regla del tres** (PQ-01, Oscar Mora 2026-10-25) se replica
el patrón de users sin extraer nada a `shared/` (US-08): la extracción se
evalúa recién con tres casos reales implementados.

## Contrato aplicado (documentado en `DispensarioMedicoDocs`)

Base: `environment.apiUrl + '/v1/drug-types'` compuesta en un solo lugar
(`DrugTypesService`, mismo patrón que `AuthService`/`UsersService`). La
cabecera `Authorization: Bearer` la adjunta el `authInterceptor` de F-002; el
servicio no conoce almacenamiento ni el rol del usuario.

- `GET /v1/drug-types` — query params `page` (desde 1), `size` (1-100, por
  defecto 20), `search` (parcial sobre `description`, máx. 100 caracteres),
  `is_active` (`true`/`false`), `sort` (`description|created_at|is_active|id`,
  por defecto `description`, prefijo `-` para descendente); `200`
  `{items, total, page, size, pages}`. Sin paginación ni filtrado en cliente:
  ante fallo del backend se muestra el error inline con reintento, no una
  lista local.
- `POST /v1/drug-types` — body `{description, is_active}`; `201` con
  `{id, description, is_active, created_at}`; `409` si la `description` ya
  existe.
- `GET /v1/drug-types/{id}` — `200`; `404` si ya no existe.
- `PUT /v1/drug-types/{id}` — reemplazo completo (`description` +
  `is_active`); `200`, conservando `created_at`. Sin `PATCH`.
- `DELETE /v1/drug-types/{id}` — **desactivación lógica vía `is_active`, no
  borrado físico**; es el único `http.delete` del servicio.
- `page` del servidor es base 1; `mat-paginator` trabaja base 0 y el listado
  suma 1 al pedir (`pageIndex() + 1`).
- Mapeo `snake_case` ↔ `camelCase` y `trim` de `description` viven en
  `drug-types.models.ts` (`toDrugType()`, `toDrugTypeListPage()`,
  `toDrugTypePayload()`); sin `any`.

## Decisiones

- **Desactivación lógica (S4):** `DELETE /{id}` equivale a `is_active: false`.
  Nunca hay borrado físico ni método de borrado en el servicio; la
  confirmación lo dice explícitamente («Esta acción no elimina sus datos.»).
- **Reactivación con `PUT` de reemplazo completo:** `reactivate(drugType)`
  reenvía `description` + `is_active: true`, no un `PATCH` ni un body parcial.
  Es el mismo criterio R-04 de F-006: el `PUT` exige el reemplazo completo y
  un body parcial queda incompleto frente al contrato.
- **`created_at` lo gestiona el servidor:** viaja en la respuesta y en el
  modelo `DrugType.createdAt`, nunca en el body de escritura
  (`DrugTypePayloadDto` solo tiene `description` + `is_active`). Editar no lo
  envía; el `PUT` lo conserva.
- **`description` con `trim`:** el body se construye con
  `input.description.trim()`; el validador `requiredTrimmed` cuenta una cadena
  de solo espacios como vacía y `maxLength(100)` corre sobre el valor. El
  input declara `maxlength="100"` y un `mat-hint` con el rango.
- **`is_active` opcional al crear (D-5):** por defecto `true`; el checkbox
  «Tipo de fármaco activo» solo se renderiza en modo creación. En edición el
  estado se cambia con Activar/Desactivar del listado y el `PUT` reenvía el
  valor precargado (`loadedIsActive`), sin control en el diálogo.
- **Orden de servidor:** el contrato acepta `description|created_at|is_active|
id` con prefijo `-`; la UI expone `mat-sort` solo en la columna
  Descripción. Sin orden elegido, el listado no envía `sort` y aplica el valor
  por defecto del backend (`description`); cambiar de orden vuelve a la
  página 1.
- **Paginador:** opciones 10/20/50 (máx. 100 por RNF-06), por defecto 20.
  Cambiar el tamaño vuelve a la página 0 (base 1 en el `GET`); el total
  mostrado es el `total` del servidor.
- **Estados vacío/carga/error:** la tabla y el paginador solo se montan con
  filas (`items().length > 0`); el vacío «No hay tipos de fármacos para
  mostrar.» aparece solo cuando terminó la carga sin filas y sin error. El
  error de carga se muestra inline dentro de la región de la tabla
  (`role="alert"`) con el mensaje de `mapDrugTypesError` y un botón
  «Reintentar»; el reintento republica el `GET` con los criterios vigentes
  (página, tamaño, búsqueda, estado y orden actuales) sin volver a la página
  1. Con filas previas el error convive con la tabla conservada, y el botón
     queda `disabled` mientras `loading()` es `true`.

## Permisos (S7, PQ-02)

- `ADMIN`: CRUD completo. Ve «Nuevo tipo de fármaco», la columna Acciones
  (Editar, Desactivar/Activar) y el checkbox de estado al crear.
- `MEDICO`: solo lectura. Con `role === 'MEDICO'` **no existe ningún control
  de escritura en el DOM** (no es ocultar ni deshabilitar): `displayedColumns`
  se reduce a `['description', 'status']` y el botón Nuevo no se renderiza.
- Ruta `/drug-types` sin guard de rol (hija lazy del shell con `authGuard` del
  padre): accesible para ambos roles autenticados.
- `403` como red de seguridad del backend: el frontend lo traduce a «No tienes
  permiso para gestionar tipos de fármacos.» y nunca muestra el mensaje crudo.

## Dónde vive cada cosa

- `drug-types.models.ts` — `DrugType`, DTOs `snake_case`
  (`DrugTypeDto`/`DrugTypeListResponseDto`/`DrugTypePayloadDto`),
  `DrugTypeListParams`, `DrugTypeFormInput`, `toDrugType()`,
  `toDrugTypeListPage()`, `toDrugTypePayload()`. Único punto de mapeo; sin
  `any`.
- `drug-types.service.ts` — `list()` (`GET` con `page`/`size`/`search`/
  `is_active`/`sort`), `getById()`, `create()` (`POST` → `201`), `update()`
  (`PUT` → `200`), `deactivate()` (`DELETE`), `reactivate(drugType)` (`PUT` de
  reemplazo completo con `is_active: true`).
- `drug-types-error.ts` — `mapDrugTypesError()` (400/401/403/404/409/422/
  status 0/resto); en `422` lee `errors[].field` en `snake_case` y solo conoce
  `description`. Nunca expone `detail`/`code`/`message` del backend.
- `drug-types-toast.ts` — `DrugTypesToast` (`providedIn: 'root'`, único punto
  de toast y único hogar de los literales de éxito) con `showCreated()`,
  `showUpdated()`, `showActivated()` y `showDeactivated()` (`politeness:
'polite'` → `role="status"`, 2000 ms, sin acción) más los genéricos
  `showSuccess()` y `showError()` (`politeness: 'assertive'` →
  `role="alert"`, 5000 ms, acción «Cerrar»); posición `center`/`bottom`.
- `drug-type-list/` — `dm-drug-type-list`: tabla (Descripción, Estado con
  badge, Acciones), buscador (`debounceTime(300)` + `distinctUntilChanged`),
  filtro Todos/Activos/Inactivos, `mat-sort` y `mat-paginator` de servidor,
  botón Nuevo, error de carga con reintento, diálogos y toasts. Delega todo el
  HTTP en el servicio.
- `drug-type-form/` — `dm-drug-type-form` (`MatDialog`): crear (`POST` →
  `201`, con checkbox de estado) y editar (`PUT` de reemplazo completo →
  `200`, precargado con `GET /{id}`, sin control de estado); validador
  `server` para 409/422 como en login/users; Enter envía una vez, Escape
  cierra sin guardar.
- `drug-type-confirm/` — `dm-drug-type-confirm`: confirmación dedicada,
  botón destructivo (`color="warn"`) solo al desactivar; devuelve `true` al
  confirmar y `undefined` al cancelar/Escape/backdrop.
- `app.routes.ts` — hija `drug-types` lazy dentro del shell (sin guard de
  rol); `/users` sigue con `adminGuard`.
- `core/layout/app-shell.*` — ítem «Tipos de fármacos» (`routerLink=
"/drug-types"`, icono `medication`) visible para ambos roles; «Usuarios»
  sigue solo para `ADMIN`.

## Textos propios (español)

- Crear/editar: hint «Entre 1 y 100 caracteres.»; validadores `required`
  recortado y `maxlength` con `mat-error` («Ingresa la descripción», «La
  descripción no debe superar los 100 caracteres.»). Títulos «Nuevo tipo de
  fármaco» / «Editar tipo de fármaco»; botones «Cancelar», «Crear tipo de
  fármaco» (con «Guardando…» durante el envío) y «Guardar cambios»; checkbox
  «Tipo de fármaco activo»; precarga «Cargando tipo de fármaco…».
- Confirmación: «Activar tipo de fármaco» / «Desactivar tipo de fármaco»;
  «¿Activar <descripción>? Volverá a estar disponible para las recetas.» /
  «¿Desactivar <descripción>? Dejará de estar disponible para las recetas.
  Esta acción no elimina sus datos.»; botones «Cancelar» y «Activar» /
  «Desactivar».
- 400 → «Los datos enviados no son válidos. Revisa el formulario.»
- 401 → «Tu sesión expiró. Inicia sesión de nuevo.»
- 403 → «No tienes permiso para gestionar tipos de fármacos.»
- 404 → «El tipo de fármaco solicitado ya no existe. Actualiza la lista.»
- 409 → «Ya existe un tipo de fármaco con esa descripción.» (marcado además
  como error de campo de `description`, con el diálogo abierto).
- 422 → general «Revisa los datos ingresados.» + por campo «Revisa la
  descripción» (solo el campo conocido; los desconocidos se ignoran).
- Red/0 → «No se pudo conectar con el servidor. Verifica tu conexión e
  inténtalo de nuevo.»; resto de estados → «Ocurrió un error inesperado.
  Inténtalo de nuevo en unos segundos.»
- Éxitos en toast (`role="status"`, 2000 ms): «Tipo de fármaco creado.» /
  «Tipo de fármaco actualizado.» / «Tipo de fármaco activado.» / «Tipo de
  fármaco desactivado.».
- Vacío inline: «No hay tipos de fármacos para mostrar.» (`role="status"`).
- Error de carga inline (`role="alert"`, región de la tabla): el mensaje de
  `mapDrugTypesError` (mismos textos que el resto del módulo) más el botón
  «Reintentar» (`mat-stroked-button`, `aria-label="Reintentar la carga de
tipos de fármacos"`, `disabled` durante la carga).

## Avisos toast y carga contenida

Los cuatro éxitos y los errores de **mutación** (activar/desactivar y el 404
real de edición) van a `DrugTypesToast`; `drug-types-error.ts` sigue siendo la
única fuente de textos y el toast solo los muestra. El **fallo de carga del
listado ya no se anuncia por toast**: se muestra inline en la región de la
tabla con reintento (CA-06), así el mismo fallo no se anuncia dos veces. Los
toasts quedan para las mutaciones.
`MatSnackBarModule` se importa una sola vez en el ámbito del catálogo
(`DrugTypeList`). Posición `center`/`bottom`, sin robo de foco (solo anuncio
por el `LiveAnnouncer` interno), un solo contenedor (cada toast reemplaza al
anterior). Sin datos reales: los mensajes no incluyen token, `detail`, `code`,
stack ni URLs internas.

Carga contenida sin parpadeo (S10, patrón F-007/F-008): `loading` solo
gobierna la región de la tabla (`dm-drug-type-list__table-region` con
`aria-busy`); header («Tipos de fármacos» + «Nuevo tipo de fármaco»), filtros
(buscador + estado) y paginador permanecen montados durante `load()`: sin
parpadeo del layout y sin pérdida de foco en el buscador. Las filas visibles
se conservan hasta que llega la página nueva; ante error de carga se conservan
las filas anteriores y el fallo se muestra inline con reintento
(`mapDrugTypesError` + botón «Reintentar»), no en toast. El reintento conserva
los criterios vigentes (página, tamaño, búsqueda, estado y orden) y no resetea
a la página 1. Un `GET` por gesto (búsqueda con 300 ms de espera, filtro,
página, tamaño u orden), con
reset a la primera página cuando cambia el criterio. Es el patrón F-008
(overlay absoluto sin altura en flujo) aplicado a la región, así el `main` del
shell no cambia de altura al buscar/filtrar/paginar/ordenar; las specs cubren
`aria-busy` solo en la región y el foco conservado en el buscador, no una
medición de posición del footer.

Corrección heredada del falso 404 al cancelar (F-007): el listado solo recarga
y avisa cuando el diálogo cierra con `{ notFound: true }` —el 404 real del
`GET /{id}` en edición—; «Cancelar», Escape o backdrop (`undefined`/`""`/
`false`) no recargan, no avisan y no emiten ningún `GET`.

## Notas para el reviewer

- Evidencia de T5 (reviewer, 2026-10-27): 19 test files / **312 tests PASS**;
  `npm run lint` PASS; `npm run build` PASS (lazy chunk `drug-type-list`);
  `npm run features:validate` PASS (9 features); Prettier OK en todos los
  archivos tocados. **PASS por spec: S1, S2, S3, S4, S5, S6, S7, S8, S9,
  S10. Sin defectos de producción.** El único test rojo fue una suposición
  errónea de jsdom sobre `keyCode` en Escape, corregida en la spec.
- Producción (commits `19b72a6` y `576dfc1`): `drug-types.models.ts`,
  `drug-types.service.ts`, `drug-types-error.ts`, `drug-types-toast.ts`,
  `drug-type-list/`, `drug-type-form/`, `drug-type-confirm/`, la ruta lazy
  `/drug-types` y el ítem de menú del shell.
- Specs (T5, pendientes de commit al cierre de la feature):
  `drug-types.service.spec.ts`, `drug-types-error.spec.ts`,
  `drug-types-toast.spec.ts`, `drug-type-list.spec.ts`,
  `drug-type-form.spec.ts`, `drug-type-confirm.spec.ts`, más
  `src/app/app.spec.ts` y `src/app/core/layout/app-shell.spec.ts`
  actualizados.
- El implementer no creó ni editó ningún `*.spec.ts`.
- F-010 (marcas) y F-011 (ubicaciones) deben reutilizar este patrón: mismo
  servicio con todo el HTTP, mismo `*-error.ts` como única fuente de textos,
  mismo `*-toast.ts`, misma carga contenida con `aria-busy` en la región y
  mismos permisos (ADMIN escritura, MEDICO lectura sin controles en el DOM).
  La extracción a `shared/` sigue sujeta a la regla del tres (PQ-01).
