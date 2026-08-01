/**
 * L'orquestrador: memòria cau, antirebot, cua i transport, en aquest ordre.
 *
 * CONTRACTE QUE NO ES POT TRENCAR: cap funció d'aquest fitxer rebutja mai per
 * culpa de la xarxa. El nom del lloc és un extra; si no arriba, es torna `null`
 * i qui pinta ensenya les coordenades. L'usuari no ha de veure mai un error per
 * una cosa que no pot arreglar ni li fa falta.
 *
 * Es distingeixen dues respostes que semblen la mateixa i no ho són:
 *   · `null`                 → no ho sabem (sense xarxa, error, avortat).
 *   · `precision: 'none'`    → ho hem preguntat i allà no hi ha cap nucli.
 * La segona es desa a la memòria cau; la primera no, perquè demà potser sí.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en Node.
 */

import { createPlaceCache, snapCoordinate, type PlaceCache } from './cache';
import { buildPlaceName } from './nearest';
import { fetchNearbySettlements, fetchPlaceSearch } from './photon';
import {
  MAP_SETTLE_MS,
  SEARCH_SETTLE_MS,
  createRequestQueue,
  createSettler,
  type RequestQueue,
  type Superseded,
} from './queue';
import type { PlaceName, PlaceRequestOptions, PlaceSuggestion } from './types';

export { SUPERSEDED } from './queue';
export type { Superseded } from './queue';

/** Longitud mínima d'una cerca. Amb menys de dues lletres tot són resultats. */
export const MIN_SEARCH_LENGTH = 2;

/**
 * Cerques recordades durant la sessió.
 *
 * Seixanta són moltes més de les que fa ningú planificant una sortida, i posen
 * un sostre al mapa perquè no creixi mentre l'app està oberta.
 */
const MAX_MEMOIZED_SEARCHES = 60;

export interface PlaceResolverOptions {
  /** Memòria cau pròpia. `null` la desactiva (útil per a proves). */
  cache?: PlaceCache | null;
  /** Cua pròpia, per canviar l'espaiat entre peticions. */
  queue?: RequestQueue;
  /** Espera de l'antirebot del mapa, en ms. */
  settleMs?: number;
  /** Espera de l'antirebot del cercador, en ms. */
  searchSettleMs?: number;
  /** `fetch` a fer servir. Per a proves i per a Node. */
  fetchImpl?: typeof fetch;
}

export interface PlaceResolver {
  /**
   * Nom d'un punt. Consulta de seguida si no és a la memòria cau.
   *
   * Fer-la servir directament només té sentit quan la posició ja és definitiva
   * (el GPS ha respost, l'usuari ha triat un lloc de la llista). Mentre el
   * mapa es mou, la bona és `resolveWhenSettled`.
   */
  resolve(lat: number, lon: number, options?: PlaceRequestOptions): Promise<PlaceName | null>;

  /**
   * Nom d'un punt, esperant que l'usuari pari.
   *
   * Cada crida anul·la l'anterior i la substituïda es resol amb `SUPERSEDED`
   * sense haver gastat cap petició. Si el punt ja és a la memòria cau, torna
   * immediatament i no espera res: tornar a passar per un lloc conegut ha de
   * ser instantani.
   */
  resolveWhenSettled(
    lat: number,
    lon: number,
    options?: PlaceRequestOptions,
  ): Promise<PlaceName | null | Superseded>;

  /** Mira la memòria cau i prou. Síncron, no toca la xarxa mai. */
  peek(lat: number, lon: number): PlaceName | null;

  /** Cerca de llocs pel nom. Llista buida si la consulta és massa curta. */
  search(
    query: string,
    options?: PlaceRequestOptions & { limit?: number; biasLat?: number; biasLon?: number },
  ): Promise<PlaceSuggestion[]>;

  /** Cerca esperant que qui escriu pari. Mateixa regla de substitució. */
  searchWhenSettled(
    query: string,
    options?: PlaceRequestOptions & { limit?: number; biasLat?: number; biasLon?: number },
  ): Promise<PlaceSuggestion[] | Superseded>;

  /** Anul·la el que hi hagi esperant. Per desmuntar un component. */
  cancel(): void;
}

