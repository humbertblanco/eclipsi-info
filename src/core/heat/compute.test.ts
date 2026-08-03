/**
 * Proves del motor del mapa de calor.
 *
 * Igual que a `spots/search.test.ts`: el terreny és sintètic i injectat —sabem
 * la resposta exacta i la prova és determinista— i l'astronomia és la de
 * veritat, perquè inventar-se un eclipsi no prova res.
 *
 * Les quatre coses que aquestes proves defensen són les quatre que, si es
 * trenquen, no peten enlloc i s'ensenyen a l'usuari com si res:
 *
 *  1. Que el nivell 1 no toqui la xarxa. Si un dia hi toca, el mapa deixarà
 *     d'aparèixer de seguida i ningú no sabrà per què.
 *  2. Que el terreny decideixi de debò: una carena a ponent ha de menjar-se els
 *     segons de les cel·les de sotavent, perquè el Sol del 2026 es pon per allà
 *     a 7° d'altura. Si el garbell mirés l'azimut equivocat, el mapa sortiria
 *     tot verd i seria una mentida ben pintada.
 *  3. Que cancel·lar cancel·li. El mapa es mou mentre calcula; una passada
 *     zombi pintaria cel·les d'un enquadrament que ja no existeix.
 *  4. Que la diferència entre estimació i mesura sigui visible al tipus.
 */

import { describe, expect, it, vi } from 'vitest';
import type { TileId } from '../horizon/elevation';
import type { ElevationReader } from '../spots/types';
import { computeHeat, type HeatCacheAdapter, type HeatCellValue } from './compute';
import { cellsForViewport, type HeatBbox } from './grid';

const ECLIPSE = '2026-08-12';

/** Sòria: ben endins de la franja del 12-08-2026, amb el Sol a 7,2°. */
const SORIA = { lat: 41.7665, lon: -2.479 };

/**
 * Enquadrament petit al voltant de Sòria, amb cel·les d'1,8 km forçades.
 *
 * La mida es força per tenir-ne poques desenes i que la prova sigui ràpida,
 * però sobretot per poder plantar la paret FORA de l'abast del submostreig del
 * cim: amb cel·les d'1,8 km, cap mostra no s'allunya més de 0,83 km del centre,
 * i la paret és a més de 4 km de la cel·la més occidental. Cap cel·la no s'hi
 * pot enfilar, que és el que aquestes proves volen.
 */
const VIEW: HeatBbox = {
  west: SORIA.lon - 0.03,
  south: 41.72,
  east: SORIA.lon + 0.06,
  north: 41.82,
};

function viewCells() {
  return cellsForViewport(VIEW, 11, undefined, { cellZoom: 14 });
}

/* ---------------------------------------------------------------- terrenys */

/** Altiplà pla a 1.000 m. Res no pot tapar el Sol. */
const ALTIPLA: ElevationReader = () => 1000;

/**
 * Carena nord-sud a ponent, entre 7,9 i 9,5 km de Sòria, 3.000 m per damunt de
 * l'altiplà. Des de la cel·la més oriental de l'enquadrament (uns 14 km) encara
 * es veu a 11,5°, molt per damunt del Sol d'aquell dia. Se'ls menja la fase
 * central a totes.
 */
const CARENA: ElevationReader = (lon) =>
  lon < SORIA.lon - 0.095 && lon > SORIA.lon - 0.115 ? 4000 : 1000;

/* ------------------------------------------------------- dobles de la xarxa */

function fakePrefetch(log: { lots: number; tiles: TileId[] }) {
  return (tiles: TileId[], options: { onTileDone?: (d: number, t: number) => void }) => {
    log.lots++;
    for (const tile of tiles) log.tiles.push(tile);
    options.onTileDone?.(tiles.length, tiles.length);
    return Promise.resolve({
      requested: tiles.length,
      loaded: tiles.length,
      failed: 0,
    });
  };
}

/* ==================================================================== proves */

