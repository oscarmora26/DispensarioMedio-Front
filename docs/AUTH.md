# Autenticación — Dispensario Médico Frontend

Sesión con token Bearer contra el backend del dispensario (ver `feature-list.md`,
F-002). Sin datos reales: los ejemplos usan valores sintéticos.

## Contrato de sesión

Base: `environment.apiUrl` + `/v1/...` (desarrollo: URL absoluta del backend
local; producción: `/api` resuelto por el ingress — ver «Desarrollo y
despliegue»).

- `POST /api/v1/auth/login` — body `{ email (máx. 255), password (1..128) }`
  (variante `email`; el backend también acepta `username` (1..50) pero el
  frontend no la usa).
  200: `{ access_token, token_type: "bearer", expires_in (segundos),
user: { id, username, email, role, doctor_id|null } }`. La sesión sigue
  trayendo `username` y `email`: la topbar muestra el `username` sin cambios.
  Errores: 401 credenciales inválidas, 403 cuenta inactiva, 422 datos
  inválidos, 429 rate limiting (sin cabecera `Retry-After`).
- `GET /api/v1/auth/me` (Bearer) — 200 `{ id, username, email, role,
doctor_id|null, is_active }`; 401 no autenticado; 403 usuario inactivo.
- El backend **no** ofrece refresh token, logout/revocación ni recuperación de
  contraseña. `POST /api/v1/auth/change-password` existe pero queda fuera de
  alcance.

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

## Expiración sin refresh

- Al iniciar sesión se guarda `expiresAt = ahora + expires_in * 1000 − 30 s`
  de margen. `isAuthenticated()` es `false` cuando la sesión expiró.
- No hay temporizador ni cuenta atrás: el guard lo comprueba antes de navegar
  (`ensureValidSession()`) y el interceptor antes de adjuntar la cabecera. Si
  la sesión expira a mitad de pantalla, la siguiente petición devuelve 401 y
  sigue el mismo camino (limpieza + `/login?returnUrl=...`).
- La sesión restaurada vía `/me` no informa TTL restante: `expiresAt` queda en
  `null` (vigencia desconocida, se asume válida hasta el próximo 401).
- `isAuthenticated` es un `computed` sobre las señales de sesión; la detección
  del instante de expiración es imperativa (`hasValidSession()`,
  `ensureValidSession()`), usada por guard e interceptor.

## Logout local

«Salir» solo limpia el cliente (token, usuario, `expiresAt`) y navega a
`/login` con `replaceUrl`: el token sigue válido en el backend hasta expirar
porque no hay revocación. No se emite ninguna petición de logout.

## Dónde vive cada cosa

- `src/app/core/auth/auth.models.ts` — tipos, DTOs y `toAuthUser()`
  (`doctor_id` → `doctorId`).
- `src/app/core/auth/auth-error.ts` — `mapAuthError()`; textos propios en
  español, nunca se exponen `detail`/`code`/`message` del backend.
- `src/app/core/auth/auth.service.ts` — signals `user`/`token`/`isAuthenticated`,
  `login()`/`logout()`/`restoreSession()`/`ensureValidSession()` y persistencia
  aislada en `readToken`/`writeToken`/`clearToken` (único acceso a `localStorage`).
- `src/app/core/auth/auth.guard.ts` — `authGuard`, `guestGuard` y
  `sanitizeReturnUrl()` (única regla de `returnUrl`: solo rutas internas).
- `src/app/core/auth/auth.interceptor.ts` — Bearer solo a `environment.apiUrl`
  excluyendo `/auth/login`; 401 protegido → limpieza + `/login?returnUrl=`.
- `src/app/features/auth/login/` — página `dm-login` fuera del shell.

## Desarrollo y despliegue

- Desarrollo: CORS habilitado en el backend para `http://localhost:4200`; sin
  `proxy.conf.json` ni `proxyConfig` en `angular.json`. `environment.ts` apunta
  a la URL absoluta del backend local.
- Producción: `environment.production.ts` conserva `apiUrl: '/api'`; el
  prefijo lo resuelve el ingress/Nginx. Nunca se añaden `Access-Control-*` ni
  credenciales desde el frontend.

## Riesgo XSS de `localStorage` (PA-02)

El token persiste en `localStorage` (decisión humana del 2026-10-21): sobrevive
al cierre del navegador hasta expirar y queda expuesto ante scripts inyectados
(XSS). Mitigaciones fuera de esta entrega: CSP estricta, auditoría de
dependencias y, si el backend lo permite en el futuro, cookies `HttpOnly` +
refresh con rotación.

## Notas para el reviewer

- Actualizar `src/app/app.spec.ts`: `app.html` ya no renderiza `<dm-app-shell/>`
  sino `<router-outlet/>`; la ruta `''` monta `dm-home` dentro del shell solo
  con sesión válida (redirige a `/login?returnUrl=` sin ella). Proveer
  `HttpClient` de prueba y un `AuthService` con sesión según el caso (montar
  sesión vía `login` con email; la aserción de topbar sigue esperando el
  `username` de la sesión).
- Actualizar `src/app/core/layout/app-shell.spec.ts`: el shell inyecta
  `AuthService` (proveer `HttpClient` o un doble); cubrir el bloque de usuario
  (username, etiqueta de rol, «Salir»), el fallback de rol desconocido y que
  sin sesión el bloque no se renderiza.
- Crear specs nuevas (el implementer no crea ni edita `*.spec.ts`):
  - `auth.service.spec.ts`: login (URL/cuerpo exactos con `{email, password}`,
    `trim` en el email, contraseña intacta, mapeo `doctor_id`, `expiresAt` con
    30 s de margen), logout (limpieza + `/login`
    sin petición), `restoreSession` idempotente (una sola petición, sin token
    no hay petición, 200 inactivo/401/403 limpian), `ensureValidSession` y
    `hasValidSession` con expiración.
  - `auth.guard.spec.ts`: `authGuard` espera restauración, redirige con
    `returnUrl` y `reason=expired` solo con token previo; `guestGuard`
    redirige al `returnUrl` saneado; tabla de `sanitizeReturnUrl()`.
  - `auth.interceptor.spec.ts`: cabecera solo a `apiUrl` sin `/auth/login`,
    sin cabecera sin sesión ni a URLs externas; 401 protegido redirige con
    `returnUrl`; 401 de login se propaga; sin reintentos.
  - `login.spec.ts`: focos, validaciones del campo `email` (labels,
    atributos `autocomplete`/`inputmode`/`maxlength`, validadores `required` +
    `email` + `maxlength(255)`, 422 con campo `email`), toggle
    (`aria-pressed`, `type`), `submitting`/`aria-busy`/deshabilitados,
    regiones `alert`/`status`, pegado permitido, Enter único, navegación al
    `returnUrl` saneado y textos exactos de `docs/AUTH.md`-F-005.
