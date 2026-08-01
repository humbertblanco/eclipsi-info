import { defineConfig } from 'vitest/config';

/**
 * Configuració pròpia de Vitest, separada de `vite.config.ts`.
 *
 * Si no hi fos, Vitest agafaria `vite.config.ts`, que carrega el plugin de
 * React i el de certificats autofirmats. Cap dels dos fa cap falta per provar
 * el nucli astronòmic i el segon arriba a generar un certificat cada vegada
 * que s'arrenca la suite.
 */
export default defineConfig({
  test: {
    // Entorn Node: el nucli (`src/core/**`) no toca el DOM enlloc, i muntar
    // jsdom només per fer trigonometria seria pagar un peatge per res.
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Els tests d'or recorren desenes de municipis i cada un fa una cerca
    // d'arrels amb centenars de crides a efemèrides.
    testTimeout: 60_000,
  },
});
