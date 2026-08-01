/**
 * On és el worker de MapLibre. Sense això, el mapa no dibuixa la franja.
 *
 * EL SÍMPTOMA. Cartografia base sí, franja de totalitat no. Ni límits, ni línia
 * central. Cap error a la consola, cap error a `map.on('error')`, la geometria
 * ben calculada i les tres fonts ben registrades a l'estil. `querySourceFeatures`
 * a zero i `map.isStyleLoaded()` fals per sempre. Passava en desenvolupament i
 * en producció alhora.
 *
 * LA CAUSA. MapLibre 6.1.0 es calcula la URL del seu worker en temps d'execució
 * a partir d'`import.meta.url` del mòdul que s'estigui executant:
 *
 *     let t = e.endsWith('-dev.mjs') ? 'maplibre-gl-worker-dev.mjs'
 *                                    : 'maplibre-gl-worker.mjs';
 *     return new URL(`./${t}`, e).href;
 *
 * Com que la URL es munta amb una plantilla, cap empaquetador la veu. I com que
 * tots dos empaquetadors mouen el mòdul de lloc sense endur-se el worker:
 *
 *   · Vite en desenvolupament el serveix des de `/node_modules/.vite/deps/`,
 *     on hi ha `maplibre-gl.js` i prou. El worker demanat: 404.
 *   · Rollup en producció el fon dins d'`assets/index-<hash>.js` i hi deixa el
 *     nom cru. El worker demanat, `assets/maplibre-gl-worker.mjs`: 404.
 *
 * El worker peta en arrencar i no respon mai. Les tessel·les RÀSTER no el
 * necessiten —es descodifiquen al fil principal— i per això la cartografia es
 * veia. El GeoJSON sí que s'hi analitza, i per això la franja no hi era.
 * Mesurat instrumentant `window.Worker`: el worker del terreny fa 1 missatge
 * d'anada i 34 de tornada; el de MapLibre, 1 d'anada, 0 de tornada i error.
 *
 * PER QUÈ `?worker&url` I NO `?url`. El worker no va sol: importa
 * `./maplibre-gl-shared.mjs`, que fa 479 kB. Amb `?url` Vite copiaria els 19 kB
 * del worker i prou, i l'import del germà tornaria a fer 404 — el mateix
 * problema una capa més avall. Amb `?worker&url` l'empaqueta amb tot el que
 * necessita i en torna l'adreça definitiva, que és el que `setWorkerUrl` vol.
 *
 * Es fa a la importació i no dins d'un efecte perquè ha d'estar decidit abans
 * que existeixi cap mapa: `EclipseMap` importa aquest mòdul, i amb això n'hi ha
 * prou.
 */

import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(maplibreWorkerUrl);
