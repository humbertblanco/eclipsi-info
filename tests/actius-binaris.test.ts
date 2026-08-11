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
 *  · QUE NO TINGUI FORATS. Aquest és el tall que hauria aturat l'error d'origen
 *    el mateix dia que es va cometre, i ara es demana de dues maneres segons
 *    com estigui feta cada imatge:
 *
 *      — Les que cou `scripts/png.ts` (el mini-mapa i, des d'avui, la targeta
 *        social) NO PORTEN CANAL ALFA. La prova ja no els compta els píxels
 *        translúcids: n'exigeix el tipus de color 2, que vol dir que aquell
 *        canal no existeix. És una comprovació més forta que la d'abans i és
 *        la que de debò tanca la porta —un PNG sense alfa no pot sortir
 *        transparent ni que algú s'hi esforci—, i a més fa de rodet: si algú
 *        torna a coure un d'aquests actius a mà en un navegador, en sortirà
 *        RGBA i la prova ho dirà encara que la imatge es vegi perfecta.
 *      — Les icones sí que porten alfa (Android i iOS l'esperen), i per a
 *        aquestes es manté el tall de sempre: cap píxel amb alfa < 255.
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
 *     brand/og.png                1200×630    240,1   21,70   47,22
 *     app-icons/apple-touch-icon.png   180×180    244,5   17,57   26,59
 *     app-icons/icon-192.png           192×192    245,4   17,60   26,62
 *     app-icons/icon-512.png           512×512    247,2   17,59   27,20
 *     app-icons/icon-maskable-512.png  512×512    246,8   10,81   17,96
 *
 * La targeta social feia 25,77 de mitjana quan estava cuita a mà; ara la fa
 * `scripts/build-og.ts` i en fa 21,70, perquè la corona nova concentra la llum
 * al limbe en comptes d'escampar una boira per tota la meitat dreta. La xifra
 * s'ha actualitzat i el llindar no: el que vigila la mitjana és que no caigui
 * cap a 6,27, no que es quedi on era.
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
  /**
   * Com ha d'estar feta la transparència d'aquest actiu.
   *
   *  · `cap`  — sense canal alfa (tipus de color 2). És el que escriu
   *             `scripts/png.ts`, i el que fa impossible per construcció
   *             l'error d'origen. Els actius que tenen generador van aquí.
   *  · `opac` — amb canal alfa, però tots els píxels a 255. És el cas de les
   *             icones, que el porten perquè els sistemes operatius l'esperen.
   */
  alpha: 'cap' | 'opac' | 'lliure';
}

