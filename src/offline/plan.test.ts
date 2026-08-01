/**
 * Proves de la planificació de la precàrrega.
 *
 * El que es prova aquí no és cosmètic: si la llista de tessel·les surt curta,
 * l'usuari es planta a la franja de totalitat amb l'app mig buida i no ho sabrà
 * fins que sigui allà. Per això es comprova la COBERTURA (que cap punt del
 * radi es quedi fora) i no només el recompte.
 */

import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  planBasemapTiles,
  planPrepare,
  planTerrainTiles,
  tilesInRadius,
} from './plan';
import { lonLatToTilePixel, tileKey } from '../core/horizon/elevation';
import { DEFAULT_RINGS } from '../core/horizon/raycast';

/** Reinosa, Cantàbria: dins la franja de totalitat del 12-08-2026. */
const LAT = 42.999;
const LON = -4.138;

describe('planTerrainTiles', () => {
  it('cobreix tots els zooms dels anells del raycast', () => {
    const tiles = planTerrainTiles(LAT, LON);
    const zooms = new Set(tiles.map((t) => t.z));
    for (const ring of DEFAULT_RINGS) {
      expect(zooms.has(ring.zoom)).toBe(true);
    }
  });

  it('no repeteix cap tessel·la', () => {
    const tiles = planTerrainTiles(LAT, LON);
    const keys = new Set(tiles.map(tileKey));
    expect(keys.size).toBe(tiles.length);
  });

  it('inclou la tessel·la del propi observador', () => {
    const tiles = planTerrainTiles(LAT, LON);
    const zoomMesFi = Math.max(...DEFAULT_RINGS.map((r) => r.zoom));
    const here = lonLatToTilePixel(LON, LAT, zoomMesFi);
    expect(tiles.some((t) => t.z === here.z && t.x === here.x && t.y === here.y)).toBe(true);
  });

  it('retallar el radi redueix la feina', () => {
    const complet = planTerrainTiles(LAT, LON);
    const retallat = planTerrainTiles(LAT, LON, 20);
    expect(retallat.length).toBeLessThan(complet.length);
    expect(retallat.length).toBeGreaterThan(0);
  });
});

describe('tilesInRadius', () => {
  it('cobreix els quatre extrems del radi demanat', () => {
    const radiusKm = 25;
    const zoom = 11;
    const tiles = new Set(tilesInRadius(LAT, LON, radiusKm, zoom).map(tileKey));

    // Graus que corresponen al radi, amb el cosinus de la latitud a la
    // longitud: sense ell, la comprovació est-oest passaria per casualitat.
    const dLat = (radiusKm * 1000) / 111_320;
    const dLon = dLat / Math.cos((LAT * Math.PI) / 180);

    const extrems: Array<[number, number]> = [
      [LAT + dLat, LON],
      [LAT - dLat, LON],
      [LAT, LON + dLon],
      [LAT, LON - dLon],
    ];

    for (const [lat, lon] of extrems) {
      const tile = lonLatToTilePixel(lon, lat, zoom);
      expect(tiles.has(tileKey(tile))).toBe(true);
    }
  });

  it('creix amb el zoom', () => {
    const z10 = tilesInRadius(LAT, LON, 10, 10).length;
    const z12 = tilesInRadius(LAT, LON, 10, 12).length;
    expect(z12).toBeGreaterThan(z10);
  });
});

describe('planBasemapTiles', () => {
  it('no repeteix cap tessel·la entre nivells', () => {
    const tiles = planBasemapTiles(LAT, LON);
    expect(new Set(tiles.map(tileKey)).size).toBe(tiles.length);
  });

  it('es manté en un ordre de magnitud raonable per a dades mòbils', () => {
    // Si algú puja un radi o un zoom sense pensar-hi, això salta abans que
    // l'usuari es mengi mig gigabyte.
    expect(planBasemapTiles(LAT, LON).length).toBeLessThan(400);
  });

  it('no arriba al llindar de descàrrega massiva d’OpenStreetMap', () => {
    // La política de tessel·les d'OSM considera descàrrega massiva a partir de
    // 250 tessel·les de zoom 13 o superior. Mentre el mapa base surti d'allà,
    // aquest límit no es pot creuar.
    const fines = planBasemapTiles(LAT, LON).filter((t) => t.z >= 13);
    expect(fines.length).toBeLessThan(250);
  });
});

describe('planPrepare', () => {
  it('suma les dues llistes i estima un pes plausible', () => {
    const plan = planPrepare(LAT, LON);
    expect(plan.totalTiles).toBe(plan.terrain.length + plan.basemap.length);
    // Entre 5 i 60 MB: prou per ser útil, prou poc per no ser una trampa amb
    // dades mòbils.
    expect(plan.estimatedBytes).toBeGreaterThan(5 * 1024 * 1024);
    expect(plan.estimatedBytes).toBeLessThan(60 * 1024 * 1024);
  });

  it('el radi del pla és el de l’anell més llunyà', () => {
    const plan = planPrepare(LAT, LON);
    expect(plan.maxRangeKm).toBe(Math.max(...DEFAULT_RINGS.map((r) => r.maxDistanceKm)));
  });
});

describe('formatBytes', () => {
  it('fa servir la coma decimal catalana', () => {
    expect(formatBytes(15.5 * 1024 * 1024)).toBe('15,5 MB');
  });

  it('escala les unitats', () => {
    expect(formatBytes(0)).toBe('0 MB');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 kB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3,00 GB');
  });
});
