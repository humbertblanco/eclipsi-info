/**
 * Ancorar la superposició al SOL DE DEBÒ (o a la Lluna, de nit).
 *
 * ── PER QUÈ ─────────────────────────────────────────────────────────────────
 *
 * L'ancoratge a la silueta del terreny (`skyline.ts`) va donar a l'app una
 * mesura absoluta — però depèn que hi hagi una carena a la vista i que el
 * model del terreny se li assembli. Hi ha un segon far, i és justament
 * L'OBJECTE QUE VOLEM ENCERTAR: el Sol. Sabem on és amb precisió de segons
 * d'arc (efemèrides + rellotge + ubicació — sempre l'instant REAL, mai el del
 * control lliscant del simulador), i a la imatge és inconfusible: la taca que
 * satura el sensor. Si la taca no cau on la projecció diu, l'error és del
 * sensor, i és exactament el que el biaix de la fusió vol aprendre.
 *
 * Els dos fars es complementen al mil·límetre: la silueta falla apuntant al
 * cel ras (que és quan el Sol hi és), el Sol falla darrere d'un núvol (que és
 * quan la carena es veu retallada). I als eclipsis d'aquesta app el Sol va
 * ARRAN d'horitzó: el cas normal és tenir TOTS DOS al mateix quadre — per
 * això no es tria, es FUSIONA (`mergeAnchors`).
 *
 * És el calibratge automàtic cap on apuntava la decisió d'ESTAT.md §5 («la
 * càmera no es calibra tocant el Sol»): no demana res a ningú, i cap text
 * d'aquest mòdul no ha de convidar mai a MIRAR el Sol.
 *
 * ── COM ES DETECTA SENSE ENGANYAR-SE ────────────────────────────────────────
 *
 * El disc solar fa 0,53°: poc més d'UN píxel de la graella reduïda. El que es
 * detecta no és el disc, és el BLOOM de sobreexposició. Tot és RELATIU al
 * rang dinàmic del fotograma (l'escala de `lastGray` és deliberadament
 * inespecífica, i cap navegador diu res de l'exposició): el que separa el Sol
 * d'un núvol brillant no és un llindar absolut, és la FORMA — compacte i
 * dominant — i les portes d'efemèrides. Les trampes conegudes, de la
 * literatura de visió en automoció i aeronàutica, i com s'esquiven:
 *
 *   · REFLEXOS DE LENT (fantasmes): còpies del Sol alineades amb el centre
 *     òptic, a l'altra banda. Es reconeixen per geometria — col·linears amb
 *     el primari a través del centre — i llavors NO compten com a ambigüitat.
 *   · RATLLES I VELES: un reflex allargat no és compacte; es poda per
 *     compacitat, com fan els detectors de flare seriosos.
 *   · FANALS I REFLEXOS: el cos ha de ser SOBRE l'horitzó del terreny i a
 *     prop d'on les efemèrides el posen (±25° de brúixola, ±3° d'altura).
 *   · EL CREIXENT DE L'ECLIPSI: durant la parcialitat el centre de LLUM no és
 *     el centre del DISC — es desplaça fugint de la Lluna. Es corregeix amb
 *     la mateixa geometria d'anells amb enfosquiment de vora que ja calcula
 *     el flux (`core/sky/solarDisc`), i prop de la totalitat la confiança
 *     s'apaga sola via el FLUX: no hi ha taca, i tampoc no cal — el paisatge
 *     fosc és el moment daurat de la silueta.
 *
 * Nucli sense DOM (es prova amb escenes sintètiques); només `SunRefiner`
 * toca el vídeo, per refinar el centroide a resolució plena (~0,05°).
 */

import type { TrackerGeometry } from './visualTracker';
import { gridToScreen } from './visualTracker';
import type { Viewport } from './cameraGeometry';
import type { CameraPointing, Calibration } from './orientation';
import { unprojectFromScreen, normalizeAngle } from './orientation';
import { normalizeDelta } from './poseFusion';
import type { SkylineFix } from './skyline';
import type { EclipseSample, SkyPosition } from '../../core/astro/types';
import {
  intensityAtRadiusFraction,
  ringCoveredFraction,
  uncoveredLuminousFraction,
} from '../../core/sky/solarDisc';

const DEG = Math.PI / 180;

