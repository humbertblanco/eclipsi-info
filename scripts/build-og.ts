/**
 * Cou la targeta social: `public/brand/og.png`, 1200×630.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER. Pel mateix motiu que `build-minimap.ts`, i
 * amb més audiència en joc. La targeta és el que ensenyen WhatsApp, Telegram,
 * X o Slack quan algú enganxa l'enllaç: per a molta gent és l'ÚNICA cosa que
 * veurà del producte. Fins avui era un PNG cuit una vegada a mà, sense
 * generador. Si es feia malbé no es podia refer; si sortia buida no petava res
 * —ni la consola del navegador se n'assabenta— i el producte quedava en blanc a
 * la cara pública. És exactament la forma de l'error del mini-mapa (1296×1008
 * píxels a (0,0,0,0), publicats i invisibles durant setmanes), amb l'agreujant
 * que aquesta imatge no la mira mai ningú del projecte: la miren els altres.
 *
 * QUÈ HEREDA I QUÈ REGENERA. Res. La targeta es dibuixa SENCERA des de zero:
 * fons, corona i text rasteritzat amb les fonts del projecte
 * (`scripts/truetype.ts`). No es reaprofita cap píxel de la imatge antiga, i
 * per això la comparació amb l'original és honesta i es pot repetir.
 *
 * LA COMPOSICIÓ SURT DE MESURAR L'ORIGINAL, no de reinventar-la. El 3 d'agost
 * de 2026 es va descodificar l'`og.png` publicat i se'n van llegir, píxel a
 * píxel, les caixes de cada línia i la geometria del disc:
 *
 *     element        tinta            font                    color
 *     rètol          x 82…251         mono 24 px              #FFA51F sun-500
 *     titular 1      x 81…855         display 700 · 67 px     #F5F0E4 corona-100
 *     titular 2      x 79…823         display 700 · 67 px     #F5F0E4
 *     dada 1         x 82…610         body 400 · 30 px        #7D89A2 slate-350
 *     dada 2         x 82…846         body 400 · 30 px        #7D89A2
 *     peu            x 81…337         mono 24 px              #7D89A2
 *     disc de lluna  centre (935,329), radi 112
 *
 * Els cossos i els colors coincideixen amb els tokens del sistema, i per això
 * aquest fitxer els llegeix de `src/styles/tokens/colors.css` en comptes de
 * copiar-los: canviar `--sun-500` ha de canviar la targeta.
 *
 * ELS TRES CANVIS RESPECTE DE L'ORIGINAL, i per què:
 *
 *  1. EL BLOC DE TEXT PUJA 28 px. A l'original la tinta anava de y=132 a y=555:
 *     132 px de marge a dalt i 74 a baix, sobre una tela de 630. Es veia
 *     escorrent-se cap avall. Ara va de y=103 a y=527, o sigui 103 i 102: el
 *     bloc queda centrat de debò.
 *  2. LA LLUNA ES MOU DE (935,329) A (960,315): centrada verticalment i 25 px
 *     més enfora. El radi és el mateix, 112. Amb això el titular deixa de
 *     passar per damunt del disc: a l'original les últimes lletres de
 *     «d’eclipsi» (x 844…855) queien sobre la lluna, que a l'altura d'aquella
 *     línia començava a x=848. Ara el titular acaba a 846 i el disc no comença
 *     fins a 873.
 *  3. LA CORONA COMENÇA AL LIMBE. A l'original hi ha un anell fosc entre el
 *     disc (radi 108, lluminositat 3,3) i on s'encén la llum de debò (radi 135,
 *     lluminositat 50): l'anell brillant sura separat de la lluna i l'escena
 *     llegeix com un anular, no com el total que diu el text. En un eclipsi
 *     total la corona surt ENGANXADA a la vora del disc, i aquí es dibuixa així.
 *
 * LA CORONA ÉS UNA ESTILITZACIÓ, I ES DIU. No és la corona del 12 d'agost de
 * 2026 —ningú no la sap encara, i el que en surti dependrà de com vagi el cicle
 * solar—: és un camp de serpentines deterministes (`STREAMERS`, escrites
 * literalment aquí sota, sense cap generador aleatori, perquè dues execucions
 * han de donar el mateix fitxer). L'única cosa que imita del fenomen és que
 * s'allarga per l'equador i s'aplana pels pols. La forma és decorativa, no
 * afirma res, i per això no surt enlloc de l'app: viu només en aquesta targeta.
 *
 * SENSE CANAL ALFA, com el mini-mapa. `png.ts` només escriu RGB i això és una
 * decisió: l'alfa de l'original (1200×630 píxels tots opacs, 320 kB) era pes
 * mort i era la porta per on va entrar l'error d'origen. Sense alfa, el pitjor
 * que en pot sortir és una imatge negra, que es veu de seguida —i que a més
 * atura la comprovació de més avall abans d'escriure res.
 *
 * ES VERIFICA ABANS D'ESCRIURE. La lliçó del mini-mapa no era «una imatge pot
 * sortir buida», era «no hi havia res que mirés un sol píxel». Aquí es miren:
 * lluminositat màxima, mitjana i desviació amb els MATEIXOS llindars que
 * `tests/actius-binaris.test.ts`, les quatre cantonades contra el
 * `background_color` del manifest, i la tinta de cada línia de text dins de la
 * seva caixa. Si alguna cosa falla, no s'escriu el fitxer: val més quedar-se
 * amb la targeta d'ahir que publicar-ne una de morta.
 *
 * EL QUE EN SURT, mesurat el 3 d'agost de 2026 (l'original, al costat):
 *
 *                        aquesta      l'original de fa unes hores
 *     mides              1200×630     1200×630
 *     canal              RGB          RGBA amb tots els píxels opacs
 *     pes                136,0 kB     320,3 kB
 *     lluminositat màx   240,1        240,1
 *     mitjana            21,70        25,77
 *     desviació          47,22        48,91
 *
 * La mitjana baixa perquè la corona nova, en comptes de repartir una boira
 * per tota la meitat dreta, concentra la llum al limbe i en unes quantes
 * serpentines. Els tres llindars de `tests/actius-binaris.test.ts` (40 / 8 / 10)
 * queden igual de lluny.
 *
 * ÚS:  npx tsx scripts/build-og.ts          escriu public/brand/og.png
 *      npx tsx scripts/build-og.ts --dry    ho comprova tot i no escriu res
 *
 * COST: cap xarxa, cap binari natiu. Llegeix tres `.woff` de node_modules i
 * triga un segon i quart. DETERMINISTA: dues execucions donen el mateix fitxer
 * byte a byte, que és el que permet saber si un canvi al codi ha canviat res.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png';
import { fillContours, loadFont, type Font } from './truetype';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const OUT = join(ROOT, 'public', 'brand', 'og.png');

const WIDTH = 1200;
const HEIGHT = 630;

/* ── Els tokens, llegits del sistema de disseny ──────────────────────────── */

