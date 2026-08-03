/**
 * Proves de la fletxa «cap on caminar», amb un doble de mapa.
 *
 * LA PROVA QUE IMPORTA ÉS LA QUE COMPROVA QUE NO ES DIBUIXA RES. Al mig de la
 * franja el gradient de durada és de centèsimes de segon per quilòmetre i el
 * seu rumb és soroll: una fletxa allà seria una ordre inventada, i la gent
 * camina. Per això `moveArrowFrom` és l'únic camí per construir les dades i per
 * això aquí es prova amb el gradient REAL de dos punts del 12 d'agost del 2026
 * —un al mig de la franja i un a tocar del límit— i no només amb objectes
 * fabricats.
 *
 * EL RÈTOL NO ES PROVA: viu en un `Marker` del DOM i sense document la capa se
 * l'estalvia. La geometria, que és el que pot mentir, sí que es prova sencera.
 */

import { describe, expect, it } from 'vitest';
import type { MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection, LineString, Polygon } from 'geojson';
import {
  MAX_ARROW_KM,
  MIN_ARROW_KM,
  MOVE_ARROW_HEAD_LAYER,
  MOVE_ARROW_SHAFT_LAYER,
  applyMoveArrow,
  moveArrowFrom,
  moveArrowLabelPoint,
  moveArrowLengthKm,
  removeMoveArrow,
  type MoveArrowData,
} from './moveArrow';
import { computeDurationGradient, type DurationGradient } from '../../../core/astro/gradient';
import { approxDistanceKm, bearingDeg } from '../../../core/spots/grid';
import { readPalette } from '../../../styles/palette';

type Spec = Record<string, unknown>;

class FakeMap {
  sources = new Map<string, Spec>();
  layers = new Map<string, Spec>();
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

  asMap(): MapLibreMap {
    return this as unknown as MapLibreMap;
  }

  collection(): FeatureCollection {
    return this.data.get('move-arrow') as FeatureCollection;
  }
  part(name: string) {
    return this.collection().features.find((f) => f.properties?.part === name);
  }
}

const palette = readPalette();

const BILBAO = { lat: 43.26, lon: -2.93, elevation: 0 };
/** Al mig de la franja: allà el gradient no diu res que valgui la pena dir. */
const PENISCOLA = { lat: 40.36, lon: 0.4, elevation: 0 };

const gradient = (kind: Partial<DurationGradient>): DurationGradient => ({
  centralSec: 30,
  secondsPerKm: 3,
  bearingDeg: 215,
  worthMoving: true,
  approxKmToBest: 8,
  approxBestSec: 42,
  ...kind,
});

describe('moveArrowFrom', () => {
  it('no dibuixa res quan no val la pena moure’s', () => {
    expect(moveArrowFrom(BILBAO, gradient({ worthMoving: false }), '+0,1 s/km')).toBeNull();
  });

  it('no dibuixa res sense rumb', () => {
    // Inventar-se un rumb en terreny pla és el pitjor que podria fer la capa.
    expect(moveArrowFrom(BILBAO, gradient({ bearingDeg: null }), 'x')).toBeNull();
    expect(moveArrowFrom(BILBAO, gradient({ bearingDeg: Number.NaN }), 'x')).toBeNull();
  });

  it('no dibuixa res sense punt, sense gradient o sense guany', () => {
    expect(moveArrowFrom(null, gradient({}), 'x')).toBeNull();
    expect(moveArrowFrom(BILBAO, null, 'x')).toBeNull();
    expect(moveArrowFrom(BILBAO, gradient({ secondsPerKm: 0 }), 'x')).toBeNull();
  });

  it('amb el gradient REAL del mig de la franja, tampoc', () => {
    const flat = computeDurationGradient('2026-08-12', PENISCOLA);
    expect(flat.worthMoving).toBe(false);
    expect(moveArrowFrom(PENISCOLA, flat, 'x')).toBeNull();
  });

  it('amb el gradient REAL a tocar del límit, sí, i amb el seu rumb', () => {
    const steep = computeDurationGradient('2026-08-12', BILBAO);
    expect(steep.worthMoving).toBe(true);

    const arrow = moveArrowFrom(BILBAO, steep, '+3,0 s/km');
    expect(arrow).not.toBeNull();
    expect(arrow?.bearingDeg).toBe(steep.bearingDeg);
    expect(arrow?.secondsPerKm).toBe(steep.secondsPerKm);
    expect(arrow?.approxKmToBest).toBe(steep.approxKmToBest);
  });
});

describe('moveArrowLengthKm', () => {
  it('és la distància fins al millor punt, amb topalls', () => {
    expect(moveArrowLengthKm(8)).toBe(8);
    expect(moveArrowLengthKm(0.5)).toBe(MIN_ARROW_KM);
    expect(moveArrowLengthKm(250)).toBe(MAX_ARROW_KM);
  });

  it('sense extrapolació es dibuixa la de cortesia', () => {
    // El rumb i el ritme els sabem igualment; el que no sabem és fins on.
    const courtesy = moveArrowLengthKm(null);
    expect(courtesy).toBeGreaterThanOrEqual(MIN_ARROW_KM);
    expect(courtesy).toBeLessThanOrEqual(MAX_ARROW_KM);
    expect(moveArrowLengthKm(Number.NaN)).toBe(courtesy);
    expect(moveArrowLengthKm(-4)).toBe(courtesy);
  });
});

