/**
 * Tipos del dominio de autenticación.
 *
 * El backend responde en `snake_case`; los componentes trabajan con el modelo
 * `AuthUser` en `camelCase`. La conversión vive únicamente en `toAuthUser()`,
 * de modo que ningún componente, guard ni interceptor conoce el formato del
 * backend. No se usa `any` en este módulo.
 */

/**
 * Rol conocido por el frontend. Los valores no previstos se conservan tal cual
 * (tolerancia en tiempo de ejecución) para que la UI pueda mostrarlos sin
 * romper; la etiqueta legible se resuelve en el shell con fallback al valor
 * crudo.
 */
export type UserRole = 'ADMIN' | 'MEDICO' | (string & {});

/** Usuario de la sesión tal como lo consume el frontend. */
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  doctorId: number | null;
}

/** Credenciales del formulario de inicio de sesión (variante `email`). */
export interface LoginCredentials {
  email: string;
  password: string;
}

/** Usuario tal como lo devuelve el backend (`snake_case`). */
export interface BackendUserPayload {
  id: number;
  username: string;
  email: string;
  role: string;
  doctor_id: number | null;
}

/** Respuesta de `POST /api/v1/auth/login`. */
export interface LoginResponseDto {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: BackendUserPayload;
}

/** Respuesta de `GET /api/v1/auth/me`. */
export interface MeResponseDto extends BackendUserPayload {
  is_active: boolean;
}

/**
 * Convierte el payload del backend al modelo del frontend. Único punto de
 * mapeo `snake_case` → `camelCase` (`doctor_id` → `doctorId`).
 */
export function toAuthUser(payload: BackendUserPayload): AuthUser {
  return {
    id: payload.id,
    username: payload.username,
    email: payload.email,
    role: payload.role,
    doctorId: payload.doctor_id,
  };
}
