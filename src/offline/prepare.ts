/**
 * "Prepara'm per anar-hi": baixa i desa per endavant tot el que farà falta en
 * un punt concret, perquè el dia de l'eclipsi l'app no hagi de tocar la xarxa.
 *
 * Ordre de les fases, i per què és aquest:
 *
 *   0. Esperar que el service worker prengui el control. És el pas que sembla
 *      superflu i no ho és: si baixéssim les tessel·les abans, el càlcul de
 *      l'horitzó (fase 3) les tornaria a demanar per xarxa i gastaríem 15 MB
 *      dues vegades. Amb `clientsClaim` activat, l'espera és d'un segon a la
 *      primera visita i de zero a la resta.
 *   1. Relleu: les tessel·les d'elevació dels anells del raycast.
 *   2. Mapa: la cartografia base de la zona, de z9 a z14.
 *   3. Càlcul: el perfil d'horitzó sencer, que és la part cara de CPU. Es fa
 *      DESPRÉS de tenir les tessel·les, així que ja no toca la xarxa.
 *   4. Desat: perfil a la seva memòria cau, circumstàncies locals verificades
 *      i apunt a l'inventari.
 *
 * PER QUÈ ESCRIVIM NOSALTRES A LA CACHE STORAGE, si el service worker ja
 * intercepta i desa: perquè hi ha un cas real en què no ho fa — el navegador
 * que no admet service workers, o la sessió on encara no n'hi ha cap
 * d'actiu. Escriure-hi directament, amb el mateix nom de memòria cau que farà
 * servir el service worker després, converteix la precàrrega en una garantia i
 * no en una esperança. L'escriptura és idempotent i no costa xarxa.
 *
 * COMPROMÍS CONEGUT: en un navegador sense service worker, la fase 3 torna a
 * demanar les tessel·les del relleu (les llegeix amb `fetch`, i sense service
 * worker ningú no respon des de la memòria cau; només ho pot estalviar la cau
 * HTTP del navegador). Es podria evitar passant els bitmaps ja descodificats
 * al worker, però seria complicar el camí normal —on sí que hi ha service
 * worker i no es baixa res dues vegades— per un cas residual.
 */

import type { GeoLocation } from '../core/astro/types';
import type { HorizonProfile } from '../core/horizon/profile';
import type { TileId } from '../core/horizon/elevation';
import { computeLocalCircumstances } from '../core/astro/contacts';
import { ECLIPSES } from '../core/eclipses/catalog';
import { horizonCacheKey, roundCoordinate, writeCachedProfile } from '../core/horizon/cache';
import {
  clipRings,
  computeHorizonProfile,
  DEFAULT_AZIMUTH_STEP_DEG,
  DEFAULT_RINGS,
  ringSignature,
  TERRESTRIAL_REFRACTION_K,
} from '../core/horizon/raycast';
import type {
  HorizonWorkerRequest,
  HorizonWorkerResponse,
} from '../workers/horizon.worker';
import {
  basemapTileUrl,
  CACHE_BASEMAP,
  CACHE_TERRAIN,
  PREFETCH_CONCURRENCY,
  terrainTileUrl,
  type BasemapLevel,
} from './config';
import {
  isHorizonCancelled,
  toHorizonFailure,
  type HorizonFailure,
} from '../core/horizon/errors';
import { planPrepare, type PreparePlan } from './plan';
import { preparedPlaceId, savePreparedPlace, type PreparedPlace } from './store';
import { requestPersistentStorage } from './storage';

export type PreparePhase =
  | 'inici'
  | 'relleu'
  | 'mapa'
  | 'calcul'
  | 'desat'
  | 'fet';

/**
 * El progrés és DADA, no prosa.
 *
 * Aquí hi havia un `message: string` amb una frase curta en català, i la seva
 * pròpia excusa escrita al costat: «el panell NO la pinta, es manté per a
 * registres». Un canal de text en català obert cap a la interfície s'acaba
 * fent servir —ha passat tres vegades en aquest projecte— i el dia que algú el
 * pinti, l'usuari en castellà rebrà català. `phase` ja era el codi i
 * `OfflinePanel` ja el feia servir (`PHASE_KEY` → `os('phase.*')`).
 */
