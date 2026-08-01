/**
 * Memòria cau dels noms de lloc, a localStorage.
 *
 * PER QUÈ ÉS OBLIGATÒRIA I NO UNA OPTIMITZACIÓ. L'app posa nom al punt que
 * l'usuari té sota el dit. Movent el mapa, aquell punt canvia dotzenes de
 * vegades per minut. Sense memòria cau, tornar a passar per un lloc on ja has
 * estat seria una petició nova, i el servei ens bloquejaria —amb raó— per abús.
 * Amb ella, tot un dia comparant llocs del Principat cap en unes desenes de
 * peticions.
 *
 * PER QUÈ localStorage I NO IndexedDB, que és el que fan servir el terreny i la
 * meteorologia. Perquè aquí la lectura ha de ser SÍNCRONA. Quan l'usuari torna
 * a una cel·la que ja coneixem, el nom ha de sortir al mateix fotograma, sense
 * un `await` pel mig que faci parpellejar les coordenades i després el nom.
 * IndexedDB és asíncrona sempre. El preu és que localStorage no existeix dins
 * d'un Worker; no importa, perquè els noms només es resolen al fil principal.
 *
 * COM S'INDEXA: per coordenades arrodonides a tres decimals. A les latituds on
 * hi ha la franja (39°-44° N) això són 111 m de nord a sud i entre 79 i 86 m
 * d'est a oest — la cel·la d'uns 100 m que demana el projecte. És molt més fi
 * que qualsevol nucli habitat i molt més gruixut que el tremolor del GPS.
 *
 * TOT EN UNA SOLA CLAU, no una per cel·la: així el buidatge és una operació i
 * la poda pot triar què llença. Dues-centes entrades de ~150 B són uns 30 kB,
 * molt per sota del límit de 5 MB.
 *
 * CAP FUNCIÓ D'AQUÍ LLANÇA MAI. Un error de memòria cau no pot deixar ningú
 * sense saber on és.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en Node.
 */

import type { PlaceName } from './types';

/** Clau única. Porta versió perquè un canvi de format no llegeixi brossa. */
export const PLACE_CACHE_KEY = 'eclipsi.places.v1';

/**
 * Decimals de la clau. Tres = cel·la d'uns 100 m. Vegeu la capçalera.
 * Es fa servir també per arrodonir les coordenades que es consulten, perquè la
 * mateixa cel·la generi sempre exactament la mateixa URL.
 */
export const CACHE_GRID_DECIMALS = 3;

/**
 * Entrades desades.
 *
 * Dues-centes cobreixen de sobres el que una persona explora en un dia: la
 * franja de 2026 fa uns 900 km de llarg i ningú no en compara més de vint o
 * trenta punts abans de decidir.
 */
const MAX_ENTRIES = 200;

/**
 * Caducitat d'un nom trobat, en ms. Noranta dies.
 *
 * Els topònims no es mouen; el que canvia és la cobertura d'OpenStreetMap, que
 * millora a poc a poc. Noranta dies és prou perquè un llogaret afegit al mapa
 * aparegui abans del proper eclipsi i prou llarg perquè ningú no torni a gastar
 * peticions pel mateix punt durant una temporada de sortides.
 */
const HIT_TTL_MS = 90 * 24 * 3_600_000;

/**
 * Caducitat d'un "aquí no hi ha res", en ms. Set dies.
 *
 * Molt més curta que la d'un encert a posta: un buit pot ser tant un lloc
 * realment desert com un forat del mapa que algú omplirà. Però desar-lo és
 * imprescindible: sense això, cada visita al mar Cantàbric tornaria a preguntar.
 */
const MISS_TTL_MS = 7 * 24 * 3_600_000;

/**
 * Fitxa desada.
 *
 * Els "aquí no hi ha res" també es desen, amb `place.settlement` a `null` i
 * `precision: 'none'`. Sense això, cada visita al mar Cantàbric o a un tros
 * buit dels Monegros tornaria a gastar una petició per tornar a no trobar res.
 */
interface CacheEntry {
  savedAtMs: number;
  place: PlaceName;
}

type CacheBlob = Record<string, CacheEntry>;

/**
 * Magatzem mínim. És el subconjunt de `Storage` que fem servir i deixa
 * injectar-ne un de fals a les proves sense muntar cap DOM.
 */
export interface PlaceCacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Arrodoneix a la cel·la de la memòria cau. `-0` es normalitza a `0`. */
export function snapCoordinate(value: number): number {
  const factor = 10 ** CACHE_GRID_DECIMALS;
  const snapped = Math.round(value * factor) / factor;
  return snapped === 0 ? 0 : snapped;
}

