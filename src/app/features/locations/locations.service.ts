/**
 * Acceso HTTP al catálogo de ubicaciones (F-011).
 *
 * - Base `environment.apiUrl + '/v1/locations'` compuesta en un solo lugar
 *   (mismo patrón que `AuthService`/`UsersService`). La cabecera
 *   `Authorization: Bearer` la adjunta el `authInterceptor` de F-002; este
 *   servicio no conoce almacenamiento ni el rol del usuario.
 * - `list()` arma los query params (`page` desde 1, `size` 1-100, `search`,
 *   `is_active`, `sort`) en un único punto y devuelve la página mapeada a
 *   `camelCase`. Sin paginación ni filtrado en cliente.
 * - `deactivate()` emite `DELETE /{id}` = desactivación lógica (`is_active`,
 *   S4): nunca hay borrado físico. `reactivate()` emite el `PUT` de reemplazo
 *   completo con `is_active: true`, porque un `PUT` parcial responde `422`
 *   por los campos requeridos faltantes (mismo criterio R-04 de F-006).
 */

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Location,
  LocationDto,
  LocationFormInput,
  LocationListPage,
  LocationListParams,
  LocationListResponseDto,
  toLocation,
  toLocationListPage,
  toLocationPayload,
} from './locations.models';

@Injectable({ providedIn: 'root' })
export class LocationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/locations`;

  /**
   * Lista paginada del servidor (`GET /v1/locations` → `200` con
   * `{items, total, page, size, pages}`).
   */
  list(params: LocationListParams): Observable<LocationListPage> {
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
      .get<LocationListResponseDto>(this.baseUrl, { params: query })
      .pipe(map(toLocationListPage));
  }

  /** Detalle (`GET /v1/locations/{id}` → `200`; `404` si ya no existe). */
  getById(id: number): Observable<Location> {
    return this.http.get<LocationDto>(`${this.baseUrl}/${id}`).pipe(map(toLocation));
  }

  /** Creación (`POST /v1/locations` → `201`; `409` en descripción duplicada). */
  create(input: LocationFormInput): Observable<Location> {
    return this.http.post<LocationDto>(this.baseUrl, toLocationPayload(input)).pipe(map(toLocation));
  }

  /** Actualización (`PUT /v1/locations/{id}` → `200`; sin `PATCH`). */
  update(id: number, input: LocationFormInput): Observable<Location> {
    return this.http
      .put<LocationDto>(`${this.baseUrl}/${id}`, toLocationPayload(input))
      .pipe(map(toLocation));
  }

  /**
   * Desactivación lógica vía `DELETE /v1/locations/{id}` (S4: nunca borrado
   * físico). Es el único método de la familia `http.delete` del servicio.
   */
  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Reactivación: reenvía el registro visible con `is_active: true` en el
   * `PUT` de reemplazo completo (`description` + `is_active`). Un `PUT`
   * parcial `{is_active}` responde `422` por los requeridos faltantes.
   */
  reactivate(location: Location): Observable<Location> {
    return this.http
      .put<LocationDto>(
        `${this.baseUrl}/${location.id}`,
        toLocationPayload({ description: location.description, shelf: location.shelf, section: location.section, cell: location.cell, isActive: true }),
      )
      .pipe(map(toLocation));
  }
}
