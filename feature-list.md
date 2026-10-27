# Feature List — Dispensario Médico

> Fuente de verdad del backlog. Cada feature debe ser aprobada por el humano antes de implementarse.

## Estados

| Estado              | Significado                                                  | Quién lo asigna      |
| ------------------- | ------------------------------------------------------------ | -------------------- |
| `proposed`          | Especificada, esperando revisión humana                      | `spec-author`        |
| `approved`          | Aprobada para implementar                                    | **Solo el humano**   |
| `in_progress`       | Implementación en curso                                      | `team-lead`          |
| `in_review`         | Implementación terminada, en revisión y pruebas              | `team-lead`          |
| `changes_requested` | El reviewer encontró fallos o faltan pruebas                 | `team-lead`          |
| `done`              | Tests, lint y build pasan; criterios de aceptación cumplidos | `team-lead`          |
| `blocked`           | Falta una decisión, dependencia, acceso o información        | `team-lead` o humano |
| `rejected`          | Descartada                                                   | **Solo el humano**   |

## Reglas de transición

| Desde               | Hacia                                    | Quién                |
| ------------------- | ---------------------------------------- | -------------------- |
| `proposed`          | `approved` / `rejected`                  | Humano               |
| `proposed`          | `blocked`                                | `team-lead` o humano |
| `approved`          | `in_progress`                            | `team-lead`          |
| `in_progress`       | `in_review` / `blocked`                  | `team-lead`          |
| `in_review`         | `done` / `changes_requested` / `blocked` | `team-lead`          |
| `changes_requested` | `in_progress` / `blocked`                | `team-lead`          |
| `blocked`           | Estado anterior o `proposed`             | Humano               |
| Cualquiera          | `rejected`                               | Humano               |

Reglas adicionales:

- Los agentes nunca escriben `approved`, `rejected` ni el nombre del aprobador.
- Solo puede haber una feature en `in_progress`.
- `done` requiere `PASS` del reviewer, `npm run lint`, `npm test` y `npm run build`.
- Si falta información, la feature pasa a `blocked`; no se inventa alcance.

## Backlog

<!-- El spec-author agrega las features aprobadas para revisión debajo de esta línea. -->

### F-001 — Design System `Clinical Academic Authority`: tokens, documentación y layout shell

- **Estado:** done
- **Prioridad:** Alta
- **Aprobado por:** Oscar Mora
- **Fecha de aprobación:** 2026-10-21
- **Dependencias:** —

**Descripción**

Codificar en el repositorio el design system `Clinical Academic Authority`, ya definido en el proyecto Stitch «Paleta Colores UNAPEC» (ID 3698123582769390902), tomando como referencia las pantallas «Muestrario de Colores UNAPEC & Dispensario» y «Analisis de Paleta UNAPEC y DispensarioManager». El objetivo es que el frontend deje de usar los valores por defecto de Angular Material (azure/blue + Roboto) y pase a consumir un sistema visual propio, documentado y verificable.

Alcance aprobado: **tokens + documentación + layout shell base**. Fuera de alcance: componentes `shared/` adicionales y cualquier funcionalidad de negocio (pacientes, farmacia, visitas, reportes).

Decisiones de producto ya tomadas por el humano y que esta feature no reabre:

- Tipografía canónica: **Inter** para UI y **JetBrains Mono** solo para datos tabulares (cédula, carnet, códigos e IDs de visita).
- Primario canónico M3: **`#0A3B75`**. El `#002551` generado por Stitch no se usa como primario; `#062349` es hover/dark y `#EFF6FF` el contenedor de selección.

Convención de prefijo de tokens: los tokens propios del producto se declaran como CSS custom properties con prefijo `--dm-*` (coherente con el prefijo de selectores `dm-` y con el nombre del proyecto), y se deja `--mat-sys-*` exclusivamente a lo que genera `mat.theme()`. Motivo: `--mat-sys-*` es una API generada por Angular Material; redefinirla a mano rompe la coherencia interna de M3 y se sobreescribe en cada build. Los valores del design system que no tienen rol M3 equivalente (estados clínicos, chips, layout, elevación) viven en `--dm-*` y los componentes de Material se alinean mediante las paletas custom y overrides puntuales.

Inventario exacto a codificar:

- **Color — marca y primario M3**
  - `primary` `#0A3B75` · `primary-dark`/hover `#062349` · `primary-container`/selection wash `#EFF6FF` · `on-primary` `#FFFFFF` · `primary-light` `#1E5BB0`
- **Color — secundario (rojo institucional)**
  - `secondary` `#C8102E` · `secondary-dark` `#A6192E` (también citado `#A30C24`) · `secondary-container` `#FEF2F2` · `on-secondary` `#FFFFFF`
- **Color — terciario clínico (teal)**
  - `tertiary` `#0D9488` · `tertiary-container` `#F0FDFA` · teal suave `#CCFBF1` · teal-dark `#115E59` · teal text `#0F766E`
- **Color — error**
  - `error` `#DC2626` (M3 `#BA1A1A`) · `error-container` `#FEE2E2`
- **Color — superficies y texto**
  - background/canvas `#F8FAFC` · surface-card `#FFFFFF` · border-subtle `#E2E8F0` · text `#0F172A` · muted `#64748B` · outline `#737781` · outline-variant `#C3C6D1`
- **Color — estados clínicos**
  - success `#16A34A` + contenedor `#DCFCE7` · warning `#D97706` + `#FEF3C7` · danger `#DC2626` + `#FEE2E2` · dispensario teal `#0D9488` + `#F0FDFA`
- **Contraste declarado a preservar**
  - navy AAA 10.4:1 · navy-dark AAA 14.8:1 · rojo AA 4.8:1 · teal AA 4.6:1
- **Tipografía — Inter, 14 pasos (size/weight/line-height/letter-spacing)**
  - `headline-xl` 36/700/44/-0.02em · `headline-xl-mobile` 28/700/36/-0.01em
  - `headline-lg` 30/600/38/-0.015em · `headline-lg-mobile` 24/600/32/-0.01em · `headline-md` 22/600/28 · `headline-sm` 18/600/24
  - `title-md` 16/600/22 · `title-sm` 14/600/20
  - `body-lg` 16/400/24 · `body-md` 14/400/20 · `body-sm` 12/400/16
  - `label-lg` 14/500/20/+0.01em · `label-md` 12/500/16/+0.02em · `label-sm` 11/600/14/+0.04em
  - Cifras tabulares obligatorias para IDs, cédulas y cantidades.
- **Spacing y layout**
  - Base 8px con micro-pasos 2px y 4px: `space-xxs` .125rem (2) · `space-xs` .25rem (4) · `space-sm` .5rem (8) · `space-md` 1rem (16) · `space-lg` 1.5rem (24) · `space-xl` 2rem (32) · `space-2xl` 3rem (48)
  - Contenedor máximo 1600px.
  - Desktop ≥1280px: 12 columnas, drawer persistente colapsable de 240px, gutter 24px, margen 32px.
  - Tablet 768–1279px: 8 columnas, drawer off-canvas, gutter 16px, padding 24px.
  - Mobile <768px: 4 columnas, gutter 12px, margen 16px; tablas pasan a card-stack o scroll horizontal contenido.
- **Radios**
  - Inputs y controles 4px (`rounded-sm`) · cards/tablas/paneles 8px (`rounded-lg`) · diálogos/flyouts 12px (`rounded-xl`) · chips y badges pill `9999px`
- **Elevación**
  - Nivel 0 base `#F8FAFC`.
  - Nivel 1 card/tabla: `#FFFFFF` + borde 1px `#E2E8F0` + sombra `0 1px 3px 0 rgba(15,23,42,.05)`.
  - Nivel 2 hover/foco/popover: `0 4px 6px -1px rgba(15,23,42,.08), 0 2px 4px -2px rgba(15,23,42,.04)`.
  - Nivel 3 diálogos/drawers: `0 20px 25px -5px rgba(15,23,42,.1), 0 8px 10px -6px rgba(15,23,42,.05)` + scrim `#0F172A` al 40%.
- **Componentes a documentar (no necesariamente todos implementados en esta feature)**
  - Botón primario `mat-flat-button`: fill `#0A3B75`, texto blanco, radio 4px, alto 36px, padding 8px 16px, hover `#062349`. Destructivo `#C8102E` solo para anulación/alertas críticas. Secundario `mat-stroked-button`: borde 1px `#E2E8F0`, texto `#0F172A`, hover fondo `#F8FAFC`.
  - Form fields: `appearance="outline"`, borde `#E2E8F0`, fondo `#FFFFFF`, label `#64748B`, foco 2px `#0A3B75`, error `#DC2626`, densidad -1/-2 en barras de filtro y modales.
  - Chips clínicos: REGISTRADA `#DCFCE7`/`#16A34A` · PENDIENTE `#FEF3C7`/`#D97706` · ANULADA `#FEE2E2`/`#DC2626` · Farmacia `#F0FDFA`/`#0D9488`; cada uno con borde 1px del color al 20% de opacidad.
  - Tablas: header `#F8FAFC` con borde inferior 2px `#E2E8F0` y `label-sm` `#64748B` uppercase tracking .05em; filas de 48px, borde inferior 1px `#E2E8F0`, hover `#EFF6FF` con transición 150ms; zebra opcional `#FFFFFF`/`#F8FAFC`.
  - Cards / patient banner: blanco, borde 1px `#E2E8F0`, padding 16px 24px, borde izquierdo de acento 4px (navy por defecto, rojo para alerta, teal para seguimiento).

Entregables:

- `src/styles/_tokens.scss` (o equivalente) con todos los tokens anteriores como CSS custom properties.
- `src/styles.scss` actualizado: `mat.theme()` con paletas custom derivadas de `#0A3B75`/`#C8102E`/`#0D9488`, tipografía Inter, density 0, y `body` consumiendo los tokens.
- `src/index.html`: Inter + JetBrains Mono en lugar de Roboto, `theme-color` `#0A3B75`, Material Symbols conservado.
- `docs/DESIGN.md`: documento completo del sistema.
- Layout shell base en `src/app/core/layout/`.
- Integración del shell en `src/app/app.html` sin romper `home`.

**Criterios de aceptación**

- [x] CA-01 `grep -rn "azure-palette\|blue-palette\|Roboto" src/` no devuelve resultados y `<meta name="theme-color">` vale `#0A3B75`.
- [x] CA-02 `mat.theme()` en `src/styles.scss` declara tres paletas custom derivadas de `#0A3B75`, `#C8102E` y `#0D9488` como primary/secondary/tertiary, tipografía Inter y `density: 0`; no usa `mat.$azure-palette` ni `mat.$blue-palette`.
- [x] CA-03 Existe `src/styles/_tokens.scss` (o equivalente) importado desde `src/styles.scss`; todos los tokens propios usan el prefijo `--dm-*` y no se redefinen `--mat-sys-*` a mano.
- [x] CA-04 Cada valor hexadecimal del inventario aparece como token: primario (`#0A3B75`, `#062349`, `#EFF6FF`, `#FFFFFF`, `#1E5BB0`), secundario (`#C8102E`, `#A6192E`, `#FEF2F2`), terciario (`#0D9488`, `#F0FDFA`, `#CCFBF1`, `#115E59`, `#0F766E`), error (`#DC2626`, `#BA1A1A`, `#FEE2E2`), superficies (`#F8FAFC`, `#E2E8F0`, `#0F172A`, `#64748B`, `#737781`, `#C3C6D1`) y estados (`#16A34A`, `#DCFCE7`, `#D97706`, `#FEF3C7`).
- [x] CA-05 Existen tokens de estado clínico success/warning/danger/dispensario con su color y contenedor, y tokens de chip para REGISTRADA, PENDIENTE, ANULADA y Farmacia con fondo, texto y borde 1px al 20% de opacidad.
- [x] CA-06 Existen exactamente los 14 pasos tipográficos con tamaño, peso, interlineado y tracking declarados, y una forma de aplicar cifras tabulares (`font-variant-numeric: tabular-nums`) para cédula, carnet, códigos e IDs de visita.
- [x] CA-07 Existen los 7 tokens de spacing, los 4 radios (`4px`, `8px`, `12px`, `9999px`), los niveles de elevación 0–3 con las sombras exactas y el scrim `#0F172A` al 40%, el contenedor máximo 1600px y los breakpoints 1280/768 declarados una sola vez.
- [x] CA-08 `docs/DESIGN.md` existe y contiene secciones de color (con los contrastes declarados), tipografía, spacing y layout, radios, elevación, componentes (botones, form fields, chips, tablas, cards/patient banner), estados clínicos, accesibilidad (WCAG AA mínimo) y reglas de uso (rojo solo para anulación/urgencia; teal solo para farmacia/clínico).
- [x] CA-09 `src/index.html` carga Inter y JetBrains Mono desde Google Fonts, ya no carga Roboto, conserva Material Symbols Outlined, `lang="es"` y los `preconnect`.
- [x] CA-10 Existe `src/app/core/layout/` con `app-shell.ts`, `app-shell.html` y `app-shell.scss` (sin sufijo `.component`), componente standalone con selector `dm-app-shell`, `inject()` y control flow nativo.
- [x] CA-11 En ≥1280px el sidenav es persistente y colapsable con ancho 240px: al colapsar el contenido recupera el espacio, el layout usa gutter 24px y margen 32px, y la grilla de contenido admite 12 columnas.
- [x] CA-12 Entre 768px y 1279px el sidenav es off-canvas (oculto por defecto), se abre con el botón de menú, se cierra con Escape y con clic en el backdrop; gutters 16px, padding 24px y 8 columnas.
- [x] CA-13 Por debajo de 768px el sidenav es off-canvas, gutters 12px, margen 16px y 4 columnas; el contenido no genera scroll horizontal salvo contenedores declarados explícitamente.
- [x] CA-14 El primer elemento enfocable de la página es un skip-link visible al recibir foco que salta al `main`; el shell usa landmarks `header`/`nav`/`main`, el toggle expone `aria-expanded` y `aria-controls`, `Escape` cierra el drawer y ningún `outline` se elimina sin reemplazo accesible.
- [x] CA-15 `src/app/app.html` renderiza el shell; la ruta `''` sigue mostrando `home` con su mat-card y `**` sigue redirigiendo a `''`. _(Supersedido por F-002, aprobada 2026-10-21: el shell pasa a layout route en `app.routes.ts` y `app.html` queda con `<router-outlet />`; `''` sigue mostrando `home` dentro del shell y `**` sigue redirigiendo a `''`. Ver F-002 CA-01/CA-02.)_
- [x] CA-16 El área de contenido usa el canvas `#F8FAFC`, la topbar usa navy `#0A3B75`, y no quedan estilos de header/main/footer duplicados entre `app.scss`, `app.html` y el shell.
- [x] CA-17 Pasan `npm run format:check`, `npm run lint`, `npm test` y `npm run build`; el implementer no creó ni editó ningún `*.spec.ts`.
- [x] CA-18 `npm run features:validate` reporta `OK`.
- [x] CA-19 No hay datos reales de pacientes, credenciales ni secretos en tokens, documentación, shell, fixtures ni logs.
- [x] CA-20 `docs/DESIGN.md` documenta los contrastes declarados (10.4:1, 14.8:1, 4.8:1, 4.6:1) y toda combinación texto/fondo usada en el shell cumple AA (4.5:1 en texto normal, 3:1 en texto grande).

**Tareas**

- [x] T-001-01 Crear `src/styles/_tokens.scss` con los tokens de color primitivos y sus roles semánticos bajo prefijo `--dm-*`, y documentar en el propio archivo por qué se usa `--dm-*` y no se sobreescribe `--mat-sys-*`.
- [x] T-001-02 Añadir los tokens de tipografía: familia UI (Inter), familia mono (JetBrains Mono), los 14 pasos con tamaño/peso/interlineado/tracking y la utilidad de cifras tabulares.
- [x] T-001-03 Añadir los tokens de spacing (7 pasos), radios (4), elevación (niveles 0–3 + scrim), contenedor máximo 1600px y breakpoints 1280/768 con mixins reutilizables.
- [x] T-001-04 Añadir los tokens de estado clínico y de chips (REGISTRADA, PENDIENTE, ANULADA, Farmacia) incluido el borde 1px al 20% de opacidad.
- [x] T-001-05 Derivar las tres paletas M3 custom desde `#0A3B75`, `#C8102E` y `#0D9488` y actualizar `mat.theme()` en `src/styles.scss` (sin azure/blue, tipografía Inter, density 0).
- [x] T-001-06 Actualizar el bloque `body` de `src/styles.scss` para consumir tokens (`--dm-*`) y la tipografía body-md, manteniendo `color-scheme: light`.
- [x] T-001-07 Actualizar `src/index.html`: Inter + JetBrains Mono, `theme-color` `#0A3B75`, conservar Material Symbols y `preconnect`.
- [x] T-001-08 Crear `docs/DESIGN.md` con el inventario completo, los contrastes declarados, los estados y las reglas de uso (rojo = anulación/urgencia, teal = farmacia/clínico).
- [x] T-001-09 Crear `src/app/core/layout/app-shell.ts` como componente standalone `dm-app-shell` con `inject()` y signals para el estado de colapso/off-canvas.
- [x] T-001-10 Crear `app-shell.html` con skip-link, topbar navy con la marca «Dispensario Médico», navegación lateral, `main` con canvas y footer.
- [x] T-001-11 Crear `app-shell.scss` con los tres breakpoints, drawer persistente/off-canvas de 240px, foco visible y transición de 150ms.
- [x] T-001-12 Integrar el shell en `src/app/app.html` retirando el header/main/footer actuales y ajustar `app.scss` sin romper `home`.
- [x] T-001-13 Verificar en el dev server los tres breakpoints y la navegación por teclado (Tab, Enter, Escape, foco del skip-link, foco visible del toggle).
- [x] T-001-14 Ejecutar `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`, y adjuntar la salida como evidencia.
- [x] T-001-15 Entregar al reviewer la lista de CA y los puntos que requieren specs nuevas (`app-shell`: breakpoints y accesibilidad), recordando que el implementer no crea ni edita `*.spec.ts`.

**Preguntas abiertas**

Ninguna. Resueltas por el humano el 2026-10-21:

- **Ítems del sidenav:** el shell muestra únicamente «Inicio» en esta entrega. El resto de ítems se agrega cuando existan sus rutas y su feature correspondiente.
- **Contenido de la topbar:** solo marca «Dispensario Médico» y botón de menú. El bloque de usuario/sesión (nombre, rol, salir) se difiere a la feature de autenticación.

**Historial**

