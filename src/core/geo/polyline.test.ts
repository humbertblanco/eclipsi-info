/**
 * Proves del desplaçament lateral de polilínies.
 *
 * Es prova el que la banda d'incertesa hi confia: que els quilòmetres siguin
 * quilòmetres de terreny (i no graus disfressats), que el costat sigui el que
 * es promet, i —la que costaria cara— que la longitud DESENROTLLADA hi passi
 * intacta. La franja del 2026 passa pel pol i els seus punts arriben amb
 * longituds de més de 180°: normalitzar-les pel camí dibuixa una banda que
 * travessa el mapa sencer, que és l'accident que `path.ts` ja documenta.
 */

import { describe, expect, it } from 'vitest';
import { offsetPolylineKm, polylineStripRing, type LonLat } from './polyline';
import { approxDistanceKm, bearingDeg } from '../spots/grid';

/** Una recta cap al nord per el meridià de Greenwich, de 40° a 41°. */
const NORTHBOUND: LonLat[] = [
  [0, 40],
  [0, 40.5],
  [0, 41],
];

describe('offsetPolylineKm', () => {
  it('desplaça la distància demanada, mesurada en km de terreny', () => {
    const left = offsetPolylineKm(NORTHBOUND, 10);
    for (let i = 0; i < NORTHBOUND.length; i++) {
      const km = approxDistanceKm(
        NORTHBOUND[i][1],
        NORTHBOUND[i][0],
        left[i][1],
        left[i][0],
      );
      // Mig per cent de marge: l'aproximació plana i la distància de referència
      // no fan servir exactament el mateix radi terrestre.
      expect(km).toBeCloseTo(10, 1);
    }
  });

  it('el positiu és a l’esquerra del traçat i el negatiu a la dreta', () => {
    // Anant cap al nord, l'esquerra és l'oest: la longitud ha de baixar.
    const left = offsetPolylineKm(NORTHBOUND, 10);
    const right = offsetPolylineKm(NORTHBOUND, -10);

    expect(left[1][0]).toBeLessThan(0);
    expect(right[1][0]).toBeGreaterThan(0);
    // I el rumb des del punt original ha de ser oest (270°) i est (90°).
    expect(bearingDeg(40.5, 0, left[1][1], left[1][0])).toBeCloseTo(270, 0);
    expect(bearingDeg(40.5, 0, right[1][1], right[1][0])).toBeCloseTo(90, 0);
  });

  it('manté la latitud quan el traçat és un meridià', () => {
    const left = offsetPolylineKm(NORTHBOUND, 12);
    for (let i = 0; i < NORTHBOUND.length; i++) {
      expect(left[i][1]).toBeCloseTo(NORTHBOUND[i][1], 6);
    }
  });

  it('NO normalitza la longitud desenrotllada', () => {
    /*
     * El límit de la franja del 2026 arriba amb longituds passades de 180°
     * perquè el traçat no es parteixi. Si aquest desplaçament les tornés a
     * ±180, la banda saltaria d'una punta del mapa a l'altra — i es veuria com
     * una ratlla travessant tot el món, que és el que `drawableRuns` evita per
     * l'altra banda.
     */
    const wrapped: LonLat[] = [
      [178, 60],
      [184, 61],
      [190, 62],
    ];
    const offset = offsetPolylineKm(wrapped, 15);
    expect(offset[1][0]).toBeGreaterThan(180);
    expect(offset[2][0]).toBeGreaterThan(180);
    // I el salt entre vèrtexs consecutius segueix sent petit: la polilínia no
    // s'ha partit enlloc.
    expect(Math.abs(offset[2][0] - offset[1][0])).toBeLessThan(15);
  });

  it('un desplaçament de zero no mou res', () => {
    const same = offsetPolylineKm(NORTHBOUND, 0);
    expect(same).toEqual(NORTHBOUND.map(([lon, lat]) => [lon, lat]));
  });

  it('no dona NaN amb dos vèrtexs idèntics', () => {
    // Els mostrejos de la franja poden repetir un punt quan l'ombra amb prou
    // feines es mou; una tangent indefinida no pot enverinar tota la banda.
    const repeated: LonLat[] = [
      [1, 42],
      [1, 42],
      [1.2, 42.1],
    ];
    for (const [lon, lat] of offsetPolylineKm(repeated, 8)) {
      expect(Number.isFinite(lon)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    }
  });

  it('a prop del pol no explota', () => {
    // El cosinus de la latitud tendeix a zero i la divisió se n'aniria a
    // l'infinit; hi ha un terra perquè no passi.
    const polar: LonLat[] = [
      [10, 89.5],
      [12, 89.7],
    ];
    for (const [lon, lat] of offsetPolylineKm(polar, 10)) {
      expect(Number.isFinite(lon)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    }
  });
});

describe('polylineStripRing', () => {
  it('torna un anell tancat amb les dues vores', () => {
    const ring = polylineStripRing(NORTHBOUND, -2, 5);
    // Una vora endavant, l'altra enrere i el primer vèrtex repetit al final.
    expect(ring.length).toBe(NORTHBOUND.length * 2 + 1);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('l’amplada de la tira és la diferència entre les dues distàncies', () => {
    const ring = polylineStripRing(NORTHBOUND, 4, 9);
    const near = ring[1];
    const far = ring[ring.length - 3];
    // Els vèrtexs del mig de cada vora (la tira és simètrica): 5 km de gruix.
    const km = approxDistanceKm(near[1], near[0], far[1], far[0]);
    expect(km).toBeCloseTo(5, 1);
  });

  it('sense dos punts no hi ha polígon', () => {
    expect(polylineStripRing([], -1, 1)).toEqual([]);
    expect(polylineStripRing([[0, 40]], -1, 1)).toEqual([]);
  });
});