/**
 * Els colors surten de `src/styles/tokens/colors.css`, no d'una còpia.
 *
 * És el mateix argument que `src/styles/palette.ts` fa per als llenços de
 * l'app: el sistema de disseny ha de ser l'única font de veritat. Aquí no hi ha
 * navegador que resolgui `var()`, i per això es resol a mà —dues passades
 * n'hi ha prou per a la cadena més llarga del fitxer, `--text-muted` →
 * `--slate-350`.
 */
function readTokens(): Map<string, string> {
  const css = readFileSync(join(ROOT, 'src', 'styles', 'tokens', 'colors.css'), 'utf8');
  // Només l'abast `:root`. El `.eclipsi-daylight` de sota redefineix els
  // mateixos noms per a la fulla de seguretat impresa, i aquí faria nosa.
  const root = /:root\s*\{([\s\S]*?)\}/.exec(css);
  if (root === null) throw new Error('colors.css sense bloc :root');

  const tokens = new Map<string, string>();
  for (const match of root[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1], match[2].trim());
  }
  for (let pass = 0; pass < 4; pass++) {
    for (const [name, value] of tokens) {
      const reference = /^var\((--[\w-]+)\)$/.exec(value);
      if (reference === null) continue;
      const target = tokens.get(reference[1]);
      if (target !== undefined) tokens.set(name, target);
    }
  }
  return tokens;
}

const TOKENS = readTokens();

/** Un token de color com a tripleta 0…255. Peta si no és un `#rrggbb`. */
function token(name: string): [number, number, number] {
  const value = TOKENS.get(name);
  if (value === undefined) throw new Error(`colors.css no defineix ${name}`);
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (hex === null) {
    throw new Error(`${name} val «${value}», que no és un color pla que sàpiga pintar`);
  }
  return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
}

