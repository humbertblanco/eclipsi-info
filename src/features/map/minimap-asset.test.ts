/**
 * La imatge base del mini-mapa ha de tenir MAPA a dins.
 *
 * PER QUÈ CAL UNA PROVA PER A UNA COSA TAN ÒBVIA. Perquè va fallar i no ho va
 * veure ningú: `public/brand/minimapa-iberia.png` es va publicar amb
 * 1296×1008 píxels a (0,0,0,0) —transparent sencera— i va arribar al lloc
 * publicat. El component la pintava, el CSS li aplicava un
 * `filter: brightness(1.9)` per «treure-la de la penombra», i el resultat era
 * la franja de totalitat surant damunt del negre. Cap prova mirava mai un
 * píxel, i un actiu binari no es revisa llegint el diff.
 *
 * QUÈ VIGILA, i per què aquests tres talls i no uns altres:
 *
 *  · QUE NO SIGUI BUIDA. És l'error que va passar. Un màxim de zero vol dir
 *    imatge negra; una mitjana de zero, imatge transparent.
 *  · QUE TINGUI CONTRAST. Una imatge d'un sol color pla passaria el tall
 *    anterior i seguiria sense ser un mapa. Es demana desviació típica, que és
 *    el que distingeix «hi ha costa, rius i ciutats» de «hi ha un rectangle».
 *  · QUE LA PROPORCIÓ SIGUI LA DE LA CAIXA GEOGRÀFICA. Amb `background-size:
 *    cover`, una imatge amb una altra proporció es retalla, i el canvas hi
 *    dibuixaria a sobre desplaçat. `MINIMAP_ASPECT` és la font de veritat i
 *    surt del mateix mòdul que fa servir el generador.
 *
 * Descodificar un PNG aquí és barat perquè el generador n'escriu un de molt
 * concret: RGB de 8 bits, sense entrellaçar i amb filtre 0 a totes les files
 * (vegeu `scripts/png.ts`). Si algun dia el generador canvia, aquesta prova
 * ha de petar — i és el que ha de fer.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { MINIMAP_ASPECT } from './minimapFrame';

const here = dirname(fileURLToPath(import.meta.url));
const ASSET = join(here, '..', '..', '..', 'public', 'brand', 'minimapa-iberia.png');

interface Decoded {
  width: number;
  height: number;
  colorType: number;
  /** Lluminositat de cada píxel, de 0 a 255. */
  luma: number[];
}

function decode(file: Buffer): Decoded {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Buffer[] = [];

  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      colorType = body[9];
    } else if (type === 'IDAT') idat.push(Buffer.from(body));
    offset += 12 + length;
    if (type === 'IEND') break;
  }

  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (channels === 0) throw new Error(`tipus de color ${colorType} inesperat en aquest actiu`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const luma: number[] = [];

  let read = 0;
  const previous = Buffer.alloc(stride);
  const current = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[read++];
    raw.copy(current, 0, read, read + stride);
    read += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? current[x - channels] : 0;
      const b = previous[x];
      const c = x >= channels ? previous[x - channels] : 0;
      let value = current[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      current[x] = value & 0xff;
    }
    // Una mostra de cada setze píxels: n'hi ha de sobres per a estadística i
    // estalvia mig milió d'operacions a cada execució de la bateria.
    for (let x = 0; x < width; x += 16) {
      const i = x * channels;
      const alpha = channels === 4 ? current[i + 3] : 255;
      const grey = current[i] * 0.299 + current[i + 1] * 0.587 + current[i + 2] * 0.114;
      luma.push((grey * alpha) / 255);
    }
    current.copy(previous);
  }

  return { width, height, colorType, luma };
}

describe('la imatge base del mini-mapa', () => {
  const image = decode(readFileSync(ASSET));

  it('no és transparent ni negra', () => {
    const max = Math.max(...image.luma);
    const avg = image.luma.reduce((sum, v) => sum + v, 0) / image.luma.length;
    // El que es va publicar tenia max = 0 i avg = 0.
    expect(max).toBeGreaterThan(40);
    expect(avg).toBeGreaterThan(8);
  });

  it('té contrast: hi ha costa, no un rectangle pla', () => {
    const avg = image.luma.reduce((sum, v) => sum + v, 0) / image.luma.length;
    const variance =
      image.luma.reduce((sum, v) => sum + (v - avg) ** 2, 0) / image.luma.length;
    expect(Math.sqrt(variance)).toBeGreaterThan(10);
  });

  it('no porta canal alfa, que és com l’error d’abans es torna impossible', () => {
    expect(image.colorType).toBe(2);
  });

  it('té la proporció de la caixa geogràfica que hi dibuixa el canvas', () => {
    // Amb `background-size: cover`, una proporció diferent retalla la imatge
    // i desplaça tot el que el canvas hi pinti a sobre.
    expect(image.width / image.height).toBeCloseTo(MINIMAP_ASPECT, 2);
  });
});
