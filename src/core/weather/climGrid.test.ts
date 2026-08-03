/**
 * El que es prova aquí no és aritmètica, és honestedat.
 *
 * Aquest fitxer JSON el genera un script que corre un cop cada molts mesos i
 * després viatja per la xarxa i es queda mesos dins de la memòria cau d'un
 * navegador. Quan es trenqui —i s'acabarà trencant: una compilació a mitges, un
 * desplegament vell, uns pesos de puntuació canviats i el JSON no regenerat— el
 * que NO pot passar és que el mapa pinti colors igualment. Un mapa que no hi és
 * s'entén sol; un mapa amb colors d'una física antiga enganya en silenci.
 *
 * La fixture és minúscula i escrita a mà a posta. Amb la graella de veritat
 * (855 cel·les) es podria comprovar que el codi no peta, però no que faci el
 * que ha de fer: aquí es pot dir exactament quina cel·la ha de sortir a cada
 * enquadrament i què ha de passar quan una columna ve trencada.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CLIM_GRID_FORMAT,
  CloudClimGridError,
  allClimCells,
  climCellAt,
  climCellsForViewport,
  climCellsToGeoJson,
  climGridBounds,
  climGridFileName,
  parseCloudClimGrid,
} from './climGrid';
import { BAND_CLEAR_MIN, BAND_PARTIAL_MIN, SCORING_VERSION } from './layers';

/**
 * Quatre cel·les de 0,25° al voltant de Sòria, amb índexs absoluts sobre la
 * malla: (−10, 167) és lon −2,50 / lat 41,75.
 */
function fixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: CLIM_GRID_FORMAT,
    eclipseId: '2026-08-12',
    scoringVersion: SCORING_VERSION,
    builtAtMs: Date.UTC(2026, 0, 1),
    source: 'Arxiu d’Open-Meteo, 2011-2025',
    attribution: 'Open-Meteo.com (CC BY 4.0)',
    firstYear: 2011,
    lastYear: 2025,
    windowDays: 5,
    stepDeg: 0.25,
    firstTargetMs: Date.UTC(2026, 7, 12, 18, 26),
    lastTargetMs: Date.UTC(2026, 7, 12, 18, 34),
    cells: {
      ix: [-10, -9, -10, -9],
      iy: [167, 167, 166, 166],
      score: [88, 61, 20, 74],
      p25: [70, 40, 5, 55],
      p75: [98, 80, 35, 92],
      clear: [80, 40, 5, 60],
      cloudy: [5, 25, 70, 12],
      low: [4, 20, 70, 8],
      mid: [6, 15, 25, 10],
      high: [30, 40, 20, 25],
      total: [35, 55, 85, 38],
      years: [15, 15, 15, 14],
      samples: [495, 495, 495, 462],
    },
    ...overrides,
  };
}

/** La mateixa fixture amb una sola columna substituïda. */
function withColumn(name: string, values: number[]): Record<string, unknown> {
  const base = fixture();
  const cells = { ...(base.cells as Record<string, number[]>) };
  cells[name] = values;
  return { ...base, cells };
}

