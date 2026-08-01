/**
 * Memòria cau de les consultes de nuvolositat.
 *
 * Existeix per una raó molt concreta: el dia de l'eclipsi seràs en un turó, en
 * un poble de mil habitants, amb tres-centes persones més penjades de la
 * mateixa antena. La cobertura caurà. Quan caigui, l'aplicació ha d'ensenyar
 * l'última previsió que va aconseguir baixar i ha de dir clarament de quan és
 * — no ha de quedar-se en blanc ni, molt pitjor, ensenyar una dada vella com
 * si fos d'ara.
 *
 * Mateix patró que `src/core/horizon/cache.ts`: IndexedDB pelat, amb caiguda a
 * memòria de sessió quan no n'hi ha (Node, mode privat, iframe bloquejat). Cap
 * funció d'aquí llança mai: un error de memòria cau no pot deixar l'usuari
 * sense previsió.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import type { CloudOutlook } from './types';

const DB_NAME = 'appeclipsi-weather';
const DB_VERSION = 1;
const STORE = 'outlooks';
const SAVED_AT_INDEX = 'savedAtMs';

/**
 * Entrades desades. Cada consulta són uns 2 KB. Cent cobreixen de sobres els
 * llocs candidats que una persona compara abans de decidir on va.
 */
const MAX_ENTRIES = 100;

interface CacheRecord {
  key: string;
  savedAtMs: number;
  outlook: CloudOutlook;
}

const memoryCache = new Map<string, CacheRecord>();

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
          store.createIndex(SAVED_AT_INDEX, SAVED_AT_INDEX);
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

function isCloudOutlook(value: unknown): value is CloudOutlook {
  if (!value || typeof value !== 'object') return false;
  const o = value as Partial<CloudOutlook>;
  return (
    (o.mode === 'forecast' || o.mode === 'climatology') &&
    typeof o.fetchedAtMs === 'number' &&
    typeof o.targetTimeMs === 'number' &&
    !!o.score &&
    typeof o.score.score === 'number'
  );
}

/** Llegeix una entrada. Torna `null` si no hi és o si el registre no val. */
export async function readCachedOutlook(key: string): Promise<CacheRecord | null> {
  const inMemory = memoryCache.get(key);
  if (inMemory) return inMemory;

  const db = await openDatabase();
  if (!db) return null;

  try {
    const tx = db.transaction(STORE, 'readonly');
    const record = await promisify<CacheRecord | undefined>(
      tx.objectStore(STORE).get(key) as IDBRequest<CacheRecord | undefined>,
    );
    if (!record || !isCloudOutlook(record.outlook)) return null;
    memoryCache.set(key, record);
    return record;
  } catch {
    return null;
  }
}

/** Desa una entrada. Si no es pot desar, només vol dir tornar a consultar. */
export async function writeCachedOutlook(
  key: string,
  outlook: CloudOutlook,
): Promise<void> {
  const record: CacheRecord = { key, savedAtMs: Date.now(), outlook };
  memoryCache.set(key, record);

  const db = await openDatabase();
  if (!db) return;

  try {
    const tx = db.transaction(STORE, 'readwrite');
    await promisify(tx.objectStore(STORE).put(record));
    await prune(db);
  } catch {
    /* quota plena o base tancada: no és fatal */
  }
}

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

/** Buida la memòria cau de meteorologia. */
export async function clearWeatherCache(): Promise<void> {
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