/**
 * Fracció del MÀXIM del fotograma a partir de la qual un píxel és candidat.
 *
 * Relatiu i no absolut a posta, com tot en aquest fitxer: el bloom del Sol
 * és el sostre del rang, sigui quin sigui el rang. Quan el Sol no hi és, el
 * que quedi per sobre del llindar (el sostre d'un núvol, una paret clara) és
 * difús i el maten la compacitat i les portes d'efemèrides.
 */
const SUN_SATURATION_FRACTION = 0.97;

/**
 * Àrea màxima del blob, en píxels de graella.
 *
 * El bloom del Sol són uns quants píxels; vuitanta són més de 4° de cel
 * cremat: allò no és el Sol, és un cel sobreexposat sencer i no s'hi pot
 * clavar cap centroide.
 */
const MAX_BLOB_AREA_PX = 80;

/** Píxels mínims perquè el blob no sigui un píxel calent solitari. */
const MIN_BLOB_AREA_PX = 2;

/**
 * Compacitat mínima: àrea del blob dividida per l'àrea del cercle circumscrit.
 *
 * El bloom del Sol és rodó; una ratlla de reflex o una vela de flare no ho
 * són. És la poda per circularitat dels detectors de flare, en barat.
 */
const MIN_COMPACTNESS = 0.45;

/** Un segon blob amb més d'aquesta fracció de la llum del primer fa nosa. */
const GHOST_DOMINANCE = 0.6;

/**
 * Cosinus mínim de la col·linearitat perquè el segon blob compti com a
 * FANTASMA: els reflexos de lent cauen sobre la recta que uneix el Sol amb el
 * centre òptic, a l'altra banda.
 */
const GHOST_COLLINEARITY_COS = 0.94;

/** Correcció màxima que un fix de Sol pot afirmar, en graus. Com l'skyline. */
const MAX_SUN_CORRECTION_AZ_DEG = 25;
/** I la d'altura, com `MAX_PLAUSIBLE_ALT_DEG`: més enllà no és la brúixola. */
const MAX_SUN_CORRECTION_ALT_DEG = 3;

/** Sota aquesta altura de les efemèrides no es busca el cos: no hi és. */
const MIN_BODY_ALTITUDE_DEG = -1;

/**
 * Marge sota l'horitzó del TERRENY, en graus: si el model diu que la carena
 * tapa el Sol, la taca que hi hagi és un fanal o un reflex, no el Sol.
 */
const TERRAIN_MARGIN_DEG = 0.3;

/** Per sota d'aquest flux del creixent no queda taca a què fiar-se. */
const MIN_FLUX_FRACTION = 0.02;

/** Flux a partir del qual la confiança per eclipsi és plena. */
const FLUX_FULL_CONFIDENCE = 0.15;

export interface SunBlob {
  /** Centroide ponderat per intensitat, en píxels de PANTALLA. */
  screenX: number;
  screenY: number;
  /** Àrea del blob, en píxels de graella. */
  areaPx: number;
  /** Valor màxim del blob, a l'escala del fotograma. */
  peak: number;
  /** Àrea / àrea del cercle circumscrit, de 0 a 1. */
  compactness: number;
  /** Cert si hi havia un rival prou brillant que NO era un fantasma de lent. */
  ambiguous: boolean;
}

/**
 * Memòria TEMPORAL del biaix que el Sol acaba de mesurar al sensor.
 *
 * No segueix píxels: quan el telèfon gira, el Sol pot travessar tota la
 * pantalla entre fotogrames i una memòria de (x,y) queda vella de seguida.
 * El que sí que és gairebé constant és el residual angular entre la postura
 * del sensor i la que demostra el cos conegut. Reprojectar el cos amb aquest
 * residual dona una pista bona fins i tot amb roll, canvi d'orientació i un
 * gest ràpid.
 *
 * És deliberadament només una GUIA per triar entre candidats: mai fabrica un
 * fix, mai conserva una àncora durant una ocultació i mai evita la cerca
 * global. Calen tres fixes concordants abans que pugui parlar; si calla,
 * l'algoritme és exactament el d'abans.
 */
export class SunTemporalGuide {
  private deltaAzDeg = 0;
  private deltaAltDeg = 0;
  private lastAtMs = 0;
  private confirmations = 0;