const INK = token('--ink-950'); // el fons de la pàgina i del manifest
const MOON = token('--bg-inset'); // el disc: l'única cosa més fosca que el fons
const CORONA_RIM = token('--corona-100'); // la llum del limbe
const CORONA_MID = token('--sun-200');
const CORONA_FAR = token('--sun-500');
const TEXT_TITLE = token('--corona-100');
const TEXT_META = token('--slate-350'); // = --text-muted
const TEXT_MARK = token('--sun-500'); // = --accent

/* ── Les fonts del projecte ──────────────────────────────────────────────── */

const FONTS = join(ROOT, 'node_modules', '@fontsource');

/**
 * Els mateixos fitxers que `src/styles/index.css` declara als `@font-face`,
 * amb els mateixos pesos: display 700 per al titular, body 400 per a les dades
 * i mono 500 per al rètol i el peu (`--text-overline` i `--text-data` del
 * sistema són els dos de mono).
 *
 * SUBCONJUNT `latin`, i s'ha comprovat: tot el text d'aquesta targeta —amb
 * «à», «ó», el punt volat «·» i l'apòstrof tipogràfic «’»— hi cap. Si algú hi
 * posa una lletra que no hi és, `truetype.ts` peta amb el caràcter i el punt de
 * codi al missatge en comptes de dibuixar un quadrat buit.
 */
const display = loadFont(join(FONTS, 'space-grotesk/files/space-grotesk-latin-700-normal.woff'));
const body = loadFont(join(FONTS, 'ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff'));
const mono = loadFont(join(FONTS, 'ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff'));

/* ── La tela ─────────────────────────────────────────────────────────────── */

/** RGB pla, tres bytes per píxel, sense canal alfa. Vegeu la capçalera. */
const canvas = Buffer.alloc(WIDTH * HEIGHT * 3);