describe('el nivell 1 és teoria pura', () => {
  it('no fa ni una petició de xarxa ni llegeix ni una cota', async () => {
    const log = { lots: 0, tiles: [] as TileId[] };
    const elevation = vi.fn<ElevationReader>(() => 1000);

    const outcome = await computeHeat({
      eclipseId: ECLIPSE,
      cells: viewCells(),
      level: 1,
      elevation,
      prefetch: fakePrefetch(log),
    });

    expect(outcome.cells.length).toBeGreaterThan(0);
    expect(log.lots).toBe(0);
    expect(log.tiles).toHaveLength(0);
    expect(elevation).not.toHaveBeenCalled();
    expect(outcome.cost.tiles).toBe(0);
    expect(outcome.cost.terrainSamples).toBe(0);
    expect(outcome.cost.level).toBe(1);
  });

  it('diu al tipus que encara no ha mirat el terreny', async () => {
    const outcome = await computeHeat({
      eclipseId: ECLIPSE,
      cells: viewCells(),
      level: 1,
      elevation: ALTIPLA,
      prefetch: fakePrefetch({ lots: 0, tiles: [] }),
    });

    for (const cell of outcome.cells) {
      expect(cell.detail).toBe('theory');
      expect(cell.coverage).toBe(0);
      expect(cell.theoreticalSec).toBeGreaterThan(0);
      // Amb fase central i sense terreny mirat, els segons visibles no se
      // saben. Dir-ne zero seria mentir; dir-ne la teoria, també.
      expect(cell.visibleSec).toBeNull();
    }
  });

  it('sense fase central el zero sí que es coneix sense mirar cap muntanya', async () => {
    // Madrid: hi ha eclipsi, però no hi ha totalitat.
    const madrid: HeatBbox = { west: -3.75, south: 40.38, east: -3.65, north: 40.45 };
    const outcome = await computeHeat({
      eclipseId: ECLIPSE,
      cells: cellsForViewport(madrid, 11, undefined, { cellZoom: 14 }),
      level: 1,
      elevation: ALTIPLA,
      prefetch: fakePrefetch({ lots: 0, tiles: [] }),
    });

    expect(outcome.cells.length).toBeGreaterThan(0);
    for (const cell of outcome.cells) {
      expect(cell.theoreticalSec).toBe(0);
      expect(cell.visibleSec).toBe(0);
    }
  });
});

describe('el terreny decideix', () => {
  it('sobre l’altiplà els segons visibles són els teòrics', async () => {
    const outcome = await computeHeat({
      eclipseId: ECLIPSE,
      cells: viewCells(),
      elevation: ALTIPLA,
      prefetch: fakePrefetch({ lots: 0, tiles: [] }),
    });

    expect(outcome.cost.level).toBe(2);
    for (const cell of outcome.cells) {
      expect(cell.detail).toBe('sieve');
      expect(cell.visibleSec).not.toBeNull();
      expect(cell.visibleSec as number).toBeCloseTo(cell.theoreticalSec, 0);
      expect(cell.coverage).toBe(1);
    }
  });

  it('una carena a ponent se’ls menja: el Sol del 2026 es pon per allà a 7°', async () => {
    const pla = await computeHeat({
      eclipseId: ECLIPSE,
      cells: viewCells(),
      elevation: ALTIPLA,
      prefetch: fakePrefetch({ lots: 0, tiles: [] }),
    });
    const carena = await computeHeat({
      eclipseId: ECLIPSE,
      cells: viewCells(),
      elevation: CARENA,
      prefetch: fakePrefetch({ lots: 0, tiles: [] }),
    });

    const perId = new Map(pla.cells.map((c) => [c.id, c]));
    expect(carena.cells.length).toBe(pla.cells.length);

    for (const cell of carena.cells) {
      const bessona = perId.get(cell.id);
      expect(bessona).toBeDefined();
      // La teoria no canvia: la carena no mou les efemèrides, només tapa.
      expect(cell.theoreticalSec).toBeCloseTo(bessona?.theoreticalSec ?? 0, 6);
      expect(cell.visibleSec).toBe(0);
      expect(bessona?.visibleSec as number).toBeGreaterThan(0);
    }
  });

  it('el garbell mira el terreny i ho publica al cost', async () => {
    const log = { lots: 0, tiles: [] as TileId[] };
    const outcome = await computeHeat({
      eclipseId: ECLIPSE,
      cells: viewCells(),
      elevation: ALTIPLA,
      prefetch: fakePrefetch(log),
    });

    expect(outcome.cost.terrainSamples).toBeGreaterThan(1000);
    expect(outcome.cost.tiles).toBeGreaterThan(0);
    // Cap tessel·la demanada dues vegades: la comptabilitat seria una mentida
    // si el mateix fitxer es baixés a dues etapes.
    const claus = log.tiles.map((t) => `${t.z}/${t.x}/${t.y}`);
    expect(new Set(claus).size).toBe(claus.length);
  });

  it('un terreny sense dades es diu amb la cobertura, no s’amaga', async () => {
    const buit: ElevationReader = () => undefined;
    const outcome = await computeHeat({
      eclipseId: ECLIPSE,
      cells: viewCells(),
      elevation: buit,
      prefetch: fakePrefetch({ lots: 0, tiles: [] }),
    });
    for (const cell of outcome.cells) expect(cell.coverage).toBe(0);
  });
});

