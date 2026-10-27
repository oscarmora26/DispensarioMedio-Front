# Ubicaciones — Dispensario Médico Frontend

Gestión del catálogo de ubicaciones (`src/app/features/locations/`, F-011):
listado con tabla de Material, búsqueda/filtros/orden de servidor, paginación
de servidor obligatoria, crear/editar con diálogos y activación/desactivación
con confirmación. Catálogo maestro de la épica E2 (RF-06, US-17): accesible
para `ADMIN` y `MEDICO`, con escritura solo para `ADMIN` (el médico ve la tabla
sin controles de escritura en el DOM). Sin datos reales: los ejemplos usan
valores sintéticos.

> **Realineación (2026-10-27).** El backend vivo **no** tiene
> `/api/v1/locations` (responde `404`). El catálogo real es
> **`/api/v1/shelves`** (estantes) con celdas anidadas. Este módulo se remapeó
> a ese contrato: cada fila del listado es un **estante** y sus **celdas** se
> muestran juntas. `medications.location_id` tiene FK
> `fk_medications_location_id_cells` → `cells.id`, así que la «ubicación» que
> referencia un medicamento es una **celda**, no un estante.
>
> **Segunda realineación (2026-10-27): celdas con CRUD propio.** El backend ya
> no acepta `cells` en los bodies del estante (`ShelfCreate`/`ShelfUpdate` son
> `additionalProperties: false` y `cells` responde `422`) y expone
> **`/api/v1/cells`** con CRUD completo. El diálogo guarda el estante con
> `POST`/`PUT /v1/shelves` y **reconcilia** sus celdas por `/v1/cells`
> (`POST` de las nuevas, `PUT` de las existentes, `DELETE` de las quitadas).
> `ShelfRead` sigue anidando `cells`, así que el listado no cambió.

Este módulo fija el patrón de catálogo que replican marcas y tipos de fármacos.
Por la **regla del tres** (PQ-01, Oscar Mora 2026-10-25) todavía no se extrae
nada a `shared/` (US-08).

## Contrato aplicado (`/api/v1/shelves` + `/api/v1/cells`, OpenAPI vivo)

Bases: `environment.apiUrl + '/v1/shelves'` y `.../v1/cells`, compuestas en un
solo lugar (`LocationsService`, mismo patrón que
`AuthService`/`UsersService`). La cabecera `Authorization: Bearer` la adjunta
el `authInterceptor` de F-002; el servicio no conoce almacenamiento ni el rol
del usuario.

### Estantes

- `GET /v1/shelves` — query params `page` (≥1, def. 1), `size` (1-100, def.
  20), `search` (parcial, máx. 100 caracteres), `is_active` (`true`/`false`),
  `sort` (`name|created_at|is_active|id`, por defecto `name`; prefijo `-` para
  descendente); `200` `{items, total, page, size, pages}`. Sin paginación ni
  filtrado en cliente: ante fallo del backend se muestra el error inline con
  reintento, no una lista local.
- `ShelfRead` = `{id, name, description|null, is_active, created_at,
updated_at, cells: CellRead[]}`. `cells` viaja pero **no** está en
  `required`: se mapea defensivamente (`dto.cells ?? []`).
- `CellRead` = `{id, shelf_id, section, cell, description|null, is_active,
created_at, updated_at}`.
- `POST /v1/shelves` — body `ShelfCreate` = `{name (2..100, requerido),
description (≤200)|null, is_active (def. true)}`; `additionalProperties:
false` (mandar `cells` responde `422`); `201`. Las celdas se crean después
  por `/v1/cells`.
- `GET /v1/shelves/{id}` — `200`; `404` si ya no existe.
- `PUT /v1/shelves/{id}` — body `ShelfUpdate` = `{name, description|null,
is_active}` (todo requerido, sin `cells`) y `additionalProperties: false`;
  `200`. Reemplazo completo del estante que **no toca sus celdas**.
