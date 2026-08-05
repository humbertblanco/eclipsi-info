/**
 * Orquestració: decidir QUINA dada té sentit demanar i com s'ha de qualificar.
 *
 * Aquí hi ha la regla que no es pot trencar: una previsió i una climatologia
 * no són la mateixa cosa i no s'han d'ensenyar mai amb la mateixa cara.
 *
 *  - A menys de setze dies hi ha model numèric. Diu què passarà, amb la
 *    fiabilitat que tingui, i la fiabilitat cau molt de pressa: la nuvolositat
 *    és de les variables amb menys traça de tot el butlletí, i a partir del
 *    cinquè dia una previsió de núvols val poc més que la climatologia.
 *  - A més de setze dies NO HI HA PREVISIÓ. Ni la nostra ni la de ningú. El
 *    que sí que hi ha és l'estadística: què va fer el cel aquell mateix dia i
 *    a aquella mateixa hora els últims quinze anys. És una altra pregunta, i
 *    respondre-la amb cara de previsió seria enganyar.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { readCachedOutlook, writeCachedOutlook } from './cache';
import {
  LAYER_ORDER,
  SCORING_VERSION,
  averageLayers,
  bandForScore,
  estimateHaze,
  scoreCloudLayers,
} from './layers';
import { planLineOfSight, planSignature, pointsForLayer } from './lineOfSight';
import {
  ARCHIVE_LAG_DAYS,
  MAX_FORECAST_DAYS,
  fetchArchiveWindow,
  fetchForecastWindow,
  nearestIndex,
  type HourlySeries,
  type PointResponse,
  type QueryPoint,
} from './openMeteo';
import {
  CloudOutlookError,
  type ClimatologyOutlook,
  type ClimatologyStats,
  type CloudLayers,
  type CloudOutlook,
  type CloudOutlookOptions,
  type CloudOutlookRequest,
  type Confidence,
  type ForecastOutlook,
  type LocalisedText,
  type OutlookMode,
  type SamplingPlan,
  type WeatherLocale,
} from './types';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Marge de seguretat sobre l'horitzó del model. Demanem previsió fins a 15
 * dies i no 16 perquè l'últim dia del model sovint arriba retallat segons
 * l'hora de la passada, i una petició que falla al camp no la vol ningú.
 */
const FORECAST_HORIZON_DAYS = MAX_FORECAST_DAYS - 1;

/** Anys d'arxiu que entren a la climatologia. */
export const CLIMATOLOGY_YEARS = 15;

/**
 * Dies a banda i banda de la data. L'atmosfera no sap quin dia del calendari
 * és: agafar ±5 dies multiplica per onze la mostra sense canviar el règim
 * meteorològic de l'estació.
 */
export const CLIMATOLOGY_WINDOW_DAYS = 5;

/**
 * Anys mínims perquè l'estadística valgui alguna cosa.
 *
 * S'exporta perquè `scripts/build-cloud-clim.ts` hi ha d'aplicar el MATEIX
 * llindar: una cel·la del mapa amb quatre anys darrere no és menys mentida que
 * una fitxa amb quatre anys darrere, i aquí es refusa de fer-la.
 */
export const CLIMATOLOGY_MIN_YEARS = 6;

/** Peticions d'arxiu simultànies. Quinze de cop escanyen una xarxa mòbil. */
const ARCHIVE_CONCURRENCY = 4;

/** Una previsió més vella que això s'ha de refrescar si hi ha xarxa. */
export const FORECAST_TTL_MS = 45 * 60 * 1000;

/** La climatologia de fa mig any és exactament la mateixa d'ara. */
export const CLIMATOLOGY_TTL_MS = 180 * DAY_MS;

/* ------------------------------------------------------------ decisions */

/** Dies entre ara i l'instant consultat. Negatiu si ja ha passat. */
export function leadDays(targetTimeMs: number, nowMs: number): number {
  return (targetTimeMs - nowMs) / DAY_MS;
}