const RASTER: RasterAsset[] = [
  {
    path: 'favicon-48.png',
    role: 'favicon rasteritzat per a Google Search',
    width: 48,
    height: 48,
    fullBleed: false,
    alpha: 'lliure',
  },
  {
    path: 'brand/favicon-google-96.png',
    role: 'favicon canònic de Google Search amb URL pròpia',
    width: 96,
    height: 96,
    fullBleed: false,
    alpha: 'lliure',
  },
  {
    path: 'press/simulacio-eclipsi.png',
    role: 'imatge editorial de la simulació al mòbil',
    width: 1122,
    height: 1402,
    fullBleed: false,
    alpha: 'cap',
  },
  {
    path: 'press/vista-escriptori.png',
    role: 'imatge editorial de la vista d’escriptori',
    width: 1448,
    height: 1086,
    fullBleed: false,
    alpha: 'cap',
  },
  {
    path: 'brand/og.png',
    role: 'targeta social catalana de compatibilitat — la fa scripts/build-og.ts',
    width: 1200,
    height: 630,
    fullBleed: true,
    alpha: 'cap',
  },
  ...(['ca', 'es', 'en', 'fr'] as const).map((locale) => ({
    path: `brand/og-${locale}.png`,
    role: `targeta social en idioma ${locale} — la fa scripts/build-og.ts`,
    width: 1200,
    height: 630,
    fullBleed: true,
    alpha: 'cap' as const,
  })),
  {
    path: 'brand/minimapa-iberia.png',
    role: 'imatge base del mini-mapa de la portada — la fa scripts/build-minimap.ts',
    width: 725,
    height: 564,
    fullBleed: false,
    alpha: 'cap',
  },
  {
    path: 'app-icons/icon-192.png',
    role: 'icona del manifest, mida petita',
    width: 192,
    height: 192,
    fullBleed: true,
    alpha: 'opac',
  },
  {
    path: 'app-icons/icon-512.png',
    role: 'icona del manifest, mida gran',
    width: 512,
    height: 512,
    fullBleed: true,
    alpha: 'opac',
  },
  {
    path: 'app-icons/icon-maskable-512.png',
    role: 'icona maskable d’Android — Android hi retalla la forma que vulgui',
    width: 512,
    height: 512,
    fullBleed: true,
    alpha: 'opac',
  },
  {
    path: 'app-icons/apple-touch-icon.png',
    role: 'pantalla d’inici d’iOS, que ignora el manifest i només llegeix això',
    width: 180,
    height: 180,
    fullBleed: true,
    alpha: 'opac',
  },
  /*
   * ELS LOGOTIPS DELS MITJANS. Són silueta amb alfa i els pinta
   * `.about__mentionlogo` amb `grayscale(1) brightness(0) invert(1)`: el filtre
   * els torna blancs sobre el fons fosc sigui quin sigui el color d'origen. Per
   * això `alpha: 'lliure'` —la transparència de fora de la lletra és la marca,
   * no cap forat— i per això els talls de lluminositat es mesuren igualment:
   * el filtre pot emblanquinar una silueta, però no pot inventar-ne una que no
   * hi sigui. Un logotip buit sortiria com un rectangle invisible dins d'una
   * targeta amb vora, exactament com el mini-mapa.
   *
   * Mesurat el 8 d'agost de 2026, lluminositat sobre negre abans del filtre:
   *   timeout.png          900×465   max 255,0  mitj 54,72  desv 97,91
   *   diari-barcelona.png 1200×703   max 255,0  mitj 26,93  desv 77,42
   *   diari-catalunya.png 1200×184   max 255,0  mitj 41,43  desv 89,88
   *
   * I l'11 d'agost, amb la tanda nova:
   *   vilapress.png        470×106   max 230,2  mitj 70,60  desv 85,73
   *
   * AQUEST ÚLTIM NO ARRIBA TAL COM EL PUBLICA EL MITJÀ, i és l'única raó per la
   * qual la seva mitjana és la més alta de totes: Vilapress publica el logotip
   * sobre paper blanc, i un paper blanc que el filtre emblanquina és un
   * RECTANGLE blanc dins d'una targeta. El paper s'ha passat a alfa 0 i s'ha
   * retallat a la caixa de la tinta. El perquè, amb els números del llindar,
   * és a la capçalera de `src/features/about/mentions.ts`.
   */
  {
    path: 'press/media-logos/timeout.png',
    role: 'logotip de Time Out Barcelona a la cobertura editorial',
    width: 900,
    height: 465,
    fullBleed: false,
    alpha: 'lliure',
  },
  {
    path: 'press/media-logos/diari-barcelona.png',
    role: 'logotip del Diari de Barcelona a la cobertura editorial',
    width: 1200,
    height: 703,
    fullBleed: false,
    alpha: 'lliure',
  },
  {
    path: 'press/media-logos/diari-catalunya.png',
    role: 'logotip del Diari de Catalunya a la cobertura editorial',
    width: 1200,
    height: 184,
    fullBleed: false,
    alpha: 'lliure',
  },
  {
    path: 'press/media-logos/vilapress.png',
    role: 'logotip de Vilapress, amb el paper passat a alfa',
    width: 470,
    height: 106,
    fullBleed: false,
    alpha: 'lliure',
  },
];

/** Contenidor ICO de compatibilitat; replica el favicon de 48 px ja auditat. */
const COMPATIBILITY_IMAGES = ['favicon.ico'] as const;

/**
 * Els SVG. No tenen píxels, i per això la comprovació és una altra: que hi
 * hagi geometria PINTADA fora de `<defs>`. Un SVG amb formes només dins de
 * `<defs>` és un document que no dibuixa res, i pesa i es veu igual de bé al
 * diff que un que sí.
 */
