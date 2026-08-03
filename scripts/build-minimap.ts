/**
 * Cou la imatge base del mini-mapa de la portada.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER. Perquè no existia. La imatge es va coure
 * una vegada a mà en un navegador, es va comitejar i el que va arribar al
 * lloc publicat eren 1296×1008 píxels a (0,0,0,0): transparent de dalt a
 * baix. El component en va sortir amb la franja de totalitat surant damunt
 * del no-res, i el `filter: brightness(1.9)` que hi havia per «il·luminar el
 * CARTO fosc» no hi podia fer res. Ningú no en va mirar mai els píxels
 * perquè no hi havia manera de tornar-la a fer ni res que la comprovés.
 *
 * Ara la fa aquest script, amb les MATEIXES tessel·les que demana l'app
 * (`BASEMAP.urlTemplate` de `offline/config.ts` — la mateixa URL, que en
 * aquest projecte és un invariant amb prova pròpia) i l'enquadrament que
 * IMPORTA de `minimapFrame.ts`, no una còpia. I `minimap-asset.test.ts` mira
 * els píxels del resultat, que és la peça que faltava.
 *
 * ÚS:  npx tsx scripts/build-minimap.ts
 *
 * COST: dotze tessel·les de ~20 kB a zoom 6. Es fa a mà i molt de tant en
 * tant; no toca cap límit de ningú.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASEMAP } from '../src/offline/config';
import {
  MINIMAP_EAST,
  MINIMAP_NORTH,
  MINIMAP_SOUTH,
  MINIMAP_WEST,
  mercY,
} from '../src/features/map/minimapFrame';
import { decodePng, encodePng } from './png';

/**
 * Zoom de les tessel·les.
 *
 * A zoom 6 el món fa 16.384 px i la caixa de la Península hi ocupa uns
 * 725×560: prou per a un widget de 400 px d'ample amb pantalla de densitat
 * doble, i dotze tessel·les de descàrrega. A zoom 7 serien 1450×1120 i
 * quaranta-vuit tessel·les per a un widget que no les ensenyarà mai.
 */
const ZOOM = 6;
const TILE = 256;

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'public', 'brand', 'minimapa-iberia.png');

/** Píxel del món (Web Mercator) d'una longitud, al zoom donat. */
function worldX(lonDeg: number): number {
  return ((lonDeg + 180) / 360) * TILE * 2 ** ZOOM;
}

/** Píxel del món d'una latitud. */
function worldY(latDeg: number): number {
  const scale = TILE * 2 ** ZOOM;
  return (0.5 - mercY(latDeg) / (2 * Math.PI)) * scale;
}

async function fetchTile(x: number, y: number): Promise<Buffer> {
  const url = BASEMAP.urlTemplate
    .replace('{z}', String(ZOOM))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
  const response = await fetch(url, {
    headers: { 'User-Agent': 'eclipsi.info build-minimap (https://eclipsi.info)' },
  });
  if (!response.ok) throw new Error(`tessel·la ${ZOOM}/${x}/${y}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main(): Promise<void> {
  const left = worldX(MINIMAP_WEST);
  const right = worldX(MINIMAP_EAST);
  const top = worldY(MINIMAP_NORTH);
  const bottom = worldY(MINIMAP_SOUTH);

  const width = Math.round(right - left);
  const height = Math.round(bottom - top);

  const x0 = Math.floor(left / TILE);
  const x1 = Math.floor((right - 1e-6) / TILE);
  const y0 = Math.floor(top / TILE);
  const y1 = Math.floor((bottom - 1e-6) / TILE);

  const count = (x1 - x0 + 1) * (y1 - y0 + 1);
  console.log(
    `Enquadrament ${MINIMAP_WEST.toFixed(3)}…${MINIMAP_EAST.toFixed(3)} × ` +
      `${MINIMAP_SOUTH}…${MINIMAP_NORTH} → ${width}×${height} px, ${count} tessel·les de zoom ${ZOOM}`,
  );

  const out = Buffer.alloc(width * height * 3);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const tile = decodePng(await fetchTile(tx, ty));
      if (tile.width !== TILE || tile.height !== TILE) {
        throw new Error(`tessel·la ${ZOOM}/${tx}/${ty} fa ${tile.width}×${tile.height}`);
      }
      // Cantonada de la tessel·la dins de la imatge de sortida.
      const dx = tx * TILE - left;
      const dy = ty * TILE - top;
      for (let sy = 0; sy < TILE; sy++) {
        const destY = Math.round(dy) + sy;
        if (destY < 0 || destY >= height) continue;
        for (let sx = 0; sx < TILE; sx++) {
          const destX = Math.round(dx) + sx;
          if (destX < 0 || destX >= width) continue;
          const src = (sy * TILE + sx) * 3;
          const dest = (destY * width + destX) * 3;
          out[dest] = tile.data[src];
          out[dest + 1] = tile.data[src + 1];
          out[dest + 2] = tile.data[src + 2];
        }
      }
      process.stdout.write('.');
    }
  }
  process.stdout.write('\n');

  /*
   * EL COP DE LLUM VA AQUÍ, NO AL CSS.
   *
   * El CARTO fosc encabit en 190 px de widget és perceptualment negre: el
   * report de camp deia literalment «el widget no mostra mapa». Es corregia
   * amb un `filter: brightness(1.9)` a l'element, que costa una capa de
   * composició a cada pintada del navegador i, sobretot, amaga l'estat real
   * de l'actiu — amb la imatge buida, el filtre feia exactament el mateix que
   * sense. Cuit a la imatge, el que hi ha al disc és el que es veu.
   */
  const GAIN = 1.9;
  for (let i = 0; i < out.length; i++) out[i] = Math.min(255, Math.round(out[i] * GAIN));

  let sum = 0;
  let max = 0;
  for (let i = 0; i < out.length; i++) {
    sum += out[i];
    if (out[i] > max) max = out[i];
  }
  const avg = sum / out.length;
  if (max === 0) throw new Error('la imatge ha sortit negra: cap tessel·la portava dades');

  const png = encodePng({ width, height, data: out });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, png);
  console.log(
    `Escrit ${OUT}: ${(png.length / 1024).toFixed(1)} kB, lluminositat mitjana ${avg.toFixed(1)}, màxima ${max}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
