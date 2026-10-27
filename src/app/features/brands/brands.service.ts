/**
 * Acceso HTTP al catálogo de marcas (F-010).
 *
 * - Base `environment.apiUrl + '/v1/brands'` compuesta en un solo lugar
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
  Brand,
  BrandDto,
  BrandFormInput,
  BrandListPage,
  BrandListParams,
  BrandListResponseDto,
  toBrand,
  toBrandListPage,
  toBrandPayload,
} from './brands.models';

@Injectable({ providedIn: 'root' })
export class BrandsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/brands`;

  /**
   * Lista paginada del servidor (`GET /v1/brands` → `200` con
   * `{items, total, page, size, pages}`).
   */
  list(params: BrandListParams): Observable<BrandListPage> {
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
      .get<BrandListResponseDto>(this.baseUrl, { params: query })
      .pipe(map(toBrandListPage));
  }

  /** Detalle (`GET /v1/brands/{id}` → `200`; `404` si ya no existe). */
  getById(id: number): Observable<Brand> {
    return this.http.get<BrandDto>(`${this.baseUrl}/${id}`).pipe(map(toBrand));
  }

  /** Creación (`POST /v1/brands` → `201`; `409` en descripción duplicada). */
  create(input: BrandFormInput): Observable<Brand> {
    return this.http.post<BrandDto>(this.baseUrl, toBrandPayload(input)).pipe(map(toBrand));
  }

  /** Actualización (`PUT /v1/brands/{id}` → `200`; sin `PATCH`). */
  update(id: number, input: BrandFormInput): Observable<Brand> {
    return this.http
      .put<BrandDto>(`${this.baseUrl}/${id}`, toBrandPayload(input))
      .pipe(map(toBrand));
  }

  /**
   * Desactivación lógica vía `DELETE /v1/brands/{id}` (S4: nunca borrado
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
  reactivate(brand: Brand): Observable<Brand> {
    return this.http
      .put<BrandDto>(
        `${this.baseUrl}/${brand.id}`,
        toBrandPayload({ description: brand.description, isActive: true }),
      )
      .pipe(map(toBrand));
  }
}
