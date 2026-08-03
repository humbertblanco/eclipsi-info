/**
 * Proves de la capa de nuvolositat.
 *
 * QUÈ ES VIGILA AQUÍ, i és el mateix que fa que la capa sigui honesta:
 *
 *  1. QUE LA GRAELLA ES VEGI GROLLERA. Rectangles de cinc vèrtexs, retícula
 *     dibuixada i cap suavitzat. Si algú «millorés» el dibuix, el mapa
 *     començaria a prometre un detall que la font no té, i això no es veu com
 *     un defecte: es veu com un mapa més bonic.
 *  2. QUE LA CLIMATOLOGIA I LA PREVISIÓ NO TINGUIN LA MATEIXA CARA. És la
 *     regla d'or de `core/weather`, i al mapa només la pot fer complir la
 *     textura, perquè una taca de color no porta text.
 *  3. QUE ELS LLINDARS DEL COLOR SIGUIN ELS DE LA FITXA. Si es desenganxessin,
 *     una cel·la que es veu neta podria obrir una fitxa que digués «cel a
 *     mitges» i ningú sabria quina de les dues menteix.
 *
 * La graella és de `core/weather/climGrid.ts` i ja té les seves proves; aquí
 * se'n fabrica una de vàlida i petita i el que es prova és el que se'n fa.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapLibreMap } from 'maplibre-gl';
import {
  CLOUD_FILL_LAYER,
  CLOUD_GRID_LAYER,
  CLOUD_HATCH_IMAGE,
  CLOUD_HATCH_LAYER,
  CloudGridLoadError,
  applyClouds,
  forgetCloudClimGrid,
  hatchImage,
  inkBytes,
  loadCloudClimGrid,
  removeClouds,
} from './clouds';
import {
  CLIM_GRID_FORMAT,
  allClimCells,
  parseCloudClimGrid,
} from '../../../core/weather/climGrid';
import { BAND_CLEAR_MIN, BAND_PARTIAL_MIN, SCORING_VERSION } from '../../../core/weather/layers';
import { cloudClimDataUrl } from '../../../offline/config';
import { readPalette } from '../../../styles/palette';

type Spec = Record<string, unknown>;

/** El mínim que `applyClouds` demana d'un mapa. Vegeu `pois.test.ts`. */
class FakeMap {
  sources = new Map<string, Spec & { data?: unknown }>();
  layers = new Map<string, Spec>();
  images = new Map<string, unknown>();
  layout: Array<[string, string, unknown]> = [];

  getSource(id: string): Spec | undefined {
    const source = this.sources.get(id);
    if (source === undefined) return undefined;
    return Object.assign(source, {
      setData: (data: unknown) => {
        source.data = data;
      },
    });
  }
  getLayer(id: string): Spec | undefined {
    return this.layers.get(id);
  }
  addSource(id: string, spec: Spec): void {
    if (this.sources.has(id)) throw new Error(`font duplicada: ${id}`);
    this.sources.set(id, { ...spec });
  }
  addLayer(spec: Spec & { id: string }): void {
    if (this.layers.has(spec.id)) throw new Error(`capa duplicada: ${spec.id}`);
    this.layers.set(spec.id, spec);
  }
  removeLayer(id: string): void {
    this.layers.delete(id);
  }
  removeSource(id: string): void {
    this.sources.delete(id);
  }
  hasImage(id: string): boolean {
    return this.images.has(id);
  }
  addImage(id: string, image: unknown): void {
    if (this.images.has(id)) throw new Error(`imatge duplicada: ${id}`);
    this.images.set(id, image);
  }
  setLayoutProperty(layer: string, name: string, value: unknown): void {
    if (!this.layers.has(layer)) throw new Error(`capa inexistent: ${layer}`);
    this.layout.push([layer, name, value]);
  }

  asMap(): MapLibreMap {
    return this as unknown as MapLibreMap;
  }

  data(): {
    features: Array<{
      properties: Record<string, unknown>;
      geometry: { type: string; coordinates: number[][][] };
    }>;
  } {
    return this.sources.get('cloud-cells')?.data as never;
  }

  lastLayout(layer: string, name: string): unknown {
    return this.layout.filter(([l, n]) => l === layer && n === name).at(-1)?.[2];
  }
}

const palette = readPalette();

