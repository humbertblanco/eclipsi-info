/**
 * Ancoratge visual: estabilitzar la superposició mesurant-la sobre la imatge.
 *
 * PER QUÈ. Fins ara la superposició es dibuixava només amb el que deien la
 * brúixola i l'acceleròmetre. Això té dos problemes que no es poden arreglar
 * filtrant més: el senyal té soroll, i l'escala depèn d'un camp de visió que
 * cap navegador ens diu i que a iOS ni tan sols sabem de quin objectiu és. El
 * resultat és el que es veu al mòbil: la superposició llisca sobre el paisatge.
 *
 * LA IDEA. Si mesurem quant ha GIRAT la càmera segons la pròpia imatge i movem
 * la superposició exactament el mateix, queda enganxada per construcció —
 * perquè la mesura surt de la mateixa imatge on dibuixem. És, en petit, el que
 * fan ARKit i ARCore amb l'odometria visual-inercial.
 *
 * Els sensors no desapareixen: segueixen sent l'única font que sap on és el
 * nord i on és amunt. El repartiment queda així:
 *
 *   · la imatge mana en el curt termini, que és on es nota el tremolor;
 *   · els sensors manen en el llarg, que és on la imatge deriva.
 *
 * I REGALA EL CALIBRATGE. Si la imatge diu que hem girat Δθ_visual —calculat
 * amb una focal de referència que potser és falsa— i el sensor diu que hem
 * girat Δθ_real, aleshores la focal de veritat és la de referència pel quocient
 * dels dos. O sigui que el camp de visió, que era una conjectura, passa a ser
 * una mesura, i amb ell desapareix el problema de no saber si iOS ens ha donat
 * la càmera principal o l'ultra-angular. És la tècnica del calibratge assistit
 * per giroscopi (Aalto, "Robust Gyroscope-Aided Camera Self-Calibration").
 *
 * TRES COSES QUE AQUEST FITXER FA I QUE LA VERSIÓ ANTERIOR NO FEIA, i que són
 * les que expliquen que la superposició llisqués en inclinar amunt i avall:
 *
 *  1. LA GRAELLA RESPECTA LA RELACIÓ D'ASPECTE DEL VÍDEO. Abans es dibuixava
 *     un flux de 720×1280 dins d'una graella de 96×72, o sigui esclafat, i
 *     després es convertien els dos eixos a píxels de pantalla amb el MATEIX
 *     factor. Amb un contenidor de 390 px d'ample: horitzontal, 4,06 px de
 *     pantalla per píxel de graella, correcte; vertical, els 9,63 reals contra
 *     els 4,06 aplicats — el moviment vertical sortia 2,37 vegades més petit
 *     del que era. La superposició es movia al 42% del que li tocava quan
 *     s'inclinava el telèfon, que és exactament el símptoma que es veia.
 *  2. INTERPOLACIÓ SUBPÍXEL. El desplaçament enter d'un píxel de graella són
 *     entre 0,4° i 1,1° de cel segons l'eix i el mòbil. El Sol en fa 0,53°: un
 *     escaló de quantització era més gros que el Sol. La paràbola sobre els
 *     veïns baixa l'error a una desena de píxel.
 *  3. AJUST DE ROTACIÓ, NO MEDIANA DE TRANSLACIONS. Els nou blocs s'ajusten a
 *     un model de flux rotacional de tres graus de llibertat. Això corregeix
 *     l'escorç de la perspectiva —un bloc del cantó es mou un 10% més que el
 *     del centre per al mateix gir— i, sobretot, separa el gir de canell de la
 *     inclinació, que abans es barrejaven i es llegien com un desplaçament fals.
 *
 * COST. Tot es fa sobre una còpia reduïda en escala de grisos (uns 14.000
 * píxels), amb nou blocs i una cerca de ±7 píxels centrada en la predicció del
 * sensor. Són unes desenes de milers d'operacions per fotograma de vídeo:
 * negligible al costat de dibuixar l'overlay.
 *
 * El nucli d'aquest fitxer (`FrameTracker`, `fitRotation`) no toca el DOM, i
 * per això `visualTracker.test.ts` el pot alimentar amb fotogrames sintètics
 * generats a partir d'una rotació coneguda.
 */

/** Costat dels blocs que se cerquen, en píxels de la graella reduïda. */
const BLOCK = 16;
/** Radi de cerca al voltant de la posició predita, en píxels de graella. */
const SEARCH = 7;
/** Blocs per costat: una graella de 3×3 en dona nou. */
const GRID = 3;
/**
 * Variància mínima d'un bloc perquè valgui la pena buscar-lo.
 *
 * Un bloc sense textura —una paret llisa, el cel obert— casa igual de bé a tot
 * arreu i el que en surt és soroll pur.
 */
const MIN_VARIANCE = 25;

/** Mida objectiu del costat curt de la graella reduïda. */
const GRID_SHORT_SIDE = 88;
/** Sostre del costat llarg, per no pagar de més amb fluxos molt allargats. */
const GRID_LONG_SIDE_MAX = 176;

