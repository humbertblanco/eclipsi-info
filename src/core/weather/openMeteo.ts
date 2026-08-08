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
 * TRES API DIFERENTS, I NO ES PODEN CONFONDRE:
 *  - /v1/forecast  → model numèric, fins a 16 dies. Diu QUÈ PASSARÀ.
 *  - /v1/archive   → reanàlisi ERA5 des de 1940. Diu QUÈ VA PASSAR.
 *  - /v1/ensemble  → el mateix model corregut moltes vegades amb condicions
 *                    inicials pertorbades. Diu QUANTS ESCENARIS ACABEN BÉ, que
 *                    és una pregunta diferent de les altres dues.
 * El mòdul d'orquestració tria què demana i ho marca al resultat; aquí només
 * hi ha el transport.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { CloudOutlookError, type LocalisedText } from './types';

export const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
export const ARCHIVE_ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive';

/**
 * API del conjunt. Un amfitrió diferent de la previsió determinista, i per
 * això s'ha hagut de declarar a `features/about/credits.ts`: la prova
 * `tests/credits-de-les-fonts.test.ts` busca els amfitrions dins del codi i no
 * deixa passar cap servidor que serveixi una dada que l'app ensenyi.
 */
export const ENSEMBLE_ENDPOINT = 'https://ensemble-api.open-meteo.com/v1/ensemble';

/**
 * Atribució obligatòria per la llicència CC-BY 4.0 de les dades.
 *
 * El nom del servei i la sigla de la llicència no es tradueixen mai —són el
 * que fa que l'atribució serveixi de res—; l'única part que canvia és la
 * frase que els envolta.
 */
