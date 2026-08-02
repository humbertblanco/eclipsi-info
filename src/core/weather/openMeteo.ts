/**
 * Client d'Open-Meteo (https://open-meteo.com).
 *
 * Per què Open-Meteo i no una altra: és gratuït per a ús no comercial, no
 * demana cap clau d'API (o sigui que no hi ha cap secret a amagar dins d'una
 * aplicació que és tota client), publica el desglossament de núvols per capes
 * —que és l'única cosa que ens interessa de veritat— i accepta diverses
 * coordenades en una sola petició, cosa que fa viable mostrejar la línia de
 * visió. Llicència de les dades: CC-BY 4.0, amb atribució obligatòria a la
 * interfície.
 *
 * Límits del pla gratuït: 600 peticions per minut, 5.000 per hora, 10.000 per
 * dia. Una consulta completa nostra en gasta una (previsió) o quinze
 * (climatologia, una per any d'arxiu), i totes dues es desen a la memòria cau.
 *
 * DUES API DIFERENTS, I NO ES PODEN CONFONDRE:
 *  - /v1/forecast  → model numèric, fins a 16 dies. Diu QUÈ PASSARÀ.
 *  - /v1/archive   → reanàlisi ERA5 des de 1940. Diu QUÈ VA PASSAR.
 * El mòdul d'orquestració tria l'una o l'altra i ho marca al resultat; aquí
 * només hi ha el transport.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { CloudOutlookError, type LocalisedText } from './types';

export const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
export const ARCHIVE_ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive';

/**
 * Atribució obligatòria per la llicència CC-BY 4.0 de les dades.
 *
 * El nom del servei i la sigla de la llicència no es tradueixen mai —són el
 * que fa que l'atribució serveixi de res—; l'única part que canvia és la
 * frase que els envolta.
 */
export const OPEN_METEO_ATTRIBUTION: LocalisedText = {
  ca: 'Dades meteorològiques d’Open-Meteo.com (CC BY 4.0)',
  es: 'Datos meteorológicos de Open-Meteo.com (CC BY 4.0)',
};

/** Horitzó màxim del model numèric, en dies. Passat això no hi ha previsió. */
export const MAX_FORECAST_DAYS = 16;

/**
 * Retard de la reanàlisi ERA5, en dies. L'arxiu no arriba fins a avui i
 * demanar-li dades massa recents torna forats.
 */
export const ARCHIVE_LAG_DAYS = 6;

/** Temps màxim d'espera. Al camp, amb cobertura dolenta, val més fallar aviat. */
const REQUEST_TIMEOUT_MS = 12_000;

/** Variables horàries que demanem a la previsió. */
export const FORECAST_HOURLY = [
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'visibility',
] as const;

/**
 * Variables horàries de l'arxiu.
 *
 * `visibility` NO existeix a la reanàlisi ERA5: és una variable diagnòstica
 * dels models de previsió, no de l'arxiu. Demanar-la fa fallar tota la
 * petició, així que la climatologia va sense extinció per aerosols i la
 * interfície ho ha de dir.
 */
export const ARCHIVE_HOURLY = [
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
] as const;

/** Sèries horàries tal com les torna l'API. Els forats venen com a `null`. */
export interface HourlySeries {
  /** Instants en segons d'època (demanem `timeformat=unixtime`). */
  time: number[];
  cloud_cover?: (number | null)[];
  cloud_cover_low?: (number | null)[];
  cloud_cover_mid?: (number | null)[];
  cloud_cover_high?: (number | null)[];
  visibility?: (number | null)[];
}

/** Resposta d'un punt. Amb diverses coordenades l'API torna un array d'aquests. */
export interface PointResponse {
  latitude: number;
  longitude: number;
  /** Altitud del model per a la cel·la, en m. No és la teva, és la de la malla. */
  elevation: number;
  hourly: HourlySeries;
}

export interface QueryPoint {
  lat: number;
  lon: number;
}

interface FetchOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Normalitza la resposta: amb una coordenada l'API torna un objecte i amb
 * diverses torna un array. Aquí sempre és un array, en el mateix ordre en què
 * hem demanat els punts.
 */
function normalizeResponse(payload: unknown): PointResponse[] {
  const list = Array.isArray(payload) ? payload : [payload];
  return list.map((entry) => {
    const point = entry as Partial<PointResponse> & { error?: boolean; reason?: string };
    if (point.error) {
      throw new CloudOutlookError(point.reason ?? 'Resposta d’error d’Open-Meteo');
    }
    if (!point.hourly || !Array.isArray(point.hourly.time)) {
      throw new CloudOutlookError('Resposta d’Open-Meteo sense sèrie horària');
    }
    return {
      latitude: point.latitude ?? 0,
      longitude: point.longitude ?? 0,
      elevation: point.elevation ?? 0,
      hourly: point.hourly,
    };
  });
}

