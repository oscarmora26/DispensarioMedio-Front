/**
 * Acceso HTTP al catálogo de pacientes (F-013).
 *
 * - Base `environment.apiUrl + '/v1/patients'` compuesta en un solo lugar
 *   (mismo patrón que `DrugTypesService`). La cabecera `Authorization: Bearer`
 *   la adjunta el `authInterceptor` de F-002; este servicio no conoce
 *   almacenamiento ni el rol del usuario.
 * - `list()` arma los query params (`page` desde 1, `size` 1-100, `search`,
 *   `is_active`, `sort`) en un único punto y devuelve la página mapeada a
 *   `camelCase`. Sin paginación ni filtrado en cliente.
 * - `deactivate()` emite `DELETE /{id}` = desactivación lógica e **idempotente**
 *   (S7): nunca hay borrado físico, y repetir la llamada también responde
 *   `204`.
 * - `reactivate()` reenvía el registro visible con `is_active: true` en el
 *   `PUT` de reemplazo completo, conservando su `carnet`: un `PUT` parcial
 *   responde `422` por los campos requeridos faltantes y un `carnet` ausente
 *   lo borraría.
 */

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Patient,
  PatientDto,
  PatientFormInput,
  PatientListPage,
  PatientListParams,
  PatientListResponseDto,
  toPatient,
  toPatientListPage,
  toPatientPayload,
} from './patients.models';

@Injectable({ providedIn: 'root' })
export class PatientsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/patients`;

  /**
   * Lista paginada del servidor (`GET /v1/patients` → `200` con
   * `{items, total, page, size, pages}`).
   */
  list(params: PatientListParams): Observable<PatientListPage> {
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
      .get<PatientListResponseDto>(this.baseUrl, { params: query })
      .pipe(map(toPatientListPage));
  }

  /** Detalle (`GET /v1/patients/{id}` → `200`; también con el paciente inactivo). */
  getById(id: number): Observable<Patient> {
    return this.http.get<PatientDto>(`${this.baseUrl}/${id}`).pipe(map(toPatient));
  }

  /** Creación (`POST /v1/patients` → `201`; `409` si la cédula o el carnet existen). */
  create(input: PatientFormInput): Observable<Patient> {
    return this.http.post<PatientDto>(this.baseUrl, toPatientPayload(input)).pipe(map(toPatient));
  }

  /** Reemplazo completo (`PUT /v1/patients/{id}` → `200`; sin `PATCH`). */
  update(id: number, input: PatientFormInput): Observable<Patient> {
    return this.http
      .put<PatientDto>(`${this.baseUrl}/${id}`, toPatientPayload(input))
      .pipe(map(toPatient));
  }

  /**
   * Desactivación lógica vía `DELETE /v1/patients/{id}` (S7: nunca borrado
   * físico, nunca elimina la fila ni sus referencias). Idempotente: repetirla
   * responde `204` igual que la primera vez.
   */
  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Reactivación: reenvía el registro visible con `is_active: true` en el `PUT`
   * de reemplazo completo (`name` + `cedula` + `patient_type` + `carnet`), para
   * no borrar el carnet ni dejar incompleto el body.
   */
  reactivate(patient: Patient): Observable<Patient> {
    return this.http
      .put<PatientDto>(
        `${this.baseUrl}/${patient.id}`,
        toPatientPayload({
          name: patient.name,
          cedula: patient.cedula,
          carnet: patient.carnet ?? '',
          patientType: patient.patientType,
          isActive: true,
        }),
      )
      .pipe(map(toPatient));
  }
}