/**
 * Relació entre la graella reduïda, la pantalla i l'òptica.
 *
 * `scaleX` i `scaleY` han de ser DIFERENTS quan la graella no té la mateixa
 * relació d'aspecte que el flux. Confondre'ls és l'error que feia lliscar la
 * superposició en vertical.
 */
export interface TrackerGeometry {
  /** Amplada de la graella reduïda, en píxels. */
  gridWidth: number;
  /** Alçada de la graella reduïda, en píxels. */
  gridHeight: number;
  /** Píxels de PANTALLA per píxel de graella, eix horitzontal. */
  scaleX: number;
  /** Píxels de PANTALLA per píxel de graella, eix vertical. */
  scaleY: number;
  /** Distància focal en píxels de PANTALLA. */
  focalPx: number;
}

/**
 * Gir mesurat sobre la imatge, en radians i al voltant dels eixos de la CÀMERA.
 *
 * Els signes són els de la càmera, no els de la imatge: el que es mou és el
 * telèfon. Si el contingut llisca cap a l'esquerra, `yawRad` és positiu perquè
 * qui ha girat cap a la dreta és la càmera.
 */
export interface VisualRotation {
  /** Positiu quan la càmera s'inclina cap AMUNT (l'altura creix). */
  pitchRad: number;
  /** Positiu quan la càmera gira cap a la DRETA (l'azimut creix). */
  yawRad: number;
  /**
   * Gir al voltant de l'eix òptic. Positiu quan la càmera gira en el sentit de
   * les agulles del rellotge vist des de darrere, que és el que fa el contingut
   * de la imatge girar en sentit contrari.
   */
  rollRad: number;
  /** Qualitat de la mesura, de 0 a 1. Per sota de 0,35 no és de fiar. */
  confidence: number;
  /** Blocs que han sobreviscut al rebuig d'atípics. */
  usedBlocks: number;
  /**
   * Cert si la cerca ha topat amb el límit de la finestra: el gir ha estat més
   * gran del que es pot mesurar i el número que en surt és massa petit. Qui ho
   * rebi ha de tornar al sensor, no fiar-se'n.
   */
  saturated: boolean;
  /** Residu quadràtic mitjà de l'ajust, en píxels de pantalla. */
  residualPx: number;
}

/** Predicció del gir per centrar-hi la cerca. Ve del sensor. */
export interface RotationHint {
  pitchRad: number;
  yawRad: number;
  rollRad: number;
}

interface BlockSlot {
  /** Origen del bloc dins la graella. */
  ox: number;
  oy: number;
  /** Posició del CENTRE del bloc respecte al punt principal, en px de pantalla. */
  u: number;
  v: number;
}

interface BlockMeasure {
  slot: BlockSlot;
  /** Desplaçament del contingut, en píxels de PANTALLA. */
  du: number;
  dv: number;
  saturated: boolean;
}

/**
 * Mida de la graella reduïda per a un flux donat, respectant-ne l'aspecte.
 *
 * Es fixa el costat CURT i s'allarga l'altre. Així la graella no esclafa la
 * imatge i els dos eixos queden gairebé a la mateixa escala, que és el que fa
 * que la correspondència de blocs sigui vàlida: un bloc quadrat a la graella ha
 * de correspondre a una regió gairebé quadrada de l'escena.
 */
export function gridSizeForFrame(
  videoWidth: number,
  videoHeight: number,
): { gridWidth: number; gridHeight: number } {
  if (videoWidth <= 0 || videoHeight <= 0) {
    return { gridWidth: GRID_SHORT_SIDE, gridHeight: GRID_SHORT_SIDE };
  }
  const long = Math.max(videoWidth, videoHeight);
  const short = Math.min(videoWidth, videoHeight);
  const longGrid = Math.min(
    GRID_LONG_SIDE_MAX,
    Math.max(GRID_SHORT_SIDE, Math.round((GRID_SHORT_SIDE * long) / short)),
  );
  return videoWidth >= videoHeight
    ? { gridWidth: longGrid, gridHeight: GRID_SHORT_SIDE }
    : { gridWidth: GRID_SHORT_SIDE, gridHeight: longGrid };
}

/**
 * Geometria completa a partir del flux i del contenidor.
 *
 * El vídeo es mostra amb `object-fit: cover`: s'escala fins que no deixa cap
 * forat i es retalla el que sobra, centrat. El factor d'escala és el mateix als
 * dos eixos —el retall no deforma— però el nombre de píxels de pantalla per
 * píxel de GRAELLA no ho és, perquè la graella té una densitat diferent a cada
 * eix quan l'aspecte no coincideix exactament.
 */
export function geometryFor(
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number,
  focalPx: number,
): TrackerGeometry | null {
  if (videoWidth <= 0 || videoHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return null;
  }
  const { gridWidth, gridHeight } = gridSizeForFrame(videoWidth, videoHeight);
  const cover = Math.max(containerWidth / videoWidth, containerHeight / videoHeight);
  return {
    gridWidth,
    gridHeight,
    scaleX: (videoWidth / gridWidth) * cover,
    scaleY: (videoHeight / gridHeight) * cover,
    focalPx,
  };
}

