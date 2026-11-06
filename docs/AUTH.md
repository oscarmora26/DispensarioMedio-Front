# Autenticación — Dispensario Médico Frontend

Sesión con access token Bearer + refresh token opaco contra el backend del
dispensario (ver `feature-list.md`, F-002 y F-016). Sin datos reales: los
ejemplos usan valores sintéticos.

## Contrato de sesión

Base: `environment.apiUrl` + `/v1/...` (desarrollo: URL absoluta del backend
local; producción: `/api` resuelto por el ingress — ver «Desarrollo y
despliegue»).

- `POST /api/v1/auth/login` — body `{ email (máx. 255), password (1..128) }`
  (variante `email`; el backend también acepta `username` (1..50) pero el
  frontend no la usa).
  200: `{ access_token, token_type: "bearer", expires_in (segundos, 900 por
defecto), refresh_token, refresh_expires_in (segundos, 2592000 por defecto),
user: { id, username, email, role, doctor_id|null } }`. La sesión sigue
  trayendo `username` y `email`: la topbar muestra el `username` sin cambios.
  Errores: 401 credenciales inválidas, 403 cuenta inactiva, 422 datos
  inválidos, 429 rate limiting (sin cabecera `Retry-After`).
- `POST /api/v1/auth/refresh` — **público** (el refresh token es la
  credencial), body `{ refresh_token }` (1..512). 200 con el par rotado:
  `{ access_token, token_type, expires_in, refresh_token, refresh_expires_in,
user }`. Toda falla —desconocido, expirado, revocado o rotado— responde el
  mismo `401 {"detail":"Token inválido","code":"invalid_token"}`; el frontend
  no distingue la causa. El token anterior queda inutilizable en cada uso.
- `POST /api/v1/auth/logout` — **público**, body `{ refresh_token }`. Responde
  **204 siempre** (idempotente, sin oráculo) y solo revoca ese token: las demás
  sesiones del usuario siguen vivas.
- `GET /api/v1/auth/me` (Bearer) — 200 `{ id, username, email, role,
doctor_id|null, is_active }`; 401 no autenticado; 403 usuario inactivo.
- `POST /api/v1/auth/change-password` existe pero queda fuera de alcance. El
  backend, eso sí, revoca todas las sesiones del usuario al cambiar o
  restablecer contraseña y al desactivar la cuenta; el frontend no hace nada
  extra: el siguiente refresh recibe 401 y la sesión termina.

## Persistencia de los tokens (decisión humana del 2026-10-27)

| Credencial                        | Almacén                | Clave               |
| --------------------------------- | ---------------------- | ------------------- |
| Access token                      | `localStorage` (PA-02) | `dm.auth.token`     |
| Refresh token                     | `localStorage`         | `dm.auth.refresh`   |
| Vencimiento local del access (ms) | `localStorage`         | `dm.auth.expiresAt` |

Consecuencias:

- Un F5 y el cierre/reapertura del navegador conservan la sesión: la vigencia la
  marca el backend (30 días deslizantes, se renuevan en cada rotación) y el
  logout. No hay expiración local del refresh.
- El refresh se **comparte entre pestañas**. Como el backend rota el token en
  cada uso, `refreshSession()` relee el valor persistido antes de cada intento y,
  si otra pestaña lo rotó mientras el intento estaba en vuelo (401 benigno
  dentro de la ventana de gracia de 10 s), adopta el token nuevo y reintenta una
  vez en lugar de cerrar la sesión.
- Toda lectura/escritura está aislada en los helpers privados de `AuthService`;
  ningún componente, guard ni interceptor toca el almacenamiento. Sin
  `localStorage` disponible, la sesión vive solo en memoria.
- El refresh token nunca se loguea ni se envía a endpoints distintos de
  `/auth/refresh` y `/auth/logout`.

## Renovación reactiva (sin temporizadores)

- Al iniciar sesión o renovar se guarda
  `expiresAt = ahora + expires_in * 1000 − 30 s` de margen.
- `refreshSession()` rota el par con `POST /auth/refresh` y es **single-flight**:
  N peticiones concurrentes comparten un solo `POST`, aplican el par rotado y
  actualizan `user` (rol y `doctor_id` incluidos) desde la respuesta.
- El **interceptor** adjunta `Authorization: Bearer` solo a `environment.apiUrl`
  con sesión válida. Ante un 401 de una petición protegida renueva una vez y
  **reintenta una sola vez** la petición original con el access nuevo. Si el
  refresh responde 401/403 o no hay refresh token, limpia la sesión y navega a
  `/login?returnUrl=<url actual>`; el aviso «Tu sesión expiró. Inicia sesión de
  nuevo.» (`reason=expired`) aparece solo cuando existía un refresh token que
  ya no sirve. Un fallo de red al renovar conserva la sesión y solo propaga el
  error: el siguiente intento vuelve a renovar. No hay reintentos en bucle ni
  ante otros estados.
- Quedan fuera del adjuntado y del manejo de 401 del interceptor:
  `/auth/login` (propaga credenciales inválidas al formulario),
  `/auth/refresh`, `/auth/logout` (el par viaja en el body) y `/auth/me`
  (recibe su cabecera explícita desde `restoreSession()`).
