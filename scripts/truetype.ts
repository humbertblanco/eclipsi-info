/**
 * Tipografia sense navegador: llegir un WOFF i pintar-ne les lletres a píxels.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER. Perquè `build-og.ts` ha de cuinar la targeta
 * social —1200×630 amb un titular de 56 px— i aquí no hi ha ni navegador ni
 * canvas. Les tres alternatives que es van considerar i per què no:
 *
 *  · Un navegador sense cap (Playwright, Puppeteer). És justament la manera com
 *    es va coure l'`og.png` original i com es va coure el mini-mapa buit: una
 *    pàgina, una captura a mà, cap manera de saber si el que ha sortit té
 *    píxels. A més arrossega ~300 MB de binaris per a una imatge que es refà
 *    tres cops l'any.
 *  · `sharp` o `canvas` natius. Binaris per plataforma, compilació a la
 *    instal·lació, i el mateix argument que ja hi ha escrit a `png.ts`.
 *  · Text vectoritzat a mà (traçats copiats de l'Illustrator). Congela el text:
 *    canviar una coma vol dir tornar a l'editor.
 *
 * AIXÒ LLEGEIX LES FONTS QUE L'APP JA SERVEIX. Els mateixos `.woff` de
 * `node_modules/@fontsource/*` que `src/styles/index.css` declara als
 * `@font-face`. No és una font «semblant»: és la font. Si algú actualitza
 * fontsource i les lletres canvien, la targeta canvia amb l'app, que és el que
 * ha de passar.
 *
 * PER QUÈ WOFF I NO WOFF2, si el CSS només carrega el segon. Perquè un WOFF és
 * un sfnt amb cada taula passada pel `deflate` —el mateix `zlib` que ja fa
 * servir `png.ts`— i es desembolica en vint línies. El WOFF2 comprimeix amb
 * Brotli (que Node també porta) però a més REESCRIU la taula `glyf` amb una
 * transformació pròpia que s'ha de desfer sencera: centenars de línies per a
 * zero píxels de diferència, perquè fontsource publica els dos formats amb els
 * mateixos contorns. El WOFF hi és, al disc, al costat del WOFF2.
 *
 * QUÈ SAP FER I QUÈ NO:
 *  · `glyf`/`loca` (contorns TrueType quadràtics), simples i COMPOSTOS —els
 *    composts no són un extra: «à», «è», «í», «ó», «ú», «ï», «ü» i «ç» ho són
 *    tots, i sense això el català surt sense accents.
 *  · `cmap` format 4 (el que porten les tres fonts del projecte).
 *  · `hmtx` per als avanços i `GPOS` per a l'interlletratge de parells.
 *  · NO fa CFF (contorns cúbics de PostScript), ni format 12, ni lligadures, ni
 *    escriptura de dreta a esquerra. Les tres fonts del projecte són TrueType
 *    amb `cmap` 4 i el text és llatí; si algú n'hi posa una que no ho sigui,
 *    això peta amb un missatge que ho diu, i ha de petar.
 *
 * L'INTERLLETRATGE NO ÉS UN CAPRICI. Sense `GPOS`, «Quants» surt amb un forat
 * entre la Q i la u que a 56 px es veu de lluny, i la targeta hauria quedat
 * pitjor que la que ja hi havia — que és exactament el que aquesta feina no
 * podia fer. Amb els parells aplicats, el titular de la targeta nova encongeix
 * 11 px respecte del mateix text sense interlletratge.
 *
 * EL DIBUIX. Reixeta d'escombrat amb regla parell-senar no: NON-ZERO, que és
 * la que mana en TrueType (un contorn interior es dibuixa en sentit contrari i
 * amb parell-senar els forats de la «o» i de la «e» surten plens). Quatre
 * sub-línies per fila donen l'antialiàsing vertical i la cobertura horitzontal
 * es calcula exacta, amb fraccions als extrems del tram. És més bo que un 4×4
 * de mostres i costa la meitat.
 */

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/* ── Llegir el contenidor ────────────────────────────────────────────────── */

