/** Carrega el generador amb Vite perquè els widgets reals puguin importar CSS. */
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
});

try {
  await server.ssrLoadModule('/scripts/build-seo-pages.ts');
} finally {
  await server.close();
}