export function createPlaceResolver(options: PlaceResolverOptions = {}): PlaceResolver {
  const cache = options.cache === null ? null : (options.cache ?? createPlaceCache());
  const queue = options.queue ?? createRequestQueue();
  const settler = createSettler(options.settleMs ?? MAP_SETTLE_MS);
  const searchSettler = createSettler(options.searchSettleMs ?? SEARCH_SETTLE_MS);
  const defaultFetch = options.fetchImpl;

  /**
   * Peticions en vol, per cel·la.
   *
   * Dos components poden demanar el nom del mateix punt al mateix fotograma
   * (la capçalera i la fitxa de sota). Sense això serien dues peticions
   * idèntiques i simultànies al mateix servei.
   */
  const inFlight = new Map<string, Promise<PlaceName | null>>();

  /**
   * Resultats de cerca de la sessió.
   *
   * NO van a localStorage a posta: l'espai de consultes possibles és infinit i
   * omplir-lo de text que no es tornarà a fer servir gastaria la quota que
   * necessiten els noms de lloc, que sí que es repeteixen.
   */
  const searchMemo = new Map<string, PlaceSuggestion[]>();

  async function fetchPlace(
    lat: number,
    lon: number,
    request: PlaceRequestOptions,
  ): Promise<PlaceName | null> {
    try {
      const settlements = await queue.run(() =>
        fetchNearbySettlements(lat, lon, {
          fetchImpl: request.fetchImpl ?? defaultFetch,
          signal: request.signal,
        }),
      );
      const place = buildPlaceName(settlements, lat, lon, Date.now());
      cache?.write(lat, lon, place);
      return place;
    } catch {
      // Sense xarxa, servei caigut, temps esgotat o avortat. Cap d'aquestes
      // coses és un error que l'usuari hagi de veure: el nom és un extra.
      return null;
    }
  }

  function resolveNow(
    lat: number,
    lon: number,
    request: PlaceRequestOptions,
  ): Promise<PlaceName | null> {
    // Arrodonim a la cel·la de la memòria cau ABANS de res. Així el tremolor
    // del GPS —uns metres cada segon— no genera mai una consulta nova, i la
    // URL que es demana és sempre la mateixa per al mateix punt.
    const lat0 = snapCoordinate(lat);
    const lon0 = snapCoordinate(lon);
    const key = `${lat0},${lon0}`;

    if (!request.forceRefresh) {
      const hit = cache?.read(lat0, lon0);
      if (hit) return Promise.resolve(hit);
      const flying = inFlight.get(key);
      if (flying) return flying;
    }

    const pending = fetchPlace(lat0, lon0, request).finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, pending);
    return pending;
  }

  type SearchOptions = PlaceRequestOptions & {
    limit?: number;
    biasLat?: number;
    biasLon?: number;
  };

  async function searchNow(
    query: string,
    request: SearchOptions,
  ): Promise<PlaceSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) return [];

    // EL BIAIX FORMA PART DE LA CLAU. Sense ell, «Cervera» escrit des del mapa
    // a Lleida i «Cervera» escrit des de Cantàbria comparteixen entrada, i la
    // segona cerca rep els resultats ordenats per la primera. Són dos pobles a
    // 480 km l'un de l'altre i un dels dos cau fora de la franja del 2026: el
    // primer resultat de la llista decidiria el viatge. S'arrodoneix a mig grau
    // perquè moure el mapa dos carrers no invalidi la memòria.
    const bias =
      request.biasLat === undefined || request.biasLon === undefined
        ? ''
        : `${(request.biasLat * 2).toFixed(0)},${(request.biasLon * 2).toFixed(0)}`;
    const memoKey = `${trimmed.toLowerCase()}|${request.limit ?? ''}|${bias}`;
    if (!request.forceRefresh) {
      const memo = searchMemo.get(memoKey);
      if (memo) return memo;
    }

    // AQUÍ NO HI HA CAP `catch`, I ÉS A POSTA. Hi era, i tornava una llista
    // buida: «no hi ha xarxa» i «aquest poble no existeix» arribaven a la
    // pantalla com exactament la mateixa cosa, «cap resultat». L'usuari
    // reescrivia el nom una vegada i una altra amb el mòbil sense cobertura,
    // convençut que s'equivocava ell. Qui crida ja sap distingir-ho
    // (`SearchOutcome` té `failed` i `offline` separats d'`empty`); només li
    // faltava rebre l'error.
    //
    // De retruc, una fallada tampoc no es memoritza: no és una resposta, i
    // desar-la condemnaria la consulta a fallar la resta de la sessió encara
    // que la cobertura tornés dos segons després.
    const results = await queue.run(() =>
      fetchPlaceSearch(trimmed, {
        limit: request.limit,
        biasLat: request.biasLat,
        biasLon: request.biasLon,
        fetchImpl: request.fetchImpl ?? defaultFetch,
        signal: request.signal,
      }),
    );

    // Sostre a la memòria de cerques: qui escriu molt no ha d'acabar amb un
    // mapa que creix tota la sessió. Es llença la més antiga, que a `Map` és
    // la primera clau.
    if (searchMemo.size >= MAX_MEMOIZED_SEARCHES) {
      const oldest = searchMemo.keys().next();
      if (!oldest.done) searchMemo.delete(oldest.value);
    }
    searchMemo.set(memoKey, results);
    return results;
  }

  return {
    resolve(lat, lon, request = {}) {
      return resolveNow(lat, lon, request);
    },

    resolveWhenSettled(lat, lon, request = {}) {
      if (!request.forceRefresh) {
        const hit = cache?.read(snapCoordinate(lat), snapCoordinate(lon));
        if (hit) {
          // Ja el sabem: no hi ha res a esperar i el que esperava sobra.
          settler.cancel();
          return Promise.resolve(hit);
        }
      }
      return settler.run(() => resolveNow(lat, lon, request));
    },

    peek(lat, lon) {
      return cache?.read(snapCoordinate(lat), snapCoordinate(lon)) ?? null;
    },

    search(query, request = {}) {
      return searchNow(query, request);
    },

    searchWhenSettled(query, request = {}) {
      if (query.trim().length < MIN_SEARCH_LENGTH) {
        // Esborrar el camp ha de buidar la llista de seguida, i sobretot ha
        // d'anul·lar la consulta que estava a punt de sortir.
        searchSettler.cancel();
        return Promise.resolve([]);
      }
      return searchSettler.run(() => searchNow(query, request));
    },

    cancel() {
      settler.cancel();
      searchSettler.cancel();
    },
  };
}