/** Barreja un color sobre el que ja hi ha, amb una cobertura de 0 a 1. */
function blend(x: number, y: number, colour: [number, number, number], cover: number): void {
  if (cover <= 0 || x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const at = (y * WIDTH + x) * 3;
  const a = cover > 1 ? 1 : cover;
  canvas[at] = Math.round(canvas[at] * (1 - a) + colour[0] * a);
  canvas[at + 1] = Math.round(canvas[at + 1] * (1 - a) + colour[1] * a);
  canvas[at + 2] = Math.round(canvas[at + 2] * (1 - a) + colour[2] * a);
}

/** Lluminositat percebuda d'un píxel, 0…255. La mateixa fórmula que les proves. */
function luma(x: number, y: number): number {
  const at = (y * WIDTH + x) * 3;
  return canvas[at] * 0.299 + canvas[at + 1] * 0.587 + canvas[at + 2] * 0.114;
}

/* ── La corona ───────────────────────────────────────────────────────────── */

const CORONA_X = 960;
const CORONA_Y = HEIGHT / 2; // 315: centrada, vegeu el canvi 2 de la capçalera
const MOON_R = 112;
/** On la corona s'apaga del tot. Més enllà d'això no es toca cap píxel. */
const CORONA_R = 450;
/**
 * Aplanament polar de les SERPENTINES, no del disc.
 *
 * La corona de debò s'allarga per l'equador i s'arrissa als pols. Aquí, a més,
 * és el que manté netes les quatre cantonades del marc: amb 1,34, les dues
 * cantonades de la dreta queden a radi efectiu 485, fora dels 450 i per tant a
 * zero exacte —i `verify()` ho torna a comprovar sobre els píxels de debò. LA LLUNA NO S'APLANA —la primera versió d'aquest fitxer li aplicava
 * el mateix factor i el resultat era un ou, no un eclipsi.
 */
const POLAR_SQUASH = 1.34;

/**
 * Les serpentines: amplitud, nombre de puntes i fase (radians).
 *
 * ESCRITES A MÀ I NO SORTEJADES. Un generador aleatori faria que dues
 * execucions donessin fitxers diferents i que el diff d'un PNG —que ja no es
 * pot revisar— fos, a més, soroll. Amb això, tornar a executar l'script sobre
 * el mateix codi dona byte a byte el mateix fitxer.
 *
 * I NO SÓN SIMÈTRIQUES A POSTA. El primer terme té UNA punta, i això fa que la
 * corona arribi al 0,63 cap a la dreta i només al 0,31 cap a l'esquerra. Els
 * dos motius van junts: cap a la dreta hi ha 240 px de targeta buida per
 * omplir, i cap a l'esquerra hi ha el titular, que amb la versió simètrica
 * (0,69 a l'esquerra) quedava assegut damunt d'una boira.
 */
const STREAMERS: [amplitude: number, lobes: number, phase: number][] = [
  [0.4, 1, 0.0],
  [0.26, 3, 1.15],
  [0.16, 5, 2.4],
  [0.1, 7, 0.55],
  [0.05, 13, 3.1],
];

/** Quant s'allarga la corona en aquesta direcció, de 0,25 a 1. */
function streamer(angle: number): number {
  let sum = 0;
  for (const [amplitude, lobes, phase] of STREAMERS) sum += amplitude * Math.cos(lobes * angle + phase);
  // sum va de -0,98 a 0,98; això el porta a 0,25…1 amb el gruix cap al mig.
  const t = (sum + 1) / 2;
  return 0.25 + 0.75 * t * t;
}

function paintCorona(): void {
  // Prou mostres per fila per no veure escala al limbe ni a les serpentines.
  const SUB = 3;
  const step = 1 / SUB;
  const share = 1 / (SUB * SUB);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let coverMoon = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;

      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const px = x + (sx + 0.5) * step;
          const py = y + (sy + 0.5) * step;
          const dx = px - CORONA_X;
          const dy = py - CORONA_Y;

          // El disc és un CERCLE, i el que s'aplana és només la corona de fora.
          const r = Math.hypot(dx, dy);
          if (r < MOON_R) {
            coverMoon += share;
            continue;
          }
          const rSquashed = Math.hypot(dx, dy * POLAR_SQUASH);
          if (rSquashed >= CORONA_R) continue;

          const t = r - MOON_R;
          const tSquashed = Math.max(0, rSquashed - MOON_R);
          const reach = streamer(Math.atan2(dy * POLAR_SQUASH, dx));

          /*
           * TRES CAPES, I CADASCUNA TÉ EL SEU COLOR PROPI.
           *
           * La primera versió les barrejava amb un sol degradat del blanc al
           * taronja repartit en 160 px, i el resultat era una boira grisa: a
           * mig camí, el blanc del limbe encara pesava prou per rentar el
           * taronja. Ara cada capa aporta el seu color amb el seu pes i es
           * componen premultiplicades, que és com es comporta la llum.
           *
           *  · LIMBE. Una campana estreta —uns 9 px— clavada a la vora del
           *    disc. És la línia que fa que la lluna es llegeixi com un forat
           *    retallat i no com una taca.
           *  · CORONA INTERIOR. Càlida i curta, la que dona el gruix.
           *  · SERPENTINES. Llargues, taronges i amb la llargada modulada per
           *    la direcció: és el que omple el costat dret de la targeta.
           */
          const limb = Math.exp(-((t / 4.5) ** 2));
          const inner = Math.exp(-t / 26);
          const outer = Math.exp(-tSquashed / (55 + 230 * reach)) * reach;

          // A zero exacte al límit: cap píxel de corona toca el marc.
          const fade = Math.max(0, 1 - tSquashed / (CORONA_R - MOON_R)) ** 2;

          const weights: [number, [number, number, number]][] = [
            [0.98 * limb, CORONA_RIM],
            [0.5 * inner * fade, CORONA_MID],
            [0.62 * outer * fade, CORONA_FAR],
          ];
          for (const [weight, colour] of weights) {
            if (weight <= 0.0005) continue;
            const a = (weight > 1 ? 1 : weight) * share;
            sumR += colour[0] * a;
            sumG += colour[1] * a;
            sumB += colour[2] * a;
            sumA += a;
          }
        }
      }

      if (coverMoon > 0) blend(x, y, MOON, coverMoon);
      if (sumA > 0) blend(x, y, [sumR / sumA, sumG / sumA, sumB / sumA], sumA);
    }
  }
}

/* ── El text ─────────────────────────────────────────────────────────────── */

/** Marge esquerre del bloc. A l'original la tinta començava a x=81…83. */
const MARGIN_X = 80;
/**
 * El bloc puja 28 px respecte de l'original. Vegeu el canvi 1 de la capçalera:
 * amb això els marges de dalt i de baix queden a 103 i 102 en comptes de 132 i 74.
 */
