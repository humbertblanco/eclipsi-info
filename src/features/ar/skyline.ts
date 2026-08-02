/**
 * Ancorar la superposició a la SILUETA DEL TERRENY.
 *
 * ── EL PROBLEMA QUE RESOL ───────────────────────────────────────────────────
 *
 * El seguiment visual que ja hi ha (`visualTracker.ts`) mesura quant ha girat
 * la imatge comparant un fotograma amb l'anterior. És bo, però té dos límits
 * que en aquesta app concreta són fatals:
 *
 *  1. ÉS RELATIU. Cada mesura és un increment, i els increments s'acumulen amb
 *     el seu error. Res no diu mai on ets en absolut, o sigui que la deriva no
 *     es pot corregir: només es pot frenar.
 *  2. NECESSITA TEXTURA. El cas es mesura i és el pitjor possible: apuntant a
 *     cel serè no hi ha res per aparellar i `FrameTracker.measure` retorna
 *     `null`. Llavors la postura fusionada és EXACTAMENT la del sensor, amb la
 *     brúixola i tot el que això arrossega. I apuntar al cel és, literalment,
 *     l'única cosa que aquesta app demana que facis.
 *
 * ── PER QUÈ AIXÒ FUNCIONA I NO CAL CAP MODEL ENTRENAT ───────────────────────
 *
 * Nosaltres tenim una cosa que cap altra app de RA no té: el PERFIL D'HORITZÓ
 * de 360° calculat des del model digital del terreny per al punt exacte de
 * l'usuari (`core/horizon`). O sigui que sabem, per a cada azimut, a quina
 * altura angular hi ha la carena. Això és un mapa absolut del que la càmera ha
 * de veure.
 *
 * I la silueta és el tret més fàcil de trobar que hi ha en una imatge d'aquest
 * tipus: els eclipsis espanyols del 2026 i el 2028 tenen el Sol a pocs graus
 * de l'horitzó, o sigui que el terreny és un retall fosc contra un cel
 * encès. El contrast vertical a la carena és el més gran de tota la columna,
 * amb diferència. No cal segmentar res amb una xarxa: cal buscar, a cada
 * columna, on cau la llum de cop.
 *
 * Aleshores: es detecta la silueta a la imatge, es prediu la silueta que
 * TOCARIA veure des de la postura actual, i s'ajusta la postura fins que les
 * dues coincideixen. El resultat és una mesura ABSOLUTA d'azimut i altura. No
 * deriva, perquè no s'acumula: cada fotograma torna a mirar el terreny.
 *
 * De passada, corregeix la brúixola. L'error d'una brúixola de mòbil dins d'un
 * cotxe, a prop d'un cotxe, o damunt d'un trípode metàl·lic, es compta per
 * desenes de graus, i la declinació magnètica és una altra cosa a sobre. La
 * muntanya que tens al davant no s'equivoca mai.
 *
 * ── QUÈ NO FA ───────────────────────────────────────────────────────────────
 *
 * Si no hi ha terreny a la vista —mar obert, boira, o el mòbil apuntant ben
 * amunt— no torna res, i el sistema es queda com estava. És una millora
 * oportunista: quan pot, clava; quan no pot, calla. No pot empitjorar res.
 *
 * Sense dependències de DOM: entra una escala de grisos i surten números.
 */

import type { Calibration, CameraPointing } from './orientation';
import { projectToScreen, unprojectFromScreen, normalizeAngle } from './orientation';
import type { Viewport } from './cameraGeometry';
import type { TrackerGeometry } from './visualTracker';

/** Un tall cel/terra trobat en una columna de la imatge. */
export interface SkylineHit {
  /** Columna, en píxels de PANTALLA. */
  x: number;
  /** Fila del tall, en píxels de PANTALLA. */
  y: number;
  /**
   * Contrast trobat, en unitats de la mateixa escala de grisos.
   *
   * Serveix per pesar l'ajust: una carena retallada contra el cel val molt més
   * que una vora difusa d'un núvol.
   */
  contrast: number;
}

