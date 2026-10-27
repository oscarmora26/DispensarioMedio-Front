/**
 * Dominio de gestión de usuarios (F-006).
 *
 * El backend responde en `snake_case` y distingue `role_id` (petición) de
 * `role` (respuesta, §7 de `docs/03-api-rest.md`); los componentes trabajan
 * con `ManagedUser` en `camelCase`. Toda la conversión vive únicamente en
 * este módulo (`toManagedUser()`, `toCreatePayload()`, `toUpdatePayload()`),
 * el mismo patrón que `toAuthUser()` en autenticación. No se usa `any`.
 *
 * Residual R-01: el ejemplo de §7 fija `role_id: 2` → `MEDICO`, pero la doc no
 * fija la tabla completa (`ADMIN` = ¿1?). Hasta que el OpenAPI lo confirme, la
 * tabla vive aislada en `ROLE_ID_BY_ROLE` para un cambio de una sola línea.
 */

import { UserRole } from '../../core/auth/auth.models';

/** Opción de rol ofrecida en crear/editar (mismo mapa legible del shell). */
export interface UserRoleOption {
  value: 'ADMIN' | 'MEDICO';
  label: string;
}

/** Roles seleccionables en el formulario con su etiqueta en español. */
export const USER_ROLE_OPTIONS: readonly UserRoleOption[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MEDICO', label: 'Médico' },
];

/**
 * Tabla provisional `role` ↔ `role_id` (R-01, pendiente de OpenAPI).
 * §7 muestra `role_id: 2` → `MEDICO`; se asume `ADMIN` = 1.
 */
const ROLE_ID_BY_ROLE: Readonly<Record<'ADMIN' | 'MEDICO', number>> = {
  ADMIN: 1,
  MEDICO: 2,
};

/** Convierte el rol del formulario a su `role_id` del backend. */
export function toRoleId(role: 'ADMIN' | 'MEDICO'): number {
  return ROLE_ID_BY_ROLE[role];
}

/**
 * Etiqueta legible del rol (`ADMIN` → «Administrador», `MEDICO` → «Médico»;
 * un rol no previsto se muestra tal cual, sin lógica de permisos).
 */
export function roleLabel(role: UserRole): string {
  if (role === 'ADMIN') {
    return 'Administrador';
  }
  if (role === 'MEDICO') {
    return 'Médico';
  }
  return role;
}

/** Usuario gestionado tal como lo consume el frontend. */
export interface ManagedUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  doctorId: number | null;
  isActive: boolean;
}

/** Ítem tal como lo devuelve el backend (`snake_case`, `role` en texto). */
export interface ManagedUserDto {
  id: number;
  username: string;
  email: string;
  role: string;
  doctor_id: number | null;
  is_active: boolean;
}

/** Respuesta paginada de `GET /v1/users` (§2: `{items, total, page, size, pages}`). */
export interface UserListResponseDto {
  items: ManagedUserDto[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/** Página de usuarios ya mapeada a `camelCase` para los componentes. */
export interface UserListPage {
  items: ManagedUser[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/** Parámetros de `GET /v1/users`: `page` desde 1, `size` máx. 100 (RNF-06). */
export interface UserListParams {
  page: number;
  size: number;
  search?: string;
  isActive?: boolean;
  sort?: string;
}

/** Body de `POST /v1/users` (§7). */
export interface UserCreatePayloadDto {
  username: string;
  email: string;
  password: string;
  role_id: number;
  doctor_id: number | null;
  is_active: boolean;
}

/**
 * Body de `PUT /v1/users/{id}` (reemplazo completo, sin `PATCH`): mismos campos
 * que al crear salvo `password`, que nunca viaja en el PUT («No modifica la
 * contraseña», OpenAPI `UserUpdate`; el cambio de contraseña vive en una
 * feature posterior (`reset-password`).
 */
export interface UserUpdatePayloadDto {
  username: string;
  email: string;
  role_id: number;
  doctor_id: number | null;
  is_active: boolean;
}

/** Entrada del formulario de creación (valores `camelCase` sin recortar). */
export interface UserCreateInput {
  username: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'MEDICO';
  doctorId: number | null;
  isActive: boolean;
}

/**
 * Entrada del formulario de edición. `password` se conserva como opcional solo
 * por compatibilidad con llamadas existentes, pero se ignora siempre: nunca
 * forma parte del `PUT` («No modifica la contraseña»; el cambio de contraseña
 * vive en una feature posterior `reset-password`).
 */
export interface UserUpdateInput {
  username: string;
  email: string;
  password?: string;
  role: 'ADMIN' | 'MEDICO';
  doctorId: number | null;
  isActive: boolean;
}

/** Convierte un ítem del backend al modelo del frontend. */
export function toManagedUser(dto: ManagedUserDto): ManagedUser {
  return {
    id: dto.id,
    username: dto.username,
    email: dto.email,
    role: dto.role,
    doctorId: dto.doctor_id,
    isActive: dto.is_active,
  };
}

/** Convierte la página del backend (`snake_case`) a `UserListPage`. */
export function toUserListPage(dto: UserListResponseDto): UserListPage {
  return {
    items: dto.items.map(toManagedUser),
    total: dto.total,
    page: dto.page,
    size: dto.size,
    pages: dto.pages,
  };
}

/**
 * Construye el body de creación: `email`/`username` con `trim`, contraseña
 * intacta, `role` → `role_id` y `doctor_id` solo para `MEDICO` (§7: solo un
 * médico puede tener `doctor_id`; con `ADMIN` se envía `null`).
 */
export function toCreatePayload(input: UserCreateInput): UserCreatePayloadDto {
  return {
    username: input.username.trim(),
    email: input.email.trim(),
    password: input.password,
    role_id: toRoleId(input.role),
    doctor_id: input.role === 'MEDICO' ? input.doctorId : null,
    is_active: input.isActive,
  };
}

/**
 * Construye el body de actualización (reemplazo completo): `email`/`username`
 * con `trim`, `role` → `role_id`, `doctor_id` solo para `MEDICO` y el
 * `is_active` vigente. `password` (si se informa) se ignora siempre: el PUT
 * no modifica la contraseña (OpenAPI `UserUpdate` sin `password`, R-02).
 */
export function toUpdatePayload(input: UserUpdateInput): UserUpdatePayloadDto {
  return {
    username: input.username.trim(),
    email: input.email.trim(),
    role_id: toRoleId(input.role),
    doctor_id: input.role === 'MEDICO' ? input.doctorId : null,
    is_active: input.isActive,
  };
}