const LIFT = 28;

interface Line {
  /** Per als missatges i per a la comprovació de tinta d'abans d'escriure. */
  name: string;
  text: string;
  font: Font;
  size: number;
  /** Línia de base a l'original, abans d'aplicar `LIFT`. */
  baseline: number;
  colour: [number, number, number];
  trackingEm?: number;
}

/**
 * EL TEXT ÉS EL DE L'ORIGINAL, llegit de la imatge publicada lletra a lletra.
 * No s'hi ha tocat ni una coma: aquesta feina era posar-hi generador, no
 * reescriure la portada. L'única diferència és el rètol, que ara porta
 * l'interlletratge de `--ls-caps` (0,14 em) que el sistema demana per a les
 * versaletes i que la targeta cuita a mà no havia aplicat.
 *
 * El titular és el mateix que `<title>`, que `og:title` i que `og:image:alt`
 * de l'`index.html`: si algun dia divergeixen, el que menteix és la targeta.
 */
const LINES: Line[] = [
  {
    name: 'rètol',
    text: 'ECLIPSI.INFO',
    font: mono,
    size: 24,
    baseline: 149,
    colour: TEXT_MARK,
    trackingEm: 0.14,
  },
  { name: 'titular 1', text: 'Quants segons d’eclipsi', font: display, size: 67, baseline: 258, colour: TEXT_TITLE },
  { name: 'titular 2', text: 'veuràs des d’on seràs?', font: display, size: 67, baseline: 340, colour: TEXT_TITLE },
  {
    name: 'dada 1',
    text: 'Eclipsi total de Sol · 12 d’agost de 2026',
    font: body,
    size: 30,
    baseline: 430,
    colour: TEXT_META,
  },
  {
    name: 'dada 2',
    text: 'Calculat per al teu punt exacte. Funciona sense connexió.',
    font: body,
    size: 30,
    baseline: 473,
    colour: TEXT_META,
  },
  { name: 'peu', text: '2026 · 2027 · 2028', font: mono, size: 24, baseline: 554, colour: TEXT_META },
];

interface PaintedLine extends Line {
  /** La caixa que ha ocupat la tinta de debò, per comprovar-la després. */
  box: { x0: number; y0: number; x1: number; y1: number };
  inkPixels: number;
}

function paintText(): PaintedLine[] {
  const painted: PaintedLine[] = [];
  for (const line of LINES) {
    const contours = line.font.outline(
      line.text,
      line.size,
      MARGIN_X,
      line.baseline - LIFT,
      line.trackingEm ?? 0,
    );
    const mask = fillContours(contours, WIDTH, HEIGHT);
    let inkPixels = 0;
    for (let row = 0; row < mask.height; row++) {
      for (let column = 0; column < mask.width; column++) {
        const cover = mask.data[row * mask.width + column];
        if (cover <= 0) continue;
        if (cover > 0.5) inkPixels++;
        blend(mask.x0 + column, mask.y0 + row, line.colour, cover);
      }
    }
    painted.push({
      ...line,
      inkPixels,
      box: { x0: mask.x0, y0: mask.y0, x1: mask.x0 + mask.width - 1, y1: mask.y0 + mask.height - 1 },
    });
  }
  return painted;
}

/* ── El que es comprova abans d'escriure ─────────────────────────────────── */

/** Els mateixos llindars que `tests/actius-binaris.test.ts`. Dues comprovacions que diuen el mateix l'han de dir igual. */
const MIN_MAX_LUMA = 40;
const MIN_AVG_LUMA = 8;
const MIN_STDDEV = 10;