/** Les taules sfnt d'un fitxer, ja descomprimides, indexades per etiqueta. */
function readTables(file: Buffer): Map<string, Buffer> {
  const tables = new Map<string, Buffer>();
  const magic = file.toString('ascii', 0, 4);

  if (magic === 'wOFF') {
    const count = file.readUInt16BE(12);
    for (let i = 0; i < count; i++) {
      const entry = 44 + i * 20;
      const tag = file.toString('ascii', entry, entry + 4);
      const offset = file.readUInt32BE(entry + 4);
      const compressed = file.readUInt32BE(entry + 8);
      const original = file.readUInt32BE(entry + 12);
      const body = file.subarray(offset, offset + compressed);
      // El WOFF deixa la taula sense comprimir quan el deflate no la guanyava.
      tables.set(tag, compressed < original ? inflateSync(body) : Buffer.from(body));
    }
    return tables;
  }

  if (magic === 'wOF2') {
    throw new Error(
      'WOFF2 no: la taula glyf hi va transformada. Fes servir el .woff del costat, ' +
        'que fontsource publica amb els mateixos contorns.',
    );
  }

  // sfnt pelat (.ttf): 0x00010000 o 'true'.
  const version = file.readUInt32BE(0);
  if (version !== 0x00010000 && magic !== 'true') {
    throw new Error(`això no és cap font que sàpiga llegir (marca «${magic}»)`);
  }
  const count = file.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const entry = 12 + i * 16;
    const tag = file.toString('ascii', entry, entry + 4);
    const offset = file.readUInt32BE(entry + 8);
    const length = file.readUInt32BE(entry + 12);
    tables.set(tag, file.subarray(offset, offset + length));
  }
  return tables;
}

/* ── cmap ────────────────────────────────────────────────────────────────── */

/**
 * Taula de codi de caràcter a identificador de glif, format 4.
 *
 * Es tria la subtaula (3,1) —Windows, BMP en UTF-16— i, si no hi és, la (0,3)
 * d'Unicode. Les tres fonts del projecte porten totes dues i són la mateixa.
 */
function readCmap(cmap: Buffer): Map<number, number> {
  const count = cmap.readUInt16BE(2);
  let chosen = -1;
  for (let i = 0; i < count; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8);
    const encoding = cmap.readUInt16BE(6 + i * 8);
    const offset = cmap.readUInt32BE(8 + i * 8);
    const preferred = platform === 3 && encoding === 1;
    if (preferred || (chosen < 0 && platform === 0)) chosen = offset;
    if (preferred) break;
  }
  if (chosen < 0) throw new Error('cmap sense cap subtaula Unicode que sàpiga llegir');

  const format = cmap.readUInt16BE(chosen);
  if (format !== 4) throw new Error(`cmap format ${format}: només sé llegir el 4`);

  const segments = cmap.readUInt16BE(chosen + 6) / 2;
  const endsAt = chosen + 14;
  const startsAt = endsAt + segments * 2 + 2;
  const deltasAt = startsAt + segments * 2;
  const rangesAt = deltasAt + segments * 2;

  const map = new Map<number, number>();
  for (let s = 0; s < segments; s++) {
    const end = cmap.readUInt16BE(endsAt + s * 2);
    const start = cmap.readUInt16BE(startsAt + s * 2);
    if (start > end) continue;
    const delta = cmap.readInt16BE(deltasAt + s * 2);
    const rangeOffset = cmap.readUInt16BE(rangesAt + s * 2);
    for (let code = start; code <= end && code !== 0xffff; code++) {
      let glyph: number;
      if (rangeOffset === 0) glyph = (code + delta) & 0xffff;
      else {
        const at = rangesAt + s * 2 + rangeOffset + (code - start) * 2;
        if (at + 1 >= cmap.length) continue;
        const raw = cmap.readUInt16BE(at);
        glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
      }
      if (glyph !== 0) map.set(code, glyph);
    }
  }
  return map;
}

/* ── GPOS: interlletratge de parells ─────────────────────────────────────── */

/** Els identificadors de glif que cobreix una taula Coverage, amb el seu índex. */
function readCoverage(gpos: Buffer, at: number): Map<number, number> {
  const cover = new Map<number, number>();
  const format = gpos.readUInt16BE(at);
  if (format === 1) {
    const count = gpos.readUInt16BE(at + 2);
    for (let i = 0; i < count; i++) cover.set(gpos.readUInt16BE(at + 4 + i * 2), i);
  } else if (format === 2) {
    const count = gpos.readUInt16BE(at + 2);
    for (let i = 0; i < count; i++) {
      const entry = at + 4 + i * 6;
      const start = gpos.readUInt16BE(entry);
      const end = gpos.readUInt16BE(entry + 2);
      const first = gpos.readUInt16BE(entry + 4);
      for (let g = start; g <= end; g++) cover.set(g, first + (g - start));
    }
  }
  return cover;
}

