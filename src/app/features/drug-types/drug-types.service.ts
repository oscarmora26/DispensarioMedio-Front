/**
 * Acceso HTTP al catálogo de tipos de fármacos (F-009).
 *
 * - Base `environment.apiUrl + '/v1/drug-types'` compuesta en un solo lugar
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
  DrugType,
  DrugTypeDto,
  DrugTypeFormInput,
  DrugTypeListPage,
  DrugTypeListParams,
  DrugTypeListResponseDto,
  toDrugType,
  toDrugTypeListPage,
  toDrugTypePayload,
} from './drug-types.models';

@Injectable({ providedIn: 'root' })
export class DrugTypesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/drug-types`;

  /**
   * Lista paginada del servidor (`GET /v1/drug-types` → `200` con
   * `{items, total, page, size, pages}`).
   */
  list(params: DrugTypeListParams): Observable<DrugTypeListPage> {
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
      .get<DrugTypeListResponseDto>(this.baseUrl, { params: query })
      .pipe(map(toDrugTypeListPage));
  }

  /** Detalle (`GET /v1/drug-types/{id}` → `200`; `404` si ya no existe). */
  getById(id: number): Observable<DrugType> {
    return this.http.get<DrugTypeDto>(`${this.baseUrl}/${id}`).pipe(map(toDrugType));
  }

  /** Creación (`POST /v1/drug-types` → `201`; `409` en descripción duplicada). */
  create(input: DrugTypeFormInput): Observable<DrugType> {
    return this.http
      .post<DrugTypeDto>(this.baseUrl, toDrugTypePayload(input))
      .pipe(map(toDrugType));
  }

  /** Actualización (`PUT /v1/drug-types/{id}` → `200`; sin `PATCH`). */
  update(id: number, input: DrugTypeFormInput): Observable<DrugType> {
    return this.http
      .put<DrugTypeDto>(`${this.baseUrl}/${id}`, toDrugTypePayload(input))
      .pipe(map(toDrugType));
  }

  /**
   * Desactivación lógica vía `DELETE /v1/drug-types/{id}` (S4: nunca borrado
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
  reactivate(drugType: DrugType): Observable<DrugType> {
    return this.http
      .put<DrugTypeDto>(
        `${this.baseUrl}/${drugType.id}`,
        toDrugTypePayload({ description: drugType.description, isActive: true }),
      )
      .pipe(map(toDrugType));
  }
}
