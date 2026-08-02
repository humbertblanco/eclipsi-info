/**
 * Registre del que hi ha preparat: un apunt per cada punt que l'usuari ha
 * baixat per endavant.
 *
 * No hi desem cap dada pesada — el relleu viu a la Cache Storage i el perfil
 * d'horitzó a la seva pròpia base (`core/horizon/cache.ts`). Aquí només hi ha
 * l'inventari: què hi ha, de quan és i quant ocupa. Serveix per poder respondre
 * la pregunta que es fa l'usuari abans de sortir de casa: "què tinc desat?".
 *
 * Mateixa política que la resta d'emmagatzematge del projecte: cap funció
 * llança, i si no hi ha IndexedDB (mode privat, iframe bloquejat, Node) es cau
 * a una memòria de sessió.
 */

import { CACHE_GRID_DECIMALS, snapCoordinate } from '../core/places/cache';

const DB_NAME = 'appeclipsi-offline';
const DB_VERSION = 1;
const STORE = 'places';

export interface PreparedPlace {
  /** Clau: coordenades arrodonides. Tornar a preparar el mateix punt hi escriu a sobre. */
  id: string;
  /** Nom curt per ensenyar. Si l'usuari no en posa cap, les coordenades. */
  label: string;
  lat: number;
  lon: number;
  /** Altitud del terreny en metres, la que s'ha fet servir per calcular. */
  elevation: number;
  savedAtMs: number;
  /** Bytes realment baixats, comptats resposta a resposta. */
  bytes: number;
  terrainTiles: number;
  mapTiles: number;
  /** Tessel·les que no s'han pogut baixar. Si no és zero, hi ha forats. */
  failedTiles: number;
  /** Radi del perfil d'horitzó, en km. */
  maxRangeKm: number;
  /** Fracció del perfil amb dades de terreny, de 0 a 1. */
  horizonCoverage: number;
  /** Eclipsis amb les circumstàncies locals ja verificades per a aquest punt. */
  eclipseIds: string[];
}

const memory = new Map<string, PreparedPlace>();

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === 'undefined' || indexedDB === null) {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

function promisify<T>(request: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/**
 * Identificador d'un punt preparat.
 *
 * Tres decimals són ~100 m, la mateixa resolució amb què es desa el perfil
 * d'horitzó. Si fos més fi, tornar al mateix mirador amb el GPS ballant
 * crearia una entrada nova cada vegada i la llista no voldria dir res.
 *
 * S'ARRODONEIX AMB `snapCoordinate` I NO AMB `toFixed` A SEQUES: toFixed
 * conserva el signe del zero, i al meridià de Greenwich —que CREUA la franja
 * del 2026 per Castelló— la mateixa cel·la quedava partida en dues claus,
 * «0.000» per a lon +0,0004 i «-0.000» per a −0,0004: dues files a
 * l'inventari del mateix mirador. El snap ve de `core/places/cache.ts`, que
 * ja havia pagat la mateixa trampa.
 */
export function preparedPlaceId(lat: number, lon: number): string {
  const la = snapCoordinate(lat).toFixed(CACHE_GRID_DECIMALS);
  const lo = snapCoordinate(lon).toFixed(CACHE_GRID_DECIMALS);
  return `${la},${lo}`;
}

/**
 * Migració suau de les claus velles: les files desades abans del canvi de
 * `preparedPlaceId` poden dur «-0.000» (o l'arrodoniment cru de toFixed).
 * Es reconeixen perquè la clau recalculada de les seves coordenades no
 * coincideix amb la desada; es queda la fila més recent de cada cel·la i les
 * altres s'esborren aprofitant el viatge — la migració és llegir la llista.
 */
function splitByCanonicalId(places: PreparedPlace[]): {
  keep: PreparedPlace[];
  stale: PreparedPlace[];
} {
  const newest = new Map<string, PreparedPlace>();
  const stale: PreparedPlace[] = [];
  for (const place of places) {
    const canonical = preparedPlaceId(place.lat, place.lon);
    const seen = newest.get(canonical);
    if (!seen) {
      newest.set(canonical, place);
    } else if (place.savedAtMs > seen.savedAtMs) {
      stale.push(seen);
      newest.set(canonical, place);
    } else {
      stale.push(place);
    }
  }
  return { keep: [...newest.values()], stale };
}

/** Punts preparats, del més recent al més antic. */
export async function listPreparedPlaces(): Promise<PreparedPlace[]> {
  const db = await openDatabase();
  if (!db) {
    const all = [...memory.values()].sort((a, b) => b.savedAtMs - a.savedAtMs);
    const { keep, stale } = splitByCanonicalId(all);
    for (const old of stale) void deletePreparedPlace(old.id);
    return keep;
  }

  try {
    const tx = db.transaction(STORE, 'readonly');
    const all = await promisify<PreparedPlace[]>(
      tx.objectStore(STORE).getAll() as IDBRequest<PreparedPlace[]>,
    );
    if (!all) return [];
    all.sort((a, b) => b.savedAtMs - a.savedAtMs);
    const { keep, stale } = splitByCanonicalId(all);
    for (const old of stale) void deletePreparedPlace(old.id);
    return keep;
  } catch {
    return [];
  }
}

/** Desa (o actualitza) un punt preparat. */
export async function savePreparedPlace(place: PreparedPlace): Promise<void> {
  memory.set(place.id, place);
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await promisify(tx.objectStore(STORE).put(place));
  } catch {
    /* sense inventari, l'app segueix funcionant */
  }
}

/** Treu un punt de l'inventari. No esborra les tessel·les: són compartides. */
export async function deletePreparedPlace(id: string): Promise<void> {
  memory.delete(id);
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await promisify(tx.objectStore(STORE).delete(id));
  } catch {
    /* res a fer */
  }
}

/** Buida l'inventari sencer. */
export async function clearPreparedPlaces(): Promise<void> {
  memory.clear();
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await promisify(tx.objectStore(STORE).clear());
  } catch {
    /* res a fer */
  }
}