export interface PrepareProgress {
  phase: PreparePhase;
  /** Progrés global de 0 a 1. */
  ratio: number;
  /** Bytes baixats fins ara, comptats resposta a resposta. */
  bytes: number;
  doneTiles: number;
  totalTiles: number;
}

/**
 * Per què ha fallat la preparació, com a codi.
 *
 * MATEIX PATRÓ QUE `core/horizon/errors.ts` I `core/spots/errors.ts`: unió
 * tancada, dada plana i les paraules a la capa de vista (`offline/strings.ts`).
 * Abans d'això, `prepareLocation` llançava «No s'ha pogut baixar cap tessel·la
 * del terreny. Comprova la connexió i torna-ho a provar.» i `OfflinePanel`
 * l'interpolava dins de `note.error` — frase de fora traduïda, motiu de dins
 * en català.
 *
 * `horizon` PORTA LA FALLADA DE L'HORITZÓ A SOBRE i no la resumeix: la
 * diferència entre «no ha arribat gens de relleu» i «n'ha arribat una part» és
 * la diferència entre dos consells diferents, i qui l'ha de dir és la
 * pantalla.
 */
export type PrepareErrorCode =
  /** Ni una tessel·la del terreny. Sense relleu no hi ha res a preparar. */
  | 'no-terrain'
  /** El terreny ha baixat, però el càlcul de l'horitzó ha fallat. */
  | 'horizon'
  /** Qualsevol altra cosa. */
  | 'unknown';

export interface PrepareFailure {
  readonly code: PrepareErrorCode;
  /** El motiu de sota, quan el codi és `horizon`. */
  readonly horizon?: HorizonFailure;
}

/** Totes les possibilitats, per poder recórrer-les des d'un test. */
export const PREPARE_ERROR_CODES: readonly PrepareErrorCode[] = [
  'no-terrain',
  'horizon',
  'unknown',
];

/** L'excepció de la precàrrega. El `message` és el codi, no una frase. */
export class PrepareError extends Error {
  readonly failure: PrepareFailure;

  constructor(failure: PrepareFailure, cause?: unknown) {
    super(failure.code, { cause });
    this.name = 'PrepareError';
    this.failure = failure;
  }
}

/**
 * Qualsevol cosa que hagi petat → una fallada tipada. No llança mai.
 *
 * Una cancel·lació NO passa per aquí: `isAbortError` la separa abans, perquè
 * qui atura la descàrrega no ha de veure cap error. Una fallada de l'horitzó
 * sí que hi entra, i es conserva sencera perquè la pantalla en pugui dir el
 * motiu de debò.
 */
export function toPrepareFailure(error: unknown): PrepareFailure {
  if (error instanceof PrepareError) return error.failure;

  const horizon = toHorizonFailure(error);
  if (horizon.code !== 'unknown') return { code: 'horizon', horizon };

  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (message === 'no-terrain') return { code: 'no-terrain' };
  }
  if (error === 'no-terrain') return { code: 'no-terrain' };

  return { code: 'unknown' };
}

export interface PrepareOptions {
  /** Nom que veurà l'usuari a la llista. Per defecte, les coordenades. */
  label?: string;
  /**
   * Radi del perfil d'horitzó, en km.
   *
   * ATENCIÓ: si el poses, la clau amb què es desa el perfil deixa de
   * coincidir amb la que buscarà `useHorizon` amb els seus valors per
   * defecte, i el perfil precalculat no es trobarà. Només té sentit si la
   * pantalla de simulació passa el mateix valor.
   */
  maxRangeKm?: number;
  /**
   * Altura de l'ull sobre el terreny, en metres. Zero per defecte, igual que
   * `useHorizon`. Val el mateix avís que `maxRangeKm`: forma part de la
   * signatura amb què es desa el perfil, i els dos costats han de coincidir.
   */
  eyeHeightM?: number;
  /** Nivells de zoom del mapa base. Per defecte, els de `config.ts`. */
  levels?: BasemapLevel[];
  onProgress?: (progress: PrepareProgress) => void;
  signal?: AbortSignal;
}