- `DELETE /v1/shelves/{id}` — `204` sin cuerpo, desactivación lógica.
- `page` del servidor es base 1; `mat-paginator` trabaja base 0 y el listado
  suma 1 al pedir (`pageIndex() + 1`).

### Celdas

- `GET /v1/cells` — `page`, `size` (1-100, def. 20), `search` (sobre
  `section`, `cell` y `description`), `is_active`, `shelf_id` y
  `sort` (`section|cell|shelf_id|created_at|is_active|id`, def. `id`). El
  módulo **no** lo consume: las celdas del estante llegan anidadas en
  `ShelfRead`.
- `POST /v1/cells` — body `CellCreate` = `{section (1..50, requerido), cell
(1..50, requerido), description (≤200)|null, shelf_id (≥1, requerido),
is_active (def. true)}`; `additionalProperties: false`; `201`; `409` si la
  posición `(shelf_id, section, cell)` ya existe (sin distinguir mayúsculas).
- `GET /v1/cells/{id}` — `200`.
- `PUT /v1/cells/{id}` — body `CellUpdate` = `{section, cell, description|null,
shelf_id, is_active}` (todo requerido); `200`; `409` si la posición choca con
  otra celda del estante. `shelf_id` permite además **mover** la celda de
  estante.
- `DELETE /v1/cells/{id}` — `204`; **`409` cuando la celda tiene medicamentos
  asociados**.
- Mapeo `snake_case` ↔ `camelCase`, `trim` y normalización a `null` viven en
  `locations.models.ts` (`toShelf()`, `toShelfCell()`, `toShelfListPage()`,
  `toShelfPayload()`, `toCellPayload()`, `toCellOption()`, `formatCells()`);
  sin `any`.

### API pública para el resto de la app (contrato fijo)

`locations.models.ts` exporta `CellOption` y `LocationsService` expone
`listAllCells(): Observable<CellOption[]>` para los catálogos que referencian
`cells.id` (medicamentos):

```ts
export interface CellOption {
  id: number;
  label: string;
}
```

- `label` = `` `${shelf.name} · ${cell.section} / ${cell.cell}` `` (por
  ejemplo `Estante A · tramo 1 / celda 3`).
- Solo se incluyen celdas con `cell.isActive === true` de estantes con
  `shelf.isActive === true`.
- No trunca en silencio: pide `size: 100` y, mientras `page.page <
page.pages`, sigue trayendo páginas (`expand` + `reduce`) antes de aplanar.
- `list()`, `getById()`, `create()`, `update()`, `deactivate()` y
  `reactivate()` conservan sus nombres, ahora tipados sobre estantes.
- Sigue aplanando `GET /v1/shelves` (no `GET /v1/cells`) a propósito: mantiene
  el contrato que consume F-012 sin tocar ese módulo.

## Decisiones

- **Celdas dentro del estante (no catálogo plano):** la tabla muestra un
  estante por fila con la columna `Celdas` (`A / 1 · A / 2`) y su cantidad;
  un estante sin celdas muestra `—`.
- **Orden de servidor:** el contrato ordena por `name`; `mat-sort` existe solo
  en la columna Nombre y envía `name` / `-name`. Sin orden elegido no se envía
  `sort` y aplica el valor por defecto del backend; cambiar de orden vuelve a
  la página 1.
- **`description` opcional normalizada:** en el body, una cadena vacía o de
  solo espacios se envía como `null` (los DTO son `string|null`), tanto en el
  estante como en cada celda.
- **`is_active` del estante opcional al crear (D-5):** por defecto `true`; el
  checkbox «Ubicación activa» solo se renderiza en modo creación. En edición
  el estado se cambia con Activar/Desactivar del listado y el `PUT` reenvía el
  valor precargado (`loadedIsActive`), sin control en el diálogo.
- **`is_active` por celda:** cada fila del editor tiene su casilla «Activa» y
  su estado viaja siempre en `is_active`.
