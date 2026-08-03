/**
 * Proves de la capa del mapa de calor, amb un doble de mapa.
 *
 * PER QUÈ ES POT PROVAR SENSE NAVEGADOR, igual que `hillshade.test.ts`:
 * `heatmap.ts` no importa MapLibre, només n'importa el TIPUS, que s'esborra en
 * compilar. Tot el que fa és cridar mitja dotzena de mètodes d'un objecte que
 * rep per paràmetre.
 *
 * QUÈ PROVA I QUÈ NO. Prova el que es pot trencar en silenci: la idempotència
 * (la capa es crida a cada render i duplicar-la peta la pila de dibuix), l'ordre
 * d'inserció respecte de la franja, les dues regles de color del sistema de
 * disseny, i —la important— que una estimació no es pinti mai com una mesura.
 * NO prova que el mapa es vegi bé: això demana una GPU i una persona mirant-lo.
 */

import { describe, expect, it } from 'vitest';
import type { MapLibreMap } from 'maplibre-gl';
import type { HeatCellValue } from '../../../core/heat/compute';
import { readPalette } from '../../../styles/palette';
import {
  BAND_FILL_LAYER,
  BAND_FILL_OPACITY,
  BAND_FILL_OPACITY_UNDER_HEAT,
  ESTIMATE_OPACITY_FACTOR,
  HEAT_FILL_LAYER,
  MIN_TRUSTED_COVERAGE,
  applyHeatmap,
  heatCellPaint,
  heatCellsToGeoJson,
  heatLegendGradient,
  heatRampStops,
  rampCeilingSec,
  removeHeatmap,
  setBandFillForHeatmap,
} from './heatmap';

type Spec = Record<string, unknown>;

/** El mínim de MapLibre que la capa toca. Deliberadament tonto. */
class FakeMap {
  sources = new Map<string, Spec>();
  layers = new Map<string, Spec>();
  data = new Map<string, unknown>();
  paint: Array<[string, string, unknown]> = [];
  beforeIds: Array<string | undefined> = [];

  getSource(id: string): { setData(data: unknown): void } | undefined {
    if (!this.sources.has(id)) return undefined;
    return {
      setData: (data: unknown) => {
        this.data.set(id, data);
      },
    };
  }
  getLayer(id: string): Spec | undefined {
    return this.layers.get(id);
  }
  addSource(id: string, spec: Spec): void {
    if (this.sources.has(id)) throw new Error(`font duplicada: ${id}`);
    this.sources.set(id, spec);
  }
  addLayer(spec: Spec & { id: string }, beforeId?: string): void {
    if (this.layers.has(spec.id)) throw new Error(`capa duplicada: ${spec.id}`);
    this.layers.set(spec.id, spec);
    this.beforeIds.push(beforeId);
  }
  setPaintProperty(layerId: string, name: string, value: unknown): void {
    if (!this.layers.has(layerId)) throw new Error(`capa inexistent: ${layerId}`);
    this.paint.push([layerId, name, value]);
  }
  removeLayer(id: string): void {
    this.layers.delete(id);
  }
  removeSource(id: string): void {
    this.sources.delete(id);
  }

  asMap(): MapLibreMap {
    return this as unknown as MapLibreMap;
  }

  lastPaint(name: string): unknown {
    return this.paint.filter(([, key]) => key === name).at(-1)?.[2];
  }

  heatPaint(): Record<string, unknown> {
    return (this.layers.get(HEAT_FILL_LAYER)?.paint ?? {}) as Record<string, unknown>;
  }

  /** Les dades de la font del mapa de calor, com a col·lecció de GeoJSON. */
  heatData(): { features: Array<{ properties: Record<string, unknown> }> } {
    return this.data.get('visibility-heat') as {
      features: Array<{ properties: Record<string, unknown> }>;
    };
  }
}

const palette = readPalette();

/** Els tres canals d'un color, sense l'opacitat: «47,211,163». */
function rgbTriple(color: string): string {
  const hex = color.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)).join(',');
  }
  const rgb = color.trim().match(/^rgba?\(([^)]+)\)$/);
  if (rgb) return rgb[1].split(/[,\s/]+/).filter(Boolean).slice(0, 3).join(',');
  return color.trim();
}