async function requestJson(url: string, options: FetchOptions): Promise<unknown> {
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') {
    throw new CloudOutlookError('Aquest entorn no té `fetch`');
  }

  // Doble avortament: el de qui ens ha cridat i el nostre temps màxim.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    const response = await doFetch(url, { signal: controller.signal });
    if (!response.ok) {
      // Open-Meteo posa el motiu dins del cos fins i tot amb 400.
      let reason = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { reason?: string };
        if (body?.reason) reason = body.reason;
      } catch {
        /* cos no llegible: ens quedem amb el codi */
      }
      throw new CloudOutlookError(`Open-Meteo ha respost ${reason}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof CloudOutlookError) throw error;
    // Xarxa caiguda, temps esgotat o JSON trencat. Cap dels tres es pot
    // explicar a l'usuari amb més detall que "no s'ha pogut": el que el
    // salva no és el motiu, és la dada desada que hi ha darrere.
    throw new CloudOutlookError('No s’ha pogut consultar Open-Meteo', 'unknown', error);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

/** Coordenades amb 4 decimals: ~11 m, molt per sota de la malla del model. */
function joinCoordinates(points: readonly QueryPoint[]): { lat: string; lon: string } {
  return {
    lat: points.map((p) => p.lat.toFixed(4)).join(','),
    lon: points.map((p) => p.lon.toFixed(4)).join(','),
  };
}

/** Instant UTC en el format `YYYY-MM-DDTHH:mm` que demana `start_hour`. */
export function toApiHour(timeMs: number): string {
  return new Date(timeMs).toISOString().slice(0, 16);
}

/** Data UTC en el format `YYYY-MM-DD`. */
export function toApiDate(timeMs: number): string {
  return new Date(timeMs).toISOString().slice(0, 10);
}

/**
 * Previsió horària per a un o més punts, en una sola petició.
 *
 * Fem servir `start_hour`/`end_hour` en comptes de `forecast_days` perquè
 * baixem exactament les hores que ens interessen: la resposta per a set punts
 * i cinc hores són 4 KB, mentre que setze dies sencers en serien més de 400.
 * Amb dades mòbils, al camp, la diferència es nota.
 *
 * Tot en UTC a posta: la zona horària local només serveix per PINTAR hores, i
 * barrejar-la amb el càlcul és la manera clàssica d'equivocar-se una hora.
 */
export async function fetchForecastWindow(
  points: readonly QueryPoint[],
  startMs: number,
  endMs: number,
  options: FetchOptions = {},
): Promise<PointResponse[]> {
  const { lat, lon } = joinCoordinates(points);
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: FORECAST_HOURLY.join(','),
    start_hour: toApiHour(startMs),
    end_hour: toApiHour(endMs),
    timeformat: 'unixtime',
    timezone: 'UTC',
  });
  const payload = await requestJson(`${FORECAST_ENDPOINT}?${params.toString()}`, options);
  return normalizeResponse(payload);
}

/**
 * Finestra d'arxiu per a un punt: tots els dies entre dues dates.
 *
 * Aquí no fem servir `start_hour` perquè volem una finestra de dies a banda i
 * banda de la data de l'eclipsi (l'atmosfera no sap quin dia és) i després ja
 * filtrem l'hora que ens interessa. Onze dies horaris són uns 25 KB.
 */
export async function fetchArchiveWindow(
  point: QueryPoint,
  startDateMs: number,
  endDateMs: number,
  options: FetchOptions = {},
): Promise<PointResponse> {
  const params = new URLSearchParams({
    latitude: point.lat.toFixed(4),
    longitude: point.lon.toFixed(4),
    hourly: ARCHIVE_HOURLY.join(','),
    start_date: toApiDate(startDateMs),
    end_date: toApiDate(endDateMs),
    timeformat: 'unixtime',
    timezone: 'UTC',
  });
  const payload = await requestJson(`${ARCHIVE_ENDPOINT}?${params.toString()}`, options);
  const [first] = normalizeResponse(payload);
  if (!first) throw new CloudOutlookError('L’arxiu d’Open-Meteo no ha tornat cap punt');
  return first;
}

/**
 * Índex de l'hora més propera a un instant dins d'una sèrie.
 * Torna −1 si la sèrie és buida o si la mostra més propera queda a més d'una
 * hora i mitja: val més no tenir dada que tenir-ne una d'una altra estona.
 */
export function nearestIndex(series: HourlySeries, timeMs: number): number {
  const targetSec = timeMs / 1000;
  let best = -1;
  let bestDelta = Infinity;
  for (let i = 0; i < series.time.length; i++) {
    const delta = Math.abs(series.time[i] - targetSec);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  return bestDelta <= 5400 ? best : -1;
}
