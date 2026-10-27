/**
 * Acceso HTTP a las visitas (F-015).
 *
 * - Base `environment.apiUrl + '/v1/visits'` compuesta en un solo lugar. La
 *   cabecera `Authorization: Bearer` la adjunta el `authInterceptor` de F-002.
 * - **Todo** el transporte GET/POST/PUT/annul vive aquí: ningún componente
 *   toca `HttpClient` (S3/S6/S7).
 * - `list()` arma los filtros combinables (`page`, `size`, `doctor_id`,
 *   `patient_id`, `date_from`, `date_to`, `status`, `q`, `sort`) en un único
 *   punto; sin paginación ni filtrado en cliente (S1/S2).
 * - `create()` y `update()` **nunca** envían `doctor_id`: el médico de la
 *   visita lo toma el backend del token del usuario que registra (S3/S11), así
 *   que el servicio no ramifica por rol y ningún formulario puede elegirlo.
 * - `update()` es el `PUT` de reemplazo completo: la lista de `medications`
 *   enviada sustituye a la anterior (S4/S6).
 * - `annul()` emite `POST /{id}/annul` con el motivo obligatorio (S7). No hay
 *   borrado físico en el servicio.
 */

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Visit,
  VisitAnnulResponseDto,
  VisitAnnulment,
  VisitFormInput,
  VisitListPage,
  VisitListParams,
  VisitListResponseDto,
  VisitReadDto,
  toAnnulPayload,
  toVisit,
  toVisitAnnulment,
  toVisitListPage,
  toVisitPayload,
} from './visits.models';

@Injectable({ providedIn: 'root' })
export class VisitsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/visits`;

  /**
   * Lista paginada del servidor (`GET /v1/visits` → `200` con
   * `{items, total, page, size, pages}`).
   */
  list(params: VisitListParams): Observable<VisitListPage> {
    let query = new HttpParams().set('page', String(params.page)).set('size', String(params.size));

    if (params.doctorId !== undefined) {
      query = query.set('doctor_id', String(params.doctorId));
    }
    if (params.patientId !== undefined) {
      query = query.set('patient_id', String(params.patientId));
    }
    const dateFrom = params.dateFrom?.trim();
    if (dateFrom) {
      query = query.set('date_from', dateFrom);
    }
    const dateTo = params.dateTo?.trim();
    if (dateTo) {
      query = query.set('date_to', dateTo);
    }
    if (params.status !== undefined) {
      query = query.set('status', params.status);
    }
    const q = params.q?.trim();
    if (q) {
      query = query.set('q', q);
    }
    const sort = params.sort?.trim();
    if (sort) {
      query = query.set('sort', sort);
    }

    return this.http
      .get<VisitListResponseDto>(this.baseUrl, { params: query })
      .pipe(map(toVisitListPage));
  }

  /**
   * Detalle (`GET /v1/visits/{id}` → `200`). Un MEDICO solo llega a las
   * propias: cualquier otro id responde `404` (S9).
   */
  getById(id: number): Observable<Visit> {
    return this.http.get<VisitReadDto>(`${this.baseUrl}/${id}`).pipe(map(toVisit));
  }

  /**
   * Creación (`POST /v1/visits` → `201`). El body no lleva `doctor_id`: el
   * médico sale del token (S3/S11). `404` si el paciente o un medicamento no
   * existen o están inactivos; `422` de validación.
   */
  create(input: VisitFormInput): Observable<Visit> {
    return this.http.post<VisitReadDto>(this.baseUrl, toVisitPayload(input)).pipe(map(toVisit));
  }

  /** Reemplazo completo (`PUT /v1/visits/{id}` → `200`; `409 visit_annulled`). */
  update(id: number, input: VisitFormInput): Observable<Visit> {
    return this.http
      .put<VisitReadDto>(`${this.baseUrl}/${id}`, toVisitPayload(input))
      .pipe(map(toVisit));
  }

  /**
   * Anulación (`POST /v1/visits/{id}/annul` → `200`). Se ejecuta una sola vez:
   * repetirla responde `409 visit_already_annulled` (S7).
   */
  annul(id: number, reason: string): Observable<VisitAnnulment> {
    return this.http
      .post<VisitAnnulResponseDto>(`${this.baseUrl}/${id}/annul`, toAnnulPayload(reason))
      .pipe(map(toVisitAnnulment));
  }
}
