/**
 * Espai en disc: quant n'ocupem, quant en queda i si el navegador se'l pot
 * quedar sense avisar.
 *
 * Cap funció d'aquest mòdul llança. Tot el que hi ha aquí és opcional en algun
 * navegador (Safari no implementa `persist()`, el mode privat retalla la
 * quota, un iframe pot tenir l'emmagatzematge bloquejat) i una excepció aquí
 * no pot deixar sense funcionar la pantalla que ensenya què hi ha desat.
 */

import { CACHE_BASEMAP, CACHE_TERRAIN } from './config';

export interface StorageSummary {
  /** Fals si el navegador no dona `navigator.storage.estimate()`. */
  supported: boolean;
  /** Bytes ocupats per aquest origen (tot: cau, IndexedDB, precache…). */
  usageBytes: number;
  /** Quota que ens concedeix el navegador, en bytes. */
  quotaBytes: number;
  /**
   * Cert si l'emmagatzematge és "persistent": el navegador no l'esborrarà per
   * fer lloc. A Safari sempre serà fals — no implementa l'API.
   */
  persisted: boolean;
}

const EMPTY: StorageSummary = {
  supported: false,
  usageBytes: 0,
  quotaBytes: 0,
  persisted: false,
};

/** Ocupació i quota actuals. */
export async function estimateStorage(): Promise<StorageSummary> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return EMPTY;

  try {
    const estimate = await navigator.storage.estimate();
    let persisted = false;
    if (navigator.storage.persisted) {
      try {
        persisted = await navigator.storage.persisted();
      } catch {
        persisted = false;
      }
    }
    return {
      supported: true,
      usageBytes: estimate.usage ?? 0,
      quotaBytes: estimate.quota ?? 0,
      persisted,
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Demana emmagatzematge persistent.
 *
 * Val la pena demanar-ho just abans d'una precàrrega: a Chrome i Firefox, una
 * app instal·lada o amb prou interacció el concedeix sense preguntar res, i
 * llavors els 15 MB de relleu ja no els pot escombrar la neteja automàtica del
 * navegador quan el disc va just.
 *
 * A iOS torna sempre fals perquè l'API no existeix. Vegeu `ios.ts`: allà la
 * protecció s'aconsegueix instal·lant l'app a la pantalla d'inici, no per codi.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Nombre d'entrades desades a una memòria cau. Zero si no existeix. */
export async function countCacheEntries(cacheName: string): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const has = await caches.has(cacheName);
    if (!has) return 0;
    const cache = await caches.open(cacheName);
    return (await cache.keys()).length;
  } catch {
    return 0;
  }
}

export interface CachedTileCounts {
  terrain: number;
  basemap: number;
}

/** Tessel·les desades ara mateix, per tipus. */
export async function countCachedTiles(): Promise<CachedTileCounts> {
  const [terrain, basemap] = await Promise.all([
    countCacheEntries(CACHE_TERRAIN),
    countCacheEntries(CACHE_BASEMAP),
  ]);
  return { terrain, basemap };
}

/**
 * Esborra les tessel·les desades.
 *
 * No toca el precache de l'esquelet: qui vulgui alliberar espai ha de poder
 * fer-ho sense trencar la capacitat d'obrir l'app sense connexió.
 */
export async function clearTileCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await Promise.all([caches.delete(CACHE_TERRAIN), caches.delete(CACHE_BASEMAP)]);
  } catch {
    /* si no es pot esborrar, no és fatal */
  }
}
