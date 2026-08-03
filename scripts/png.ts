/**
 * PNG mínim: llegir i escriure, amb el `zlib` que ja porta Node.
 *
 * PER QUÈ NO UNA LLIBRERIA. Això només ho fa servir el generador del
 * mini-mapa (`build-minimap.ts`), que corre a mà i molt de tant en tant.
 * Afegir `sharp` —binaris natius per plataforma— o `pngjs` al projecte per
 * cosir dotze tessel·les un cop l'any surt més car que aquestes cent línies,
 * i el paquet que arriba al navegador no n'ha de saber res.
 *
 * QUÈ SUPORTA I QUÈ NO. Llegir: 8 bits per canal, sense entrellaçat, en
 * escala de grisos, paleta, RGB i RGBA (que és el que serveixen els
 * proveïdors de tessel·les rasteritzades). Escriure: NOMÉS RGB sense canal
 * alfa, i això és una decisió, no una mancança — la imatge base del
 * mini-mapa ja va sortir una vegada transparent de dalt a baix i ningú no se
 * n'havia adonat. Sense canal alfa, aquell error és impossible de repetir:
 * el pitjor que en pot sortir és una imatge negra, que es veu de seguida.
 */

import { deflateSync, inflateSync } from 'node:zlib';

export interface RgbImage {
  width: number;
  height: number;
  /** Tres bytes per píxel, per files de dalt a baix. */
  data: Buffer;
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Descodifica un PNG a RGB. El canal alfa, si n'hi ha, es compon sobre negre. */
export function decodePng(file: Buffer): RgbImage {
  if (file.readUInt32BE(0) !== 0x89504e47) throw new Error('això no és un PNG');

  let offset = 8;
  let header: { width: number; height: number; depth: number; color: number; interlace: number } | null =
    null;
  let palette: Buffer | null = null;
  const chunks: Buffer[] = [];

  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        color: body[9],
        interlace: body[12],
      };
    } else if (type === 'PLTE') palette = Buffer.from(body);
    else if (type === 'IDAT') chunks.push(Buffer.from(body));
    offset += 12 + length;
    if (type === 'IEND') break;
  }

  if (header === null) throw new Error('PNG sense IHDR');
  if (header.depth !== 8) throw new Error(`profunditat ${header.depth} no suportada`);
  if (header.interlace !== 0) throw new Error('PNG entrellaçat no suportat');

  const channels = CHANNELS[header.color];
  if (channels === undefined) throw new Error(`tipus de color ${header.color} desconegut`);

  const { width, height } = header;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(chunks));
  const flat = Buffer.alloc(height * stride);

  // Desfà els filtres per fila (PNG 9.2). Cada fila comença amb el seu tipus.
  let read = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[read++];
    const line = raw.subarray(read, read + stride);
    read += stride;
    const row = y * stride;
    const prev = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? flat[row + x - channels] : 0;
      const b = y > 0 ? flat[prev + x] : 0;
      const c = x >= channels && y > 0 ? flat[prev + x - channels] : 0;
      let value = line[x];
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
      flat[row + x] = value & 0xff;
    }
  }

  const data = Buffer.alloc(width * height * 3);
  for (let i = 0, px = 0; px < width * height; px++) {
    const src = px * channels;
    let r: number;
    let g: number;
    let b: number;
    let alpha = 255;
    if (header.color === 3) {
      const entry = flat[src] * 3;
      r = palette![entry];
      g = palette![entry + 1];
      b = palette![entry + 2];
    } else if (header.color === 0 || header.color === 4) {
      r = g = b = flat[src];
      if (header.color === 4) alpha = flat[src + 1];
    } else {
      r = flat[src];
      g = flat[src + 1];
      b = flat[src + 2];
      if (header.color === 6) alpha = flat[src + 3];
    }
    // Composició sobre negre: aquestes tessel·les són opaques, i si mai no ho
    // fossin val més veure-hi un forat fosc que un forat transparent.
    data[i++] = (r * alpha) / 255;
    data[i++] = (g * alpha) / 255;
    data[i++] = (b * alpha) / 255;
  }

  return { width, height, data };
}

function chunk(type: string, body: Buffer): Buffer {
  const out = Buffer.alloc(body.length + 12);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'ascii');
  body.copy(out, 8);
  out.writeInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) | 0;
}

/** Codifica RGB de 8 bits. Filtre 0 a totes les files: simple i prou bo aquí. */
export function encodePng(image: RgbImage): Buffer {
  const { width, height, data } = image;
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB, sense alfa: vegeu la capçalera.
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
