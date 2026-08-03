/**
 * Cap actiu binari que es publica pot ser buit, pla ni mentider.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER. Perquè ja va passar. La imatge base del
 * mini-mapa es va coure una vegada a mà en un navegador que encara no havia
 * rebut cap tessel·la, es va comitejar amb els 1296×1008 píxels a (0,0,0,0)
 * —transparent i negra alhora— i va arribar al lloc publicat. Ningú no ho va
 * veure: un actiu binari no es revisa llegint el diff, i el `filter:
 * brightness(1.9)` del CSS no podia il·luminar el no-res. `minimap-asset.test.ts`
 * vigila AQUELLA imatge des d'aleshores. Aquesta prova vigila TOTES LES ALTRES,
 * que és la part que faltava: la lliçó no era «el mini-mapa pot sortir buit»,
 * era «no hi havia res que mirés un sol píxel de res».
 *
 * EL QUE HI HA MÉS EN JOC ÉS `brand/og.png`. És la targeta social de 1200×630:
 * el que veu qui rep l'enllaç per WhatsApp, per Telegram o per X abans de
 * decidir si el toca. Si surt buida no es trenca cap funció —no se n'assabenta
 * ni la consola del navegador— i el producte queda en blanc a la cara pública.
 * És exactament la mateixa forma d'error que el mini-mapa, amb més audiència.
 *
 * QUÈ VIGILA, i per què aquests quatre talls i no uns altres:
 *
 *  · QUE NO SIGUI BUIDA. L'error que va passar. Un màxim de zero és una imatge
 *    negra; una mitjana de zero, una de transparent.
 *  · QUE NO SIGUI PLANA. Un rectangle d'un sol color passaria el tall anterior
 *    sense ser res. Es demana desviació típica, que és el que distingeix «hi ha
 *    corona, costa i lletres» de «hi ha un rectangle».
 *  · QUE NO TINGUI FORATS. Cap píxel amb alfa < 255. Aquest és el tall que
 *    hauria aturat l'error d'origen el mateix dia que es va cometre, i el que
 *    `scripts/png.ts` ja fa impossible per al mini-mapa escrivint RGB sense
 *    canal alfa. La resta d'actius sí que porten canal alfa, i per tant el
 *    necessiten comprovat.
 *  · QUE NO MENTEIXI. Les mides que declaren el manifest i les etiquetes Open
 *    Graph s'han de correspondre amb la capçalera IHDR de debò, i el color de
 *    les cantonades amb el `background_color` del manifest. Una icona que diu
 *    512 i en fa 128 no peta enlloc: només es veu borrosa a la pantalla d'inici
 *    de qui se l'ha instal·lada.
 *
 * I, sobretot, QUE L'INVENTARI SIGUI TANCAT. La darrera prova d'aquest fitxer
 * recorre `public/` i exigeix que tot PNG i tot SVG que s'hi publiqui estigui
 * declarat aquí. Sense això, aquesta prova només vigilaria els actius d'avui i
 * el pròxim entraria sense mirar-se-li cap píxel — que és, literalment, com va
 * començar tot.
 *
 * ELS LLINDARS SURTEN D'AQUESTES MESURES, no de cap intuïció. Lluminositat
 * sobre negre, tots els píxels, el 3 d'agost de 2026:
 *
 *     actiu                        mides      màx     mitj    desv
 *     brand/minimapa-iberia.png    725×564    129,0   44,67   27,79
 *     brand/og.png                1200×630    240,1   25,77   48,91
 *     icons/apple-touch-icon.png   180×180    244,5   17,57   26,59
 *     icons/icon-192.png           192×192    245,4   17,60   26,62
 *     icons/icon-512.png           512×512    247,2   17,59   27,20
 *     icons/icon-maskable-512.png  512×512    246,8   10,81   17,96
 *
 * El terra de tot plegat és 6,27: la lluminositat del fons del sistema
 * (#05060B). Una pàgina pintada llisa d'aquest color fa mitjana 6,27 i
 * desviació 0, i és justament el que ha de suspendre. D'aquí els tres talls:
 * màxim > 40 (el més fosc de debò en fa 129), mitjana > 8 (queda entre el fons
 * llis i els 10,81 de l'actiu més sobri, la icona maskable) i desviació > 10
 * (el més pla de debò en fa 17,96). Són els mateixos números que
 * `minimap-asset.test.ts`, i això és volgut: dues proves que diuen el mateix
 * l'han de dir igual.
 *
 * L'app és nocturna i per això les mitjanes són baixes de mena. Pujar el tall
 * de la mitjana «perquè 8 sembla poc» faria suspendre icones correctes; el que
 * fa la feina de veritat contra una imatge morta és el màxim i la desviació.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const PUBLIC = join(ROOT, 'public');

/* ── L'inventari ─────────────────────────────────────────────────────────── */

