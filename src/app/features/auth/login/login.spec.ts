import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { Login } from './login';

const LOGIN_URL = `${environment.apiUrl}/v1/auth/login`;

const MESSAGES = {
  invalidCredentials: 'Correo electrónico o contraseña incorrectos.',
  inactive: 'Tu cuenta está inactiva. Contacta al administrador del sistema.',
  rateLimited: 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
  validation: 'Revisa los datos ingresados.',
  validationUser: 'Revisa el correo electrónico',
  validationPassword: 'Revisa la contraseña',
  network: 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
  unexpected: 'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
  expired: 'Tu sesión expiró. Inicia sesión de nuevo.',
} as const;

function successResponse(username = 'medico.demo'): Record<string, unknown> {
  return {
    access_token: 'token-sintetico-de-prueba',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: 7,
      username,
      email: 'medico.demo@example.test',
      role: 'MEDICO',
      doctor_id: 12,
    },
  };
}

interface LoginHarness {
  fixture: ComponentFixture<Login>;
  component: Login;
  auth: AuthService;
  httpMock: HttpTestingController;
  router: Router;
  host: HTMLElement;
  emailInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  submitButton: HTMLButtonElement;
  toggle: HTMLButtonElement;
  form: HTMLFormElement;
  card: HTMLElement;
}

async function createLogin(queryParams: Record<string, string> = {}): Promise<LoginHarness> {
  TestBed.resetTestingModule();
  const paramMap = convertToParamMap(queryParams);
  await TestBed.configureTestingModule({
    imports: [Login],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: paramMap },
          queryParamMap: of(paramMap),
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Login);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const host = fixture.nativeElement as HTMLElement;
  const query = <T extends Element>(selector: string): T => {
    const element = host.querySelector<T>(selector);

    if (!element) {
      throw new Error(`No se encontró "${selector}"`);
    }

    return element;
  };

  return {
    fixture,
    component: fixture.componentInstance,
    auth: TestBed.inject(AuthService),
    httpMock: TestBed.inject(HttpTestingController),
    router: TestBed.inject(Router),
    host,
    emailInput: query<HTMLInputElement>('input[formControlName="email"]'),
    passwordInput: query<HTMLInputElement>('input[formControlName="password"]'),
    submitButton: query<HTMLButtonElement>('button.dm-login__submit'),
    toggle: query<HTMLButtonElement>('button.dm-login__toggle'),
    form: query<HTMLFormElement>('form.dm-login__form'),
    card: query<HTMLElement>('.dm-login__card'),
  };
}

function fillValid(harness: LoginHarness): void {
  harness.component.form.controls.email.setValue('medico.demo@example.test');
  harness.component.form.controls.password.setValue('Secreto-sintetico-1');
  harness.fixture.detectChanges();
}

/**
 * Texto del CSS compilado propio del login que Angular inyecta en el documento
 * durante el test (encapsulación emulada → `<style>` en `<head>`). Se filtra
 * por `.dm-login` para excluir los estilos de Angular Material, que gestionan
 * su propio foco con reemplazo y quedan fuera del alcance de CA-04.
 */
function ownStyleText(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .filter((css) => css.includes('.dm-login'))
    .join('\n');
}