/** Una cel·la qualsevol, amb el que li vulguem canviar. */
function cell(over: Partial<HeatCellValue> = {}): HeatCellValue {
  return {
    id: '11/1018/770',
    lat: 41.5,
    lon: -1.2,
    poly: [
      [-1.3, 41.4],
      [-1.1, 41.4],
      [-1.1, 41.6],
      [-1.3, 41.6],
      [-1.3, 41.4],
    ],
    theoreticalSec: 96,
    visibleSec: 71,
    detail: 'sieve',
    coverage: 1,
    ...over,
  };
}

describe('heatCellPaint', () => {
  it('una cel·la mesurada amb terreny sencer no és cap estimació', () => {
    const paint = heatCellPaint(cell({ visibleSec: 71, coverage: 1 }));
    expect(paint).toEqual({ sec: 71, estimate: false });
  });

  it('una cel·la que encara no ha vist el terreny és una estimació', () => {
    // Mentre `visibleSec` és nul, el número que es pinta és la durada TEÒRICA:
    // cap muntanya mirada. Vestir-la de mesura és exactament el que aquesta app
    // no fa.
    const paint = heatCellPaint(
      cell({ detail: 'theory', visibleSec: null, coverage: 0 }),
    );
    expect(paint).toEqual({ sec: 96, estimate: true });
  });

  it('zero segons SENSE mirar el terreny no és cap estimació', () => {
    /*
     * El matís que és fàcil perdre: `compute.ts` posa `visibleSec: 0` sense
     * mirar cap muntanya quan no hi ha fase central per perdre. Això no és
     * «encara no ho sabem», és aritmètica de les efemèrides. Si es tractés com
     * a estimació, mitja franja es pintaria esvaïda per sempre.
     */
    const paint = heatCellPaint(
      cell({ detail: 'theory', theoreticalSec: 0, visibleSec: 0, coverage: 0 }),
    );
    expect(paint).toEqual({ sec: 0, estimate: false });
  });

  it('una mesura amb mig terreny buit torna a ser una estimació', () => {
    const paint = heatCellPaint(
      cell({ detail: 'sieve', visibleSec: 60, coverage: MIN_TRUSTED_COVERAGE - 0.01 }),
    );
    expect(paint.estimate).toBe(true);

    const bona = heatCellPaint(
      cell({ detail: 'sieve', visibleSec: 60, coverage: MIN_TRUSTED_COVERAGE }),
    );
    expect(bona.estimate).toBe(false);
  });
});

describe('rampCeilingSec', () => {
  it('arrodoneix cap amunt a passos de 30 s', () => {
    expect(rampCeilingSec([cell({ theoreticalSec: 96 })])).toBe(120);
    expect(rampCeilingSec([cell({ theoreticalSec: 120 })])).toBe(120);
    expect(rampCeilingSec([cell({ theoreticalSec: 121 })])).toBe(150);
  });

  it('no baixa mai', () => {
    // Movent-se per la franja, un sostre que puja i baixa faria que el mateix
    // tros de territori canviés de color segons per on hi haguessis arribat.
    expect(rampCeilingSec([cell({ theoreticalSec: 40 })], 180)).toBe(180);
  });

  it('sense cap cel·la amb fase central no torna zero', () => {
    // Un sostre de zero seria una divisió per zero a la rampa i un mapa sense
    // cap color.
    expect(rampCeilingSec([])).toBe(30);
    expect(rampCeilingSec([cell({ theoreticalSec: 0 })])).toBe(30);
  });

  it('ignora els números impossibles en comptes de propagar-los', () => {
    expect(rampCeilingSec([cell({ theoreticalSec: Number.NaN })], 60)).toBe(60);
  });
});

describe('heatCellsToGeoJson', () => {
  it('cada cel·la porta els segons i si és estimació', () => {
    const collection = heatCellsToGeoJson([
      cell({ id: '11/1/1', visibleSec: 71 }),
      cell({ id: '11/1/2', detail: 'theory', visibleSec: null }),
    ]);
    expect(collection.features).toHaveLength(2);
    expect(collection.features[0].properties).toEqual({ sec: 71, estimate: false });
    expect(collection.features[1].properties).toEqual({ sec: 96, estimate: true });
  });

  it('descarta les cel·les sense anell', () => {
    /*
     * La memòria cau desa números i no geometria (`core/heat/cache.ts`): una
     * cel·la ressuscitada sense que ningú li hagi tornat a enganxar el polígon
     * no és cap error, és una cel·la que encara no es pot dibuixar. Deixar-la
     * passar donaria un `Polygon` amb l'anell buit i MapLibre es queixa de la
     * font sencera.
     */
    const collection = heatCellsToGeoJson([cell({ poly: [] }), cell({ id: '11/2/2' })]);
    expect(collection.features).toHaveLength(1);
  });
});

