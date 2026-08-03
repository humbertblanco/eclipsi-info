/**
 * Planificació de la precàrrega: quines tessel·les exactes fan falta per a un
 * punt, i quant pesarà tot plegat.
 *
 * Aquest mòdul és matemàtica pura — ni DOM ni xarxa — perquè és la peça que
 * decideix si l'usuari es queda sense dades al camp i, per tant, és la que ha
 * d'estar coberta per proves.
 *
 * Reutilitza `ringTiles` del raycast a posta: si la planificació enumerés les
 * tessel·les amb una regla pròpia, tard o d'hora divergiria de la que fa
 * servir el càlcul de l'horitzó i la precàrrega deixaria forats invisibles.
 */

import {
  clipRings,
  DEFAULT_RINGS,
  ringTiles,
  type HorizonRing,
} from '../core/horizon/raycast';
import { tileKey, type TileId } from '../core/horizon/elevation';
import {
  AVG_BASEMAP_TILE_BYTES,
  AVG_TERRAIN_TILE_BYTES,
  BASEMAP_LEVELS,
  HILLSHADE_LEVELS,
  type BasemapLevel,
} from './config';

/** Metres de meridià per grau de latitud. Constant a efectes de planificació. */
const M_PER_DEG_LAT = 111_320;

/**
 * Tessel·les d'elevació que necessita el perfil d'horitzó d'un punt.
 *
 * És el mateix conjunt que baixaria `computeHorizonProfile`: anells de zoom
 * decreixent amb la distància. Baixar-les abans vol dir que el càlcul al camp
 * no toca la xarxa.
 */
export function planTerrainTiles(
  lat: number,
  lon: number,
  maxRangeKm?: number,
  rings: HorizonRing[] = DEFAULT_RINGS,
): TileId[] {
  const list = maxRangeKm === undefined ? rings : clipRings(maxRangeKm, rings);
  const sorted = list.slice().sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);

  const wanted = new Map<string, TileId>();
  let innerM = 0;
  for (const ring of sorted) {
    const outerM = ring.maxDistanceKm * 1000;
    if (outerM <= innerM) continue;
    for (const tile of ringTiles(lat, lon, { zoom: ring.zoom, innerM, outerM })) {
      wanted.set(tileKey(tile), tile);
    }
    innerM = outerM;
  }
  return [...wanted.values()];
}

/**
 * Tessel·les d'un quadrat centrat al punt, per a un zoom.
 *
 * Quadrat i no disc: el mapa es mira desplaçant-lo, i trobar-se una cantonada
 * buida just quan mous el dit és pitjor que baixar quatre tessel·les de més.
 */
export function tilesInRadius(
  lat: number,
  lon: number,
  radiusKm: number,
  zoom: number,
): TileId[] {
  const radiusM = radiusKm * 1000;
  const dLat = radiusM / M_PER_DEG_LAT;
  // A latitud 42° un grau de longitud són 82 km, no 111: sense el cosinus, el
  // marge est-oest quedaria un 25% curt.
  const cosLat = Math.max(0.05, Math.cos((lat * Math.PI) / 180));
  const dLon = dLat / cosLat;

  const north = Math.min(85, lat + dLat);
  const south = Math.max(-85, lat - dLat);

  const n = 2 ** zoom;
  const xOf = (lonDeg: number) => Math.floor(((lonDeg + 180) / 360) * n);
  const yOf = (latDeg: number) => {
    const r = (latDeg * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  };

  const x0 = xOf(lon - dLon);
  const x1 = xOf(lon + dLon);
  const y0 = yOf(north);
  const y1 = yOf(south);

  const tiles: TileId[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      tiles.push({ z: zoom, x: ((x % n) + n) % n, y });
    }
  }
  return tiles;
}

/**
 * Tessel·les d'elevació que necessita el RELLEU OMBREJAT del mapa.
 *
 * Són tessel·les terrarium com les de l'horitzó, però amb la geometria de la
 * cartografia (quadrats per zoom de vista, no anells per distància): el
 * relleu es mira desplaçant el mapa, igual que la base. Es dedupliquen contra
 * les de l'horitzó a `planPrepare` — moltes coincideixen, i és exactament el
 * que es vol: una sola memòria cau, una sola descàrrega.
 */