/** Una graella vàlida i mínima, amb tantes cel·les com puntuacions se li donin. */
function gridBody(scores: number[] = [90, 50, 10]): Record<string, unknown> {
  const n = scores.length;
  const fill = (value: number): number[] => Array.from({ length: n }, () => value);
  return {
    format: CLIM_GRID_FORMAT,
    eclipseId: '2026-08-12',
    scoringVersion: SCORING_VERSION,
    builtAtMs: 1_775_000_000_000,
    source: 'ERA5 via Open-Meteo',
    attribution: 'Dades meteorològiques d’Open-Meteo.com (CC BY 4.0)',
    firstYear: 2010,
    lastYear: 2024,
    windowDays: 3,
    stepDeg: 0.25,
    firstTargetMs: 1_786_000_000_000,
    lastTargetMs: 1_786_000_300_000,
    cells: {
      ix: scores.map((_, i) => 6 + i),
      iy: fill(166),
      score: scores,
      p25: scores.map((s) => Math.max(0, s - 10)),
      p75: scores.map((s) => Math.min(100, s + 10)),
      clear: fill(40),
      cloudy: fill(30),
      low: fill(20),
      mid: fill(20),
      high: fill(20),
      total: fill(50),
      years: fill(15),
      samples: fill(45),
    },
  };
}

function cellsFrom(scores?: number[]) {
  return allClimCells(parseCloudClimGrid(gridBody(scores)));
}

afterEach(() => {
  forgetCloudClimGrid();
  vi.unstubAllGlobals();
});

describe('loadCloudClimGrid', () => {
  it('demana la URL d’`offline/config`, la que el service worker desa', () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(gridBody()), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    void loadCloudClimGrid('2026-08-12');
    expect(fetchMock.mock.calls[0][0]).toBe(cloudClimDataUrl('2026-08-12'));
    // El mateix patró que casa la regla de `runtimeCaching` de vite.config.ts.
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/data\/[^/]+\.json$/);
  });

  it('la graella que encara no s’ha generat és «network», no cap disbarat', async () => {
    // `scripts/build-cloud-clim.ts` costa vuit mil crides a Open-Meteo i hi ha
    // eclipsis del catàleg que encara no la tenen. Un 404 és un estat normal.
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response('', { status: 404 })));

    const error = await loadCloudClimGrid('2028-01-26').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CloudGridLoadError);
    expect((error as CloudGridLoadError).code).toBe('network');
  });

  it('una graella d’una física de puntuació antiga es rebutja', async () => {
    /*
     * Si algú toca els pesos de `layers.ts` i no torna a generar el JSON, el
     * mapa pintaria colors d'una física que ja hem corregit i la fitxa en diria
     * una altra cosa. `parseCloudClimGrid` s'hi nega; aquí es comprova que la
     * negativa arribi a dalt en comptes de perdre's.
     */
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        new Response(
          JSON.stringify({ ...gridBody(), scoringVersion: SCORING_VERSION + 1 }),
          { status: 200 },
        ),
      ),
    );

    const error = await loadCloudClimGrid('2026-08-12').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CloudGridLoadError);
    expect((error as CloudGridLoadError).code).toBe('format');
    // La causa original es conserva per a qui miri la consola.
    expect((error as CloudGridLoadError).cause).toMatchObject({
      name: 'CloudClimGridError',
      code: 'scoring-mismatch',
    });
  });

  it('dues crides seguides són una sola petició', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(gridBody()), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([
      loadCloudClimGrid('2026-08-12'),
      loadCloudClimGrid('2026-08-12'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });
});

