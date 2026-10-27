/**
 * Acceso HTTP al catálogo de médicos (F-014).
 *
 * - Base `environment.apiUrl + '/v1/doctors'` compuesta en un solo lugar
 *   (mismo patrón que `PatientsService`). La cabecera `Authorization: Bearer`
 *   la adjunta el `authInterceptor` de F-002; este servicio no conoce
 *   almacenamiento ni el rol del usuario.
 * - `list()` arma los query params (`page` desde 1, `size` 1-100, `search`,
 *   `is_active`, `sort`) en un único punto y devuelve la página mapeada a
 *   `camelCase`. Sin paginación ni filtrado en cliente.
 * - `deactivate()` emite `DELETE /{id}` = desactivación lógica e **idempotente**
 *   (S8): nunca hay borrado físico y repetir la llamada también responde
 *   `204`. Un médico con visitas registradas responde `409 doctor_has_visits`.
 * - `reactivate()` reenvía el registro visible con `is_active: true` en el
 *   `PUT` de reemplazo completo: un `PUT` parcial responde `422` por los
 *   campos requeridos faltantes.
 * - La asociación con usuarios **no se escribe aquí** (S6): ningún método
 *   envía `user` ni `doctor_id`; la asignación vive en el módulo de Usuarios
 *   (F-006).
 */

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Doctor,
  DoctorDto,
  DoctorFormInput,
  DoctorListPage,
  DoctorListParams,
  DoctorListResponseDto,
  toDoctor,
  toDoctorListPage,
  toDoctorPayload,
} from './doctors.models';

@Injectable({ providedIn: 'root' })
export class DoctorsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/doctors`;

  /**
   * Lista paginada del servidor (`GET /v1/doctors` → `200` con
   * `{items, total, page, size, pages}`).
   */
  list(params: DoctorListParams): Observable<DoctorListPage> {
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
      .get<DoctorListResponseDto>(this.baseUrl, { params: query })
      .pipe(map(toDoctorListPage));
  }

  /** Detalle (`GET /v1/doctors/{id}` → `200`; también con el médico inactivo). */
  getById(id: number): Observable<Doctor> {
    return this.http.get<DoctorDto>(`${this.baseUrl}/${id}`).pipe(map(toDoctor));
  }

  /** Creación (`POST /v1/doctors` → `201`; `409` si la cédula ya existe). */
  create(input: DoctorFormInput): Observable<Doctor> {
    return this.http.post<DoctorDto>(this.baseUrl, toDoctorPayload(input)).pipe(map(toDoctor));
  }

  /** Reemplazo completo (`PUT /v1/doctors/{id}` → `200`; sin `PATCH`). */
  update(id: number, input: DoctorFormInput): Observable<Doctor> {
    return this.http
      .put<DoctorDto>(`${this.baseUrl}/${id}`, toDoctorPayload(input))
      .pipe(map(toDoctor));
  }

  /**
   * Desactivación lógica vía `DELETE /v1/doctors/{id}` (S8: nunca borrado
   * físico). Idempotente: repetirla responde `204` igual que la primera vez.
   * `409 doctor_has_visits` cuando el médico tiene visitas registradas.
   */
  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Reactivación: reenvía el registro visible con `is_active: true` en el `PUT`
   * de reemplazo completo (`name` + `cedula` + `lab_shift` + `specialty`), sin
   * tocar la asociación con usuarios.
   */
  reactivate(doctor: Doctor): Observable<Doctor> {
    return this.http
      .put<DoctorDto>(
        `${this.baseUrl}/${doctor.id}`,
        toDoctorPayload({
          name: doctor.name,
          cedula: doctor.cedula,
          labShift: doctor.labShift,
          specialty: doctor.specialty,
          isActive: true,
        }),
      )
      .pipe(map(toDoctor));
  }
}
