# Usuarios — Dispensario Médico Frontend

Gestión de usuarios (`src/app/features/users/`, F-006): listado con tabla de
Material, búsqueda/filtros/orden de servidor, paginación de servidor
obligatoria, crear/editar con diálogos y desactivación lógica vía `DELETE`.
Solo `ADMIN` (ruta con `adminGuard` + ítem «Usuarios» solo con
`role === 'ADMIN'`). Sin datos reales: los ejemplos usan valores sintéticos.

## Contrato aplicado (documentado en `DispensarioMedicoDocs`)

Base: `environment.apiUrl + '/v1/users'` compuesta en un solo lugar
(`UsersService`, mismo patrón que `AuthService`). `Authorization: Bearer` la
adjunta el `authInterceptor` de F-002.

- `GET /v1/users` (Admin) — query params `page` (desde 1), `size` (máx. 100),
  `search`, `is_active` (`true`/`false`), `sort` (`campo` o `-campo`); `200`
  `{items, total, page, size, pages}`. Sin paginación ni filtrado en cliente:
  ante fallo del backend se muestra el estado de error, no una lista local.
- `POST /v1/users` (Admin) — body `{username, email, password, role_id,
doctor_id, is_active}`; `201` con `{id, username, email, role, doctor_id,
is_active}`; `409` en duplicado (`username`/`email` únicos, §7).
- `GET /v1/users/{id}` (Admin) — `200`; `404` si ya no existe.
- `PUT /v1/users/{id}` (Admin) — actualizar; `200`. Sin `PATCH`.
- `DELETE /v1/users/{id}` (Admin) — **desactivación lógica vía `is_active`,
  no borrado físico** (RF-17). Ver R-04.
- `POST /v1/users/{id}/reset-password` existe pero queda **diferido a una
  feature posterior**; no hay ruta, diálogo ni método en esta entrega.
- Reglas §7: `password_hash` nunca se devuelve; solo `MEDICO` puede tener
  `doctor_id`; no desactivar al último administrador; no desactivarse a sí
  mismo; escritura solo `ADMIN` (`403` si un médico intenta escribir, matriz
  §4); mensajes y validaciones en español.
- Divergencia `role_id` (request) vs `role` (response): el único mapper vive en
  `users.models.ts` (`toRoleId()`/`toManagedUser()`), mismo patrón que
  `toAuthUser()`. `role` se tipa como `UserRole` reutilizado de
  `auth.models.ts`, tolerante a valores no previstos (fallback al valor crudo).
- Divergencia login `username` vs `email`: el frontend usa la variante `email`
  (F-005); en usuarios `email` sigue siendo el identificador principal y
  `username` se conserva porque §7 lo exige en el body de creación.

## Decisiones (R-02 y R-04 resueltos por OpenAPI; R-01 y R-03 pendientes)

- **R-01 — `role_id`:** `ADMIN = 1`, `MEDICO = 2` (§7 muestra `2` → `MEDICO`;
  `ADMIN` pendiente de confirmar). Tabla aislada en `ROLE_ID_BY_ROLE`
  (`users.models.ts`) para un cambio de una sola línea.
- **R-02 — longitudes y contraseña al editar (resuelto por OpenAPI):**
  `email` `required` + `email` + `maxlength(255)`, `username` `required` +
  `maxlength(50)`, `password` `required` + `maxlength(128)` **solo al crear**.
  `PUT /users/{id}` = reemplazo completo sin `password` («No modifica la
  contraseña»): en edición no hay campo de contraseña (inhabilitado y oculto)
  y el `PUT` nunca la envía; el cambio de contraseña vive en F-007
  (`POST /users/{id}/reset-password`).
- **R-03 — `doctor_id` y filtro por rol:** sin filtro por rol ni selector de
  médico hasta el OpenAPI. `doctor_id` es un campo numérico directo visible
  solo con rol `MEDICO` (con `ADMIN` se limpia, deshabilita y se envía `null`,
  §7); `mat-label` «ID de médico».