/** Posicions dels nou blocs dins la graella, i els seus centres a pantalla. */
function blockSlots(geometry: TrackerGeometry): BlockSlot[] {
  const slots: BlockSlot[] = [];
  const cx = geometry.gridWidth / 2;
  const cy = geometry.gridHeight / 2;

  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      // Fraccions 0,2 / 0,5 / 0,8: prou separades perquè el gir al voltant de
      // l'eix òptic tingui braç de palanca, i prou endins perquè la finestra de
      // cerca no surti de la imatge.
      const fx = 0.2 + (0.6 * i) / (GRID - 1);
      const fy = 0.2 + (0.6 * j) / (GRID - 1);
      const ox = clampInt(Math.round(fx * geometry.gridWidth - BLOCK / 2), 0, geometry.gridWidth - BLOCK);
      const oy = clampInt(Math.round(fy * geometry.gridHeight - BLOCK / 2), 0, geometry.gridHeight - BLOCK);
      slots.push({
        ox,
        oy,
        u: (ox + BLOCK / 2 - cx) * geometry.scaleX,
        v: (oy + BLOCK / 2 - cy) * geometry.scaleY,
      });
    }
  }
  return slots;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Flux d'imatge que produeix una rotació petita de la càmera.
 *
 * Model estàndard de flux rotacional per a una càmera estenopeica, amb el punt
 * (u, v) mesurat en píxels de pantalla des del punt principal i v cap AVALL:
 *
 *   du = pitch·(u·v/f) − yaw·(f + u²/f) + roll·v
 *   dv = pitch·(f + v²/f) − yaw·(u·v/f) − roll·u
 *
 * Els termes u²/f i v²/f són l'escorç de la perspectiva: per al mateix gir, un
 * bloc del cantó d'una imatge de 66° es desplaça un 10% més que el del centre.
 * Amb la mediana de translacions que hi havia abans, aquell 10% entrava com a
 * error d'escala directe sobre la superposició.
 */
export function rotationalFlow(
  u: number,
  v: number,
  focalPx: number,
  rotation: RotationHint,
): { du: number; dv: number } {
  const f = focalPx;
  const uv = (u * v) / f;
  return {
    du: rotation.pitchRad * uv - rotation.yawRad * (f + (u * u) / f) + rotation.rollRad * v,
    dv: rotation.pitchRad * (f + (v * v) / f) - rotation.yawRad * uv - rotation.rollRad * u,
  };
}

/**
 * Ajust per mínims quadrats del gir de tres graus de llibertat.
 *
 * Nou blocs donen divuit equacions per a tres incògnites. Es resol pel sistema
 * normal 3×3, i després es repeteix descartant els blocs amb residu gros: si
 * passa una persona pel davant o es mou una branca, aquell bloc dona una
 * mesura que no té res a veure amb el gir del telèfon, i sense el descart
 * s'emportaria l'ajust darrere seu. És el que feia la mediana, però conservant
 * el model geomètric.
 */
export function fitRotation(
  measures: readonly BlockMeasure[],
  focalPx: number,
): { rotation: RotationHint; residualPx: number; used: number } | null {
  if (measures.length < 3) return null;

  const first = solveRotation(measures, focalPx);
  if (!first) return null;

  // Residu per bloc i rebuig d'atípics per la mediana absoluta.
  const residuals = measures.map((m) => {
    const flow = rotationalFlow(m.slot.u, m.slot.v, focalPx, first);
    return Math.hypot(m.du - flow.du, m.dv - flow.dv);
  });
  const sorted = [...residuals].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  // El llindar mai baixa de mig píxel de pantalla: amb una escena perfectament
  // rígida la mediana val gairebé zero i, sense terra, es descartarien blocs
  // bons per diferències de coma flotant.
  const limit = Math.max(2.5 * median, 0.5);
  const kept = measures.filter((_, i) => residuals[i] <= limit);

  const source = kept.length >= 3 && kept.length < measures.length ? kept : measures;
  const solution = kept.length >= 3 ? (solveRotation(source, focalPx) ?? first) : first;

  let sumSq = 0;
  for (const m of source) {
    const flow = rotationalFlow(m.slot.u, m.slot.v, focalPx, solution);
    sumSq += (m.du - flow.du) ** 2 + (m.dv - flow.dv) ** 2;
  }

  return {
    rotation: solution,
    residualPx: Math.sqrt(sumSq / (2 * source.length)),
    used: source.length,
  };
}

function solveRotation(
  measures: readonly BlockMeasure[],
  f: number,
): RotationHint | null {
  // Sistema normal AᵀA·x = Aᵀb amb A de 2N×3. N és petit i el sistema és de
  // 3×3: es munta directament i es resol per eliminació.
  const n = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const rhs = [0, 0, 0];

  const accumulate = (row: [number, number, number], value: number) => {
    for (let i = 0; i < 3; i++) {
      rhs[i] += row[i] * value;
      for (let j = 0; j < 3; j++) n[i * 3 + j] += row[i] * row[j];
    }
  };

  for (const m of measures) {
    const { u, v } = m.slot;
    const uv = (u * v) / f;
    accumulate([uv, -(f + (u * u) / f), v], m.du);
    accumulate([f + (v * v) / f, -uv, -u], m.dv);
  }

  const x = solve3(n, rhs);
  if (!x) return null;
  return { pitchRad: x[0], yawRad: x[1], rollRad: x[2] };
}