describe('Login', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  describe('estructura y accesibilidad (CA-15)', () => {
    it('usa un único main con un h1 y el subtítulo', async () => {
      const { host } = await createLogin();

      expect(host.querySelectorAll('main')).toHaveLength(1);
      expect(host.querySelectorAll('h1')).toHaveLength(1);
      expect(host.querySelector('h1')?.textContent).toContain('Dispensario Médico');
      expect(host.textContent).toContain('Inicia sesión para continuar');
    });

    it('expone mat-label visible, autocomplete, maxlength y required por campo', async () => {
      const { host, emailInput, passwordInput } = await createLogin();
      const labels = Array.from(host.querySelectorAll('mat-label')).map((label) =>
        label.textContent?.trim(),
      );

      expect(labels).toEqual(['Correo electrónico', 'Contraseña']);
      expect(emailInput.getAttribute('autocomplete')).toBe('email');
      expect(emailInput.getAttribute('inputmode')).toBe('email');
      expect(emailInput.getAttribute('type')).toBe('email');
      expect(passwordInput.getAttribute('autocomplete')).toBe('current-password');
      expect(emailInput.getAttribute('maxlength')).toBe('255');
      expect(passwordInput.getAttribute('maxlength')).toBe('128');
      expect(emailInput.required).toBe(true);
      expect(passwordInput.required).toBe(true);
    });

    it('no usa placeholders como sustituto de etiqueta', async () => {
      const { emailInput, passwordInput } = await createLogin();

      expect(emailInput.getAttribute('placeholder')).toBeNull();
      expect(passwordInput.getAttribute('placeholder')).toBeNull();
    });

    it('muestra el aviso de sesión expirada en role=status solo con reason=expired', async () => {
      const expired = await createLogin({ reason: 'expired' });
      const status = expired.host.querySelector('[role="status"]');

      expect(status?.textContent).toContain(MESSAGES.expired);

      const fresh = await createLogin();

      expect(fresh.host.querySelector('[role="status"]')).toBeNull();
    });

    it('informa el enlace de ayuda sin prometer recuperación inexistente', async () => {
      const { host } = await createLogin();

      expect(host.querySelector('a[href*="password"]')).toBeNull();
      expect(host.textContent).toContain(
        'Si no recuerdas tu contraseña, contacta al administrador del sistema.',
      );
    });
  });

  describe('foco y envío (F-004 CA-01/CA-03; CA-16 de F-002 enmendado)', () => {
    it('no aplica foco automático inicial en ningún campo', async () => {
      const { host, emailInput, passwordInput } = await createLogin();

      expect(document.activeElement).toBe(document.body);
      expect(host.querySelector('[autofocus]')).toBeNull();
      expect(emailInput.hasAttribute('autofocus')).toBe(false);
      expect(passwordInput.hasAttribute('autofocus')).toBe(false);
    });

    it('el envío nativo del formulario hace una sola petición', async () => {
      const harness = await createLogin();
      fillValid(harness);

      harness.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      harness.fixture.detectChanges();

      harness.httpMock.expectOne(LOGIN_URL).flush(successResponse());
      expect(harness.httpMock).toBeTruthy();
    });

    it('un doble submit en curso emite una sola petición', async () => {
      const harness = await createLogin();
      fillValid(harness);

      harness.component.onSubmit();
      harness.component.onSubmit();

      harness.httpMock.expectOne(LOGIN_URL).flush(successResponse());
    });

    it('el submit emite POST exacto {email, password} sin username (F-005 CA-01)', async () => {
      const harness = await createLogin();
      fillValid(harness);

      harness.component.onSubmit();
      const req = harness.httpMock.expectOne(LOGIN_URL);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 'medico.demo@example.test',
        password: 'Secreto-sintetico-1',
      });
      expect(req.request.body).not.toHaveProperty('username');
      req.flush(successResponse());
    });

    it('el toggle no envía el formulario y alterna tipo y etiquetas', async () => {
      const harness = await createLogin();
      fillValid(harness);

      expect(harness.passwordInput.type).toBe('password');
      expect(harness.toggle.getAttribute('aria-pressed')).toBe('false');
      expect(harness.toggle.getAttribute('aria-label')).toBe('Mostrar contraseña');
      expect(harness.toggle.getAttribute('type')).toBe('button');

      harness.toggle.click();
      harness.fixture.detectChanges();

      expect(harness.passwordInput.type).toBe('text');
      expect(harness.toggle.getAttribute('aria-pressed')).toBe('true');
      expect(harness.toggle.getAttribute('aria-label')).toBe('Ocultar contraseña');

      harness.toggle.click();
      harness.fixture.detectChanges();

      expect(harness.passwordInput.type).toBe('password');
      harness.httpMock.expectNone(LOGIN_URL);
    });

    it('permite pegar en la contraseña sin bloquearlo', async () => {
      const harness = await createLogin();

      const paste = new Event('paste', { bubbles: true, cancelable: true });
      harness.passwordInput.dispatchEvent(paste);

      expect(paste.defaultPrevented).toBe(false);

      harness.passwordInput.value = 'pegado-con-el-portapapeles';
      harness.passwordInput.dispatchEvent(new Event('input'));
      harness.fixture.detectChanges();

      expect(harness.component.form.controls.password.value).toBe('pegado-con-el-portapapeles');
    });

    it('durante el envío deshabilita controles, marca aria-busy y cambia la etiqueta', async () => {
      const harness = await createLogin();
      fillValid(harness);

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.component.submitting()).toBe(true);
      expect(harness.emailInput.disabled).toBe(true);
      expect(harness.passwordInput.disabled).toBe(true);
      expect(harness.submitButton.disabled).toBe(true);
      expect(harness.card.getAttribute('aria-busy')).toBe('true');
      expect(harness.submitButton.textContent).toContain('Ingresando…');

      harness.httpMock.expectOne(LOGIN_URL).flush(successResponse());
    });
  });

  describe('validación de campos', () => {
    it('campos vacíos muestran mensajes propios y no emiten petición', async () => {
      const harness = await createLogin();

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.host.textContent).toContain('Ingresa tu correo electrónico');
      expect(harness.host.textContent).toContain('Ingresa tu contraseña');
      harness.httpMock.expectNone(LOGIN_URL);
      expect(harness.component.submitting()).toBe(false);
    });

    it('rechaza correo de más de 255 caracteres', async () => {
      const harness = await createLogin();
      harness.component.form.controls.email.setValue(`${'a'.repeat(243)}@example.test`);
      harness.component.form.controls.password.setValue('Secreto-sintetico-1');

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.host.textContent).toContain(
        'El correo electrónico no debe superar los 255 caracteres.',
      );
      harness.httpMock.expectNone(LOGIN_URL);
    });

    it('rechaza texto sin @ con el validador email de Angular', async () => {
      const harness = await createLogin();
      harness.component.form.controls.email.setValue('sin-arroba');
      harness.component.form.controls.password.setValue('Secreto-sintetico-1');

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.host.textContent).toContain('Ingresa un correo electrónico válido.');
      harness.httpMock.expectNone(LOGIN_URL);
    });

    it('rechaza contraseña de más de 128 caracteres', async () => {
      const harness = await createLogin();
      harness.component.form.controls.email.setValue('medico.demo@example.test');
      harness.component.form.controls.password.setValue('a'.repeat(129));

      harness.component.onSubmit();
      harness.fixture.detectChanges();

      expect(harness.host.textContent).toContain(
        'La contraseña no debe superar los 128 caracteres.',
      );
      harness.httpMock.expectNone(LOGIN_URL);
    });
  });

  describe('errores del backend (CA-13/CA-14)', () => {
    it.each([
      {
        status: 401,
        body: {
          detail: 'Usuario o contraseña incorrectos',
          code: 'invalid_credentials',
          errors: [],
        },
        expected: MESSAGES.invalidCredentials,
      },
      {
        status: 403,
        body: { detail: 'Inactive', code: 'inactive_user', errors: [] },
        expected: MESSAGES.inactive,
      },
      {
        status: 429,
        body: { detail: 'Rate limited', code: 'rate_limited', errors: [] },
        expected: MESSAGES.rateLimited,
      },
      {
        status: 422,
        body: { detail: 'Datos inválidos', code: 'validation_error', errors: [] },
        expected: MESSAGES.validation,
      },
      {
        status: 500,
        body: { detail: 'Boom', code: 'internal', errors: [] },
        expected: MESSAGES.unexpected,
      },
    ])('status $status muestra "$expected" sin tecnicismos', async ({ status, body, expected }) => {
      const harness = await createLogin();
      fillValid(harness);
      harness.submitButton.focus();

      const focused = document.activeElement;
      harness.component.onSubmit();
      harness.httpMock.expectOne(LOGIN_URL).flush(body, { status, statusText: 'Error' });
      harness.fixture.detectChanges();

      const alert = harness.host.querySelector('[role="alert"]');

      expect(alert?.textContent).toContain(expected);
      expect(alert?.textContent).not.toContain('invalid_credentials');
      expect(alert?.textContent).not.toContain('token');
      expect(harness.component.submitting()).toBe(false);
      expect(harness.submitButton.disabled).toBe(false);
      expect(harness.submitButton.textContent).toContain('Iniciar sesión');
      expect(harness.emailInput.disabled).toBe(false);
      expect(document.activeElement).toBe(focused);
    });

    it('status 0 muestra el mensaje de red y permite reintentar', async () => {
      const harness = await createLogin();
      fillValid(harness);

      harness.component.onSubmit();
      harness.httpMock.expectOne(LOGIN_URL).error(new ProgressEvent('error'));
      harness.fixture.detectChanges();

      expect(harness.host.querySelector('[role="alert"]')?.textContent).toContain(MESSAGES.network);
      expect(harness.component.submitting()).toBe(false);
      expect(harness.submitButton.disabled).toBe(false);
    });

    it('422 con campos conocidos muestra errores propios bajo cada campo', async () => {
      const harness = await createLogin();
      fillValid(harness);

      harness.component.onSubmit();
      harness.httpMock.expectOne(LOGIN_URL).flush(
        {
          detail: 'Datos inválidos',
          code: 'validation_error',
          errors: [
            { field: 'email', message: 'email too short' },
            { field: 'password', message: 'password too short' },
            { field: 'username', message: 'username internals' },
            { field: 'desconocido', message: 'backend internals' },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      harness.fixture.detectChanges();

      expect(harness.host.querySelector('[role="alert"]')?.textContent).toContain(
        MESSAGES.validation,
      );
      expect(harness.host.textContent).toContain(MESSAGES.validationUser);
      expect(harness.host.textContent).toContain(MESSAGES.validationPassword);
      expect(harness.host.textContent).not.toContain('too short');
      expect(harness.host.textContent).not.toContain('internals');
      expect(harness.component.submitting()).toBe(false);
    });
  });

  describe('navegación tras login (F-005 CA-01; F-002 CA-12)', () => {
    it('navega al returnUrl saneado con replaceUrl', async () => {
      const harness = await createLogin({ returnUrl: '/origen' });
      const navigateSpy = vi.spyOn(harness.router, 'navigateByUrl').mockResolvedValue(true);
      fillValid(harness);

      harness.component.onSubmit();
      harness.httpMock.expectOne(LOGIN_URL).flush(successResponse());

      expect(navigateSpy).toHaveBeenCalledWith('/origen', { replaceUrl: true });
    });

    it.each([['//evil.test'], ['/\\evil'], ['https://evil.test/phish'], ['javascript:alert(1)']])(
      'returnUrl hostil %p se sustituye por /',
      async (hostile) => {
        const harness = await createLogin({ returnUrl: hostile });
        const navigateSpy = vi.spyOn(harness.router, 'navigateByUrl').mockResolvedValue(true);
        fillValid(harness);

        harness.component.onSubmit();
        harness.httpMock.expectOne(LOGIN_URL).flush(successResponse());

        expect(navigateSpy).toHaveBeenCalledWith('/', { replaceUrl: true });
      },
    );

    it('sin returnUrl navega a /', async () => {
      const harness = await createLogin();
      const navigateSpy = vi.spyOn(harness.router, 'navigateByUrl').mockResolvedValue(true);
      fillValid(harness);

      harness.component.onSubmit();
      harness.httpMock.expectOne(LOGIN_URL).flush(successResponse());

      expect(navigateSpy).toHaveBeenCalledWith('/', { replaceUrl: true });
    });
  });

  describe('anillo de foco único (F-003)', () => {
    it('los inputs llevan la clase excluida .mat-mdc-input-element (Material)', async () => {
      const { emailInput, passwordInput } = await createLogin();

      expect(emailInput.classList.contains('mat-mdc-input-element')).toBe(true);
      expect(passwordInput.classList.contains('mat-mdc-input-element')).toBe(true);
      expect(emailInput.matches(':not(.mat-mdc-input-element)')).toBe(false);
      expect(passwordInput.matches(':not(.mat-mdc-input-element)')).toBe(false);
    });

    it('botón y toggle no llevan la clase excluida y conservan el anillo genérico', async () => {
      const { submitButton, toggle } = await createLogin();

      expect(submitButton.matches(':not(.mat-mdc-input-element)')).toBe(true);
      expect(toggle.matches(':not(.mat-mdc-input-element)')).toBe(true);
    });

    it('el CSS compilado acota :focus-visible con :not(.mat-mdc-input-element)', async () => {
      await createLogin();
      const css = ownStyleText();

      expect(css).toContain('.dm-login');
      expect(css).toContain(':focus-visible:not(.mat-mdc-input-element)');
      expect(css).toContain('--dm-focus-ring-width');
    });

    it('ningún estilo inyectado elimina el outline sin reemplazo (CA-04)', async () => {
      await createLogin();

      // Patrón construido por partes para no introducir el literal en este
      // spec y no interferir con el grep de CA-04 sobre las fuentes.
      const outlineNone = new RegExp(`out${'line'}\\s*:\\s*no${'ne'}`);

      expect(outlineNone.test(ownStyleText())).toBe(false);
    });

    it('el foco por teclado recorre Correo electrónico, Contraseña, toggle y botón en orden (CA-05)', async () => {
      const { emailInput, passwordInput, toggle, submitButton } = await createLogin();
      const orden = [emailInput, passwordInput, toggle, submitButton];

      for (const control of orden) {
        expect(control.disabled).toBe(false);
      }

      for (const control of orden) {
        control.focus();
        expect(document.activeElement).toBe(control);
      }

      for (let i = 1; i < orden.length; i += 1) {
        const previo = orden[i - 1] as HTMLElement;
        const actual = orden[i] as HTMLElement;

        expect(
          previo.compareDocumentPosition(actual) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    });

    it('los fields usan appearance outline de Material (reemplazo visible del anillo)', async () => {
      const { host } = await createLogin();
      const fields = Array.from(host.querySelectorAll('mat-form-field'));

      expect(fields).toHaveLength(2);
      for (const field of fields) {
        expect(field.classList.contains('mat-form-field-appearance-outline')).toBe(true);
      }
    });
  });
});
