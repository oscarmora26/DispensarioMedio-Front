/**
 * Inicio de sesión (`dm-login`).
 *
 * Página fuera del shell: sin topbar, sidenav, skip-link ni footer. Formulario
 * reactivo tipado (`FormGroup` con `FormControl<string>` `nonNullable`),
 * validadores `required` + `email` + `maxlength` 255/128 alineados con el
 * backend y señales de estado (`submitting`, `error`, `fieldErrors`,
 * `showPassword`). El submit llama a `AuthService.login()` y navega al `returnUrl` saneado con
 * `replaceUrl`; los errores se traducen con `mapAuthError()` y los 422 por
 * campo se marcan con error `server` sin exponer el mensaje del backend.
 * Sin HTTP directo y sin acceso al almacenamiento.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { mapAuthError } from '../../../core/auth/auth-error';
import { sanitizeReturnUrl } from '../../../core/auth/auth.guard';
import { AuthService } from '../../../core/auth/auth.service';

/** Mensajes propios del backend-422 ya traducidos, por campo. */
interface LoginFieldErrors {
  email?: string;
  password?: string;
}

@Component({
  selector: 'dm-login',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** Envío en curso: deshabilita campos y botón, `aria-busy` y etiqueta. */
  readonly submitting = signal(false);

  /** Error general ya traducido para la región `role="alert"`. */
  readonly error = signal<string | null>(null);

  /** Errores 422 por campo ya traducidos (fuente del validador `server`). */
  readonly fieldErrors = signal<LoginFieldErrors>({});

  /** Visibilidad de la contraseña. */
  readonly showPassword = signal(false);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
        Validators.maxLength(255),
        this.serverError('email'),
      ],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(128), this.serverError('password')],
    }),
  });

  private readonly reason = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('reason'))),
    { initialValue: null as string | null },
  );

  /** Aviso no crítico de sesión expirada (`role="status"`). */
  readonly showExpiredNotice = computed(() => this.reason() === 'expired');

  constructor() {
    effect(() => {
      if (this.submitting()) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  onSubmit(): void {
    this.fieldErrors.set({});
    this.form.updateValueAndValidity();
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth
      .login({
        email: this.form.controls.email.value,
        password: this.form.controls.password.value,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          const returnUrl = sanitizeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
          void this.router.navigateByUrl(returnUrl, { replaceUrl: true });
        },
        error: (error: unknown) => {
          const mapped = mapAuthError(error);
          this.fieldErrors.set(mapped.fieldErrors ?? {});
          this.form.updateValueAndValidity();
          this.error.set(mapped.message);
          this.submitting.set(false);
        },
      });
  }

  /**
   * Validador que refleja el rechazo 422 del backend para el campo: mientras
   * `fieldErrors` conserve mensaje para ese campo, el control es inválido con
   * error `server` (así `mat-error` lo muestra con el estado correcto). Se
   * limpia al iniciar cada submit, de modo que nunca bloquea un reintento.
   */
  private serverError(field: keyof LoginFieldErrors): ValidatorFn {
    return () => (this.fieldErrors()[field] ? { server: true } : null);
  }
}
