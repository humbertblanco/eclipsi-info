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
 */
export function preparedPlaceId(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/** Punts preparats, del més recent al més antic. */
export async function listPreparedPlaces(): Promise<PreparedPlace[]> {
  const db = await openDatabase();
  if (!db) return [...memory.values()].sort((a, b) => b.savedAtMs - a.savedAtMs);

  try {
    const tx = db.transaction(STORE, 'readonly');
    const all = await promisify<PreparedPlace[]>(
      tx.objectStore(STORE).getAll() as IDBRequest<PreparedPlace[]>,
    );
    if (!all) return [];
    return all.sort((a, b) => b.savedAtMs - a.savedAtMs);
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