  /** La guia caduca de pressa: darrere d'un núvol mana de nou l'efemèride. */
  private static readonly MAX_AGE_MS = 650;
  /** Un salt més gran no és soroll temporal: és candidat nou o sensor canviat. */
  private static readonly MAX_INNOVATION_DEG = 1.5;
  /** Tres fotogrames (~100 ms) impedeixen que una primera falsa taca creï lock. */
  private static readonly MIN_CONFIRMATIONS = 3;
  /** Un candidat ambigu queda a ≤0,5 a `fitSunFix`: no pot ensenyar la guia. */
  private static readonly MIN_FIX_CONFIDENCE = 0.6;
  /** EMA conservadora: el residual és lent, però la brúixola encara pot variar. */
  private static readonly ALPHA = 0.35;

  reset(): void {
    this.deltaAzDeg = 0;
    this.deltaAltDeg = 0;
    this.lastAtMs = 0;
    this.confirmations = 0;
  }

  observe(fix: SkylineFix | null, atMs: number): void {
    if (
      fix === null ||
      fix.altitudeOnly ||
      fix.confidence < SunTemporalGuide.MIN_FIX_CONFIDENCE ||
      !Number.isFinite(atMs) ||
      (this.lastAtMs > 0 && atMs <= this.lastAtMs)
    ) {
      return;
    }

    if (this.confirmations === 0 || atMs - this.lastAtMs > SunTemporalGuide.MAX_AGE_MS) {
      this.deltaAzDeg = fix.deltaAzimuthDeg;
      this.deltaAltDeg = fix.deltaAltitudeDeg;
      this.confirmations = 1;
      this.lastAtMs = atMs;
      return;
    }

    const innovationAz = normalizeDelta(fix.deltaAzimuthDeg - this.deltaAzDeg);
    const innovationAlt = fix.deltaAltitudeDeg - this.deltaAltDeg;
    const innovation = Math.hypot(innovationAz, innovationAlt);
    if (innovation > SunTemporalGuide.MAX_INNOVATION_DEG) {
      // No arrosseguem el lock vell cap al candidat nou. Aquest passa a ser
      // una adquisició fresca i haurà de confirmar-se com les altres.
      this.deltaAzDeg = fix.deltaAzimuthDeg;
      this.deltaAltDeg = fix.deltaAltitudeDeg;
      this.confirmations = 1;
      this.lastAtMs = atMs;
      return;
    }

    const alpha = SunTemporalGuide.ALPHA;
    this.deltaAzDeg = normalizeDelta(this.deltaAzDeg + alpha * innovationAz);
    this.deltaAltDeg += alpha * innovationAlt;
    this.confirmations = Math.min(SunTemporalGuide.MIN_CONFIRMATIONS, this.confirmations + 1);
    this.lastAtMs = atMs;
  }

  /** Postura corregida amb què projectar el cos; null preserva el camí antic. */
  correctedCamera(camera: CameraPointing, atMs: number): CameraPointing | null {
    if (
      this.confirmations < SunTemporalGuide.MIN_CONFIRMATIONS ||
      !Number.isFinite(atMs) ||
      atMs < this.lastAtMs ||
      atMs - this.lastAtMs > SunTemporalGuide.MAX_AGE_MS
    ) {
      return null;
    }
    return {
      ...camera,
      azimuth: normalizeAngle(camera.azimuth + this.deltaAzDeg),
      altitude: camera.altitude + this.deltaAltDeg,
    };
  }
}

interface RawBlob {
  area: number;
  sumI: number;
  sumXI: number;
  sumYI: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  peak: number;
}

/**
 * Busca la taca del Sol al fotograma reduït.
 *
 * @param predictedScreen on la projecció diu que hauria de ser, en píxels de
 *   pantalla, o null si no es vol fer servir la predicció. Amb dos candidats
 *   semblants i predicció, guanya el més proper; sense predicció, dos
 *   candidats semblants no-fantasma són irresolubles i es retorna null: val
 *   més callar que clavar l'overlay a un fanal.
 */