export interface PrepareResult {
  place: PreparedPlace;
  profile: HorizonProfile;
  /** Tessel·les que no s'han pogut baixar. Zero vol dir cobertura completa. */
  failedTiles: number;
}

/**
 * Pes de cada fase dins de la barra de progrés.
 *
 * Mesurat, no inventat: amb 4G decent, el relleu (uns 15 MB) s'endú la major
 * part del temps, el mapa (uns 3 MB) una fracció, i el raycast són tres o
 * quatre segons de CPU. Una barra que avanci a batzegades fa pensar que
 * l'app s'ha penjat, i aquí la gent està esperant per marxar de casa.
 */
const WEIGHT = { relleu: 0.55, mapa: 0.15, calcul: 0.28, desat: 0.02 };

/**
 * Espera que el service worker controli aquesta pàgina.
 *
 * Torna fals si no n'hi ha cap (navegador sense suport, http pla, o
 * desenvolupament): llavors la precàrrega segueix igualment i escriu ella
 * mateixa a la Cache Storage.
 */
export async function waitForServiceWorkerControl(timeoutMs = 5000): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  if (navigator.serviceWorker.controller) return true;

  // Si no hi ha cap registre, no arribarà mai cap `controllerchange` i esperar
  // el temps màxim seria cinc segons de barra aturada per no res.
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      clearTimeout(timer);
      resolve(value);
    };
    const onChange = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
  });
}

function abortIfNeeded(signal: AbortSignal | undefined): void {
  // El text d'un `AbortError` no el llegeix ningú: qui l'espera mira el `name`
  // (vegeu `isAbortError`). Es deixa en codi estable i no en català.
  if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');
}

/** Cert si l'error ve d'una cancel·lació de l'usuari i no d'una avaria. */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

interface DownloadOutcome {
  bytes: number;
  failed: number;
}

/**
 * Baixa una llista d'URL i les desa a una memòria cau.
 *
 * Sempre amb `mode: 'cors'`. Una resposta opaca (sense CORS) no deixa llegir
 * ni la mida ni l'estat: no sabríem si hem desat una imatge o una pàgina
 * d'error del proveïdor, i el comptador de bytes seria mentida. Val més que
 * falli sorollosament.
 */
async function downloadToCache(
  urls: string[],
  cacheName: string,
  options: {
    signal?: AbortSignal;
    onTile: (done: number, bytes: number) => void;
  },
): Promise<DownloadOutcome> {
  const { signal, onTile } = options;
  let bytes = 0;
  let failed = 0;
  let done = 0;
  let next = 0;

  let cache: Cache | null = null;
  if (typeof caches !== 'undefined') {
    try {
      cache = await caches.open(cacheName);
    } catch {
      cache = null;
    }
  }

  const pump = async (): Promise<void> => {
    for (;;) {
      if (signal?.aborted) return;
      const index = next++;
      if (index >= urls.length) return;
      const url = urls[index];

      try {
        const response = await fetch(url, { mode: 'cors', signal });
        if (!response.ok) throw new Error(String(response.status));

        // Consumim el cos per saber-ne la mida i el reconstruïm per desar-lo:
        // un `Response` només es pot llegir una vegada.
        const blob = await response.blob();
        bytes += blob.size;

        if (cache) {
          const headers = new Headers();
          headers.set('content-type', response.headers.get('content-type') ?? 'image/png');
          const date = response.headers.get('date');
          if (date) headers.set('date', date);
          await cache.put(url, new Response(blob, { status: 200, headers }));
        }
      } catch (error) {
        if (isAbortError(error)) return;
        // Una tessel·la perduda és un forat petit, no un motiu per aturar-ho
        // tot: qui crida decideix a partir del recompte final.
        failed++;
      }

      done++;
      onTile(done, bytes);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(PREFETCH_CONCURRENCY, urls.length) }, () => pump()),
  );

  return { bytes, failed };
}