interface RasterAsset {
  /** Ruta dins de `public/`, amb barres, tal com s'escriu a les URL. */
  path: string;
  /** Qui la demana i què passa si surt buida. */
  role: string;
  width: number;
  height: number;
  /**
   * Si el marc arriba pintat fins a les cantonades amb el fons del sistema.
   * Les icones sí: una cantonada transparent surt amb un halo blanc a Android
   * i amb un quadrat negre a iOS. El mini-mapa no: és un retall de mapa i a les
   * cantonades hi ha mar i terra.
   */
  fullBleed: boolean;
}

const RASTER: RasterAsset[] = [
  {
    path: 'brand/og.png',
    role: 'targeta social (og:image i twitter:image) — la cara pública de l’enllaç',
    width: 1200,
    height: 630,
    fullBleed: true,
  },
  {
    path: 'brand/minimapa-iberia.png',
    role: 'imatge base del mini-mapa de la portada — la fa scripts/build-minimap.ts',
    width: 725,
    height: 564,
    fullBleed: false,
  },
  {
    path: 'icons/icon-192.png',
    role: 'icona del manifest, mida petita',
    width: 192,
    height: 192,
    fullBleed: true,
  },
  {
    path: 'icons/icon-512.png',
    role: 'icona del manifest, mida gran',
    width: 512,
    height: 512,
    fullBleed: true,
  },
  {
    path: 'icons/icon-maskable-512.png',
    role: 'icona maskable d’Android — Android hi retalla la forma que vulgui',
    width: 512,
    height: 512,
    fullBleed: true,
  },
  {
    path: 'icons/apple-touch-icon.png',
    role: 'pantalla d’inici d’iOS, que ignora el manifest i només llegeix això',
    width: 180,
    height: 180,
    fullBleed: true,
  },
];

/**
 * Els SVG. No tenen píxels, i per això la comprovació és una altra: que hi
 * hagi geometria PINTADA fora de `<defs>`. Un SVG amb formes només dins de
 * `<defs>` és un document que no dibuixa res, i pesa i es veu igual de bé al
 * diff que un que sí.
 */
const VECTOR: { path: string; role: string }[] = [
  { path: 'favicon.svg', role: 'icona de la pestanya' },
  { path: 'icons/icon.svg', role: 'icona vectorial del manifest' },
  { path: 'brand/logo.svg', role: 'logotip de la capçalera de l’app' },
  { path: 'brand/logo-mark.svg', role: 'marca sola — kit de premsa' },
  { path: 'brand/logo-mark-mono.svg', role: 'marca monocroma — kit de premsa' },
  { path: 'brand/logo-daylight.svg', role: 'logotip sobre fons clar — kit de premsa' },
];

/* ── Els talls ───────────────────────────────────────────────────────────── */

/** Per sobre d'això hi ha llum de debò. El més fosc dels actius fa 129. */
const MIN_MAX_LUMA = 40;
/** El fons llis del sistema fa 6,27; l'actiu més sobri, 10,81. */
const MIN_AVG_LUMA = 8;
/** El més pla dels actius de debò fa 17,96. */
const MIN_STDDEV = 10;

/* ── Descodificació ──────────────────────────────────────────────────────── */

interface Measured {
  width: number;
  height: number;
  colorType: number;
  /** Lluminositat de 0 a 255, amb l'alfa composta sobre negre. */
  max: number;
  avg: number;
  stddev: number;
  minAlpha: number;
  /** Les quatre cantonades, en ordre: dalt-esquerra, dalt-dreta, baix-esq, baix-dreta. */
  corners: [number, number, number][];
}

/**
 * Descodifica el PNG i en mesura l'estadística en una sola passada.
 *
 * NO ES GUARDA CAP LLISTA DE PÍXELS, i és a posta: `Math.max(...luma)` sobre
 * els 756.000 píxels de la targeta social peta amb «Maximum call stack size
 * exceeded», que és un error que no parla de res i que amaga el que la prova
 * volia dir. Amb sumes acumulades el cost no depèn de la mida.
 *
 * Només s'admeten RGB i RGBA de 8 bits sense entrellaçar, que és el que són
 * tots sis actius d'avui. Si algú n'hi posa un amb paleta, això peta amb un
 * missatge clar — i ha de petar: val més revisar un actiu nou que descodificar-lo
 * a mitges i donar-lo per bo.
 */
