/**
 * El conjunt: passar de «60 sobre 100» a «divuit de cinquanta-un escenaris et
 * deixen veure la totalitat».
 *
 * EL PROBLEMA QUE RESOL. Fins ara la resposta sortia d'UNA passada d'UN model
 * i anava acompanyada d'una fiabilitat que no mesurava ningú: `confidenceForLead`
 * la dedueix dels dies que falten. O sigui que dèiem «no te'n refiïs gaire»
 * sense haver mirat mai si ens n'havíem de refiar. Un conjunt sí que ho mira:
 * és el mateix model corregut cinquanta-un cops amb l'estat inicial pertorbat
 * dins del que l'observació no sap distingir, i el que en surt no és un número
 * sinó una distribució. Si els cinquanta-un acaben amb el cel net, la
 * incertesa d'aquell dia és petita de veritat i es pot dir. Si es reparteixen
 * meitat i meitat, tampoc no ho sabem —però ara ho sabem PER HAVER-HO MESURAT,
 * i és una frase que es pot defensar.
 *
 * LA REGLA QUE FA QUE AIXÒ VALGUI DE RES, I ÉS TOT EL FITXER
 *
 * Cada membre es puntua SOL, amb la seva pròpia línia de visió i les seves
 * pròpies tres capes, i només després es compten els que superen el llindar.
 * Fer la mitjana de la nuvolositat dels membres i puntuar la mitjana seria una
 * altra cosa, i seria la cosa dolenta: suavitza exactament el que hem vingut a
 * buscar. Amb quinze membres de cel net i quinze d'estrat tancat, la mitjana
 * dona un 50 % de núvols baixos —una tarda mediocre que no ha previst ningú—
 * i puntua 52 sobre 100, que és «depèn». La veritat és que la meitat dels
 * escenaris et donen l'eclipsi sencer i l'altra meitat no te'n donen res: és
 * una moneda a l'aire, i «una moneda a l'aire» i «una tarda mediocre» són
 * consells de viatge oposats. Hi ha una prova que ho vigila, «la fracció no
 * surt mai d'una mitjana de nuvolositat».
 *
 * PER QUÈ AQUÍ HI VIUEN PECES QUE ABANS ERAN D'`outlook.ts`
 *
 * `combineAlongLineOfSight`, `readSample` i `randomOverlapTotal` eren privades
 * d'`outlook.ts`. S'han mogut aquí senceres, sense tocar-ne una línia, i
 * `outlook.ts` les importa. NO era per ordenar: és que el conjunt ha de
 * projectar les capes sobre la visual EXACTAMENT amb la mateixa regla que el
 * camí determinista, i l'alternativa era una segona còpia. Aquest projecte ja
 * té una família d'errors que van tots de dues coses construïdes a part que
 * ningú no havia comparat mai —la franja dibuixada contra la calculada, el
 * text contra el motor—, i dues còpies d'aquesta funció haurien estat la
 * següent. Amb una sola còpia, la pregunta «i si divergeixen?» no es pot fer.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 * Cap frase per a l'usuari: d'aquí en surten números i codis.
 */

import {
  BAND_CLEAR_MIN,
  LAYER_ORDER,
  bandForScore,
  scoreCloudLayers,
} from './layers';
import { pointsForLayer } from './lineOfSight';
import { nearestIndex, type EnsembleMember, type HourlySeries } from './openMeteo';
import type {
  CloudLayers,
  Confidence,
  EnsembleModelReport,
  EnsembleSummary,
  SamplingPlan,
  SkyBand,
} from './types';

/* ------------------------------------ peces mogudes senceres d'outlook.ts */

function readNumber(series: (number | null)[] | undefined, index: number): number | null {
  if (!series || index < 0 || index >= series.length) return null;
  const value = series[index];
  return value === null || value === undefined || !Number.isFinite(value) ? null : value;
}

export interface RawSample {
  low: number | null;
  mid: number | null;
  high: number | null;
  total: number | null;
  visibility: number | null;
}

