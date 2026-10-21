# Design System — Clinical Academic Authority

Sistema visual del frontend del Dispensario Médico. Es la fuente de verdad para color,
tipografía, espaciado, elevación, componentes y accesibilidad. Toda pantalla nueva debe
consumir los tokens `--dm-*` definidos en `src/styles/_tokens.scss` y las utilidades
globales de `src/styles.scss`; no se admiten valores hex sueltos en componentes.

- **Alcance de esta entrega:** tokens, documentación y layout shell base (`dm-app-shell`).
- **Fuera de alcance:** componentes de negocio y componentes `shared/` adicionales.
- **Datos:** todos los ejemplos son sintéticos. El sistema nunca debe contener datos reales
  de pacientes, credenciales ni secretos.

## Principios

1. **Autoridad clínica y académica.** Navy profundo como color institucional, superficies
   claras, bordes sutiles y jerarquía tipográfica sobria. Sin gradientes decorativos ni
   sombras dramáticas.
2. **El color comunica estado, no decora.** El rojo se reserva para anulación y urgencia;
   el teal, para farmacia y seguimiento clínico. El resto de la interfaz es navy + slate.
3. **Datos legibles.** Cédulas, carnets, códigos e IDs de visita usan JetBrains Mono con
   cifras tabulares para que las columnas no bailen.
4. **Accesible por defecto.** Contraste AA mínimo, foco visible siempre, navegación por
   teclado completa y estados que no dependen solo del color.

## Color

Todos los valores se exponen como CSS custom properties con prefijo `--dm-*`. Los tokens
`--mat-sys-*` son generados por `mat.theme()` y **no se redefinen a mano**.

### Marca y primario M3

| Token                          | Valor     | Uso                                         |
| ------------------------------ | --------- | ------------------------------------------- |
| `--dm-color-primary`           | `#0A3B75` | Navy institucional, topbar, acción primaria |
| `--dm-color-primary-dark`      | `#062349` | Hover/pressed del primario                  |
| `--dm-color-primary-light`     | `#1E5BB0` | Enlaces, foco, acentos                      |
| `--dm-color-primary-container` | `#EFF6FF` | Wash de selección, ítem activo              |
| `--dm-color-on-primary`        | `#FFFFFF` | Texto/icono sobre primario                  |

### Secundario (rojo institucional)

| Token                            | Valor     | Uso                                         |
| -------------------------------- | --------- | ------------------------------------------- |
| `--dm-color-secondary`           | `#C8102E` | Solo anulación, urgencia y alertas críticas |
| `--dm-color-secondary-dark`      | `#A6192E` | Hover/pressed del rojo institucional        |
| `--dm-color-secondary-container` | `#FEF2F2` | Fondo de alerta suave                       |
| `--dm-color-on-secondary`        | `#FFFFFF` | Texto sobre rojo                            |

### Terciario clínico (teal)

| Token                           | Valor     | Uso                                                                         |
| ------------------------------- | --------- | --------------------------------------------------------------------------- |
| `--dm-color-tertiary`           | `#0D9488` | Farmacia y seguimiento (fondo, icono y acento; **no** texto normal: 3.74:1) |
| `--dm-color-tertiary-text`      | `#0F766E` | Texto teal accesible sobre blanco                                           |
| `--dm-color-tertiary-dark`      | `#115E59` | Hover/pressed del teal                                                      |
| `--dm-color-tertiary-container` | `#F0FDFA` | Fondo de farmacia/seguimiento                                               |
| `--dm-color-tertiary-soft`      | `#CCFBF1` | Realce suave, gráficos                                                      |

### Error

| Token                        | Valor     | Uso                           |
| ---------------------------- | --------- | ----------------------------- |
| `--dm-color-error`           | `#DC2626` | Error de validación y peligro |
| `--dm-color-error-m3`        | `#BA1A1A` | Rol `error` de Material 3     |
| `--dm-color-error-container` | `#FEE2E2` | Fondo de error                |

### Superficies y texto