/** La classe de cada glif segons una taula ClassDef. Els que no hi surten són 0. */
function readClassDef(gpos: Buffer, at: number): Map<number, number> {
  const classes = new Map<number, number>();
  const format = gpos.readUInt16BE(at);
  if (format === 1) {
    const start = gpos.readUInt16BE(at + 2);
    const count = gpos.readUInt16BE(at + 4);
    for (let i = 0; i < count; i++) classes.set(start + i, gpos.readUInt16BE(at + 6 + i * 2));
  } else if (format === 2) {
    const count = gpos.readUInt16BE(at + 2);
    for (let i = 0; i < count; i++) {
      const entry = at + 4 + i * 6;
      const start = gpos.readUInt16BE(entry);
      const end = gpos.readUInt16BE(entry + 2);
      const value = gpos.readUInt16BE(entry + 4);
      for (let g = start; g <= end; g++) classes.set(g, value);
    }
  }
  return classes;
}

/** Quants bytes ocupa un ValueRecord amb aquest ValueFormat. */
function valueSize(format: number): number {
  let bytes = 0;
  for (let bit = 0; bit < 8; bit++) if (format & (1 << bit)) bytes += 2;
  return bytes;
}

/**
 * Llegeix els parells d'interlletratge de la funció `kern` del GPOS.
 *
 * DEFENSIU A POSTA: qualsevol cosa que no entengui —una extensió, un format
 * nou, un desplaçament fora de rang— es descarta en silenci i el parell surt a
 * zero. Una targeta amb l'interlletratge una mica fluix és un detall; una
 * targeta que no es pot generar perquè el lector de fonts ha petat és una
 * imatge morta, que és el que aquest projecte no torna a tenir.
 */
function readKernPairs(gpos: Buffer | undefined, units: number): Map<number, number> {
  const pairs = new Map<number, number>();
  if (gpos === undefined || gpos.length < 10) return pairs;

  try {
    const featureListAt = gpos.readUInt16BE(6);
    const lookupListAt = gpos.readUInt16BE(8);

    const wanted = new Set<number>();
    const featureCount = gpos.readUInt16BE(featureListAt);
    for (let i = 0; i < featureCount; i++) {
      const record = featureListAt + 2 + i * 6;
      if (gpos.toString('ascii', record, record + 4) !== 'kern') continue;
      const featureAt = featureListAt + gpos.readUInt16BE(record + 4);
      const lookupCount = gpos.readUInt16BE(featureAt + 2);
      for (let k = 0; k < lookupCount; k++) wanted.add(gpos.readUInt16BE(featureAt + 4 + k * 2));
    }

    const lookupCount = gpos.readUInt16BE(lookupListAt);
    for (const index of wanted) {
      if (index >= lookupCount) continue;
      const lookupAt = lookupListAt + gpos.readUInt16BE(lookupListAt + 2 + index * 2);
      if (gpos.readUInt16BE(lookupAt) !== 2) continue; // 2 = PairPos
      const subCount = gpos.readUInt16BE(lookupAt + 4);
      for (let s = 0; s < subCount; s++) {
        const at = lookupAt + gpos.readUInt16BE(lookupAt + 6 + s * 2);
        const format = gpos.readUInt16BE(at);
        const value1 = gpos.readUInt16BE(at + 4);
        const value2 = gpos.readUInt16BE(at + 6);
        // Només interessa l'avanç horitzontal del primer glif del parell.
        const hasAdvance = (value1 & 0x0004) !== 0;
        const size1 = valueSize(value1);
        const size2 = valueSize(value2);
        const coverage = readCoverage(gpos, at + gpos.readUInt16BE(at + 2));

        if (format === 1) {
          const setCount = gpos.readUInt16BE(at + 8);
          const byIndex = new Map<number, number>();
          for (const [glyph, i] of coverage) byIndex.set(i, glyph);
          for (let i = 0; i < setCount; i++) {
            const left = byIndex.get(i);
            if (left === undefined) continue;
            const setAt = at + gpos.readUInt16BE(at + 10 + i * 2);
            const pairCount = gpos.readUInt16BE(setAt);
            for (let p = 0; p < pairCount; p++) {
              const entry = setAt + 2 + p * (2 + size1 + size2);
              const right = gpos.readUInt16BE(entry);
              // L'XAdvance és el bit 2 del ValueFormat: el que hi ha davant seu
              // al ValueRecord són l'XPlacement i l'YPlacement, bits 0 i 1.
              const advance = hasAdvance
                ? gpos.readInt16BE(entry + 2 + valueSize(value1 & 0x0003))
                : 0;
              if (advance !== 0) pairs.set(left * 65536 + right, advance / units);
            }
          }
        } else if (format === 2) {
          const class1At = at + gpos.readUInt16BE(at + 8);
          const class2At = at + gpos.readUInt16BE(at + 10);
          const class1Count = gpos.readUInt16BE(at + 12);
          const class2Count = gpos.readUInt16BE(at + 14);
          const class1 = readClassDef(gpos, class1At);
          const class2 = readClassDef(gpos, class2At);
          const byClass2 = new Map<number, number[]>();
          for (const [glyph, cls] of class2) {
            const list = byClass2.get(cls);
            if (list === undefined) byClass2.set(cls, [glyph]);
            else list.push(glyph);
          }
          for (const [left] of coverage) {
            const c1 = class1.get(left) ?? 0;
            if (c1 >= class1Count) continue;
            for (let c2 = 1; c2 < class2Count; c2++) {
              const entry = at + 16 + (c1 * class2Count + c2) * (size1 + size2);
              const advance = hasAdvance
                ? gpos.readInt16BE(entry + valueSize(value1 & 0x0003))
                : 0;
              if (advance === 0) continue;
              for (const right of byClass2.get(c2) ?? []) {
                pairs.set(left * 65536 + right, advance / units);
              }
            }
          }
        }
      }
    }
  } catch {
    // Vegeu la capçalera d'aquesta funció: sense interlletratge, però amb targeta.
    return pairs;
  }
  return pairs;
}

