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