- **Ids de celdas:** cada fila del editor recuerda el `id` de su celda (`null`
  mientras es nueva). Al guardar, las filas con `id` se actualizan con
  `PUT /v1/cells/{id}`, las nuevas se crean con `POST /v1/cells` y el `id`
  devuelto se escribe en la fila, y las celdas precargadas que el usuario quitó
  se dan de baja con `DELETE /v1/cells/{id}`. Los `id` de las celdas **se
  conservan** entre ediciones (a diferencia del contrato anterior, que los
  recreaba).
- **Orden del guardado:** primero el estante y después sus celdas —upserts
  (crear/actualizar) y al final las bajas—. El `POST` de una celda nueva solo
  se emite cuando el estante ya existe y se conoce su `id`. El primer fallo
  detiene la cadena, se reporta con su propio mensaje y el diálogo queda
  abierto.
- **`savedShelfId` (estado «ya guardado»):** el `id` devuelto por
  `POST /v1/shelves` se guarda en la señal `savedShelfId`. Si después falla
  una celda, el reintento actualiza el estante con `PUT /v1/shelves/{id}` en
  vez de crear un duplicado; igual criterio con el `id` que devuelve cada
  `POST /v1/cells`, que se escribe en su fila para que el reintento actualice
  (`PUT`) en lugar de duplicar.
- **Reactivación con `PUT` de reemplazo del estante:** `reactivate(shelf)`
  reenvía `name` + `description` con `is_active: true` (sin `cells`: el body
  del estante no las admite), no un `PATCH` ni un body parcial (mismo criterio
  R-04 de F-006).
- **Editor de celdas en una sola fila (cambio de UI):** cada celda es una
  única fila alineada con cabecera visible `[Tramo, Celda, Descripción,
Estado, Eliminar]`. La rejilla se implementa con `div role="table"`,
  `role="row"` y `role="cell"` (sin `mat-table`) y cabecera y filas comparten
  una única plantilla (`--dm-location-form-cells-columns`: `minmax(6rem, 1fr)
minmax(6rem, 1fr) minmax(10rem, 2fr) auto auto`), así las columnas coinciden.
  Cada campo conserva su `mat-label` (y la casilla su texto «Activa»), así que
  en <768px la fila se apila sin depender de la cabecera, que se oculta.
- **Copy del diálogo: «estante»:** dentro del diálogo y su flujo la entidad se
  llama «estante» (títulos, botones, confirmación y toasts). El módulo, el
  ítem de menú, la ruta y el vacío del listado siguen diciendo «Ubicaciones».
- **`DELETE` sin promesas:** el copy de desactivación es neutro («Dejará de
  estar disponible para asignar medicamentos.»); no se afirma que borre ni que
  conserve datos. La única excepción es la baja de una **celda**, donde el
  `409` del backend sí se traduce a un motivo concreto (medicamentos
  asociados).
- **`created_at`/`updated_at` los gestiona el servidor:** viajan en las
  respuestas y en los modelos (`Shelf.createdAt`, `Shelf.updatedAt`,
  `ShelfCell.createdAt`, `ShelfCell.updatedAt`), nunca en el body de
  escritura.
- **Paginador:** opciones 10/20/50 (máx. 100 por RNF-06), por defecto 20.
  Cambiar el tamaño vuelve a la página 0 (base 1 en el `GET`); el total
  mostrado es el `total` del servidor.
- **Estados vacío/carga/error:** la tabla y el paginador solo se montan con
  filas (`items().length > 0`); el vacío «No hay ubicaciones para mostrar.»
  aparece **solo** cuando terminó la carga sin filas y sin error. El error de
  carga se muestra inline dentro de la región de la tabla (`role="alert"`) con
  el mensaje de `mapLocationsError` y un botón «Reintentar»; el reintento
  republica el `GET` con los criterios vigentes (página, tamaño, búsqueda,
  estado y orden) sin volver a la página 1. Con filas previas el error convive
  con la tabla conservada, y el botón queda `disabled` mientras `loading()` es
  `true`.

## Permisos (S7, PQ-02)

- `ADMIN`: CRUD completo. Ve «Nuevo ubicación», la columna Acciones (Editar,
  Desactivar/Activar) y los checkboxes de estado.