/* ── Contorns ────────────────────────────────────────────────────────────── */

export interface Point {
  x: number;
  y: number;
}

/** Un contorn tancat, ja aplanat a segments rectes. */
export type Contour = Point[];

interface RawPoint extends Point {
  on: boolean;
}

/** Quants trossos per a una corba quadràtica d'aquesta llargada en píxels. */
function quadSteps(a: Point, b: Point, c: Point): number {
  const span = Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - b.x, c.y - b.y);
  return Math.max(2, Math.min(24, Math.ceil(span / 1.5)));
}

/* ── La font ─────────────────────────────────────────────────────────────── */

export interface Font {
  /** El nom del fitxer, per als missatges d'error i el registre de la consola. */
  readonly file: string;
  /** Alçada de les majúscules, en fracció d'em. */
  readonly capHeight: number;
  /** Alçada de la x, en fracció d'em. */
  readonly xHeight: number;
  /** Té glif propi per a aquest punt de codi? */
  has(codePoint: number): boolean;
  /**
   * Els contorns d'un text, ja col·locats i en píxels de pantalla (y cap
   * avall), amb l'origen a la base de la primera lletra.
   */
  outline(text: string, sizePx: number, originX: number, baselineY: number, trackingEm?: number): Contour[];
  /** L'amplada que ocuparà `outline` amb els mateixos arguments. */
  measure(text: string, sizePx: number, trackingEm?: number): number;
}

class TrueTypeFont implements Font {
  readonly file: string;
  readonly capHeight: number;
  readonly xHeight: number;

  private readonly units: number;
  private readonly glyf: Buffer;
  private readonly loca: number[];
  private readonly cmap: Map<number, number>;
  private readonly advances: number[];
  private readonly kerns: Map<number, number>;
  /** Contorns ja llegits, en unitats de font. La «a» d'un titular hi surt deu cops. */
  private readonly cache = new Map<number, RawPoint[][]>();

