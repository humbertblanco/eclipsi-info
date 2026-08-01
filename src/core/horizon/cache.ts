/**
 * Memòria cau persistent dels perfils d'horitzó.
 *
 * Calcular un perfil vol dir baixar entre 10 i 20 MB de tessel·les i uns quants
 * segons de càlcul. Amb dades mòbils, al camp, el dia de l'eclipsi, això no es
 * pot repetir cada vegada que l'usuari torna a l'aplicació. El terreny no
 * canvia: un perfil és vàlid per sempre mentre no canviï la física amb què
 * l'hem calculat.
 *
 * IndexedDB pelat, sense cap llibreria. I amb degradació elegant: en mode
 * privat d'alguns navegadors, dins d'iframes amb l'emmagatzematge bloquejat o
 * en Node (tests), `indexedDB` no existeix o llança. En aquests casos caiem a
 * una memòria cau de sessió: no persisteix, però evita recalcular mentre
 * l'aplicació estigui oberta. Cap funció d'aquest mòdul llança mai.
 */

import { isHorizonProfile, type HorizonProfile } from './profile';

const DB_NAME = 'appeclipsi-horizon';
const DB_VERSION = 1;
const STORE = 'profiles';
const SAVED_AT_INDEX = 'savedAtMs';

/**
 * Perfils desats abans de començar a esborrar els més antics. Cada perfil són
 * uns 1440 × 2 números: ~25 KB en JSON. Quaranta perfils són 1 MB, res al
 * costat de la quota, i cobreixen de sobres els llocs candidats que una persona
 * arriba a comparar.
 */
const MAX_ENTRIES = 40;

interface CacheRecord {
  key: string;
  savedAtMs: number;
  profile: HorizonProfile;
}

/** Reserva de sessió per quan no hi ha IndexedDB. */
const memoryCache = new Map<string, HorizonProfile>();

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
          const store = db.createObjectStore(STORE, { keyPath: 'key' });
          // Índex per poder podar pels més antics sense llegir-ho tot.
          store.createIndex(SAVED_AT_INDEX, SAVED_AT_INDEX);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      // Una altra pestanya bloqueja una migració: millor sense cau que penjats.
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
 * Arrodoniment de la posició a ~100 m.
 *
 * Tres decimals de grau són 111 m en latitud i 83 m en longitud a la península.
 * Moure't 100 m no canvia de manera apreciable la silueta d'una serralada a
 * 40 km, i en canvi el GPS et fa ballar aquests 100 m tot sol: sense
 * arrodonir, la memòria cau no encertaria mai.
 */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Clau d'un perfil: posició arrodonida i signatura de la configuració.
 *
 * L'altitud NO forma part de la clau, i és a posta. L'origen vertical del
 * perfil surt del model del terreny a (lat, lon), o sigui que ja el determina
 * la posició arrodonida; l'altitud que ens passi qui sigui no hi entra per a
 * res. Si la hi poséssim, el degoteig vertical del GPS (±10-30 m) canviaria la
 * clau a cada lectura i obligaria a recalcular 20 MB de tessel·les per a un
 * perfil idèntic. El desplaçament de l'ull sobre el terreny, que sí que mou
 * h0, viatja dins de `signature`.
 */
export function horizonCacheKey(lat: number, lon: number, signature: string): string {
  const la = roundCoordinate(lat).toFixed(3);
  const lo = roundCoordinate(lon).toFixed(3);
  return `${la},${lo}#${signature}`;
}

/** Clau d'un perfil ja calculat. */
export function cacheKeyForProfile(profile: HorizonProfile): string {
  return horizonCacheKey(profile.lat, profile.lon, profile.ringSignature);
}

/** Llegeix un perfil. Torna `null` si no hi és o si el registre no és vàlid. */
export async function readCachedProfile(key: string): Promise<HorizonProfile | null> {
  const inMemory = memoryCache.get(key);
  if (inMemory) return inMemory;

  const db = await openDatabase();
  if (!db) return null;

  try {
    const tx = db.transaction(STORE, 'readonly');
    const record = await promisify<CacheRecord | undefined>(
      tx.objectStore(STORE).get(key) as IDBRequest<CacheRecord | undefined>,
    );
    if (!record || !isHorizonProfile(record.profile)) return null;
    memoryCache.set(key, record.profile);
    return record.profile;
  } catch {
    return null;
  }
}

/** Desa un perfil. No llança mai: si no es pot desar, només vol dir recalcular. */
export async function writeCachedProfile(
  profile: HorizonProfile,
  key: string = cacheKeyForProfile(profile),
): Promise<void> {
  memoryCache.set(key, profile);

  const db = await openDatabase();
  if (!db) return;

  try {
    const tx = db.transaction(STORE, 'readwrite');
    const record: CacheRecord = { key, savedAtMs: Date.now(), profile };
    await promisify(tx.objectStore(STORE).put(record));
    await prune(db);
  } catch {
    /* quota plena, base tancada... no és fatal */
  }
}

/** Esborra els registres més antics si n'hi ha massa. */
async function prune(db: IDBDatabase): Promise<void> {
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const count = await promisify(store.count());
    if (count === null || count <= MAX_ENTRIES) return;

    let excess = count - MAX_ENTRIES;
    await new Promise<void>((resolve) => {
      const cursorRequest = store.index(SAVED_AT_INDEX).openCursor();
      cursorRequest.onerror = () => resolve();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || excess <= 0) {
          resolve();
          return;
        }
        cursor.delete();
        excess--;
        cursor.continue();
      };
    });
  } catch {
    /* la poda és opcional */
  }
}

/** Perfils desats, per a una pantalla d'emmagatzematge. */
export async function listCachedProfiles(): Promise<
  Array<{ key: string; savedAtMs: number; lat: number; lon: number }>
> {
  const db = await openDatabase();
  if (!db) {
    return [...memoryCache.entries()].map(([key, profile]) => ({
      key,
      savedAtMs: profile.computedAtMs,
      lat: profile.lat,
      lon: profile.lon,
    }));
  }

  try {
    const tx = db.transaction(STORE, 'readonly');
    const records = await promisify<CacheRecord[]>(
      tx.objectStore(STORE).getAll() as IDBRequest<CacheRecord[]>,
    );
    if (!records) return [];
    return records.map((r) => ({
      key: r.key,
      savedAtMs: r.savedAtMs,
      lat: r.profile?.lat ?? 0,
      lon: r.profile?.lon ?? 0,
    }));
  } catch {
    return [];
  }
}

/** Buida la memòria cau sencera. */
export async function clearHorizonCache(): Promise<void> {
  memoryCache.clear();
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await promisify(tx.objectStore(STORE).clear());
  } catch {
    /* res a fer */
  }
}
