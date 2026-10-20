# Dispensario Médico — Frontend

Aplicación web Angular para la gestión de un dispensario médico. Este repositorio contiene solo el frontend; el backend se mantiene en otro repositorio.

## Stack

- Angular 22.2.x (standalone, zoneless)
- TypeScript 6
- SCSS
- Angular Material 22 + CDK
- Vitest
- ESLint + Prettier
- Docker multi-stage + Nginx unprivileged

## Requisitos

- Node.js `>= 24.15` (probado con `24.20.0`)
- npm `11.x`
- Docker Desktop para construir/probar la imagen

## Desarrollo

```bash
npm install
npm start
```

La app queda disponible en `http://localhost:4200`.

## Comandos

| Comando                     | Descripción                    |
| --------------------------- | ------------------------------ |
| `npm start`                 | Servidor de desarrollo         |
| `npm run build`             | Build de producción en `dist/` |
| `npm test`                  | Tests unitarios con Vitest     |
| `npm run test:watch`        | Tests en modo watch            |
| `npm run lint`              | ESLint                         |
| `npm run format`            | Formatear con Prettier         |
| `npm run format:check`      | Verificar formato              |
| `npm run check`             | lint + tests + build           |
| `npm run docker:build`      | Construir la imagen Docker     |
| `npm run docker:up`         | Levantar con Docker Compose    |
| `npm run docker:down`       | Detener Docker Compose         |
| `npm run docker:logs`       | Ver logs del contenedor        |
| `npm run features:list`     | Listar features                |
| `npm run features:next`     | Siguiente feature aprobada     |
| `npm run features:validate` | Validar `feature-list.md`      |

## Docker

```bash
npm run docker:build
npm run docker:up
```

La aplicación se sirve en `http://localhost:8080`.

- Build multi-stage: `node:24.20.0-alpine` → `nginxinc/nginx-unprivileged:1.30-alpine`.
- Nginx corre como usuario no-root en el puerto `8080`.
- Healthcheck: `GET /healthz`.
- Fallback SPA: cualquier ruta desconocida devuelve `index.html`.
- TLS se termina en un proxy/ingress externo.
- No hay proxy `/api` hasta que exista el backend.

## Estructura

```text
src/app/
├── core/        # auth, HTTP, layout, guards, interceptores
├── shared/      # componentes, pipes y directivas reutilizables
├── features/    # funcionalidades de dominio
├── app.ts
├── app.config.ts
└── app.routes.ts
```

## AgentTeam

El proyecto usa un AgentTeam de OpenCode:

- `team-lead`: orquesta y solo ejecuta features aprobadas.
- `spec-author`: descompone requisitos en features y tareas.
- `implementer`: implementa una feature aprobada.
- `reviewer`: escribe/ejecuta tests y valida criterios.

Los agentes están en `.opencode/agents/`.

### Flujo de features

1. El humano entrega un requisito.
2. `spec-author` crea la feature en `proposed`.
3. El humano revisa y cambia a `approved` en `feature-list.md`.
4. `team-lead` lanza `implementer`.
5. `reviewer` valida y reporta `PASS`/`FAIL`.
6. Si pasa, la feature queda `done`; si no, vuelve a `changes_requested`.

Estados: `proposed`, `approved`, `in_progress`, `in_review`, `changes_requested`, `done`, `blocked`, `rejected`.

## Variables de entorno

La configuración es build-time:

- `src/environments/environment.ts` → desarrollo.
- `src/environments/environment.production.ts` → producción.

Ambas usan `apiUrl: '/api'` como placeholder. Ajusta la URL cuando exista el backend.

## Seguridad

- No incluyas datos reales de pacientes en el repositorio.
- No commitees secretos ni `.env`.
- El frontend es público: no pongas credenciales en el bundle.
