/**
 * QUANT OCUPA UN TEXT: la pregunta que en aquest repositori no es podia fer.
 *
 * PER QUÈ EXISTEIX. El 12-8-2026 es va descobrir que el peu que `composeCapture()`
 * crema dins de la foto que l'usuari comparteix JA SORTIA ESCLAFAT AL 87 % en
 * castellà amb un topònim llarg. `ctx.fillText(text, x, y, maxW)` no retalla:
 * CONDENSA. I ningú no ho podia veure, perquè `tests/dom-setup.ts` anul·lava
 * `getContext()` i el codi de pintar no s'executava mai. La seva pròpia
 * capçalera ho deia amb totes les lletres: «si algun dia cal provar el que es
 * dibuixa, això s'ha de treure». Aquest fitxer és la meitat que faltava.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ NO EL PAQUET `canvas` NATIU, i el refús segueix sent bo.
 *
 * El motiu original (`dom-setup.ts`) era el preu: és una extensió nativa que es
 * compila a cada instal·lació, i el projecte no en treia res. Avui n'hi ha un
 * de més fort: `node-canvas` mesuraria amb les fonts DE L'ORDINADOR QUE CORRE
 * LES PROVES. `system-ui` a un Mac és SF Pro, a un servidor d'integració sense
 * fonts instal·lades és el que hi hagi —o res—, i cap de les dues és la font
 * del mòbil de l'usuari. Hauria costat una compilació nativa per donar un
 * número que canvia de màquina en màquina: pitjor que no tenir-ne, perquè
 * sembla una mesura.
 *
 * PER QUÈ TAMPOC UN `measureText` INVENTAT. El context de mentida de
 * `features/sim/renderSky.test.ts` en té un que torna `text.length * 8`, i allà
 * està bé perquè aquella prova no pregunta amplades: pregunta si la carena cau
 * dins del llenç. Aquí la pregunta ÉS l'amplada, i vuit píxels per caràcter
 * només diria el que ja sabem: quantes lletres té la cadena.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÈ ES MESURA, DONCS: la suma dels avanços horitzontals dels glifs, llegits
 * de la font de debò. S'obre el WOFF que `@fontsource/ibm-plex-sans` publica,
 * se'n descomprimeixen `head`, `hhea`, `hmtx` i `cmap`, i s'hi sumen els
 * avanços de cada caràcter. Un caràcter que la font no tingui NO se salta:
 * peta amb el seu nom, perquè un glif absent que compti zero seria justament
 * la mesura que fa cabre el que no hi cap.
 *
 * ES TRIA IBM Plex Sans Medium (500) i no cap altra: és la font que aquesta app
 * publica per al cos de text (`src/styles/index.css` en declara el `@font-face`
 * amb aquest mateix fitxer) i és EXACTAMENT el gruix que el peu demana
 * (`capture.ts`: «500 …px system-ui, sans-serif»). Es llegeix el `.woff` i no
 * el `.woff2` que carrega l'app perquè és el mateix disseny empaquetat de dues
 * maneres i el primer és zlib, que Node desfà sol; el segon demana desfer les
 * transformacions de taula de WOFF2 i no aporta ni un dècim de píxel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÈ NO MESURA, I S'HA DE DIR ABANS QUE ALGÚ HI CONFIÏ DE MÉS:
 *
 *  · NO MESURA `system-ui`. El peu es pinta amb `system-ui`, que és SF Pro a
 *    iOS, Roboto a Android i Segoe UI a Windows: tres fonts diferents, cap de
 *    les quals viu en aquest repositori. Això mesura Plex Sans.
 *
 *    QUANT s'hi assembla, mesurat: la capçalera de `features/ar/caption.ts`
 *    porta cinc amplades preses amb la geometria real el 12-8-2026, i aquest
 *    regle les dona 5,1 %, 5,6 %, 6,0 %, 5,6 % i 6,6 % MÉS AMPLES. Sempre més
 *    ample, mai més estret: erra cap al costat segur, que per a la pregunta
 *    «hi cap?» vol dir que un «sí» d'aquí és un sí. `caption-fit.test.tsx` ho
 *    comprova a cada passada i no deixa que aquesta afirmació envelleixi.
 *
 *  · NO APLICA INTERLLETRATGE NI LLIGADURES. Un navegador aplica els parells
 *    de `kern` del GPOS, que solen restar; la suma d'avanços és, per a la
 *    mateixa font, la fita superior. Cap al mateix costat segur.
 *
 *  · NO DIU RES DE L'ALÇADA, ni de la línia de base, ni de quin color queda cap
 *    píxel. Això segueix sense poder-se provar aquí i es mira amb els ulls.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { inflateSync } from 'node:zlib';

/** La font oberta i llesta per mesurar. */
export interface FontMesurable {
  /** Com se'n parla als missatges d'error. */
  nom: string;
  /** Unitats de disseny per em: l'escala en què venen els avanços. */
  unitsPerEm: number;
  /** Avanç horitzontal de cada glif, en unitats de disseny. */
  avancos: readonly number[];
  /** Punt de codi → índex de glif. */
  glifs: ReadonlyMap<number, number>;
}