  constructor(file: string, tables: Map<string, Buffer>) {
    this.file = file;
    const head = tables.get('head');
    const maxp = tables.get('maxp');
    const hhea = tables.get('hhea');
    const hmtx = tables.get('hmtx');
    const loca = tables.get('loca');
    const glyf = tables.get('glyf');
    const cmap = tables.get('cmap');
    if (
      head === undefined ||
      maxp === undefined ||
      hhea === undefined ||
      hmtx === undefined ||
      loca === undefined ||
      glyf === undefined ||
      cmap === undefined
    ) {
      throw new Error(
        `${file}: falta alguna taula bàsica (head/maxp/hhea/hmtx/loca/glyf/cmap). ` +
          'Si la font porta contorns CFF en comptes de glyf, aquest lector no la sap dibuixar.',
      );
    }

    this.units = head.readUInt16BE(18);
    this.glyf = glyf;
    const os2 = tables.get('OS/2');
    this.capHeight = os2 !== undefined && os2.length >= 90 ? os2.readInt16BE(88) / this.units : 0.7;
    this.xHeight = os2 !== undefined && os2.length >= 88 ? os2.readInt16BE(86) / this.units : 0.5;

    const glyphCount = maxp.readUInt16BE(4);
    const longLoca = head.readInt16BE(50) === 1;
    this.loca = [];
    for (let i = 0; i <= glyphCount; i++) {
      this.loca.push(longLoca ? loca.readUInt32BE(i * 4) : loca.readUInt16BE(i * 2) * 2);
    }

    const metrics = hhea.readUInt16BE(34);
    this.advances = [];
    let last = 0;
    for (let i = 0; i < glyphCount; i++) {
      if (i < metrics) last = hmtx.readUInt16BE(i * 4);
      this.advances.push(last / this.units);
    }

    this.cmap = readCmap(cmap);
    this.kerns = readKernPairs(tables.get('GPOS'), this.units);
  }

  has(codePoint: number): boolean {
    return this.cmap.has(codePoint);
  }

  /** Els punts de cada contorn d'un glif, en unitats de font, y cap amunt. */
  private points(glyph: number, depth = 0): RawPoint[][] {
    const cached = this.cache.get(glyph);
    if (cached !== undefined) return cached;
    // Els composts de veritat tenen un nivell; el límit és contra fitxers cíclics.
    if (depth > 5) return [];

    const start = this.loca[glyph];
    const end = this.loca[glyph + 1];
    if (start === undefined || end === undefined || end <= start) return [];

    const data = this.glyf.subarray(start, end);
    const contourCount = data.readInt16BE(0);
    const out: RawPoint[][] = [];

    if (contourCount >= 0) {
      const ends: number[] = [];
      for (let i = 0; i < contourCount; i++) ends.push(data.readUInt16BE(10 + i * 2));
      const total = contourCount === 0 ? 0 : ends[contourCount - 1] + 1;
      let at = 10 + contourCount * 2;
      at += 2 + data.readUInt16BE(at); // instruccions de hinting: no en fem res

      const flags: number[] = [];
      while (flags.length < total) {
        const flag = data[at++];
        flags.push(flag);
        if (flag & 8) {
          let repeat = data[at++];
          while (repeat-- > 0) flags.push(flag);
        }
      }

      const xs: number[] = [];
      let x = 0;
      for (const flag of flags) {
        if (flag & 2) {
          const delta = data[at++];
          x += flag & 16 ? delta : -delta;
        } else if (!(flag & 16)) {
          x += data.readInt16BE(at);
          at += 2;
        }
        xs.push(x);
      }
      const ys: number[] = [];
      let y = 0;
      for (const flag of flags) {
        if (flag & 4) {
          const delta = data[at++];
          y += flag & 32 ? delta : -delta;
        } else if (!(flag & 32)) {
          y += data.readInt16BE(at);
          at += 2;
        }
        ys.push(y);
      }

      let from = 0;
      for (const endPoint of ends) {
        const contour: RawPoint[] = [];
        for (let i = from; i <= endPoint; i++) {
          contour.push({ x: xs[i], y: ys[i], on: (flags[i] & 1) !== 0 });
        }
        if (contour.length > 1) out.push(contour);
        from = endPoint + 1;
      }
    } else {
      // Compost: «à» és una «a» més un accent, cadascun amb el seu desplaçament.
      let at = 10;
      for (;;) {
        const flags = data.readUInt16BE(at);
        const component = data.readUInt16BE(at + 2);
        at += 4;
        let dx: number;
        let dy: number;
        if (flags & 0x0001) {
          dx = data.readInt16BE(at);
          dy = data.readInt16BE(at + 2);
          at += 4;
        } else {
          dx = data.readInt8(at);
          dy = data.readInt8(at + 1);
          at += 2;
        }
        // Sense ARGS_ARE_XY_VALUES els arguments són números de punt que
        // s'han de fer coincidir. Cap accent de les fonts del projecte ho fa.
        if (!(flags & 0x0002)) {
          dx = 0;
          dy = 0;
        }
        let a = 1;
        let b = 0;
        let c = 0;
        let d = 1;
        const f2 = (offset: number): number => data.readInt16BE(offset) / 16384;
        if (flags & 0x0008) {
          a = d = f2(at);
          at += 2;
        } else if (flags & 0x0040) {
          a = f2(at);
          d = f2(at + 2);
          at += 4;
        } else if (flags & 0x0080) {
          a = f2(at);
          b = f2(at + 2);
          c = f2(at + 4);
          d = f2(at + 6);
          at += 8;
        }
        for (const contour of this.points(component, depth + 1)) {
          out.push(
            contour.map((p) => ({ x: a * p.x + c * p.y + dx, y: b * p.x + d * p.y + dy, on: p.on })),
          );
        }
        if (!(flags & 0x0020)) break;
      }
    }

    this.cache.set(glyph, out);
    return out;
  }