function measurePng(file: Buffer): Measured {
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

  if (depth !== 8) throw new Error(`profunditat ${depth}: aquesta prova només llegeix 8 bits`);
  if (interlace !== 0) throw new Error('PNG entrellaçat: aquesta prova no el sap llegir');
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (channels === 0) throw new Error(`tipus de color ${colorType} inesperat en aquest actiu`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const previous = Buffer.alloc(stride);
  const current = Buffer.alloc(stride);

  let read = 0;
  let max = 0;
  let sum = 0;
  let sumSquares = 0;
  let minAlpha = 255;
  const corners: [number, number, number][] = [];

  for (let y = 0; y < height; y++) {
    const filter = raw[read++];
    raw.copy(current, 0, read, read + stride);
    read += stride;

    // Desfà els filtres per fila (PNG 9.2).
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
      const i = x * channels;
      const alpha = channels === 4 ? current[i + 3] : 255;
      if (alpha < minAlpha) minAlpha = alpha;
      const grey = current[i] * 0.299 + current[i + 1] * 0.587 + current[i + 2] * 0.114;
      const luma = (grey * alpha) / 255;
      if (luma > max) max = luma;
      sum += luma;
      sumSquares += luma * luma;
      if ((y === 0 || y === height - 1) && (x === 0 || x === width - 1)) {
        corners.push([current[i], current[i + 1], current[i + 2]]);
      }
    }

    current.copy(previous);
  }

  const pixels = width * height;
  const avg = sum / pixels;
  // El màxim amb zero és per a la imatge llisa: allà la variància surt d'una
  // resta de dos números iguals i pot caure a -1e-12, i l'arrel en faria NaN.
  const stddev = Math.sqrt(Math.max(0, sumSquares / pixels - avg * avg));

  return { width, height, colorType, max, avg, stddev, minAlpha, corners };
}

/* ── El que el projecte PROMET sobre aquests actius ──────────────────────── */

const manifest = JSON.parse(readFileSync(join(PUBLIC, 'manifest.webmanifest'), 'utf8')) as {
  background_color: string;
  icons: { src: string; sizes: string; type: string }[];
};

const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');

/**
 * Llegeix el `content` d'una metaetiqueta.
 *
 * Es fa a mà i tolerant amb l'ordre dels atributs perquè l'`index.html` té les
 * etiquetes escrites en diverses línies i qualsevol reformatatge n'hauria de
 * poder canviar l'ordre sense trencar aquesta prova.
 */