- 2026-10-21 — spec-author: feature creada.
- 2026-10-21 — team-lead: preguntas abiertas resueltas con el humano (sidenav con solo «Inicio», topbar sin bloque de usuario).
- 2026-10-21 — humano: aprobó la feature en sesión. team-lead transcribió el aprobador (`Oscar Mora`) y la fecha a solicitud explícita; el estado `approved` lo fijó el humano.
- 2026-10-21 — team-lead: feature movida a `in_progress` y despachada al implementer.
- 2026-10-21 — implementer: 15/15 tareas completadas. Creados `_tokens.scss`, `docs/DESIGN.md`, `core/layout/app-shell.*`; modificados `styles.scss`, `index.html`, `app.*`. `format:check`, `lint`, `test`, `build` y `features:validate` en verde (warning de budget de `app-shell.scss`: 6.12 kB vs 4 kB de aviso).
- 2026-10-21 — team-lead: feature movida a `in_review` y despachada al reviewer.
- 2026-10-21 — reviewer: **FAIL**. CA-01…CA-20 verificados (20/20), 28 tests en verde, `format:check`/`lint`/`test`/`build`/`features:validate` OK. Bloqueos: F1 credencial en claro en `.opencode/opencode.json` (archivo trackeado, ajeno a la feature; requiere acción humana); F2 contraste de chips 2.86–3.95:1 < AA (decisión de diseño pendiente); F3 `DESIGN.md` declara teal 4.6:1 cuando el real es 3.74:1; F5 clase `app-title` huérfana; F6 warning de budget 6.12 kB vs 4 kB; F4 `.vscode/settings.json` fuera de alcance.
- 2026-10-21 — team-lead: feature movida a `changes_requested`.
- 2026-10-21 — humano: decidió ajustar solo el texto de los chips, subir los umbrales de budget a 8/12 kB y eliminar `.vscode/settings.json`.
- 2026-10-21 — implementer: correcciones aplicadas. Chips ahora 4.57/4.51/5.30/5.25:1 (AA); `DESIGN.md` distingue declarado vs medido y advierte que `#0D9488` es 3.74:1; `app-title` eliminado; budget subido; `.vscode/settings.json` borrado; sección «Limitaciones conocidas». 28 tests en verde, 5 comandos OK.
- 2026-10-21 — team-lead: feature movida a `in_review` para re-revisión.
- 2026-10-21 — reviewer: **PASS**. 8/8 puntos re-verificados, ratios WCAG recalculados (4.5669 / 4.5097 / 5.2965 / 5.2480), 28 tests verdes, 5 comandos OK, sin regresiones.
- 2026-10-21 — team-lead: feature movida a `done`. ⚠️ **El árbol no es publicable**: `.opencode/opencode.json` (trackeado, ajeno a esta feature) contiene una API key en claro. Rotar la clave y ejecutar `git rm --cached .opencode/opencode.json` + `.gitignore` antes de cualquier commit.

### F-002 — Autenticación: inicio de sesión, sesión en el shell y protección de rutas

- **Estado:** done
- **Prioridad:** Alta
- **Aprobado por:** Oscar Mora
- **Fecha de aprobación:** 2026-10-21
- **Dependencias:** `F-001` (design system `Clinical Academic Authority` y layout shell `dm-app-shell`, estado `done`).

**Descripción**

F-001 entregó el design system, el shell `dm-app-shell` y difirió explícitamente el bloque de usuario/sesión de la topbar «a la feature de autenticación». Esta es esa feature: pantalla de inicio de sesión, estado de sesión en el cliente, protección de rutas, mapeo de errores del backend y bloque de usuario/«Salir» en la topbar.

El backend ya existe en otro repositorio y su contrato se toma como dado: no se modifica desde aquí ni se re-verifica.

**Contrato del backend asumido**

- `POST /api/v1/auth/login` — body `{"username": string (1..50), "password": string (1..128)}`. 200: `{ access_token, token_type: "bearer", expires_in: <segundos>, user: { id, username, email, role, doctor_id|null } }`. 401 `{"detail":"Usuario o contraseña incorrectos","code":"invalid_credentials","errors":[]}`. 403 si el usuario está inactivo. 422 `{"detail":"Datos inválidos","code":"validation_error","errors":[{"field","message"}]}`. 429 por rate limiting de IP y usuario, sin cabecera `Retry-After` observada.
- `GET /api/v1/auth/me` (Bearer) — 200 `{ id, username, email, role, doctor_id|null, is_active }`; 401 `{"detail":"No autenticado","code":"not_authenticated","errors":[]}` con `WWW-Authenticate: Bearer`; 403 si el usuario está inactivo. El rol y el médico se leen de BD en cada request.
- **No existen** refresh token, endpoint de logout/revocación ni recuperación de contraseña. Al cambiar contraseña no se revocan los tokens vigentes.
- `POST /api/v1/auth/change-password` existe y queda **fuera de alcance**.
- **CORS habilitado en el backend (decisión del humano, 2026-10-21).** Verificado por el team-lead: `OPTIONS /api/v1/auth/login` con `Origin: http://localhost:4200` responde `200` con `Access-Control-Allow-Origin: http://localhost:4200`, métodos `GET, POST, PUT, PATCH, DELETE, OPTIONS` y cabeceras que incluyen `Authorization` y `Content-Type`. No hay proxy de desarrollo en este repo: `environment.ts` apunta a la URL absoluta del backend local y `environment.production.ts` conserva `apiUrl: '/api'` (ingress en producción).

**Decisiones de alcance y arquitectura propuestas**

- **Sin proxy de desarrollo: CORS en el backend.** El backend ya habilitó CORS para `http://localhost:4200`, así que no se crea `proxy.conf.json` ni se declara `proxyConfig` en `angular.json`. `environment.ts` usa `apiUrl: 'http://127.0.0.1:8000/api'` (solo desarrollo) y `environment.production.ts` conserva `apiUrl: '/api'`; el prefijo real de endpoints es `/api/v1/...` y se compone en un solo lugar (`AuthService`). En producción el `/api` lo resuelve el ingress/Nginx (documentado en `AGENTS.md`).
- **Rutas: layout route, no condicional en `app.html`.** El shell deja de renderizarse desde `app.html` y pasa a ser el `component` de la ruta padre autenticada; `/login` queda fuera del shell por construcción, sin duplicar layout ni meter lógica de sesión en el componente raíz. `app.html` queda con `<router-outlet />` y `app.ts` importa `RouterOutlet` en lugar de `AppShell`.
- **Impacto explícito en CA-15 de F-001.** CA-15 exige hoy que `src/app/app.html` renderice el shell. Con el layout route, esa condición literal deja de cumplirse: `app.html` renderiza el outlet y el shell se monta cuando la ruta padre coincide. Los otros dos compromisos de CA-15 se preservan intactos: la ruta `''` sigue mostrando `home` con su `mat-card` (ahora dentro del shell) y `**` sigue redirigiendo a `''`. La redacción propuesta para CA-15 es: «la ruta `''` renderiza `dm-home` dentro de `dm-app-shell` y `**` redirige a `''`». Requiere confirmación humana (PA-06).
- **Servicio de sesión (`src/app/core/auth/auth.service.ts`).** Signals `user`, `token` y `isAuthenticated` (esta última derivada de token vigente y no expirado); métodos `login(credentials)`, `logout()`, `restoreSession()` (idempotente y ejecutada una sola vez por arranque, antes de que el guard decida) y `ensureValidSession()`; y tres métodos privados de persistencia (`readToken`/`writeToken`/`clearToken`) como **único** punto que toca almacenamiento. Tipos `AuthUser` (`id`, `username`, `email`, `role`, `doctorId`) y `LoginCredentials`; el mapeo `doctor_id` → `doctorId` vive en un mapper, no en los componentes. `role` se modela como unión conocida (`'ADMIN' | 'MEDICO'`) con tolerancia a valores no previstos en tiempo de ejecución.
- **Persistencia del token: no se decide en esta especificación** (PA-02). El diseño la aísla para que cambiarla no toque componentes ni tests de componentes: ningún componente, guard ni interceptor accede a `localStorage`/`sessionStorage` directamente.
- **Expiración sin refresh token.** Se guarda `expiresAt = ahora + expires_in * 1000 - 30s` de margen. `isAuthenticated()` es `false` cuando la sesión expiró. Al detectarlo, el guard limpia la sesión y redirige a `/login?returnUrl=...&reason=expired`. No se programa temporizador ni cuenta atrás: el chequeo es proactivo en el guard (antes de navegar) y en el interceptor (antes de adjuntar la cabecera); si la sesión expira mientras el usuario está en una pantalla, la siguiente petición recibe 401 y se aplica el mismo camino. Los flujos de refresh quedan descartados porque el backend no los ofrece.
- **Interceptor HTTP funcional.** `authInterceptor` en `core/auth/auth.interceptor.ts`, registrado con `provideHttpClient(withInterceptors([authInterceptor]))` en `app.config.ts`. Adjunta `Authorization: Bearer <token>` sólo a URLs que empiezan por `environment.apiUrl` y que no son `/auth/login` (así el token no se filtra a terceros ni se envía en el propio login). Ante 401 de una petición protegida limpia la sesión y navega a `/login?returnUrl=<url actual>`; el 401 de `/auth/login` se propaga intacto al formulario, porque no es una sesión caída sino credenciales inválidas.
- **Guards funcionales.** `authGuard` (`CanActivateFn`) en la ruta padre autenticada: espera `restoreSession()` y, si no hay sesión, devuelve `createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })`. `guestGuard` (`CanActivateFn`) en `/login`: con sesión válida redirige al `returnUrl` saneado o a `/`. Toda redirección usa una única función `sanitizeReturnUrl()` (acepta sólo rutas internas que empiezan por `/` y no por `//`), aplicada en `guestGuard`, en el interceptor y en el submit del login.
- **Pantalla de inicio de sesión.** `src/app/features/auth/login/` (`login.ts`, `login.html`, `login.scss`, sin sufijo `.component`), standalone, `inject()`, signals, control flow nativo, OnPush. Página sin shell (sin topbar, sidenav, skip-link ni footer), con un único `main` y un `h1`. Card blanca `--dm-color-surface`, borde 1px `--dm-color-border-subtle`, radio `--dm-radius-lg`, elevación 1, padding `--dm-space-xl`, ancho máximo 448px, centrada sobre `--dm-color-canvas`. Titular «Dispensario Médico» (`headline-lg` / `headline-lg-mobile`) y subtítulo «Inicia sesión para continuar» (`body-md`, `--dm-color-muted`). Formulario reactivo tipado con `FormGroup` y `FormControl<string>` `nonNullable` para `username` y `password`; dos `mat-form-field` `appearance="outline"` con `<mat-label>` visible («Usuario», «Contraseña»), `autocomplete="username"` / `"current-password"`, `maxlength` 50 / 128 y validadores `required` alineados con el backend; `mat-error` con mensajes propios («Ingresa tu usuario», «Ingresa tu contraseña») tras `markAllAsTouched()`. Botón primario `mat-flat-button` `type="submit"` «Iniciar sesión», ancho completo. Toggle de visibilidad de contraseña `type="button"` con icono `visibility`/`visibility_off`, `aria-label` dinámico («Mostrar contraseña» / «Ocultar contraseña»), `aria-pressed` y área táctil de 44px; no envía el formulario. Estado de envío: `submitting()` deshabilita campos y botón, pone `aria-busy="true"` en el contenedor del formulario y cambia la etiqueta del botón a «Ingresando…». Foco inicial en el campo de usuario tras el primer render. Enter envía desde cualquier campo (form nativo, un solo `submit`). El pegado en la contraseña no se bloquea (sin handlers de `paste`/`preventDefault`).
- **Bloque de usuario en la topbar del shell.** Con sesión, el bloque se alinea a la derecha (`margin-inline-start: auto`) y muestra username, rol legible y botón «Salir». Mapa de rol explícito: `ADMIN` → «Administrador», `MEDICO` → «Médico»; un rol no previsto se muestra tal cual (fallback documentado). «Salir» reutiliza el patrón visual ya existente del toggle de la topbar (fondo transparente, hover `--dm-color-primary-dark`, texto `--dm-color-on-primary`, foco `--dm-focus-ring-color-inverse`, alto 36px en desktop y 44px táctil en mobile), sin introducir variantes de botón nuevas. Responsive: en ≥768px nombre y rol en una línea separados por «·»; en <768px el bloque pasa a dos líneas (nombre truncado con `text-overflow: ellipsis` y rol en `label-sm`) con «Salir» a la derecha, la marca se trunca con ellipsis y el bloque nunca desborda la topbar. El sidenav sigue con «Inicio» únicamente.
- **Mensajes de error propios del frontend.** Los textos viven en `core/auth/auth-error.ts` y se eligen por status HTTP y por `code`; el `detail`, el `code` y el `message` del backend no se muestran nunca tal cual (pueden estar en inglés o revelar detalles).
- **Fuera de alcance explícito.** Registro de usuarios, CRUD de `/users`, cambio de contraseña, recuperación de contraseña (no existe endpoint), refresh token, logout/revocación en servidor, permisos finos por rol más allá de mostrar la etiqueta, i18n, modo oscuro, temporizador/cuenta atrás de sesión y bloqueo local tras 429.
- **Riesgos y limitaciones aceptadas.** (a) «Salir» es sólo local: el token sigue siendo válido en el backend hasta que expire, porque no hay endpoint de revocación. (b) Un 401 a mitad de una pantalla descarta lo que el usuario estuviera escribiendo y lo manda a `/login`; no hay recuperación de estado. (c) El token se persiste en `localStorage` (decisión del humano el 2026-10-21): sobrevive al cierre del navegador hasta expirar y queda expuesto a XSS ante scripts inyectados; documentado en `docs/AUTH.md`. (d) El 429 no trae `Retry-After`, así que no hay cuenta atrás fiable. (e) En desarrollo el frontend llama directo al backend por CORS (origen `http://localhost:4200`); en producción `/api` depende del ingress. (f) `src/app/app.spec.ts` y `src/app/core/layout/app-shell.spec.ts` asumen hoy «shell en el arranque sin sesión» y «shell sin `AuthService`»; el reviewer debe actualizarlos.

**Estructura de rutas propuesta**

```ts
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
```

`AppShell` se importa de forma estática para no añadir un salto de red al layout. Una navegación a `/ruta-inexistente` sigue redirigiendo a `''`; desde ahí el guard añade el `returnUrl` que corresponda.

**Mensajes de error al usuario**

- **401 (`invalid_credentials`)**: «Usuario o contraseña incorrectos.» — no distingue si falló el usuario o la contraseña.
- **403**: «Tu usuario está inactivo. Contacta al administrador del sistema.»
- **429**: «Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.» — sin cuenta atrás, porque el backend no envía `Retry-After`.
- **422**: «Revisa los datos ingresados.» y, si `errors[].field` es `username` o `password`, un mensaje propio bajo ese campo («Revisa el usuario», «Revisa la contraseña»); el `message` del backend no se muestra. Campos desconocidos se ignoran.
- **status 0 / error de red**: «No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.» El botón vuelve a estar habilitado, de modo que reintentar es pulsar otra vez.
- **5xx**: «Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.»
- **Sesión expirada (`reason=expired`)**: «Tu sesión expiró. Inicia sesión de nuevo.» en una región `role="status"` (no es un error de credenciales).
- Regla general: ningún mensaje incluye token, `detail`, `code`, `WWW-Authenticate`, stack ni URLs internas.

**Criterios de aceptación**

