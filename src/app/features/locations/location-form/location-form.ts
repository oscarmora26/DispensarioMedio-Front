/**
 * Crear/editar estante (F-011, S2/S3): diálogo `dm-location-form` sobre el
 * listado, alineado al contrato vivo: estante en `/v1/shelves`, celdas en
 * `/v1/cells`.
 *
 * - Formulario reactivo tipado (`FormGroup` con `FormControl` `nonNullable`).
 * - Estante: `name` obligatorio (2-100, recortado) y `description` opcional
 *   (máx. 200, recortada y normalizada a `null` si queda vacía). El body del
 *   estante **nunca** lleva `cells` (el contrato es
 *   `additionalProperties: false`).
 * - Celdas: `FormArray` dinámico (agregar/quitar) con `section` y `cell`
 *   obligatorios (1-50), `description` opcional (máx. 200) y `isActive` por
 *   celda. Cada fila recuerda su `id` (nulo en las nuevas) para decidir entre
 *   `POST /v1/cells` y `PUT /v1/cells/{id}`.
 * - Guardado: primero el estante (`POST` al crear, `PUT` al editar), después
 *   las celdas —upserts y luego bajas—. El id devuelto por el `POST` del
 *   estante queda en `savedShelfId`, así que un reintento tras un fallo de
 *   celda actualiza el estante (`PUT`) en vez de duplicarlo; igual criterio
 *   con cada `POST /v1/cells`, cuyo `id` se escribe en su fila.
 * - Editar: precarga con `GET /{id}`; el estado del estante no se edita aquí
 *   (se cambia con Activar/Desactivar del listado y viaja en el `PUT` con el
 *   valor vigente). `404` al precargar cierra con `{ notFound: true }` para
 *   que el listado avise; Cancelar/Escape/backdrop solo cierran.
 * - `409` del estante (nombre duplicado) deja el diálogo abierto con el
 *   mensaje como error del campo `name`; `409` de una celda avisa de la
 *   posición duplicada y `409` de una baja avisa de los medicamentos
 *   asociados. `422` marca errores `server` por campo sin exponer mensajes
 *   crudos del backend.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Observable, catchError, concat, concatMap, map, tap, throwError } from 'rxjs';
import {
  LocationsFieldErrors,
  mapCellDeleteError,
  mapCellWriteError,
  mapLocationsError,
} from '../locations-error';
import { CellWriteInput, ShelfWriteInput } from '../locations.models';
import { LocationsService } from '../locations.service';

/** Longitud mínima y máxima del nombre del estante (S2: 2..100). */
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;

/** Longitud máxima de las descripciones opcionales (≤200). */
const DESCRIPTION_MAX_LENGTH = 200;

/** Longitud máxima de `section`/`cell` de una celda (1..50). */
const CELL_MAX_LENGTH = 50;

/**
 * `required` sobre el valor recortado: una cadena de solo espacios no es
 * válida (el body de escritura viaja con `trim`). Reutiliza la clave
 * `required` para que el mismo `mat-error` la muestre.
 */
const requiredTrimmed: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true };

/**
 * Controles de una fila del editor de celdas. `id` es el identificador que ya
 * tiene la celda en el servidor (`null` mientras es nueva) y no se pinta: solo
 * decide entre `PUT` y `POST` y se rellena con el id que devuelve el `POST`.
 */
type CellFormGroup = FormGroup<{
  id: FormControl<number | null>;
  section: FormControl<string>;
  cell: FormControl<string>;
  description: FormControl<string>;
  isActive: FormControl<boolean>;
}>;

/** Valores de una fila del editor, tal como los captura el usuario. */
interface CellRowValue extends CellWriteInput {
  id: number | null;
}

/** Abrir en modo creación (sin precarga). */
export interface LocationFormCreateData {
  mode: 'create';
}

/** Abrir en modo edición (precarga con `GET /{id}`). */
export interface LocationFormEditData {
  mode: 'edit';
  locationId: number;
}

export type LocationFormData = LocationFormCreateData | LocationFormEditData;

/** `saved` cuando el estante y todas sus celdas quedaron guardados. */
export type LocationFormResult = 'saved' | { notFound: true };

/**
 * Fallo ya traducido dentro de la cadena de guardado. Permite distinguir el
 * error del estante (que puede marcar campos) del de una celda, sin exponer
 * nunca el mensaje crudo del backend.
 */
class SaveFailure {
  constructor(
    readonly message: string,
    readonly fieldErrors?: LocationsFieldErrors,
  ) {}
}