/** Quina font té sentit per a aquesta data. */
export function outlookMode(targetTimeMs: number, nowMs: number): OutlookMode {
  const lead = leadDays(targetTimeMs, nowMs);
  // Deixem un dia de marge cap enrere: just després de l'eclipsi la previsió
  // encara hi és (l'API dona `past_days`) i és més informativa que l'arxiu.
  if (lead >= -1 && lead <= FORECAST_HORIZON_DAYS) return 'forecast';
  return 'climatology';
}

/**
 * Fiabilitat d'una previsió de nuvolositat segons l'antelació.
 *
 * La nuvolositat total és de les variables amb menys traça de la verificació
 * operativa de l'ECMWF: molt millor que l'atzar els primers dies, i pràcticament
 * indistingible de la climatologia a partir del vuitè. Els talls són a 2, 4 i 7
 * dies, i el que importa és que la interfície no ensenyi mai una xifra a deu
 * dies vista sense dir que no s'hi pot fiar.
 */
export function confidenceForLead(lead: number): Confidence {
  if (lead <= 2) return 'high';
  if (lead <= 4) return 'medium';
  if (lead <= 7) return 'low';
  return 'very-low';
}

/**
 * Fiabilitat d'una climatologia: depèn de quants anys hi hagi darrere.
 *
 * S'exporta perquè la capa de nuvolositat del mapa (`climGrid.ts` i
 * `mapMode.ts`) ha de qualificar exactament igual la mateixa estadística. Amb
 * els llindars copiats a l'altre fitxer, el dia que algú els mogués aquí la
 * fitxa del punt diria «fiabilitat mitjana» i la llegenda del mapa, just al
 * costat, en diria una altra.
 */
export function confidenceForYears(years: number): Confidence {
  if (years >= 12) return 'medium';
  if (years >= CLIMATOLOGY_MIN_YEARS) return 'low';
  return 'very-low';
}

export const CONFIDENCE_LABEL: Record<Confidence, LocalisedText> = {
  high: { ca: 'Alta', es: 'Alta', en: 'High', fr: 'Élevée' },
  medium: { ca: 'Mitjana', es: 'Media', en: 'Medium', fr: 'Moyenne' },
  low: { ca: 'Baixa', es: 'Baja', en: 'Low', fr: 'Faible' },
  'very-low': { ca: 'Molt baixa', es: 'Muy baja', en: 'Very low', fr: 'Très faible' },
};

/* ------------------------------------------------------- lectura de dades */

function readNumber(series: (number | null)[] | undefined, index: number): number | null {
  if (!series || index < 0 || index >= series.length) return null;
  const value = series[index];
  return value === null || value === undefined || !Number.isFinite(value) ? null : value;
}

interface RawSample {
  low: number | null;
  mid: number | null;
  high: number | null;
  total: number | null;
  visibility: number | null;
}