/**
 * Quantes files amunt i avall es promitgen per mesurar el salt de llum.
 *
 * Amb una sola fila a cada costat, el soroll del sensor mana. Amb massa, les
 * carenes primes s'esborren. Quatre files sobre una graella de 88 són uns 4-5°
 * de camp: prou per damunt del gra i prou per sota d'una carena.
 */
const EDGE_HALF_ROWS = 4;

/**
 * Contrast mínim perquè una columna compti, com a FRACCIÓ del rang dinàmic.
 *
 * Relatiu i no absolut a posta: el fotograma pot venir en 0-1 o en 0-255 segons
 * qui el prepari, i sobretot l'exposició de la càmera canvia sola mentre
 * l'usuari es gira. Mesurar el contrast contra el rang que hi ha a la imatge fa
 * que el llindar signifiqui el mateix a ple sol i a mitja llum.
 */
const MIN_CONTRAST_FRACTION = 0.08;

/** Cada quantes columnes de la graella es mira. Més fi no aporta res. */
const COLUMN_STEP = 2;

/**
 * Busca la silueta del terreny a la imatge.
 *
 * A cada columna es busca la fila on el promig de llum de sobre menys el de
 * sota és màxim: el lloc on el cel s'acaba. Es demana que el salt sigui cap
 * avall —cel clar a dalt, terra fosc a baix— perquè al capvespre això és
 * sempre així i, exigint-ho, els gradients del cel mateix (que van al revés
 * quan el Sol és baix i el cel s'encén per sota) no enganyen ningú.
 *
 * @param gray fotograma en escala de grisos 0-1, de `gridWidth × gridHeight`.
 */
