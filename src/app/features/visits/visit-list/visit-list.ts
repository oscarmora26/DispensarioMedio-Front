/**
 * Listado de visitas (F-015, S1/S2/S8/S11/S13/S14): `dm-visit-list` dentro
 * del shell, visible para `ADMIN` y `MEDICO`.
 *
 * - Tabla de Material con `mat-paginator` de servidor obligatorio (`page`
 *   desde 1, `size` 1-100; opciones 10/20/50, por defecto 20): cada cambio de
 *   página, tamaño, filtro u orden emite **un** `GET /v1/visits` y vuelve a la
 *   primera página cuando cambia el criterio. Sin paginación ni filtrado en
 *   cliente.
 * - Filtros combinables (S2): `status`, rango `date_from`/`date_to` (calendario
 *   Material; se envía `00:00:00` y `23:59:59`, sin zona = UTC-4), paciente y
 *   **médico solo para ADMIN**. Paciente y médico son buscadores
 *   (`mat-autocomplete`): al abrirlos piden la primera página de activos
 *   (`size=20`) y al escribir filtran en el servidor con 300 ms de espera. El
 *   campo «Buscar visitas» (`q`) se retiró por decisión humana (2026-10-27) y
 *   el filtro por medicamento queda fuera de esta entrega.
 * - Permisos (S11, invertidos): **MEDICO** registra, edita y anula (su médico
 *   sale del token) y por eso ve «Registrar visita» y la columna Acciones.
 *   **ADMIN** es de solo lectura: no se renderiza ningún control de escritura
 *   ni la columna de acciones — no es solo deshabilitar. El ADMIN sigue
 *   supervisando con el filtro de médico. La fila completa abre el detalle para
 *   ambos roles y el nombre del paciente es un ancla real, así la tabla se
 *   opera también con teclado.
 * - Carga contenida (S13, patrón F-013/F-014): `loading` solo gobierna la
 *   región de la tabla (`aria-busy`); header, filtros y paginador permanecen
 *   montados y el overlay es absoluto con `pointer-events: none`.
 * - Avisos: los toasts quedan para las mutaciones. El fallo de carga se anuncia
 *   inline con reintento, no en toast.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DoctorsService } from '../../doctors/doctors.service';
import { Patient, formatCedula } from '../../patients/patients.models';
import { PatientsService } from '../../patients/patients.service';
import {
  mapVisitsError,
  VISIT_ALREADY_ANNULLED_MESSAGE,
  VISIT_ANNULLED_MESSAGE,
  VISIT_NOT_FOUND_MESSAGE,
} from '../visits-error';
import {
  CATALOG_SEARCH_SIZE,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  SEARCH_DEBOUNCE_MS,
  VisitListItem,
  VisitPerson,
  VisitStatus,
  endOfDayDateTime,
  formatVisitDateValue,
  formatVisitDateTime,
  startOfDayDateTime,
  visitStatusLabel,
} from '../visits.models';
import { VisitsService } from '../visits.service';
import { VisitsToast } from '../visits-toast';
import { VisitAnnulData, VisitAnnulDialog, VisitAnnulResult } from '../visit-annul/visit-annul';
import { VisitFormData, VisitFormDialog, VisitFormResult } from '../visit-form/visit-form';

/** Filtro de estado: `Todos` o uno de los dos estados del contrato. */
type VisitStatusFilter = 'all' | VisitStatus;

/**
 * Columnas de solo lectura (ADMIN) frente a las de escritura (MEDICO). Los
 * síntomas viven en el detalle y en el formulario, no en la tabla.
 */
const READ_ONLY_COLUMNS = ['patient', 'doctor', 'visitedAt', 'status'];
const WRITABLE_COLUMNS = [...READ_ONLY_COLUMNS, 'actions'];

