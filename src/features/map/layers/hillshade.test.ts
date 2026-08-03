/**
 * Proves del relleu ombrejat amb un doble de mapa.
 *
 * PER QUÈ ES POT PROVAR SENSE NAVEGADOR. `hillshade.ts` no importa MapLibre:
 * només n'importa el TIPUS, que s'esborra en compilar. Tot el que fa és cridar
 * cinc mètodes d'un objecte que rep per paràmetre. Un doble que apunti aquestes
 * cinc crides no és una simulació de res: és exactament la superfície que el
 * mòdul toca, i per tant el test no menteix més del que promet.
 *
 * QUÈ PROVA I QUÈ NO. Prova les dues coses que es poden trencar en silenci: que
 * la font surti de `TERRAIN_TILE_TEMPLATE` (l'acord de la URL, el mateix que
 * vigila `offline/terrain-agreement.test.ts` per l'altra banda) i que la crida
 * sigui idempotent, perquè `ensureHillshade` es crida a cada render i afegir
 * dues vegades la mateixa capa a MapLibre és un error que peta la pila de
 * dibuix. NO prova que el relleu es vegi bé: això no ho pot dir cap test sense
 * GPU, i qui ho ha de mirar és una persona amb el mapa obert.
 */

import { describe, expect, it } from 'vitest';
import type { MapLibreMap } from 'maplibre-gl';
import {
  DEFAULT_ILLUMINATION_DEG,
  HILLSHADE_LAYER,
  ensureHillshade,
  removeHillshade,
} from './hillshade';
import { HILLSHADE_MAX_ZOOM, TERRAIN_TILE_TEMPLATE } from '../../../offline/config';
import { readPalette } from '../../../styles/palette';

type Spec = Record<string, unknown>;

/**
 * El mínim que `ensureHillshade` demana d'un mapa. Deliberadament tonto: si
 * algun dia el mòdul necessita més superfície de MapLibre, aquest doble ha de
 * quedar-se curt i fer soroll, no dissimular-ho.
 */
class FakeMap {
  sources = new Map<string, Spec>();
  layers = new Map<string, Spec>();
  paint: Array<[string, string, unknown]> = [];
  beforeIds: Array<string | undefined> = [];