export function detectSunBlob(
  gray: Float32Array,
  geometry: TrackerGeometry,
  viewport: { width: number; height: number },
  predictedScreen: { x: number; y: number } | null,
): SunBlob | null {
  const { gridWidth: w, gridHeight: h } = geometry;
  const n = w * h;
  if (gray.length < n) return null;

  let peak = -Infinity;
  let lo = Infinity;
  for (let i = 0; i < n; i++) {
    const v = gray[i];
    if (v > peak) peak = v;
    if (v < lo) lo = v;
  }
  // Sense rang dinàmic no hi ha res a detectar (paret uniforme, tapa posada).
  if (!(peak - lo > 1e-6)) return null;

  const threshold = peak * SUN_SATURATION_FRACTION;

  // Components connexes dels píxels candidats, per inundació amb pila.
  const visited = new Uint8Array(n);
  const stack: number[] = [];
  const blobs: RawBlob[] = [];

  for (let start = 0; start < n; start++) {
    if (visited[start] || gray[start] < threshold) continue;

    const blob: RawBlob = {
      area: 0,
      sumI: 0,
      sumXI: 0,
      sumYI: 0,
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      peak: 0,
    };
    stack.length = 0;
    stack.push(start);
    visited[start] = 1;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % w;
      const y = (idx / w) | 0;
      const v = gray[idx];
      // El pes és l'EXCÉS sobre el llindar, no el valor: els píxels que tot
      // just hi arriben gairebé no voten, i el centroide queda subpíxel en
      // comptes de quantitzat al contorn de la regió retallada.
      const weight = v - threshold + 1e-6;

      blob.area++;
      blob.sumI += weight;
      blob.sumXI += x * weight;
      blob.sumYI += y * weight;
      if (x < blob.minX) blob.minX = x;
      if (x > blob.maxX) blob.maxX = x;
      if (y < blob.minY) blob.minY = y;
      if (y > blob.maxY) blob.maxY = y;
      if (v > blob.peak) blob.peak = v;

      // Veïnat de 4: per a blobs de bloom no cal el de 8.
      if (x > 0 && !visited[idx - 1] && gray[idx - 1] >= threshold) {
        visited[idx - 1] = 1;
        stack.push(idx - 1);
      }
      if (x < w - 1 && !visited[idx + 1] && gray[idx + 1] >= threshold) {
        visited[idx + 1] = 1;
        stack.push(idx + 1);
      }
      if (y > 0 && !visited[idx - w] && gray[idx - w] >= threshold) {
        visited[idx - w] = 1;
        stack.push(idx - w);
      }
      if (y < h - 1 && !visited[idx + w] && gray[idx + w] >= threshold) {
        visited[idx + w] = 1;
        stack.push(idx + w);
      }
    }

    blobs.push(blob);
  }

  // Poda: mida i compacitat. Vegeu les constants.
  const valid = blobs.filter((b) => {
    if (b.area > MAX_BLOB_AREA_PX) return false;
    return blobCompactness(b) >= MIN_COMPACTNESS;
  });
  if (valid.length === 0) return null;

  valid.sort((a, b) => b.sumI - a.sumI);

  // Tria del principal: el més proper a la predicció si n'hi ha; si no, el
  // més lluminós.
  let best = valid[0];
  if (predictedScreen !== null && valid.length > 1) {
    let bestDist = Infinity;
    for (const b of valid) {
      const c = blobScreenCenter(b, geometry, viewport);
      const dist = Math.hypot(c.x - predictedScreen.x, c.y - predictedScreen.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = b;
      }
    }
  }

  // Ambigüitat i fantasmes. El rival és el blob més lluminós que no és el triat.
  let ambiguous = false;
  const rival = valid.find((b) => b !== best);
  if (rival && rival.sumI >= GHOST_DOMINANCE * best.sumI) {
    const cx = (geometry.gridWidth - 1) / 2;
    const cy = (geometry.gridHeight - 1) / 2;
    const bestX = best.sumXI / best.sumI;
    const bestY = best.sumYI / best.sumI;
    const rivalX = rival.sumXI / rival.sumI;
    const rivalY = rival.sumYI / rival.sumI;
    const toCenterX = cx - bestX;
    const toCenterY = cy - bestY;
    const pastCenterX = rivalX - cx;
    const pastCenterY = rivalY - cy;
    const dot = toCenterX * pastCenterX + toCenterY * pastCenterY;
    const norms = Math.hypot(toCenterX, toCenterY) * Math.hypot(pastCenterX, pastCenterY);
    const collinear = norms > 1e-9 && dot / norms >= GHOST_COLLINEARITY_COS;

    if (!collinear) {
      // No és un fantasma: és un rival de debò. Amb predicció, el triat mana
      // amb dubte; sense, no hi ha manera de saber quin és el Sol.
      if (predictedScreen === null) return null;
      ambiguous = true;
    }
  }

  const center = blobScreenCenter(best, geometry, viewport);

  return {
    screenX: center.x,
    screenY: center.y,
    areaPx: best.area,
    peak: best.peak,
    compactness: blobCompactness(best),
    ambiguous,
  };
}