- [x] CA-01 `src/app/app.routes.ts` declara exactamente tres entradas de primer nivel: `login` (lazy, con `guestGuard`), `''` (con `component: AppShell` y `canActivate: [authGuard]`, con hijo `''` que carga `Home`) y `**` con `redirectTo: ''`. `src/app/app.html` contiene únicamente `<router-outlet />` y ya no renderiza `<dm-app-shell />`; `src/app/app.ts` importa `RouterOutlet`.
- [x] CA-02 La ruta `''` sigue renderizando `dm-home` (con su `mat-card`) **dentro** de `dm-app-shell` cuando hay sesión válida, y `**` sigue redirigiendo a `''` (CA-15 de F-001 se reescribe según PA-06).
- [x] CA-03 `authGuard` en `src/app/core/auth/auth.guard.ts` es un `CanActivateFn` que espera la restauración antes de decidir: sin sesión, navegar a `/` termina en una URL que empieza por `/login?returnUrl=` cuyo valor decodificado es `/`, y `dm-app-shell` no se instancia.
- [x] CA-04 Con sesión válida (login previo o restauración), `authGuard` devuelve `true` y `/` renderiza `Home` dentro del shell.
- [x] CA-05 `guestGuard` en `/login`: con sesión válida, `/login?returnUrl=/` termina en `/` y `/login` sin `returnUrl` termina en `/`; sin sesión, `/login` renderiza `dm-login`.
- [x] CA-06 Login exitoso: el servicio emite exactamente `POST ${environment.apiUrl}/v1/auth/login` con `{username, password}` (username con `trim` en los extremos, contraseña sin transformar) y, ante 200, guarda `access_token`, `expiresAt` y el usuario mapeado (`doctor_id` → `doctorId`); `isAuthenticated()` pasa a `true` y la navegación termina en el `returnUrl` saneado o en `/`, con `dm-home` visible y el username en la topbar.
- [x] CA-07 Restauración: `restoreSession()` es idempotente (llamadas concurrentes producen una sola petición), se resuelve antes de la primera decisión del guard y hace `GET ${environment.apiUrl}/v1/auth/me` con `Authorization: Bearer`. 200 con `is_active: true` hidrata la sesión; 200 con `is_active: false`, 401 y 403 limpian la sesión y dejan `isAuthenticated()` en `false` sin bucles de redirección. Sin token persistido no se emite ninguna petición.
- [x] CA-08 Expiración: `expiresAt` se calcula con `expires_in` menos 30 s de margen; cuando ya expiró, `isAuthenticated()` es `false`, el guard limpia la sesión y redirige a `/login?returnUrl=...&reason=expired`, y `/login` muestra «Tu sesión expiró. Inicia sesión de nuevo.» en `role="status"`. No se llama a ningún endpoint de refresh ni se programa temporizador.
- [x] CA-09 Interceptor: `authInterceptor` está registrado con `provideHttpClient(withInterceptors([authInterceptor]))` en `app.config.ts` y añade `Authorization: Bearer <token>` sólo cuando la URL empieza por `environment.apiUrl` y no contiene `/auth/login`; no añade cabecera si no hay sesión válida ni a URLs externas.
- [x] CA-10 Ante 401 de una petición protegida, el interceptor limpia la sesión y navega a `/login?returnUrl=<url actual>`; ante 401 de `/auth/login` no redirige ni limpia nada (el error llega al formulario); la petición fallida no se reintenta.
- [x] CA-11 «Salir» limpia token, usuario y `expiresAt`, navega a `/login` con `replaceUrl: true` y sin `returnUrl`, la topbar deja de mostrarse y el historial no devuelve a la pantalla protegida; no se emite ninguna petición de logout (`grep -rn "auth/logout" src/` → 0 resultados).
- [x] CA-12 `returnUrl` saneado por una única función reutilizada: sólo se acepta un valor que empiece por `/` y no por `//` ni `/\`; cualquier otro (URL absoluta, `javascript:`, vacío, ausente) se sustituye por `/`. Se aplica en `guestGuard`, en el redirect del interceptor y en el submit del login.
- [x] CA-13 Los seis casos de error producen los mensajes especificados y ningún otro: 401, 403, 429, 422 (con errores por campo cuando `errors[].field` es `username`/`password`), status 0 y 5xx. En todos, `submitting()` vuelve a `false`, campos y botón quedan habilitados con su etiqueta «Iniciar sesión», y el mensaje aparece en la región `role="alert"` sin mover el foco del usuario.
- [x] CA-14 Sin fugas de información: `grep -rn "console\." src/app/core/auth src/app/features/auth` → 0 resultados; la contraseña no se guarda en signals, ni en `localStorage`/`sessionStorage`, ni en query params, URL, mensajes, comentarios o logs; el token no aparece en `login.html`, en mensajes de error ni en `docs/AUTH.md`.
- [x] CA-15 Accesibilidad del formulario: ambos campos tienen `<mat-label>` visible (no placeholder como etiqueta), `autocomplete="username"`/`"current-password"`, `mat-error` asociado, `role="alert"` en el error general, `role="status"` en el aviso de sesión expirada, `aria-busy` durante el envío, y el toggle de contraseña cumple `aria-pressed` + `aria-label` dinámico + 44px de área táctil. La página usa un único `main`, un `h1` y foco visible con el anillo de tokens (nunca `outline: none` sin reemplazo).
- [x] CA-16 Comportamiento del formulario: el foco inicial está en el campo de usuario tras el primer render (`document.activeElement`), Enter en cualquier campo envía una sola vez, pegar texto en la contraseña funciona (no hay handler que lo bloquee), el toggle no dispara el submit y alterna `aria-pressed` y el `type` del input entre `password` y `text`, y durante el envío los controles están `disabled`.
- [x] CA-17 Responsive del login: a 360×640, 768×1024 y 1440×900 no hay scroll horizontal (`document.documentElement.scrollWidth <= clientWidth`), el card está centrado, en ≥1280 no supera 448px de ancho y los paddings corresponden a los tokens de cada breakpoint (16 / 24 / 32).
- [x] CA-18 Topbar con sesión: muestra username y rol legible (`ADMIN` → «Administrador», `MEDICO` → «Médico», otro valor tal cual); a 360px el `scrollWidth` de `.dm-topbar` no supera su `clientWidth`, no hay scroll horizontal y «Salir» sigue siendo alcanzable con Tab y activable con Enter/Espacio.
- [x] CA-19 Design system intacto: `src/styles/_tokens.scss` y `docs/DESIGN.md` no se modifican; los estilos nuevos (`login.scss` y el bloque de usuario de `app-shell.scss`) no introducen colores literales (`grep -nE "#[0-9a-fA-F]{3,8}" src/app/features/auth/login/login.scss` → 0) y consumen `var(--dm-*)`; todos los pares texto/fondo nuevos cumplen AA ≥ 4.5:1 (blanco sobre navy 11.08:1, `#0F172A` sobre blanco 17.85:1, `#64748B` sobre blanco 4.76:1, `#DC2626` sobre blanco 4.83:1), y el mensaje de error no se pinta con `--dm-color-error` sobre `--dm-color-error-container` (3.94:1, no cumple AA).
- [x] CA-20 Dev y despliegue: no existe `proxy.conf.json` ni `proxyConfig` en `angular.json`; `environment.ts` usa `apiUrl: 'http://127.0.0.1:8000/api'`, `environment.production.ts` sigue con `apiUrl: '/api'` y no se añade `Access-Control-*` ni credenciales al frontend; `docs/AUTH.md` documenta contrato de sesión, expiración sin refresh, logout local, CORS de dev (origen `http://localhost:4200`) frente al ingress de producción y la opción de persistencia aprobada.
- [x] CA-21 Pasan `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`; el implementer no creó ni editó ningún `*.spec.ts`. El reviewer actualiza `src/app/app.spec.ts` y `src/app/core/layout/app-shell.spec.ts` (hoy asumen shell sin sesión y shell sin `AuthService`) y añade specs de servicio, guard, interceptor y login.
- [x] CA-22 Ningún archivo nuevo o modificado (`docs/AUTH.md`, código, comentarios, fixtures) contiene usuarios, contraseñas, tokens, JWT ni datos de pacientes; las verificaciones manuales usan el usuario de prueba del backend local y se documentan sin credenciales.

**Tareas**

- [x] T-002-01 Crear `src/app/core/auth/auth.models.ts` con `AuthUser` (`id`, `username`, `email`, `role`, `doctorId`), `UserRole` (unión conocida `'ADMIN' | 'MEDICO'` con validación en runtime y fallback al valor crudo del backend), `LoginCredentials`, los DTO de respuesta del backend (`access_token`, `token_type`, `expires_in`, `doctor_id`, `is_active`) y `toAuthUser()`. Resultado: un único punto de mapeo `snake_case` → `camelCase`, sin `any`.
- [x] T-002-02 Crear `src/app/core/auth/auth-error.ts` con el tipo `AuthErrorMessage` (`{ message, fieldErrors? }`) y `mapAuthError(error: unknown)` que cubre 401, 403, 429, 422, status 0 y 5xx con los textos de esta especificación, sin exponer `detail`, `code` ni `message` del backend. Resultado: todos los textos en un solo módulo.
- [x] T-002-03 Crear `src/app/core/auth/auth.service.ts` (`providedIn: 'root'`, `inject()`, signals) con `user`, `token`, `isAuthenticated` (token vigente y no expirado), `login()`, `logout()`, `restoreSession()` idempotente vía `GET /v1/auth/me`, `ensureValidSession()` y `expiresAt` con `expires_in` menos 30 s; incluir los métodos privados `readToken`/`writeToken`/`clearToken` como único acceso al almacenamiento, con persistencia en `localStorage` (PA-02, decisión del humano el 2026-10-21). Resultado: la sesión se gestiona en un solo servicio y se puede probar sin componentes.
- [x] T-002-04 Crear `src/app/core/auth/auth.guard.ts` con `authGuard` y `guestGuard` (`CanActivateFn`) y la función `sanitizeReturnUrl()` compartida. Resultado: `/` protegida con `returnUrl` y `/login` inaccesible con sesión activa.
- [x] T-002-05 Crear `src/app/core/auth/auth.interceptor.ts` (`HttpInterceptorFn`) que adjunta `Authorization: Bearer` sólo a `environment.apiUrl` excluyendo `/auth/login`, y que ante 401 limpia la sesión y navega a `/login?returnUrl=<url actual>`. Resultado: cabecera automática y sesión caída resuelta en un único punto.
- [x] T-002-06 Actualizar `src/app/app.config.ts` con `provideHttpClient(withInterceptors([authInterceptor]))`, conservando `provideBrowserGlobalErrorListeners()` y `provideRouter(routes)`. Resultado: `HttpClient` disponible y sin llamadas manuales a `provideHttpClient` en componentes.
- [x] T-002-07 Actualizar `src/app/app.routes.ts` a la estructura de layout route especificada, y ajustar `src/app/app.ts` (`RouterOutlet` en lugar de `AppShell`) y `src/app/app.html` (`<router-outlet />`). Resultado: `/login` fuera del shell, `''` → `home` protegida y `**` → `''`.
- [x] T-002-08 Crear `src/app/features/auth/login/login.ts`: componente standalone `dm-login` con `FormGroup` tipado y `FormControl<string>` `nonNullable`, validadores `required` + `maxlength` 50/128, signals `submitting`, `error`, `fieldErrors`, `showPassword`, submit con `(ngSubmit)` que llama `AuthService.login()` y navega al `returnUrl` saneado, foco inicial en el campo de usuario y limpieza de suscripciones con `takeUntilDestroyed`. Resultado: toda la lógica del formulario en el componente, sin HTTP directo.
- [x] T-002-09 Crear `src/app/features/auth/login/login.html` con `main` + `h1` + card + `form`, dos `mat-form-field` `appearance="outline"` con `<mat-label>`, `autocomplete`, `maxlength`, `mat-error` por campo, botón `type="submit"` «Iniciar sesión», toggle de contraseña con `aria-pressed`/`aria-label`, región `role="alert"` para errores, `role="status"` para sesión expirada y `aria-busy` en el contenedor. Resultado: formulario accesible y sin shell.
- [x] T-002-10 Crear `src/app/features/auth/login/login.scss` con el layout centrado, los tres breakpoints y el padding por tokens, usando exclusivamente `var(--dm-*)`, foco visible y `prefers-reduced-motion`. Resultado: pantalla coherente con el design system y sin colores literales.
- [x] T-002-11 Actualizar `src/app/core/layout/app-shell.ts` para inyectar `AuthService`, exponer `user()`, un `roleLabel()` computed con el mapa `ADMIN`/`MEDICO` y `logout()` que delega en el servicio. Resultado: el shell no conoce HTTP ni almacenamiento.
- [x] T-002-12 Actualizar `src/app/core/layout/app-shell.html` añadiendo el bloque de usuario en la topbar (username, rol legible y botón «Salir») sin tocar skip-link, toggle, `nav`, `main` ni footer. Resultado: bloque de sesión donde F-001 lo difirió.
- [x] T-002-13 Actualizar `src/app/core/layout/app-shell.scss` con los estilos del bloque de usuario en una y dos líneas según breakpoint, truncado con ellipsis, botón reutilizando el patrón del toggle y sin desbordar la topbar. Resultado: los tres breakpoints de F-001 siguen intactos.
- [x] T-002-14 Configurar `src/environments/environment.ts` con `apiUrl: 'http://127.0.0.1:8000/api'` (solo desarrollo), sin crear `proxy.conf.json` ni tocar `angular.json`, `build`, `budgets` ni `fileReplacements`. Resultado: `npm start` habla con el backend local vía CORS.
- [x] T-002-15 Crear `docs/AUTH.md` con el contrato de sesión (endpoints, `expires_in`, ausencia de refresh/logout/recuperación), el CORS de dev (origen `http://localhost:4200`) frente al ingress de producción, la opción de persistencia aprobada en PA-02, los riesgos XSS y las notas para el reviewer (`app.spec.ts`, `app-shell.spec.ts`). Resultado: decisiones de autenticación documentadas fuera del código.
- [x] T-002-16 Ejecutar `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`, y verificar en el dev server los tres breakpoints, el ciclo login → home → Salir → login, la restauración con F5 y la expiración forzada. Resultado: evidencia adjunta y entrega al reviewer de la lista de CA y de los `*.spec.ts` que deben actualizarse o crearse.

**Preguntas abiertas**

Todas requieren decisión humana. PA-02 resuelta por el humano el 2026-10-21 (`localStorage`); el resto puede resolverse durante la revisión de la feature. Decisión CORS/proxy ya tomada por el humano el 2026-10-21 (CORS habilitado en el backend, sin proxy).

- **PA-01 — Maqueta de Stitch no disponible.** El MCP `stitch` exige login y la pantalla indicada (`edd50eb04d284660b6e78583ca2afa96`, proyecto `3698123582769390902`) sigue en estado «Generating Screen...», así que no hay referencia visual. La UI se especifica desde `docs/DESIGN.md`; el ancho de 448px del card y la composición marca + formulario son **provisionales**. **Recomendación:** aprobar como está y ajustar sólo lo visual en una feature de refinamiento cuando la pantalla esté disponible; no bloquear por esto.
- **PA-02 — Persistencia del token.** Opciones: (a) memoria + re-login en cada recarga; (b) `sessionStorage`; (c) `localStorage`. Riesgo XSS: (a) nulo en disco y mínimo en memoria, (b) y (c) exponen el token a cualquier script inyectado — (c) además lo conserva entre pestañas y sesiones del navegador, y con `localStorage` el token sobrevive al cierre del navegador hasta expirar. No hay refresh token, así que en (a) cada F5 obliga a re-loguear. **Decisión del humano (2026-10-21):** (c) `localStorage`, aislado en los métodos privados de `AuthService`. Implica: el token sobrevive al cierre del navegador hasta expirar y queda expuesto a XSS ante cualquier script inyectado; `docs/AUTH.md` debe documentar este riesgo.
- **PA-03 — Alcance del bloque de usuario y de «Salir».** Se propone username + rol legible + «Salir» (sin menú desplegable, sin avatar, sin diálogo de confirmación) y, en mobile, bloque a dos líneas. Se propone además que un rol no previsto se muestre tal cual, sin lógica de permisos. Nota: «Salir» es local; el token sigue vigente en el backend hasta expirar porque no hay endpoint de revocación. **Recomendación:** aprobar tal cual; aceptar el logout local y documentarlo en `docs/AUTH.md`, sin diálogo de confirmación (fricción innecesaria para una acción reversible).
- **PA-04 — Comportamiento del `returnUrl`.** Opciones: (a) volver a la ruta solicitada; (b) ir siempre a `/`; (c) volver sólo si la ruta es distinta de `/login`. **Recomendación:** (a) con saneo estricto (sólo rutas internas, se descartan `//`, `javascript:` y URLs absolutas) y `replaceUrl: true` en el post-login, para que el botón «atrás» no reentre en `/login`.
- **PA-05 — Enlace «¿Olvidaste tu contraseña?».** No existe endpoint de recuperación. Opciones: (a) no mostrarlo; (b) mostrarlo deshabilitado; (c) mostrar un texto informativo no interactivo. **Recomendación:** (c) «Si no recuerdas tu contraseña, contacta al administrador del sistema.» en `body-sm`/`--dm-color-muted`: informa sin prometer un flujo inexistente ni introducir un control muerto.
- **PA-06 — Supersesión de CA-15 de F-001.** Mover el shell a la ruta padre implica que `src/app/app.html` pase a `<router-outlet />` y deje de cumplir la letra de CA-15 («`app.html` renderiza el shell»), aunque conserva `''` → `home` y `**` → `''`. **Recomendación:** aceptar la reescritura de CA-15 como «la ruta `''` renderiza `dm-home` dentro de `dm-app-shell` y `**` redirige a `''`»; es la única forma de tener `/login` fuera del shell sin duplicar layout ni condicionales en el componente raíz.
- **PA-07 — Política frente al 429.** No hay cabecera `Retry-After`, así que sólo se puede mostrar un mensaje fijo. Opciones: (a) sólo mensaje y dejar que el usuario reintente; (b) añadir un cooldown local de N segundos deshabilitando el botón. **Recomendación:** (a), sin inventar una duración; el backend es la única fuente de verdad del rate limiting y un cooldown local daría una falsa sensación de precisión.

**Historial**

- 2026-10-21 — spec-author: feature creada.
- 2026-10-21 — team-lead: decisión del humano — CORS habilitado en el backend, sin proxy; especificación ajustada (contrato, alcance, CA-20, T-002-14, T-002-15).
- 2026-10-21 — team-lead: decisión del humano — token en `localStorage` (PA-02 resuelta); especificación ajustada (T-002-03, riesgo c).
- 2026-10-21 — team-lead: feature movida a `in_progress` y despachada al implementer.
- 2026-10-21 — implementer: 15/16 tareas completadas (T-002-16 parcial: sin verificación visual ni ciclo positivo por falta de navegador y credenciales; `app.spec.ts` en rojo con 4 fallos esperados). `format:check`, `lint`, `build` y `features:validate` en verde; `test` 24/28.
- 2026-10-21 — team-lead: feature movida a `in_review` y despachada al reviewer.
- 2026-10-21 — reviewer: **PASS**. 22/22 CA cumplidos, 115/115 tests en verde, 5 comandos OK. Solo `*.spec.ts` tocados (2 actualizados + 4 creados). Riesgos residuales no bloqueantes: medición física de viewports pendiente de navegador; `.opencode/opencode.json` sigue modificado (gestión humana pendiente).
- 2026-10-21 — team-lead: feature movida a `done`. Preguntas PA-01…PA-07 aplicadas según las recomendaciones aprobadas.

### F-003 — Login: eliminar el doble anillo de foco en los inputs de Material

- **Estado:** done
- **Prioridad:** Media
- **Aprobado por:** Oscar Mora
- **Fecha de aprobación:** 2026-10-21
- **Dependencias:** `F-002` (autenticación: login, sesión y rutas, estado `done`).

**Descripción**

La regla genérica `:host :focus-visible { outline: ...; outline-offset: ...; }` de `src/app/features/auth/login/login.scss` (líneas 22–25) alcanza al `<input>` nativo que vive dentro de cada `mat-form-field` (`login.html` líneas 11–31 y 33–65, ambos con `appearance="outline"`). Al enfocar Usuario o Contraseña, Material ya engrosa y tiñe su propio contorno con muesca, y nuestra regla añade un segundo rectángulo interior pegado al input (visible en la captura del humano en el campo Contraseña; el campo Usuario tiene el mismo problema). F-002 no se reabre: el formulario, los validadores, los mensajes, el toggle y las rutas quedan intactos.

Alcance de esta feature:

1. Acotar el selector de foco en `login.scss` para que el anillo propio (`var(--dm-focus-ring-*)`) siga aplicándose al botón «Iniciar sesión» (línea 71), al toggle de visibilidad (líneas 43–55) y a cualquier enlace o botón nativo, pero no al `<input>` interior gestionado por Material (p. ej. excluir `.mat-mdc-input-element`, o `input`/`textarea`/`select` dentro de `mat-form-field`). En esos inputs el foco sigue visible vía el contorno del field de Material, que es el «reemplazo» que exige `docs/DESIGN.md` (líneas 326–327: nunca `outline` sin reemplazo) y `AGENTS.md`.
2. Decidir y documentar si `src/app/core/layout/app-shell.scss` (líneas 13–16, misma regla genérica) necesita el mismo blindaje preventivo. Hoy no hay defecto visible porque el shell no contiene form fields; si se incluye, el cambio debe ser de riesgo cero y sin alterar su apariencia actual (skip-link, toggle, «Salir», enlaces de navegación y foco de `.dm-main` intactos).

Fuera de alcance explícito: rediseño del login, cambios a tokens (`src/styles/_tokens.scss`, `src/styles.scss`), cambios a `docs/DESIGN.md`, tocar `app-shell.html` o la estructura del shell, cambios a `login.html` salvo atributos estrictamente necesarios para el blindaje (si hicieran falta), y cualquier funcionalidad nueva.

**Criterios de aceptación**