  /** Els identificadors de glif d'un text, amb el desplaçament acumulat en em. */
  private shape(text: string, trackingEm: number): { glyphs: number[]; offsets: number[]; width: number } {
    const glyphs: number[] = [];
    const offsets: number[] = [];
    let pen = 0;
    let previous = -1;
    for (const character of text) {
      const code = character.codePointAt(0)!;
      const glyph = this.cmap.get(code);
      if (glyph === undefined) {
        throw new Error(
          `${this.file}: no té cap glif per a «${character}» (U+${code.toString(16).toUpperCase().padStart(4, '0')}). ` +
            'Comprova que el subconjunt de fontsource sigui el que toca (latin / latin-ext).',
        );
      }
      if (previous >= 0) pen += this.kerns.get(previous * 65536 + glyph) ?? 0;
      glyphs.push(glyph);
      offsets.push(pen);
      pen += this.advances[glyph] + trackingEm;
      previous = glyph;
    }
    // L'interlletratge s'afegeix DESPRÉS de cada lletra, també de l'última:
    // per a l'amplada del bloc, aquell tros final sobra.
    return { glyphs, offsets, width: text.length > 0 ? pen - trackingEm : 0 };
  }

  measure(text: string, sizePx: number, trackingEm = 0): number {
    return this.shape(text, trackingEm).width * sizePx;
  }

  outline(text: string, sizePx: number, originX: number, baselineY: number, trackingEm = 0): Contour[] {
    const { glyphs, offsets } = this.shape(text, trackingEm);
    const scale = sizePx / this.units;
    const out: Contour[] = [];

    for (let i = 0; i < glyphs.length; i++) {
      const penX = originX + offsets[i] * sizePx;
      for (const raw of this.points(glyphs[i])) {
        // A la font l'eix Y va cap amunt; a la imatge, cap avall.
        const pts = raw.map((p) => ({ x: penX + p.x * scale, y: baselineY - p.y * scale, on: p.on }));

        // On comença el recorregut: el primer punt de corba si n'hi ha; si el
        // contorn comença fora de corba, el punt implícit del mig.
        let startIndex = pts.findIndex((p) => p.on);
        let start: Point;
        if (startIndex < 0) {
          start = { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2 };
          startIndex = 0;
        } else {
          start = { x: pts[startIndex].x, y: pts[startIndex].y };
          startIndex += 1;
        }

        const contour: Contour = [start];
        let current = start;
        const total = pts.length;
        for (let k = 0; k < total; k++) {
          const point = pts[(startIndex + k) % total];
          if (point.on) {
            contour.push({ x: point.x, y: point.y });
            current = point;
            continue;
          }
          // Fora de corba: el punt final és el següent si és de corba, i si no,
          // el del mig entre els dos punts de control seguits.
          const next = pts[(startIndex + k + 1) % total];
          const end = next.on
            ? { x: next.x, y: next.y }
            : { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
          const steps = quadSteps(current, point, end);
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const u = 1 - t;
            contour.push({
              x: u * u * current.x + 2 * u * t * point.x + t * t * end.x,
              y: u * u * current.y + 2 * u * t * point.y + t * t * end.y,
            });
          }
          current = end;
          if (next.on) k++;
        }
        if (contour.length > 2) out.push(contour);
      }
    }
    return out;
  }
}