const arrow: MoveArrowData = {
  lat: BILBAO.lat,
  lon: BILBAO.lon,
  bearingDeg: 215.4,
  secondsPerKm: 2.99,
  approxKmToBest: 7.5,
  label: '+3,0 s/km',
};

describe('applyMoveArrow', () => {
  it('es pot cridar a cada render sense duplicar res', () => {
    const map = new FakeMap();
    applyMoveArrow(map.asMap(), palette, arrow);
    applyMoveArrow(map.asMap(), palette, arrow);
    applyMoveArrow(map.asMap(), palette, arrow);

    expect(map.sources.size).toBe(1);
    expect(map.layers.size).toBe(2);
    expect(map.layers.has(MOVE_ARROW_SHAFT_LAYER)).toBe(true);
    expect(map.layers.has(MOVE_ARROW_HEAD_LAYER)).toBe(true);
  });

  it('el pal surt del punt i acaba al rumb i a la distància que toca', () => {
    const map = new FakeMap();
    applyMoveArrow(map.asMap(), palette, arrow);

    const shaft = (map.part('shaft')?.geometry as LineString).coordinates;
    expect(shaft[0]).toEqual([arrow.lon, arrow.lat]);

    const [tipLon, tipLat] = shaft[1];
    expect(approxDistanceKm(arrow.lat, arrow.lon, tipLat, tipLon)).toBeCloseTo(7.5, 1);
    expect(bearingDeg(arrow.lat, arrow.lon, tipLat, tipLon)).toBeCloseTo(215.4, 0);
  });

  it('la punta és un sector tancat i estret, clavat a l’extrem del pal', () => {
    const map = new FakeMap();
    applyMoveArrow(map.asMap(), palette, arrow);

    const shaft = (map.part('shaft')?.geometry as LineString).coordinates;
    const ring = (map.part('head')?.geometry as Polygon).coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    // El vèrtex del sector és la punta del pal.
    expect(ring[0][0]).toBeCloseTo(shaft[1][0], 9);
    expect(ring[0][1]).toBeCloseTo(shaft[1][1], 9);

    // I tot el sector queda ENRERE: cap vèrtex més lluny del punt de partida
    // que la punta mateixa. Una punta que sobresortís allargaria la fletxa i
    // n'estiraria la promesa de quilòmetres.
    const tipKm = approxDistanceKm(arrow.lat, arrow.lon, shaft[1][1], shaft[1][0]);
    for (const [lon, lat] of ring) {
      expect(approxDistanceKm(arrow.lat, arrow.lon, lat, lon)).toBeLessThanOrEqual(tipKm + 1e-6);
    }
  });

  it('el rètol va just passada la punta, en el mateix rumb', () => {
    const at = moveArrowLabelPoint(arrow);
    const km = approxDistanceKm(arrow.lat, arrow.lon, at.lat, at.lon);
    expect(km).toBeGreaterThan(7.5);
    expect(bearingDeg(arrow.lat, arrow.lon, at.lat, at.lon)).toBeCloseTo(215.4, 0);
  });

  it('amb la fletxa nul·la es buida, però les capes es queden', () => {
    const map = new FakeMap();
    applyMoveArrow(map.asMap(), palette, arrow);
    applyMoveArrow(map.asMap(), palette, null);

    expect(map.collection().features).toEqual([]);
    expect(map.layers.size).toBe(2);
  });

  it('els colors surten de la paleta i cap no és l’ambre de la franja', () => {
    const map = new FakeMap();
    applyMoveArrow(map.asMap(), palette, arrow);

    const shaft = map.layers.get(MOVE_ARROW_SHAFT_LAYER)?.paint as Record<string, unknown>;
    const head = map.layers.get(MOVE_ARROW_HEAD_LAYER)?.paint as Record<string, unknown>;
    expect(shaft['line-color']).toBe(palette.corona100);
    expect(head['fill-color']).toBe(palette.corona100);
    for (const color of [shaft['line-color'], head['fill-color']]) {
      expect([palette.accent, palette.accentHover, palette.sun200, palette.sun400]).not.toContain(
        color,
      );
    }
  });
});

describe('removeMoveArrow', () => {
  it('treu les dues capes i la font, i es pot tornar a posar', () => {
    const map = new FakeMap();
    applyMoveArrow(map.asMap(), palette, arrow);
    removeMoveArrow(map.asMap());
    expect(map.layers.size).toBe(0);
    expect(map.sources.size).toBe(0);

    applyMoveArrow(map.asMap(), palette, arrow);
    expect(map.layers.size).toBe(2);
  });

  it('no es queixa si no hi havia res', () => {
    const map = new FakeMap();
    expect(() => removeMoveArrow(map.asMap())).not.toThrow();
  });
});