/** Eliminació de Gauss amb pivot parcial sobre un sistema de 3×3. */
function solve3(
  a: readonly number[],
  b: readonly number[],
): [number, number, number] | null {
  const m = [
    [a[0], a[1], a[2], b[0]],
    [a[3], a[4], a[5], b[1]],
    [a[6], a[7], a[8], b[2]],
  ];

  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    if (pivot !== col) {
      const tmp = m[pivot];
      m[pivot] = m[col];
      m[col] = tmp;
    }
    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const factor = m[row][col] / m[col][col];
      for (let k = col; k < 4; k++) m[row][k] -= factor * m[col][k];
    }
  }

  const x0 = m[0][3] / m[0][0];
  const x1 = m[1][3] / m[1][1];
  const x2 = m[2][3] / m[2][2];
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || !Number.isFinite(x2)) return null;
  return [x0, x1, x2];
}

/**
 * Nucli del seguiment, sense cap dependència del DOM.
 *
 * Rep fotogrames ja reduïts a escala de grisos i en treu el gir. Que no toqui
 * el DOM és el que permet provar-lo amb una escena sintètica i una rotació
 * coneguda, que és l'única manera honesta de saber si això funciona sense tenir
 * el telèfon a la mà.
 */
export class FrameTracker {
  private previous: Float32Array | null = null;
  private width = 0;
  private height = 0;
  private slots: BlockSlot[] = [];
  private slotsKey = '';

  /**
   * Mesura el gir entre el fotograma anterior i aquest.
   *
   * @param gray fotograma en escala de grisos, de `gridWidth × gridHeight`.
   * @param hint gir que espera el sensor per a aquest interval. Serveix per
   *   CENTRAR-HI la cerca: sense predicció, el gir màxim mesurable és el radi
   *   de cerca (uns 3° per fotograma, o 100°/s a 30 Hz); amb predicció, el
   *   límit el posa el desenfocament de moviment i no la finestra. És el que fa
   *   el seguiment assistit per inercials de qualsevol sistema de RA seriós.
   */
  measure(
    gray: Float32Array,
    geometry: TrackerGeometry,
    hint: RotationHint | null,
  ): VisualRotation | null {
    const { gridWidth: w, gridHeight: h } = geometry;
    if (gray.length < w * h) return null;

    const key = `${w}x${h}:${geometry.scaleX.toFixed(4)}:${geometry.scaleY.toFixed(4)}`;
    if (key !== this.slotsKey) {
      this.slots = blockSlots(geometry);
      this.slotsKey = key;
    }

    if (this.previous === null || this.width !== w || this.height !== h) {
      this.previous = Float32Array.from(gray.subarray(0, w * h));
      this.width = w;
      this.height = h;
      return null;
    }

    const prev = this.previous;
    const measures: BlockMeasure[] = [];

    for (const slot of this.slots) {
      // Predicció del desplaçament d'aquest bloc, en píxels de graella.
      let predX = 0;
      let predY = 0;
      if (hint) {
        const flow = rotationalFlow(slot.u, slot.v, geometry.focalPx, hint);
        predX = Math.round(flow.du / geometry.scaleX);
        predY = Math.round(flow.dv / geometry.scaleY);
      }

      const match = matchBlock(prev, gray, w, h, slot, predX, predY);
      if (!match) continue;
      measures.push({
        slot,
        du: match.dx * geometry.scaleX,
        dv: match.dy * geometry.scaleY,
        saturated: match.saturated,
      });
    }

    prev.set(gray.subarray(0, w * h));

    if (measures.length < 3) return null;

    // Els blocs que han topat amb el límit de la cerca donen un desplaçament
    // MASSA PETIT, no un desplaçament sorollós: el mínim de veritat queda fora
    // de la finestra i el que es troba és la vora. Barrejar-los amb els bons
    // arrossega tot l'ajust cap avall — mesurat, un gir de 9° sortia de 7,4°.
    // Es fa servir només el que ha quedat net, sempre que en quedin prou.
    const clean = measures.filter((m) => !m.saturated);
    const usable = clean.length >= 3 ? clean : measures;
    const saturated = clean.length < 3;

    const fit = fitRotation(usable, geometry.focalPx);
    if (!fit) return null;

    // Escala típica d'un píxel de graella a pantalla: és la unitat natural per
    // jutjar si el residu és gran o petit.
    //
    // El que decideix la confiança NO és el residu sinó el residu dividit per
    // l'arrel del nombre de blocs, que és l'error estàndard de l'ajust. Amb poca
    // llum, cada bloc per separat balla mig píxel però la mitjana de nou blocs
    // segueix sent bona: penalitzar pel residu cru descartaria mesures
    // perfectament útils justament al capvespre, que és quan es mira un eclipsi.
    const pixelPx = (geometry.scaleX + geometry.scaleY) / 2;
    const standardErrorPx = fit.residualPx / Math.sqrt(Math.max(1, fit.used));
    const ratio = standardErrorPx / (0.35 * pixelPx);
    const agreement = 1 / (1 + ratio * ratio);
    // Amb sis blocs bons el gir de tres incògnites ja queda ben determinat; a
    // partir d'aquí, tenir-ne més no fa la mesura més certa. Un bloc que cau
    // sobre cel obert no ha de baixar la confiança de tota la mesura.
    const coverage = Math.min(1, fit.used / 6);

    return {
      pitchRad: fit.rotation.pitchRad,
      yawRad: fit.rotation.yawRad,
      rollRad: fit.rotation.rollRad,
      confidence: saturated ? 0 : agreement * coverage,
      usedBlocks: fit.used,
      saturated,
      residualPx: fit.residualPx,
    };
  }