describe('parseCloudClimGrid', () => {
  it('llegeix una graella sencera i en torna les columnes', () => {
    const grid = parseCloudClimGrid(fixture());
    expect(grid.eclipseId).toBe('2026-08-12');
    expect(grid.stepDeg).toBe(0.25);
    expect(grid.cells.score).toHaveLength(4);
  });

  it('una graella d’una altra física de puntuació no es llegeix', () => {
    // El cas real: algú toca els pesos de layers.ts, no torna a generar el
    // JSON, i el mapa es posaria a pintar verds calculats amb els d'abans.
    try {
      parseCloudClimGrid(fixture({ scoringVersion: SCORING_VERSION + 1 }));
      expect.unreachable('hauria d’haver llançat');
    } catch (error) {
      expect(error).toBeInstanceOf(CloudClimGridError);
      expect((error as CloudClimGridError).code).toBe('scoring-mismatch');
    }
  });

  it('un JSON que no és aquest format no s’intenta llegir', () => {
    expect(() => parseCloudClimGrid({ format: 'una-altra-cosa' })).toThrow(
      CloudClimGridError,
    );
    expect(() => parseCloudClimGrid(null)).toThrow(CloudClimGridError);
    expect(() => parseCloudClimGrid([1, 2, 3])).toThrow(CloudClimGridError);
  });

  it('una columna més curta que les altres és un fitxer truncat', () => {
    try {
      parseCloudClimGrid(withColumn('score', [88, 61, 20]));
      expect.unreachable('hauria d’haver llançat');
    } catch (error) {
      expect((error as CloudClimGridError).code).toBe('ragged');
    }
  });

  it('cap percentatge no pot sortir de 0 a 100', () => {
    for (const column of ['score', 'p25', 'p75', 'clear', 'cloudy', 'low', 'mid', 'high', 'total']) {
      const tooBig = withColumn(column, [140, 61, 20, 74]);
      const negative = withColumn(column, [-3, 61, 20, 74]);
      expect(() => parseCloudClimGrid(tooBig), column).toThrow(CloudClimGridError);
      expect(() => parseCloudClimGrid(negative), column).toThrow(CloudClimGridError);
    }
  });

  it('els quartils no es poden creuar', () => {
    expect(() => parseCloudClimGrid(withColumn('p25', [99, 40, 5, 55]))).toThrow(
      CloudClimGridError,
    );
  });

  it('una cel·la sense cap any darrere no és una cel·la', () => {
    // Val més no pintar-la que pintar-la de vermell: zero anys no vol dir
    // "sempre tapat", vol dir "no en sé res".
    expect(() => parseCloudClimGrid(withColumn('years', [15, 15, 15, 0]))).toThrow(
      CloudClimGridError,
    );
    expect(() => parseCloudClimGrid(withColumn('samples', [495, 495, 495, 0]))).toThrow(
      CloudClimGridError,
    );
  });

  it('els índexs han de caure sobre la malla', () => {
    expect(() => parseCloudClimGrid(withColumn('iy', [167.5, 167, 166, 166]))).toThrow(
      CloudClimGridError,
    );
  });

  it('un text que falta no passa per bo', () => {
    expect(() => parseCloudClimGrid(fixture({ eclipseId: '' }))).toThrow(
      CloudClimGridError,
    );
    expect(() => parseCloudClimGrid(fixture({ attribution: 42 }))).toThrow(
      CloudClimGridError,
    );
  });
});

describe('cel·les pintables', () => {
  const grid = parseCloudClimGrid(fixture());

  it('l’índex de la malla i les coordenades diuen el mateix', () => {
    const cells = allClimCells(grid);
    const first = cells[0];
    expect(first.lon).toBeCloseTo(-2.5, 10);
    expect(first.lat).toBeCloseTo(41.75, 10);
    // El rectangle és la cel·la sencera, centrada al punt consultat.
    expect(first.west).toBeCloseTo(-2.625, 10);
    expect(first.east).toBeCloseTo(-2.375, 10);
    expect(first.south).toBeCloseTo(41.625, 10);
    expect(first.north).toBeCloseTo(41.875, 10);
  });

  it('el color surt del mateix llindar que la fitxa del punt', () => {
    const [clear, partial, cloudy, alsoClear] = allClimCells(grid);
    expect(clear.score).toBeGreaterThanOrEqual(BAND_CLEAR_MIN);
    expect(clear.band).toBe('clear');
    expect(partial.score).toBeGreaterThanOrEqual(BAND_PARTIAL_MIN);
    expect(partial.band).toBe('partial');
    expect(cloudy.score).toBeLessThan(BAND_PARTIAL_MIN);
    expect(cloudy.band).toBe('cloudy');
    expect(alsoClear.band).toBe('clear');
  });

  it('les fraccions surten de 0 a 1, com a ClimatologyStats', () => {
    const [first] = allClimCells(grid);
    expect(first.clearFraction).toBeCloseTo(0.8, 10);
    expect(first.cloudyFraction).toBeCloseTo(0.05, 10);
  });
});

describe('climCellsForViewport', () => {
  const grid = parseCloudClimGrid(fixture());

  it('torna les cel·les que es veuen i cap més', () => {
    const cells = climCellsForViewport(grid, {
      west: -2.6,
      south: 41.7,
      east: -2.4,
      north: 41.8,
    });
    expect(cells).toHaveLength(1);
    expect(cells[0].lat).toBeCloseTo(41.75, 10);
    expect(cells[0].lon).toBeCloseTo(-2.5, 10);
  });

  it('una cel·la que toca la vora del marc SÍ que hi entra', () => {
    // El criteri és la cel·la sencera i no el seu centre: si fos el centre, la
    // fila de dalt desapareixeria just quan l'usuari arrossega el mapa cap allà
    // i la capa quedaria amb un marge buit al voltant.
    const cells = climCellsForViewport(grid, {
      west: -2.4,
      south: 41.8,
      east: -2.35,
      north: 41.85,
    });
    expect(cells.map((c) => c.lon)).toContain(-2.5);
  });

  it('un marc que no toca la graella no torna res', () => {
    expect(
      climCellsForViewport(grid, { west: 0, south: 39, east: 1, north: 40 }),
    ).toHaveLength(0);
  });

  it('un marc que ho abraça tot torna la graella sencera', () => {
    const cells = climCellsForViewport(grid, {
      west: -180,
      south: -90,
      east: 180,
      north: 90,
    });
    expect(cells).toHaveLength(4);
  });
});