function metaContent(key: string): string | undefined {
  for (const tag of indexHtml.match(/<meta\b[^>]*>/g) ?? []) {
    if (/\b(?:property|name)="([^"]*)"/.exec(tag)?.[1] === key) {
      return /\bcontent="([^"]*)"/.exec(tag)?.[1];
    }
  }
  return undefined;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (m === null) throw new Error(`color «${hex}» que no sé llegir`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/* ── Les proves ──────────────────────────────────────────────────────────── */

describe('els actius ràster que es publiquen', () => {
  for (const asset of RASTER) {
    describe(`${asset.path} — ${asset.role}`, () => {
      const image = measurePng(readFileSync(join(PUBLIC, asset.path)));

      it('no és buida: hi ha llum de debò, no un rectangle negre', () => {
        // El que es va publicar del mini-mapa tenia màxim 0 i mitjana 0.
        expect(image.max).toBeGreaterThan(MIN_MAX_LUMA);
        expect(image.avg).toBeGreaterThan(MIN_AVG_LUMA);
      });

      it('no és plana: hi ha dibuix, no un color sol', () => {
        expect(image.stddev).toBeGreaterThan(MIN_STDDEV);
      });

      it('no té forats transparents', () => {
        // AQUEST és el tall que hauria aturat l'error d'origen el mateix dia.
        expect(image.minAlpha).toBe(255);
      });

      it('fa les mides que promet', () => {
        expect([image.width, image.height]).toEqual([asset.width, asset.height]);
      });

      if (asset.fullBleed) {
        it('arriba pintada fins a les cantonades, amb el fons del sistema', () => {
          // Una cantonada transparent surt amb halo blanc a Android; una de
          // pintada d'un altre color, amb una vora que no és de ningú.
          const background = hexToRgb(manifest.background_color);
          expect(image.corners).toHaveLength(4);
          for (const corner of image.corners) expect(corner).toEqual(background);
        });
      }
    });
  }
});

describe('el que el projecte promet d’aquests actius', () => {
  it('el manifest declara les mides que les icones fan de debò', () => {
    const pngIcons = manifest.icons.filter((icon) => icon.type === 'image/png');
    // Si el manifest es queda sense icones PNG, això no és un manifest que
    // passi la prova: és una PWA sense icona a la pantalla d'inici.
    expect(pngIcons.length).toBeGreaterThanOrEqual(3);

    for (const icon of pngIcons) {
      const path = icon.src.replace(/^\.\//, '');
      const { width, height } = measurePng(readFileSync(join(PUBLIC, path)));
      expect(`${width}x${height}`, `${path} es declara com a ${icon.sizes}`).toBe(icon.sizes);
    }
  });

  it('les etiquetes Open Graph declaren la mida que la targeta fa de debò', () => {
    // WhatsApp i X reserven la caixa amb aquests dos números abans de baixar
    // la imatge: si menteixen, la targeta surt deformada o retallada.
    const card = measurePng(readFileSync(join(PUBLIC, 'brand', 'og.png')));
    expect(metaContent('og:image:width')).toBe(String(card.width));
    expect(metaContent('og:image:height')).toBe(String(card.height));
    expect(metaContent('og:image')).toMatch(/brand\/og\.png$/);
    expect(metaContent('twitter:image')).toMatch(/brand\/og\.png$/);
  });
});

describe('els SVG que es publiquen', () => {
  for (const asset of VECTOR) {
    describe(`${asset.path} — ${asset.role}`, () => {
      const source = readFileSync(join(PUBLIC, asset.path), 'utf8');
      // Fora `<defs>`: el que hi ha a dins són màscares i degradats, que no
      // dibuixen res per si sols. Tots els logotips de la marca són un cercle
      // emmascarat, i sense treure els `<defs>` la prova comptaria la màscara
      // com si fos el dibuix.
      const painted = source.replace(/<defs\b[\s\S]*?<\/defs>/g, '');

      it('té una caixa de dibuix amb superfície', () => {
        const box = /viewBox="([^"]*)"/.exec(source)?.[1];
        expect(box, 'un SVG sense viewBox no escala enlloc').toBeDefined();
        const [, , w, h] = box!.trim().split(/[\s,]+/).map(Number);
        expect(w).toBeGreaterThan(0);
        expect(h).toBeGreaterThan(0);
      });

      it('té geometria pintada, no un document buit', () => {
        const shapes = painted.match(
          /<(?:path|circle|rect|ellipse|polygon|polyline|line|text|image)\b[^>]*>/g,
        );
        expect(shapes, 'cap forma fora de <defs>').not.toBeNull();
        const inked = shapes!.filter((shape) => {
          const fill = /\bfill="([^"]*)"/.exec(shape)?.[1] ?? '';
          const stroke = /\bstroke="([^"]*)"/.exec(shape)?.[1] ?? '';
          // Sense atribut, l'SVG omple de negre per defecte: també és pintar.
          return (fill !== 'none' && fill !== '') || (stroke !== 'none' && stroke !== '');
        });
        expect(inked.length).toBeGreaterThan(0);
      });
    });
  }
});

describe('l’inventari', () => {
  /**
   * Aquesta és la prova que converteix les altres en vigilància.
   *
   * Sense ella, aquest fitxer només diria que els dotze actius de today estan
   * bé, i el tretzè entraria demà sense que ningú li mirés cap píxel — que és
   * exactament com va començar tot. Si suspèn, la resposta NO és treure
   * l'actiu de `public/`: és afegir-lo a `RASTER` o a `VECTOR` de més amunt.
   */
  it('no hi ha cap imatge a public/ que aquesta prova no miri', () => {
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(entry.name)) {
          found.push(relative(PUBLIC, full).split(sep).join('/'));
        }
      }
    };
    walk(PUBLIC);

    const watched = [...RASTER.map((a) => a.path), ...VECTOR.map((a) => a.path)];
    expect(found.sort()).toEqual(watched.sort());
  });
});
