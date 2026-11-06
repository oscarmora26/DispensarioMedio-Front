import { defineConfig } from 'vitest/config';

/**
 * Configuración base de Vitest para la suite completa.
 *
 * El timeout por defecto (5 s) es insuficiente para el primer test de ruta
 * lazy de `src/app/app.spec.ts` cuando los ~60 archivos de spec corren en
 * paralelo: la transformación del chunk diferido se cobra dentro del test y
 * supera los 5 s aunque el test pase en aislamiento. Un límite de 15 s sigue
 * detectando cuelgues reales sin depender de la carga de la máquina.
 */
export default defineConfig({
  test: {
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