function readSample(series: HourlySeries, index: number): RawSample {
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
function combineAlongLineOfSight(
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

/* --------------------------------------------------------------- previsió */

async function buildForecast(
  request: CloudOutlookRequest,
  plan: SamplingPlan,
  nowMs: number,
  options: CloudOutlookOptions,
): Promise<ForecastOutlook> {
  const points: QueryPoint[] = plan.points.map((p) => ({ lat: p.lat, lon: p.lon }));

  // Una hora abans i una després: així `nearestIndex` sempre té veïns i una
  // hora que caigui just al límit de la passada no ens deixa sense dada.
  const responses = await fetchForecastWindow(
    points,
    request.targetTimeMs - HOUR_MS,
    request.targetTimeMs + HOUR_MS,
    { fetchImpl: options.fetchImpl, signal: options.signal },
  );

  if (responses.length !== points.length) {
    throw new CloudOutlookError(
      'Open-Meteo ha tornat menys punts dels demanats',
      'partial-points',
    );
  }

  const observerIndex = nearestIndex(responses[0].hourly, request.targetTimeMs);
  if (observerIndex < 0) {
    throw new CloudOutlookError('La previsió no cobreix l’hora de l’eclipsi', 'no-hour');
  }
  const validAtMs = responses[0].hourly.time[observerIndex] * 1000;

  // Cada punt pot tenir la seva pròpia graella temporal: busquem l'índex
  // dins de cada resposta i no reaprofitem el del primer punt.
  const samples: RawSample[] = responses.map((r: PointResponse) => {
    const index = nearestIndex(r.hourly, request.targetTimeMs);
    return index < 0
      ? { low: null, mid: null, high: null, total: null, visibility: null }
      : readSample(r.hourly, index);
  });

  const { layers, hasLayers } = combineAlongLineOfSight(plan, samples);
  const score = scoreCloudLayers(layers, hasLayers);

  // Visibilitat: mitjana dels punts que en donen. Amb el Sol baix la boirina
  // que t'esmorteeix el disc no és només la de sobre teu, és la de tot el
  // camí, i per això no ens quedem només amb la de l'observador.
  const visibilities = samples
    .map((s) => s.visibility)
    .filter((v): v is number => v !== null);
  const meanVisibility =
    visibilities.length > 0
      ? visibilities.reduce((a, b) => a + b, 0) / visibilities.length
      : null;

  const lead = Math.max(0, leadDays(request.targetTimeMs, nowMs));
  const confidence = confidenceForLead(lead);

  return {
    mode: 'forecast',
    location: request.location,
    targetTimeMs: request.targetTimeMs,
    fetchedAtMs: nowMs,
    stale: false,
    layers,
    score,
    sampling: plan,
    confidence,
    caveat: forecastCaveat(lead, confidence, score.fromTotalOnly, options.locale ?? 'ca'),
    leadDays: lead,
    validAtMs,
    haze: estimateHaze(meanVisibility, request.sunAltitudeDeg),
  };
}

/** Què val una previsió segons l'antelació, dit sense embuts. */
const FORECAST_CAVEAT_BASE: Record<Confidence, LocalisedText> = {
  high: {
    ca: 'Previsió a poques hores vista. És el millor que es pot saber.',
    es: 'Previsión a pocas horas vista. Es lo mejor que se puede saber.', en: 'Short-range forecast. This is the most reliable information currently available.',
    fr: 'Prévision à très court terme. C’est l’information la plus fiable actuellement disponible.',
  },
  medium: {
    ca: 'Previsió a mig termini. La posició exacta dels núvols encara ballarà.',
    es: 'Previsión a medio plazo. La posición exacta de las nubes todavía bailará.', en: 'Medium-range forecast. The exact position of the clouds may still change.',
    fr: 'Prévision à moyen terme. La position exacte des nuages peut encore changer.',
  },
  low: {
    ca: 'Previsió llunyana. Serveix per a la tendència, no per decidir.',
    es: 'Previsión lejana. Sirve para la tendencia, no para decidir.', en: 'Long-range forecast. Use it for the overall trend, not for final decisions.',
    fr: 'Prévision lointaine. Utilisez-la pour la tendance, pas pour une décision finale.',
  },
  'very-low': {
    ca: 'Previsió al límit del model. Torna-hi quan falti menys d’una setmana.',
    es: 'Previsión al límite del modelo. Vuelve cuando falte menos de una semana.', en: 'Forecast at the limit of the model. Come back when it\'s less than a week away.',
    fr: 'Prévision à la limite du modèle. Revenez à moins d’une semaine de l’éclipse.',
  },
};

/** L'avís de quan el model no ha donat les tres capes. */
const FROM_TOTAL_ONLY_NOTE: LocalisedText = {
  ca: ' El model no ha donat el desglossament per capes: la xifra és grollera.',
  es: ' El modelo no ha dado el desglose por capas: la cifra es tosca.', en: ' The model did not provide a layer breakdown, so this figure is approximate.',
  fr: ' Le modèle n’a pas fourni le détail par couches : ce chiffre est approximatif.',
};

/**
 * S'exporta perquè el `caveat` s'ha de poder TORNAR A ESCRIURE sense tornar a
 * consultar res: la frase viatja dins de l'objecte desat a la memòria cau, i
 * el dia que algú canviï d'idioma amb una dada desada al davant, la frase s'ha
 * de refer amb el que ja tenim. Vegeu `localiseCaveat`.
 */
export function forecastCaveat(
  lead: number,
  confidence: Confidence,
  fromTotalOnly: boolean,
  locale: WeatherLocale = 'ca',
): string {
  const base = FORECAST_CAVEAT_BASE[confidence][locale];
  const days =
    locale === 'fr'
      ? `Encore ${lead.toFixed(1)} jours.`
      : locale === 'en'
      ? `${lead.toFixed(1)} days remaining.`
      : locale === 'es'
        ? `Faltan ${lead.toFixed(1)} días.`
        : `Falten ${lead.toFixed(1)} dies.`;
  const extra = fromTotalOnly ? FROM_TOTAL_ONLY_NOTE[locale] : '';
  return `${days} ${base}${extra}`;
}

/**
 * La frase que impedeix que una climatologia es llegeixi com una previsió.
 *
 * El «NO» va en majúscules a posta i en tots dos idiomes: és l'única part
 * d'aquest mòdul que evita que algú planifiqui un viatge de sis-cents
 * quilòmetres amb una estadística de quinze anys creient que sap què farà el
 * cel el dia 12.
 */
export function climatologyCaveat(years: number, locale: WeatherLocale = 'ca'): string {
  if (locale === 'fr') {
    return `Ce n’est PAS une prévision. Elle montre l’état du ciel à ces mêmes dates pendant les ${years} dernières années. Utilisez-la pour choisir votre destination, pas pour savoir si vous verrez l’éclipse.`;
  }
  if (locale === 'en') {
    return (
      'This is NOT a forecast. It shows what the sky was like on these dates over ' +
      `the past ${years} years. Use it to choose where to go, not to know whether you will see the eclipse.`
    );
  }
  if (locale === 'es') {
    return (
      'Esto NO es una previsión. Es lo que hizo el cielo estos mismos días ' +
      `los últimos ${years} años. Sirve para elegir adónde vas, no para saber si verás algo.`
    );
  }
  return (
    'Això NO és una previsió. És el que va fer el cel aquests mateixos dies ' +
    `els últims ${years} anys. Serveix per triar on vas, no per saber si veuràs res.`
  );
}

/**
 * Reescriu el `caveat` d'un resultat en l'idioma demanat.
 *
 * PER QUÈ L'IDIOMA NO ENTRA A LA CLAU DE LA MEMÒRIA CAU. Tot el que hi ha
 * desat són números, i els números no canvien de llengua. Si l'idioma formés
 * part de la clau, canviar el selector de la capçalera invalidaria la dada i
 * dispararia una consulta nova —quinze peticions d'arxiu, en el cas de la
 * climatologia— per reescriure una frase que ja podem reconstruir aquí amb el
 * que l'objecte porta a dins. Al camp, amb cobertura dolenta, això és la
 * diferència entre canviar d'idioma i quedar-se sense dada.
 */
function localiseCaveat(outlook: CloudOutlook, locale: WeatherLocale): CloudOutlook {
  if (outlook.mode === 'forecast') {
    return {
      ...outlook,
      caveat: forecastCaveat(
        outlook.leadDays,
        outlook.confidence,
        outlook.score.fromTotalOnly,
        locale,
      ),
    };
  }
  return { ...outlook, caveat: climatologyCaveat(outlook.stats.years, locale) };
}

/* ----------------------------------------------------------- climatologia */

function percentile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Distància circular entre dues hores del dia, en hores (0 a 12). */
function hourDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}

/** Executa promeses amb un límit de simultaneïtat. */
async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

async function buildClimatology(
  request: CloudOutlookRequest,
  plan: SamplingPlan,
  nowMs: number,
  options: CloudOutlookOptions,
): Promise<ClimatologyOutlook> {
  const target = new Date(request.targetTimeMs);
  const month = target.getUTCMonth();
  const day = target.getUTCDate();
  const targetHour = target.getUTCHours() + target.getUTCMinutes() / 60;

  // L'arxiu ERA5 arriba amb uns dies de retard: l'últim any complet és el de
  // la data límit, i no el d'avui, si el calendari encara no hi ha arribat.
  const limitMs = nowMs - ARCHIVE_LAG_DAYS * DAY_MS;
  let lastYear = new Date(limitMs).getUTCFullYear();
  if (Date.UTC(lastYear, month, day + CLIMATOLOGY_WINDOW_DAYS) > limitMs) lastYear -= 1;

  const years: number[] = [];
  for (let y = lastYear - CLIMATOLOGY_YEARS + 1; y <= lastYear; y++) years.push(y);

  const point: QueryPoint = { lat: request.location.lat, lon: request.location.lon };
  const settled = await mapWithLimit(years, ARCHIVE_CONCURRENCY, (year) =>
    fetchArchiveWindow(
      point,
      Date.UTC(year, month, day - CLIMATOLOGY_WINDOW_DAYS),
      Date.UTC(year, month, day + CLIMATOLOGY_WINDOW_DAYS),
      { fetchImpl: options.fetchImpl, signal: options.signal },
    ),
  );

  const scores: number[] = [];
  const layerSamples: CloudLayers[] = [];
  let usableYears = 0;

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    const series = result.value.hourly;
    let yearHadData = false;

    for (let i = 0; i < series.time.length; i++) {
      const stamp = new Date(series.time[i] * 1000);
      if (hourDistance(stamp.getUTCHours(), targetHour) > 1) continue;

      const raw = readSample(series, i);
      const hasLayers = raw.low !== null || raw.mid !== null || raw.high !== null;
      const layers: CloudLayers = {
        low: raw.low ?? 0,
        mid: raw.mid ?? 0,
        high: raw.high ?? 0,
        total: raw.total ?? 0,
      };
      if (!hasLayers && raw.total === null) continue;

      yearHadData = true;
      layerSamples.push(layers);
      scores.push(scoreCloudLayers(layers, hasLayers).score);
    }

    if (yearHadData) usableYears++;
  }

  if (usableYears < CLIMATOLOGY_MIN_YEARS) {
    throw new CloudOutlookError(
      'L’arxiu d’Open-Meteo no ha donat prou anys per fer una climatologia',
      'not-enough-years',
    );
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const stats: ClimatologyStats = {
    meanScore: mean,
    medianScore: percentile(sorted, 0.5),
    p25: percentile(sorted, 0.25),
    p75: percentile(sorted, 0.75),
    clearFraction: scores.filter((s) => bandForScore(s) === 'clear').length / scores.length,
    cloudyFraction:
      scores.filter((s) => bandForScore(s) === 'cloudy').length / scores.length,
    years: usableYears,
    sampleCount: scores.length,
  };

  const layers = averageLayers(layerSamples);
  // La puntuació que ensenyem és la MITJANA de les puntuacions any per any, no
  // la puntuació de la nuvolositat mitjana. No és el mateix: la mitjana de
  // "net, net, tapat, tapat" no és "mig tapat sempre", i per a decidir on vas
  // el que importa és quantes vegades va sortir bé.
  const score = { ...scoreCloudLayers(layers), score: Math.round(mean) };
  score.band = bandForScore(score.score);

  const confidence = confidenceForYears(usableYears);

  return {
    mode: 'climatology',
    location: request.location,
    targetTimeMs: request.targetTimeMs,
    fetchedAtMs: nowMs,
    stale: false,
    layers,
    score,
    // La climatologia només s'ha consultat al punt de l'observador: quinze
    // anys per set punts serien més de cent peticions. Conservem la geometria
    // per poder-la explicar, però marquem que no s'ha fet servir.
    sampling: { ...plan, lineOfSightUsed: false },
    confidence,
    caveat: climatologyCaveat(usableYears, options.locale ?? 'ca'),
    stats,
    firstYear: lastYear - CLIMATOLOGY_YEARS + 1,
    lastYear,
    windowDays: CLIMATOLOGY_WINDOW_DAYS,
    haze: null,
  };
}

/* ------------------------------------------------------------ punt d'entrada */

function cacheKey(
  request: CloudOutlookRequest,
  plan: SamplingPlan,
  mode: OutlookMode,
): string {
  const la = request.location.lat.toFixed(3);
  const lo = request.location.lon.toFixed(3);
  if (mode === 'forecast') {
    const hour = Math.round(request.targetTimeMs / HOUR_MS);
    return `v${SCORING_VERSION}:f:${la},${lo}:${hour}:${planSignature(plan)}`;
  }
  const target = new Date(request.targetTimeMs);
  const stamp = `${target.getUTCMonth() + 1}-${target.getUTCDate()}-${target.getUTCHours()}`;
  return `v${SCORING_VERSION}:c:${la},${lo}:${stamp}:${CLIMATOLOGY_YEARS}`;
}

/**
 * Previsió o climatologia de nuvolositat per a un lloc i un instant.
 *
 * Ordre de preferència, i és deliberat:
 *  1. Memòria cau encara fresca → es torna sense tocar la xarxa.
 *  2. Consulta nova a Open-Meteo.
 *  3. Si la xarxa falla, l'última dada desada, marcada amb `stale: true` i amb
 *     la seva `fetchedAtMs` original perquè la interfície en pugui dir l'edat.
 *  4. Si no hi ha ni xarxa ni dada desada, llança `CloudOutlookError`.
 *
 * El pas 3 és el que fa que això serveixi de res al camp.
 */
export async function getCloudOutlook(
  request: CloudOutlookRequest,
  options: CloudOutlookOptions = {},
): Promise<CloudOutlook> {
  const nowMs = options.nowMs ?? Date.now();
  const locale = options.locale ?? 'ca';
  const mode = outlookMode(request.targetTimeMs, nowMs);
  const plan = planLineOfSight(
    request.location.lat,
    request.location.lon,
    request.sunAzimuthDeg,
    request.sunAltitudeDeg,
  );
  const key = cacheKey(request, plan, mode);
  const ttl = mode === 'forecast' ? FORECAST_TTL_MS : CLIMATOLOGY_TTL_MS;

  const cached = await readCachedOutlook(key);
  // La frescor es mesura amb `fetchedAtMs` i no amb la data del registre:
  // `fetchedAtMs` és l'instant que la interfície ensenya com a edat de la
  // dada, i les dues xifres han de sortir sempre del mateix rellotge.
  if (!options.forceRefresh && cached && nowMs - cached.outlook.fetchedAtMs < ttl) {
    return localiseCaveat(cached.outlook, locale);
  }

  try {
    const outlook =
      mode === 'forecast'
        ? await buildForecast(request, plan, nowMs, options)
        : await buildClimatology(request, plan, nowMs, options);
    await writeCachedOutlook(key, outlook);
    return outlook;
  } catch (error) {
    if (cached) return localiseCaveat({ ...cached.outlook, stale: true }, locale);
    throw error instanceof CloudOutlookError
      ? error
      : new CloudOutlookError('No s’ha pogut obtenir la nuvolositat', 'unknown', error);
  }
}