describe('publicació progressiva', () => {
  it('les cel·les arriben per blocs, primer la teoria i després la mesura', async () => {
    const blocks: HeatCellValue[][] = [];
    const outcome = await computeHeat({
      eclipseId: ECLIPSE,
      cells: viewCells(),
      blockSize: 8,
      elevation: ALTIPLA,
      prefetch: fakePrefetch({ lots: 0, tiles: [] }),
      // Els blocs es copien: `computeHeat` reaprofita l'objecte de cada cel·la
      // per refinar-lo, i guardar-ne la referència ens ensenyaria el final.
      onBlock: (block) => blocks.push(block.map((c) => ({ ...c }))),
    });

    expect(blocks.length).toBeGreaterThan(2);
    for (const block of blocks) expect(block.length).toBeLessThanOrEqual(8);

    expect(blocks[0].every((c) => c.detail === 'theory')).toBe(true);
    expect(blocks[blocks.length - 1].every((c) => c.detail === 'sieve')).toBe(true);

    // Cada cel·la surt dues vegades entre els blocs, però una sola al resultat.
    const totalPublicat = blocks.reduce((sum, block) => sum + block.length, 0);
    expect(totalPublicat).toBe(outcome.cells.length * 2);
    expect(new Set(outcome.cells.map((c) => c.id)).size).toBe(outcome.cells.length);
  });

  it('el progrés no retrocedeix mai i acaba a 1', async () => {
    const ratios: number[] = [];
    await computeHeat({
      eclipseId: ECLIPSE,
      cells: viewCells(),
      blockSize: 8,
      elevation: ALTIPLA,
      prefetch: fakePrefetch({ lots: 0, tiles: [] }),
      onProgress: (progress) => {
        expect(progress.message.length).toBeGreaterThan(0);
        ratios.push(progress.ratio);
      },
    });

    expect(ratios.length).toBeGreaterThan(2);
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]).toBeGreaterThanOrEqual(ratios[i - 1] - 1e-9);
    }
    expect(ratios[ratios.length - 1]).toBe(1);
  });
});

describe('cancel·lació', () => {
  it('un senyal ja cancel·lat no arrenca res', async () => {
    const controller = new AbortController();
    controller.abort();
    const log = { lots: 0, tiles: [] as TileId[] };

    await expect(
      computeHeat({
        eclipseId: ECLIPSE,
        cells: viewCells(),
        elevation: ALTIPLA,
        prefetch: fakePrefetch(log),
        signal: controller.signal,
      }),
    ).rejects.toThrow(/cancel/i);
    expect(log.lots).toBe(0);
  });

  it('cancel·lar a mig càlcul no publica cap bloc posterior', async () => {
    const controller = new AbortController();
    const blocks: HeatCellValue[][] = [];
    const log = { lots: 0, tiles: [] as TileId[] };

    await expect(
      computeHeat({
        eclipseId: ECLIPSE,
        cells: viewCells(),
        blockSize: 4,
        elevation: ALTIPLA,
        prefetch: fakePrefetch(log),
        signal: controller.signal,
        onBlock: (block) => {
          blocks.push(block);
          controller.abort();
        },
      }),
    ).rejects.toThrow(/cancel/i);

    // Exactament un bloc: el que estava en marxa quan s'ha cancel·lat.
    expect(blocks).toHaveLength(1);
    // I no s'ha arribat a gastar xarxa, que és tot el sentit de cancel·lar.
    expect(log.lots).toBe(0);
  });
});

describe('la memòria cau, quan n’hi ha', () => {
  it('les cel·les que ja sabem es publiquen primer i no es recalculen', async () => {
    const cells = viewCells();
    const conegut: HeatCellValue = {
      id: cells[0].id,
      lat: cells[0].lat,
      lon: cells[0].lon,
      poly: [],
      theoreticalSec: 42,
      visibleSec: 17,
      detail: 'sieve',
      coverage: 1,
    };

    const escrites: HeatCellValue[] = [];
    const cache: HeatCacheAdapter = {
      read: (_eclipseId, ids) =>
        Promise.resolve(
          new Map(ids.includes(conegut.id) ? [[conegut.id, conegut]] : []),
        ),
      write: (_eclipseId, written) => {
        for (const cell of written) escrites.push(cell);
        return Promise.resolve();
      },
    };

    const blocks: HeatCellValue[][] = [];
    const outcome = await computeHeat({
      eclipseId: ECLIPSE,
      cells,
      elevation: ALTIPLA,
      prefetch: fakePrefetch({ lots: 0, tiles: [] }),
      cache,
      onBlock: (block) => blocks.push(block.map((c) => ({ ...c }))),
    });

    // El primer bloc és el de la memòria cau, i arriba abans de calcular res.
    expect(blocks[0]).toHaveLength(1);
    expect(blocks[0][0].id).toBe(conegut.id);
    expect(blocks[0][0].visibleSec).toBe(17);
    // El polígon el torna a posar la graella: la memòria cau desa números.
    expect(blocks[0][0].poly).toHaveLength(5);

    const final = outcome.cells.find((c) => c.id === conegut.id);
    expect(final?.visibleSec).toBe(17);
    expect(final?.theoreticalSec).toBe(42);
    expect(outcome.cost.fromCache).toBe(1);

    // I el que s'ha calculat de nou s'ha desat, sense la cel·la ja coneguda.
    expect(escrites.length).toBe(outcome.cells.length - 1);
    for (const cell of escrites) expect(cell.detail).toBe('sieve');
  });
});
