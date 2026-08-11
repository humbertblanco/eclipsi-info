/**
 * Llegir els píxels de debò d'un PNG i d'un ICO.
 *
 * PER QUÈ NO ES REAPROFITA `measurePng()` D'`actius-binaris.test.ts`. Aquella
 * funció fa una sola passada i NO desa mai la llista de píxels, i és a posta:
 * la targeta social té 756.000 píxels i qualsevol cosa que els materialitzi
 * hi rebenta. Respon «quina llum hi ha», que és el que allà es pregunta.
 *
 * Aquí la pregunta és una altra —«quin color té cada píxel»— i les imatges són
 * icones de 48 i 96 píxels de costat, on materialitzar-les no costa res. Dues
 * preguntes diferents, dues eines; el que seria un error és fer servir l'una
 * per l'altra i acabar amb un `Maximum call stack size exceeded` que no parla
 * de res.
 *
 * L'ICO és la capacitat que no existia enlloc del projecte. `favicon.ico` era,
 * literalment, una cadena de text dins d'una llista: mai no s'havia obert.
 */
import { inflateSync } from 'node:zlib';

export interface Bitmap {
  width: number;
  height: number;
  /** RGBA, quatre bytes per píxel, de dalt a baix i d'esquerra a dreta. */
  pixels: Uint8Array;
}

/** Una entrada del directori d'un contenidor ICO. */
export interface IcoEntry {
  width: number;
  height: number;
  bitsPerPixel: number;
}

/**
 * Descodifica un PNG de 8 bits sense entrellaçar a RGBA.
 *
 * Els altres formats peten amb un missatge clar en comptes de descodificar-se
 * a mitges: val més revisar una icona nova que donar-la per bona.
 */
export function pixelsPng(file: Buffer): Bitmap {
  if (file.readUInt32BE(0) !== 0x89504e47) throw new Error('això no és un PNG');

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let depth = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === 'IDAT') idat.push(Buffer.from(body));
    offset += 12 + length;
    if (type === 'IEND') break;
  }

  if (depth !== 8) throw new Error(`profunditat ${depth}: aquest lector només llegeix 8 bits`);
  if (interlace !== 0) throw new Error('PNG entrellaçat: aquest lector no el sap llegir');
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (channels === 0) throw new Error(`tipus de color ${colorType} inesperat`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const previous = Buffer.alloc(stride);
  const current = Buffer.alloc(stride);
  const pixels = new Uint8Array(width * height * 4);

  let read = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[read++];
    raw.copy(current, 0, read, read + stride);
    read += stride;

    // Desfà els filtres per fila (PNG 9.2). Sense això els bytes són
    // diferències respecte del veí, no colors — i qualsevol mesura que se'n
    // faci és soroll que sembla una dada.
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

    for (let x = 0; x < width; x++) {
      const from = x * channels;
      const to = (y * width + x) * 4;
      pixels[to] = current[from];
      pixels[to + 1] = current[from + 1];
      pixels[to + 2] = current[from + 2];
      pixels[to + 3] = channels === 4 ? current[from + 3] : 255;
    }

    current.copy(previous);
  }

  return { width, height, pixels };
}

/**
 * Obre un contenidor ICO i en descodifica la primera imatge.
 *
 * TRES TRAMPES DEL FORMAT, que són el motiu que això no siguin quatre línies:
 *
 *  · L'alçada del DIB de dins ve DOBLADA. El format reserva la meitat de baix
 *    per a una màscara AND d'un sol bit que ja no fa servir ningú des que hi
 *    ha canal alfa; qui no ho sap descodifica mitja icona i mitja brossa.
 *  · Les files van de baix a dalt. Un ICO llegit en l'ordre natural surt del
 *    revés, i una mitja lluna del revés continua semblant una mitja lluna:
 *    l'error passaria desapercebut a ull.
 *  · Els bytes són BGRA, no RGBA. Llegir-los en l'ordre equivocat dona una
 *    imatge amb els colors intercanviats que segueix tenint la forma bona.
 *
 * Les dues últimes són perilloses precisament perquè NO trenquen res de
 * manera visible; per això es descodifica de debò en comptes de comparar
 * mides i confiar.
 */
export function pixelsIco(file: Buffer): { entries: IcoEntry[]; image: Bitmap } {
  if (file.readUInt16LE(0) !== 0 || file.readUInt16LE(2) !== 1) {
    throw new Error('això no és un contenidor ICO');
  }

  const count = file.readUInt16LE(4);
  const entries: IcoEntry[] = [];
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 16;
    entries.push({
      // Un 0 al directori vol dir 256: el camp és d'un sol byte.
      width: file[at] || 256,
      height: file[at + 1] || 256,
      bitsPerPixel: file.readUInt16LE(at + 6),
    });
  }
  if (count === 0) throw new Error('contenidor ICO sense cap imatge');

  const size = file.readUInt32LE(6 + 8);
  const offset = file.readUInt32LE(6 + 12);
  const dib = file.subarray(offset, offset + size);

  if (dib.readUInt32BE(0) === 0x89504e47) {
    // Un ICO pot portar un PNG sencer a dins, i llavors mana el PNG.
    return { entries, image: pixelsPng(Buffer.from(dib)) };
  }

  const headerSize = dib.readUInt32LE(0);
  const width = dib.readInt32LE(4);
  const height = dib.readInt32LE(8) / 2;
  const bpp = dib.readUInt16LE(14);
  if (bpp !== 32) throw new Error(`ICO de ${bpp} bits: aquest lector només llegeix 32`);

  const pixels = new Uint8Array(width * height * 4);
  let read = headerSize;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const blue = dib[read++];
      const green = dib[read++];
      const red = dib[read++];
      const alpha = dib[read++];
      const to = (y * width + x) * 4;
      pixels[to] = red;
      pixels[to + 1] = green;
      pixels[to + 2] = blue;
      pixels[to + 3] = alpha;
    }
  }

  return { entries, image: { width, height, pixels } };
}