  reset(): void {
    this.previous = null;
    this.slotsKey = '';
  }
}

/**
 * Cerca un bloc del fotograma anterior dins del fotograma actual.
 *
 * Cerca exhaustiva amb suma de diferències absolutes dins d'una finestra
 * centrada a la predicció. A 16×16 píxels i un radi de 7 són 225 posicions per
 * bloc: barat, i sense els mínims locals que tenen els mètodes de descens.
 *
 * El resultat és FRACCIONARI. L'enter sol seria un escaló de fins a mig píxel
 * de graella, que al mòbil són uns quants píxels de pantalla i mig grau de cel
 * — més que el diàmetre del Sol.
 */
function matchBlock(
  prev: Float32Array,
  cur: Float32Array,
  w: number,
  h: number,
  slot: BlockSlot,
  predX: number,
  predY: number,
): { dx: number; dy: number; saturated: boolean } | null {
  const { ox, oy } = slot;

  // Un bloc sense textura casa igual de bé a tot arreu. Es descarta abans de
  // buscar, que és quan surt barat.
  let mean = 0;
  for (let y = 0; y < BLOCK; y++) {
    const row = (oy + y) * w + ox;
    for (let x = 0; x < BLOCK; x++) mean += prev[row + x];
  }
  mean /= BLOCK * BLOCK;

  let variance = 0;
  for (let y = 0; y < BLOCK; y++) {
    const row = (oy + y) * w + ox;
    for (let x = 0; x < BLOCK; x++) {
      const d = prev[row + x] - mean;
      variance += d * d;
    }
  }
  variance /= BLOCK * BLOCK;
  if (variance < MIN_VARIANCE) return null;

  // La predicció es reté dins la imatge. Si topa, la cerca ja no està centrada
  // i es marca com a saturada.
  const cx = clampInt(ox + predX, 0, w - BLOCK);
  const cy = clampInt(oy + predY, 0, h - BLOCK);
  let clamped = cx !== ox + predX || cy !== oy + predY;

  let bestScore = Infinity;
  let bestDx = 0;
  let bestDy = 0;

  for (let dy = -SEARCH; dy <= SEARCH; dy++) {
    const ty = cy + dy;
    if (ty < 0 || ty + BLOCK > h) continue;
    for (let dx = -SEARCH; dx <= SEARCH; dx++) {
      const tx = cx + dx;
      if (tx < 0 || tx + BLOCK > w) continue;

      let score = 0;
      for (let y = 0; y < BLOCK; y++) {
        const pRow = (oy + y) * w + ox;
        const cRow = (ty + y) * w + tx;
        for (let x = 0; x < BLOCK; x++) {
          score += Math.abs(prev[pRow + x] - cur[cRow + x]);
        }
        // Abandonament anticipat: si ja anem pitjor que el millor, no cal
        // acabar el bloc. Estalvia la major part de la feina.
        if (score >= bestScore) break;
      }

      if (score < bestScore) {
        bestScore = score;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  if (!Number.isFinite(bestScore)) return null;

  const saturated = clamped || Math.abs(bestDx) === SEARCH || Math.abs(bestDy) === SEARCH;

  const sub = refineSubpixel(prev, cur, w, slot, cx + bestDx, cy + bestDy);

  return {
    dx: cx - ox + bestDx + sub.dx,
    dy: cy - oy + bestDy + sub.dy,
    saturated,
  };
}

/**
 * Refinament subpíxel per gradients, a la manera de Lucas i Kanade.
 *
 * PER QUÈ NO UNA PARÀBOLA SOBRE LES PUNTUACIONS. És l'estimador clàssic i és el
 * que hi havia al primer intent, però té "enganxament al píxel": la paràbola
 * ajustada sobre una superfície d'error en L1 no és simètrica i arrossega el
 * resultat cap a l'enter més proper. Mesurat en aquest mateix banc de proves:
 * amb passos de 0,39 píxels el gir sortia un 13% massa petit, amb passos de
 * 0,59 un 14% massa gran, i amb passos gairebé enters l'error queia al 2%. Com
 * que l'usuari mou el telèfon a velocitat gairebé constant, el desplaçament per
 * fotograma també ho és, i aquell error NO s'anul·la de mitjana: s'acumula com
 * un error d'escala i acaba desenganxant la superposició del paisatge — que és
 * exactament el defecte que estem perseguint.
 *
 * Amb els gradients, la resolució és la del contingut de la imatge i no la de
 * la quadrícula de puntuacions. Es fa una sola iteració: després de la cerca
 * entera el residu és inferior a un píxel, que és el règim on l'aproximació
 * lineal és bona.
 */
function refineSubpixel(
  prev: Float32Array,
  cur: Float32Array,
  w: number,
  slot: BlockSlot,
  tx: number,
  ty: number,
): { dx: number; dy: number } {
  let gxx = 0;
  let gxy = 0;
  let gyy = 0;
  let gxt = 0;
  let gyt = 0;

  // La vora del bloc queda fora: les diferències centrades hi necessitarien un
  // píxel que ja no pertany al bloc.
  for (let y = 1; y < BLOCK - 1; y++) {
    const cRow = (ty + y) * w + tx;
    const pRow = (slot.oy + y) * w + slot.ox;
    for (let x = 1; x < BLOCK - 1; x++) {
      const c = cRow + x;
      const p = pRow + x;
      // Gradient promitjat entre els dos fotogrames: la variant simètrica té
      // menys biaix que prendre'l només d'un dels dos.
      const gx = 0.25 * (cur[c + 1] - cur[c - 1] + prev[p + 1] - prev[p - 1]);
      const gy = 0.25 * (cur[c + w] - cur[c - w] + prev[p + w] - prev[p - w]);
      const gt = cur[c] - prev[p];
      gxx += gx * gx;
      gxy += gx * gy;
      gyy += gy * gy;
      gxt += gx * gt;
      gyt += gy * gt;
    }
  }

  const det = gxx * gyy - gxy * gxy;
  // Un determinant petit vol dir estructura en una sola direcció —el problema
  // clàssic de l'obertura—: la component perpendicular no és observable i val
  // més quedar-se amb l'enter que inventar-se-la.
  if (!(Math.abs(det) > 1e-9 * (gxx * gyy + 1))) return { dx: 0, dy: 0 };

  const dx = (-gyy * gxt + gxy * gyt) / det;
  const dy = (gxy * gxt - gxx * gyt) / det;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { dx: 0, dy: 0 };

  // Més d'un píxel vol dir que la cerca entera no havia trobat el mínim bo.
  return {
    dx: Math.max(-1, Math.min(1, dx)),
    dy: Math.max(-1, Math.min(1, dy)),
  };
}

/**
 * Detector de fotogrames NOUS de vídeo.
 *
 * El bucle de dibuix va a 60 Hz i la càmera sovint a 30. Sense això, la meitat
 * de les mesures es fan contra el mateix fotograma, donen zero desplaçament amb
 * la màxima confiança possible —perquè la imatge, efectivament, no s'ha mogut
 * gens— i el sistema conclou que el telèfon està quiet quan no ho està. El
 * resultat és un moviment a batzegades i una estimació de focal contaminada per
 * mostres de gir sense desplaçament.
 *
 * `requestVideoFrameCallback` ho resol on hi és (Chrome, Safari 15.4+). On no,
 * es compara `currentTime`, que en un flux en directe avança amb els
 * fotogrames.
 */
export class VideoFrameClock {
  private video: HTMLVideoElement | null = null;
  private handle: number | null = null;
  private pending = false;
  private lastTime = -1;
  private stamps: number[] = [];
  private usesCallback = false;

  attach(video: HTMLVideoElement): void {
    this.detach();
    this.video = video;
    if (typeof video.requestVideoFrameCallback === 'function') {
      this.usesCallback = true;
      this.schedule();
    } else {
      this.usesCallback = false;
    }
  }

  private schedule(): void {
    const video = this.video;
    if (!video || typeof video.requestVideoFrameCallback !== 'function') return;
    this.handle = video.requestVideoFrameCallback(() => {
      this.pending = true;
      this.mark();
      this.schedule();
    });
  }

  private mark(): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.stamps.push(now);
    while (this.stamps.length > 0 && now - this.stamps[0] > 1000) this.stamps.shift();
  }

  /**
   * Si hi ha un fotograma nou esperant, SENSE consumir-lo.
   *
   * El bucle de dibuix ho necessita per decidir si val la pena dibuixar abans
   * de fer cap altra feina: `consume()` te efecte secundari i nomes es pot
   * cridar un cop per fotograma.
   */
  get pendingFrame(): boolean {
    if (this.usesCallback) return this.pending;
    const video = this.video;
    if (!video) return false;
    return video.currentTime !== this.lastTime;
  }

  /** Cert un sol cop per cada fotograma nou. */
  consume(): boolean {
    if (this.usesCallback) {
      if (!this.pending) return false;
      this.pending = false;
      return true;
    }
    const video = this.video;
    if (!video) return false;
    if (video.currentTime === this.lastTime) return false;
    this.lastTime = video.currentTime;
    this.mark();
    return true;
  }

  /** Fotogrames de vídeo per segon que arriben de veritat. */
  get fps(): number {
    return this.stamps.length;
  }

  /** Cert si el navegador ens avisa de cada fotograma en comptes d'endevinar-ho. */
  get exact(): boolean {
    return this.usesCallback;
  }

  detach(): void {
    if (this.video && this.handle !== null && typeof this.video.cancelVideoFrameCallback === 'function') {
      this.video.cancelVideoFrameCallback(this.handle);
    }
    this.video = null;
    this.handle = null;
    this.pending = false;
    this.lastTime = -1;
    this.stamps.length = 0;
  }
}

/**
 * Embolcall amb DOM: captura el fotograma, el redueix i crida el nucli.
 */
export class VisualTracker {
  private canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private gray = new Float32Array(0);
  private gridWidth = 0;
  private gridHeight = 0;
  private core = new FrameTracker();

  private ensureCanvas(width: number, height: number): void {
    if (this.canvas && this.gridWidth === width && this.gridHeight === height) return;

    this.canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height });
    if (this.canvas instanceof HTMLCanvasElement) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const ctx = this.canvas.getContext('2d', { willReadFrequently: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) throw new Error('No hi ha context 2D per al seguiment visual');

    // La reducció és de vuit vegades: sense remostreig decent, el que arriba
    // als blocs és àlies, i l'àlies canvia amb desplaçaments subpíxel d'una
    // manera que no té res a veure amb el moviment real.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    this.ctx = ctx;
    this.gridWidth = width;
    this.gridHeight = height;
    this.gray = new Float32Array(width * height);
    this.core.reset();
  }

  /**
   * Mesura el gir entre aquest fotograma de vídeo i l'anterior.
   *
   * Només s'ha de cridar quan hi ha un fotograma NOU: vegeu `VideoFrameClock`.
   */
  measure(
    video: HTMLVideoElement,
    geometry: TrackerGeometry,
    hint: RotationHint | null,
  ): VisualRotation | null {
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    this.ensureCanvas(geometry.gridWidth, geometry.gridHeight);
    const ctx = this.ctx;
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, geometry.gridWidth, geometry.gridHeight);
    const image = ctx.getImageData(0, 0, geometry.gridWidth, geometry.gridHeight);

    // Escala de grisos amb pesos de luminància. Els canals per separat no
    // aporten res aquí i costen tres vegades més.
    const px = image.data;
    const gray = this.gray;
    for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
      gray[j] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    }

    return this.core.measure(gray, geometry, hint);
  }

  /**
   * L'últim fotograma en escala de grisos, tal com s'ha preparat per mesurar.
   *
   * L'ancoratge a la silueta del terreny (`skyline.ts`) el necessita, i
   * tornar-lo a llegir del vídeo voldria dir un segon `drawImage` i un segon
   * `getImageData` per fotograma per a exactament la mateixa imatge. Els
   * valors van a l'escala en què hagin arribat; qui el consumeix no ho ha de
   * saber, perquè el detector treballa amb contrastos relatius.
   */
  get lastGray(): Float32Array {
    return this.gray;
  }

  reset(): void {
    this.core.reset();
  }
}

