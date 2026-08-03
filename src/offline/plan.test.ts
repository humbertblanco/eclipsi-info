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
  planHillshadeTiles,
  planPrepare,
  planTerrainTiles,
  tilesInRadius,
} from './plan';
import { lonLatToTilePixel, tileKey } from '../core/horizon/elevation';
import { DEFAULT_RINGS } from '../core/horizon/raycast';
import { HILLSHADE_LEVELS, HILLSHADE_MAX_ZOOM } from './config';

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

describe('planHillshadeTiles', () => {
  it('no repeteix cap tessel·la entre nivells', () => {
    const tiles = planHillshadeTiles(LAT, LON);
    expect(new Set(tiles.map(tileKey)).size).toBe(tiles.length);
  });

  it('no demana cap zoom que l’horitzó no baixaria igualment', () => {
    /*
     * El relleu ombrejat es pinta amb les MATEIXES tessel·les terrarium que el
     * perfil d'horitzó, i el sostre és `HILLSHADE_MAX_ZOOM` (12, ~30 m). Una
     * tessel·la de z13 al pla seria una descàrrega que no aprofita ningú més:
     * el càlcul no la llegirà mai i MapLibre ja sobreescala z12 sense demanar
     * res. Els zooms han de sortir exactament de `HILLSHADE_LEVELS`.
     */
    const zooms = new Set(planHillshadeTiles(LAT, LON).map((t) => t.z));
    for (const z of zooms) expect(z).toBeLessThanOrEqual(HILLSHADE_MAX_ZOOM);
    expect([...zooms].sort((a, b) => a - b)).toEqual(
      HILLSHADE_LEVELS.map((l) => l.zoom).sort((a, b) => a - b),
    );
  });

  it('cap tessel·la cau fora de la piràmide', () => {
    // Una x o una y fora de [0, 2^z) és un 404 garantit i una entrada de
    // memòria cau enverinada: el service worker només desa el que respon 200,
    // o sigui que aquell forat es tornaria a demanar per xarxa cada vegada.
    for (const tile of planHillshadeTiles(LAT, LON)) {
      const n = 2 ** tile.z;
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(n);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(n);
    }
  });

  it('inclou la tessel·la on és l’observador, al zoom més fi', () => {
    const tiles = new Set(planHillshadeTiles(LAT, LON).map(tileKey));
    const here = lonLatToTilePixel(LON, LAT, HILLSHADE_MAX_ZOOM);
    expect(tiles.has(tileKey(here))).toBe(true);
  });

  it('es manté en un ordre de magnitud raonable per a dades mòbils', () => {
    // Mesurat a Reinosa: 66 tessel·les (9 a z9, 16 a z10, 25 a z11, 16 a z12),
    // uns 4,5 MB de terrarium. El límit de 250 és la mateixa alarma que la del
    // mapa base: si algú puja un radi sense pensar-hi, salta abans que l'usuari
    // es mengi la descàrrega.
    const tiles = planHillshadeTiles(LAT, LON);
    expect(tiles.length).toBeGreaterThan(30);
    expect(tiles.length).toBeLessThan(250);
  });
});

describe('planPrepare', () => {
  it('no compta dues vegades el que necessiten alhora l’horitzó i el relleu', () => {
    /*
     * AQUESTA ÉS LA PROVA QUE PROTEGEIX LA XIFRA QUE VEU L'USUARI. El pla
     * ensenya els MB abans de començar a baixar, i l'horitzó i el relleu
     * ombrejat comparteixen bona part de les tessel·les de prop del punt —
     * mateixa URL, mateixa memòria cau, una sola descàrrega. Si la suma es fes
     * sense deduplicar, l'estimació sortiria inflada i, pitjor, la barra de
     * progrés comptaria feina que no existeix.
     *
     * Mesurat a Reinosa: 157 tessel·les d'anells + 66 de relleu = 223 per
     * separat, 170 un cop deduplicades. Són 53 tessel·les i uns 3,6 MB que no
     * s'han de baixar ni prometre.
     */
    const plan = planPrepare(LAT, LON);
    const horitzo = planTerrainTiles(LAT, LON);
    const relleu = planHillshadeTiles(LAT, LON);

    expect(new Set(plan.terrain.map(tileKey)).size).toBe(plan.terrain.length);
    expect(plan.terrain.length).toBeLessThan(horitzo.length + relleu.length);

    // I no en falta cap: la llista deduplicada és exactament la unió.
    const unio = new Set([...horitzo, ...relleu].map(tileKey));
    expect(new Set(plan.terrain.map(tileKey))).toEqual(unio);
  });

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