| Token                        | Valor     | Uso                              |
| ---------------------------- | --------- | -------------------------------- |
| `--dm-color-canvas`          | `#F8FAFC` | Fondo de la aplicación (nivel 0) |
| `--dm-color-surface`         | `#FFFFFF` | Cards, tablas, topbar contenida  |
| `--dm-color-border-subtle`   | `#E2E8F0` | Bordes de 1px                    |
| `--dm-color-text`            | `#0F172A` | Texto principal                  |
| `--dm-color-muted`           | `#64748B` | Texto secundario, labels         |
| `--dm-color-outline`         | `#737781` | Contorno de controles            |
| `--dm-color-outline-variant` | `#C3C6D1` | Contorno decorativo              |

### Estados clínicos

| Estado      | Color     | Contenedor | Token de color           |
| ----------- | --------- | ---------- | ------------------------ |
| Success     | `#16A34A` | `#DCFCE7`  | `--dm-color-success`     |
| Warning     | `#D97706` | `#FEF3C7`  | `--dm-color-warning`     |
| Danger      | `#DC2626` | `#FEE2E2`  | `--dm-color-danger`      |
| Dispensario | `#0D9488` | `#F0FDFA`  | `--dm-color-dispensario` |

Cada estado expone además `--dm-color-<estado>-container`.

### Chips clínicos

Fondo + texto + borde de 1px del color de texto al 20% de opacidad. Los tokens ya incluyen
el borde; no se recalcula en componentes.

El texto del chip es **un paso más oscuro que el color de estado**, de modo que la pareja
texto/fondo cumple WCAG AA (≥ 4.5:1). Los tokens de estado clínico
(`--dm-color-success`, `--dm-color-warning`, `--dm-color-danger`,
`--dm-color-dispensario`) **no cambian**: siguen siendo `#16A34A`, `#D97706`, `#DC2626` y
`#0D9488` para iconos, barras y acentos. Solo cambia el token de texto del chip.

| Chip       | Fondo     | Texto     | Ratio texto/fondo | Borde                     |
| ---------- | --------- | --------- | ----------------- | ------------------------- |
| REGISTRADA | `#DCFCE7` | `#15803D` | 4.57:1 (AA)       | `rgba(21, 128, 61, 0.2)`  |
| PENDIENTE  | `#FEF3C7` | `#B45309` | 4.51:1 (AA)       | `rgba(180, 83, 9, 0.2)`   |
| ANULADA    | `#FEE2E2` | `#B91C1C` | 5.30:1 (AA)       | `rgba(185, 28, 28, 0.2)`  |
| Farmacia   | `#F0FDFA` | `#0F766E` | 5.25:1 (AA)       | `rgba(15, 118, 110, 0.2)` |

El borde deriva del **color de texto**, no del color de estado: así texto y borde comparten
la misma familia cromática y el chip no introduce un tercer tono. El borde es decorativo
(no delimita un control interactivo), por lo que no le aplica el 3:1 de WCAG 1.4.11; el
estado siempre se comunica además con la palabra del chip.

Tokens: `--dm-chip-<chip>-bg`, `--dm-chip-<chip>-text`, `--dm-chip-<chip>-border`.

### Contrastes declarados

Valores de referencia del design system aprobado en Stitch («Paleta Colores UNAPEC»):

- Navy `#0A3B75` sobre blanco: **AAA 10.4:1**.
- Navy dark `#062349` sobre blanco: **AAA 14.8:1**.
- Rojo institucional `#C8102E` sobre blanco: **AA 4.8:1**.
- Teal `#0D9488` sobre blanco: **AA 4.6:1**.

Estos valores son la referencia contractual del sistema y se conservan tal cual. La
columna «Medido» es el cálculo WCAG 2.x real (sRGB, luminancia relativa) sobre `#FFFFFF`,
recalculado para este repositorio:

| Color     | Declarado (Stitch) | Medido (WCAG real sobre blanco) | Resultado medido |
| --------- | ------------------ | ------------------------------- | ---------------- |
| `#0A3B75` | 10.4:1 (AAA)       | 11.08:1                         | AAA              |
| `#062349` | 14.8:1 (AAA)       | 15.62:1                         | AAA              |
| `#C8102E` | 4.8:1 (AA)         | 5.88:1                          | AA               |
| `#0D9488` | 4.6:1 (AA)         | **3.74:1**                      | **No AA**        |

