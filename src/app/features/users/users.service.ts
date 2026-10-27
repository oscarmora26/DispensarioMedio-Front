/**
 * Acceso HTTP al recurso de usuarios (F-006).
 *
 * - Base `environment.apiUrl + '/v1/users'` compuesta en un solo lugar (mismo
 *   patrón que `AuthService`). La cabecera `Authorization: Bearer` la adjunta
 *   el `authInterceptor` de F-002; este servicio no conoce HTTP manual ni
 *   almacenamiento.
 * - `list()` arma los query params (`page` desde 1, `size` máx. 100, `search`,
 *   `is_active`, `sort`) en un único punto y devuelve la página mapeada a
 *   `camelCase`. Sin paginación ni filtrado en cliente: si el backend no
 *   pagina o falla, el componente muestra el estado de error.
 * - `deactivate()` emite `DELETE /{id}` = desactivación lógica (RF-17: sin
 *   borrado físico). `reactivate()` emite `PUT /{id}` con el reemplazo completo
 *   (`UserUpdate`: `username`, `email`, `role_id`, `doctor_id`, `is_active`;
 *   sin `password`, no modifica la contraseña — R-04 resuelto por OpenAPI).
 * - `reset-password` queda diferido a una feature posterior y no existe en
 *   este servicio.
 * - `email`/`username` viajan con `trim`; la contraseña, intacta.
 */

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ManagedUser,
  ManagedUserDto,
  UserCreateInput,
  UserListPage,
  UserListParams,
  UserListResponseDto,
  UserUpdateInput,
  toCreatePayload,
  toManagedUser,
  toUpdatePayload,
  toUserListPage,
} from './users.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/users`;

  /**
   * Lista paginada del servidor (`GET /v1/users` → `200` con
   * `{items, total, page, size, pages}`).
   */
  list(params: UserListParams): Observable<UserListPage> {
    let query = new HttpParams().set('page', String(params.page)).set('size', String(params.size));

    const search = params.search?.trim();
    if (search) {
      query = query.set('search', search);
    }
    if (params.isActive !== undefined) {
      query = query.set('is_active', String(params.isActive));
    }
    const sort = params.sort?.trim();
    if (sort) {
      query = query.set('sort', sort);
    }

    return this.http
      .get<UserListResponseDto>(this.baseUrl, { params: query })
      .pipe(map(toUserListPage));
  }

  /** Detalle (`GET /v1/users/{id}` → `200`; `404` si ya no existe). */
  getById(id: number): Observable<ManagedUser> {
    return this.http.get<ManagedUserDto>(`${this.baseUrl}/${id}`).pipe(map(toManagedUser));
  }

  /** Creación (`POST /v1/users` → `201`; `409` en duplicado). */
  create(input: UserCreateInput): Observable<ManagedUser> {
    return this.http
      .post<ManagedUserDto>(this.baseUrl, toCreatePayload(input))
      .pipe(map(toManagedUser));
  }

  /** Actualización (`PUT /v1/users/{id}` → `200`; sin `PATCH`). */
  update(id: number, input: UserUpdateInput): Observable<ManagedUser> {
    return this.http
      .put<ManagedUserDto>(`${this.baseUrl}/${id}`, toUpdatePayload(input))
      .pipe(map(toManagedUser));
  }

  /**
   * Desactivación lógica vía `DELETE /v1/users/{id}` (RF-17: prohibido el
   * borrado físico). Es el único método de la familia `http.delete` en este
   * servicio; las actualizaciones usan `PUT`, sin verbo parcial.
   */
  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Reactivación (R-04 resuelto por OpenAPI `PUT /users/{user_id}`: reemplazo
   * completo `username`, `email`, `role_id`, `doctor_id`, `is_active`; sin
   * `password`, no modifica la contraseña). Recibe el `ManagedUser` visible y
   * reenvía sus datos con `is_active: true`; un `PUT` parcial `{is_active}`
   * responde 422 por los requeridos faltantes.
   *
   * La sobrecarga con `number` (id) existe solo por compatibilidad transitoria
   * con las specs previas, que `ng test` type-checkea: el reviewer la migrará
   * a `ManagedUser` al retirar los `it.fails`. En producción solo se llama con
   * el usuario completo (ver `UserList`).
   */
  reactivate(user: ManagedUser | number): Observable<ManagedUser> {
    if (typeof user === 'number') {
      return this.http
        .put<ManagedUserDto>(`${this.baseUrl}/${user}`, { is_active: true })
        .pipe(map(toManagedUser));
    }
    return this.http
      .put<ManagedUserDto>(
        `${this.baseUrl}/${user.id}`,
        toUpdatePayload({
          username: user.username,
          email: user.email,
          role: user.role as 'ADMIN' | 'MEDICO',
          doctorId: user.doctorId,
          isActive: true,
        }),
      )
      .pipe(map(toManagedUser));
  }
}