const VECTOR: { path: string; role: string }[] = [
  { path: 'favicon.svg', role: 'icona de la pestanya' },
  { path: 'app-icons/icon.svg', role: 'icona vectorial del manifest' },
  { path: 'brand/logo.svg', role: 'logotip de la capçalera de l’app' },
  { path: 'brand/logo-mark.svg', role: 'marca sola — kit de premsa' },
  { path: 'brand/logo-mark-mono.svg', role: 'marca monocroma — kit de premsa' },
  { path: 'brand/logo-daylight.svg', role: 'logotip sobre fons clar — kit de premsa' },
  { path: 'brand/favicon.svg', role: 'favicon de marca — kit de premsa' },
  /*
   * Els logotips dels mitjans que ens han citat. No són nostres: arriben tal com
   * els publica cadascú i per això la majoria pinten amb `fill="currentColor"`
   * heretat d'un `<g>` o de l'arrel, i no amb un color escrit a cada forma.
   * Vegeu `formesPintades()`: aquesta prova ho ha de saber llegir, perquè la
   * pregunta és si el fitxer dibuixa res, no com ho declara.
   */
  { path: 'press/media-logos/vilaweb.svg', role: 'logotip de VilaWeb a la cobertura editorial' },
  { path: 'press/media-logos/diari-tarragona.svg', role: 'logotip del Diari de Tarragona' },
  { path: 'press/media-logos/metadata.svg', role: 'logotip de MetaData' },
  { path: 'press/media-logos/dbalears.svg', role: 'logotip de dBalears' },
  { path: 'press/media-logos/el3devuit.svg', role: 'logotip d’el 3 de vuit' },
  { path: 'press/media-logos/elperiodico.svg', role: 'logotip d’El Periódico' },
  { path: 'press/media-logos/cadena-ser.svg', role: 'logotip de la Cadena SER' },
  { path: 'press/media-logos/ouest-france.svg', role: 'logotip d’Ouest-France' },
  /*
   * El de RAC1 és el mateix SVG que la ràdio incrusta al seu full d'estil, MENYS
   * el `<path d="M0,0h500v500H0"/>` que li fa de quadrat negre de fons. Amb el
   * quadrat, el filtre de `.about__mentionlogo` no donava el logotip: donava un
   * quadrat blanc. Aquesta prova mira que hi quedi geometria pintada, que és
   * justament el que la retallada podria haver-se endut de més.
   */
  { path: 'press/media-logos/rac1.svg', role: 'logotip de RAC1, sense el quadrat de fons' },
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
        // Vegeu la capçalera: als actius que tenen generador no se'ls compten
        // els píxels translúcids, se'ls nega el canal on podrien existir.
        if (asset.alpha === 'cap') {
          expect(
            image.colorType,
            'aquest actiu el cou scripts/png.ts i ha de sortir RGB (tipus 2), sense canal alfa',
          ).toBe(2);
        } else if (asset.alpha === 'opac') {
          expect(image.colorType, 'aquest actiu porta canal alfa a posta').toBe(6);
          expect(image.minAlpha).toBe(255);
        } else {
          // El favicon és una silueta: la transparència exterior és part de
          // la marca, no un forat accidental en una icona de pantalla d'inici.
          expect(image.colorType, 'el favicon conserva la silueta transparent').toBe(6);
          expect(image.minAlpha).toBeLessThan(255);
        }
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

  /*
   * CAP DECLARACIÓ D'ICONA POT APUNTAR A UN FITXER QUE NO EXISTEIX.
   *
   * El 8 d'agost de 2026 Google encara pintava a la SERP el llamp lila de Vite,
   * la icona de la plantilla amb què va néixer el projecte. Aquella còpia se la
   * va endur el cercador quan la portada declarava `/vite.svg`, i el fitxer feia
   * mesos que no existia: ningú no ho podia veure, perquè un `<link rel="icon">`
   * trencat no fa soroll enlloc —el navegador es queda amb el que tingui i no
   * escriu res a la consola.
   *
   * Aquesta prova és la que hi hauria d'haver hagut: recorre TOTES les
   * declaracions d'icona de la portada i de la 404 i exigeix que cada camí
   * existeixi a `public/` i, a més, que sigui un dels actius auditats aquí
   * dalt. Declarar una icona que aquest fitxer no mira seria tornar a obrir la
   * porta pel cantó de sempre.
   */
  it('cada icona declarada existeix i és una de les auditades', () => {
    const auditats = new Set<string>([
      ...RASTER.map((asset) => asset.path),
      ...VECTOR.map((asset) => asset.path),
      ...COMPATIBILITY_IMAGES,
    ]);
    const documents: [string, string][] = [
      ['index.html', indexHtml],
      ['public/404.html', readFileSync(join(PUBLIC, '404.html'), 'utf8')],
    ];

    for (const [nom, html] of documents) {
      const declarades = (html.match(/<link\b[^>]*>/g) ?? [])
        .filter((tag) => /\brel="(?:icon|apple-touch-icon)"/.test(tag))
        .map((tag) => /\bhref="([^"]*)"/.exec(tag)?.[1] ?? '');

      // Una portada sense cap icona declarada és el cas que Google resol
      // agafant el que tingui desat, que és exactament d'on venia el llamp.
      expect(declarades.length, `${nom} no declara cap icona`).toBeGreaterThan(0);

      for (const href of declarades) {
        const path = href.replace('%BASE_URL%', '').replace(/^\//, '');
        expect(auditats, `${nom} declara ${href}, que no és cap actiu auditat`).toContain(path);
      }
    }
  });

  it('les etiquetes Open Graph declaren la mida que la targeta fa de debò', () => {
    // WhatsApp i X reserven la caixa amb aquests dos números abans de baixar
    // la imatge: si menteixen, la targeta surt deformada o retallada.
    const card = measurePng(readFileSync(join(PUBLIC, 'brand', 'og-ca.png')));
    expect(metaContent('og:image:width')).toBe(String(card.width));
    expect(metaContent('og:image:height')).toBe(String(card.height));
    expect(metaContent('og:image')).toMatch(/brand\/og-ca\.png$/);
    expect(metaContent('twitter:image')).toMatch(/brand\/og-ca\.png$/);
  });
});