Diferencias: los valores declarados son la referencia de diseño de Stitch y difieren de la
medición real en todos los casos (declarado siempre a la baja salvo el teal). La diferencia
material es la del teal: **`#0D9488` sobre blanco NO cumple AA para texto normal (3.74:1)**;
solo alcanza el 3:1 exigido a texto grande (≥ 24px, o ≥ 19px en negrita). Por eso:

- **Texto teal:** usar siempre `--dm-color-tertiary-text` (`#0F766E`, **5.47:1** sobre
  blanco). `--dm-color-tertiary` (`#0D9488`) queda para fondo, iconografía decorativa,
  bordes y acentos, nunca para texto normal.
- **Texto sobre navy:** `#FFFFFF` sobre `#0A3B75` (11.08:1) y sobre `#062349` (15.62:1)
  cumplen AAA.
- **Texto rojo:** `#C8102E` sobre blanco cumple AA (5.88:1); sobre su contenedor
  `#FEF2F2` también (5.38:1).

La matriz calculada del shell está en [Accesibilidad](#accesibilidad).

## Tipografía

- **UI:** Inter (400/500/600/700).
- **Datos tabulares:** JetBrains Mono (400/500), siempre con
  `font-variant-numeric: tabular-nums`.
- Fallbacks: `'Segoe UI', system-ui` para UI y `ui-monospace, 'Cascadia Mono', 'Consolas'`
  para mono.

### Escala (14 pasos)

| Paso                 | Size | Weight | Line-height | Tracking |
| -------------------- | ---- | ------ | ----------- | -------- |
| `headline-xl`        | 36   | 700    | 44          | -0.02em  |
| `headline-xl-mobile` | 28   | 700    | 36          | -0.01em  |
| `headline-lg`        | 30   | 600    | 38          | -0.015em |
| `headline-lg-mobile` | 24   | 600    | 32          | -0.01em  |
| `headline-md`        | 22   | 600    | 28          | 0        |
| `headline-sm`        | 18   | 600    | 24          | 0        |
| `title-md`           | 16   | 600    | 22          | 0        |
| `title-sm`           | 14   | 600    | 20          | 0        |
| `body-lg`            | 16   | 400    | 24          | 0        |
| `body-md`            | 14   | 400    | 20          | 0        |
| `body-sm`            | 12   | 400    | 16          | 0        |
| `label-lg`           | 14   | 500    | 20          | +0.01em  |
| `label-md`           | 12   | 500    | 16          | +0.02em  |
| `label-sm`           | 11   | 600    | 14          | +0.04em  |

Los tamaños se declaran en `rem` para respetar el zoom del usuario. Cada paso tiene sus
custom properties `--dm-text-<paso>-{size,weight,line-height,tracking}`.

### Uso

- Título de página: `headline-lg` (desktop) / `headline-lg-mobile` (mobile).
- Título de sección: `headline-sm` o `title-md`.
- Cuerpo: `body-md`; texto largo: `body-lg`.
- Labels y metadatos: `label-md`.
- Encabezado de tabla: `label-sm` en mayúsculas con tracking `0.05em` (ver Tablas).

### Utilidades

```html
<h1 class="dm-text-headline-lg">Pacientes</h1>
<p class="dm-text-body-md">Última actualización: hoy</p>
<span class="dm-mono">000-0000000-0</span>
<td class="dm-tabular-nums">1 240.00</td>
```

`dm-mono` aplica JetBrains Mono + cifras tabulares. `dm-tabular-nums` solo fija las cifras.

## Spacing y layout

### Escala de espaciado (base 8px con micro-pasos de 2 y 4)

| Token            | Valor   | px  |
| ---------------- | ------- | --- |
| `--dm-space-xxs` | .125rem | 2   |
| `--dm-space-xs`  | .25rem  | 4   |
| `--dm-space-sm`  | .5rem   | 8   |
| `--dm-space-md`  | 1rem    | 16  |
| `--dm-space-lg`  | 1.5rem  | 24  |
| `--dm-space-xl`  | 2rem    | 32  |
| `--dm-space-2xl` | 3rem    | 48  |

### Contenedor y grilla

- Contenedor máximo: `--dm-container-max: 1600px` (`.dm-container`).
- Grilla: `.dm-grid`, 12 columnas en desktop, 8 en tablet y 4 en mobile.
- Gutter: 24px / 16px / 12px según breakpoint.

### Breakpoints

Declarados una sola vez en `src/styles/_tokens.scss` como mixins `dm-desktop`, `dm-tablet`,
`dm-mobile`, `dm-tablet-up` y `dm-tablet-down`.

| Rango      | Columnas | Drawer                         | Gutter | Margen/padding |
| ---------- | -------- | ------------------------------ | ------ | -------------- |
| ≥ 1280px   | 12       | Persistente, 240px, colapsable | 24px   | 32px           |
| 768–1279px | 8        | Off-canvas (oculto)            | 16px   | 24px           |
| < 768px    | 4        | Off-canvas (oculto)            | 12px   | 16px           |

En mobile las tablas pasan a card-stack o a scroll horizontal dentro de un contenedor
declarado explícitamente; el documento nunca genera scroll horizontal.

## Radios

| Token              | Valor  | Uso                     |
| ------------------ | ------ | ----------------------- |
| `--dm-radius-sm`   | 4px    | Inputs y controles      |
| `--dm-radius-lg`   | 8px    | Cards, tablas y paneles |
| `--dm-radius-xl`   | 12px   | Diálogos y flyouts      |
| `--dm-radius-pill` | 9999px | Chips y badges          |

## Elevación

| Nivel | Token              | Valor                                                                            |
| ----- | ------------------ | -------------------------------------------------------------------------------- |
| 0     | `--dm-elevation-0` | `none` sobre canvas `#F8FAFC`                                                    |
| 1     | `--dm-elevation-1` | `0 1px 3px 0 rgba(15,23,42,.05)` + borde `#E2E8F0`                               |
| 2     | `--dm-elevation-2` | `0 4px 6px -1px rgba(15,23,42,.08), 0 2px 4px -2px rgba(15,23,42,.04)`           |
| 3     | `--dm-elevation-3` | `0 20px 25px -5px rgba(15,23,42,.1), 0 8px 10px -6px rgba(15,23,42,.05)` + scrim |

El scrim de nivel 3 es `--dm-scrim: rgba(15, 23, 42, 0.4)` (navy al 40%).

## Componentes

Los valores siguientes son la especificación. Varios componentes aún no están
implementados en `shared/`; cuando se implementen deben consumir estos tokens.

### Botones

- **Primario** (`mat-flat-button`): fondo `#0A3B75`, texto `#FFFFFF`, radio 4px, alto
  36px, padding `8px 16px`, hover `#062349`.
- **Destructivo**: `#C8102E` **solo** para anulación o alerta crítica.
- **Secundario** (`mat-stroked-button`): borde 1px `#E2E8F0`, texto `#0F172A`, hover
  fondo `#F8FAFC`.
- Foco visible: anillo de 2px `#1E5BB0` con offset 2px (sobre navy, anillo blanco).
- Alto mínimo de área táctil: 44px cuando el botón es solo icono.

### Form fields

- `appearance="outline"`.
- Borde `#E2E8F0`, fondo `#FFFFFF`, label `#64748B`.
- Foco: 2px `#0A3B75`. Error: `#DC2626`.
- Densidad `-1`/`-2` en barras de filtro y modales.
- Todo campo tiene `<mat-label>` o `aria-label`; nunca placeholder como única etiqueta.

### Chips clínicos

- Alto 24px, padding `2px 8px`, radio `9999px`, `label-sm` en mayúsculas.
- Fondo, texto y borde de los tokens `--dm-chip-*` (ver tabla). El texto es más oscuro que
  el color de estado para cumplir AA: REGISTRADA `#15803D` (4.57:1), PENDIENTE `#B45309`
  (4.51:1), ANULADA `#B91C1C` (5.30:1), Farmacia `#0F766E` (5.25:1).
- El texto del chip siempre nombra el estado (REGISTRADA, PENDIENTE, ANULADA, Farmacia);
  el color nunca es el único portador de la información.

### Tablas

- Header `#F8FAFC`, borde inferior 2px `#E2E8F0`, `label-sm` `#64748B` en mayúsculas con
  tracking `0.05em`.
- Filas de 48px, borde inferior 1px `#E2E8F0`, hover `#EFF6FF` con transición 150ms.
- Zebra opcional alternando `#FFFFFF` / `#F8FAFC`.
- Cédula, carnet, códigos e IDs: `dm-mono` (cifras tabulares).
- En mobile: card-stack o scroll horizontal en un contenedor con
  `overflow-x: auto` declarado.

### Cards y patient banner

- Fondo `#FFFFFF`, borde 1px `#E2E8F0`, radio 8px, padding `16px 24px`, elevación 1.
- Borde izquierdo de acento de 4px: navy por defecto, rojo para alerta, teal para
  seguimiento.
- El acento nunca reemplaza el texto de estado; acompaña.

### Layout shell (`dm-app-shell`)

- Topbar navy `#0A3B75` con la marca «Dispensario Médico» y el botón de menú (44px).
- Sidenav blanco de 240px en desktop, colapsable a 72px; off-canvas en tablet/mobile.
- Contenido sobre canvas `#F8FAFC`; footer blanco con texto `#64748B`.
- Sidenav con únicamente «Inicio» en esta entrega.
- Transiciones de 150ms; se anulan con `prefers-reduced-motion: reduce`.

## Reglas de uso del color

- **Rojo (`--dm-color-secondary`, `--dm-color-danger`)**: exclusivamente anulación,
  urgencia, error y acciones destructivas. Nunca como acento decorativo ni para
  "destacar" contenido normal.
- **Teal (`--dm-color-tertiary`)**: exclusivamente farmacia, dispensario y seguimiento
  clínico. Nunca para navegación, botones primarios ni estados neutros.
- **Navy**: marca, navegación, acción primaria y encabezados.
- **Success/warning/danger**: solo estados de registro; siempre acompañados de texto.
- No se introducen colores nuevos fuera de los tokens. Si falta un rol, se propone al
  design system antes de usarlo.

## Accesibilidad

- **Mínimo WCAG 2.2 AA:** 4.5:1 en texto normal, 3:1 en texto grande (≥24px o ≥19px bold)
  y 3:1 en componentes/indicadores de foco.
- **Foco visible:** anillo de 2px `--dm-focus-ring-color` con offset 2px; sobre navy se usa
  `--dm-focus-ring-color-inverse`. Nunca se elimina `outline` sin reemplazo.
- **Skip link:** primer elemento enfocable del shell; salta a `#dm-main-content`.
- **Landmarks:** `header`, `nav` (con `aria-label`), `main`, `footer`.
- **Toggle del menú:** `aria-expanded`, `aria-controls="dm-primary-nav"` y label dinámico.
- **Drawer off-canvas:** se cierra con `Escape` y con el botón de backdrop; cuando está
  cerrado queda `inert` y fuera del orden de tabulación.
- **Formularios:** label asociado, mensajes de error con `aria-describedby`, sin depender
  solo del color.
- **Tablas:** `<th scope="col">`, caption o título accesible; cifras tabulares.
- **Contenido no textual:** iconos decorativos con `aria-hidden="true"`; iconos con
  significado, con nombre accesible.

### Matriz de contraste del shell

Calculada con la fórmula WCAG 2.x (sRGB). Todas las combinaciones del shell cumplen AA.

| Texto / fondo                                 | Ratio   | Resultado |
| --------------------------------------------- | ------- | --------- |
| `#FFFFFF` sobre `#0A3B75` (topbar, skip link) | 11.08:1 | AAA       |
| `#FFFFFF` sobre `#062349` (hover del toggle)  | 15.62:1 | AAA       |
| `#0F172A` sobre `#F8FAFC` (contenido)         | 17.06:1 | AAA       |
| `#0F172A` sobre `#FFFFFF` (sidenav, footer)   | 17.85:1 | AAA       |
| `#64748B` sobre `#FFFFFF` (footer)            | 4.76:1  | AA        |
| `#64748B` sobre `#F8FAFC` (texto secundario)  | 4.55:1  | AA        |
| `#0A3B75` sobre `#EFF6FF` (ítem activo)       | 10.18:1 | AAA       |
| `#1E5BB0` sobre `#FFFFFF` (anillo de foco)    | 6.61:1  | AA (UI)   |

### Contraste de los chips

Las cuatro combinaciones texto/fondo de los chips cumplen AA para texto normal (medidas
sobre el fondo real del chip):

| Chip       | Texto     | Fondo     | Ratio  | Resultado |
| ---------- | --------- | --------- | ------ | --------- |
| REGISTRADA | `#15803D` | `#DCFCE7` | 4.57:1 | AA        |
| PENDIENTE  | `#B45309` | `#FEF3C7` | 4.51:1 | AA        |
| ANULADA    | `#B91C1C` | `#FEE2E2` | 5.30:1 | AA        |
| Farmacia   | `#0F766E` | `#F0FDFA` | 5.25:1 | AA        |

Los textos anteriores (`#16A34A`, `#D97706`, `#DC2626`, `#0D9488`, es decir los colores de
estado puros) daban 3.00:1, 2.86:1, 3.95:1 y 3.59:1 respectivamente y **no** cumplían AA;
por eso el chip usa un token de texto propio. PENDIENTE es la pareja más ajustada
(4.51:1): no se debe aclarar `#B45309` ni `#FEF3C7` sin volver a medir.

## Limitaciones conocidas

Riesgos aceptados en esta entrega, documentados para que no se redescubran como defectos:

- **Breakpoint 1280 duplicado.** El valor vive en dos sitios: `$dm-breakpoint-desktop` en
  `src/styles/_tokens.scss` (que gobierna los mixins SCSS) y la constante
  `DESKTOP_MEDIA_QUERY` en `src/app/core/layout/app-shell.ts` (que gobierna la señal
  `isDesktop()` de TypeScript). No existe puente build-time entre Sass y TS, así que **si
  cambia el token hay que cambiar la constante a mano**. El breakpoint de 768 no está
  duplicado: el shell sólo necesita saber si está en desktop.
- **Namespacing de CSS custom properties.** Hoy las custom properties `--dm-*` se emiten en
  `:root` sin prefijo y los estilos de componente las consumen con `var(--dm-*)`. Si se
  habilita `provideCssVarNamespacing()` (Angular 22), las propiedades declaradas por
  componentes pasan a llevar prefijo y esas referencias dejan de resolver. La función **no
  está activa**; si se activa, hay que consumir el prefijo `--global--` (por ejemplo
  `var(--global--dm-color-primary)`) o declarar los tokens en el ámbito correcto.
- **Off-canvas sin focus-trap ni bloqueo de scroll.** El drawer cerrado queda `inert` y el
  orden de tabulación es correcto, pero al abrirse no se atrapa el foco dentro del panel ni
  se bloquea el scroll del fondo. Candidato a una feature de accesibilidad posterior.

## Implementación

- Tokens: `src/styles/_tokens.scss` (partial, sin CSS propio al importarse).
- Emisión global: `@include dm.dm-emit-tokens;` en `src/styles.scss`.
- Tipografía: `@include dm.dm-typescale(body-md);` o las clases `.dm-text-*`.
- Breakpoints: `@include dm.dm-desktop { ... }`, `dm.dm-tablet`, `dm.dm-mobile`.
- Material 3: `mat.theme()` en `src/styles.scss` con paletas custom derivadas de
  `#0A3B75` (primary), `#C8102E` (secondary) y `#0D9488` (tertiary), tipografía Inter y
  `density: 0`. `--mat-sys-*` queda reservado a lo que genera Material.
- No se usan valores hex sueltos en componentes: siempre `var(--dm-*)`.