/**
 * Estimació de la distància focal a partir del moviment.
 *
 * COM FUNCIONA. El seguidor calcula el gir amb una focal de REFERÈNCIA que
 * potser és falsa. Com que el gir mesurat és inversament proporcional a la
 * focal que s'hi ha posat, comparar-lo amb el que ha vist el sensor en el
 * mateix interval dona directament el factor de correcció:
 *
 *     focal_real = focal_de_referència · (gir_del_sensor / gir_visual)
 *
 * PER QUÈ S'ACUMULA EN FINESTRES I NO ES FA FOTOGRAMA A FOTOGRAMA. El gir del
 * sensor entre dos fotogrames consecutius és d'un grau escàs i el seu soroll és
 * d'un grau i mig. Ajustar una recta amb un regressor que té més soroll que
 * senyal no dona una recta amb més error: dona una recta amb el PENDENT
 * SISTEMÀTICAMENT MASSA PETIT —és l'atenuació per error en les variables— i la
 * focal en sortiria la meitat de la real de manera consistent, que és
 * exactament el tipus d'error que després fa lliscar la superposició. Acumulant
 * fins que el gir net passa dels vuit graus, el soroll del sensor queda una
 * magnitud per sota del senyal i el biaix desapareix.
 */
interface FocalWindow {
  visual: number;
  sensor: number;
  reference: number;
  steps: number;
}

