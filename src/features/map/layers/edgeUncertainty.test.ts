/**
 * Proves de la vora d'incertesa amb un doble de mapa.
 *
 * Es pot provar sense navegador pel mateix motiu que el relleu ombrejat:
 * `edgeUncertainty.ts` només importa el TIPUS de MapLibre i tot el que fa és
 * cridar mitja dotzena de mètodes d'un objecte que rep per paràmetre.
 *
 * QUÈ VIGILA. Les tres coses que es poden trencar en silenci i que ningú no
 * veuria mirant el mapa: que la banda tingui l'amplada de terreny que diu el
 * motor (i no una amplada de pantalla, que canviaria amb el zoom i mentiria),
 * que la longitud desenrotllada dels límits polars hi passi intacta, i que
 * l'`fill-antialias` es quedi apagat —amb ell encès, MapLibre dibuixa el
 * contorn de cada tram i la banda es converteix en cinc ratlles noves, que és
 * el contrari del que aquesta capa serveix per dir.
 */

import { describe, expect, it } from 'vitest';
import type { MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection, Polygon } from 'geojson';
import {
  BAND_EDGE_LAYER,
  EDGE_PEAK_OPACITY,
  EDGE_UNCERTAINTY_LAYER,
  applyEdgeUncertainty,
  removeEdgeUncertainty,
  type EdgeUncertaintyData,
} from './edgeUncertainty';
import { EDGE_BAND_STEPS, MAX_EDGE_BAND_HALF_WIDTH_KM } from '../../../core/astro/edgeBand';
import { computeEclipsePath, eclipsePathToGeoJson } from '../../../core/eclipses/path';
import { approxDistanceKm } from '../../../core/spots/grid';
import { readPalette } from '../../../styles/palette';

type Spec = Record<string, unknown>;

/** El mínim que la capa demana d'un mapa: si un dia en demana més, ha de petar. */
class FakeMap {
  sources = new Map<string, Spec>();
  layers = new Map<string, Spec>();
  beforeIds: Array<string | undefined> = [];
  data = new Map<string, unknown>();

