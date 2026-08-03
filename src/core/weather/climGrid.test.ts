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
 * (888 cel·les) es podria comprovar que el codi no peta, però no que faci el
 * que ha de fer: aquí es pot dir exactament quina cel·la ha de sortir a cada
 * enquadrament i què ha de passar quan una columna ve trencada.
 *
 * I al final del fitxer hi ha el bloc que sí que mira la graella publicada: no
 * per repetir-hi aquestes proves, sinó per les que només tenen sentit sobre
 * dades de debò —caselles repetides, columnes que no lliguen entre elles, i
 * sobretot que el fitxer no anunciï més anys dels que porta a dins.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
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

    /**
     * Cap casella repetida.
     *
     * Sembla impossible i no ho és. L'script pot REPRENDRE una generació a
     * mitges, i el punt de control s'identifica per la casella de la malla
     * justament perquè la llista de cel·les canvia quan es retoca la franja. Si
     * aquella migració s'equivoqués i encavalqués dues entrades, el fitxer
     * sortiria amb dues cel·les al mateix lloc: la segona taparia la primera al
     * mapa i `climCellAt` en tornaria una de les dues sense dir mai quina.
     */
    it(`${entry.id} no repeteix cap casella de la malla`, () => {
      const grid = parseCloudClimGrid(JSON.parse(readFileSync(entry.file, 'utf8')));
      const seen = new Set(grid.cells.ix.map((ix, i) => `${ix},${grid.cells.iy[i]}`));
      expect(seen.size).toBe(grid.cells.ix.length);
    });

    /**
     * Tot són enters, i no per estalviar bytes: `parseCloudClimGrid` només
     * comprova que siguin números finits dins de rang, o sigui que un 63,4999
     * hi passaria i el fitxer creixeria el doble sense que res ho digués.
     */
    it(`${entry.id} publica enters a totes les columnes`, () => {
      const grid = parseCloudClimGrid(JSON.parse(readFileSync(entry.file, 'utf8')));
      for (const [name, column] of Object.entries(grid.cells)) {
        const broken = column.findIndex((value: number) => !Number.isInteger(value));
        expect(`${name}[${broken}]`).toBe(`${name}[-1]`);
      }
    });

    /**
     * Les xifres han de ser coherents ENTRE ELLES, que és el que no mira cap
     * validació de rang. Un 0-100 per columna es compleix igual de bé amb les
     * columnes barrejades entre si; això no.
     */
    it(`${entry.id} té les columnes coherents entre elles`, () => {
      const grid = parseCloudClimGrid(JSON.parse(readFileSync(entry.file, 'utf8')));
      const { clear, cloudy, low, mid, high, total, years, samples } = grid.cells;

      for (let i = 0; i < clear.length; i++) {
        // «Net» i «tapat» són dues bandes disjuntes de la mateixa sèrie: el que
        // sobra és el «depèn». Si sumessin més de cent, s'hauria comptat alguna
        // observació dues vegades.
        expect(clear[i] + cloudy[i]).toBeLessThanOrEqual(100);

        // La cobertura total surt de la superposició aleatòria de les tres
        // capes (vegeu `layers.ts`), i per tant no pot ser menor que cap
        // d'elles. La tolerància d'un punt és l'arrodoniment a enter.
        expect(total[i]).toBeGreaterThanOrEqual(Math.max(low[i], mid[i], high[i]) - 1);

        /*
         * Les mostres són les hores de la finestra, i el sostre es pot comptar
         * exacte: la finestra és de ±1 h al voltant del màxim, o sigui com a
         * molt TRES hores per dia (les dues que l'envolten més la de l'hora
         * justa, quan el màxim cau clavat a l'hora), per 2·windowDays+1 dies.
         * Per al 2026 en surten 22 per any, perquè el màxim cau a les 18:29 i
         * només hi ha dues hores a menys d'una hora.
         *
         * El sostre és el que importa: si un any s'hagués integrat dues
         * vegades, aquesta xifra es doblaria i cap validació de rang no ho
         * veuria — les puntuacions seguirien sent de 0 a 100 i els percentils
         * seguirien quadrant.
         */
        expect(samples[i] / years[i]).toBeGreaterThan(2 * grid.windowDays + 1);
        expect(samples[i] / years[i]).toBeLessThanOrEqual(3 * (2 * grid.windowDays + 1));
      }
    });

    /**
     * LA PROVA D'HONESTEDAT, que és la raó de ser d'aquest fitxer.
     *
     * L'script pot quedar-se a mitges —els sostres d'Open-Meteo hi arriben
     * sovint— i llavors les cel·les tenen menys anys darrere. Això és
     * acceptable; el que no ho és és que la capçalera del fitxer segueixi
     * anunciant la sèrie sencera. Si algú publica una climatologia de dotze
     * anys, el fitxer ho ha de dir ell sol, perquè d'aquí a sis mesos ningú no
     * tindrà la consola d'aquella execució.
     *
     * Es comproven les dues direccions, perquè les dues maneres d'enganyar
     * existeixen: `source` no pot prometre més anys dels que la cel·la més
     * pobra porta, ni menys dels que porta la més rica. I cap cel·la no pot
     * tenir més anys dels que el rang `firstYear`-`lastYear` permet encabir.
     */
    it(`${entry.id} no anuncia més anys dels que té`, () => {
      const grid = parseCloudClimGrid(JSON.parse(readFileSync(entry.file, 'utf8')));
      const declared = grid.lastYear - grid.firstYear + 1;

      expect(Math.max(...grid.cells.years)).toBeLessThanOrEqual(declared);

      // «12 anys» quan totes en tenen els mateixos, «12-13 anys» quan no.
      const said = /(\d+)(?:-(\d+))?\s+anys/.exec(grid.source);
      expect(said, `«${grid.source}» no diu quants anys porta`).not.toBeNull();
      const lo = Number(said?.[1]);
      const hi = said?.[2] === undefined ? lo : Number(said[2]);

      expect(Math.min(...grid.cells.years)).toBe(lo);
      expect(Math.max(...grid.cells.years)).toBe(hi);
    });

    /**
     * El punt tocat al mapa ha de tornar la cel·la que s'hi ha pintat.
     *
     * `climCellAt` arrodoneix les coordenades a la malla i `cellAt` fa el camí
     * invers. Amb un signe canviat en un dels dos, el mapa pintaria bé i la
     * fitxa obriria la cel·la del costat —o la simètrica respecte del meridià
     * zero, que amb una franja que passa per Espanya cau a l'aigua.
     */
    it(`${entry.id} torna la mateixa cel·la que s’hi ha pintat`, () => {
      const grid = parseCloudClimGrid(JSON.parse(readFileSync(entry.file, 'utf8')));
      for (const cell of allClimCells(grid)) {
        const found = climCellAt(grid, cell.lat, cell.lon);
        expect(`${found?.ix},${found?.iy}`).toBe(`${cell.ix},${cell.iy}`);
      }
    });

    /**
     * I el pes, perquè aquest fitxer se'l baixa qui prepari la sortida sense
     * cobertura (`eclipsi-dades-v1`, vegeu `offline/config.ts`). El sostre no
     * és rodó per gust: la graella del 2026 pesa uns 50 kB i el que aquí es
     * vigila és l'ordre de magnitud, no el kB. Si algun dia es baixa el pas de
     * la malla —que multiplicaria les cel·les per catorze— això ha de saltar
     * abans que el fitxer arribi a la motxilla de ningú.
     */
    it(`${entry.id} cap dins del pressupost de dades offline`, () => {
      expect(statSync(entry.file).size).toBeLessThan(250 * 1024);
    });
  }
});