  getSource(id: string): Spec | undefined {
    return this.sources.get(id);
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

  /** El doble com el veu el mòdul provat. */
  asMap(): MapLibreMap {
    return this as unknown as MapLibreMap;
  }

  /** Últim valor escrit per a una propietat de pintura. */
  lastPaint(name: string): unknown {
    return this.paint.filter(([, key]) => key === name).at(-1)?.[2];
  }
}

const ILLUMINATION = 'hillshade-illumination-direction';
const palette = readPalette();

/**
 * Els tres canals d'un color, sense l'opacitat: «4,5,10».
 *
 * Serveix per comparar un color de la capa amb el token de què surt encara que
 * hi hagi passat per `withAlpha` (que converteix `#04050A` en
 * `rgba(4,5,10,0.85)`). Així el test comprova d'ON ve la tinta sense fixar amb
 * quanta transparència es fa servir.
 */
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

describe('ensureHillshade', () => {
  it('demana la tessel·la amb la plantilla compartida amb la precàrrega', () => {
    /*
     * L'acord de la URL vist des del mapa. Si algú escrivís aquí la plantilla a
     * mà —encara que fos la mateixa cadena—, el dia que canviï el proveïdor el
     * relleu del mapa quedaria despenjat de la precàrrega i de l'horitzó, i
     * ningú se n'adonaria fins a ser al camp sense cobertura.
     */
    const map = new FakeMap();
    ensureHillshade(map.asMap(), palette, 245);

    const source = map.sources.get('terrain-dem');
    expect(source?.tiles).toEqual([TERRAIN_TILE_TEMPLATE]);
    expect(source?.type).toBe('raster-dem');
    // El terrarium d'AWS el descodifica la GPU: si l'encoding fos 'mapbox', el
    // relleu sortiria com un soroll de muntanyes inventades.
    expect(source?.encoding).toBe('terrarium');
    expect(source?.tileSize).toBe(256);
    expect(source?.maxzoom).toBe(HILLSHADE_MAX_ZOOM);
  });

  it('es pot cridar a cada render sense duplicar res', () => {
    // El doble peta si es repeteix una font o una capa, que és el que faria
    // MapLibre. Tres crides seguides han de deixar-ho tot igual.
    const map = new FakeMap();
    ensureHillshade(map.asMap(), palette, 245);
    ensureHillshade(map.asMap(), palette, 245);
    ensureHillshade(map.asMap(), palette, 245);

    expect(map.sources.size).toBe(1);
    expect(map.layers.size).toBe(1);
    expect(map.layers.has(HILLSHADE_LAYER)).toBe(true);
  });

  it('s’insereix sota la capa que se li digui, perquè el relleu mai tapi la franja', () => {
    const map = new FakeMap();
    ensureHillshade(map.asMap(), palette, 245, 'path-band');
    expect(map.beforeIds).toEqual(['path-band']);
  });

  it('la llum ve d’on serà el Sol, i sempre dins de [0, 359]', () => {
    // MapLibre no accepta graus negatius ni de més de 359. L'azimut del Sol al
    // màxim pot arribar en qualsevol forma des dels contactes, i el que mai pot
    // passar és que una resta de rumbs deixi la capa sense pintar.
    const casos: Array<[number | null, number]> = [
      [245.4, 245],
      [245.6, 246],
      [0, 0],
      [359.6, 0],
      [-45, 315],
      [372, 12],
    ];

    for (const [entrada, esperat] of casos) {
      const map = new FakeMap();
      ensureHillshade(map.asMap(), palette, entrada);
      expect(map.lastPaint(ILLUMINATION)).toBe(esperat);
    }
  });

  it('sense Sol cau al nord-oest convencional de la cartografia', () => {
    const map = new FakeMap();
    ensureHillshade(map.asMap(), palette, null);
    expect(map.lastPaint(ILLUMINATION)).toBe(DEFAULT_ILLUMINATION_DEG);
    expect(DEFAULT_ILLUMINATION_DEG).toBe(315);
  });

  it('actualitza la llum sense refer la capa', () => {
    // El punt de l'usuari es mou i l'azimut del màxim canvia amb ell: ha de
    // poder-se reescriure la propietat sense tornar a crear font ni capa.
    const map = new FakeMap();
    ensureHillshade(map.asMap(), palette, 245);
    ensureHillshade(map.asMap(), palette, 260);

    expect(map.lastPaint(ILLUMINATION)).toBe(260);
    expect(map.sources.size).toBe(1);
    expect(map.layers.size).toBe(1);
  });

  it('els colors surten de la paleta i cap d’ells no és l’ambre', () => {
    /*
     * Aquest test NO fixa quins tons són ni amb quina opacitat: la intensitat
     * del relleu s'ajusta mirant-lo, i un test que la clavés només serviria per
     * fer-lo saltar cada vegada que algú el calibra. El que fixa són les dues
     * regles del sistema de disseny que sí que es poden trencar sense adonar-se:
     * cap color escrit a mà —tots han de venir de la paleta, encara que sigui
     * amb `withAlpha`— i cap ambre, perquè al mapa l'ambre és de la FRANJA i un
     * relleu càlid li competiria pel mateix cop d'ull.
     */
    const map = new FakeMap();
    ensureHillshade(map.asMap(), palette, 245);

    const paint = map.layers.get(HILLSHADE_LAYER)?.paint as Record<string, unknown>;
    const colors = Object.entries(paint)
      .filter(([key]) => key.endsWith('-color'))
      .map(([key, value]) => [key, rgbTriple(String(value))] as const);
    expect(colors.length).toBeGreaterThan(0);

    const deLaPaleta = new Set(
      Object.values(palette)
        .filter((value) => /^#|^rgba?\(/.test(value))
        .map(rgbTriple),
    );
    const ambres = new Set(
      [palette.accent, palette.accentHover, palette.sun200, palette.sun400].map(rgbTriple),
    );

    for (const [key, triple] of colors) {
      expect(deLaPaleta.has(triple), `${key} no surt de la paleta`).toBe(true);
      expect(ambres.has(triple), `${key} és ambre, i l'ambre és de la franja`).toBe(false);
    }

    // L'exageració és un factor, no una alçada: fora de (0, 1] MapLibre no fa
    // res que tingui sentit.
    const exageracio = paint['hillshade-exaggeration'] as number;
    expect(exageracio).toBeGreaterThan(0);
    expect(exageracio).toBeLessThanOrEqual(1);
  });

  it('la llum es mesura des del nord i no des de la vora de la pantalla', () => {
    // `illumination-anchor: 'map'`. Amb el valor per defecte de MapLibre
    // ('viewport') els graus del Sol girarien amb la càmera i tota la capa
    // passaria de ser una dada a ser decoració. És una línia que és fàcil
    // perdre en una refactorització i impossible de trobar mirant el mapa.
    const map = new FakeMap();
    ensureHillshade(map.asMap(), palette, 245);
    const paint = map.layers.get(HILLSHADE_LAYER)?.paint as Record<string, unknown>;
    expect(paint['hillshade-illumination-anchor']).toBe('map');
  });
});

describe('removeHillshade', () => {
  it('treu la capa i la font', () => {
    const map = new FakeMap();
    ensureHillshade(map.asMap(), palette, 245);
    removeHillshade(map.asMap());

    expect(map.layers.size).toBe(0);
    expect(map.sources.size).toBe(0);
  });

  it('no es queixa si no hi havia res', () => {
    // Es crida des de la neteja d'un efecte de React, que pot arribar amb el
    // mapa ja buit o després d'un canvi d'estil que s'ho ha endut tot.
    const map = new FakeMap();
    expect(() => removeHillshade(map.asMap())).not.toThrow();
  });

  it('després de treure’l es pot tornar a posar', () => {
    const map = new FakeMap();
    ensureHillshade(map.asMap(), palette, 245);
    removeHillshade(map.asMap());
    ensureHillshade(map.asMap(), palette, 245);

    expect(map.sources.size).toBe(1);
    expect(map.layers.size).toBe(1);
  });
});