@Component({
  selector: 'dm-visit-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
  ],
  templateUrl: './visit-list.html',
  styleUrl: './visit-list.scss',
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitList implements OnInit {
  private readonly visits = inject(VisitsService);
  private readonly patients = inject(PatientsService);
  private readonly doctors = inject(DoctorsService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly toast = inject(VisitsToast);
  private readonly destroyRef = inject(DestroyRef);

  /** `true` solo con `role === 'ADMIN'`: único rol que filtra por médico (S2). */
  protected readonly isAdmin = computed(() => this.auth.user()?.role === 'ADMIN');

  /**
   * `true` solo con `role === 'MEDICO'`: el ADMIN es de solo lectura en todo el
   * módulo, así que la escritura (registrar, editar, anular) es del médico
   * (S11, modelo invertido).
   */
  protected readonly canWrite = computed(() => this.auth.user()?.role === 'MEDICO');

  /** Columnas visibles: la de acciones solo existe para `MEDICO`. */
  protected readonly displayedColumns = computed(() =>
    this.canWrite() ? WRITABLE_COLUMNS : READ_ONLY_COLUMNS,
  );

  /** Opciones del paginador (`size` 1-100 según S1). */
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  /** Cédula con máscara en la tabla (misma regla de F-013). */
  protected readonly maskCedula = formatCedula;

  /** Fecha y hora siempre en `America/Santo_Domingo` (S10). */
  protected readonly formatVisitedAt = formatVisitDateTime;

  /** Etiqueta del estado (Registrada / Anulada). */
  protected readonly statusLabel = visitStatusLabel;

  /** Filas de la página actual (fuente: el servidor, nunca filtrado local). */
  readonly items = signal<VisitListItem[]>([]);

  /** Total del servidor para el paginador. */
  readonly total = signal(0);

  /** Índice de página 0-based para `mat-paginator` (el servidor usa base 1). */
  readonly pageIndex = signal(0);

  /** Tamaño de página actual. */
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  /** Orden de servidor (`campo` o `-campo`); vacío = `-visited_at` del backend. */
  readonly sortState = signal<Sort>({ active: '', direction: '' });

  /** Carga en curso: solo gobierna la región de la tabla (`aria-busy`). */
  readonly loading = signal(true);

  /** Error de carga ya traducido, mostrado inline con reintento (S13). */
  readonly errorMessage = signal<string | null>(null);

  /** Filtro por estado (`status`). */
  readonly statusFilter = new FormControl<VisitStatusFilter>('all', { nonNullable: true });

  /**
   * Rango de fechas con calendario Material: `dateFrom` → `date_from` y
   * `dateTo` → `date_to`, ambos como día completo en UTC-4.
   */
  readonly dateFrom = new FormControl<Date | null>(null);
  readonly dateTo = new FormControl<Date | null>(null);

  /** Texto del buscador de paciente (búsqueda de servidor, S5). */
  readonly patientFilter = new FormControl('', { nonNullable: true });

  /** Resultados vigentes del buscador de paciente. */
  readonly patientOptions = signal<Patient[]>([]);

  /** Paciente aplicado como `patient_id` (no se aplica nada al escribir). */
  readonly selectedPatient = signal<Patient | null>(null);

  /** Texto del buscador de médico: **solo ADMIN** (S2/S5); vacío = todos. */
  readonly doctorFilter = new FormControl('', { nonNullable: true });

  /** Resultados vigentes del buscador de médico. */
  readonly doctorOptions = signal<VisitPerson[]>([]);

  /** Médico aplicado como `doctor_id` (no se aplica nada al escribir). */
  readonly selectedDoctor = signal<VisitPerson | null>(null);

  ngOnInit(): void {
    this.load();

    this.patientFilter.valueChanges
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((text) => this.onPatientFilterText(text));

    this.doctorFilter.valueChanges
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((text) => this.onDoctorFilterText(text));

    this.statusFilter.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadFromFirstPage());

    this.dateFrom.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadFromFirstPage());

    this.dateTo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reloadFromFirstPage());
  }

  /** Cambio de página o tamaño: el tamaño nuevo vuelve a la primera página. */
  onPage(event: PageEvent): void {
    if (event.pageSize !== this.pageSize()) {
      this.pageSize.set(event.pageSize);
      this.pageIndex.set(0);
    } else {
      this.pageIndex.set(event.pageIndex);
    }
    this.load();
  }

  /** Orden clicado en la cabecera: emite `sort` y vuelve a la primera página. */
  onSort(sort: Sort): void {
    this.sortState.set(sort);
    this.pageIndex.set(0);
    this.load();
  }

  /** Reintento del fallo de carga con los criterios vigentes (S13). */
  retry(): void {
    this.load();
  }

  /** Limpia el extremo inferior del rango y recarga desde la primera página. */
  clearDateFrom(): void {
    this.dateFrom.setValue(null);
  }

  /** Limpia el extremo superior del rango y recarga desde la primera página. */
  clearDateTo(): void {
    this.dateTo.setValue(null);
  }

  /**
   * Abre el detalle de la fila clicada. Es un añadido al ancla real del nombre
   * del paciente, que es la vía de teclado y de tecnología de asistencia.
   */
  openDetail(visit: VisitListItem): void {
    void this.router.navigate(['/visits', visit.id]);
  }

  /**
   * Apertura del panel de paciente (foco o clic): si aún no hay opciones se
   * pide la primera página de activos, así el buscador es también un select
   * que muestra opciones de inmediato (S5).
   */
  onPatientPanelOpened(): void {
    if (this.patientOptions().length === 0) {
      this.searchPatients(this.patientFilter.value);
    }
  }

  /**
   * Aplica el paciente elegido en el buscador. El texto del input no dispara
   * el `GET` del listado: solo la selección (o la limpieza) filtra.
   */
  onPatientSelected(patient: Patient): void {
    this.selectedPatient.set(patient);
    this.patientFilter.setValue(patient.name, { emitEvent: false });
    this.reloadFromFirstPage();
  }

  /** Quita el filtro de paciente y recarga desde la primera página. */
  clearPatientFilter(): void {
    this.selectedPatient.set(null);
    this.patientFilter.setValue('', { emitEvent: false });
    this.patientOptions.set([]);
    this.reloadFromFirstPage();
  }

  /** Apertura del panel de médico: primera página de activos (S2/S5). */
  onDoctorPanelOpened(): void {
    if (this.doctorOptions().length === 0) {
      this.searchDoctors(this.doctorFilter.value);
    }
  }

  /** Aplica el médico elegido en el buscador como `doctor_id` (S2). */
  onDoctorSelected(doctor: VisitPerson): void {
    this.selectedDoctor.set(doctor);
    this.doctorFilter.setValue(doctor.name, { emitEvent: false });
    this.reloadFromFirstPage();
  }

  /** Quita el filtro de médico y recarga desde la primera página. */
  clearDoctorFilter(): void {
    this.selectedDoctor.set(null);
    this.doctorFilter.setValue('', { emitEvent: false });
    this.doctorOptions.set([]);
    this.reloadFromFirstPage();
  }

  /** Diálogo de registro (S3); ante `201` cierra con toast y recarga. */
  openCreate(): void {
    const data: VisitFormData = { mode: 'create' };
    this.openForm(data, true);
  }

  /** Diálogo de edición por reemplazo completo (S6). */
  openEdit(visit: VisitListItem): void {
    const data: VisitFormData = { mode: 'edit', visitId: visit.id };
    this.openForm(data, false);
  }

  /** Diálogo de anulación con motivo obligatorio (S7). */
  openAnnul(visit: VisitListItem): void {
    const data: VisitAnnulData = {
      visitId: visit.id,
      patientName: visit.patient.name,
      visitedAt: visit.visitedAt,
    };

    this.dialog
      .open<VisitAnnulDialog, VisitAnnulData, VisitAnnulResult>(VisitAnnulDialog, {
        data,
        width: '32rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleAnnulResult(result));
  }

  private openForm(data: VisitFormData, created: boolean): void {
    this.dialog
      .open<VisitFormDialog, VisitFormData, VisitFormResult>(VisitFormDialog, {
        data,
        width: '64rem',
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: '90vh',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleFormResult(result, created));
  }

  /**
   * Resultado del diálogo de registro/edición: `saved` recarga con el toast de
   * éxito; `{ notFound: true }` y `{ annulled: true }` recargan y avisan.
   * Cancelar/Escape/backdrop (`undefined`) no tienen efectos.
   */
  private handleFormResult(result: VisitFormResult | undefined, created: boolean): void {
    if (result === 'saved') {
      if (created) {
        this.toast.showCreated();
      } else {
        this.toast.showUpdated();
      }
      this.load();
      return;
    }
    if (isNotFoundResult(result)) {
      this.toast.showError(VISIT_NOT_FOUND_MESSAGE);
      this.load();
      return;
    }
    if (isAnnulledResult(result)) {
      this.toast.showError(VISIT_ANNULLED_MESSAGE);
      this.load();
    }
  }

  /** Resultado del diálogo de anulación (S7). */
  private handleAnnulResult(result: VisitAnnulResult | undefined): void {
    if (result === 'annulled') {
      this.toast.showAnnulled();
      this.load();
      return;
    }
    if (isAlreadyAnnulledResult(result)) {
      this.toast.showError(VISIT_ALREADY_ANNULLED_MESSAGE);
      this.load();
    }
  }

  /** Vuelve a la primera página y recarga (un solo `GET` por gesto). */
  private reloadFromFirstPage(): void {
    this.pageIndex.set(0);
    this.load();
  }

  /**
   * Texto del buscador de paciente: al borrarlo se suelta la selección y se
   * vuelve al listado sin `patient_id`; en cualquier caso se refiltra en el
   * servidor (texto vacío = primera página de activos).
   */
  private onPatientFilterText(text: string): void {
    if (text.trim().length === 0 && this.selectedPatient() !== null) {
      this.selectedPatient.set(null);
      this.reloadFromFirstPage();
    }
    this.searchPatients(text);
  }

  /**
   * Texto del buscador de médico: al borrarlo se suelta la selección y se
   * vuelve al listado sin `doctor_id` (S2).
   */
  private onDoctorFilterText(text: string): void {
    if (text.trim().length === 0 && this.selectedDoctor() !== null) {
      this.selectedDoctor.set(null);
      this.reloadFromFirstPage();
    }
    this.searchDoctors(text);
  }

  /** Búsqueda de servidor del buscador de paciente (S5). */
  private searchPatients(text: string): void {
    this.patients
      .list({ page: 1, size: CATALOG_SEARCH_SIZE, search: text.trim(), isActive: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.patientOptions.set(page.items),
        error: () => this.patientOptions.set([]),
      });
  }

  /** Búsqueda de servidor del buscador de médico (S2/S5, solo ADMIN). */
  private searchDoctors(text: string): void {
    if (!this.isAdmin()) {
      this.doctorOptions.set([]);
      return;
    }

    this.doctors
      .list({ page: 1, size: CATALOG_SEARCH_SIZE, search: text.trim(), isActive: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) =>
          this.doctorOptions.set(
            page.items.map((doctor) => ({ id: doctor.id, name: doctor.name })),
          ),
        error: () => this.doctorOptions.set([]),
      });
  }

  /** Parámetro `sort` del servidor a partir del estado de `mat-sort`. */
  private sortParam(): string | undefined {
    const sort = this.sortState();
    if (!sort.active || !sort.direction) {
      return undefined;
    }
    return sort.direction === 'desc' ? `-${sort.active}` : sort.active;
  }

  /**
   * Emite `GET /v1/visits` con los criterios vigentes como carga incremental:
   * conserva header/filtros/paginador montados y las filas visibles hasta que
   * llega la página nueva. Ante error conserva las filas anteriores y publica
   * el mensaje inline con reintento.
   */
  private load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const status = this.statusFilter.value;
    const dateFrom = formatVisitDateValue(this.dateFrom.value);
    const dateTo = formatVisitDateValue(this.dateTo.value);
    const doctorId = this.selectedDoctor()?.id;

    this.visits
      .list({
        page: this.pageIndex() + 1,
        size: this.pageSize(),
        doctorId: this.isAdmin() && doctorId !== undefined ? doctorId : undefined,
        patientId: this.selectedPatient()?.id,
        dateFrom: dateFrom.length > 0 ? startOfDayDateTime(dateFrom) : undefined,
        dateTo: dateTo.length > 0 ? endOfDayDateTime(dateTo) : undefined,
        status: status === 'all' ? undefined : status,
        sort: this.sortParam(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.items.set(page.items);
          this.total.set(page.total);
          this.errorMessage.set(null);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(mapVisitsError(error).message);
        },
      });
  }
}

/** Solo el 404 real del `GET /{id}` en edición cierra con `{ notFound: true }`. */
function isNotFoundResult(result: VisitFormResult | undefined): boolean {
  return typeof result === 'object' && result !== null && 'notFound' in result;
}

/** El `409 visit_annulled` al guardar cierra el formulario con `{ annulled: true }`. */
function isAnnulledResult(result: VisitFormResult | undefined): boolean {
  return typeof result === 'object' && result !== null && 'annulled' in result;
}

/** `409 visit_already_annulled`: el diálogo de anulación cierra avisando. */
function isAlreadyAnnulledResult(result: VisitAnnulResult | undefined): boolean {
  return typeof result === 'object' && result !== null && 'alreadyAnnulled' in result;
}