/** Clau d'una cel·la: "43.362,-5.849". */
export function cacheKeyFor(lat: number, lon: number): string {
  const la = snapCoordinate(lat).toFixed(CACHE_GRID_DECIMALS);
  const lo = snapCoordinate(lon).toFixed(CACHE_GRID_DECIMALS);
  return `${la},${lo}`;
}

/** `localStorage` si n'hi ha. `null` en Node, en un Worker o en mode privat. */
function defaultStorage(): PlaceCacheStorage | null {
  try {
    const storage = (globalThis as { localStorage?: PlaceCacheStorage }).localStorage;
    if (!storage || typeof storage.getItem !== 'function') return null;
    return storage;
  } catch {
    // Safari en mode privat llança només d'accedir a la propietat.
    return null;
  }
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<CacheEntry>;
  if (typeof entry.savedAtMs !== 'number') return false;
  if (!entry.place || typeof entry.place !== 'object') return false;
  const place = entry.place as Partial<PlaceName>;
  return typeof place.precision === 'string' && typeof place.queriedLat === 'number';
}

export interface PlaceCache {
  /**
   * Nom desat per a la cel·la, o `null` si no n'hi ha o si ha caducat.
   *
   * Un resultat amb `precision: 'none'` NO és el mateix que `null`: vol dir
   * "ja ho hem preguntat i allà no hi ha cap nucli", i estalvia la petició.
   */
  read(lat: number, lon: number, nowMs?: number): PlaceName | null;
  /** Desa un resultat, també quan no s'hi ha trobat cap nucli. */
  write(lat: number, lon: number, place: PlaceName, nowMs?: number): void;
  clear(): void;
  /** Entrades vives. Només per a proves i per al panell d'emmagatzematge. */
  size(): number;
}

/**
 * Crea una memòria cau.
 *
 * Sense magatzem persistent (Node, mode privat) segueix funcionant en memòria:
 * dins d'una sessió estalvia igualment les peticions, que és el que importa.
 */
export function createPlaceCache(storage?: PlaceCacheStorage | null): PlaceCache {
  const backing = storage === undefined ? defaultStorage() : storage;

  // Mirall en memòria. Evita analitzar el JSON a cada lectura i és l'única
  // memòria que hi ha quan no hi ha magatzem.
  let blob: CacheBlob | null = null;

  function load(): CacheBlob {
    if (blob) return blob;
    blob = {};
    if (!backing) return blob;
    try {
      const raw = backing.getItem(PLACE_CACHE_KEY);
      if (!raw) return blob;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return blob;
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (isCacheEntry(value)) blob[key] = value;
      }
    } catch {
      // JSON trencat d'una versió anterior: el descartem i seguim.
    }
    return blob;
  }

  function persist(): void {
    if (!backing || !blob) return;
    try {
      backing.setItem(PLACE_CACHE_KEY, JSON.stringify(blob));
    } catch {
      // Quota plena o magatzem bloquejat. La memòria cau seguirà viva en
      // memòria durant aquesta sessió, que ja és el 90 % del benefici.
    }
  }

  function ttlOf(entry: CacheEntry): number {
    return entry.place.settlement ? HIT_TTL_MS : MISS_TTL_MS;
  }

  function liveEntry(key: string, nowMs: number): CacheEntry | null {
    const entry = load()[key];
    if (!entry) return null;
    if (nowMs - entry.savedAtMs > ttlOf(entry)) return null;
    return entry;
  }

  /** Llença les entrades més velles quan se'n passa. */
  function prune(): void {
    const current = load();
    const keys = Object.keys(current);
    if (keys.length <= MAX_ENTRIES) return;
    keys
      .sort((a, b) => current[a].savedAtMs - current[b].savedAtMs)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((key) => {
        delete current[key];
      });
  }

  return {
    read(lat, lon, nowMs = Date.now()) {
      const entry = liveEntry(cacheKeyFor(lat, lon), nowMs);
      if (!entry) return null;
      // Marquem l'origen: la interfície ha de poder dir d'on ve la dada.
      return { ...entry.place, cached: true };
    },

    write(lat, lon, place, nowMs = Date.now()) {
      const current = load();
      current[cacheKeyFor(lat, lon)] = { savedAtMs: nowMs, place };
      prune();
      persist();
    },

    clear() {
      blob = {};
      if (!backing) return;
      try {
        backing.removeItem(PLACE_CACHE_KEY);
      } catch {
        /* res a fer */
      }
    },

    size() {
      return Object.keys(load()).length;
    },
  };
}