export function detectSkyline(
  gray: Float32Array,
  geometry: TrackerGeometry,
  viewport: { width: number; height: number },
): SkylineHit[] {
  const { gridWidth: w, gridHeight: h } = geometry;
  if (gray.length < w * h || h < 2 * EDGE_HALF_ROWS + 2) return [];

  // Rang dinàmic del fotograma, per fer el llindar relatiu. Es mira una mostra
  // i no tots els píxels: amb quinze mil el percentil surt igual i costa la
  // meitat.
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < w * h; i += 3) {
    const v = gray[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const range = hi - lo;
  if (!(range > 0)) return [];
  const minContrast = range * MIN_CONTRAST_FRACTION;

  const hits: SkylineHit[] = [];
  const halfGridX = w / 2;
  const halfGridY = h / 2;

  for (let gx = 0; gx < w; gx += COLUMN_STEP) {
    let bestRow = -1;
    let bestContrast = 0;

    for (let gy = EDGE_HALF_ROWS; gy < h - EDGE_HALF_ROWS; gy++) {
      let above = 0;
      let below = 0;
      for (let k = 1; k <= EDGE_HALF_ROWS; k++) {
        above += gray[(gy - k) * w + gx];
        below += gray[(gy + k) * w + gx];
      }
      const contrast = (above - below) / EDGE_HALF_ROWS;
      if (contrast > bestContrast) {
        bestContrast = contrast;
        bestRow = gy;
      }
    }

    if (bestRow < 0 || bestContrast < minContrast) continue;

    // Subpíxel per paràbola sobre el contrast dels tres veïns. La silueta
    // d'una carena llunyana cau entre dues files de la graella molt sovint, i
    // sense això l'ajust queda quantitzat a uns 0,5° de pas.
    const c = (row: number): number => {
      let a = 0;
      let b = 0;
      for (let k = 1; k <= EDGE_HALF_ROWS; k++) {
        a += gray[(row - k) * w + gx];
        b += gray[(row + k) * w + gx];
      }
      return (a - b) / EDGE_HALF_ROWS;
    };
    let refined = bestRow;
    if (bestRow > EDGE_HALF_ROWS && bestRow < h - EDGE_HALF_ROWS - 1) {
      const cm = c(bestRow - 1);
      const c0 = bestContrast;
      const cp = c(bestRow + 1);
      const denom = cm - 2 * c0 + cp;
      if (Math.abs(denom) > 1e-9) {
        const delta = (0.5 * (cm - cp)) / denom;
        if (Math.abs(delta) <= 1) refined = bestRow + delta;
      }
    }

    hits.push({
      x: viewport.width / 2 + (gx + 0.5 - halfGridX) * geometry.scaleX,
      y: viewport.height / 2 + (refined + 0.5 - halfGridY) * geometry.scaleY,
      // Normalitzat, perquè el pes de l'ajust i la confiança no depenguin de
      // l'escala en què hagi arribat el fotograma.
      contrast: bestContrast / range,
    });
  }

  return hits;
}

/**
 * On hauria de caure la silueta del terreny, segons el model, a una columna.
 *
 * L'azimut d'un raig depèn de la fila per la qual passa, i l'altura de la
 * carena depèn de l'azimut: és implícit. Es resol iterant, que convergeix en
 * dues o tres voltes perquè la dependència creuada és feble (el perfil canvia
 * poc en la fracció de grau que es mou l'azimut entre iteracions).
 *
 * Torna `NaN` si en aquella columna el terreny no és a la vista.
 */
export function predictSkylineY(
  screenX: number,
  camera: CameraPointing,
  calibration: Calibration,
  viewport: Viewport,
  horizonProfile: (azimuthDeg: number) => number,
  startY?: number,
): number {
  /*
   * LA LLAVOR I LA CONVERGÈNCIA IMPORTEN. Abans es partia sempre del centre de
   * pantalla amb tres voltes i CAP comprovació: si no convergia, l'últim
   * iterat es retornava en silenci — i deixava de convergir justament amb la
   * càmera inclinada, quan l'horitzó és lluny del centre. Aquell valor a
   * mitges entrava a l'ajust com a residu I com a base del jacobià, i l'error
   * resultant era vertical per construcció. Ara es parteix del millor punt
   * que el cridador tingui (la silueta detectada, o la predicció anterior),
   * es fan fins a sis voltes, i si tot i així no convergeix es diu NaN: una
   * columna sense resposta val més que una columna amb la resposta a mitges.
   */
  let y = startY ?? viewport.height / 2;
  for (let i = 0; i < 6; i++) {
    const ray = unprojectFromScreen(screenX, y, camera, calibration, viewport);
    const terrainAlt = horizonProfile(ray.azimuth);
    const projected = projectToScreen(ray.azimuth, terrainAlt, camera, calibration, viewport);
    if (!projected.visible) return Number.NaN;
    if (Math.abs(projected.y - y) < 0.25) {
      return projected.y >= -viewport.height && projected.y <= 2 * viewport.height
        ? projected.y
        : Number.NaN;
    }
    y = projected.y;
  }
  return Number.NaN;
}

/** El que torna l'ancoratge. Tot en graus. */
export interface SkylineFix {
  /** Azimut absolut de la càmera que fa quadrar les dues siluetes. */
  azimuthDeg: number;
  /** Altura absoluta de la càmera, íd. */
  altitudeDeg: number;
  /** Correcció aplicada respecte de la postura d'entrada. */
  deltaAzimuthDeg: number;
  deltaAltitudeDeg: number;
  /** Error quadràtic mitjà residual, en píxels de pantalla. */
  rmsPx: number;
  /** Columnes que han entrat a l'ajust final. */
  used: number;
  /** De 0 a 1. Vegeu `confidenceFrom`. */
  confidence: number;
  /**
   * Cert quan la silueta era plana i només s'ha pogut determinar l'ALTURA.
   * L'azimut retornat és el d'entrada, sense corregir, i `deltaAzimuthDeg` és
   * zero: qui consumeixi el fix no n'ha d'estirar l'azimut ni, sobretot,
   * aprendre'n cap biaix de brúixola — un dAz de zero no vol dir «la brúixola
   * no menteix», vol dir «no ho puc saber».
   */
  altitudeOnly: boolean;
}

/** Correcció màxima que s'accepta d'un sol ajust, en graus. */
const MAX_CORRECTION_DEG = 25;

/** Columnes mínimes per fiar-se'n. Menys és una taca, no una carena. */
const MIN_COLUMNS = 8;

/**
 * Abast horitzontal mínim de la silueta, com a fracció de l'amplada.
 *
 * Vuit columnes juntes en un racó no són una carena: són un arbre, una
 * teulada o un fanal — exactament les coses que el model de terreny nu no té
 * i que per tant només poden ensenyar errors. Una carena de debò travessa el
 * quadre.
 */
const MIN_SPAN_FRACTION = 0.35;

/**
 * Quanta confiança mereix un ajust.
 *
 * Puja amb el nombre de columnes i amb el contrast, i baixa amb el residu. Els
 * pesos no són fins a posta: això només decideix quanta estirada se li dona a
 * la postura, i val més ser conservador que precís.
 */
function confidenceFrom(used: number, rmsPx: number, meanContrast: number): number {
  const byCount = Math.min(1, used / 24);
  const byFit = 1 / (1 + rmsPx / 6);
  const byContrast = Math.min(1, meanContrast / 0.2);
  return Math.max(0, Math.min(1, byCount * byFit * byContrast));
}

/**
 * Ajusta la postura perquè la silueta predita caigui damunt de la detectada.
 *
 * Gauss-Newton sobre dos paràmetres —azimut i altura— amb jacobià per
 * diferències finites damunt de la projecció de debò. El gir de la imatge NO
 * s'ajusta: l'acceleròmetre el dona amb un error de dècimes de grau, que és
 * molt millor del que en trauríem d'aquí, i deixar-lo lliure obriria la porta
 * a compensar un error d'azimut amb una inclinació falsa.
 *
 * Els residus es pesen amb el contrast i es retallen: un núvol amb la vora
 * marcada, una teulada o un fanal donen una columna que no és la carena, i sense
 * retallar-les arrosseguen l'ajust. Es fan dues passades i a la segona només hi
 * entren les columnes que a la primera han quedat a menys de dues vegades el
 * residu típic.
 */
export function fitSkyline(
  hits: readonly SkylineHit[],
  camera: CameraPointing,
  calibration: Calibration,
  viewport: Viewport,
  horizonProfile: (azimuthDeg: number) => number,
): SkylineFix | null {
  if (hits.length < MIN_COLUMNS) return null;

  // Una silueta arraconada no és una carena. Vegeu `MIN_SPAN_FRACTION`.
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (const hit of hits) {
    if (hit.x < minX) minX = hit.x;
    if (hit.x > maxX) maxX = hit.x;
  }
  if (maxX - minX < MIN_SPAN_FRACTION * viewport.width) return null;

  let az = camera.azimuth;
  let alt = camera.altitude;
  let keep = hits.slice();
  let rmsPx = 0;
  let altitudeOnly = false;
  const h = 0.05; // pas del jacobià, en graus

  for (let pass = 0; pass < 2; pass++) {
    for (let iter = 0; iter < 4; iter++) {
      const pose = { ...camera, azimuth: az, altitude: alt };
      const posePlusAz = { ...pose, azimuth: az + h };
      const posePlusAlt = { ...pose, altitude: alt + h };

      // Sistema normal 2×2, pesat.
      let a11 = 0;
      let a12 = 0;
      let a22 = 0;
      let b1 = 0;
      let b2 = 0;
      let used = 0;
      let sumSq = 0;

      for (const hit of keep) {
        // La predicció es llavora amb la silueta DETECTADA, i el jacobià amb
        // la predicció que acaba de sortir: és on la solució és, no el centre
        // de pantalla. Amb la càmera inclinada, la diferència entre les dues
        // llavors era columnes que no convergien — i abans ni ho deien.
        const y0 = predictSkylineY(hit.x, pose, calibration, viewport, horizonProfile, hit.y);
        if (!Number.isFinite(y0)) continue;
        const yAz = predictSkylineY(hit.x, posePlusAz, calibration, viewport, horizonProfile, y0);
        const yAlt = predictSkylineY(
          hit.x,
          posePlusAlt,
          calibration,
          viewport,
          horizonProfile,
          y0,
        );
        if (!Number.isFinite(yAz) || !Number.isFinite(yAlt)) continue;

        const jAz = (yAz - y0) / h;
        const jAlt = (yAlt - y0) / h;
        const r = hit.y - y0;
        const w = hit.contrast;

        a11 += w * jAz * jAz;
        a12 += w * jAz * jAlt;
        a22 += w * jAlt * jAlt;
        b1 += w * jAz * r;
        b2 += w * jAlt * r;
        sumSq += r * r;
        used++;
      }

      if (used < MIN_COLUMNS) return null;
      rmsPx = Math.sqrt(sumSq / used);

      const det = a11 * a22 - a12 * a12;
      if (!Number.isFinite(det)) return null;

      /*
       * Mal condicionat: totes les columnes tenen la mateixa sensibilitat als
       * dos eixos — la silueta és una línia horitzontal. Girar en azimut no
       * canvia la imatge i l'azimut NO es pot determinar; l'ALTURA sí, i és
       * exactament la meitat que encara val la pena: mar, plana, un altiplà.
       * Abans es llençava tot; ara es resol el sistema d'una incògnita i el
       * fix surt marcat `altitudeOnly` perquè ningú no n'estiri l'azimut.
       */
      if (a11 < 1e-4 * a22 || Math.abs(det) < 1e-6 * a11 * a22) {
        if (!(a22 > 0)) return null;
        altitudeOnly = true;
        const dAlt = b2 / a22;
        if (!Number.isFinite(dAlt)) return null;
        alt = alt + dAlt;
        if (Math.abs(dAlt) < 0.01) break;
        continue;
      }

      const dAz = (b1 * a22 - b2 * a12) / det;
      const dAlt = (a11 * b2 - a12 * b1) / det;
      if (!Number.isFinite(dAz) || !Number.isFinite(dAlt)) return null;

      az = normalizeAngle(az + dAz);
      alt = alt + dAlt;

      if (Math.hypot(dAz, dAlt) < 0.01) break;
    }

    if (pass === 0) {
      // Retall: fora les columnes que no s'expliquen.
      const pose = { ...camera, azimuth: az, altitude: alt };
      const limit = Math.max(3, 2 * rmsPx);
      keep = hits.filter((hit) => {
        const y = predictSkylineY(hit.x, pose, calibration, viewport, horizonProfile, hit.y);
        return Number.isFinite(y) && Math.abs(hit.y - y) <= limit;
      });
      if (keep.length < MIN_COLUMNS) return null;
    }
  }

  // Si en qualsevol volta l'azimut ha estat indeterminable, la correcció
  // parcial que pogués portar no és de fiar: es descarta sencera.
  if (altitudeOnly) az = camera.azimuth;

  const deltaAz = normalizeAngle(az - camera.azimuth);
  const deltaAlt = alt - camera.altitude;
  // Una correcció enorme vol dir que s'ha aparellat una carena amb una altra:
  // ni s'aplica ni es diu res. El sistema es queda amb el que ja tenia.
  if (Math.abs(deltaAz) > MAX_CORRECTION_DEG || Math.abs(deltaAlt) > MAX_CORRECTION_DEG) {
    return null;
  }

  const meanContrast = keep.reduce((sum, hit) => sum + hit.contrast, 0) / keep.length;

  return {
    azimuthDeg: az,
    altitudeDeg: alt,
    deltaAzimuthDeg: deltaAz,
    deltaAltitudeDeg: deltaAlt,
    rmsPx,
    used: keep.length,
    confidence: confidenceFrom(keep.length, rmsPx, meanContrast),
    altitudeOnly,
  };
}