@Component({
  selector: 'dm-location-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './location-form.html',
  styleUrl: './location-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationFormDialog {
  private readonly locations = inject(LocationsService);
  private readonly dialogRef =
    inject<MatDialogRef<LocationFormDialog, LocationFormResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<LocationFormData>(MAT_DIALOG_DATA);

  /** Límites expuestos al template (`maxlength` y `mat-hint`). */
  protected readonly nameMinLength = NAME_MIN_LENGTH;
  protected readonly nameMaxLength = NAME_MAX_LENGTH;
  protected readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;
  protected readonly cellMaxLength = CELL_MAX_LENGTH;

  /** `true` en edición: sin control de `is_active` y con campos precargados. */
  protected readonly isEdit = this.data.mode === 'edit';

  /** Precarga del estante en edición (`GET /{id}`). */
  readonly loadingLocation = signal(this.isEdit);

  /** Envío en curso: deshabilita campos y botón, `aria-busy` y etiqueta. */
  readonly submitting = signal(false);

  /** Error general ya traducido para la región `role="alert"`. */
  readonly error = signal<string | null>(null);

  /** Errores 409/422 por campo ya traducidos (fuente del validador `server`). */
  readonly fieldErrors = signal<LocationsFieldErrors>({});

  /**
   * Id del estante ya guardado en esta sesión del diálogo. Es el estado
   * interno de «ya guardado»: si tiene valor, un reintento actualiza el
   * estante con `PUT` en lugar de crear un duplicado con `POST`.
   */
  readonly savedShelfId = signal<number | null>(null);

  /** `is_active` del estante en edición (no editable aquí; viaja en el `PUT`). */
  private loadedIsActive = true;

  /** Ids de celdas precargadas que el usuario quitó: se dan de baja con `DELETE`. */
  private readonly removedCellIds: number[] = [];

  /** Id del estante en edición (`null` en creación). */
  private readonly editLocationId: number | null =
    this.data.mode === 'edit' ? this.data.locationId : null;

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        requiredTrimmed,
        Validators.minLength(NAME_MIN_LENGTH),
        Validators.maxLength(NAME_MAX_LENGTH),
        this.serverError('name'),
      ],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(DESCRIPTION_MAX_LENGTH), this.serverError('description')],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
    cells: new FormArray<CellFormGroup>([], { validators: [this.serverError('cells')] }),
  });

  constructor() {
    if (this.data.mode === 'edit') {
      // En edición el estado se cambia desde el listado: el control no se
      // renderiza y su valor viaja tomado del estante precargado.
      this.form.controls.isActive.disable();
      this.loadLocation(this.data.locationId);
    }
  }

  /** Filas del editor de celdas (`FormArray` de `section`/`cell`/…). */
  get cells(): FormArray<CellFormGroup> {
    return this.form.controls.cells;
  }

  /** Agrega una celda vacía al editor (aún sin `id`: se creará con `POST`). */
  addCell(): void {
    this.cells.push(
      this.createCellGroup({ id: null, section: '', cell: '', description: '', isActive: true }),
    );
  }

  /**
   * Quita la celda de la posición indicada. Si ya existía en el servidor su
   * id queda anotado para darla de baja con `DELETE /v1/cells/{id}` al
   * guardar.
   */
  removeCell(index: number): void {
    const id = this.cells.at(index).controls.id.value;
    if (id !== null) {
      this.removedCellIds.push(id);
    }
    this.cells.removeAt(index);
  }

  onSubmit(): void {
    this.fieldErrors.set({});
    this.refreshServerValidity();
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting() || this.loadingLocation()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.saveShelfAndCells()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        complete: () => {
          // Solo se cierra cuando el estante y todas sus celdas quedaron
          // guardadas; cualquier fallo intermedio deja el diálogo abierto.
          this.dialogRef.close('saved');
        },
        error: (error: unknown) => {
          const failure =
            error instanceof SaveFailure ? error : saveFailureFrom(mapLocationsError(error));
          this.fieldErrors.set(failure.fieldErrors ?? {});
          this.refreshServerValidity();
          this.error.set(failure.message);
          this.submitting.set(false);
        },
      });
  }

  /**
   * Guarda el estante y luego reconcilia sus celdas: primero los upserts
   * (`PUT` de las filas con `id`, `POST` de las nuevas) y después las bajas.
   * Un fallo detiene la cadena y se reporta con su propio mensaje.
   */
  private saveShelfAndCells(): Observable<unknown> {
    return this.saveShelf().pipe(concatMap((shelfId) => this.reconcileCells(shelfId)));
  }

  /**
   * `PUT` del estante cuando ya tiene id (edición o reintento tras el `POST`);
   * `POST` solo la primera vez en creación. El id guardado queda en
   * `savedShelfId`.
   */
  private saveShelf(): Observable<number> {
    const shelfId = this.savedShelfId() ?? this.editLocationId;
    const input = this.toShelfWriteInput();

    if (shelfId !== null) {
      return this.locations.update(shelfId, input).pipe(
        tap(() => this.savedShelfId.set(shelfId)),
        map(() => shelfId),
      );
    }

    return this.locations.create(input).pipe(
      tap((shelf) => this.savedShelfId.set(shelf.id)),
      map((shelf) => shelf.id),
    );
  }

  /** Upserts de las filas y, al final, bajas de las celdas quitadas. */
  private reconcileCells(shelfId: number): Observable<unknown> {
    const upserts = this.cells.controls.map((group) => this.upsertCell(group, shelfId));
    const deletions = this.removedCellIds.map((cellId) => this.deleteCell(cellId));

    return concat(...upserts, ...deletions);
  }

  /**
   * `POST /v1/cells` para una fila nueva (y escribe el `id` devuelto en la
   * fila, para que un reintento la actualice) o `PUT /v1/cells/{id}` para una
   * fila ya existente.
   */
  private upsertCell(group: CellFormGroup, shelfId: number): Observable<unknown> {
    const input = toCellWriteInput(group.getRawValue());
    const cellId = group.controls.id.value;

    const request: Observable<unknown> =
      cellId === null
        ? this.locations
            .createCell(input, shelfId)
            .pipe(tap((cell) => group.controls.id.setValue(cell.id)))
        : this.locations.updateCell(cellId, input, shelfId);

    return request.pipe(
      catchError((error: unknown) => throwError(() => saveFailureFrom(mapCellWriteError(error)))),
    );
  }

  /**
   * `DELETE /v1/cells/{id}` de una celda quitada. Su `409` significa «tiene
   * medicamentos asociados» y se traduce con un texto propio.
   */
  private deleteCell(cellId: number): Observable<void> {
    return this.locations.deleteCell(cellId).pipe(
      tap(() => this.forgetRemovedCell(cellId)),
      catchError((error: unknown) => throwError(() => new SaveFailure(mapCellDeleteError(error)))),
    );
  }

  /** Quita una celda ya borrada de la lista de bajas pendientes. */
  private forgetRemovedCell(cellId: number): void {
    const index = this.removedCellIds.indexOf(cellId);
    if (index >= 0) {
      this.removedCellIds.splice(index, 1);
    }
  }

  /**
   * Body del estante (`name`, `description`, `is_active`), nunca con `cells`.
   * En edición el `is_active` es el precargado (el control está deshabilitado
   * y solo se cambia desde el listado).
   */
  private toShelfWriteInput(): ShelfWriteInput {
    const raw = this.form.getRawValue();

    return {
      name: raw.name,
      description: raw.description,
      isActive: this.isEdit ? this.loadedIsActive : raw.isActive,
    };
  }

  /** Precarga del diálogo de edición con `GET /{id}`. */
  private loadLocation(locationId: number): void {
    this.locations
      .getById(locationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (shelf) => {
          this.loadedIsActive = shelf.isActive;
          this.form.controls.name.setValue(shelf.name);
          this.form.controls.description.setValue(shelf.description ?? '');
          this.cells.clear();
          for (const cell of shelf.cells) {
            this.cells.push(
              this.createCellGroup({
                id: cell.id,
                section: cell.section,
                cell: cell.cell,
                description: cell.description ?? '',
                isActive: cell.isActive,
              }),
            );
          }
          this.loadingLocation.set(false);
        },
        error: () => {
          // 404 u otro fallo: el listado informa; el diálogo no sirve vacío.
          this.dialogRef.close({ notFound: true });
        },
      });
  }

  /** Fila del editor de celdas con sus validadores. */
  private createCellGroup(value: CellRowValue): CellFormGroup {
    return new FormGroup({
      id: new FormControl(value.id, { nonNullable: true }),
      section: new FormControl(value.section, {
        nonNullable: true,
        validators: [requiredTrimmed, Validators.maxLength(CELL_MAX_LENGTH)],
      }),
      cell: new FormControl(value.cell, {
        nonNullable: true,
        validators: [requiredTrimmed, Validators.maxLength(CELL_MAX_LENGTH)],
      }),
      description: new FormControl(value.description, {
        nonNullable: true,
        validators: [Validators.maxLength(DESCRIPTION_MAX_LENGTH)],
      }),
      isActive: new FormControl(value.isActive, { nonNullable: true }),
    });
  }

  /**
   * Revalida cada control tras fijar/limpiar `fieldErrors`: el
   * `updateValueAndValidity()` del `FormGroup` no propaga a los hijos, así que
   * sin este recorrido el validador `serverError` nunca se reevalúa y los
   * `mat-error` con `hasError('server')` jamás se muestran. Las filas de
   * celdas se recorren igual porque no llevan errores de servidor propios.
   */
  private refreshServerValidity(): void {
    Object.values(this.form.controls).forEach((control) => {
      control.updateValueAndValidity();
      if (control instanceof FormArray) {
        control.controls.forEach((child) => child.updateValueAndValidity());
      }
    });
  }

  /**
   * Validador que refleja el rechazo 409/422 del backend para el campo:
   * mientras `fieldErrors` conserve mensaje para ese campo, el control es
   * inválido con error `server`. Se limpia al iniciar cada submit, de modo que
   * nunca bloquea un reintento.
   */
  private serverError(field: keyof LocationsFieldErrors): ValidatorFn {
    return () => (this.fieldErrors()[field] ? { server: true } : null);
  }
}

/** Valores de una fila del editor como entrada de dominio de una celda. */
function toCellWriteInput(row: CellRowValue): CellWriteInput {
  return {
    section: row.section,
    cell: row.cell,
    description: row.description,
    isActive: row.isActive,
  };
}

/** Fallo de guardado ya traducido, con los errores por campo disponibles. */
function saveFailureFrom(mapped: {
  message: string;
  fieldErrors?: LocationsFieldErrors;
}): SaveFailure {
  return new SaveFailure(mapped.message, mapped.fieldErrors);
}