- `MEDICO`: solo lectura. Con `role === 'MEDICO'` **no existe ningún control
  de escritura en el DOM** (no es ocultar ni deshabilitar):
  `displayedColumns` se reduce a `['name', 'description', 'cells', 'status']`
  y el botón de alta no se renderiza.
- Ruta `/locations` sin guard de rol (hija lazy del shell con `authGuard` del
  padre): accesible para ambos roles autenticados.
- `403` como red de seguridad del backend: el frontend lo traduce a «No tienes
  permiso para gestionar ubicaciones.» y nunca muestra el mensaje crudo.

## Dónde vive cada cosa

- `locations.models.ts` — `Shelf`, `ShelfCell`, `CellOption`, DTOs
  `snake_case` (`ShelfDto`, `ShelfCellDto`, `ShelfListResponseDto`,
  `ShelfPayloadDto`, `CellPayloadDto`), `ShelfListParams`, entradas de
  escritura (`ShelfWriteInput`, `CellWriteInput`), `toShelf()`,
  `toShelfCell()`, `toShelfListPage()`, `toShelfPayload()`,
  `toCellPayload()`, `toCellOption()`, `formatCells()`. Único punto de mapeo;
  sin `any`.
- `locations.service.ts` — `list()` (`GET` con `page`/`size`/`search`/
  `is_active`/`sort`), `getById()`, `create()` (`POST /v1/shelves` → `201`),
  `update()` (`PUT /v1/shelves/{id}` → `200`), `deactivate()` (`DELETE` →
  `204`), `reactivate(shelf)` (`PUT` del estante con `is_active: true`),
  `createCell()` (`POST /v1/cells` → `201`), `updateCell()` (`PUT` de la celda
  → `200`), `deleteCell()` (`DELETE` de la celda → `204`) y `listAllCells()`.
- `locations-error.ts` — `mapLocationsError()` (400/401/403/404/409/422/
  status 0/resto); en `422` lee `errors[].field` y solo conoce `name`,
  `description` y `cells`. Añade `mapCellWriteError()` (el `409` de
  `/v1/cells` es «posición duplicada») y `mapCellDeleteError()` (el `409` de
  la baja es «tiene medicamentos asociados»). Nunca expone
  `detail`/`code`/`message` del backend.
- `locations-toast.ts` — `LocationsToast` (`providedIn: 'root'`, único punto
  de toast y único hogar de los literales de éxito) con `showCreated()`,
  `showUpdated()`, `showActivated()` y `showDeactivated()` (`politeness:
'polite'` → `role="status"`, 2000 ms, sin acción) más los genéricos
  `showSuccess()` y `showError()` (`politeness: 'assertive'` →
  `role="alert"`, 5000 ms, acción «Cerrar»); posición `center`/`bottom`.
- `location-list/` — `dm-location-list`: tabla (Nombre, Descripción, Celdas,
  Estado con badge, Acciones), buscador (`debounceTime(300)` +
  `distinctUntilChanged`), filtro Todos/Activos/Inactivos, `mat-sort` de
  servidor en Nombre y `mat-paginator` de servidor, botón de alta, error de
  carga con reintento, diálogos y toasts. Delega todo el HTTP en el servicio.
- `location-form/` — `dm-location-form` (`MatDialog`): crear (`POST
/v1/shelves` → `201`, con checkbox de estado) y editar (`PUT` del estante →
  `200`, precargado con `GET /{id}`, sin control de estado del estante).
  Editor de celdas en una sola fila por celda (`FormArray`: agregar/quitar
  filas). Guarda el estante y luego reconcilia las celdas por `/v1/cells`.
  Validador `server` para 409/422 como en login/users; Enter envía una vez,
  Escape cierra sin guardar. Cierra con `'saved'` solo si el estante y todas
  sus celdas se guardaron.
- `location-confirm/` — `dm-location-confirm`: confirmación dedicada, botón
  destructivo (`color="warn"`) solo al desactivar; devuelve `true` al
  confirmar y `undefined` al cancelar/Escape/backdrop.
