/**
 * Acceso HTTP al catálogo de medicamentos (F-012).
 *
 * - Base `environment.apiUrl + '/v1/medications'` compuesta en un solo lugar
 *   (mismo patrón que `AuthService`/`UsersService`). La cabecera
 *   `Authorization: Bearer` la adjunta el `authInterceptor` de F-002; este
 *   servicio no conoce almacenamiento ni el rol del usuario.
 * - `list()` arma los query params (`page` desde 1, `size` 1-100, `search`,
 *   `is_active`, `drug_type_id`, `brand_id`, `location_id`, `sort`) en un único
 *   punto y devuelve la página mapeada a `camelCase`. Sin paginación ni
 *   filtrado en cliente.
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
  Medication,
  MedicationDto,
  MedicationFormInput,
  MedicationListPage,
  MedicationListParams,
  MedicationListResponseDto,
  toMedication,
  toMedicationListPage,
  toMedicationPayload,
} from './medications.models';

@Injectable({ providedIn: 'root' })
export class MedicationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/medications`;

  /**
   * Lista paginada del servidor (`GET /v1/medications` → `200` con
   * `{items, total, page, size, pages}`).
   */
  list(params: MedicationListParams): Observable<MedicationListPage> {
    let query = new HttpParams().set('page', String(params.page)).set('size', String(params.size));

    const search = params.search?.trim();
    if (search) {
      query = query.set('search', search);
    }
    if (params.isActive !== undefined) {
      query = query.set('is_active', String(params.isActive));
    }
    if (params.drugTypeId !== undefined) {
      query = query.set('drug_type_id', String(params.drugTypeId));
    }
    if (params.brandId !== undefined) {
      query = query.set('brand_id', String(params.brandId));
    }
    if (params.locationId !== undefined) {
      query = query.set('location_id', String(params.locationId));
    }
    const sort = params.sort?.trim();
    if (sort) {
      query = query.set('sort', sort);
    }

    return this.http
      .get<MedicationListResponseDto>(this.baseUrl, { params: query })
      .pipe(map(toMedicationListPage));
  }

  /** Detalle (`GET /v1/medications/{id}` → `200`; `404` si ya no existe). */
  getById(id: number): Observable<Medication> {
    return this.http.get<MedicationDto>(`${this.baseUrl}/${id}`).pipe(map(toMedication));
  }

  /** Creación (`POST /v1/medications` → `201`; `409` en duplicado; `404` si catálogo inactivo). */
  create(input: MedicationFormInput): Observable<Medication> {
    return this.http
      .post<MedicationDto>(this.baseUrl, toMedicationPayload(input))
      .pipe(map(toMedication));
  }

  /** Actualización (`PUT /v1/medications/{id}` → `200`; sin `PATCH`). */
  update(id: number, input: MedicationFormInput): Observable<Medication> {
    return this.http
      .put<MedicationDto>(`${this.baseUrl}/${id}`, toMedicationPayload(input))
      .pipe(map(toMedication));
  }

  /**
   * Desactivación lógica vía `DELETE /v1/medications/{id}` (S4: nunca borrado
   * físico). Es el único método de la familia `http.delete` del servicio.
   */
  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Reactivación: reenvía el registro visible con `is_active: true` en el
   * `PUT` de reemplazo completo.
   */
  reactivate(medication: Medication): Observable<Medication> {
    return this.http
      .put<MedicationDto>(
        `${this.baseUrl}/${medication.id}`,
        toMedicationPayload({
          description: medication.description,
          drugTypeId: medication.drugTypeId,
          brandId: medication.brandId,
          locationId: medication.locationId,
          dose: medication.dose,
          isActive: true,
        }),
      )
      .pipe(map(toMedication));
  }
}