- **Arranque**: `restoreSession()` usa `GET /auth/me` cuando el access
  persistido no venció localmente; si venció o `/me` lo rechaza y hay refresh
  persistido, renueva primero y usa el `user` del refresh. `ensureValidSession()`
  (guard) intenta renovar antes de declarar la sesión caída. La restauración
  sigue siendo idempotente: una sola cadena de peticiones por arranque.
- `isAuthenticated` es un `computed` sobre las señales de sesión; la detección
  del instante de expiración es imperativa (`hasValidSession()`,
  `ensureValidSession()`), usada por guard e interceptor.

## Logout

«Salir» emite `POST /auth/logout` con el refresh vigente **sin esperar la
respuesta** (fire-and-forget, el backend responde 204 siempre), limpia access,
refresh y `expiresAt`, y navega a `/login` con `replaceUrl` y sin `returnUrl`.
Un fallo de red no impide el cierre local. El backend revoca el token, así que
ya no puede refrescar.

## Variante `email` y S-01 (verificado el 2026-10-21)

F-005: el frontend solo envía la variante `email` del login. S-01 se verificó
con peticiones sintéticas al backend local (`http://127.0.0.1:8000`, usuario
inexistente, sin datos reales):

- 401 con `email`: `{"detail":"Usuario o contraseña incorrectos",
"code":"invalid_credentials","errors":[]}` — misma forma que la variante
  `username`. La UI muestra «Correo electrónico o contraseña incorrectos.».
- 422 con `email` vacío, con más de 255 caracteres o con formato inválido:
  `{"detail":"Datos inválidos","code":"validation_error",
"errors":[{"field":"email","message":"..."}]}` — el campo del identificador
  es `errors[].field === 'email'`, por simetría con `username`. La UI muestra
  «Revisa el correo electrónico» bajo el campo; campos desconocidos muestran
  solo el mensaje general, sin exponer el `message` del backend.

## Dónde vive cada cosa

- `src/app/core/auth/auth.models.ts` — tipos, DTOs (`TokenPairResponseDto`,
  alias de login/refresh, `RefreshRequestDto`) y `toAuthUser()`
  (`doctor_id` → `doctorId`).
- `src/app/core/auth/auth-error.ts` — `mapAuthError()`; textos propios en
  español, nunca se exponen `detail`/`code`/`message` del backend.
- `src/app/core/auth/auth.service.ts` — signals `user`/`token`/`expiresAt`,
  `login()`/`logout()`/`restoreSession()`/`ensureValidSession()`/
  `refreshSession()`/`canRefresh()` y la persistencia aislada en helpers
  privados (único acceso a `localStorage`).
- `src/app/core/auth/auth.guard.ts` — `authGuard`, `guestGuard` y
  `sanitizeReturnUrl()` (única regla de `returnUrl`: solo rutas internas).
- `src/app/core/auth/auth.interceptor.ts` — Bearer solo a `environment.apiUrl`
  excluyendo los endpoints de autenticación; 401 protegido → un refresh y un
  reintento; sesión caída → limpieza + `/login?returnUrl=`.
- `src/app/features/auth/login/` — página `dm-login` fuera del shell.

## Desarrollo y despliegue

- Desarrollo: CORS habilitado en el backend para `http://localhost:4200`; sin
  `proxy.conf.json` ni `proxyConfig` en `angular.json`. `environment.ts` apunta
  a la URL absoluta del backend local.
- Producción: `environment.production.ts` conserva `apiUrl: '/api'`; el
  prefijo lo resuelve el ingress/Nginx. Nunca se añaden `Access-Control-*` ni
  credenciales desde el frontend.

## Riesgo XSS (PA-02 y refresh en `localStorage`)

El access y el refresh persisten en `localStorage` (decisión humana del
2026-10-21 y del 2026-10-27): un script inyectado puede leer ambos y el refresh
sobrevive al cierre del navegador hasta que lo revoque un logout, un cambio de
contraseña, la desactivación de la cuenta o la detección de reuso. Mitigaciones
fuera de esta entrega: CSP estricta, auditoría de dependencias y cookies
`HttpOnly` si el backend las adopta.

## Notas para el reviewer

- Specs del servicio (`auth.service.spec.ts`): login persiste access, refresh y
  `expiresAt` en `localStorage` (y nada de eso en `sessionStorage`), `expiresAt`
  con 30 s de margen, `refreshSession()` single-flight (un solo POST para
  llamadas concurrentes) y adopción del token rotado por otra pestaña, 401
  limpia y error de red conserva las credenciales, `restoreSession()` con access vigente
  (`/me`), vencido (`refresh` primero) y rechazado por `/me` (refresh después),
  `is_active: false` sin intentar refrescar, idempotencia y logout con
  `POST /auth/logout` + limpieza + `replaceUrl`.
- Specs del interceptor (`auth.interceptor.spec.ts`): endpoints de
  autenticación sin Bearer ni manejo de 401, 401 protegido → un refresh y un
  reintento con el token nuevo, dos 401 concurrentes con un solo refresh,
  refresh fallido → `reason=expired`, reintento que vuelve a fallar sin un
  segundo refresh, 401 sin sesión sin `reason`, y errores que no son 401 sin
  reintento.
- Specs estructurales: `app-shell.spec.ts` espera el `POST /auth/logout` al
  pulsar «Salir»; `auth.guard.spec.ts` limpia ambos almacenes entre casos.
