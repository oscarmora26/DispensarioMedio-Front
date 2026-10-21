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
- [x] CA-15 `src/app/app.html` renderiza el shell; la ruta `''` sigue mostrando `home` con su mat-card y `**` sigue redirigiendo a `''`.
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