export class FocalEstimator {
  /**
   * Una finestra per EIX.
   *
   * Els dos eixos comparteixen la mateixa focal —els píxels d'un sensor de
   * mòbil són quadrats— però no es poden acumular a la mateixa finestra: si
   * l'usuari gira en horitzontal i inclina alhora, les dues components es
   * cancel·larien parcialment dins d'una suma comuna i la finestra no es
   * tancaria mai.
   */
  private windows: FocalWindow[] = [
    { visual: 0, sensor: 0, reference: 0, steps: 0 },
    { visual: 0, sensor: 0, reference: 0, steps: 0 },
  ];

  /*
   * LES SUMES TAMBÉ VAN PER EIX, i la focal que s'aplica surt NOMÉS del gir
   * horitzontal (eix 0).
   *
   * Abans les finestres eren per eix però la regressió era comuna, i això
   * tenia dues conseqüències silencioses: com que l'usuari gira desenes de
   * graus i n'inclina quatre, la finestra d'inclinació gairebé mai es tancava
   * — la focal era de facto un calibratge de guinyada — i quan es tancava,
   * hi entrava esbiaixada per l'obturador rodant, que infla o encongeix el
   * pitch segons el sentit del gest però deixa la guinyada gairebé neta (en
   * horitzontal la deformació és cisalla, i el model l'absorbeix com a
   * residu). Ara l'eix d'inclinació s'acumula igualment, però només com a
   * DIAGNÒSTIC: si `gainForAxis(1)` s'allunya de `gainForAxis(0)`, allò és
   * l'empremta de l'obturador rodant, no una focal diferent.
   */
  private sumVS: [number, number] = [0, 0];
  private sumVV: [number, number] = [0, 0];
  private samples: [number, number] = [0, 0];