/**
 * Àrea del blob respecte del cercle que ocupa el seu costat llarg: un disc
 * ple dona 1, una ratlla de reflex s'enfonsa. Normalitzat així perquè el
 * llindar tingui un significat geomètric net.
 */
function blobCompactness(b: RawBlob): number {
  const bw = b.maxX - b.minX + 1;
  const bh = b.maxY - b.minY + 1;
  const radius = Math.max(bw, bh) / 2;
  return Math.min(1, b.area / Math.max(1, Math.PI * radius * radius));
}

function blobScreenCenter(
  blob: RawBlob,
  geometry: TrackerGeometry,
  viewport: { width: number; height: number },
): { x: number; y: number } {
  return gridToScreen(blob.sumXI / blob.sumI, blob.sumYI / blob.sumI, geometry, viewport);
}

/**
 * Desplaçament del CENTRE DE LLUM del creixent respecte del centre del disc
 * solar, en graus de cel, durant la parcialitat.
 *
 * La Lluna es menja un costat del disc: el que queda de llum té el centroide
 * desplaçat CAP A L'ALTRE COSTAT, sobre l'eix que uneix els dos centres. La
 * càmera veu el centroide de llum, no el centre geomètric — sense aquesta
 * correcció, el fix aniria estirant l'overlay cap al costat brillant a mesura
 * que l'eclipsi avança (fins a un quart de grau: mig diàmetre solar de dansa).
 *
 * Es calcula amb la mateixa integració d'anells amb enfosquiment de vora que
 * fa servir el flux (`core/sky/solarDisc`): per a cada anell, l'arc no cobert
 * té el centroide a −2·sin(φ)/(2π−2φ) del centre (φ = semiamplada de l'arc
 * cobert, centrat en la direcció de la Lluna).
 */
export function crescentCentroidOffsetDeg(
  sample: EclipseSample,
): { dAzDeg: number; dAltDeg: number } {
  const rs = sample.sun.angularRadius;
  const rm = sample.moon.angularRadius;
  const d = sample.separation;
  if (!(rs > 0) || d >= rs + rm) return { dAzDeg: 0, dAltDeg: 0 };
  // Totalitat: no queda llum amb costat preferit.
  if (rm >= rs && d <= rm - rs) return { dAzDeg: 0, dAltDeg: 0 };

  const dU = d / rs;
  const mU = rm / rs;
  const STEPS = 240;

  let sumW = 0;
  let sumWX = 0;
  for (let i = 0; i < STEPS; i++) {
    const x = (i + 0.5) / STEPS;
    const coveredFraction = ringCoveredFraction(x, dU, mU);
    if (coveredFraction >= 1) continue;
    const phi = coveredFraction * Math.PI;
    const uncoveredRad = 2 * (Math.PI - phi);
    const weight = intensityAtRadiusFraction(x) * x * uncoveredRad;
    // Mitjana de cos(θ) sobre l'arc no cobert [φ, 2π−φ], amb θ = 0 mirant la
    // Lluna: ∫cosθ dθ = −2·sin(φ). Negativa = fugint de la Lluna, com toca.
    const meanX = uncoveredRad > 1e-9 ? (-2 * Math.sin(phi)) / uncoveredRad : 0;
    sumW += weight;
    sumWX += weight * x * meanX;
  }
  if (!(sumW > 0)) return { dAzDeg: 0, dAltDeg: 0 };

  const offsetDeg = (sumWX / sumW) * rs; // negatiu = fugint de la Lluna

  // Direcció Sol→Lluna al cel, en el pla local (azimut escalat per cos alt).
  const cosAlt = Math.max(0.2, Math.cos(sample.sun.altitudeApparent * DEG));
  const axX = normalizeDelta(sample.moon.azimuth - sample.sun.azimuth) * cosAlt;
  const axY = sample.moon.altitudeApparent - sample.sun.altitudeApparent;
  const axLen = Math.hypot(axX, axY);
  if (axLen < 1e-9) return { dAzDeg: 0, dAltDeg: 0 };

  return {
    dAzDeg: ((axX / axLen) * offsetDeg) / cosAlt,
    dAltDeg: (axY / axLen) * offsetDeg,
  };
}