describe('climCellAt', () => {
  const grid = parseCloudClimGrid(fixture());

  it('troba la cel·la que conté el punt tocat', () => {
    // Un punt qualsevol de dins de la cel·la, no el seu centre exacte.
    const cell = climCellAt(grid, 41.71, -2.44);
    expect(cell?.lat).toBeCloseTo(41.75, 10);
    expect(cell?.score).toBe(88);
  });

  it('fora de la graella no s’inventa cap cel·la', () => {
    expect(climCellAt(grid, 39, 0)).toBeNull();
  });
});

describe('geometria de sortida', () => {
  const grid = parseCloudClimGrid(fixture());

  it('cada cel·la és un rectangle tancat', () => {
    const geojson = climCellsToGeoJson(allClimCells(grid));
    expect(geojson.features).toHaveLength(4);
    const ring = geojson.features[0].geometry.coordinates[0];
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    expect(geojson.features[0].properties.band).toBe('clear');
  });

  it('els límits de la graella cobreixen totes les cel·les senceres', () => {
    const bounds = climGridBounds(grid);
    expect(bounds?.west).toBeCloseTo(-2.625, 10);
    expect(bounds?.east).toBeCloseTo(-2.125, 10);
    expect(bounds?.south).toBeCloseTo(41.375, 10);
    expect(bounds?.north).toBeCloseTo(41.875, 10);
  });

  it('el nom del fitxer el decideix un sol lloc', () => {
    expect(climGridFileName('2026-08-12')).toBe('clouds-clim-2026-08-12.json');
  });
});

/**
 * I ara el fitxer de veritat, si ja s'ha generat.
 *
 * Les proves de dalt validen el lector amb una fixture escrita a mà; aquesta
 * valida el que de debò es publica. Se salta sola quan el JSON no hi és —
 * generar-lo són dues hores contra l'arxiu d'Open-Meteo i no es pot demanar a
 * qui clona el repositori—, però quan hi és, hi passa: un fitxer que arriba a
 * `public/` és el que baixaran tots els navegadors, i el moment de descobrir
 * que està trencat no pot ser mai el moment en què algú obre el mapa.
 */
const PUBLISHED = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../public/data',
);

const published = ['2026-08-12', '2027-08-02', '2028-01-26']
  .map((id) => ({ id, file: resolve(PUBLISHED, climGridFileName(id)) }))
  .filter((entry) => existsSync(entry.file));

describe.skipIf(published.length === 0)('les graelles publicades', () => {
  for (const entry of published) {
    it(`${entry.id} passa pel mateix lector que fa servir l’app`, () => {
      const grid = parseCloudClimGrid(JSON.parse(readFileSync(entry.file, 'utf8')));

      expect(grid.eclipseId).toBe(entry.id);
      expect(grid.stepDeg).toBe(0.25);
      expect(grid.cells.ix.length).toBeGreaterThan(50);
      expect(grid.lastYear - grid.firstYear).toBe(14);
      expect(grid.attribution).toContain('Open-Meteo');

      // Les hores consultades han de caure el dia de l'eclipsi: si algú toca la
      // manera de treure el màxim local, això ho canta abans que un mapa amb la
      // climatologia del dia equivocat.
      const day = new Date(grid.firstTargetMs).toISOString().slice(0, 10);
      expect(day).toBe(entry.id);
      expect(new Date(grid.lastTargetMs).toISOString().slice(0, 10)).toBe(entry.id);

      // Cap cel·la no es publica amb menys anys dels que la fan honesta.
      expect(Math.min(...grid.cells.years)).toBeGreaterThanOrEqual(6);

      // I la graella ha de tenir varietat: si totes les cel·les tinguessin la
      // mateixa puntuació, el que hi hauria darrere seria un error, no un cel.
      const scores = new Set(grid.cells.score);
      expect(scores.size).toBeGreaterThan(5);
    });
  }
});