describe('applyClouds', () => {
  it('pinta rectangles de vores rectes, un per cel·la', () => {
    // Rectangles i no cercles difuminats: la cel·la és un tros de territori amb
    // vores rectes i un sol valor.
    const map = new FakeMap();
    applyClouds(map.asMap(), palette, cellsFrom([90, 50, 10]), 'hatch');

    const features = map.data().features;
    expect(features).toHaveLength(3);
    for (const feature of features) {
      expect(feature.geometry.type).toBe('Polygon');
      // Cinc vèrtexs: quatre cantonades i el tancament.
      expect(feature.geometry.coordinates[0]).toHaveLength(5);
    }
  });

  it('la retícula de 25 km es dibuixa, i el farciment no es suavitza', () => {
    /*
     * Les dues meitats de «grollera a posta». Sense la retícula, dues cel·les
     * de puntuació propera es fonen en una taca contínua; amb l'antialiàsing
     * del farciment, entre cel·la i cel·la hi queda un fil clar que sembla una
     * quadrícula però no és cap dada.
     */
    const map = new FakeMap();
    applyClouds(map.asMap(), palette, cellsFrom(), 'solid');

    expect(map.layers.get(CLOUD_GRID_LAYER)?.type).toBe('line');
    const fill = map.layers.get(CLOUD_FILL_LAYER)?.paint as Record<string, unknown>;
    expect(fill['fill-antialias']).toBe(false);
  });

  it('l’opacitat canvia de règim exactament als llindars de la fitxa', () => {
    /*
     * Els dos números del mig han de ser `BAND_PARTIAL_MIN` i `BAND_CLEAR_MIN`
     * de `core/weather/layers.ts`, no dos números rodons semblants. Són els que
     * decideixen la PARAULA de la fitxa, i el color i la paraula no es poden
     * contradir.
     */
    const map = new FakeMap();
    applyClouds(map.asMap(), palette, cellsFrom(), 'hatch');

    const fill = map.layers.get(CLOUD_FILL_LAYER)?.paint as Record<string, unknown>;
    const ramp = fill['fill-opacity'] as unknown[];
    expect(ramp[0]).toBe('interpolate');
    expect(ramp[2]).toEqual(['get', 'score']);
    expect(ramp).toContain(BAND_PARTIAL_MIN);
    expect(ramp).toContain(BAND_CLEAR_MIN);

    // I com més tapat, més tinta: la parada de 0 ha de ser la més opaca i la
    // de 100 la que menys. Al revés, el mapa diria el contrari del que passa.
    const stops = new Map<number, number>();
    for (let i = 3; i < ramp.length; i += 2) {
      stops.set(ramp[i] as number, ramp[i + 1] as number);
    }
    expect(stops.get(0)).toBeGreaterThan(stops.get(100) as number);
    // Cap dels dos extrems no arriba al final: el cel net s'ha de veure i el
    // cel tapat no pot amagar la franja.
    expect(stops.get(100)).toBeGreaterThan(0);
    expect(stops.get(0)).toBeLessThan(1);
  });

  it('la climatologia porta trama i la previsió no', () => {
    // La regla d'or de `core/weather` al mapa: una previsió i una climatologia
    // no s'ensenyen mai amb la mateixa cara.
    const map = new FakeMap();
    applyClouds(map.asMap(), palette, cellsFrom(), 'hatch');
    expect((map.layers.get(CLOUD_HATCH_LAYER)?.layout as Spec).visibility).toBe('visible');

    applyClouds(map.asMap(), palette, cellsFrom(), 'solid');
    expect(map.lastLayout(CLOUD_HATCH_LAYER, 'visibility')).toBe('none');

    // I canviar de cara no refà res: el dia que la previsió entra en horitzó,
    // el mapa no ha de parpellejar.
    expect(map.layers.size).toBe(3);
    expect(map.sources.size).toBe(1);
  });

  it('la trama es genera aquí i no es baixa de cap lloc', () => {
    // Una imatge de trama que vingués per xarxa deixaria la distinció entre
    // previsió i climatologia sense cobertura, que és quan més falta fa.
    const map = new FakeMap();
    applyClouds(map.asMap(), palette, cellsFrom(), 'hatch');

    const image = map.images.get(CLOUD_HATCH_IMAGE) as { data: Uint8Array } | undefined;
    expect(image).toBeDefined();
    expect(image?.data).toBeInstanceOf(Uint8Array);
  });

  it('es pot cridar a cada render sense duplicar res', () => {
    const map = new FakeMap();
    for (let i = 0; i < 3; i++) applyClouds(map.asMap(), palette, cellsFrom(), 'hatch');

    expect(map.sources.size).toBe(1);
    expect(map.layers.size).toBe(3);
    expect(map.images.size).toBe(1);
  });

  it('sense cel·les, la capa es buida però es queda', () => {
    const map = new FakeMap();
    applyClouds(map.asMap(), palette, cellsFrom(), 'hatch');
    applyClouds(map.asMap(), palette, null, 'hatch');

    expect(map.data().features).toHaveLength(0);
    expect(map.layers.size).toBe(3);
  });

  it('la tinta és una sola i surt de la paleta, i no és l’ambre', () => {
    /*
     * Cap rampa de verd a vermell: al mapa l'ambre és de la franja i el verd
     * és el `statusClear` del veredicte de visibilitat. Una segona escala de
     * colors competiria amb totes dues.
     */
    const map = new FakeMap();
    applyClouds(map.asMap(), palette, cellsFrom(), 'hatch');

    const cloudy = inkBytes(palette.statusCloudy)?.join(',');
    const prohibits = [palette.accent, palette.accentHover, palette.sun200, palette.sun400]
      .map((c) => inkBytes(c)?.join(','))
      .filter((v): v is string => v !== undefined);

    let comprovats = 0;
    for (const [id, layer] of map.layers) {
      const paint = (layer.paint ?? {}) as Record<string, unknown>;
      for (const [key, value] of Object.entries(paint)) {
        if (!key.endsWith('-color') || typeof value !== 'string') continue;
        const triple = inkBytes(value)?.join(',');
        expect(triple, `${id}/${key} no surt de la paleta`).toBe(cloudy);
        expect(prohibits).not.toContain(triple);
        comprovats += 1;
      }
    }
    expect(comprovats).toBeGreaterThan(0);
  });
});

