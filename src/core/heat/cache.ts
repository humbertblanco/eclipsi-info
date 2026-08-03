/**
 * Memòria cau de les cel·les del mapa de calor.
 *
 * ── PER QUÈ EXISTEIX ────────────────────────────────────────────────────────
 *
 * Perquè el dia de l'eclipsi seràs en un turó, amb tres-centes persones més
 * penjades de la mateixa antena, i el mapa de calor és justament el que voldràs
 * mirar per decidir si et quedes o baixes dos quilòmetres. Una passada són
 * ~3 s de càlcul i uns quants megabytes de tessel·les; sense cobertura, són
 * infinits. Amb això, la zona que vas mirar a casa es REPINTA SENCERA, amb els
 * números de relleu i no amb la teoria, abans de calcular res de nou.
 *
 * Cap competidor ho fa: el mapa de calor de la competència es recalcula al
 * servidor a cada moviment i sense xarxa no hi ha mapa.
 *
 * ── LA CLAU PORTA LA VERSIÓ DEL MOTOR ───────────────────────────────────────
 *
 * `${versió}|${eclipsi}|${cel·la}`. Si `HEAT_ENGINE_VERSION` puja —perquè hem
 * tocat el garbell, el llavor o la integració—, TOTES les claus canvien i el
 * mapa es recalcula. L'alternativa (servir números vells amb un motor nou) és
 * la pitjor de totes: un número equivocat que sembla bo, barrejat amb números
 * bons, sense cap manera de distingir-los. Val més recalcular.
 *
 * Els identificadors de cel·la són `z/x/y` de Web Mercator (vegeu `grid.ts`), i
 * per tant no depenen d'on tenies el mapa: dues visites al mateix tros de món
 * demanen exactament les mateixes claus.
 *
 * ── NOMÉS ES DESA EL QUE VAL LA PENA DESAR ──────────────────────────────────
 *
 * Només les cel·les de nivell 2 (`detail: 'sieve'`). La teoria costa 0,07 ms
 * per cel·la: llegir-la d'IndexedDB seria més car que tornar-la a calcular, i
 * a més ompliria la quota de números que no valen res.
 *
 * Tampoc no es desa el polígon. La geometria la torna a fer `grid.ts` a cada
 * passada a partir de l'identificador, i així un canvi en com es dibuixa una
 * cel·la no invalida cap número.
 *
 * Mateix patró que `core/weather/cache.ts` i `core/horizon/cache.ts`: IndexedDB
 * pelat, amb caiguda a memòria de sessió quan no n'hi ha (Node, mode privat,
 * iframe bloquejat). Cap funció d'aquí no llança mai: un error de memòria cau
 * no pot deixar l'usuari sense mapa.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { HEAT_ENGINE_VERSION, type HeatCacheAdapter, type HeatCellValue } from './compute';

const DB_NAME = 'appeclipsi-heat';
const DB_VERSION = 1;
const STORE = 'cells';
const SAVED_AT_INDEX = 'savedAtMs';

/**
 * Cel·les desades abans de començar a esborrar les més antigues.
 *
 * Cada registre són set números i dues cadenes: uns 120 bytes. Vint mil són
 * ~2,4 MB —res al costat de la quota— i cobreixen vint-i-cinc passades
 * senceres, que és molt més del que ningú mira en una tarda.
 */
const MAX_ENTRIES = 20_000;

/**
 * El que es desa: tot el valor MENYS el polígon, que el torna a fer la graella.
 */
export type HeatCellRecord = Omit<HeatCellValue, 'poly'>;

interface CacheRecord {
  key: string;
  savedAtMs: number;
  cell: HeatCellRecord;
}

/** Reserva de sessió per quan no hi ha IndexedDB. */
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

/**
 * Clau d'una cel·la. La versió del motor va DAVANT de tot: un motor nou no pot
 * ni ensopegar amb els números del vell.
 */
export function heatCellKey(
  eclipseId: string,
  cellId: string,
  version: number = HEAT_ENGINE_VERSION,
): string {
  return `${version}|${eclipseId}|${cellId}`;
}

function isHeatCellRecord(value: unknown): value is HeatCellRecord {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<HeatCellRecord>;
  return (
    typeof c.id === 'string' &&
    typeof c.lat === 'number' &&
    typeof c.lon === 'number' &&
    typeof c.theoreticalSec === 'number' &&
    (c.visibleSec === null || typeof c.visibleSec === 'number') &&
    (c.detail === 'sieve' || c.detail === 'theory') &&
    typeof c.coverage === 'number'
  );
}

/**
 * Llegeix un grapat de cel·les. Les que no hi siguin (o que portin un registre
 * corromput) simplement no surten al mapa de tornada: qui crida les recalcula.
 *
 * El polígon torna buit a posta — vegeu la capçalera: `computeHeat` hi posa el
 * de la graella d'ara.
 */
export async function readCachedHeatCells(
  eclipseId: string,
  ids: readonly string[],
  version: number = HEAT_ENGINE_VERSION,
): Promise<Map<string, HeatCellValue>> {
  const found = new Map<string, HeatCellValue>();
  if (ids.length === 0) return found;

  const missing: string[] = [];
  for (const id of ids) {
    const record = memoryCache.get(heatCellKey(eclipseId, id, version));
    if (record) found.set(id, { ...record.cell, poly: [] });
    else missing.push(id);
  }
  if (missing.length === 0) return found;

  const db = await openDatabase();
  if (!db) return found;

  try {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    // Una lectura per clau i totes alhora: `getAll` amb un rang no serveix
    // perquè les claus d'una passada no són contigües (l'eix x del mapa salta).
    const records = await Promise.all(
      missing.map((id) =>
        promisify<CacheRecord | undefined>(
          store.get(heatCellKey(eclipseId, id, version)) as IDBRequest<
            CacheRecord | undefined
          >,
        ),
      ),
    );
    for (let i = 0; i < missing.length; i++) {
      const record = records[i];
      if (!record || !isHeatCellRecord(record.cell)) continue;
      memoryCache.set(record.key, record);
      found.set(missing[i], { ...record.cell, poly: [] });
    }
  } catch {
    /* la memòria cau és opcional: sense ella només vol dir recalcular */
  }

  return found;
}

/**
 * Desa les cel·les que han passat pel relleu. Les de teoria s'ignoren en
 * silenci: vegeu la capçalera.
 */
export async function writeCachedHeatCells(
  eclipseId: string,
  cells: readonly HeatCellValue[],
  version: number = HEAT_ENGINE_VERSION,
): Promise<void> {
  const records: CacheRecord[] = [];
  const savedAtMs = Date.now();
  for (const cell of cells) {
    if (cell.detail !== 'sieve') continue;
    const { poly: _poly, ...rest } = cell;
    records.push({ key: heatCellKey(eclipseId, cell.id, version), savedAtMs, cell: rest });
  }
  if (records.length === 0) return;

  for (const record of records) memoryCache.set(record.key, record);

  const db = await openDatabase();
  if (!db) return;

  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    await Promise.all(records.map((record) => promisify(store.put(record))));
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

/** Buida la memòria cau del mapa de calor. */
export async function clearHeatCache(): Promise<void> {
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

/**
 * L'adaptador que espera `computeHeat`. És l'única peça que lliga el motor amb
 * IndexedDB, i per això el motor no importa aquest fitxer: qui munta el Worker
 * decideix si hi ha memòria cau o no.
 */
export const indexedDbHeatCache: HeatCacheAdapter = {
  read: (eclipseId, ids) => readCachedHeatCells(eclipseId, ids),
  write: (eclipseId, cells) => writeCachedHeatCells(eclipseId, cells),
};