  /** Gir net que ha de tenir una finestra per valer, en radians (8°). */
  private static readonly WINDOW_RAD = (8 * Math.PI) / 180;
  /** Passos màxims per finestra: si el gir no arriba, es llença i es recomença. */
  private static readonly WINDOW_MAX_STEPS = 240;

  /**
   * @param axis 0 per al gir horitzontal de la càmera, 1 per a la inclinació
   * @param visualRad gir mesurat sobre la imatge amb `referenceFocalPx`
   * @param sensorRad gir que ha vist el sensor en el mateix interval
   * @param referenceFocalPx focal que s'ha fet servir per calcular `visualRad`
   */
  add(
    axis: 0 | 1,
    visualRad: number,
    sensorRad: number,
    referenceFocalPx: number,
    confidence: number,
  ): void {
    const w = this.windows[axis];
    if (!(referenceFocalPx > 0) || !Number.isFinite(visualRad) || !Number.isFinite(sensorRad)) {
      return;
    }
    if (confidence < 0.5) {
      // Una mesura dubtosa enmig d'una finestra la contamina sencera.
      this.dropWindow(axis);
      return;
    }
    if (w.steps > 0 && Math.abs(referenceFocalPx / w.reference - 1) > 0.01) {
      // La focal de referència ha canviat a mitja finestra: el que s'hi ha
      // acumulat ja no és homogeni.
      this.dropWindow(axis);
    }
    if (w.steps === 0) w.reference = referenceFocalPx;

    w.visual += visualRad;
    w.sensor += sensorRad;
    w.steps++;

    if (Math.abs(w.sensor) >= FocalEstimator.WINDOW_RAD) {
      // Els dos han de dir que s'ha girat cap al mateix costat. Si no, o bé el
      // que s'ha mogut és l'escena, o bé el signe està invertit — i en aquest
      // segon cas val més no calibrar res que calibrar-ho al revés.
      if (Math.sign(w.visual) === Math.sign(w.sensor)) {
        this.sumVS[axis] += w.visual * w.sensor;
        this.sumVV[axis] += w.visual * w.visual;
        this.samples[axis]++;
      }
      this.dropWindow(axis);
    } else if (w.steps >= FocalEstimator.WINDOW_MAX_STEPS) {
      this.dropWindow(axis);
    }
  }

  private dropWindow(axis: 0 | 1): void {
    this.windows[axis] = { visual: 0, sensor: 0, reference: 0, steps: 0 };
  }

  /**
   * Factor pel qual s'ha de multiplicar la focal de referència, o null si
   * encara no hi ha prou mostres.
   *
   * EL SENTIT DE LA REGRESSIÓ NO ÉS INDIFERENT. El que volem és el quocient
   * gir_visual / gir_del_sensor, però el gir del sensor és la magnitud
   * sorollosa de les dues. Si es posa com a variable independent, el pendent
   * surt sistemàticament massa petit —atenuació per error en les variables— i
   * la focal sortiria curta sempre. Per això s'ajusta `sensor = m · visual`,
   * on el soroll és a la resposta i no esbiaixa res, i després s'inverteix.
   */
  get gain(): number | null {
    // Només l'eix de guinyada calibra: vegeu el comentari de les sumes.
    return this.gainForAxis(0);
  }

  /** Guany d'un eix concret. L'eix 1 (inclinació) és només de diagnòstic. */
  gainForAxis(axis: 0 | 1): number | null {
    // Sis finestres de vuit graus són uns cinquanta graus de panoràmica: el
    // que fa qualsevol usuari en els primers deu segons buscant el Sol.
    if (this.samples[axis] < 6 || this.sumVV[axis] <= 0 || this.sumVS[axis] <= 0) return null;
    const slope = this.sumVS[axis] / this.sumVV[axis];
    if (!Number.isFinite(slope) || slope <= 0) return null;
    return 1 / slope;
  }

  /** Focal estimada en píxels de pantalla, o null si encara no n'hi ha prou. */
  focalPx(referenceFocalPx: number): number | null {
    const k = this.gain;
    if (k === null) return null;
    const focal = k * referenceFocalPx;
    // Fora d'aquest rang no és una càmera de mòbil: alguna cosa ha anat
    // malament i val més no dir res que dir una bestiesa.
    if (focal < 80 || focal > 8000) return null;
    return focal;
  }

  get count(): number {
    return this.samples[0];
  }

  /** Finestres tancades d'un eix. L'eix 1 diu si el diagnòstic RS té base. */
  countForAxis(axis: 0 | 1): number {
    return this.samples[axis];
  }

  reset(): void {
    this.dropWindow(0);
    this.dropWindow(1);
    this.sumVS = [0, 0];
    this.sumVV = [0, 0];
    this.samples = [0, 0];
  }
}