const CAMI_RELATIU = 'node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff';

/**
 * On és el fitxer: es puja des del directori de treball fins a trobar-lo.
 *
 * NO S'ANCORA A `import.meta.url`, i ja va fallar per aquí: a la meitat `vista`
 * de Vitest —la de jsdom— aquest mòdul no arriba com un `file://` i
 * `fileURLToPath()` peta amb «The URL must be of scheme file» abans de córrer
 * cap prova. Pujar des del `cwd` funciona a les dues meitats i, de passada, als
 * arbres de treball paral·lels de git que aquest projecte fa servir, que tenen
 * el seu propi `node_modules` a l'arrel.
 */
function camiDeLaFont(): string {
  let directori = process.cwd();
  const provats: string[] = [];
  for (;;) {
    const provatura = join(directori, CAMI_RELATIU);
    if (existsSync(provatura)) return provatura;
    provats.push(provatura);
    const pare = dirname(directori);
    if (pare === directori) break;
    directori = pare;
  }
  throw new Error(
    `no s'ha trobat la font de proves. Provat a:\n  ${provats.join('\n  ')}\n` +
      "Si `npm install` està fet, mira si @fontsource ha canviat els noms dels fitxers.",
  );
}

/**
 * Les taules d'un WOFF, descomprimides.
 *
 * El format és un directori pla: capçalera de 44 bytes, una entrada de 20 per
 * taula i les dades. Una taula ve comprimida amb zlib quan la seva llargada
 * comprimida és menor que l'original, i tal qual quan no.
 */
function taulesWoff(fitxer: Buffer, cami: string): Map<string, Buffer> {
  if (fitxer.toString('latin1', 0, 4) !== 'wOFF') {
    throw new Error(`${cami} no és un WOFF`);
  }
  const taules = new Map<string, Buffer>();
  const nombre = fitxer.readUInt16BE(12);
  for (let i = 0; i < nombre; i++) {
    const p = 44 + i * 20;
    const etiqueta = fitxer.toString('latin1', p, p + 4);
    const desplacament = fitxer.readUInt32BE(p + 4);
    const comprimida = fitxer.readUInt32BE(p + 8);
    const original = fitxer.readUInt32BE(p + 12);
    const dades = fitxer.subarray(desplacament, desplacament + comprimida);
    taules.set(etiqueta, comprimida < original ? inflateSync(dades) : dades);
  }
  return taules;
}

/**
 * El `cmap`, en format 4 (BMP) o 12 (tot Unicode).
 *
 * Els subconjunts llatins de fontsource porten el format 4, que és el de
 * segments; el 12 s'accepta perquè una font sencera el porta i el dia que algú
 * hi posi una altra font no ha de trobar-se un error que no parla de res.
 */