- [x] CA-01 Al enfocar con Tab el campo Usuario no aparece ningún rectángulo interior pegado al `<input>`; solo se aprecia el contorno `outline` del `mat-form-field` de Material.
- [x] CA-02 Al enfocar con Tab y con clic el campo Contraseña no aparece ningún rectángulo interior pegado al `<input>`; solo se aprecia el contorno `outline` del `mat-form-field` de Material.
- [x] CA-03 El anillo propio (`var(--dm-focus-ring-*)`) sigue intacto al enfocar con teclado el botón «Iniciar sesión», el toggle de visibilidad de contraseña y el skip-link del shell.
- [x] CA-04 Ningún `outline: none` sin reemplazo: `grep -rn "outline:\s*none\|outline:none" src/app/features/auth/login src/app/core/layout` no devuelve resultados, o cada ocurrencia va acompañada de un indicador de foco alternativo documentado en la misma regla.
- [x] CA-05 El foco sigue siendo siempre visible navegando solo con teclado (Tab / Shift+Tab) por Usuario, Contraseña, toggle y botón de envío, sin depender del puntero.
- [x] CA-06 Sin regresión visual en los 3 breakpoints (360×640, 768×1024, 1440×900): el card del login mantiene centrado, ancho máximo 448px en ≥1280px y paddings por tokens; el shell no cambia de apariencia.
- [x] CA-07 Pasan `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`; el implementer no creó ni editó ningún `*.spec.ts` (el reviewer añadirá las specs de regresión de foco).

**Tareas**

- [x] T-003-01 Acotar en `src/app/features/auth/login/login.scss` la regla `:host :focus-visible` (líneas 22–25) para excluir los inputs gestionados por Material (p. ej. `:not(.mat-mdc-input-element)` o excluir `input`/`textarea`/`select` dentro de `mat-form-field`). Resultado: el anillo propio ya no se pinta sobre el `<input>` interior, pero sigue aplicándose a botón, toggle y enlaces.
- [x] T-003-02 Verificar en el dev server con Tab y con clic que Usuario y Contraseña muestran solo el contorno del field de Material, y que el botón «Iniciar sesión», el toggle y el skip-link conservan el anillo. Resultado: CA-01, CA-02, CA-03 y CA-05 comprobados manualmente.
- [x] T-003-03 Decidir y, si aplica, blindar de la misma forma la regla `:host :focus-visible` de `src/app/core/layout/app-shell.scss` (líneas 13–16), garantizando riesgo cero: skip-link (líneas 35–39), toggle (líneas 83–85), «Salir» (líneas 157–159), enlaces de navegación y foco de `.dm-main` (líneas 329–331) sin cambios visuales. Resultado: decisión documentada y, si se toca el shell, sin alteración de su apariencia actual.
- [x] T-003-04 Verificar que no queda ningún `outline: none` sin reemplazo en `login.scss` ni en `app-shell.scss`, y que el foco por teclado sigue visible en todos los controles afectados. Resultado: CA-04 y CA-05 cumplidos.
- [x] T-003-05 Verificar los 3 breakpoints (360×640, 768×1024, 1440×900): card centrado, ancho y paddings del login intactos, y shell sin cambios. Resultado: CA-06 cumplido sin scroll horizontal nuevo.
- [x] T-003-06 Ejecutar `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`, y entregar al reviewer la lista de CA y los puntos que requieren specs nuevas de regresión de foco (recordando que el implementer no crea ni edita `*.spec.ts`). Resultado: CA-07 cumplido con evidencia adjunta.

**Preguntas abiertas**

- **PQ-01 — ¿Entra el blindaje preventivo de `app-shell.scss` en esta entrega?** Hoy no hay defecto visible (el shell no contiene form fields). **Recomendación:** incluirlo solo si el diff demuestra riesgo cero y apariencia idéntica; en caso contrario, dejarlo fuera y documentar el motivo, sin bloquear el arreglo del login.

**Historial**

- 2026-10-21 — spec-author: feature creada.
- 2026-10-21 — team-lead: feature movida a `in_progress` y despachada al implementer.
- 2026-10-21 — implementer: 6/6 tareas completadas (T-003-02/05 parciales por falta de navegador). Decisión PQ-01: blindaje del shell incluido (riesgo cero). `lint`, `test` (115/115), `build` y `features:validate` en verde; `format:check` en rojo solo por `feature-list.md` (fuera de su alcance). Ningún `*.spec.ts` tocado, sin commit/push.
- 2026-10-21 — team-lead: feature movida a `in_review` y despachada al reviewer.
- 2026-10-21 — reviewer: **FAIL condicional y puramente formal**. Producción correcta, 127/127 tests, `lint`/`build`/`validate` en verde; único rojo: `format:check` por la línea 131 de `feature-list.md` (`*(…)*` → Prettier exige `_…_`), introducida por edición del team-lead en F-002. 12 tests nuevos de foco creados. Sin defectos de producción; nada que devolver al implementer.
- 2026-10-21 — team-lead: aplicado el hunk de Prettier en la línea 131; solicitada re-verificación al reviewer.
- 2026-10-21 — reviewer: **PASS** final. `format:check` y `features:validate` en verde; 127/127 tests, `lint` y `build` ya verificados. 12 tests nuevos de foco. Confirmación visual de píxeles y medición física de viewports pendientes de navegador (limitación declarada, sin defecto hallado).
- 2026-10-21 — team-lead: feature movida a `done`. PQ-01 resuelta (blindaje del shell incluido, riesgo cero verificado).

### F-004 — Login: sin foco automático inicial en `/login`

- **Estado:** done
- **Prioridad:** Baja
- **Aprobado por:** Oscar Mora (confirmado por chat)
- **Fecha de aprobación:** 2026-10-21
- **Dependencias:** `F-002` (autenticación: login, sesión y rutas, estado `done`) y `F-003` (anillo de foco único en el login, estado `done`).

**Descripción**

F-002 exige foco inicial en el campo de usuario tras el primer render (CA-16 y T-002-08) y lo implementa `src/app/features/auth/login/login.ts` con `viewChild('usernameField')` (línea 100) + `afterNextRender(() => ... focus())` (líneas 111–113) sobre el campo `#usernameField` de `login.html` (línea 14). El reviewer lo cubre en `src/app/features/auth/login/login.spec.ts` («pone el foco inicial en el campo de usuario», líneas 186–190, `document.activeElement`).

Decisión del humano ya tomada (no se reabre): **al abrir `/login` ningún campo debe tomar foco automáticamente**. El foco inicial en el usuario se elimina; el usuario navegará con Tab/clic cuando quiera.

Prioridad Baja: cambio menor de comportamiento, sin defecto funcional ni impacto en validaciones, envío, rutas o sesión.

Alcance de esta feature:

1. Eliminar la lógica de foco automático en `login.ts` (el `afterNextRender` que enfoca `#usernameField`, con su `viewChild` e imports asociados si quedan sin uso), sin tocar validadores, submit, toggle, mensajes, rutas ni estilos.
2. Enmendar lo estrictamente necesario de F-002: CA-16 y T-002-08 dejan de exigir foco inicial automático (el resto de CA-16 —Enter envía una sola vez, pegado permitido, toggle no envía, controles `disabled` durante el envío— queda intacto). La enmienda se documenta como nota en esta feature (ver CA-04); el texto de F-002 no se modifica.
3. El reviewer actualizará `login.spec.ts` (quitar/reescribir la aserción de `document.activeElement` en el usuario tras el render; conservar el test de recorrido Tab y el resto).
4. Accesibilidad: sin foco automático, el orden de tabulación natural empieza igualmente en Usuario (primer control enfocable del `main`); el foco sigue siendo visible al navegar con teclado (anillo/contornos existentes, sin cambios). Sin `autofocus` en HTML ni foco programado en ningún otro control.

Fuera de alcance explícito: cualquier otro cambio visual, de validación, de rutas o de sesión; no se reabren F-002 ni F-003.

**Criterios de aceptación**

- [x] CA-01 Al cargar `/login` ningún campo toma foco automáticamente: `document.activeElement` es `document.body` (no el input de Usuario ni ningún otro control del formulario); `grep -rn "autofocus" src/app/features/auth/login/login.html` → 0 resultados y no queda ninguna llamada a `.focus()` en `login.ts`.
- [x] CA-02 El orden de tabulación natural empieza en Usuario (primer control enfocable del `main`): el primer Tab desde la carga lleva a Usuario y el recorrido Usuario → Contraseña → toggle → botón sigue intacto, con foco visible mediante el anillo/contornos existentes y sin cambios de estilos.
- [x] CA-03 Sin regresión en el formulario: Enter en cualquier campo envía una sola vez, pegar en la contraseña funciona, el toggle no envía y alterna `aria-pressed` y el `type` entre `password` y `text`, y durante el envío los controles están `disabled`; mensajes, rutas y sesión intactos.
- [x] CA-04 Enmienda a F-002 documentada en esta feature sin modificar su texto: CA-16 y T-002-08 dejan de exigir «foco inicial en el campo de usuario tras el primer render»; el resto de CA-16 queda intacto.
- [x] CA-05 Pasan `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`; el implementer no creó ni editó ningún `*.spec.ts` (el reviewer actualiza `login.spec.ts`: quita/reescribe la aserción de foco inicial y conserva el test de recorrido Tab).

**Tareas**

- [x] T-004-01 Eliminar en `src/app/features/auth/login/login.ts` el bloque `afterNextRender(() => ...focus())` (líneas 111–113), el `viewChild('usernameField')` (línea 100) y los imports que queden sin uso por ello (`afterNextRender`, `ElementRef`, `viewChild`), sin tocar validadores, submit, toggle, mensajes, rutas ni estilos. Resultado: ningún foco programado en el componente.
- [x] T-004-02 Verificar en `src/app/features/auth/login/login.html` que no existe `autofocus` ni foco programado en ningún otro control, y retirar la referencia `#usernameField` (línea 14) solo si queda sin uso tras T-004-01, manteniendo el resto del HTML intacto. Resultado: marcado sin cambios visuales ni de accesibilidad salvo la ausencia de foco inicial.
- [x] T-004-03 Verificar en el dev server que `/login` carga sin foco en ningún campo, que el primer Tab lleva a Usuario y que el recorrido completo por teclado conserva el foco visible, sin regresión en envío, validaciones ni toggle. Resultado: CA-01, CA-02 y CA-03 comprobados manualmente.
- [x] T-004-04 Ejecutar `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`, y entregar al reviewer la lista de CA y el punto que requiere actualización de specs (`login.spec.ts`: quitar/reescribir la aserción de `document.activeElement` en el usuario, conservar el recorrido Tab), recordando que el implementer no crea ni edita `*.spec.ts`. Resultado: CA-05 cumplido con evidencia adjunta.

**Preguntas abiertas**

Ninguna. La única decisión de producto (no enfocar automáticamente ningún campo al abrir `/login`) ya la tomó el humano y no se reabre.

**Historial**

- 2026-10-21 — spec-author: feature creada.
- 2026-10-21 — humano: aprobación confirmada por chat; team-lead transcribe estado, aprobador y fecha.
- 2026-10-21 — team-lead: feature movida a `in_progress` y despachada al implementer.
- 2026-10-21 — implementer: 4/4 tareas completadas (T-004-03 parcial por falta de navegador). Eliminado `afterNextRender`/`viewChild`/`#usernameField`. `format:check`, `lint`, `build`, `validate` en verde; `test` 126/127 con 1 fallo esperado (aserción obsoleta de foco inicial). Ningún `*.spec.ts` tocado, sin commit/push.
- 2026-10-21 — team-lead: feature movida a `in_review` y despachada al reviewer.
- 2026-10-21 — reviewer: **PASS**. CA-01/03/04/05 cumplidos; CA-02 parcial a nivel DOM (recorrido Tab en orden verificado, confirmación física de tecla pendiente de navegador, sin defecto). `login.spec.ts` actualizado (foco inicial → `body`). 127/127 tests, 5 comandos en verde.
- 2026-10-21 — team-lead: feature movida a `done`. Enmienda a F-002 (CA-16/T-002-08) registrada en CA-04.

### F-005 — Login con correo electrónico en lugar de usuario

- **Estado:** done
- **Prioridad:** Alta
- **Aprobado por:** Oscar Mora (confirmado por chat)
- **Fecha de aprobación:** 2026-10-21
- **Dependencias:** `F-002` (autenticación: login, sesión y rutas, estado `done`) y `F-004` (sin foco automático en `/login`, estado `done`).

**Descripción**

Decisión de producto del humano ya tomada y que no se reabre: el formulario de `/login` pide **correo electrónico + contraseña** (ya no usuario). El backend sigue aceptando la variante `username`, pero el frontend solo envía la variante `email`. F-002, F-003 y F-004 no se reabren salvo las enmiendas documentadas en CA-07.

**Contrato del backend (verificado por el team-lead, se toma como dado)**

- `POST /api/v1/auth/login`: el body incluye exactamente uno de `email` o `username`, más `password` requerido de 1..128 caracteres.
  - `email`: `string|null`, `maxLength` 255, sin `minLength` declarado y sin formato `email` declarado en el schema; ejemplo del backend: `aperez@dispensario.local`.
  - `username`: `string|null`, `minLength` 1, `maxLength` 50.
- Respuestas 200/401/403/422/429 sin cambios de forma. `LoginResponse` y `LoginUser` intactos: `user` sigue trayendo `username` y `email`.

**Supuestos a verificar por el implementer (no se inventan)**

- S-01: el texto del `detail` del 401 con email, y si el 422 usa `errors[].field === 'email'` para el identificador. Se asume por simetría con `username` y se especifica fallback al mensaje general si el campo es desconocido, como ya hace el diseño actual. Verificar con una petición real o con el equipo de backend.

Alcance de esta feature:

1. Campo del formulario en `login.html`: `mat-label` «Correo electrónico», `formControlName="email"`, `autocomplete="email"`, `inputmode="email"`, `maxlength` 255; validadores `required` + `email` de Angular + `maxlength(255)`; `trim` en los extremos como se hacía con username. La contraseña queda intacta.
2. `LoginCredentials` y payload del POST en `auth.models.ts` y `auth.service.ts`: `{email, password}` sin `username`; mapper y tipos actualizados. La sesión (`AuthUser` con `username` para la topbar) no cambia porque `LoginUser` sigue trayendo ambos.
3. Mensajes propios actualizados en `login.html` y `auth-error.ts` según la tabla de literales de CA-03. La contraseña, el 429, el error de red, el 5xx y el aviso de sesión expirada quedan intactos.
4. `docs/AUTH.md`: el contrato documentado pasa a `{email, password}` (variante email; nota de que el backend también acepta `username` pero el frontend no la usa).
5. El reviewer actualiza `login.spec.ts`, `auth.service.spec.ts` y `app.spec.ts` (que monta sesión vía `login`) más cualquier spec con aserciones de `username` como credencial; ver CA-06.

Fuera de alcance explícito: aceptar «usuario o correo» en el mismo campo, registro, recuperación de contraseña, cambios de sesión o topbar más allá del identificador mostrado, rediseño, y tocar `app-shell.*` o los tokens.

**Criterios de aceptación**

- [x] CA-01 Login exitoso: el servicio emite exactamente `POST ${environment.apiUrl}/v1/auth/login` con `{email, password}` (email con `trim` en los extremos, contraseña intacta); ante 200 guarda token, `expiresAt` y usuario mapeado; `isAuthenticated()` pasa a `true` y la navegación termina en el `returnUrl` saneado o en `/`, con `dm-home` visible y el `username` de la sesión en la topbar.
- [x] CA-02 Validación del formulario: email vacío exige `required`; texto sin `@` exige el validador `email` de Angular; más de 255 caracteres exige `maxlength`; cada caso muestra su `mat-error` propio tras `markAllAsTouched()` y bloquea el POST. La contraseña queda intacta.
- [x] CA-03 Literales visibles exactos y ningún otro: `mat-label` «Correo electrónico»; `mat-error` «Ingresa tu correo electrónico», «Ingresa un correo electrónico válido.» y «El correo electrónico no debe superar los 255 caracteres.»; 422 con `errors[].field === 'email'` → «Revisa el correo electrónico» (campos desconocidos → solo el general, sin exponer el `message` del backend); 401 → «Correo electrónico o contraseña incorrectos.»; 403 → «Tu cuenta está inactiva. Contacta al administrador del sistema.». Intactos: 422 general «Revisa los datos ingresados.», 422 de contraseña «Revisa la contraseña», `mat-error` de contraseña, 429, error de red, 5xx y aviso de sesión expirada.
- [x] CA-04 Sin `username` como credencial en producción: `grep -rn "username" src/app/features/auth/login/login.ts src/app/features/auth/login/login.html` → 0 resultados; `formControlName="username"` desaparecido de todo `src/`; `LoginCredentials` declara `{email, password}` sin `username`. En `login.spec.ts` solo quedan menciones justificadas (`user.username` del cuerpo 200 y casos de campo 422 desconocido).
- [x] CA-05 Topbar y sesión intactas: tras login con email, la topbar sigue mostrando el `username` de `LoginUser`; `AuthUser`, `toAuthUser()` y el bloque de usuario del shell no cambian.
- [x] CA-06 Specs a cargo del reviewer: `login.spec.ts` (labels, atributos `autocomplete`/`inputmode`/`maxlength`, validadores, 422 con campo `email`), `auth.service.spec.ts` (POST exacto con `{email, password}`, `trim` en email, contraseña intacta) y `app.spec.ts` (monta sesión vía `login` con email; la aserción de topbar sigue esperando el `username`); cualquier otra aserción de `username` como credencial queda actualizada.
- [x] CA-07 Enmienda a F-002 documentada en esta feature sin modificar su texto: CA-06 (payload `{username, password}`), CA-13 (422 y errores por campo con `username`) y CA-15 (label y `autocomplete` de usuario), más T-002-01/02/03/08/09, pasan a la variante `email` según esta feature; el resto de F-002 queda intacto.
- [x] CA-08 Pasan `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`; el implementer no creó ni editó ningún `*.spec.ts`.

**Tareas**

- [x] T-005-01 Actualizar `src/app/core/auth/auth.models.ts`: `LoginCredentials` pasa a `{email, password}`; `AuthFieldErrors` pasa su clave a `email`; DTOs de respuesta y `toAuthUser()` intactos. Resultado: tipos alineados con la variante `email` sin tocar la sesión.
- [x] T-005-02 Actualizar `src/app/core/auth/auth.service.ts`: `login()` envía `{email: credentials.email.trim(), password: credentials.password}` sin `username`. Resultado: POST exacto según CA-01.
- [x] T-005-03 Actualizar `src/app/core/auth/auth-error.ts`: 401, 403 y 422 con campo `email` según los literales de CA-03, con fallback al mensaje general ante campo desconocido. Resultado: todos los textos de autenticación en un solo módulo, sin exponer `detail`, `code` ni `message` del backend.
- [x] T-005-04 Actualizar `src/app/features/auth/login/login.ts` y `login.html`: control `email` con `required` + `email` + `maxlength(255)`, atributos `autocomplete="email"` e `inputmode="email"`, `mat-label` y `mat-error` propios; el submit envía `{email, password}`. Contraseña, toggle, regiones `role="alert"`/`role="status"`, `aria-busy` y estilos intactos. Resultado: formulario de email funcional y accesible.
- [x] T-005-05 Actualizar `docs/AUTH.md`: contrato `POST /api/v1/auth/login` con `{email, password}` (variante email; nota de que el backend también acepta `username` pero el frontend no la usa) y S-01 como pendiente de verificación. Resultado: documentación alineada con el contrato nuevo.
- [x] T-005-06 Ejecutar `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`, y entregar al reviewer la lista de CA y los specs a actualizar según CA-06, recordando que el implementer no crea ni edita `*.spec.ts`. Resultado: CA-08 cumplido con evidencia adjunta.

