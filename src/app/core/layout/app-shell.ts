import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Breakpoint canónico del layout (coincide con `dm-desktop` en `_tokens.scss`). */
const DESKTOP_MEDIA_QUERY = '(min-width: 1280px)';

/**
 * Devuelve el `MediaQueryList` del breakpoint desktop o `null` cuando el
 * entorno no lo soporta (SSR, jsdom). Con `null` el shell asume desktop, que es
 * el modo con más contenido visible.
 */
function createDesktopQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  return window.matchMedia(DESKTOP_MEDIA_QUERY);
}

@Component({
  selector: 'dm-app-shell',
  imports: [MatIconModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closeNavigation()',
  },
})
export class AppShell {
  private readonly destroyRef = inject(DestroyRef);
  private readonly desktopQuery = createDesktopQuery();

  /** `true` en desktop (≥1280px): drawer persistente y colapsable. */
  readonly isDesktop = signal(this.desktopQuery?.matches ?? true);

  /** Drawer persistente colapsado (solo aplica en desktop). */
  readonly collapsed = signal(false);

  /** Drawer off-canvas abierto (solo aplica en tablet y mobile). */
  readonly mobileOpen = signal(false);

  /** Estado que expone el toggle mediante `aria-expanded`. */
  readonly navigationExpanded = computed(() =>
    this.isDesktop() ? !this.collapsed() : this.mobileOpen(),
  );

  /** En off-canvas cerrado la navegación queda fuera del orden de tabulación. */
  readonly navigationInert = computed(() => !this.isDesktop() && !this.mobileOpen());

  readonly backdropVisible = computed(() => !this.isDesktop() && this.mobileOpen());

  constructor() {
    const query = this.desktopQuery;

    if (!query) {
      return;
    }

    const onChange = (event: MediaQueryListEvent): void => {
      this.isDesktop.set(event.matches);

      if (event.matches) {
        this.mobileOpen.set(false);
      }
    };

    query.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
  }

  toggleNavigation(): void {
    if (this.isDesktop()) {
      this.collapsed.update((collapsed) => !collapsed);
      return;
    }

    this.mobileOpen.update((open) => !open);
  }

  closeNavigation(): void {
    this.mobileOpen.set(false);
  }
}