/**
 * Resolutor compartit de l'aplicació.
 *
 * N'hi ha d'haver UN de sol: la cua i la memòria cau només serveixen d'alguna
 * cosa si tothom hi passa. Dos resolutors serien dues cues i el doble de
 * peticions, que és exactament el que la política del servei no vol.
 */
let shared: PlaceResolver | null = null;

export function placeResolver(): PlaceResolver {
  shared ??= createPlaceResolver();
  return shared;
}

/** Geocodificació inversa: coordenades → nom. Mai llança. */
export function reverseGeocode(
  lat: number,
  lon: number,
  options?: PlaceRequestOptions,
): Promise<PlaceName | null> {
  return placeResolver().resolve(lat, lon, options);
}

/** Igual, però esperant que l'usuari deixi de moure el mapa. */
export function reverseGeocodeWhenSettled(
  lat: number,
  lon: number,
  options?: PlaceRequestOptions,
): Promise<PlaceName | null | Superseded> {
  return placeResolver().resolveWhenSettled(lat, lon, options);
}

/** Nom ja desat per a un punt, sense tocar la xarxa. */
export function peekPlaceName(lat: number, lon: number): PlaceName | null {
  return placeResolver().peek(lat, lon);
}

/** Geocodificació directa: nom → coordenades. Mai llança. */
export function searchPlaces(
  query: string,
  options?: PlaceRequestOptions & { limit?: number; biasLat?: number; biasLon?: number },
): Promise<PlaceSuggestion[]> {
  return placeResolver().search(query, options);
}

/** Igual, però esperant que qui escriu pari. */
export function searchPlacesWhenSettled(
  query: string,
  options?: PlaceRequestOptions & { limit?: number; biasLat?: number; biasLon?: number },
): Promise<PlaceSuggestion[] | Superseded> {
  return placeResolver().searchWhenSettled(query, options);
}