describe('applyHeatmap', () => {
  it('es pot cridar a cada render sense duplicar res', () => {
    const map = new FakeMap();
    applyHeatmap(map.asMap(), palette, [cell()], { maxSec: 120 });
    applyHeatmap(map.asMap(), palette, [cell()], { maxSec: 120 });
    applyHeatmap(map.asMap(), palette, [cell()], { maxSec: 120 });

    expect(map.sources.size).toBe(1);
    expect(map.layers.size).toBe(1);
    expect(map.layers.has(HEAT_FILL_LAYER)).toBe(true);
  });

  it('s’insereix sota la capa que se li digui, perquè no tapi la vora de la franja', () => {
    const map = new FakeMap();
    applyHeatmap(map.asMap(), palette, [cell()], { maxSec: 120, beforeId: 'band-edge' });
    expect(map.beforeIds).toEqual(['band-edge']);
  });

  it('l’estimació es pinta més fluixa que la mesura', () => {
    const map = new FakeMap();
    applyHeatmap(map.asMap(), palette, [cell()], { maxSec: 120 });

    // `case` sobre la propietat `estimate`: factor per a les estimades, 1 per a
    // les mesurades. El que no pot passar mai és que les dues surtin iguals.
    const opacity = map.heatPaint()['fill-opacity'] as unknown[];
    expect(opacity[0]).toBe('case');
    expect(opacity[2]).toBe(ESTIMATE_OPACITY_FACTOR);
    expect(opacity[3]).toBe(1);
    expect(ESTIMATE_OPACITY_FACTOR).toBeLessThan(1);
  });

  it('la rampa arriba al verd al sostre que se li diu', () => {
    const map = new FakeMap();
    applyHeatmap(map.asMap(), palette, [cell()], { maxSec: 120 });

    const color = map.heatPaint()['fill-color'] as unknown[];
    expect(color[0]).toBe('interpolate');
    // L'última parada de l'expressió: el valor de segons i el color.
    expect(color.at(-2)).toBe(120);
    expect(rgbTriple(String(color.at(-1)))).toBe(rgbTriple(palette.statusClear));
    // I la primera parada (segons 0), el fosc: una cel·la dins de la franja
    // amb zero segons visibles és informació, no és mapa sense calcular.
    expect(color[3]).toBe(0);
    expect(rgbTriple(String(color[4]))).toBe(rgbTriple(palette.bgInset));
  });

  it('el sostre es pot reescriure sense refer la capa', () => {
    // El sostre puja quan arriba una cel·la amb més durada teòrica, i llavors
    // tot el mapa s'ha de tornar a repartir els colors.
    const map = new FakeMap();
    applyHeatmap(map.asMap(), palette, [cell()], { maxSec: 120 });
    applyHeatmap(map.asMap(), palette, [cell()], { maxSec: 180 });

    const color = map.lastPaint('fill-color') as unknown[];
    expect(color.at(-2)).toBe(180);
    expect(map.layers.size).toBe(1);
    expect(map.sources.size).toBe(1);
  });

  it('els colors surten de la paleta, i ni ambre ni vermell', () => {
    /*
     * Les dues regles del sistema de disseny que es poden trencar sense
     * adonar-se'n. L'ambre és de la FRANJA i 800 cel·les càlides li competirien
     * pel mateix cop d'ull. El vermell és `statusDanger` i vol dir seguretat
     * ocular: gastar-lo aquí ensenyaria a llegir-lo com «lloc dolent» i el dia
     * que aparegui volent dir «no et treguis el filtre» ja no el mirarà ningú.
     */
    const colors = heatRampStops(palette).map((stop) => rgbTriple(stop.color));
    expect(colors.length).toBeGreaterThan(1);

    const deLaPaleta = new Set(
      Object.values(palette)
        .filter((value) => /^#|^rgba?\(/.test(value))
        .map(rgbTriple),
    );
    const prohibits = new Set(
      [
        palette.accent,
        palette.accentHover,
        palette.sun200,
        palette.sun400,
        palette.statusPartial,
        palette.statusDanger,
      ].map(rgbTriple),
    );

    for (const triple of colors) {
      expect(deLaPaleta.has(triple), `${triple} no surt de la paleta`).toBe(true);
      expect(prohibits.has(triple), `${triple} és ambre o vermell`).toBe(false);
    }
  });

  it('la rampa creix i acaba al verd d’«això es veu»', () => {
    const stops = heatRampStops(palette);
    expect(stops[0].at).toBe(0);
    expect(stops.at(-1)?.at).toBe(1);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].at).toBeGreaterThan(stops[i - 1].at);
    }
    expect(rgbTriple(String(stops.at(-1)?.color))).toBe(rgbTriple(palette.statusClear));
  });

  it('la llegenda i el mapa surten de la mateixa taula', () => {
    // Si la llegenda es dibuixés amb colors propis, el dia que es calibri la
    // rampa quedaria mentint sense que ho vegi ningú.
    const gradient = heatLegendGradient(palette);
    expect(gradient.startsWith('linear-gradient(90deg,')).toBe(true);
    for (const stop of heatRampStops(palette)) {
      expect(gradient).toContain(stop.color);
    }
  });

  it('sense antialiàsing, que si no les cel·les veïnes dibuixen una reixa', () => {
    const map = new FakeMap();
    applyHeatmap(map.asMap(), palette, [cell()], { maxSec: 120 });
    expect(map.heatPaint()['fill-antialias']).toBe(false);
  });

  it('amb la llista buida es buiden les dades, no es desmunta la capa', () => {
    const map = new FakeMap();
    applyHeatmap(map.asMap(), palette, [cell()], { maxSec: 120 });
    applyHeatmap(map.asMap(), palette, [], { maxSec: 120 });

    expect(map.layers.has(HEAT_FILL_LAYER)).toBe(true);
    expect(map.heatData().features).toHaveLength(0);
  });
});