export function planHillshadeTiles(
  lat: number,
  lon: number,
  levels: BasemapLevel[] = HILLSHADE_LEVELS,
): TileId[] {
  const wanted = new Map<string, TileId>();
  for (const level of levels) {
    for (const tile of tilesInRadius(lat, lon, level.radiusKm, level.zoom)) {
      wanted.set(tileKey(tile), tile);
    }
  }
  return [...wanted.values()];
}

/** Tessel·les del mapa base per a tots els nivells de detall configurats. */
export function planBasemapTiles(
  lat: number,
  lon: number,
  levels: BasemapLevel[] = BASEMAP_LEVELS,
): TileId[] {
  const wanted = new Map<string, TileId>();
  for (const level of levels) {
    for (const tile of tilesInRadius(lat, lon, level.radiusKm, level.zoom)) {
      wanted.set(tileKey(tile), tile);
    }
  }
  return [...wanted.values()];
}

export interface PreparePlan {
  lat: number;
  lon: number;
  terrain: TileId[];
  basemap: TileId[];
  /** Suma de les dues llistes. */
  totalTiles: number;
  /** Estimació prèvia en bytes. El pes real es mesura mentre es baixa. */
  estimatedBytes: number;
  maxRangeKm: number;
}

/** Pla complet d'un punt: què s'ha de baixar i quant ocuparà. */
export function planPrepare(
  lat: number,
  lon: number,
  options: { maxRangeKm?: number; levels?: BasemapLevel[] } = {},
): PreparePlan {
  /*
   * El terreny del pla són DUES necessitats amb una sola llista: els anells
   * de l'horitzó (per calcular) i els quadrats del relleu ombrejat (per
   * pintar). Comparteixen URL i memòria cau, així que es dedupliquen aquí i
   * la descàrrega, el recompte i l'estimació de pes en surten coherents sense
   * que `prepare.ts` hagi de saber que existeix el hillshade.
   */
  const terrainWanted = new Map<string, TileId>();
  for (const tile of planTerrainTiles(lat, lon, options.maxRangeKm)) {
    terrainWanted.set(tileKey(tile), tile);
  }
  for (const tile of planHillshadeTiles(lat, lon)) {
    terrainWanted.set(tileKey(tile), tile);
  }
  const terrain = [...terrainWanted.values()];
  const basemap = planBasemapTiles(lat, lon, options.levels);
  const rings = options.maxRangeKm === undefined ? DEFAULT_RINGS : clipRings(options.maxRangeKm);
  const maxRangeKm = rings.reduce((max, r) => Math.max(max, r.maxDistanceKm), 0);

  return {
    lat,
    lon,
    terrain,
    basemap,
    totalTiles: terrain.length + basemap.length,
    estimatedBytes:
      terrain.length * AVG_TERRAIN_TILE_BYTES + basemap.length * AVG_BASEMAP_TILE_BYTES,
    maxRangeKm,
  };
}

/**
 * Bytes en text curt i llegible, amb decimals catalans.
 *
 * Unitats de 1024 amb els noms de 1000 (MB i no MiB) perquè és el que espera
 * qualsevol persona que compari amb l'espai lliure que li ensenya el telèfon.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';

  const units: Array<{ limit: number; suffix: string; decimals: number }> = [
    { limit: 1024, suffix: 'B', decimals: 0 },
    { limit: 1024 ** 2, suffix: 'kB', decimals: 0 },
    { limit: 1024 ** 3, suffix: 'MB', decimals: 1 },
    { limit: Infinity, suffix: 'GB', decimals: 2 },
  ];

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    if (bytes < unit.limit) {
      const value = bytes / (i === 0 ? 1 : 1024 ** i);
      return `${value.toFixed(unit.decimals).replace('.', ',')} ${unit.suffix}`;
    }
  }
  return `${bytes} B`;
}