export const OPEN_METEO_ATTRIBUTION: LocalisedText = {
  ca: 'Dades meteorològiques d’Open-Meteo.com (CC BY 4.0)',
  es: 'Datos meteorológicos de Open-Meteo.com (CC BY 4.0)', en: 'Weather data from Open-Meteo.com (CC BY 4.0)', fr: 'Données météorologiques d’Open-Meteo.com (CC BY 4.0)',
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

/* ------------------------------------------------------------- el conjunt */

/**
 * QUIN MODEL DEL CONJUNT ENTRA, I PER QUÈ NOMÉS UN.
 *
 * Mesurat el 8-8-2026 contra `ensemble-api.open-meteo.com/v1/ensemble`, un sol
 * punt de la franja (41,5 N / 2,5 O) i l'hora del màxim (2026-08-12T20:00Z).
 * La taula és el que va tornar cada model, comptant quantes de les sèries
 * publicades portaven ALGUN valor no nul:
 *
 *   model                        membres  cloud_cover  low/mid/high  visibility
 *   ecmwf_ifs025_ensemble             51    51/51         51/51          0/51
 *   icon_seamless_eps                 40    40/40          0/40          0/40
 *   icon_global_eps                   40    40/40          0/40          0/40
 *   icon_eu_eps                       40    40/40          0/40          0/40
 *   ncep_gefs025 / gefs05 / seamless  31    31/31          0/31         31/31
 *   gem_global_ensemble               21    21/21          0/21          0/21
 *   bom_access_global_ensemble        18     0/18          0/18          0/18
 *   ecmwf_ifs04                        1      0/1           0/1           0/1
 *
 * LA TRAMPA QUE AIXÒ DESTAPA: l'API publica les claus `cloud_cover_low`,
 * `_mid` i `_high` per a TOTS els models, amb els seus quaranta o trenta
 * membres, i les omple de `null`. Qui compti claus en comptes de mirar valors
 * es pensarà que té tres capes de tres models i estarà puntuant no-res. Es va
 * comptar claus primer i la taula deia que hi eren totes.
 *
 * Per tant l'acord entre models que demanava la feina (ICON diu que sí, GFS
 * diu que no) NOMÉS ES POT FER SOBRE LA NUVOLOSITAT TOTAL, i la nuvolositat
 * total és justament el que aquest projecte va decidir no fer servir mai sol:
 * un 90 % de cirrus i un 90 % d'estrats són el mateix número i eclipsis
 * diferents. Entre tenir tres models sense capes i un model amb capes
 * projectades sobre la visual, guanya el segon, i aquest comentari és perquè
 * qui hi torni no ho hagi de tornar a mesurar per descobrir-ho.
 *
 * `AROME` no hi surt perquè no és un conjunt: `meteofrance_arome_france` a
 * aquest endpoint torna UNA sèrie, i plena de `null`. Fora de la seva
 * cobertura, el cos de la resposta arriba amb `"latitude":nan` —que no és JSON
 * vàlid i `JSON.parse` rebutja—, o sigui que un model fora de zona no torna
 * dades dolentes: fa caure la petició sencera. Per això no hi ha cap
 * substitució silenciosa: no hi ha res a substituir.
 */
export interface EnsembleModel {
  /** El que s'envia a `models=`. */
  readonly id: string;
  /**
   * El sufix amb què torna les claus, que NO és el mateix: es demana
   * `ecmwf_ifs025` i torna `..._ecmwf_ifs025_ensemble`. Només apareix quan es
   * demana més d'un model; amb un de sol les claus van sense sufix.
   */
  readonly suffix: string;
  /** Membres que va servir el dia de la mesura. Serveix per notar-ne la falta. */
  readonly measuredMembers: number;
  /** Nom curt per a l'atribució. No es tradueix: és el nom propi del model. */
  readonly label: string;
}

export const ENSEMBLE_MODELS: readonly EnsembleModel[] = [
  {
    id: 'ecmwf_ifs025',
    suffix: 'ecmwf_ifs025_ensemble',
    measuredMembers: 51,
    label: 'ECMWF IFS 0,25°',
  },
];

/**
 * Horitzó del conjunt, en dies. Mesurat: `ecmwf_ifs025` va servir 360 hores
 * plenes amb `forecast_days=15`. És el mateix horitzó útil que la previsió
 * determinista, i per tant el conjunt no allarga mai el que ja diem.
 */
export const MAX_ENSEMBLE_DAYS = 15;

/**
 * Variables que demanem al conjunt.
 *
 * Les mateixes que a la previsió MENYS `visibility`, que per a ECMWF torna
 * buida (vegeu la taula). Demanar-la no falla, però ompliria la resposta de
 * cinquanta-una sèries de `null`, i el mòdul de boirina ja té la seva dada del
 * camí determinista, que sí que la serveix.
 */
export const ENSEMBLE_HOURLY = [
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
] as const;

/** Una passada del conjunt: un model i un número de membre. */
export interface EnsembleMember {
  /** `id` del model d'`ENSEMBLE_MODELS`. */
  modelId: string;
  /** 0 és la sèrie sense sufix (el control); 1..N són els `_memberNN`. */
  member: number;
  /** Les mateixes sèries que la previsió determinista, per a aquest membre. */
  hourly: HourlySeries;
}

/** Resposta del conjunt per a un punt: el mateix instant vist N vegades. */
export interface EnsemblePointResponse {
  latitude: number;
  longitude: number;
  elevation: number;
  members: EnsembleMember[];
}

/** Les variables ordenades de més llarga a més curta. Vegeu `splitMemberKey`. */
const ENSEMBLE_VARIABLES_BY_LENGTH = [...ENSEMBLE_HOURLY].sort(
  (a, b) => b.length - a.length,
);

type EnsembleVariable = (typeof ENSEMBLE_HOURLY)[number];

/**
 * Desmunta una clau de l'API del conjunt en variable, membre i model.
 *
 * QUATRE FORMES, I S'HAN DE SABER TOTES QUATRE. Mesurades el 8-8-2026:
 *
 *   cloud_cover_low                              un model, control
 *   cloud_cover_low_member07                     un model, membre 7
 *   cloud_cover_low_ecmwf_ifs025_ensemble        més d'un model, control
 *   cloud_cover_low_member07_ecmwf_ifs025_ensemble  més d'un model, membre 7
 *
 * L'ORDRE DE PROVA NO ÉS INDIFERENT: `cloud_cover` és prefix de
 * `cloud_cover_low`, i si es prova primer, la clau `cloud_cover_low_member07`
 * es llegeix com la variable `cloud_cover` amb un membre que es diu
 * `low_member07`. Per això es proven de més llarga a més curta.
 */
export function splitMemberKey(
  key: string,
): { variable: EnsembleVariable; member: number; suffix: string | null } | null {
  for (const variable of ENSEMBLE_VARIABLES_BY_LENGTH) {
    if (key === variable) return { variable, member: 0, suffix: null };
    if (!key.startsWith(`${variable}_`)) continue;
    const rest = key.slice(variable.length + 1);

    const withMember = /^member(\d+)(?:_(.+))?$/.exec(rest);
    if (withMember) {
      return {
        variable,
        member: Number(withMember[1]),
        suffix: withMember[2] ?? null,
      };
    }

    // Sense `member`: la resta només pot ser el sufix d'un model conegut. Si
    // no ho és, aquesta variable no és la bona i s'ha de continuar provant —
    // `cloud_cover` amb resta `low` cau exactament aquí.
    if (ENSEMBLE_MODELS.some((m) => m.suffix === rest)) {
      return { variable, member: 0, suffix: rest };
    }
  }
  return null;
}

/**
 * Converteix la resposta plana de l'API en una sèrie per membre.
 *
 * ES DESCARTEN ELS MEMBRES BUITS, i és la comprovació que justifica tota la
 * taula de la capçalera: un membre que no porti cap valor no nul en cap de les
 * seves variables no és un escenari, és una columna de `null` amb nom. Si
 * comptés, la fracció de membres favorables es dividiria entre membres que no
 * han dit res i sortiria sistemàticament baixa.
 */
export function parseEnsemblePoint(
  entry: unknown,
  requestedModels: readonly EnsembleModel[],
): EnsemblePointResponse {
  const point = entry as Partial<PointResponse> & { error?: boolean; reason?: string };
  if (point.error) {
    throw new CloudOutlookError(point.reason ?? 'Resposta d’error d’Open-Meteo');
  }
  const hourly = point.hourly as (HourlySeries & Record<string, unknown>) | undefined;
  if (!hourly || !Array.isArray(hourly.time)) {
    throw new CloudOutlookError('Resposta del conjunt sense sèrie horària');
  }

  const time = hourly.time;
  /** Clau «model|membre» → sèries a mig omplir. */
  const byMember = new Map<string, EnsembleMember>();

  for (const [key, values] of Object.entries(hourly)) {
    if (key === 'time' || !Array.isArray(values)) continue;
    const parsed = splitMemberKey(key);
    if (!parsed) continue;

    // Amb un sol model demanat les claus no porten sufix, i aleshores el model
    // és, sense ambigüitat, l'únic que hem demanat.
    const model =
      parsed.suffix === null
        ? requestedModels.length === 1
          ? requestedModels[0]
          : null
        : (requestedModels.find((m) => m.suffix === parsed.suffix) ?? null);
    if (!model) continue;

    const id = `${model.id}|${parsed.member}`;
    let member = byMember.get(id);
    if (!member) {
      member = { modelId: model.id, member: parsed.member, hourly: { time } };
      byMember.set(id, member);
    }
    member.hourly[parsed.variable] = values as (number | null)[];
  }

  const members = [...byMember.values()].filter((m) =>
    ENSEMBLE_HOURLY.some((v) => m.hourly[v]?.some((x) => x !== null && x !== undefined)),
  );

  return {
    latitude: point.latitude ?? 0,
    longitude: point.longitude ?? 0,
    elevation: point.elevation ?? 0,
    members,
  };
}

/**
 * El conjunt per a un o més punts, en una sola petició.
 *
 * MESURAT EL 8-8-2026 amb el pla de visual sencer de Sòria (sis punts, Sol a
 * 4°), tres hores i les quatre variables: 80.260 B en cru i 3.746 B comprimits
 * amb gzip. La comparació que importa és amb la petició determinista d'ara,
 * que en són uns 4 KB: el conjunt de cinquanta-un membres amb les tres capes
 * projectades sobre la visual cap dins del MATEIX ordre de magnitud, perquè
 * cinquanta-una sèries de percentatges d'un o dos dígits comprimeixen com el
 * que són. Per això la projecció sobre la visual no s'ha hagut de retallar:
 * era la por raonable abans de mesurar-ho i la mesura diu que no cal.
 */
export async function fetchEnsembleWindow(
  points: readonly QueryPoint[],
  startMs: number,
  endMs: number,
  options: FetchOptions & { models?: readonly EnsembleModel[] } = {},
): Promise<EnsemblePointResponse[]> {
  const models = options.models ?? ENSEMBLE_MODELS;
  const { lat, lon } = joinCoordinates(points);
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: ENSEMBLE_HOURLY.join(','),
    models: models.map((m) => m.id).join(','),
    start_hour: toApiHour(startMs),
    end_hour: toApiHour(endMs),
    timeformat: 'unixtime',
    timezone: 'UTC',
  });
  const payload = await requestJson(`${ENSEMBLE_ENDPOINT}?${params.toString()}`, options);
  const list = Array.isArray(payload) ? payload : [payload];
  return list.map((entry) => parseEnsemblePoint(entry, models));
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