describe('removeHeatmap', () => {
  it('treu la capa i la font, i es pot tornar a posar', () => {
    const map = new FakeMap();
    applyHeatmap(map.asMap(), palette, [cell()], { maxSec: 120 });
    removeHeatmap(map.asMap());
    expect(map.layers.size).toBe(0);
    expect(map.sources.size).toBe(0);

    applyHeatmap(map.asMap(), palette, [cell()], { maxSec: 120 });
    expect(map.layers.size).toBe(1);
  });

  it('no es queixa si no hi havia res', () => {
    // Es crida des de la neteja d'un efecte de React, que pot arribar amb el
    // mapa ja buit.
    const map = new FakeMap();
    expect(() => removeHeatmap(map.asMap())).not.toThrow();
  });
});

describe('setBandFillForHeatmap', () => {
  it('abaixa el farciment ambre amb el mapa de calor encès i el torna en apagar-lo', () => {
    const map = new FakeMap();
    map.addLayer({ id: BAND_FILL_LAYER, type: 'fill' });

    setBandFillForHeatmap(map.asMap(), true);
    expect(map.lastPaint('fill-opacity')).toBe(BAND_FILL_OPACITY_UNDER_HEAT);

    setBandFillForHeatmap(map.asMap(), false);
    expect(map.lastPaint('fill-opacity')).toBe(BAND_FILL_OPACITY);
  });

  it('el farciment baixa però no desapareix', () => {
    // La franja ha de continuar dient on és encara que no s'hagi calculat cap
    // cel·la, i el mapa de calor no arriba mai a la seva vora (es retalla amb
    // 10 km de marge, vegeu `core/heat/grid.ts`).
    expect(BAND_FILL_OPACITY_UNDER_HEAT).toBeGreaterThan(0);
    expect(BAND_FILL_OPACITY_UNDER_HEAT).toBeLessThan(BAND_FILL_OPACITY);
  });

  it('no peta si la capa de la franja encara no hi és', () => {
    // L'estil pot no haver carregat, o el mapa pot estar desmuntant-se.
    const map = new FakeMap();
    expect(() => setBandFillForHeatmap(map.asMap(), true)).not.toThrow();
  });
});