describe('inkBytes', () => {
  it('desmunta el que poden tornar els tokens', () => {
    expect(inkBytes('#6E7A94')).toEqual([0x6e, 0x7a, 0x94]);
    expect(inkBytes('#abc')).toEqual([0xaa, 0xbb, 0xcc]);
    expect(inkBytes('rgb(110, 122, 148)')).toEqual([110, 122, 148]);
    expect(inkBytes('rgba(110,122,148,.5)')).toEqual([110, 122, 148]);
  });

  it('el que no sap desmuntar torna null, i qui crida se’n va sense trama', () => {
    // Val més una capa sense textura que una textura d'un color inventat.
    expect(inkBytes('color(display-p3 .4 .5 .6)')).toBeNull();
    expect(inkBytes('rebeccapurple')).toBeNull();
  });

  it('llegeix el token de veritat de la paleta', () => {
    expect(inkBytes(palette.statusCloudy)).not.toBeNull();
  });
});

describe('hatchImage', () => {
  it('són ratlles: ni tot ple ni tot buit', () => {
    const { width, height, data } = hatchImage([110, 122, 148], 0.55);
    expect(data).toHaveLength(width * height * 4);

    let pintats = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) pintats += 1;
    expect(pintats).toBeGreaterThan(0);
    expect(pintats).toBeLessThan(width * height);
  });

  it('va premultiplicada, o les ratlles surten amb halo sobre fons fosc', () => {
    // MapLibre espera els canals ja multiplicats per l'alfa. Sense això, la
    // vora de cada ratlla es veu més clara que la ratlla, i tot aquest mapa és
    // fons fosc.
    const { data } = hatchImage([255, 255, 255], 0.5);
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha === 0) continue;
      expect(data[i]).toBeLessThanOrEqual(alpha);
      expect(data[i + 1]).toBeLessThanOrEqual(alpha);
      expect(data[i + 2]).toBeLessThanOrEqual(alpha);
    }
  });

  it('les diagonals van en diagonal', () => {
    // El gest de «això és una estimació» als mapes de paper. Si el patró
    // sortís en horitzontal o en vertical es confondria amb una retícula.
    const { width, data } = hatchImage([255, 255, 255], 1);
    const alphaAt = (x: number, y: number): number => data[(y * width + x) * 4 + 3];
    for (let x = 0; x < width - 1; x++) {
      // Un píxel pintat té el veí de la diagonal també pintat.
      if (alphaAt(x, 0) > 0) expect(alphaAt(x - 1 < 0 ? width - 1 : x - 1, 1)).toBeGreaterThan(0);
    }
  });
});

describe('removeClouds', () => {
  it('treu capes i font, i es deixa la trama', () => {
    // La imatge és un kilobyte i tornar-la a generar a cada interruptor no té
    // cap sentit; a més, `removeImage` a mig desmuntar deixa MapLibre pintant
    // quadrats buits.
    const map = new FakeMap();
    applyClouds(map.asMap(), palette, cellsFrom(), 'hatch');
    removeClouds(map.asMap());

    expect(map.layers.size).toBe(0);
    expect(map.sources.size).toBe(0);
    expect(map.images.size).toBe(1);
  });

  it('no es queixa si no hi havia res', () => {
    const map = new FakeMap();
    expect(() => removeClouds(map.asMap())).not.toThrow();
  });

  it('després de treure-la es pot tornar a posar', () => {
    const map = new FakeMap();
    applyClouds(map.asMap(), palette, cellsFrom(), 'hatch');
    removeClouds(map.asMap());
    applyClouds(map.asMap(), palette, cellsFrom(), 'solid');

    expect(map.layers.size).toBe(3);
    expect(map.sources.size).toBe(1);
    // La imatge ja hi era: no s'hi torna a afegir (el doble petaria).
    expect(map.images.size).toBe(1);
  });
});