export function readSample(series: HourlySeries, index: number): RawSample {
  return {
    low: readNumber(series.cloud_cover_low, index),
    mid: readNumber(series.cloud_cover_mid, index),
    high: readNumber(series.cloud_cover_high, index),
    total: readNumber(series.cloud_cover, index),
    visibility: readNumber(series.visibility, index),
  };
}

/** Superposició aleatòria: la mateixa regla amb què el model calcula el total. */
function randomOverlapTotal(low: number, mid: number, high: number): number {
  const t = (1 - low / 100) * (1 - mid / 100) * (1 - high / 100);
  return 100 * (1 - t);
}

/**
 * Ajunta les lectures dels punts de la línia de visió en un sol joc de capes.
 *
 * Cada capa es promitja NOMÉS entre els punts on la línia de visió travessa
 * aquella capa. És tot el sentit del mostreig: llegir els cirrus a cent
 * quilòmetres de distància i els estrats a deu, perquè és on són els que et
 * taparan.
 */
export function combineAlongLineOfSight(
  plan: SamplingPlan,
  samples: readonly RawSample[],
): { layers: CloudLayers; hasLayers: boolean } {
  const layers: CloudLayers = { low: 0, mid: 0, high: 0, total: 0 };
  let hasLayers = false;

  for (const layer of LAYER_ORDER) {
    const indices = pointsForLayer(plan, layer);
    const values: number[] = [];
    for (const i of indices) {
      const value = samples[i]?.[layer];
      if (value !== null && value !== undefined) values.push(value);
    }
    if (values.length > 0) {
      hasLayers = true;
      layers[layer] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }

  layers.total = hasLayers
    ? randomOverlapTotal(layers.low, layers.mid, layers.high)
    : (samples[0]?.total ?? 0);

  return { layers, hasLayers };
}

/** Percentil per interpolació lineal sobre una sèrie JA ORDENADA. */
export function percentile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/* --------------------------------------------------------- el llindar */

/**
 * Puntuació mínima perquè un membre compti com a «aquí veus la totalitat».
 *
 * ÉS `BAND_CLEAR_MIN` I S'IMPORTA, no es copia. És el mateix 70 amb què tota
 * l'aplicació pinta el verd, i el motiu de lligar-los és que si no, el mapa i
 * la fitxa podrien dir coses diferents del mateix cel: «divuit de cinquanta-un
 * escenaris et deixen veure-ho» al costat d'una xifra pintada de groc seria
 * l'usuari havent de decidir a quin dels dos fer cas. Un sol llindar, un sol
 * color, una sola frase.
 *
 * Val la pena saber què deixa fora: un vel de cirrus SENCER puntua 65 i queda
 * per sota del llindar, tot i que a través d'un vel de cirrus la corona encara
 * es veu (`layers.ts` ho diu i els 0,65 de transmissió són seus). O sigui que
 * la fracció és conservadora a posta. Per això `byBand` també publica els
 * membres de la banda «depèn»: qui hagi d'escriure la frase té el número
 * exacte de membres que no són ni un sí ni un no, i no ha d'inventar-se cap
 * segon llindar pel seu compte.
 */
export const ENSEMBLE_VISIBLE_MIN_SCORE = BAND_CLEAR_MIN;

/* ------------------------------------------------ l'acord, que es mesura */

/**
 * Talls de l'acord mesurat cap a les quatre fiabilitats de sempre.
 *
 * Es reutilitza `Confidence` i no s'inventa cap escala nova perquè la
 * interfície ja sap pintar-ne quatre i ja en té les etiquetes traduïdes. El
 * que canvia no és l'escala: és d'on surt el valor. Abans sortia del
 * calendari; ara surt de comptar en quants futurs passa el mateix.
 */
export const AGREEMENT_HIGH = 0.85;
export const AGREEMENT_MEDIUM = 0.6;
export const AGREEMENT_LOW = 0.3;

/**
 * Quant s'assemblen entre ells els membres del conjunt, de 0 a 1.
 *
 * Es mesuren DUES coses i es queda la millor, i el `max` és deliberat:
 *
 *  1. `verdict = |2f − 1|`, com de repartit està el vot. Val 1 quan tots els
 *     membres cauen del mateix cantó del llindar i 0 quan es reparteixen
 *     meitat i meitat.
 *  2. `1 − (p90 − p10)/100`, com d'aprop són els números entre ells.
 *
 * Per què la millor i no la pitjor. La primera mesura sola té un defecte de
 * frontera: cinquanta membres que puntuessin 69 i 71 estarien tots d'acord
 * —que el cel serà just al límit— i el vot sortiria 50/50, o sigui que
 * declararíem «no en sabem res» d'una previsió unànime. La segona sola també
 * en té un: quinze membres a 0 i quinze a 100 tenen un vot clarament partit i
 * això s'ha de dir encara que... bé, aquí totes dues coincideixen. Quedar-se
 * amb la millor de les dues vol dir «el conjunt és fiable si els membres es
 * posen d'acord en el veredicte O en el número», i el cas de frontera deixa de
 * comptar com a desacord perquè no ho és.
 *
 * Els dos casos que manen, i que tenen prova pròpia:
 *  · membres tots idèntics → verdict 1 → acord 1 → fiabilitat MÀXIMA.
 *  · meitat a cel net i meitat a estrat tancat → verdict 0 i decils separats
 *    de banda a banda → acord ≈ 0 → fiabilitat MÍNIMA.
 */
export function measureAgreement(
  sortedScores: readonly number[],
  favourableFraction: number,
): number {
  if (sortedScores.length === 0) return 0;
  const verdict = Math.abs(2 * favourableFraction - 1);
  const spread = (percentile(sortedScores, 0.9) - percentile(sortedScores, 0.1)) / 100;
  return Math.min(1, Math.max(0, Math.max(verdict, 1 - spread)));
}

/** L'acord mesurat, dit amb l'escala de fiabilitat que la interfície ja pinta. */
export function confidenceForAgreement(agreement: number): Confidence {
  if (agreement >= AGREEMENT_HIGH) return 'high';
  if (agreement >= AGREEMENT_MEDIUM) return 'medium';
  if (agreement >= AGREEMENT_LOW) return 'low';
  return 'very-low';
}

/* ------------------------------------------------------------- l'agregat */

/**
 * Membres mínims perquè el conjunt tingui dret a parlar.
 *
 * Amb menys de deu escenaris, «tres de cada quatre» és una frase amb més
 * precisió aparent que informació, i la fiabilitat mesurada seria soroll. Per
 * sota d'això el conjunt no es publica i queda el camí determinista, que és
 * exactament el que hi havia abans i no ha empitjorat gens.
 */
export const MIN_ENSEMBLE_MEMBERS = 10;

/** Un membre ja projectat sobre la visual i puntuat. */
export interface ScoredMember {
  modelId: string;
  member: number;
  score: number;
  band: SkyBand;
  layers: CloudLayers;
}

/**
 * Puntua cada membre pel seu compte, projectant-lo sobre la línia de visió.
 *
 * `byPoint` són les respostes del conjunt en el MATEIX ordre que
 * `plan.points`: la posició d'un punt dins de la llista és el que lliga la
 * lectura amb la capa que s'hi ha de llegir, igual que al camí determinista.
 *
 * Un membre que no aparegui en tots els punts del pla no es descarta: es
 * llegeix on hi sigui i `combineAlongLineOfSight` ja promitja només sobre les
 * lectures que existeixen. El que sí que es descarta és el membre que no doni
 * cap capa ni cap total enlloc, perquè aleshores no és cap escenari.
 */
export function scoreEnsembleMembers(
  plan: SamplingPlan,
  byPoint: readonly { members: readonly EnsembleMember[] }[],
  targetTimeMs: number,
): ScoredMember[] {
  /** «model|membre» → lectura crua a cada punt del pla. */
  const samplesByMember = new Map<string, RawSample[]>();
  const identity = new Map<string, { modelId: string; member: number }>();

  const empty: RawSample = { low: null, mid: null, high: null, total: null, visibility: null };

  byPoint.forEach((point, pointIndex) => {
    for (const member of point.members) {
      const id = `${member.modelId}|${member.member}`;
      let samples = samplesByMember.get(id);
      if (!samples) {
        samples = new Array<RawSample>(plan.points.length).fill(empty);
        samplesByMember.set(id, samples);
        identity.set(id, { modelId: member.modelId, member: member.member });
      }
      // Cada punt pot tenir la seva pròpia graella temporal: es busca l'índex
      // dins de cada resposta, com fa el camí determinista.
      const index = nearestIndex(member.hourly, targetTimeMs);
      if (index >= 0 && pointIndex < samples.length) {
        samples[pointIndex] = readSample(member.hourly, index);
      }
    }
  });

  const scored: ScoredMember[] = [];
  for (const [id, samples] of samplesByMember) {
    const who = identity.get(id);
    if (!who) continue;
    const hasAnything = samples.some(
      (s) => s.low !== null || s.mid !== null || s.high !== null || s.total !== null,
    );
    if (!hasAnything) continue;

    const { layers, hasLayers } = combineAlongLineOfSight(plan, samples);
    const score = scoreCloudLayers(layers, hasLayers);
    scored.push({
      modelId: who.modelId,
      member: who.member,
      score: score.score,
      band: score.band,
      layers,
    });
  }

  return scored;
}

/** Mediana d'una llista qualsevol. Ordena una còpia i no toca l'original. */
function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return percentile([...values].sort((a, b) => a - b), 0.5);
}