/** Calcula el perfil d'horitzó, en un Worker si n'hi ha. */
async function computeProfile(
  location: GeoLocation,
  maxRangeKm: number | undefined,
  eyeHeightM: number,
  onRatio: (ratio: number) => void,
  signal: AbortSignal | undefined,
): Promise<HorizonProfile> {
  if (typeof Worker === 'undefined') {
    // Sense Workers el càlcul bloqueja la interfície uns segons. És pitjor que
    // la barra es quedi quieta que no pas no tenir perfil.
    try {
      return await computeHorizonProfile(location, {
        rings: maxRangeKm === undefined ? undefined : clipRings(maxRangeKm),
        eyeHeightM,
        onProgress: (progress) => onRatio(progress.ratio),
        signal,
      });
    } catch (error) {
      // La cancel·lació segueix sent una cancel·lació: `isAbortError` l'ha de
      // poder reconèixer o el hook ensenyaria un error a qui ha premut Atura.
      if (isHorizonCancelled(error)) {
        throw new DOMException('cancelled', 'AbortError');
      }
      throw new PrepareError({ code: 'horizon', horizon: toHorizonFailure(error) }, error);
    }
  }

  return new Promise<HorizonProfile>((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/horizon.worker.ts', import.meta.url),
      { type: 'module' },
    );
    const id = 1;

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
    };

    const onAbort = () => {
      const cancel: HorizonWorkerRequest = { type: 'cancel', id };
      worker.postMessage(cancel);
      cleanup();
      reject(new DOMException('cancelled', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort);

    worker.addEventListener('message', (event: MessageEvent<HorizonWorkerResponse>) => {
      const message = event.data;
      if (message.id !== id) return;
      if (message.type === 'progress') {
        onRatio(message.progress.ratio);
      } else if (message.type === 'done') {
        cleanup();
        resolve(message.profile);
      } else {
        cleanup();
        /*
         * Mateix pont que a `features/sim/useHorizon.ts`: el clonatge
         * estructurat no conserva les classes, i `workers/horizon.worker.ts`
         * encara respon `{ message: string }` (el pegat va escrit a
         * l'informe). Com que el `message` d'un `HorizonComputeError` ÉS el
         * codi, `toHorizonFailure` el recupera igualment; quan el Worker
         * enviï `failure`, hi arribaran també les xifres.
         */
        const failure =
          'failure' in message
            ? toHorizonFailure(message.failure)
            : toHorizonFailure(message.message);
        reject(
          isHorizonCancelled(failure)
            ? new DOMException('cancelled', 'AbortError')
            : new PrepareError({ code: 'horizon', horizon: failure }),
        );
      }
    });

    worker.addEventListener('error', () => {
      cleanup();
      // El `message` de l'`ErrorEvent` ve en anglès i parla de fitxers: no és
      // per a ningú. El codi diu que el càlcul de l'horitzó ha caigut.
      reject(new PrepareError({ code: 'horizon', horizon: { code: 'unknown' } }));
    });

    const request: HorizonWorkerRequest = {
      type: 'compute',
      id,
      location,
      options: { maxRangeKm, eyeHeightM },
    };
    worker.postMessage(request);
  });
}

/** Etiqueta per defecte d'un punt: coordenades amb rumb, no signes. */
export function defaultPlaceLabel(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'O';
  return `${Math.abs(lat).toFixed(3)} ${ns} · ${Math.abs(lon).toFixed(3)} ${ew}`;
}

/**
 * Deixa un punt llest per visitar-lo sense connexió.
 *
 * La posició s'arrodoneix a ~100 m abans de res, exactament com fa
 * `useHorizon`: si no coincidissin, el perfil precalculat es desaria amb una
 * clau que la pantalla de simulació no buscaria mai.
 */
