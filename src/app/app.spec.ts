import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the dm-app-shell layout', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('dm-app-shell')).not.toBeNull();
  });

  it('shows the product brand inside the shell topbar landmark', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const topbar = compiled.querySelector('dm-app-shell header');
    expect(topbar?.textContent).toContain('Dispensario Médico');
  });

  it('renders the home route inside the shell content area', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const home = compiled.querySelector('dm-home');

    expect(router.url).toBe('/');
    expect(home).not.toBeNull();
    expect(home?.closest('dm-app-shell')).not.toBeNull();
    expect(home?.querySelector('mat-card')).not.toBeNull();
  });

  it('redirects unknown routes to the home route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    await fixture.whenStable();
    await router.navigateByUrl('/ruta-inexistente');
    fixture.detectChanges();

    expect(router.url).toBe('/');
    expect((fixture.nativeElement as HTMLElement).querySelector('dm-home')).not.toBeNull();
  });
});