- `app.routes.ts` — hija `locations` lazy dentro del shell (sin guard de rol);
  `/users` sigue con `adminGuard`.
- `core/layout/app-shell.*` — ítem «Ubicaciones» (`routerLink="/locations"`)
  visible para ambos roles; «Usuarios» sigue solo para `ADMIN`.

## Textos propios (español)

- Crear/editar: nombre «Nombre del estante» con hint «Entre 2 y 100
  caracteres.» y `maxlength` 100; validadores `required` recortado,
  `minlength` y `maxlength` con `mat-error` («Ingresa el nombre del estante»,
  «El nombre debe tener al menos 2 caracteres.», «El nombre no debe superar
  los 100 caracteres.»); descripción opcional «Descripción» con hint «Máximo
  200 caracteres.» y error «La descripción no debe superar los 200
  caracteres.».
- Editor de celdas: leyenda «Celdas», botón «Agregar celda», cabecera de
  tabla «Tramo», «Celda», «Descripción», «Estado» y «Eliminar» (esta última
  solo para lectores de pantalla: la columna es visualmente vacía); por fila
  «Tramo» («Ingresa el tramo», «El tramo no debe superar los 50 caracteres.»),
  «Celda» («Ingresa la celda», «La celda no debe superar los 50
  caracteres.»), «Descripción» y casilla «Activa»; botón de eliminar con icono
  `delete` y nombre accesible «Eliminar celda N» (`aria-label` + `title`).
- Títulos «Nuevo estante» / «Editar estante»; botones «Cancelar», «Crear
  estante» (con «Guardando…» durante el envío) y «Guardar cambios»; checkbox
  «Ubicación activa» (solo creación); precarga «Cargando ubicación…».
- Confirmación: «Activar estante» / «Desactivar estante»;
  «¿Activar <nombre>? Volverá a estar disponible para asignar medicamentos.» /
  «¿Desactivar <nombre>? Dejará de estar disponible para asignar
  medicamentos.»; botones «Cancelar» y «Activar» / «Desactivar».
- 400 → «Los datos enviados no son válidos. Revisa el formulario.»
- 401 → «Tu sesión expiró. Inicia sesión de nuevo.»
- 403 → «No tienes permiso para gestionar ubicaciones.»
- 404 → «La ubicación solicitada ya no existe. Actualiza la lista.»
- 409 → «Ya existe una ubicación con ese nombre.» (marcado además como error
  de campo de `name`, con el diálogo abierto).
- 409 de escritura de una celda → «Ya existe una celda con ese tramo y celda
  en el estante.» (mensaje general, sin marcar el campo `name`).
- 409 de baja de una celda → «No se puede eliminar la celda porque tiene
  medicamentos asociados.» (mensaje general; el `detail` del backend no se
  muestra).
- 422 → general «Revisa los datos ingresados.» + por campo «Revisa el
  nombre», «Revisa la descripción» y «Revisa las celdas» (los campos
  desconocidos se ignoran; el error de `cells` se muestra bajo el editor).
- Red/0 → «No se pudo conectar con el servidor. Verifica tu conexión e
  inténtalo de nuevo.»; resto de estados → «Ocurrió un error inesperado.
  Inténtalo de nuevo en unos segundos.»
- Éxitos en toast (`role="status"`, 2000 ms): «Estante creado.» / «Estante
  actualizado.» / «Estante activado.» / «Estante desactivado.».
- Vacío inline: «No hay ubicaciones para mostrar.» (`role="status"`).
- Raya de dato ausente en la tabla: `—` (descripción nula, estante sin
  celdas).
- Error de carga inline (`role="alert"`, región de la tabla): el mensaje de
  `mapLocationsError` (mismos textos que el resto del módulo) más el botón
  «Reintentar» (`mat-stroked-button`, `aria-label="Reintentar la carga de
ubicaciones"`, `disabled` durante la carga).

## Avisos toast y carga contenida