function verify(painted: PaintedLine[]): void {
  const problems: string[] = [];

  let max = 0;
  let sum = 0;
  let sumSquares = 0;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const value = luma(x, y);
      if (value > max) max = value;
      sum += value;
      sumSquares += value * value;
    }
  }
  const pixels = WIDTH * HEIGHT;
  const avg = sum / pixels;
  const stddev = Math.sqrt(Math.max(0, sumSquares / pixels - avg * avg));

  if (max <= MIN_MAX_LUMA) problems.push(`lluminositat màxima ${max.toFixed(1)} ≤ ${MIN_MAX_LUMA}: la imatge és negra`);
  if (avg <= MIN_AVG_LUMA) problems.push(`lluminositat mitjana ${avg.toFixed(2)} ≤ ${MIN_AVG_LUMA}`);
  if (stddev <= MIN_STDDEV) problems.push(`desviació ${stddev.toFixed(2)} ≤ ${MIN_STDDEV}: la imatge és plana`);

  // Les cantonades han de ser EXACTAMENT el fons del manifest: una cantonada
  // d'un altre color surt amb una vora que no és de ningú a la vista prèvia.
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'public', 'manifest.webmanifest'), 'utf8'),
  ) as { background_color: string };
  const wanted = manifest.background_color.toLowerCase();
  for (const [x, y] of [
    [0, 0],
    [WIDTH - 1, 0],
    [0, HEIGHT - 1],
    [WIDTH - 1, HEIGHT - 1],
  ]) {
    const at = (y * WIDTH + x) * 3;
    const got = `#${canvas[at].toString(16).padStart(2, '0')}${canvas[at + 1].toString(16).padStart(2, '0')}${canvas[at + 2].toString(16).padStart(2, '0')}`;
    if (got !== wanted) problems.push(`la cantonada (${x},${y}) és ${got} i el manifest diu ${wanted}`);
  }

  // I QUE EL TEXT HI SIGUI. Sense això, una targeta amb el fons i la corona bé
  // i totes les lletres a fora del marc passaria totes les proves anteriors.
  for (const line of painted) {
    const expected = Math.max(60, line.text.length * line.size * 0.12);
    if (line.inkPixels < expected) {
      problems.push(
        `la línia «${line.name}» només ha deixat ${line.inkPixels} píxels de tinta (n'esperava ${expected.toFixed(0)})`,
      );
    }
    if (line.box.x1 >= WIDTH - 8 || line.box.y1 >= HEIGHT - 8 || line.box.x0 < 4) {
      problems.push(`la línia «${line.name}» toca el marc: x ${line.box.x0}…${line.box.x1}, y ${line.box.y0}…${line.box.y1}`);
    }
  }

  // Les etiquetes Open Graph reserven la caixa amb aquests dos números abans de
  // baixar la imatge: si menteixen, la targeta surt deformada a la vista prèvia.
  const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const declared = (key: string): string | undefined => {
    for (const tag of indexHtml.match(/<meta\b[^>]*>/g) ?? []) {
      if (/\b(?:property|name)="([^"]*)"/.exec(tag)?.[1] === key) return /\bcontent="([^"]*)"/.exec(tag)?.[1];
    }
    return undefined;
  };
  if (declared('og:image:width') !== String(WIDTH) || declared('og:image:height') !== String(HEIGHT)) {
    problems.push(
      `l'index.html declara ${declared('og:image:width')}×${declared('og:image:height')} i això fa ${WIDTH}×${HEIGHT}`,
    );
  }

  console.log(
    `Mesures: màxima ${max.toFixed(1)}, mitjana ${avg.toFixed(2)}, desviació ${stddev.toFixed(2)} ` +
      `(els llindars són ${MIN_MAX_LUMA} / ${MIN_AVG_LUMA} / ${MIN_STDDEV})`,
  );
  for (const line of painted) {
    console.log(
      `  ${line.name.padEnd(9)} x ${String(line.box.x0).padStart(4)}…${String(line.box.x1).padEnd(4)} ` +
        `y ${String(line.box.y0).padStart(3)}…${String(line.box.y1).padEnd(3)} ${line.inkPixels} px de tinta`,
    );
  }

  if (problems.length > 0) {
    throw new Error(`la targeta no passa la revisió i NO s'escriu:\n  · ${problems.join('\n  · ')}`);
  }
}

/* ── Fer-la ──────────────────────────────────────────────────────────────── */

function main(): void {
  for (let i = 0; i < canvas.length; i += 3) {
    canvas[i] = INK[0];
    canvas[i + 1] = INK[1];
    canvas[i + 2] = INK[2];
  }

  paintCorona();
  const painted = paintText();
  verify(painted);

  const png = encodePng({ width: WIDTH, height: HEIGHT, data: canvas });

  if (process.argv.includes('--dry')) {
    console.log(`Assaig: la targeta passa la revisió i faria ${(png.length / 1024).toFixed(1)} kB. No s'ha escrit res.`);
    return;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, png);
  console.log(`Escrit ${OUT}: ${WIDTH}×${HEIGHT}, RGB sense alfa, ${(png.length / 1024).toFixed(1)} kB`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