/**
 * Converteix una taca en un fix absolut de postura, pels mateixos raïls que
 * els fixos de silueta.
 *
 * Forma general: serveix per a qualsevol cos brillant. `centroidOffset` és el
 * desplaçament esperat del centre de llum respecte del centre del disc (el
 * creixent d'un eclipsi), i `fluxFraction` apaga la confiança quan del cos en
 * queda massa poc per fiar-se'n (1 = cos sencer).
 */
export function fitSunFix(
  blob: SunBlob,
  body: SkyPosition,
  camera: CameraPointing,
  calibration: Calibration,
  viewport: Viewport,
  centroidOffset: { dAzDeg: number; dAltDeg: number } = { dAzDeg: 0, dAltDeg: 0 },
  fluxFraction = 1,
  horizonProfile?: ((azimuthDeg: number) => number) | null,
): SkylineFix | null {
  if (blob.areaPx < MIN_BLOB_AREA_PX) return null;
  if (body.altitudeApparent < MIN_BODY_ALTITUDE_DEG) return null;
  if (fluxFraction < MIN_FLUX_FRACTION) return null;

  // Si el model del terreny diu que la carena tapa el cos, la taca és una
  // altra cosa. (L'àncora de Sol funciona SENSE perfil — mar, plana, perfil
  // encara baixant-se — i aquesta és la seva gràcia respecte de la silueta.)
  if (horizonProfile && body.altitudeApparent < horizonProfile(body.azimuth) - TERRAIN_MARGIN_DEG) {
    return null;
  }

  const ray = unprojectFromScreen(blob.screenX, blob.screenY, camera, calibration, viewport);

  // El que la càmera veu és el CENTRE DE LLUM; el centre del disc n'està a
  // −offset. La comparació es fa centre contra centre.
  const blobDiscAz = ray.azimuth - centroidOffset.dAzDeg;
  const blobDiscAlt = ray.altitude - centroidOffset.dAltDeg;

  const deltaAz = normalizeDelta(body.azimuth - blobDiscAz);
  const deltaAlt = body.altitudeApparent - blobDiscAlt;

  // Portes de plausibilitat, asimètriques com sempre: la brúixola es pot
  // equivocar 25°; l'acceleròmetre no pot anar 3° errat. Més enllà, allò no
  // era el Sol.
  if (Math.abs(deltaAz) > MAX_SUN_CORRECTION_AZ_DEG) return null;
  if (Math.abs(deltaAlt) > MAX_SUN_CORRECTION_ALT_DEG) return null;

  /*
   * Confiança: mida raonable del bloom (2 px pot ser soroll; 4+ és un Sol),
   * compacitat (rodó), dubte per rival (meitat), i el flux del creixent —
   * quan la Lluna s'ho ha menjat gairebé tot, la taca que queda és prima i el
   * centroide corregit és cada cop més incert. Per sota del 2% de flux ja
   * s'ha retornat null: a tocar de la totalitat el far s'apaga, i tant és —
   * el paisatge fosc és el moment daurat de la silueta.
   */
  const bySize = Math.min(1, blob.areaPx / 4);
  const byShape = Math.max(0, Math.min(1, blob.compactness / 0.7));
  const byDoubt = blob.ambiguous ? 0.5 : 1;
  const byFlux = Math.max(0, Math.min(1, fluxFraction / FLUX_FULL_CONFIDENCE));
  const confidence = Math.max(0, Math.min(1, bySize * byShape * byDoubt * byFlux));
  if (confidence <= 0) return null;

  return {
    azimuthDeg: normalizeAngle(camera.azimuth + deltaAz),
    altitudeDeg: camera.altitude + deltaAlt,
    deltaAzimuthDeg: deltaAz,
    deltaAltitudeDeg: deltaAlt,
    rmsPx: 1,
    used: blob.areaPx,
    confidence,
    altitudeOnly: false,
  };
}

/**
 * El camí complet per al SOL: creixent i flux calculats de la mostra
 * d'efemèrides EN TEMPS REAL. És el que crida ARView a cada tick d'àncora.
 */
export function sunFixFrom(
  blob: SunBlob | null,
  camera: CameraPointing,
  calibration: Calibration,
  viewport: Viewport,
  sample: EclipseSample,
  horizonProfile?: ((azimuthDeg: number) => number) | null,
): SkylineFix | null {
  if (blob === null) return null;
  const flux = uncoveredLuminousFraction(
    sample.separation,
    sample.sun.angularRadius,
    sample.moon.angularRadius,
  );
  return fitSunFix(
    blob,
    sample.sun,
    camera,
    calibration,
    viewport,
    crescentCentroidOffsetDeg(sample),
    flux,
    horizonProfile,
  );
}