/**
 * Ajunta els membres ja puntuats en el resum que veurà la interfície.
 *
 * Torna `null` quan no hi ha prou membres: el conjunt no es publica a mitges,
 * i qui el cridi es queda amb el camí determinista sense assabentar-se de res.
 */
export function summariseEnsemble(
  scored: readonly ScoredMember[],
  labels: ReadonlyMap<string, string>,
): EnsembleSummary | null {
  if (scored.length < MIN_ENSEMBLE_MEMBERS) return null;

  const scores = scored.map((m) => m.score).sort((a, b) => a - b);
  const favourableCount = scored.filter(
    (m) => m.score >= ENSEMBLE_VISIBLE_MIN_SCORE,
  ).length;
  const favourableFraction = favourableCount / scored.length;

  const byBand: Record<SkyBand, number> = { clear: 0, partial: 0, cloudy: 0 };
  for (const m of scored) byBand[m.band]++;

  const agreement = measureAgreement(scores, favourableFraction);

  const modelIds = [...new Set(scored.map((m) => m.modelId))];
  const models: EnsembleModelReport[] = modelIds.map((modelId) => {
    const mine = scored.filter((m) => m.modelId === modelId);
    return {
      modelId,
      label: labels.get(modelId) ?? modelId,
      memberCount: mine.length,
      favourableCount: mine.filter((m) => m.score >= ENSEMBLE_VISIBLE_MIN_SCORE).length,
      medianScore: medianOf(mine.map((m) => m.score)),
    };
  });

  // Les capes medianes es calculen capa a capa i NO es tornen a puntuar: són
  // per ensenyar al costat, i el número que decideix ja està comptat a dalt.
  const medianLayers: CloudLayers = {
    low: medianOf(scored.map((m) => m.layers.low)),
    mid: medianOf(scored.map((m) => m.layers.mid)),
    high: medianOf(scored.map((m) => m.layers.high)),
    total: medianOf(scored.map((m) => m.layers.total)),
  };

  return {
    memberCount: scored.length,
    favourableCount,
    favourableFraction,
    thresholdScore: ENSEMBLE_VISIBLE_MIN_SCORE,
    byBand,
    scores,
    medianScore: percentile(scores, 0.5),
    p10: percentile(scores, 0.1),
    p90: percentile(scores, 0.9),
    agreement,
    confidence: confidenceForAgreement(agreement),
    models,
    medianLayers,
  };
}

/** La banda de la fracció, per si la interfície l'ha de pintar. */
export function bandForEnsemble(summary: EnsembleSummary): SkyBand {
  return bandForScore(summary.medianScore);
}