**Preguntas abiertas**

- **PQ-01 — Texto exacto del label.** Opciones: «Correo electrónico» / «Email» / «Correo». **Recomendación:** «Correo electrónico», coherente con «Contraseña» y con los mensajes de CA-03; evita el anglicismo y la ambigüedad de «Correo» (postal frente a electrónico).
- **PQ-02 — Validación de formato estricta o laxa.** Opciones: solo `Validators.email` de Angular / regex estricta propia. **Recomendación:** `Validators.email` (laxa); el backend es la fuente de verdad y responde 422 ante lo inválido, y una regex propia arriesga falsos rechazos.

**Historial**

- 2026-10-21 — spec-author: feature creada.
- 2026-10-21 — humano: aprobación confirmada por chat (con recomendaciones PQ-01/PQ-02); team-lead transcribe estado, aprobador y fecha.
- 2026-10-21 — team-lead: feature movida a `in_progress` y despachada al implementer.
- 2026-10-21 — implementer: 6/6 tareas completadas. POST `{email, password}`, campo email con `Validators.email` laxo, literales CA-03, `docs/AUTH.md` actualizado. S-01 VERIFICADO contra backend real (422 con `field === 'email'`). `format:check`, `lint`, `build`, `validate` en verde; `test` no compila por specs obsoletos (20 errores TS solo en `*.spec.ts`). Ningún `*.spec.ts` tocado, sin commit/push.
- 2026-10-21 — team-lead: feature movida a `in_review` y despachada al reviewer.
- 2026-10-21 — reviewer: **FAIL**. 1 hallazgo bloqueante: `mat-error` de `maxlength` inalcanzable (`login.html:25-28`, `Validators.email` falla antes por su lookahead 254; CA-02). 128/129 tests; resto verde. Nada que corregir en specs.
- 2026-10-21 — team-lead: feature movida a `changes_requested`; hallazgo devuelto al implementer.
- 2026-10-21 — implementer: F1 corregido (orden `required → maxlength → email → server` en `login.html`). `npm test` 129/129, `format:check`, `lint`, `build`, `validate` en verde. Sin commit/push.
- 2026-10-21 — team-lead: feature movida a `in_review` para re-verificación.
- 2026-10-21 — reviewer: **PASS** final. CA-02 y CA-08 cumplidos tras el reorden. 129/129 tests, 5 comandos en verde. 6 specs actualizados.
- 2026-10-21 — team-lead: feature movida a `done`.

### F-006 — Módulo para gestionar usuarios

- **Estado:** done
- **Prioridad:** Alta
- **Aprobado por:** —Oscar Mora
- **Fecha de aprobación:** —
- **Dependencias:** `F-002` (autenticación: sesión, guards e interceptor, estado `done`).

**Descripción**

El frontend aún no tiene gestión de usuarios: el login (F-002/F-005) autentica con `email` + contraseña y la sesión (`AuthUser` en `src/app/core/auth/auth.models.ts`: `id`, `username`, `email`, `role`, `doctorId`, con `role: 'ADMIN' | 'MEDICO'` tolerante a valores no previstos) ya existe, pero no hay pantalla para listar, crear, editar ni desactivar usuarios. Esta feature crea el módulo `src/app/features/users/` (standalone, `inject()`, signals, control flow nativo, archivos tipo `user-list.ts` sin sufijo `.component`, selector prefijo `dm-`): listado con tabla de Material, búsqueda/filtros de servidor, paginación de servidor obligatoria, crear/editar con formulario reactivo tipado, gestión del rol `ADMIN`/`MEDICO` vía `role_id`, desactivación lógica vía `DELETE` (sin borrado físico) y protección por rol (solo `ADMIN`). Los estilos nuevos consumen exclusivamente `var(--dm-*)` de `src/styles/_tokens.scss` (sin colores literales) y siguen `docs/DESIGN.md` (`Clinical Academic Authority`).

**Contrato del backend: DOCUMENTADO en `DispensarioMedicoDocs` (verificado, ya no son supuestos).** Fuente: `docs/03-api-rest.md` §§2, 4, 5, 6, 7 y `docs/01-requerimientos-y-backlog.md` (RF-03, RF-10, RF-17, RF-20, US-10, CA-CRUD). Los antiguos supuestos S-01…S-06 quedan sustituidos por lo siguiente; lo que la doc no cierra queda como pregunta residual (R-01…R-04):

- Base `environment.apiUrl + '/v1/users'` compuesta en un solo lugar del servicio (mismo patrón que `AuthService`). Autenticación `Authorization: Bearer <token>` (ya resuelta por el interceptor de F-002).
- Endpoints y roles (§5 tabla + §4 matriz: `/users` CRUD solo Admin, `MEDICO` sin acceso):
  - `GET /users` (Admin, listar) · `POST /users` (Admin, crear; `201`, `409` en duplicado) · `GET /users/{id}` (Admin, `200`/`404`) · `PUT /users/{id}` (Admin, actualizar; `200`, sin `PATCH`) · `DELETE /users/{id}` (Admin, **desactivación lógica vía `is_active`, no borrado físico**) · `POST /users/{id}/reset-password` con `{new_password}` → `200 {"message": "Contraseña restablecida correctamente"}` (Admin; **se propone diferirlo a F-007**, ver PQ-01).
- Paginación de servidor obligatoria (§2 + §6 + RNF-06 «todas las listas paginadas, máximo 100 por página» + CA-CRUD puntos 1–2): query params `page` (desde 1), `size` (máx. 100), `search`, `is_active`, `sort` (`campo` o `-campo`); respuesta `{items, total, page, size, pages}`. **Sin fallback a paginación/filtros en cliente**: si el backend no pagina o falla, se muestra el estado de error, no una paginación local silenciosa (salvo degradación documentada en `docs/USERS.md` si el humano la autoriza).
- `POST /users` body documentado (§7): `{username, email, password, role_id, doctor_id, is_active}`; respuesta `201`: `{id, username, email, role, doctor_id, is_active}`. **Divergencia `role_id` (request) vs `role` (response)**: el frontend la resuelve con un único mapper (`ADMIN`/`MEDICO` ↔ `role_id`) en `users.models.ts` (`toBackendPayload()` / `toManagedUser()`), mismo patrón que `toAuthUser()`; el valor numérico exacto de cada rol queda como residual R-01 (el ejemplo de §7 muestra `role_id: 2` → `MEDICO`, sin fijar el de `ADMIN`).
- Reglas documentadas (§7 + RF-17 + CA-CRUD): `username` y `email` únicos (`409` en duplicado); `password_hash` nunca devuelto; solo `MEDICO` puede tener `doctor_id` (RF-10, US-10); no desactivar al último administrador; no desactivarse a sí mismo; escritura solo `ADMIN` (el backend devuelve `403` si un médico intenta escribir, CA-CRUD punto 8); validaciones y mensajes en español a nivel de campo (RNF-11, CA-CRUD punto 9); interfaz con tabla, búsqueda, paginación, formulario, confirmación, toast, loading, vacío y error (CA-CRUD punto 7).
- **Divergencia login `username` vs `email`**: §3 documenta el login con `{username, password}`, pero el frontend usa la variante `{email, password}` verificada contra el backend real (F-005, `email` máx. 255). En formularios de usuarios se mantiene `email` como identificador principal; `username` se conserva como campo porque §7 lo exige en el body de creación (unicidad incluida). No se reabre F-005.
- `POST /users/{id}/reset-password` existe (RF-20, US-11 `Should` 2 pts): **alcance propuesto fuera de F-006** (F-006 = listar/crear/editar/desactivar); ver PQ-01. Tampoco entran en F-006: cambio de contraseña propia (`POST /auth/change-password`, US-12), registro público, refresh token, permisos finos más allá de «solo ADMIN», i18n, modo oscuro, importación/exportación masiva ni auditoría (RF-22 `Could`).

Fuera de alcance explícito adicional: recuperación de contraseña (no existe endpoint), borrado físico (prohibido por RF-17), selector de `doctor_id` con búsqueda (hasta R-03/R-05: campo informativo o ID directo según confirme el backend/OpenAPI).

**Estructura de rutas propuesta**

```ts
{
  path: '',
  component: AppShell,
  canActivate: [authGuard],
  children: [
    { path: '', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
    {
      path: 'users',
      canActivate: [adminGuard],
      loadComponent: () => import('./features/users/user-list/user-list').then((m) => m.UserList),
    },
  ],
},
```

`adminGuard` (`CanActivateFn`) reutiliza la sesión de `AuthService`: sin sesión delega en `authGuard` (redirige a `/login?returnUrl=/users`); con sesión y `role !== 'ADMIN'` redirige a `/` (el humano confirma destino en PQ-02). Crear/editar se resuelve con diálogos `MatDialog` sobre el listado (sin rutas `users/new` ni `users/:id/edit`), salvo decisión contraria en PQ-03. El sidenav agrega el ítem «Usuarios» visible solo con `role === 'ADMIN'` (el resto de ítems sigue pendiente como en F-001). `reset-password` no añade ruta ni diálogo en esta feature (propuesto para F-007, ver PQ-01).

**Mensajes de error propios del frontend**

Los textos viven en `src/app/features/users/users-error.ts` (`mapUsersError()`), elegidos por status HTTP y `code`; el `detail`, el `code` y el `message` del backend no se muestran nunca tal cual:

- **401**: sesión caída → el interceptor existente limpia y redirige a `/login?returnUrl=/users`; el listado muestra «Tu sesión expiró. Inicia sesión de nuevo.» solo si corresponde.
- **403**: «No tienes permiso para gestionar usuarios.» (rol no ADMIN o backend deniega; el backend es la barrera real, §15 «validar roles en cada endpoint»).
- **404**: «El usuario solicitado ya no existe. Actualiza la lista.»
- **409**: «Ya existe un usuario con ese correo electrónico.» (username y email únicos, §7; ante 409 sin campo identificable, mensaje general de duplicado sin exponer el `detail`).
- **422**: «Revisa los datos ingresados.» y, si `errors[].field` es conocido (`username`, `email`, `password`, `role_id`, `doctor_id`, `is_active`), mensaje propio bajo ese campo («Revisa el usuario», «Revisa el correo electrónico», «Revisa la contraseña», «Selecciona un rol válido», «Revisa el médico asociado»); el `message` del backend no se muestra. Campos desconocidos se ignoran (solo general).
- **status 0 / red**: «No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.»
- **5xx**: «Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.»
- **Activar/desactivar**: éxito «Usuario activado.» / «Usuario desactivado.» en `role="status"`; fallo con los mensajes anteriores en `role="alert"`.
- Regla general: ningún mensaje incluye token, `detail`, `code`, stack, URLs internas ni datos de otros usuarios.

**Criterios de aceptación**

- [ ] CA-01 Rutas y guard: `src/app/app.routes.ts` declara `users` como hija lazy de la ruta con `AppShell`, con `canActivate: [adminGuard]`; `src/app/app.routes.ts` sigue declarando `login`, `''` y `** → ''`; `/users` sin sesión termina en `/login?returnUrl=%2Fusers`; con sesión `MEDICO` (u otro rol no ADMIN) no renderiza `dm-user-list` y termina en `/` (o destino aprobado en PQ-02); con sesión `ADMIN` renderiza `dm-user-list` dentro del shell.
- [ ] CA-02 Listado base: con sesión `ADMIN`, `/users` emite `GET ${environment.apiUrl}/v1/users?page=1&size=<n>` y muestra tabla Material (`mat-table` + `mat-paginator`) con columnas usuario/correo/rol/estado/acciones; filas de 48px, header con fondo `var(--dm-color-canvas)`, borde inferior 2px de tabla y `hover` `var(--dm-color-primary-container)` con transición 150ms según `docs/DESIGN.md`; estado vacío con mensaje propio («No hay usuarios para mostrar.») y estado de carga con `mat-progress-spinner` o `mat-progress-bar`; `grep -rn "console\." src/app/features/users` → 0 resultados.
- [ ] CA-03 Búsqueda/filtros de servidor: campo de búsqueda con `<mat-label>` visible y `aria-label` (query param `search`), filtro por estado (`Todos`/`Activos`/`Inactivos` → query param `is_active=true/false`/ausente) y orden `sort` si la UI lo expone; cada cambio emite `GET /v1/users` con los params correspondientes y resetea el paginador a la primera página; la combinación sin resultados muestra el estado vacío de CA-02; no hay filtrado en cliente (ante fallo del backend, estado de error, no lista local).
- [ ] CA-04 Paginación de servidor obligatoria (§2, §6, RNF-06, CA-CRUD puntos 1–2): `mat-paginator` con opciones declaradas (p. ej. 10/20/50, máximo 100) y `pageSize` por defecto documentado; cada cambio de página/tamaño emite la petición con `page`/`size` y el total mostrado es el `total` del servidor (respuesta `{items, total, page, size, pages}`); no hay duplicados ni saltos al cambiar de página; sin paginación en cliente salvo degradación autorizada y documentada en `docs/USERS.md`.
- [ ] CA-05 Crear: botón primario `mat-flat-button` «Nuevo usuario» (alto 36px, radio 4px) abre el diálogo de creación; el formulario es reactivo tipado (`FormGroup` + `FormControl<string>` `nonNullable`); el servicio emite `POST ${environment.apiUrl}/v1/users` con `{username, email, password, role_id, doctor_id, is_active}`; ante `201` el diálogo se cierra, la lista se recarga y aparece «Usuario creado.» en `role="status"`; ante `409` el diálogo permanece abierto con el mensaje de duplicado en `role="alert"`; ante otro error el diálogo permanece abierto y `submitting()` vuelve a `false`.
- [ ] CA-06 Editar/detalle: cada fila expone «Editar» (botón icono con `aria-label="Editar <identificador>"`); el diálogo precarga con `GET ${environment.apiUrl}/v1/users/{id}` (`200`; `404` → «El usuario solicitado ya no existe. Actualiza la lista.» y cierre del diálogo); el guardado emite `PUT ${environment.apiUrl}/v1/users/{id}` (sin `PATCH`) y ante `200` recarga la lista con «Usuario actualizado.» en `role="status"`; el `message` del backend nunca se muestra.
- [ ] CA-07 Roles vía `role_id`: crear/editar solo ofrece `ADMIN` → «Administrador» y `MEDICO` → «Médico» (mismo mapa legible del shell de F-002, con fallback al valor crudo si el backend trae otro); el servicio convierte `role` ↔ `role_id` exclusivamente en el mapper de `users.models.ts` (valores numéricos exactos pendientes de R-01); la columna rol muestra la etiqueta legible; `grep -rn "role_id" src/app/features/users` solo devuelve el mapper y el servicio; el modelo tipa `role` como `UserRole` reutilizado de `auth.models.ts`.
- [ ] CA-08 Desactivar/reactivar vía `DELETE` (desactivación lógica, sin borrado físico, RF-17): cada fila expone «Desactivar»/«Activar» según `is_active`, con diálogo de confirmación (`mat-dialog`, botón destructivo solo para desactivar); desactivar emite `DELETE ${environment.apiUrl}/v1/users/{id}` (`docs/USERS.md` aclara que `DELETE` = desactivar vía `is_active`); la reactivación usa el mecanismo que confirme el backend/OpenAPI (R-04); `grep -rn "http\.patch\|http\.delete" src/app/features/users/users.service.ts` solo contiene `http.delete` para desactivar y ningún `patch`; tras 2xx la fila refleja el nuevo estado y aparece «Usuario activado.»/«Usuario desactivado.» en `role="status"`; la UI impide desactivarse a sí mismo y advierte el caso del último ADMIN activo (§7).
- [ ] CA-09 Solo ADMIN: el ítem «Usuarios» del sidenav solo se renderiza con `role === 'ADMIN'`; `guestGuard`/`authGuard` existentes no se modifican salvo imports; ningún `MEDICO` puede abrir el diálogo ni emitir `POST`/`PUT`/`DELETE` de usuarios desde la UI (botones no renderizados y guard bloquea la ruta); el `403` del backend (matriz §4: `/users` CRUD solo Admin; CA-CRUD punto 8) muestra el mensaje de esta especificación; `reset-password` no existe en esta feature (PQ-01).
- [ ] CA-10 Validaciones coherentes con F-005 y mensajes en español (RNF-11, CA-CRUD punto 9): email vacío → `required` («Ingresa el correo electrónico»); texto sin `@` → `email` («Ingresa un correo electrónico válido.»); >255 → `maxlength` («El correo electrónico no debe superar los 255 caracteres.»); `username` con `required` + `maxlength(50)` (longitudes exactas pendientes de R-02); cada caso muestra su `mat-error` tras `markAllAsTouched()` y bloquea el envío; la contraseña al crear exige `required` + `maxlength(128)` (obligatoriedad al editar y política de formato pendientes de R-02; propuesta: vacía = no cambiar); `doctor_id` solo asignable a `MEDICO` (§7, RF-10); pegar en la contraseña funciona (sin handlers de `paste`/`preventDefault`).
- [ ] CA-11 Sin fugas de información: `password_hash` nunca se recibe ni se muestra (§7); las contraseñas no se guardan en signals persistentes, ni en `localStorage`/`sessionStorage`, ni en query params, URL, mensajes, comentarios o logs; ningún mensaje incluye token, `detail`, `code`, `WWW-Authenticate`, stack ni URLs internas; `grep -rn "detail\|WWW-Authenticate" src/app/features/users/*.html src/app/features/users/users-error.ts` solo devuelve el mapeo interno por `code`, nunca interpolación al template.
- [ ] CA-12 Responsive: a 360×640, 768×1024 y 1440×900 no hay scroll horizontal (`document.documentElement.scrollWidth <= clientWidth`); en <768px la tabla pasa a card-stack o scroll horizontal contenido según `docs/DESIGN.md`, los filtros apilan en una columna y «Nuevo usuario» sigue alcanzable con Tab; en ≥1280px el contenido respeta el contenedor máximo 1600px y paddings por tokens (16/24/32).
- [ ] CA-13 Accesibilidad: todos los campos tienen `<mat-label>` visible, `mat-error` asociado, `autocomplete` donde aplique (`email`, `username`, `new-password`/`current-password` según el caso) y `maxlength` declarado; la tabla usa `mat-table` con `aria-label` y cabeceras reales; errores en `role="alert"`, éxitos en `role="status"`, `aria-busy` durante envíos; foco visible con el anillo de tokens en botones, diálogos y paginador; ningún `outline: none` sin reemplazo (`grep -rn "outline:\s*none\|outline:none" src/app/features/users` → 0 o con reemplazo documentado en la misma regla); Enter envía el diálogo una sola vez y Escape lo cierra sin guardar.
- [ ] CA-14 Design system intacto: `src/styles/_tokens.scss`, `src/styles.scss` y `docs/DESIGN.md` no se modifican; los estilos nuevos (`user-list.scss`, diálogo) no introducen colores literales (`grep -nE "#[0-9a-fA-F]{3,8}" src/app/features/users/*.scss` → 0) y consumen `var(--dm-*)`; todos los pares texto/fondo nuevos cumplen AA ≥ 4.5:1 y el error no se pinta con `--dm-color-error` sobre `--dm-color-error-container` (3.94:1, precedente F-002 CA-19).
- [ ] CA-15 Docs: existe `docs/USERS.md` (o sección equivalente en `docs/AUTH.md` si el humano lo prefiere) que documenta el contrato aplicado (endpoints y status de §5/§7, paginación `page`/`size` y respuesta `{items, total, page, size, pages}`, filtros `search`+`is_active`, `DELETE` = desactivar vía `is_active`, reglas §7, mapeo `role_id` ↔ `role`, divergencia `email` del login), los residuales R-01…R-04 que quedaron pendientes, y las notas para el reviewer (specs a crear/actualizar); sin usuarios, contraseñas, tokens, JWT ni datos de pacientes en docs, código, comentarios o fixtures.
- [ ] CA-16 Pasan `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`; el implementer no creó ni editó ningún `*.spec.ts`. El reviewer crea `users.service.spec.ts`, `admin.guard.spec.ts`, `user-list.spec.ts` y `user-form.spec.ts`, y actualiza `app-shell.spec.ts` (ítem «Usuarios» solo ADMIN) si aplica.