/** Obre un `.woff` (o un `.ttf`) i en deixa la font a punt de dibuixar. */
export function loadFont(path: string): Font {
  return new TrueTypeFont(path.split('/').pop() ?? path, readTables(readFileSync(path)));
}

/* ── El dibuix ───────────────────────────────────────────────────────────── */

/** Un tros de cobertura: on cau dins de la imatge i quant tapa cada píxel (0…1). */
export interface CoverageMask {
  x0: number;
  y0: number;
  width: number;
  height: number;
  /** Una casella per píxel del retall, de 0 (res) a 1 (ple). */
  data: Float32Array;
}

/** Sub-línies per fila. Quatre és on l'ull deixa de veure escala als diagonals. */
const SUBSAMPLES = 4;

/**
 * Omple uns contorns amb la regla non-zero i en torna la cobertura.
 *
 * Es retalla a la imatge i NOMÉS es reserva memòria per a la caixa que ocupen
 * els contorns: una línia de text de 700×60 són 42.000 caselles, no les 756.000
 * de la targeta sencera.
 */
export function fillContours(contours: Contour[], clipWidth: number, clipHeight: number): CoverageMask {
  const empty: CoverageMask = { x0: 0, y0: 0, width: 0, height: 0, data: new Float32Array(0) };
  if (contours.length === 0) return empty;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const contour of contours) {
    for (const p of contour) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const x0 = Math.max(0, Math.floor(minX));
  const y0 = Math.max(0, Math.floor(minY));
  const x1 = Math.min(clipWidth, Math.ceil(maxX) + 1);
  const y1 = Math.min(clipHeight, Math.ceil(maxY) + 1);
  if (x1 <= x0 || y1 <= y0) return empty;

  const width = x1 - x0;
  const height = y1 - y0;
  const data = new Float32Array(width * height);

  // Arestes en coordenades del retall. Les horitzontals no travessen cap
  // sub-línia i només farien dividir per zero.
  const edges: { ax: number; ay: number; bx: number; by: number }[] = [];
  for (const contour of contours) {
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i];
      const b = contour[(i + 1) % contour.length];
      if (a.y === b.y) continue;
      edges.push({ ax: a.x - x0, ay: a.y - y0, bx: b.x - x0, by: b.y - y0 });
    }
  }
  if (edges.length === 0) return empty;

  const share = 1 / SUBSAMPLES;
  const crossings: { x: number; dir: number }[] = [];

  for (let row = 0; row < height; row++) {
    const rowAt = row * width;
    for (let sub = 0; sub < SUBSAMPLES; sub++) {
      const y = row + (sub + 0.5) / SUBSAMPLES;
      crossings.length = 0;
      for (const edge of edges) {
        const top = Math.min(edge.ay, edge.by);
        const bottom = Math.max(edge.ay, edge.by);
        if (y < top || y >= bottom) continue;
        const t = (y - edge.ay) / (edge.by - edge.ay);
        crossings.push({ x: edge.ax + t * (edge.bx - edge.ax), dir: edge.by > edge.ay ? 1 : -1 });
      }
      if (crossings.length < 2) continue;
      crossings.sort((a, b) => a.x - b.x);

      let winding = 0;
      for (let i = 0; i < crossings.length - 1; i++) {
        winding += crossings[i].dir;
        if (winding === 0) continue;
        const from = Math.max(0, crossings[i].x);
        const to = Math.min(width, crossings[i + 1].x);
        if (to <= from) continue;

        const firstPixel = Math.floor(from);
        const lastPixel = Math.min(width - 1, Math.floor(to - 1e-9));
        if (firstPixel === lastPixel) {
          data[rowAt + firstPixel] += (to - from) * share;
          continue;
        }
        data[rowAt + firstPixel] += (firstPixel + 1 - from) * share;
        for (let px = firstPixel + 1; px < lastPixel; px++) data[rowAt + px] += share;
        data[rowAt + lastPixel] += (to - lastPixel) * share;
      }
    }
  }

  // Els contorns que es toquen poden sumar per sobre d'1 en un píxel de vora.
  for (let i = 0; i < data.length; i++) if (data[i] > 1) data[i] = 1;

  return { x0, y0, width, height, data };
}
