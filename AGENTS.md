# AGENTS.md — Dispensario Médico Frontend

## Proyecto

Aplicación web de gestión para un dispensario médico. Este repositorio contiene **solo el frontend Angular**. El backend vivirá en otro repositorio.

## Stack

- Angular 22.2.x, standalone components, zoneless, Vitest.
- TypeScript estricto, SCSS.
- Angular Material 22 + CDK, tema Azure/Blue.
- ESLint + Prettier.
- Docker multi-stage + Nginx no-root para producción.

## Comandos

```bash
npm start              # servidor de desarrollo
npm run build          # build de producción
npm test               # tests unitarios (Vitest, sin watch)
npm run test:watch     # tests en watch
npm run lint           # ESLint
npm run format         # Prettier
npm run format:check   # verificar formato
npm run check          # lint + tests + build
npm run docker:build   # construir imagen
npm run docker:up      # docker compose up --build -d
npm run docker:down    # detener compose
npm run docker:logs    # logs del contenedor
npm run features:list  # listar features
npm run features:next  # siguiente feature aprobada
npm run features:validate # validar feature-list.md
```

## Arquitectura

```text
src/app/
├── core/        # singletons: auth, HTTP, layout, guards, interceptores
├── shared/      # componentes, pipes y directivas reutilizables
├── features/    # funcionalidades de dominio
├── app.ts
├── app.config.ts
└── app.routes.ts
```

- Usa `features/<nombre>/` para cada funcionalidad.
- Los servicios singleton van en `core/`.
- Los componentes reutilizables van en `shared/`.
- No crees un `SharedModule`; usa imports explícitos de componentes standalone.
- Prefiere `inject()` sobre inyección por constructor.
- Usa signals para estado local y `resource`/`httpResource` para datos remotos cuando aplique.
- Usa control flow nativo (`@if`, `@for`, `@switch`), no `*ngIf`/`*ngFor`.
- Nombra archivos con la guía 2025: `patient-list.ts`, no `patient-list.component.ts`.
- Prefijo de selectores: `dm-`.

## Tests

- Runner: Vitest con Angular TestBed.
- Cada componente/servicio debe tener tests relevantes.
- El reviewer escribe y mantiene los tests; el implementer no edita archivos `*.spec.ts`.
- Comando de verdad: `npm test`.
- No uses datos reales de pacientes; usa datos sintéticos.

## Accesibilidad

- Usa HTML semántico y componentes Angular Material accesibles.
- Toda entrada debe tener label o `aria-label`.
- Verifica navegación por teclado y foco visible.
- No elimines outlines sin un reemplazo accesible.

## Seguridad y datos

- No commitees secretos, tokens, credenciales ni `.env`.
- No incluyas datos personales o de salud reales en código, tests, fixtures o logs.
- La URL del API se configura en `src/environments/` y se hornea en build-time.
- No pongas secretos en variables de Angular: el bundle es público.

## Docker y Nginx

- `Dockerfile` multi-stage: Node 24 para build, Nginx unprivileged para runtime.
- Nginx escucha en `8080` y sirve la SPA con fallback a `index.html`.
- HTTPS se termina en un proxy/ingress externo; el contenedor no maneja TLS.
- No hay proxy `/api` todavía. Cuando exista backend, se resuelve en Nginx o en el ingress.
- Valida con `docker compose config` y `docker build`.

## AgentTeam

- `team-lead` orquesta y es el agente por defecto.
- `spec-author` crea features en `proposed`.
- `implementer` implementa solo features `approved`.
- `reviewer` crea/ejecuta tests y reporta `PASS`/`FAIL`.

### Reglas del flujo

1. Solo el humano puede aprobar una feature (`proposed` → `approved`).
2. El líder verifica la aprobación antes de implementar.
3. Una sola feature `in_progress` a la vez.
4. El reviewer no modifica código de producción.
5. Nadie hace `git commit` ni `git push` sin decisión humana.
6. Si falta información, la feature pasa a `blocked`; no se inventa alcance.
7. `done` requiere `PASS` del reviewer, lint, tests y build.

La fuente de verdad es `feature-list.md`. Los estados y transiciones están documentados allí.

## Git

- No hagas `git push` sin autorización explícita.
- No hagas commits automáticos durante features; el humano decide.
- Mantén el `.gitignore` actualizado.