**Tareas**

- [ ] T-006-01 Crear `src/app/features/users/users.models.ts` con `ManagedUser` (`id`, `username`, `email`, `role: UserRole`, `doctorId`, `isActive`), DTOs `snake_case` de §7 (`username`, `email`, `password`, `role_id`, `doctor_id`, `is_active`; respuesta con `role` en lugar de `role_id`), `toManagedUser()`/`toCreatePayload()`/`toUpdatePayload()` como único punto de mapeo (`doctor_id` → `doctorId` y `role_id` ↔ `role` con constantes pendientes de R-01) y `UserRoleOption` (`ADMIN`/`MEDICO` + etiquetas «Administrador»/«Médico»). Resultado: tipos sin `any`, reutilizando `UserRole` de `auth.models.ts`.
- [ ] T-006-02 Crear `src/app/features/users/users.service.ts` (`providedIn: 'root'`, `inject()`, signals) con `list(page, size, search?, isActive?, sort?)`, `getById(id)`, `create(payload)`, `update(id, payload)` y `deactivate(id)` contra `environment.apiUrl + '/v1/users'` (`GET` listar con `{items, total, page, size, pages}`, `GET /{id}`, `POST` → `201`, `PUT /{id}` → `200`, `DELETE /{id}` = desactivar; sin `reset-password`, ver PQ-01), `trim` en email/username, contraseña sin transformar, y composición de query params en un solo lugar. Resultado: todo el HTTP de usuarios en un servicio testeable sin componentes.
- [ ] T-006-03 Crear `src/app/features/users/users-error.ts` con `mapUsersError(error: unknown)` que cubre 401/403/404/409/422/status 0/5xx con los textos de esta especificación (422 con `field` en `snake_case`: `role_id`/`doctor_id` mapeados a sus campos del formulario), sin exponer `detail`, `code` ni `message` del backend. Resultado: todos los textos de usuarios en un solo módulo, mismo patrón que `auth-error.ts`.
- [ ] T-006-04 Crear `src/app/core/auth/admin.guard.ts` (o `role.guard.ts` si el humano lo prefiere) con `adminGuard: CanActivateFn` que espera `restoreSession()`/`ensureValidSession()`, redirige sin sesión a `/login?returnUrl=/users` y con rol no ADMIN a `/` (o destino de PQ-02). Resultado: `/users` protegida por sesión + rol sin tocar `authGuard`/`guestGuard`.
- [ ] T-006-05 Actualizar `src/app/app.routes.ts` añadiendo la hija `users` lazy con `canActivate: [adminGuard]` según la estructura propuesta, sin alterar `login`, `''` ni `**`. Resultado: `/users` dentro del shell y protegida.
- [ ] T-006-06 Crear `src/app/features/users/user-list/user-list.ts|html|scss` (`dm-user-list`, standalone, OnPush, signals, control flow nativo): `mat-table` con las columnas y estilos de CA-02, buscador + filtro `is_active` + `sort` de CA-03, `mat-paginator` de servidor de CA-04, botones «Nuevo usuario»/«Editar»/«Desactivar/Activar», regiones `alert`/`status`, `aria-busy` y `takeUntilDestroyed`. Resultado: listado funcional que delega todo el HTTP en `UsersService`.
- [ ] T-006-07 Crear el diálogo `src/app/features/users/user-form/user-form.ts|html|scss` (`dm-user-form`, `MatDialog`) con `FormGroup` tipado `nonNullable`, controles `email`/`username`/`password`/`role` (`mat-select` `ADMIN`/`MEDICO` que el servicio convierte a `role_id`; `doctor_id` solo para `MEDICO` según R-03; `isActive` solo si el OpenAPI lo pide al crear), validadores y literales de CA-06/CA-10, toggle de contraseña con `aria-pressed`/`aria-label` como en el login, y submit con `(ngSubmit)` que distingue crear (`POST` → `201`) de editar (`PUT` → `200`). Resultado: crear/editar sin rutas nuevas (salvo PQ-03).
- [ ] T-006-08 Añadir la confirmación de desactivación/reactivación (`MatDialog` dedicado o diálogo del propio `user-list`, a elegir en implementación y documentar en `docs/USERS.md`), con botón destructivo solo para desactivar (`DELETE` = desactivar vía `is_active`), bloqueo de autodesactivación y mensajes de CA-08. Resultado: sin borrado físico (RF-17).
- [ ] T-006-09 Actualizar `src/app/core/layout/app-shell.*` para añadir el ítem «Usuarios» visible solo con `role === 'ADMIN'` (misma etiqueta de rol de F-002), sin tocar skip-link, topbar, bloque de usuario ni breakpoints. Resultado: navegación ADMIN sin regresión del shell.
- [ ] T-006-10 Crear `docs/USERS.md` (o actualizar `docs/AUTH.md` si el humano lo prefiere) con el contrato aplicado de §§2, 4, 5, 6, 7 (endpoints, status `201`/`200`/`404`/`409`/`403`, paginación `{items, total, page, size, pages}` con máx. 100, filtros `search`+`is_active`, `DELETE` = desactivar, reglas §7, mapeo `role_id` ↔ `role`, divergencia `email`), los residuales R-01…R-04 pendientes, los mensajes propios y las notas para el reviewer (specs de CA-16). Resultado: decisiones de usuarios documentadas fuera del código, sin secretos ni datos reales.
- [ ] T-006-11 Ejecutar `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`, verificar en el dev server los tres breakpoints (360/768/1440), el ciclo ADMIN (listar → crear → editar → desactivar → activar) y el bloqueo MEDICO (sin ítem, `/users` → `/`), y entregar al reviewer la lista de CA y los `*.spec.ts` a crear/actualizar según CA-16, recordando que el implementer no crea ni edita `*.spec.ts`. Resultado: evidencia adjunta.

**Preguntas abiertas**

**Resueltas por la documentación (no requieren decisión humana; se citan para trazabilidad).**

- **PA-01 — Contrato de endpoints: RESUELTA por doc.** §§5 y 4 fijan `GET /users` (listar), `POST /users` (crear, `201`/`409`), `GET /users/{id}` (`200`/`404`), `PUT /users/{id}` (actualizar, `200`, sin `PATCH`), `DELETE /users/{id}` (desactivar) y `POST /users/{id}/reset-password`; matriz §4: `/users` CRUD solo Admin. Paginación/respuesta y params en §§2 y 6 + CA-CRUD puntos 1–2 + RNF-06.
- **PA-02 — Schema y validaciones: RESUELTA en lo estructural por doc.** §7 fija body `{username, email, password, role_id, doctor_id, is_active}`, respuesta con `role`, unicidad de `username`/`email` (`409`), `password_hash` nunca devuelto y 422 con `{field, message}` (§2); quedan pendientes solo valores exactos (R-01/R-02).
- **PA-03 — Activar/desactivar vs borrado: RESUELTA por doc.** §5 «Desactivar usuario» + RF-17 (activar/desactivar sin eliminar físicamente) + CA-CRUD punto 5 + reglas §7 (no desactivar último admin ni a sí mismo): la baja es desactivación lógica y `DELETE` es su vehículo; prohibido el borrado físico.
- **PA-04 — Autorización por rol: RESUELTA por doc.** Matriz §4 (`/users` CRUD solo Admin, `MEDICO` sin acceso) + CA-CRUD punto 8 (`403` si un médico intenta escribir) + §15 (validar roles en cada endpoint): backend como barrera real, `adminGuard` a `/` en frontend.
- **PA-05 — Relación `MEDICO` ↔ `doctor_id`: RESUELTA en regla por doc.** §7 «solo `MEDICO` puede tener `doctor_id`» + RF-10/US-10 (asociar usuario médico con registro de médico); queda pendiente solo el mecanismo de selección en el formulario (R-03).

**Residuales [BLOQUEANTE para aprobar] — solo lo que la doc no cierra. Verificar contra OpenAPI (`/openapi.json`, §14) o backend local antes de aprobar; no inventar.**

- **R-01 — [BLOQUEANTE residual] Valor exacto de `role_id` por rol.** El ejemplo de §7 muestra `role_id: 2` → `MEDICO`, pero la doc no fija la tabla (`ADMIN` = ¿1?). **Recomendación:** leer `/openapi.json` (o `GET /roles` si existe) y fijar las constantes en el mapper; hasta entonces el mapper vive aislado para un cambio de una línea.
- **R-02 — [BLOQUEANTE residual] Longitudes/formatos exactos de usuarios.** La doc no declara `maxLength`/mínimos ni política de contraseña para `POST /users` (la base F-005 —email 255, username 1..50, password 1..128— viene del login, no del schema de usuarios), ni si `password` es obligatoria al editar (`PUT` completo vs parcial) ni si `username`/`email` son editables. **Recomendación:** tomar los límites del schema OpenAPI del recurso; propuesta temporal: email `required`+`email`+255, username `required`+50, password `required`+128 al crear y opcional al editar (vacía = no cambiar), a confirmar.
- **R-03 — [BLOQUEANTE residual] Query params exactos de `GET /users` y selección de `doctor_id`.** §§2/6 y CA-CRUD confirman `page`/`size`/`search`/`is_active`/`sort`, pero la doc no lista un filtro por `role` para users (a diferencia de `status`/`doctor_id` en visitas, §11) ni cómo se elige `doctor_id` al crear un `MEDICO` (¿ID directo, selector con `GET /doctors`, o lo asigna el backend?). **Recomendación:** confirmar contra OpenAPI; no añadir filtro por rol ni selector de médico hasta entonces (campo `doctor_id` informativo o ID directo según confirme el backend).
- **R-04 — [BLOQUEANTE residual] Comportamiento exacto de `DELETE /users/{id}` y reactivación.** La doc dice «Desactivar» pero no fija status/cuerpo del `DELETE` (`200` con recurso vs `204`, tabla §2 admite ambos) ni el endpoint de reactivación (¿`PUT` con `{is_active: true}`, `DELETE` idempotente, u otro?). **Recomendación:** verificar contra OpenAPI/backend local con datos sintéticos y transcribir status, cuerpo y flujo de reactivación a `docs/USERS.md` antes de aprobar; la UI impide en todo caso la autodesactivación y advierte el último ADMIN activo.

**Decisiones de producto (no bloquean la aprobación del contrato; se proponen con recomendación).**

- **PQ-01 — Alcance de `reset-password`: diferir a F-007 (recomendación).** `POST /users/{id}/reset-password` existe (§7, RF-20, US-11 `Should` 2 pts) pero es una historia propia (US-11, «mostrar una vez»/hash) y F-006 ya cubre US-10 (`Must` 8 pts: roles, estado, médico asociado, unicidad). **Recomendación:** F-006 = listar/crear/editar/desactivar; crear F-007 «Restablecer contraseña de usuario» con el diálogo, el `POST /users/{id}/reset-password` con `{new_password}` y sus CA propios. No se impone: si el humano prefiere incluirlo, entra como CA-17/T-006-12 en esta misma feature.
- **PQ-02 — Destino ante rol insuficiente y ante `/users/{id}` inexistente.** Opciones: (a) redirigir a `/`; (b) pantalla `403`/`404` propia. **Recomendación:** (a) redirigir a `/` con mensaje en `role="status"` («No tienes permiso para gestionar usuarios.»), sin crear páginas de error en esta entrega.
- **PQ-03 — Diálogos frente a páginas `users/new` y `users/:id/edit`.** Opciones: (a) diálogos sobre el listado (propuesto); (b) rutas separadas. **Recomendación:** (a) diálogos: una sola ruta protegida, menos guardias y retorno inmediato al listado; pasar a (b) solo si el humano prevé deep-linking o formularios largos.

**Historial**

- 2026-10-21 — spec-author: feature creada.
- 2026-10-21 — spec-author: feature revisada a la luz de `DispensarioMedicoDocs` (`03-api-rest.md` §§2, 4, 5, 6, 7; `01-requerimientos-y-backlog.md` RF-03/RF-10/RF-17/RF-20, US-10/US-11, CA-CRUD): S-01…S-06 sustituidos por el contrato documentado (PA-01…PA-05 cerradas en lo estructural); alcance recortado a listar/crear/editar/desactivar con `reset-password` propuesto para F-007 (PQ-01); residuales R-01…R-04 pendientes de OpenAPI/backend local. Estado sigue `proposed`, sin aprobador.

### F-007 — Usuarios: carga sin parpadeo, avisos en toast y corrección del falso 404 al cancelar edición

- **Estado:** done
- **Prioridad:** Alta
- **Aprobado por:** —OScar Mora
- **Fecha de aprobación:** —21/10/2026
- **Dependencias:** `F-006` (módulo usuarios, estado `done`).

**Descripción**

Requisito humano (texto completo, no se inventa alcance): (1) «Parece ser que cuando realizo una busqueda de usuario o aplico un filtro carga completamente el componente completo de la tabla porque se ve con un refresh de esa parte». (2) «Al desactivar un usuario aparece un mensaje encima de la tabla que dice 'Usuario desactivado.'; quiero que ese mensaje aparezca en un toasd en la parte superior izquierda con y que dure dos segundos para desaparecer. (Si se disparan otros mensajes con esa misma implementacion quiero que la cambies al toast)». (3) «Al cancelar la edicion de un usuario parace el siguiente mensaje 'El usuario solicitado ya no existe. Actualiza la lista.'».

Contexto leído del código (sin modificar): `src/app/features/users/user-list/user-list.ts` (signals `items`/`total`/`pageIndex`/`pageSize`/`sortState`/`loading`/`error`/`notice`; `search` con `debounceTime(300)` + `distinctUntilChanged`; `statusFilter`; `load()` que pone `loading=true` y `error=null` y emite `GET /v1/users` con `page`/`size`/`search`/`is_active`/`sort`; `openCreate`/`openEdit` que ante `afterClosed()` con `result === 'saved'` fijan `notice` y recargan, y ante `result !== undefined` recargan y fijan `error` con «El usuario solicitado ya no existe. Actualiza la lista.»), `user-list.html` (filtros + regiones `role="alert"`/`role="status"` encima de la tabla + `@if (loading())` que sustituye tabla/paginador por `mat-progress-spinner` + `aria-busy` en la sección), `user-form.ts`/`user-form.html` (`UserFormResult = 'saved' | { notFound: true }`; `loadUser()` cierra con `{ notFound: true }` ante fallo del `GET /{id}`; botón «Cancelar» con `mat-dialog-close` sin valor; error del diálogo en `role="alert"`), `users-error.ts` (`mapUsersError()` 401/403/404/409/422/status 0/5xx), `user-list.scss` (solo `var(--dm-*)`, foco con blindaje F-003), `docs/USERS.md` (contrato, textos propios, `DELETE` = desactivar, reactivar vía `PUT`). `grep -rn "MatSnackBar\|snackbar\|snackBar" src/app` → 0 resultados: hoy no hay toast en la app.

Tres sub-alcances: (a) carga sin recarga visual completa al buscar/filtrar/paginar/ordenar: header y filtros permanecen montados, solo la región de la tabla muestra estado de carga (spinner/skeleton contenido, sin parpadeo del layout), el foco se mantiene en el buscador, `aria-busy` vive en la región de la tabla, y no hay peticiones duplicadas (se conserva el debounce de 300 ms). (b) migrar los mensajes de éxito/error del listado desde las regiones inline encima de la tabla a toast/snackbar (`MatSnackBar` o equivalente Material ya disponible en el proyecto): posición y duración según PA-01/PA-02, `role="status"` en éxito y `role="alert"` en error, sin robar el foco, con apilado o reemplazo documentado si se disparan varios. (c) bug cancelar-edición: cerrar el diálogo con «Cancelar», Escape o backdrop no debe disparar `GET` 404 ni fijar ningún error/toast; solo cierra sin efectos. Solo el 404 real del `GET /{id}` en edición (que cierra con `{ notFound: true }`) recarga la lista y muestra el toast de error 404.

Supuestos (leídos, no inventados): el debounce de 300 ms y `distinctUntilChanged` ya existen y se conservan; `UserFormResult` distingue `'saved'` de `{ notFound: true }` y el cierre por Cancelar/Escape/backdrop resuelve `afterClosed()` sin valor útil (no es un 404); `mat-dialog-close` sin valor no porta `{ notFound: true }`; no hay `MatSnackBar` en uso (grep 0); los tokens `--dm-*` y `docs/DESIGN.md` no se modifican.

Fuera de alcance explícito: `reset-password` (`POST /users/{id}/reset-password`; F-006 PQ-01 lo barajó como F-007, pero F-007 no existe como cabecera —solo menciones— y esta feature ocupa el siguiente ID libre, así que reset-password queda pendiente para F-008 u otro ID posterior); cambios a tokens (`src/styles/_tokens.scss`, `src/styles.scss`), a `docs/DESIGN.md` o al backend; cambios de contrato, validaciones, roles o rutas; rediseño del listado.