/**
 * Quin cos s'espera veure ara: el Sol si és amunt; si no, la Lluna (assajos
 * nocturns abans de l'eclipsi — la fase lunar no es modela: mig radi lunar
 * d'error de centroide en quarts, acceptable per assajar). Null si cap dels
 * dos és sobre l'horitzó.
 */
export function expectedBrightBody(
  sample: EclipseSample,
): { body: SkyPosition; kind: 'sun' | 'moon' } | null {
  if (sample.sun.altitudeApparent > MIN_BODY_ALTITUDE_DEG) {
    return { body: sample.sun, kind: 'sun' };
  }
  if (sample.moon.altitudeApparent > MIN_BODY_ALTITUDE_DEG) {
    return { body: sample.moon, kind: 'moon' };
  }
  return null;
}

/**
 * Fusiona el fix de Sol i el de silueta quan tots dos hi són.
 *
 * Als eclipsis d'aquesta app el Sol va arran d'horitzó: el cas normal és
 * tenir TOTS DOS fars al mateix quadre. Triar-ne un seria llençar informació;
 * es fusionen ponderats per confiança — amb el matís que l'azimut d'un fix
 * només-altura no vota, perquè és inventat.
 *
 * Si els dos fars DISCREPEN més de dos graus, alguna cosa és falsa (una taca
 * que no era el Sol, una carena equivocada): la fusió es queda amb el més
 * confiat però amb la confiança tocada, perquè l'estirada sigui prudent.
 */
export function mergeAnchors(
  sun: SkylineFix | null,
  skyline: SkylineFix | null,
): SkylineFix | null {
  if (sun === null && skyline === null) return null;
  if (sun === null) return skyline;
  if (skyline === null) return sun;
  if (sun.confidence <= 0) return skyline;
  if (skyline.confidence <= 0) return sun;

  // L'azimut d'un fix només-altura és el d'entrada, inventat: ni vota a la
  // fusió ni pot fer saltar l'alarma de discrepància.
  const cosAlt = Math.max(0.2, Math.cos(sun.altitudeDeg * DEG));
  const disagreementDeg = Math.hypot(
    skyline.altitudeOnly ? 0 : normalizeDelta(sun.azimuthDeg - skyline.azimuthDeg) * cosAlt,
    sun.altitudeDeg - skyline.altitudeDeg,
  );
  if (disagreementDeg > 2) {
    const winner = sun.confidence >= skyline.confidence ? sun : skyline;
    return { ...winner, confidence: winner.confidence * 0.6 };
  }

  const wSun = sun.confidence;
  const wSkyAlt = skyline.confidence;
  const wSkyAz = skyline.altitudeOnly ? 0 : skyline.confidence;

  const azTotal = wSun + wSkyAz;
  const azimuthDeg = normalizeAngle(
    sun.azimuthDeg + (wSkyAz / azTotal) * normalizeDelta(skyline.azimuthDeg - sun.azimuthDeg),
  );
  const altitudeDeg =
    (sun.altitudeDeg * wSun + skyline.altitudeDeg * wSkyAlt) / (wSun + wSkyAlt);

  // Dues mesures independents que coincideixen valen més que qualsevol de
  // les dues soles — però mai més que 1, i el premi és moderat.
  const confidence = Math.min(1, Math.max(wSun, wSkyAlt) + 0.25 * Math.min(wSun, wSkyAlt));

  return {
    azimuthDeg,
    altitudeDeg,
    deltaAzimuthDeg:
      (sun.deltaAzimuthDeg * wSun +
        (skyline.altitudeOnly ? 0 : skyline.deltaAzimuthDeg) * wSkyAz) /
      Math.max(1e-9, azTotal),
    deltaAltitudeDeg:
      (sun.deltaAltitudeDeg * wSun + skyline.deltaAltitudeDeg * wSkyAlt) / (wSun + wSkyAlt),
    rmsPx: Math.min(sun.rmsPx, skyline.rmsPx),
    used: sun.used + skyline.used,
    confidence,
    altitudeOnly: false,
  };
}