function llegeixCmap(cmap: Buffer): Map<number, number> {
  const taules = cmap.readUInt16BE(2);
  let millor: { desplacament: number; format: number; punts: number } | null = null;
  for (let i = 0; i < taules; i++) {
    const p = 4 + i * 8;
    const plataforma = cmap.readUInt16BE(p);
    const codificacio = cmap.readUInt16BE(p + 2);
    const desplacament = cmap.readUInt32BE(p + 4);
    const format = cmap.readUInt16BE(desplacament);
    const punts =
      format === 12 ? 3 : format === 4 && plataforma === 3 && codificacio === 1 ? 2 : format === 4 ? 1 : 0;
    if (punts > 0 && (millor === null || punts > millor.punts)) {
      millor = { desplacament, format, punts };
    }
  }
  if (millor === null) throw new Error('la font no porta cap subtaula cmap que sapiguem llegir');

  const glifs = new Map<number, number>();
  if (millor.format === 4) {
    const o = millor.desplacament;
    const segmentsX2 = cmap.readUInt16BE(o + 6);
    const finals = o + 14;
    const inicis = finals + segmentsX2 + 2;
    const deltes = inicis + segmentsX2;
    const rangs = deltes + segmentsX2;
    for (let s = 0; s < segmentsX2 / 2; s++) {
      const fi = cmap.readUInt16BE(finals + s * 2);
      const inici = cmap.readUInt16BE(inicis + s * 2);
      const delta = cmap.readInt16BE(deltes + s * 2);
      const rang = cmap.readUInt16BE(rangs + s * 2);
      if (inici === 0xffff) continue;
      for (let c = inici; c <= fi; c++) {
        let glif: number;
        if (rang === 0) glif = (c + delta) & 0xffff;
        else {
          const i = rangs + s * 2 + rang + (c - inici) * 2;
          if (i + 1 >= cmap.length) continue;
          glif = cmap.readUInt16BE(i);
          if (glif !== 0) glif = (glif + delta) & 0xffff;
        }
        if (glif !== 0) glifs.set(c, glif);
      }
    }
    return glifs;
  }

  const o = millor.desplacament;
  const grups = cmap.readUInt32BE(o + 12);
  for (let i = 0; i < grups; i++) {
    const p = o + 16 + i * 12;
    const inici = cmap.readUInt32BE(p);
    const fi = cmap.readUInt32BE(p + 4);
    const primerGlif = cmap.readUInt32BE(p + 8);
    for (let c = inici; c <= fi; c++) glifs.set(c, primerGlif + (c - inici));
  }
  return glifs;
}

let memoria: FontMesurable | null = null;

/**
 * La font del peu: IBM Plex Sans Medium (500), la mateixa que publica l'app.
 *
 * Es llegeix una sola vegada per bateria. Si el fitxer no hi és, peta amb el
 * camí sencer: vol dir que `npm install` no s'ha fet o que fontsource ha canviat
 * els noms dels seus fitxers, i tots dos casos s'han de veure de seguida —
 * saltar-se la prova en silenci deixaria el peu sense ningú que el miri.
 */
export function fontDelPeu(): FontMesurable {
  if (memoria !== null) return memoria;
  const cami = camiDeLaFont();
  const taules = taulesWoff(readFileSync(cami), cami);
  const head = taules.get('head');
  const hhea = taules.get('hhea');
  const hmtx = taules.get('hmtx');
  const cmap = taules.get('cmap');
  if (!head || !hhea || !hmtx || !cmap) throw new Error('a la font hi falta alguna taula bàsica');

  const metriques = hhea.readUInt16BE(34);
  const avancos: number[] = [];
  for (let i = 0; i < metriques; i++) avancos.push(hmtx.readUInt16BE(i * 4));

  memoria = {
    nom: 'IBM Plex Sans Medium (500), subconjunt llatí',
    unitsPerEm: head.readUInt16BE(18),
    avancos,
    glifs: llegeixCmap(cmap),
  };
  return memoria;
}

/**
 * Amplada del text en píxels, al cos donat.
 *
 * Es recorre per punts de codi (`for…of`) i no per unitats UTF-16: un caràcter
 * fora del pla bàsic compta una vegada i no dues.
 */
export function ampladaPx(text: string, cosPx: number, font: FontMesurable = fontDelPeu()): number {
  let unitats = 0;
  for (const caracter of text) {
    const codi = caracter.codePointAt(0) as number;
    const glif = font.glifs.get(codi);
    if (glif === undefined) {
      throw new Error(
        `«${caracter}» (U+${codi.toString(16).toUpperCase().padStart(4, '0')}) no és a ${font.nom}: ` +
          'aquest text no es pot mesurar sense mentir',
      );
    }
    unitats += font.avancos[Math.min(glif, font.avancos.length - 1)];
  }
  return (unitats * cosPx) / font.unitsPerEm;
}

/** La mateixa amplada en ems: serveix per comparar geometries de mides diferents. */
export function ampladaEm(text: string, font: FontMesurable = fontDelPeu()): number {
  return ampladaPx(text, 1, font);
}