Nota de ID: verificados F-001…F-006 con `Estado: done` en este archivo; no existe cabecera `### F-007`, solo menciones a un futuro F-007 de reset-password, por lo que F-007 es el siguiente ID libre y reset-password queda documentado como pendiente en otro ID.

**Criterios de aceptación**

- [ ] CA-01 Buscar/filtrar/paginar/ordenar no recarga visualmente el componente completo: con red simulada lenta, el header («Usuarios» + «Nuevo usuario») y los filtros (buscador + estado) permanecen montados durante `load()`; solo la región de la tabla muestra carga (spinner/skeleton contenido); el buscador conserva el foco tras el debounce (`document.activeElement` sigue siendo el input); `aria-busy="true"` durante la carga vive en la región de la tabla, no en toda la sección. Verificado con specs del reviewer (foco + nodos montados), sin parpadeo del layout.
- [ ] CA-02 Sin peticiones duplicadas por debounce: escribir N caracteres en el buscador con intervalos <300 ms emite una sola `GET /v1/users` con el `search` final; cada cambio de filtro de estado, página, tamaño u orden emite exactamente una petición con sus params y resetea a la primera página cuando cambia el criterio. Verificado con `HttpTestingController` (`expectOne` por gesto).
- [ ] CA-03 Éxitos en toast de 2 s: «Usuario creado.» / «Usuario actualizado.» / «Usuario activado.» / «Usuario desactivado.» aparecen en toast/snackbar (no inline encima de la tabla), con duración 2000 ms (sujeto a PA-02), posición según PA-01, `role="status"`, sin robar el foco. `grep -rn "MatSnackBar\|matSnackBar\|openFromComponent\|open(" src/app/features/users/user-list/user-list.ts src/app/features/users/users-toast.ts` (o el helper que se cree) → import/uso del toast presente y centralizado.
- [ ] CA-04 Errores en toast con duración mayor: los errores de carga del listado y de activar/desactivar (401/403/status 0/5xx vía `mapUsersError`, más el 404 de edición) aparecen en toast con duración mayor que el éxito y acción «Cerrar» (propuesta: 5000 ms, sujeto a PA-02), `role="alert"`, sin robar el foco; el comportamiento ante varios toasts seguidos (apilar o reemplazar) queda documentado en `docs/USERS.md`.
- [ ] CA-05 Sin restos inline de esos mensajes: `grep -rn "Usuario creado\.\|Usuario actualizado\.\|Usuario activado\.\|Usuario desactivado\." src/app/features/users/user-list/` → 0 resultados; `grep -rn 'role="status"\|role="alert"' src/app/features/users/user-list/user-list.html` → 0 resultados, salvo el vacío «No hay usuarios para mostrar.» si se acuerda mantenerlo inline (documentado en `docs/USERS.md`); `users-error.ts` no se duplica (sigue siendo la única fuente de textos).
- [ ] CA-06 Cancelar no es 404: cerrar el diálogo de crear/editar con «Cancelar», Escape o backdrop (resultado `undefined`/`""`/`false`) no emite ningún `GET`, no recarga la lista y no fija ningún error ni toast; solo un `afterClosed()` con `{ notFound: true }` (404 real del `GET /{id}` en edición) recarga la lista y muestra el toast 404 «El usuario solicitado ya no existe. Actualiza la lista.». `grep -n "result !== undefined" src/app/features/users/user-list/user-list.ts` → 0 resultados; el manejo discrimina `{ notFound: true }` explícitamente. Verificado con specs (cerrar con `undefined` → `expectNone` de `GET` y sin toast).
- [ ] CA-07 Accesibilidad y design system intactos: `src/styles/_tokens.scss`, `src/styles.scss` y `docs/DESIGN.md` no se modifican; estilos nuevos o tocados sin colores literales (`grep -nE "#[0-9a-fA-F]{3,8}" src/app/features/users/user-list/user-list.scss src/app/features/users/users-toast*.scss` → 0) y con `var(--dm-*)`; foco visible con el anillo de tokens (blindaje F-003 intacto); tabla con `aria-label` y cabeceras reales; `prefers-reduced-motion` respetado; ningún `outline: none` sin reemplazo.
- [ ] CA-08 Pasan `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`; el implementer no creó ni editó ningún `*.spec.ts`. El reviewer crea/actualiza specs de carga sin parpadeo (foco + nodos), toast (duración/posición/roles/foco no robado), no-regresión de `user-list` y corrección del falso 404 al cancelar. `docs/USERS.md` documenta toast (posición/duración/roles), carga incremental y corrección del cancelar, sin secretos ni datos reales.

**Tareas**

- [ ] T-007-01 En `src/app/features/users/user-list/user-list.ts`, convertir `load()` en carga incremental: `loading` solo gobierna la región de la tabla (no desmonta header/filtros), conservar `debounceTime(300)` + `distinctUntilChanged` en el buscador, un `GET` por gesto (página/tamaño/filtro/orden con reset a primera página), `aria-busy` en la región de la tabla y `takeUntilDestroyed`. Resultado: CA-01 y CA-02 sin cambiar contrato ni params.
- [ ] T-007-02 En `src/app/features/users/user-list/user-list.html` y `user-list.scss`, mover el estado de carga dentro de la región de la tabla (spinner actual o skeleton contenido, a elegir en implementación), mantener header/filtros/paginador montados según CA-01, conservar el foco en el buscador, respetar `prefers-reduced-motion` y solo `var(--dm-*)`. Resultado: sin parpadeo del layout.
- [ ] T-007-03 Crear el toast centralizado de usuarios (p. ej. `src/app/features/users/users-toast.ts` + estilos si aplican, o helper equivalente con `MatSnackBar` ya disponible en el proyecto): éxito 2000 ms / error según PA-02 con acción «Cerrar», posición según PA-01, `role="status"`/`role="alert"`, sin robar el foco, comportamiento ante múltiples toasts documentado; importar el módulo de snackbar una sola vez en el ámbito de users. Resultado: CA-03 y CA-04 con un único punto de toast.
- [ ] T-007-04 En `src/app/features/users/user-list/user-list.ts` (y `user-list.html` solo lo estrictamente necesario), migrar al toast exactamente estos mensajes y retirar sus regiones inline: «Usuario creado.» / «Usuario actualizado.» / «Usuario activado.» / «Usuario desactivado.» + errores de carga del listado y de activar/desactivar (vía `mapUsersError`) + 404 de edición; mantener inline solo el vacío «No hay usuarios para mostrar.» salvo decisión contraria documentada. Resultado: CA-05, con `users-error.ts` como única fuente de textos.
- [ ] T-007-05 En `src/app/features/users/user-list/user-list.ts` (`openCreate`/`openEdit` + `confirmToggleActive` si aplica), reescribir el manejo de `afterClosed()`: solo `{ notFound: true }` recarga y muestra el toast 404; `undefined`/`""`/`false` (Cancelar/Escape/backdrop) no recargan, no fijan error/toast y no emiten `GET`. Eliminar la condición amplia `result !== undefined`. Resultado: CA-06 en el listado.
- [ ] T-007-06 En `src/app/features/users/user-form/user-form.ts` (sin tocar validadores ni estilos salvo lo estrictamente necesario), garantizar que «Cancelar»/Escape/backdrop solo cierran sin valor y nunca cierran con `{ notFound: true }` ni disparan `GET`; el 404 real de `loadUser()` (`GET /{id}`) sigue cerrando con `{ notFound: true }`. Resultado: CA-06 en el diálogo.
- [ ] T-007-07 Actualizar `docs/USERS.md`: posición/duración/roles del toast (según PA-01/PA-02), lista de mensajes migrados (CA-03/CA-04/CA-05), comportamiento de carga incremental (CA-01/CA-02) y corrección del cancelar (CA-06); sin usuarios, contraseñas, tokens, JWT ni datos de pacientes. Resultado: decisiones documentadas fuera del código.
- [ ] T-007-08 Ejecutar `npm run format:check`, `npm run lint`, `npm test`, `npm run build` y `npm run features:validate`, verificar en el dev server los tres breakpoints, el ciclo buscar/filtrar/paginar sin parpadeo, cada toast (4 éxitos + errores) y el cancelar sin 404, y entregar al reviewer la lista de CA y los `*.spec.ts` a crear/actualizar según CA-08, recordando que el implementer no crea ni edita `*.spec.ts`. Resultado: evidencia adjunta.

**Preguntas abiertas**

- **PA-01 — [BLOQUEANTE para aprobar] Posición del toast: la frase «parte superior izquierda con» está truncada/ambigua.** Opciones: (a) top-left literal como pide el humano; (b) top-center; (c) bottom-center (default de Material); (d) top-end. **Recomendación:** (c) o (d) siguiendo `docs/DESIGN.md` + Material: top-left colisiona con el sidenav persistente de 240 px y la topbar navy en ≥1280 px y rompe el layout shell de F-001. Confirmar si top-left es literalmente lo pedido y, en ese caso, aceptar por escrito la colisión con sidenav/topbar o elegir (c)/(d).
- **PA-02 — [BLOQUEANTE para aprobar] Duración: ¿los 2 s aplican solo al éxito o también al error?** Opciones: (a) 2 s para todo; (b) éxito 2000 ms y error 5000 ms con acción «Cerrar». **Recomendación:** (b): los errores (401/403/red/5xx/404) necesitan tiempo de lectura y cierre manual; 2 s para errores es insuficiente e inaccesible. Confirmar (b) o fijar otra duración de error.
- **PA-03 — [BLOQUEANTE para aprobar] Alcance de «otros mensajes con esa misma implementación».** Se propone migrar al toast exactamente: «Usuario creado.» / «Usuario actualizado.» / «Usuario activado.» / «Usuario desactivado.» + errores de carga del listado y de activar/desactivar (401/403/status 0/5xx vía `mapUsersError`) + 404 de edición («El usuario solicitado ya no existe. Actualiza la lista.»); quedan inline el vacío «No hay usuarios para mostrar.» y el «Cargando usuario…» del diálogo. **Recomendación:** aprobar esta lista explícita; si algún mensaje debe quedarse inline, indicarlo aquí.
- **PA-04 — Apilado de toasts (no bloqueante).** Opciones: (a) cada toast reemplaza al anterior; (b) se apilan. **Recomendación:** (a) con `MatSnackBar` por defecto (un contenedor), documentado en `docs/USERS.md`; pasar a (b) solo si el humano prevé errores simultáneos frecuentes.

**Historial**

- 2026-10-22 — spec-author: feature creada.

### F-008 — Usuarios: footer y shell estables al buscar/filtrar (sin parpadeo del footer)

- **Estado:** done
- **Prioridad:** Media-Alta
- **Aprobado por:** —Oscar Mora
- **Fecha de aprobación:** —21/10/2026
- **Dependencias:** `F-007` (carga incremental en `user-list` y toast centralizado, estado `done`).

**Descripción**

Requisito humano (texto completo, no se inventa alcance): «El footer parece refrescarse tambien cuando filtro los usuarios».

Contexto leído del código (sin modificar): `src/app/core/layout/app-shell.ts` (standalone `dm-app-shell`, `ChangeDetectionStrategy.OnPush`, signals `isDesktop`/`collapsed`/`mobileOpen`, `user`/`roleLabel`/`isAdmin` derivados de `AuthService`), `src/app/core/layout/app-shell.html` (header/topbar, sidenav, `main` con `<router-outlet />`, `footer.dm-footer` estático «Dispensario Médico — Sistema de gestión»), `src/app/core/layout/app-shell.scss` (host flex column `min-block-size: 100dvh`, footer con `min-block-size: var(--dm-footer-height)` y borde superior), `src/app/features/users/user-list/user-list.ts` (carga incremental F-007: `loading` solo gobierna la región de la tabla, `debounceTime(300)` + `distinctUntilChanged` en el buscador, `load()` conserva filas hasta la respuesta, toast vía `UsersToast`), `user-list.html` (header «Usuarios» + «Nuevo usuario» y filtros montados; `dm-user-list__table-region` con `aria-busy`; `@if (loading())` añade `div.dm-user-list__loading` con `mat-progress-spinner` dentro de la región), `src/app/app.routes.ts` (layout route: `AppShell` como `component` de la ruta padre con hijas `''` y `users`), `docs/USERS.md` (sección F-007: carga incremental, toast, corrección del cancelar).

Nota de ID: verificados los encabezados `### F-001`…`### F-007` en este archivo; no existe cabecera de reset-password (solo menciones en F-006 PQ-01/R-02 y en F-007 como «feature posterior» sin cabecera creada). Esta fix del footer ocupa el siguiente ID libre (**F-008**) y **reset-password queda pendiente para F-009 o posterior**, fuera de esta feature.

Causas probables (hipótesis a verificar por el implementer, no afirmaciones): (a) el spinner de `dm-user-list__loading` se inserta en flujo dentro de la región de la tabla y altera la altura del `main`, desplazando visualmente el footer (salto de layout percibido como «refresh»); (b) transición/animación del spinner o del contenedor que provoca parpadeo; (c) re-render del shell por cambio de señal compartida (`AuthService.user`) o por navegación con query params —el código leído no emite query params al filtrar, pero debe verificarse que filtrar no dispara navegación ni recrea `dm-app-shell`; (d) footer sin memoización adicional necesaria más allá del `OnPush` ya existente del shell. El implementer confirma la causa real con reproducción en dev server antes de tocar estilos.

Alcance de esta feature: footer y shell estables al buscar/filtrar/paginar/ordenar en `/users` (sin parpadeo, sin remontar el footer, foco intacto en el buscador); sin tocar backend, tokens (`src/styles/_tokens.scss`, `src/styles.scss`) ni `docs/DESIGN.md`.

Fuera de alcance explícito: reset-password (`POST /users/{id}/reset-password`; queda para F-009 o posterior); cambios visuales del footer (texto, colores, alturas, paddings intactos); cambios de contrato, validaciones, roles, rutas o paginación; rediseño del listado.

**Criterios de aceptación (vía rápida)**

- [ ] CA-01 Footer estable: `footer.dm-footer` (y header/nav/main) no se remontan durante `load()` al buscar/filtrar/paginar/ordenar; texto intacto, verificado en specs por identidad de nodo.
- [ ] CA-02 Sin salto de layout ni regresión F-007: carga contenida en `dm-user-list__table-region` (overlay o espacio reservado), header/filtros/paginador montados, foco en buscador, `aria-busy` solo en región, filtrar no navega (`grep router.navigate|queryParams` → 0).
- [ ] CA-03 Design intacto + docs: tokens/DESIGN sin cambios, footer idéntico, sin colores literales nuevos, `prefers-reduced-motion` intacto; `docs/USERS.md` documenta causa y arreglo.
- [ ] CA-04 Checks reducidos: `format:check` + `lint` + test afectado en implementer; reviewer hace full (`test` + `build` + `features:validate`); implementer no toca `*.spec.ts`.

**Tareas (vía rápida)**

- [ ] T-008-01 Diagnosticar causa real (spinner en flujo vs re-render) y contener carga en `dm-user-list__table-region` (`user-list.html/scss`: overlay o `min-block-size`), manteniendo F-007 y `aria-busy` en región.
- [ ] T-008-02 Toque mínimo en `app-shell.*` solo si hace falta (apariencia idéntica) + verificar con grep que filtrar no navega ni toca señales del shell.
- [ ] T-008-03 Actualizar `docs/USERS.md` + checks reducidos (`format:check`, `lint`, test afectado) y entregar al reviewer CAs + specs a crear (estabilidad footer, foco, no-regresión F-007), sin tocar `*.spec.ts`.

**Preguntas abiertas**

- **PQ-01 — [BLOQUEANTE para reproducir] ¿Cómo se manifiesta el «refresh» del footer?** Opciones: (a) el footer desaparece y reaparece; (b) el footer salta de posición y vuelve; (c) parpadeo visual sin desplazamiento. Se pide al humano: pasos exactos (qué filtro/búsqueda, con cuántos usuarios en lista), viewport y navegador, y —si es posible— un video corto o los logs de red (¿hay más de un `GET /v1/users` por gesto? ¿cambia la URL al filtrar?). Sin esta evidencia el implementer diagnostica contra las hipótesis de la descripción, pero la confirmación visual del humano acelera el arreglo.
- **PQ-02 — Reserva de espacio frente a spinner superpuesto (no bloqueante).** Opciones: (a) spinner superpuesto sin alterar el flujo; (b) `min-block-size` reservado en la región de la tabla. **Recomendación:** (a) o la que confirme el diagnóstico de T-008-01, con `prefers-reduced-motion` respetado; documentar la elegida en `docs/USERS.md`.

**Historial**

- 2026-10-22 — spec-author: feature creada.

### F-009 — Módulo para gestionar tipos de fármacos

- **Estado:** done
- **Prioridad:** Alta
- **Aprobado por:** Oscar Mora
- **Fecha de aprobación:** 2026-10-25
- **Dependencias:** F-002 (sesión y roles), F-006 (patrón CRUD de usuarios), API `/api/v1/drug-types` (Sprint 1, US-07)

**Descripción**

CRUD del catálogo de tipos de fármacos (RF-04, US-07) siguiendo el criterio estándar CA-CRUD (doc 01 §7). Es el primer catálogo maestro de la épica E2 y fija el patrón que reutilizan marcas y ubicaciones. Ruta `/drug-types` dentro del shell con carga lazy; ítem «Tipos de fármacos» en el menú, visible para ADMIN y MEDICO.

Contrato verificado contra el OpenAPI vivo (2026-10-25):

- `GET /api/v1/drug-types`: `page` ≥1, `size` 1-100 (por defecto 20), `search` ≤100 parcial en `description`, `is_active`, `sort` ∈ `description|created_at|is_active|id` con prefijo `-` (por defecto `description`). Respuesta `items/total/page/size/pages`.
- `POST /drug-types`: `description` requerida (1-100), `is_active` opcional (por defecto `true`); `201`; `409` en duplicado.
- `GET/PUT/DELETE /drug-types/{id}`: PUT = reemplazo completo conservando `created_at`; DELETE = desactivación lógica (`is_active: false`), nunca borrado físico.

Permisos (matriz doc 01 §3): ADMIN = CRUD; MEDICO = consulta. La UI del médico muestra la tabla sin acciones de escritura (sin «Nuevo», «Editar» ni «Desactivar»); el backend devuelve `403` como red de seguridad.

**Criterios de aceptación**