/**
 * Refinament del centroide a RESOLUCIÓ PLENA de vídeo.
 *
 * La graella reduïda dona ~0,48°/px: prou per trobar el Sol, just per
 * clavar-lo. Un retall de 9 arguments de `drawImage` al voltant del candidat
 * treballa a ~0,04°/px i deixa el centroide a ~0,05°: la mateixa lliga que
 * l'ancoratge de silueta. El canvas es reutilitza; el cost (~40k píxels a
 * 10 Hz) és negligible. A l'ultra-angular (1,2°/px de graella) és on més
 * es nota.
 *
 * DOM a dins: no es prova al banc (el banc prova el nucli, `detectSunBlob`).
 */
export class SunRefiner {
  private canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  /** Costat del retall de treball, en píxels. */
  private static readonly CROP_SIDE = 96;
  /** Mig camp del retall, en graus: ±2° cobreixen el bloom i el marge. */
  private static readonly CROP_HALF_DEG = 2;

  refine(
    video: HTMLVideoElement,
    coarseScreen: { x: number; y: number },
    viewport: Viewport,
  ): { x: number; y: number; peak: number } | null {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw <= 0 || vh <= 0) return null;

    const cover = Math.max(viewport.width / vw, viewport.height / vh);
    if (!(cover > 0)) return null;

    // Pantalla → vídeo, i la mida del retall en píxels de vídeo.
    const videoX = vw / 2 + (coarseScreen.x - viewport.width / 2) / cover;
    const videoY = vh / 2 + (coarseScreen.y - viewport.height / 2) / cover;
    const halfSpanVideoPx =
      (Math.tan(SunRefiner.CROP_HALF_DEG * DEG) * viewport.focalPx) / cover;
    const side = Math.max(16, Math.round(2 * halfSpanVideoPx));
    if (side > Math.min(vw, vh)) return null;

    const sx = Math.max(0, Math.min(vw - side, Math.round(videoX - side / 2)));
    const sy = Math.max(0, Math.min(vh - side, Math.round(videoY - side / 2)));

    const S = SunRefiner.CROP_SIDE;
    if (!this.canvas) {
      this.canvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(S, S)
          : Object.assign(document.createElement('canvas'), { width: S, height: S });
      const ctx = this.canvas.getContext('2d', { willReadFrequently: true }) as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      this.ctx = ctx;
    }
    const ctx = this.ctx;
    if (!ctx) return null;

    ctx.drawImage(video, sx, sy, side, side, 0, 0, S, S);
    const data = ctx.getImageData(0, 0, S, S).data;

    // Màxim del retall i centroide dels píxels del seu sostre.
    let peak = 0;
    for (let i = 0; i < data.length; i += 4) {
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (luma > peak) peak = luma;
    }
    if (!(peak > 0)) return null;
    const threshold = peak * SUN_SATURATION_FRACTION;

    let sumI = 0;
    let sumXI = 0;
    let sumYI = 0;
    for (let p = 0, i = 0; p < S * S; p++, i += 4) {
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (luma < threshold) continue;
      // Pes per excés sobre el llindar: subpíxel, com al detector coarse.
      const weight = luma - threshold + 1e-6;
      const x = p % S;
      const y = (p / S) | 0;
      sumI += weight;
      sumXI += x * weight;
      sumYI += y * weight;
    }
    if (!(sumI > 0)) return null;

    // Retall → vídeo → pantalla.
    const refinedVideoX = sx + ((sumXI / sumI + 0.5) * side) / S;
    const refinedVideoY = sy + ((sumYI / sumI + 0.5) * side) / S;
    return {
      x: viewport.width / 2 + (refinedVideoX - vw / 2) * cover,
      y: viewport.height / 2 + (refinedVideoY - vh / 2) * cover,
      peak,
    };
  }
}

/**
 * Si el refinament és de fiar: el pic del retall a resolució plena ha de ser
 * COM A MÍNIM comparable al del pas coarse.
 *
 * El submostreig fa mitjanes: el pic a resolució plena només pot ser igual o
 * més alt que el mateix punt vist a la graella reduïda. Si el retall en surt
 * amb un pic clarament MÉS BAIX, és que ha anat a parar a una altra cosa —
 * una vora de núvol, un reflex — i val més quedar-se amb el centroide coarse
 * que refinar cap a un lloc equivocat.
 */
export function acceptRefinedPeak(coarsePeak: number, refinedPeak: number): boolean {
  return refinedPeak >= 0.8 * coarsePeak;
}