- **R-04 — `DELETE` y reactivación (resuelto por OpenAPI `PUT
/users/{user_id}`):** el `PUT` exige el reemplazo completo (`username`,
  `email`, `role_id`, `doctor_id`, `is_active`; sin `password`). Desactivar =
  `http.delete` (único `http.delete` del servicio, sin `http.patch`);
  reactivar = `PUT /{id}` con los datos del `ManagedUser` visible y
  `is_active: true` (`UsersService.reactivate(usuario)`). Queda por confirmar
  contra el backend local el status/cuerpo exactos del `DELETE` (`200` con
  recurso vs `204`).
  La UI impide la autodesactivación (botón deshabilitado con etiqueta
  accesible) y advierte cuando el objetivo es el único administrador activo
  entre los usuarios cargados (heurística visible; el backend es la barrera
  real).
- Paginador: opciones 10/20/50 (máx. 100 por RNF-06), por defecto 20. Orden de
  servidor solo en columnas Usuario y Correo (`sort` = `campo`/`-campo`).

## Dónde vive cada cosa

- `users.models.ts` — `ManagedUser`, DTOs `snake_case`, `toManagedUser()`,
  `toCreatePayload()`, `toUpdatePayload()`, `toRoleId()`, `roleLabel()`,
  `USER_ROLE_OPTIONS`. Único punto de mapeo; sin `any`.
- `users.service.ts` — `list()` (`GET` con `page`/`size`/`search`/`is_active`/
  `sort`), `getById()`, `create()` (`POST` → `201`), `update()` (`PUT` →
  `200`), `deactivate()` (`DELETE`), `reactivate(usuario)` (`PUT` de reemplazo
  completo con `is_active: true`, R-04 resuelto por OpenAPI). `email`/`username`
  con `trim`, contraseña intacta (solo al crear; el `PUT` nunca la envía).
- `users-error.ts` — `mapUsersError()` (401/403/404/409/422/status 0/5xx);
  422 con `field` en `snake_case` (`role_id`/`doctor_id` → campos del
  formulario). Nunca expone `detail`/`code`/`message` del backend.
- `core/auth/admin.guard.ts` — `adminGuard`: espera sesión, sin sesión →
  `/login?returnUrl=/users`, rol no `ADMIN` → `/` (PQ-02). No toca
  `authGuard`/`guestGuard`.
- `app.routes.ts` — hija `users` lazy con `adminGuard` dentro del shell.
- `user-list/` — `dm-user-list`: tabla, buscador (300 ms), filtro
  Todos/Activos/Inactivos, `mat-sort` (usuario/correo), `mat-paginator` de
  servidor, botones Nuevo/Editar/Desactivar-Activar; carga incremental sin
  parpadeo (`aria-busy` en la región de la tabla) y avisos en toast vía
  `UsersToast` (F-007). Delega todo el HTTP en el servicio.
- `user-form/` — `dm-user-form` (`MatDialog`): crear (`POST` → `201`, con
  contraseña obligatoria) y editar (`PUT` de reemplazo completo → `200`, sin
  campo ni envío de contraseña); toggle de contraseña como el login (solo al
  crear); Enter envía una vez, Escape cierra sin guardar.
- `user-confirm/` — `dm-user-confirm`: confirmación dedicada, botón
  destructivo (`color="warn"`) solo para desactivar.
- `core/layout/app-shell.*` — ítem «Usuarios» solo con `role === 'ADMIN'`
  (`isAdmin()`); sin cambios de estilos ni breakpoints.

## Textos propios (español)

- Crear/editar: validadores `required`/`email`/`maxlength` con `mat-error`
  («Ingresa el usuario», «El usuario no debe superar los 50 caracteres.»,
  «Ingresa el correo electrónico», «Ingresa un correo electrónico válido.»,
  «El correo electrónico no debe superar los 255 caracteres.», «Ingresa la
  contraseña», «La contraseña no debe superar los 128 caracteres.»,
  «Selecciona un rol»).
- 409 → «Ya existe un usuario con ese correo electrónico.» (diálogo abierto).
- 404 → «El usuario solicitado ya no existe. Actualiza la lista.»
- 403 → «No tienes permiso para gestionar usuarios.»
- 422 general «Revisa los datos ingresados.» + por campo («Revisa el usuario»,
  «Revisa el correo electrónico», «Revisa la contraseña», «Selecciona un rol
  válido», «Revisa el médico asociado»).