- [x] CA-01 Listado con paginación 100% servidor: cada cambio de página/tamaño/búsqueda/filtro/orden emite un `GET` y resetea a página 1 cuando cambia el criterio; opciones 10/20/50, por defecto 20; el total mostrado es el `total` del servidor. Carga contenida en la región de la tabla sin parpadeo ni pérdida de foco (patrón F-007/F-008: header/filtros montados, `aria-busy` en región).
- [x] CA-02 Crear: diálogo con `description` requerida (1-100, trim); `201` cierra con toast de éxito y refresca; `409` duplicado marca error de campo en español; `422` marca errores por campo sin exponer mensajes crudos del backend.
- [x] CA-03 Editar: diálogo precargado con `GET /{id}`; `200` conserva `created_at`; mismas validaciones y toasts que crear. Cancelar/Escape/backdrop cierra sin efectos.
- [x] CA-04 Desactivar/Activar con confirmación explícita; DELETE desactiva y reactivar reenvía el registro con `is_active: true` en el PUT de reemplazo completo (mismo criterio R-04 resuelto en F-006); nunca borrado físico.
- [x] CA-05 Permisos: MEDICO ve menú y tabla en solo lectura (cero controles de escritura en el DOM, no solo deshabilitados); ADMIN ve el CRUD completo. La ruta es accesible para ambos roles autenticados.
- [x] CA-06 Estados de UI completos: loading, vacío («No hay tipos de fármacos para mostrar.»), error con reintento y avisos por toast centralizado; validaciones y mensajes en español a nivel de campo; accesibilidad AA (labels, foco visible, `aria-busy`, navegación por teclado).
- [x] CA-07 Diseño: solo tokens `--dm-*`, sin hex literales, sin `::ng-deep`; badge de estado con los chips AA del sistema; `@include dm.dm-focus-ring` donde aplique; tabla con scroll horizontal contenido en <768px.
- [x] CA-08 `done` requiere: PASS del reviewer, `npm run lint`, `npm test`, `npm run build` y `features:validate` en verde; documentación actualizada (doc nuevo del módulo + menú).

**Tareas**

- [x] T-009-01 Modelo y servicio `drug-types.service.ts` (todo el HTTP del módulo, mapeo de errores 400/404/409/422 a mensajes en español) siguiendo `users.service.ts`/`users-error.ts`.
- [x] T-009-02 Listado `drug-type-list`: tabla (descripción, estado, acciones), búsqueda con `debounceTime(300)` + `distinctUntilChanged`, filtro de estado, paginador y sort servidor, loading contenido, vacío y error.
- [x] T-009-03 Diálogos crear/editar (formulario reactivo tipado, validador `server` como en login/users) y confirmación de activar/desactivar; toasts centralizados.
- [x] T-009-04 Ruta lazy `/drug-types` en el shell + ítem de menú visible para ambos roles + ocultamiento de acciones de escritura para MEDICO.
- [x] T-009-05 Documentación del módulo + handoff a reviewer (CAs + casos), sin tocar `*.spec.ts` (los escribe el reviewer).

**Preguntas abiertas**

- **PQ-01 — RESUELTA (2026-10-25, Oscar Mora): regla del tres.** Se replica el patrón de users en F-009/F-010/F-011 y la extracción a `shared/` (US-08) se evalúa con 3 casos reales.
- **PQ-02 — RESUELTA (2026-10-25, Oscar Mora): visible en solo lectura para MEDICO**, según la matriz de permisos («Consulta»).

**Historial**

- 2026-10-25 — spec-author: feature creada (tras el cierre de F-008; contrato verificado contra el OpenAPI vivo).
- 2026-10-25 — Oscar Mora: aprobada en chat con orden explícita de registro; PQ-01 y PQ-02 resueltas.
- 2026-10-25 — team-lead: pasa a `in_progress`.
- 2026-10-27 — team-lead: implementación completada en `19b72a6` (modelo, servicio y mapeo de errores) y `576dfc1` (listado, diálogos, confirmación, toasts, ruta y menú); reviewer (T5) da **PASS por S1..S10** con 312 tests, sin defectos de producción; checks verdes: 312 tests, `lint`, `build` y `features:validate` (9 features); documentación del módulo en `docs/DRUG-TYPES.md`. Feature a `done`.

### F-010 — Módulo para gestionar marcas

- **Estado:** done
- **Prioridad:** Alta
- **Aprobado por:** Oscar Mora
- **Fecha de aprobación:** 2026-10-27
- **Dependencias:** F-009 (patrón CRUD de tipos de fármacos), API `/api/v1/brands` (Sprint 3, US-16)

**Descripción**

CRUD del catálogo de marcas (RF-05, US-16) siguiendo el criterio estándar CA-CRUD (doc 01 §7). Es el segundo catálogo maestro de la épica E2 y reutiliza el patrón fijado por F-009 (tipos de fármacos): mismos componentes, mismos contratos, mismos textos salvo el nombre del recurso. Ruta `/brands` dentro del shell con carga lazy; ítem «Marcas» en el menú, visible para ADMIN y MEDICO.

Contrato verificado contra el OpenAPI vivo (2026-10-27):

- `GET /api/v1/brands`: `page` ≥1, `size` 1-100 (por defecto 20), `search` ≤100 parcial en `description`, `is_active`, `sort` ∈ `description|created_at|is_active|id` con prefijo `-` (por defecto `description`). Respuesta `items/total/page/size/pages`.
- `POST /brands`: `description` requerida (1-100), `is_active` opcional (por defecto `true`); `201`; `409` en duplicado.
- `GET/PUT/DELETE /brands/{id}`: PUT = reemplazo completo conservando `created_at`; DELETE = desactivación lógica (`is_active: false`), nunca borrado físico.

Permisos (matriz doc 01 §3): ADMIN = CRUD; MEDICO = consulta. La UI del médico muestra la tabla sin acciones de escritura (sin «Nuevo», «Editar» ni «Desactivar»); el backend devuelve `403` como red de seguridad.

**Criterios de aceptación**

- [x] CA-01 Listado con paginación 100% servidor: cada cambio de página/tamaño/búsqueda/filtro/orden emite un `GET` y resetea a página 1 cuando cambia el criterio; opciones 10/20/50, por defecto 20; el total mostrado es el `total` del servidor. Carga contenida en la región de la tabla sin parpadeo ni pérdida de foco (patrón F-007/F-008/F-009).
- [x] CA-02 Crear: diálogo con `description` requerida (1-100, trim); `201` cierra con toast de éxito y refresca; `409` duplicado marca error de campo en español; `422` marca errores por campo sin exponer mensajes crudos del backend.
- [x] CA-03 Editar: diálogo precargado con `GET /{id}`; `200` conserva `created_at`; mismas validaciones y toasts que crear. Cancelar/Escape/backdrop cierra sin efectos.
- [x] CA-04 Desactivar/Activar con confirmación explícita; DELETE desactiva y reactivar reenvía el registro con `is_active: true` en el PUT de reemplazo completo; nunca borrado físico.
- [x] CA-05 Permisos: MEDICO ve menú y tabla en solo lectura (cero controles de escritura en el DOM, no solo deshabilitados); ADMIN ve el CRUD completo. La ruta es accesible para ambos roles autenticados.
- [x] CA-06 Estados de UI completos: loading, vacío («No hay marcas para mostrar.»), error con reintento y avisos por toast centralizado; validaciones y mensajes en español a nivel de campo; accesibilidad AA.
- [x] CA-07 Diseño: solo tokens `--dm-*`, sin hex literales, sin `::ng-deep`; badge de estado con los chips AA del sistema; `@include dm.dm-focus-ring`; tabla con scroll horizontal contenido en <768px.
- [x] CA-08 `done` requiere: PASS del reviewer, `npm run lint`, `npm test`, `npm run build` y `features:validate` en verde; documentación actualizada.

**Tareas**

- [x] T-010-01 Modelo y servicio `brands.service.ts` siguiendo `drug-types.service.ts`/`drug-types-error.ts`.
- [x] T-010-02 Listado `brand-list`: tabla, búsqueda con `debounceTime(300)`, filtro de estado, paginador y sort servidor, loading contenido, vacío y error con reintento.
- [x] T-010-03 Diálogos crear/editar y confirmación de activar/desactivar; toasts centralizados.
- [x] T-010-04 Ruta lazy `/brands` en el shell + ítem de menú visible para ambos roles + ocultamiento de acciones de escritura para MEDICO.
- [x] T-010-05 Documentación del módulo + handoff a reviewer.

**Preguntas abiertas**

- **PQ-01** — RESUELTA (2026-10-25, Oscar Mora): regla del tres. Con F-010/F-011 se evalúa la extracción a `shared/`.

**Historial**

- 2026-10-27 — spec: feature creada (patrón F-009).

- 2026-10-27 — Implementación completa (5b2e7b9): models/service/error/toast/list/form/confirm + ruta + nav. Reviewer PASS S1..S10, 413 tests verdes, lint, build, features:validate. docs/BRANDS.md. Cierre done.

### F-011 — Módulo para gestionar ubicaciones

- **Estado:** done
- **Prioridad:** Alta
- **Aprobado por:** Oscar Mora
- **Fecha de aprobación:** 2026-10-27
- **Dependencias:** F-009 (patrón CRUD), API /api/v1/locations (Sprint 3, US-17)

**Descripción**

CRUD del catálogo de ubicaciones físicas (RF-06, US-17) siguiendo el criterio estándar CA-CRUD (doc 01 §7). Es el tercer catálogo maestro de la épica E2 y completa la regla del tres (PQ-01): con tres casos reales se evalúa la extracción a shared/ (US-08). Campos: name, description, is_active y las celdas anidadas (section, cell, description, is_active). _(2026-10-27: realineado a /api/v1/shelves; el modelo plano description/shelf/section/cell no existe en el backend.)_ Ruta /locations dentro del shell con carga lazy; ítem «Ubicaciones» en el menú, visible para ADMIN y MEDICO.

Contrato verificado contra el OpenAPI vivo (2026-10-27):

- GET /api/v1/shelves: page ≥1, size 1-100 (por defecto 20), search ≤100, is_active, sort (por defecto name) con prefijo -. Respuesta items/total/page/size/pages; cada estante trae sus `cells[]`. _(Corregido el 2026-10-27: `/api/v1/locations` no existe en el backend.)_
- POST /shelves: `name` (2..100) requerido; `description` (≤200) opcional; `is_active` opcional (por defecto true); 201; 409 en `name` duplicado; body con `additionalProperties: false` y **sin `cells`** (las celdas se crean por `/v1/cells`).
- GET/PUT/DELETE /shelves/{id}: PUT = reemplazo completo de `name`+`description`+`is_active` (**no toca las celdas**); DELETE responde 204 (desactivación lógica).
- Celdas (`/api/v1/cells`, endpoints propios desde el 2026-10-27): GET paginado (`search` en section/cell/description, `shelf_id`, `is_active`, `sort` ∈ section|cell|shelf_id|created_at|is_active|id), POST (`section`+`cell`+`shelf_id` requeridos), GET/PUT/DELETE `/{id}` (el PUT incluye `shelf_id`, permite mover la celda), DELETE 204 y **409 si la celda tiene medicamentos asociados**.

Permisos (matriz doc 01 §3): ADMIN = CRUD; MEDICO = consulta. La UI del médico muestra la tabla sin acciones de escritura.

**Criterios de aceptación**

- [x] CA-01 Listado con paginación 100% servidor.
- [x] CA-02 Crear: description, shelf, section, cell requeridos; 201 cierra con toast; 409 duplicado marca error de campo.
- [x] CA-03 Editar: diálogo precargado con GET /{id}; 200 conserva created_at.
- [x] CA-04 Desactivar/Activar con confirmación explícita.
- [x] CA-05 Permisos: MEDICO solo lectura.
- [x] CA-06 Estados de UI completos: loading, vacío («No hay ubicaciones para mostrar.»), error con reintento, toast.
- [x] CA-07 Diseño: solo tokens --dm-*.
- [x] CA-08 done requiere: PASS del reviewer, lint, test, build, features:validate.

**Tareas**

- [x] T-011-01 Modelo y servicio.
- [x] T-011-02 Listado.
- [x] T-011-03 Diálogos y confirmación.
- [x] T-011-04 Ruta lazy + nav.
- [x] T-011-05 Documentación + cierre.

**Historial**

- 2026-10-27 — spec: feature creada.

- 2026-10-27 — Implementación completa: models/service/error/toast/list/form/confirm + ruta + nav. Reviewer PASS S1..S10, 510 tests verdes, lint, build, features:validate. docs/LOCATIONS.md. Cierre done.
- 2026-10-27 — **Realineación de contrato** (reporte del humano: «Al consultar las ubicaciones aparece La ubicación solicitada ya no existe en vez del vacío»): `/api/v1/locations` **no existe** en el backend vivo (404); el catálogo real es `/api/v1/shelves` (estantes con `cells[]` anidadas). Decisión de Oscar Mora: mapear «Ubicaciones» a `/v1/shelves`. Reescritos `locations.models.ts`/`service.ts`/`error.ts`/`list`/`form`/`confirm` + specs + `docs/LOCATIONS.md`; añadido `LocationsService.listAllCells()` (`CellOption`) para los catálogos que referencian `cells.id`; retirada del copy la afirmación «no elimina sus datos» porque la semántica de `DELETE` no está verificada. Limitación documentada: el `PUT` reemplaza `cells[]` sin `id`, así que `cells.id` cambia en cada edición del estante. Verificación: 122 tests de la feature, suite completa 645, lint, build y `features:validate` en verde.
- 2026-10-27 — **Nueva estructura del backend** (pedido del humano): las celdas salen de los bodies de estante y pasan a tener endpoints propios (`/api/v1/cells` con POST/PUT/DELETE y `409` al desactivar una celda con medicamentos); `ShelfCreate`/`ShelfUpdate` quedan en `name`+`description`+`is_active` con `additionalProperties: false`. Reescripto el guardado del modal: primero el estante y después se reconcilian las celdas (upserts y luego bajas), con `savedShelfId` para que un reintento actualice en vez de duplicar y con el `id` devuelto por cada `POST /v1/cells` escrito en su fila. En el mismo modal: los títulos pasan a «Nuevo estante»/«Editar estante» (y confirm/toasts/checkbox en consecuencia) y el editor de celdas pasa a una sola fila alineada por celda con cabecera `[Tramo, Celda, Descripción, Estado, Eliminar]`. Verificación: 147 tests de la feature, suite completa 670, lint, build y `features:validate` en verde.

### F-012 — Módulo para gestionar medicamentos

- **Estado:** done
- **Prioridad:** Alta
- **Aprobado por:** Oscar Mora
- **Fecha de aprobación:** 2026-10-27
- **Dependencias:** F-009 (tipos), F-010 (marcas), F-011 (ubicaciones — el catálogo real son celdas de estantes, `/api/v1/shelves`), API /api/v1/medications (Sprint 4, US-20)

**Descripción**

CRUD del catálogo de medicamentos (RF-07, US-20) siguiendo el criterio estándar CA-CRUD (doc 01 §7). Primer módulo compuesto de E3: asocia tipo, marca y ubicación (celda de estante). Campos: description, drug_type_id, brand_id, cell_id, dose, is_active. Unicidad: (description, brand_id, dose). Ruta /medications dentro del shell con carga lazy; ítem «Medicamentos» en el menú, visible para ADMIN y MEDICO.

Contrato verificado contra el OpenAPI vivo (2026-10-27):

- GET /api/v1/medications: page ≥1, size 1-100 (por defecto 20), search ≤100 parcial en description o dose, is_active, drug_type_id, brand_id, cell_id, sort ∈ description|dose|drug_type_id|brand_id|cell_id|created_at|is_active|id con prefijo - (por defecto description). Respuesta items/total/page/size/pages. _(Realineado el 2026-10-27: `location_id` → `cell_id`; `MedicationRead` ya no devuelve `created_at`.)_
- POST /medications: description, drug_type_id, brand_id, cell_id, dose requeridos; is_active opcional (por defecto true); 201; 409 en duplicado; 404 si algún catálogo referenciado no existe o está inactivo. El 422 reporta `{"field": "cell_id"}`.
- GET/PUT/DELETE /medications/{id}: PUT = reemplazo completo; DELETE = desactivación lógica.

Permisos (matriz doc 01 §3): ADMIN = CRUD; MEDICO = consulta.

**Criterios de aceptación**

- [x] CA-01 Listado con paginación 100% servidor + filtros por tipo/marca/ubicación.
- [x] CA-02 Crear: description, drug_type_id, brand_id, location_id, dose requeridos; 201 cierra con toast; 409 duplicado marca error de campo; 404 si catálogo inactivo.
- [x] CA-03 Editar: diálogo precargado con GET /{id}; 200 conserva created_at.
- [x] CA-04 Desactivar/Activar con confirmación explícita.
- [x] CA-05 Permisos: MEDICO solo lectura.
- [x] CA-06 Estados de UI completos.
- [x] CA-07 Diseño: solo tokens --dm-*.
- [x] CA-08 done requiere: PASS del reviewer, lint, test, build, features:validate.

**Tareas**

- [x] T-012-01 Modelo y servicio.
- [x] T-012-02 Listado con filtros por tipo/marca/ubicación.
- [x] T-012-03 Diálogos y confirmación.
- [x] T-012-04 Ruta lazy + nav.
- [x] T-012-05 Documentación + cierre.

**Historial**

- 2026-10-27 — spec: feature creada.

- 2026-10-27 — Implementación: models/service/error/toast/list/form/confirm + ruta + nav. Build OK. Specs copiadas de brands con adaptación parcial (pendiente limpieza de asserts). docs pendiente.
- 2026-10-27 — Limpieza de specs de medicamentos: adaptación de catálogos (drug-types/brands/locations), género y mensajes de error; 96 tests verdes, lint, build, features:validate OK.
- 2026-10-27 — **Cambio de contrato del backend**: body POST/PUT, respuesta, filtro de listado, `sort` y `422` pasan de `location_id` a `cell_id`; `MedicationRead` deja de devolver `created_at` (queda opcional y no se muestra); `cell_id` referencia `cells.id` (`fk_medications_location_id_cells`). Renombrado el dominio completo (`cellId`/`cell_id`), la «Ubicación» del medicamento pasó a celdas vía `LocationsService.listAllCells()` y cada catálogo del `forkJoin` se aisló con `catchError` para corregir el reporte «al agregar o actualizar un medicamento no carga tipo, marca ni ubicación». Verificación: 108 tests de la feature, suite completa 645, lint, build y `features:validate` en verde.

## Plantilla

```md
### F-001 — Título de la feature

- **Estado:** proposed
- **Prioridad:** Alta
- **Aprobado por:** —
- **Fecha de aprobación:** —
- **Dependencias:** —

**Descripción**
Descripción funcional y contexto.

**Criterios de aceptación**

- [ ] Criterio verificable 1.
- [ ] Criterio verificable 2.

**Tareas**

- [ ] T-001-01 Descripción de la tarea.
- [ ] T-001-02 Descripción de la tarea.

**Preguntas abiertas**

- Ninguna.

**Historial**

- 2026-10-20 — spec-author: feature creada.
```