Los cuatro éxitos y los errores de **mutación** (activar/desactivar y el 404
real de edición) van a `LocationsToast`; `locations-error.ts` sigue siendo la
única fuente de textos y el toast solo los muestra. El **fallo de carga del
listado no se anuncia por toast**: se muestra inline en la región de la tabla
con reintento (CA-06), así el mismo fallo no se anuncia dos veces. Los fallos
del **diálogo** (estante o celdas) también son inline, dentro del formulario
(`role="alert"`), y nunca por toast: el diálogo queda abierto para reintentar.
`MatSnackBarModule` se importa una sola vez en el ámbito del catálogo
(`LocationList`). Posición `center`/`bottom`, sin robo de foco (solo anuncio
por el `LiveAnnouncer` interno), un solo contenedor (cada toast reemplaza al
anterior). Sin datos reales: los mensajes no incluyen token, `detail`, `code`,
stack ni URLs internas.

Carga contenida sin parpadeo (S10, patrón F-007/F-008): `loading` solo
gobierna la región de la tabla (`dm-location-list__table-region` con
`aria-busy`); header, filtros (buscador + estado) y paginador permanecen
montados durante `load()`: sin parpadeo del layout y sin pérdida de foco en el
buscador. Las filas visibles se conservan hasta que llega la página nueva;
ante error de carga se conservan las filas anteriores y el fallo se muestra
inline con reintento, no en toast. El reintento conserva los criterios
vigentes (página, tamaño, búsqueda, estado y orden) y no resetea a la página 1.
Un `GET` por gesto (búsqueda con 300 ms de espera, filtro, página, tamaño u
orden), con reset a la primera página cuando cambia el criterio. El overlay de
carga es absoluto (`pointer-events: none`) y la región es su ancla
(`position: relative`), así el `main` del shell no cambia de altura al
buscar/filtrar/paginar/ordenar.

Corrección heredada del falso 404 al cancelar (F-007): el listado solo recarga
y avisa cuando el diálogo cierra con `{ notFound: true }` —el 404 real del
`GET /{id}` en edición—; «Cancelar», Escape o backdrop (`undefined`/`""`/
`false`) no recargan, no avisan y no emiten ningún `GET`.

## Bug reportado: el 404 mostraba el mensaje de error en vez del vacío

El síntoma original («la tabla muestra un error en lugar del vacío») tenía dos
causas: el backend no exponía `/v1/locations` (todo `GET` daba `404`) y el
listado prioriza el error sobre el vacío. El contrato ya es el correcto
(`/v1/shelves`) y la regla de estados quedó fijada: el vacío «No hay
ubicaciones para mostrar.» solo se renderiza con `!loading() &&
!errorMessage()` y `items().length === 0`; con error nunca aparece el vacío.

## Notas para el reviewer

- Specs del módulo (revisor): `locations.models.spec.ts`,
  `locations.service.spec.ts`, `locations-error.spec.ts`,
  `locations-toast.spec.ts`, `location-list.spec.ts`, `location-form.spec.ts`
  y `location-confirm.spec.ts`. Verificación acotada:
  `npx ng test --watch=false --include="src/app/features/locations/**/*.spec.ts"`.
- Cobertura añadida con la segunda realineación: títulos y toasts «estante»,
  editor en una sola fila (cabecera + una fila por celda + eliminación
  accesible), `POST`/`PUT /v1/shelves` sin `cells`, `POST /v1/cells`,
  `PUT /v1/cells/{id}`, `DELETE /v1/cells/{id}`, el reintento con
  `savedShelfId` y el `409` con medicamentos asociados.
- El trabajo de medicamentos es otra unidad: consume solo
  `LocationsService.listAllCells()` y `CellOption` (contrato intacto).
- Excepción puntual al reparto implementer/reviewer: en esta unidad el
  implementer actualizó las specs porque el contrato de datos cambió
  (models/servicio) y las specs anteriores no compilaban; el `PASS`/`FAIL`
  sigue siendo del reviewer.