- Éxitos en toast (`role="status"`, 2000 ms): «Usuario creado.» /
  «Usuario actualizado.» / «Usuario activado.» / «Usuario desactivado.»
  (F-007; ya no van inline).

## Avisos toast, carga incremental y corrección del cancelar (F-007)

Decisiones de producto PA-01…PA-04 (aprobadas por el humano sin detallar;
se aplican las recomendaciones de la spec y se documentan aquí como asumidas):

- **PA-01 — Posición:** `bottom-center` (por defecto de Material). El
  `top-left` literal colisiona con el sidenav persistente de 240 px y la
  topbar navy en ≥1280 px y rompe el layout shell de F-001.
- **PA-02 — Duración:** éxito 2000 ms; error 5000 ms con acción «Cerrar»
  (los errores 401/403/red/5xx/404 necesitan tiempo de lectura y cierre
  manual; 2 s para errores es insuficiente e inaccesible).
- **PA-03 — Alcance migrado al toast:** «Usuario creado.» /
  «Usuario actualizado.» / «Usuario activado.» / «Usuario desactivado.» +
  errores de carga del listado y de activar/desactivar (vía `mapUsersError`)
  - 404 de edición («El usuario solicitado ya no existe. Actualiza la
    lista.»). Quedan inline el vacío «No hay usuarios para mostrar.» y el
    «Cargando usuario…» del diálogo.
- **PA-04 — Apilado:** cada toast reemplaza al anterior (un solo contenedor
  de `MatSnackBar`); pasar a apilado solo si el humano prevé errores
  simultáneos frecuentes.

Dónde vive: `users-toast.ts` (`UsersToast`, `providedIn: 'root'`, único punto
de toast y único hogar de los literales de éxito) con `showUserCreated()`,
`showUserUpdated()`, `showUserActivated()` y `showUserDeactivated()`
(`politeness: 'polite'` → `role="status"`, 2000 ms, sin acción) más los
genéricos `showSuccess()` y `showError()` (`politeness: 'assertive'` →
`role="alert"`, 5000 ms, acción «Cerrar», para errores de carga/toggle y el
404 de edición); posición `center`/`bottom` en ambos; sin robo de foco (solo
anuncio por `LiveAnnouncer` interno).
`MatSnackBarModule` se importa una sola vez en el ámbito de users
(`UserList`); `users-error.ts` sigue siendo la única fuente de textos (el
toast solo los muestra). Sin datos reales: los mensajes no incluyen token,
`detail`, `code`, stack ni URLs internas.

Carga incremental (CA-01/CA-02): `loading` solo gobierna la región de la
tabla (`dm-user-list__table-region` con `aria-busy`); header («Usuarios» +
«Nuevo usuario»), filtros (buscador + estado) y paginador permanecen montados
durante `load()`: sin parpadeo del layout y sin pérdida de foco en el
buscador. Las filas visibles se conservan hasta que llega la página nueva;
ante error de carga se conservan las filas anteriores y se avisa en toast
(solo sin filas previas la región muestra el vacío). Se conserva
`debounceTime(300)` + `distinctUntilChanged`: un `GET` por gesto
(búsqueda/filtro/página/tamaño/orden, con reset a la primera página cuando
cambia el criterio).

Corrección del falso 404 al cancelar (CA-06): el listado discrimina
`afterClosed()` con el guard `isNotFoundResult()` — solo `{ notFound: true }`
(404 real del `GET /{id}` en edición) recarga la lista y muestra el toast 404. «Cancelar», Escape o backdrop (`undefined`/`""`/`false`) no recargan, no
avisan y no emiten ningún `GET`. En el diálogo, «Cancelar» usa
`mat-dialog-close` sin valor y Escape/backdrop resuelven `undefined` por
defecto; solo `loadUser()` ante fallo del `GET /{id}` cierra con
`{ notFound: true }`. La condición amplia `result !== undefined` queda
eliminada.

## Footer y shell estables al filtrar (F-008)