/** Les etiquetes que dibuixen alguna cosa per si soles. */
const FORMES = /^(?:path|circle|rect|ellipse|polygon|polyline|line|text|image)$/;

/**
 * Les formes d'un SVG que de debò deixen tinta, amb la pintura HEREDADA.
 *
 * PER QUÈ NO N'HI HA PROU MIRANT CADA FORMA PEL SEU COMPTE. La versió anterior
 * llegia el `fill` de l'etiqueta i prou, i deia al comentari que una forma sense
 * atribut també pinta —perquè el negre és el valor inicial de l'SVG— però el codi
 * feia el contrari i la descartava. Amb els logotips de la marca no es va notar
 * mai: tots escriuen el color a cada cercle. Amb els logotips dels mitjans, que
 * el declaren un sol cop a `<svg fill="currentColor">` o a un `<g>` que els
 * embolcalla, la prova hauria dit que cinc fitxers amb lletres ben visibles no
 * dibuixen res.
 *
 * O sigui: el criteri és `fill` EFECTIU, i per tenir-lo cal la pila d'elements
 * oberts. Només es descarta el que declara `none` —o hereta un `none` que ningú
 * no sobreescriu— i tampoc no té traç.
 *
 * QUÈ NO SAP LLEGIR, dit perquè consti: un `fill` que arribi des d'un `<style>`
 * intern o d'un full de fora. Si algun dia entra un actiu així, aquesta prova el
 * declararà buit i haurà de créixer; és la direcció segura de fallar.
 */
function formesPintades(svg: string): string[] {
  const inherited: { fill: string; stroke: string }[] = [{ fill: 'black', stroke: 'none' }];
  const painted: string[] = [];

  for (const match of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)\b([^>]*?)(\/?)>/g)) {
    const [tag, closing, name, attributes, selfClosing] = match;
    const top = inherited[inherited.length - 1];

    if (closing === '/') {
      if (inherited.length > 1) inherited.pop();
      continue;
    }

    const own = {
      fill: /\bfill="([^"]*)"/.exec(attributes)?.[1] ?? top.fill,
      stroke: /\bstroke="([^"]*)"/.exec(attributes)?.[1] ?? top.stroke,
    };

    if (FORMES.test(name.toLowerCase())) {
      if (own.fill !== 'none' || own.stroke !== 'none') painted.push(tag);
    }
    // Un contenidor obert passa la seva pintura als fills; un d'autotancat, no.
    if (selfClosing !== '/') inherited.push(own);
  }

  return painted;
}

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
        const inked = formesPintades(painted);
        expect(inked, 'cap forma pintada fora de <defs>').not.toEqual([]);
      });
    });
  }
});

describe('l’inventari', () => {
  /**
   * Aquesta és la prova que converteix les altres en vigilància.
   *
   * Sense ella, aquest fitxer només diria que els dotze actius d'avui estan
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

    const watched = [
      ...RASTER.map((a) => a.path),
      ...VECTOR.map((a) => a.path),
      ...COMPATIBILITY_IMAGES,
    ];
    expect(found.sort()).toEqual(watched.sort());
  });
});