  getSource(id: string): Spec | undefined {
    const spec = this.sources.get(id);
    if (spec === undefined) return undefined;
    return { ...spec, setData: (value: unknown) => this.data.set(id, value) };
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
  removeLayer(id: string): void {
    this.layers.delete(id);
  }
  removeSource(id: string): void {
    this.sources.delete(id);
  }

  asMap(): MapLibreMap {
    return this as unknown as MapLibreMap;
  }

  /** L'última col·lecció escrita a la font de la banda. */
  collection(): FeatureCollection {
    return this.data.get('edge-uncertainty') as FeatureCollection;
  }
}

const palette = readPalette();

/** Un tros de límit cap al nord-est, com el del 2026 sobre la Mediterrània. */
const RUN: [number, number][] = [
  [0.4, 40.3],
  [1.2, 40.9],
  [2.0, 41.5],
  [2.8, 42.1],
];

const data: EdgeUncertaintyData = {
  limitRuns: [RUN],
  // El valor real que dona `computeUncertainty` sobre la costa: vegeu
  // `core/astro/edgeBand.test.ts`, que el lliga al motor.
  limitUncertaintyKm: 9.4,
};

describe('applyEdgeUncertainty', () => {
  it('es pot cridar a cada render sense duplicar res', () => {
    const map = new FakeMap();
    applyEdgeUncertainty(map.asMap(), palette, data);
    applyEdgeUncertainty(map.asMap(), palette, data);
    applyEdgeUncertainty(map.asMap(), palette, data);

    expect(map.sources.size).toBe(1);
    expect(map.layers.size).toBe(1);
    expect(map.layers.has(EDGE_UNCERTAINTY_LAYER)).toBe(true);
  });

  it('s’insereix sota la ratlla del límit, perquè la boira no la tapi', () => {
    const map = new FakeMap();
    applyEdgeUncertainty(map.asMap(), palette, data, BAND_EDGE_LAYER);
    expect(map.beforeIds).toEqual([BAND_EDGE_LAYER]);
    // El nom de la capa de la franja no s'escriu a mà al cablejat.
    expect(BAND_EDGE_LAYER).toBe('band-edge');
  });

  it('dibuixa un tram per pas i per costat, tots tancats', () => {
    const map = new FakeMap();
    applyEdgeUncertainty(map.asMap(), palette, data);

    const features = map.collection().features;
    expect(features.length).toBe(EDGE_BAND_STEPS * 2);

    for (const feature of features) {
      const ring = (feature.geometry as Polygon).coordinates[0];
      expect(ring.length).toBe(RUN.length * 2 + 1);
      expect(ring[0]).toEqual(ring[ring.length - 1]);

      const opacity = feature.properties?.opacity as number;
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThanOrEqual(EDGE_PEAK_OPACITY);
    }
  });

  it('la banda té l’amplada de TERRENY que diu el motor', () => {
    /*
     * La prova que justifica tota la capa. Es mesura la distància entre les
     * dues vores exteriors al mateix vèrtex del límit: han de ser dues vegades
     * la semiamplada. Si algun dia això es fes amb `line-width` en píxels,
     * aquest test no ho podria ni comprovar — i el mapa mentiria diferent a
     * cada zoom.
     */
    const map = new FakeMap();
    applyEdgeUncertainty(map.asMap(), palette, data);

    const features = map.collection().features;
    const first = (features[0].geometry as Polygon).coordinates[0];
    const last = (features[features.length - 1].geometry as Polygon).coordinates[0];

    // Segon vèrtex de la vora externa de cada extrem, sobre el mateix punt del
    // límit original.
    const a = first[1];
    const b = last[RUN.length * 2 - 2];
    expect(approxDistanceKm(a[1], a[0], b[1], b[0])).toBeCloseTo(2 * 9.4, 0);
  });

  it('sense semiamplada mesurable, la banda és la del sostre', () => {
    // Gradient nul o cap punt encara: `edgeBandHalfWidthKm` respon el sostre i
    // la capa l'ha de dibuixar igualment, no desaparèixer.
    const map = new FakeMap();
    applyEdgeUncertainty(map.asMap(), palette, { ...data, limitUncertaintyKm: null });

    const features = map.collection().features;
    const first = (features[0].geometry as Polygon).coordinates[0];
    const last = (features[features.length - 1].geometry as Polygon).coordinates[0];
    const a = first[1];
    const b = last[RUN.length * 2 - 2];
    expect(approxDistanceKm(a[1], a[0], b[1], b[0])).toBeCloseTo(
      2 * MAX_EDGE_BAND_HALF_WIDTH_KM,
      0,
    );
  });

  it('no normalitza les longituds desenrotllades dels límits polars', () => {
    const map = new FakeMap();
    applyEdgeUncertainty(map.asMap(), palette, {
      limitRuns: [
        [
          [176, 66],
          [184, 68],
          [192, 70],
        ],
      ],
      limitUncertaintyKm: 9.4,
    });

    for (const feature of map.collection().features) {
      for (const [lon] of (feature.geometry as Polygon).coordinates[0]) {
        expect(lon).toBeGreaterThan(170);
      }
    }
  });

  it('ignora els trams que no són dibuixables', () => {
    const map = new FakeMap();
    applyEdgeUncertainty(map.asMap(), palette, {
      limitRuns: [[[0.4, 40.3]], []],
      limitUncertaintyKm: 9.4,
    });
    expect(map.collection().features).toEqual([]);
  });

  it('amb dades nul·les es buida, però la capa es queda', () => {
    const map = new FakeMap();
    applyEdgeUncertainty(map.asMap(), palette, data);
    applyEdgeUncertainty(map.asMap(), palette, null);

    expect(map.collection().features).toEqual([]);
    expect(map.layers.size).toBe(1);
  });

  it('el color surt de la paleta i no és l’ambre de la franja', () => {
    const map = new FakeMap();
    applyEdgeUncertainty(map.asMap(), palette, data);

    const paint = map.layers.get(EDGE_UNCERTAINTY_LAYER)?.paint as Record<string, unknown>;
    expect(paint['fill-color']).toBe(palette.corona100);
    expect(paint['fill-color']).not.toBe(palette.accent);
    // L'opacitat la porta cada tram: és el degradat.
    expect(paint['fill-opacity']).toEqual(['get', 'opacity']);
    // I l'antialiàsing, apagat: vegeu la capçalera del test.
    expect(paint['fill-antialias']).toBe(false);
  });
});

describe('amb la vora de la franja de veritat', () => {
  it('accepta el que dona `eclipsePathToGeoJson` sense cap conversió', () => {
    /*
     * EL CONTRACTE DEL CABLEJAT. La capa rep `limits.geometry.coordinates` tal
     * com surt del mòdul de la franja: ja partit pels trams dibuixables i amb
     * les longituds desenrotllades. Aquest test el fa amb l'eclipsi de debò
     * perquè, si algun dia aquella forma canvia, es vegi aquí i no al mapa.
     */
    const geojson = eclipsePathToGeoJson(computeEclipsePath('2026-08-12'));
    const runs = geojson.limits.geometry.coordinates;
    expect(runs.length).toBeGreaterThan(0);

    const map = new FakeMap();
    applyEdgeUncertainty(map.asMap(), palette, {
      limitRuns: runs,
      limitUncertaintyKm: 9.4,
    });

    const features = map.collection().features;
    expect(features.length).toBe(runs.length * EDGE_BAND_STEPS * 2);
    for (const feature of features) {
      for (const [lon, lat] of (feature.geometry as Polygon).coordinates[0]) {
        expect(Number.isFinite(lon)).toBe(true);
        expect(Number.isFinite(lat)).toBe(true);
      }
    }
  });
});

describe('removeEdgeUncertainty', () => {
  it('treu la capa i la font, i es pot tornar a posar', () => {
    const map = new FakeMap();
    applyEdgeUncertainty(map.asMap(), palette, data);
    removeEdgeUncertainty(map.asMap());
    expect(map.layers.size).toBe(0);
    expect(map.sources.size).toBe(0);

    applyEdgeUncertainty(map.asMap(), palette, data);
    expect(map.layers.size).toBe(1);
    expect(map.sources.size).toBe(1);
  });

  it('no es queixa si no hi havia res', () => {
    const map = new FakeMap();
    expect(() => removeEdgeUncertainty(map.asMap())).not.toThrow();
  });
});