Causa confirmada (T-008-01; hipótesis (a) de la spec): el
`div.dm-user-list__loading` con el `mat-progress-spinner` se insertaba **en
flujo** bajo la tabla durante cada `load()` (`display: flex` con padding
vertical), añadía altura a la región y al resolverse la encogía; el `main` del
shell cambiaba de altura y el `footer.dm-footer` saltaba (percibido como
«refresh»). Descartado el re-render del shell: filtrar no navega (`grep` de
`router.navigate`/`queryParams`/`Router` en `user-list/` → 0 resultados), el
shell es `OnPush` y `load()` solo toca signals locales
(`items`/`total`/`loading`); el footer nunca se remontaba, solo se desplazaba.
Sin transición ni animación propia en el contenedor que explique parpadeo.

Arreglo (opción (a) de PQ-02, solo `user-list.scss`): la región
(`dm-user-list__table-region`) es el ancla (`position: relative`) y la carga
es un overlay absoluto (`inset-block-start: 0`, `inset-inline: 0`,
`z-index: 1`, `pointer-events: none`) que flota sobre la región sin ocupar
altura en flujo. Sin fondo propio ni colores nuevos (cero literales, solo
`var(--dm-*)`), `prefers-reduced-motion` intacto (sin animación propia),
`aria-busy` sigue en la región y F-007 intacto (filas conservadas hasta la
respuesta, debounce de 300 ms, toast centralizado, corrección del cancelar).
`app-shell.*` no se tocó (T-008-02 sin cambios necesarios): footer, topbar,
sidenav, breakpoints y textos idénticos.

## Notas para el reviewer

- Crear `users.service.spec.ts` (URLs/cuerpos exactos, `trim`, `role_id`,
  `DELETE` para desactivar, sin `patch`, sin `reset-password`),
  `admin.guard.spec.ts` (sin sesión → `/login?returnUrl=/users`; `MEDICO` →
  `/`; `ADMIN` → `true`), `user-list.spec.ts` (tabla, paginador de servidor,
  filtros con reset a página 1, diálogos, autodesactivación impedida) y
  `user-form.spec.ts` (validadores, `doctor_id` solo `MEDICO`, crear vs
  editar, 409/422, toggle, `aria-busy`).
- Actualizar `app-shell.spec.ts` si aplica (ítem «Usuarios» solo `ADMIN`; los
  selectores existentes por primer `.dm-nav__link` siguen viendo «Inicio»).
- Actualizar `app.spec.ts` (estructura de rutas CA-01: la ruta padre con
  `AppShell` ahora tiene dos hijas — `''` → `Home` y `'users'` lazy con
  `adminGuard` —; sin sesión `/users` termina en `/login?returnUrl=%2Fusers`).
- Verificar residuales R-01…R-04 contra `/openapi.json` o backend local con
  datos sintéticos y transcribir status/cuerpo definitivos aquí.
- El implementer no creó ni editó ningún `*.spec.ts`.
- F-008 (footer estable, pendiente de revisión): crear/actualizar
  `user-list.spec.ts` (estabilidad del footer: `footer.dm-footer` y
  `header`/`nav`/`main` conservan identidad de nodo durante `load()` al
  buscar/filtrar/paginar/ordenar; carga contenida en la región sin salto de
  layout; foco permanece en el buscador; `aria-busy` solo en la región;
  filtrar no navega) y no-regresión F-007 (carga incremental, toast de éxitos
  y errores, cancelar sin 404 ni `GET`).
- F-007 (toast/carga/cancelar, pendiente de revisión): crear/actualizar
  `user-list.spec.ts` (carga sin parpadeo: header/filtros/paginador montados
  durante `load()`, foco conservado en el buscador, `aria-busy` en la región
  de la tabla; un `GET` por gesto con `HttpTestingController`; toast de los
  4 éxitos y de errores con duración/posición/roles y sin robo de foco;
  cerrar con `undefined` → `expectNone` de `GET` y sin toast; cerrar con
  `{ notFound: true }` → recarga + toast 404), `users-toast.spec.ts`
  (éxito 2000 ms `polite` sin acción, error 5000 ms `assertive` con «Cerrar»,
  posición `center`/`bottom`) y no-regresión de `user-form.spec.ts`
  (Cancelar/Escape/backdrop sin `GET` ni `{ notFound: true }`; 404 real de
  `loadUser()` sí cierra con `{ notFound: true }`).