export async function prepareLocation(
  location: GeoLocation,
  options: PrepareOptions = {},
): Promise<PrepareResult> {
  const { label, maxRangeKm, eyeHeightM = 0, levels, onProgress, signal } = options;

  const lat = roundCoordinate(location.lat);
  const lon = roundCoordinate(location.lon);
  const snapped: GeoLocation = { lat, lon, elevation: location.elevation };

  let bytes = 0;
  const emit = (phase: PreparePhase, ratio: number, done: number, total: number) => {
    onProgress?.({ phase, ratio, bytes, doneTiles: done, totalTiles: total });
  };

  emit('inici', 0, 0, 0);

  // Demanar persistència abans de baixar res: si el navegador la concedeix,
  // els megabytes que vindran ja neixen protegits de la neteja automàtica.
  void requestPersistentStorage();

  await waitForServiceWorkerControl();
  abortIfNeeded(signal);

  const plan: PreparePlan = planPrepare(lat, lon, { maxRangeKm, levels });
  const total = plan.totalTiles;

  // --- Fase 1: relleu -------------------------------------------------------
  const terrainUrls = plan.terrain.map((t: TileId) => terrainTileUrl(t.z, t.x, t.y));
  const terrain = await downloadToCache(terrainUrls, CACHE_TERRAIN, {
    signal,
    onTile: (done, downloaded) => {
      bytes = downloaded;
      emit(
        'relleu',
        (done / Math.max(1, terrainUrls.length)) * WEIGHT.relleu,
        done,
        total,
      );
    },
  });
  abortIfNeeded(signal);

  // El motiu viatja com a CODI, no com a frase: vegeu `PrepareErrorCode`.
  if (terrainUrls.length > 0 && terrain.failed === terrainUrls.length) {
    throw new PrepareError({ code: 'no-terrain' });
  }

  // --- Fase 2: mapa ---------------------------------------------------------
  const mapUrls = plan.basemap.map((t: TileId) => basemapTileUrl(t.z, t.x, t.y));
  const basemap = await downloadToCache(mapUrls, CACHE_BASEMAP, {
    signal,
    onTile: (done, downloaded) => {
      bytes = downloaded + terrain.bytes;
      emit(
        'mapa',
        WEIGHT.relleu + (done / Math.max(1, mapUrls.length)) * WEIGHT.mapa,
        plan.terrain.length + done,
        total,
      );
    },
  });
  bytes = terrain.bytes + basemap.bytes;
  abortIfNeeded(signal);

  // --- Fase 3: càlcul -------------------------------------------------------
  emit('calcul', WEIGHT.relleu + WEIGHT.mapa, total, total);

  const profile = await computeProfile(
    snapped,
    maxRangeKm,
    eyeHeightM,
    (ratio) => {
      emit('calcul', WEIGHT.relleu + WEIGHT.mapa + ratio * WEIGHT.calcul, total, total);
    },
    signal,
  );
  abortIfNeeded(signal);

  // --- Fase 4: desat --------------------------------------------------------
  emit('desat', 1 - WEIGHT.desat, total, total);

  // Aquesta signatura ha de sortir EXACTAMENT igual que la que compon
  // `useHorizon`, o el perfil que acabem de calcular es desarà en una clau que
  // la pantalla de simulació no consultarà mai.
  const signature = ringSignature(
    maxRangeKm === undefined ? DEFAULT_RINGS : clipRings(maxRangeKm),
    DEFAULT_AZIMUTH_STEP_DEG,
    TERRESTRIAL_REFRACTION_K,
    eyeHeightM,
  );
  await writeCachedProfile(profile, horizonCacheKey(lat, lon, signature));

  // Les circumstàncies locals són càlcul pur (astronomy-engine, sense xarxa).
  // Les fem ara per dos motius: comprovar que no petaran al camp, i deixar
  // constància a l'inventari de quins eclipsis té resolts aquest punt.
  const eclipseIds: string[] = [];
  for (const eclipse of ECLIPSES) {
    try {
      computeLocalCircumstances(eclipse.id, snapped);
      eclipseIds.push(eclipse.id);
    } catch {
      // Un eclipsi que des d'aquest punt no es veu gens no és cap error.
    }
  }

  const place: PreparedPlace = {
    id: preparedPlaceId(lat, lon),
    label: label?.trim() || defaultPlaceLabel(lat, lon),
    lat,
    lon,
    elevation: snapped.elevation,
    savedAtMs: Date.now(),
    bytes,
    terrainTiles: plan.terrain.length - terrain.failed,
    mapTiles: plan.basemap.length - basemap.failed,
    failedTiles: terrain.failed + basemap.failed,
    maxRangeKm: profile.maxRangeKm,
    horizonCoverage: profile.coverage,
    eclipseIds,
  };
  await savePreparedPlace(place);

  emit('fet', 1, total, total);

  return { place, profile, failedTiles: terrain.failed + basemap.failed };
}
