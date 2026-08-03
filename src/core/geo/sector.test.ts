import { describe, expect, it } from 'vitest';
import { bearingDelta, destinationPoint, sectorRing } from './sector';

describe('destinationPoint', () => {
  it('cap al nord puja latitud i no toca la longitud', () => {
    const p = destinationPoint(42, -1.5, 0, 111.32);
    expect(p.lat).toBeCloseTo(43, 1);
    expect(p.lon).toBeCloseTo(-1.5, 3);
  });

  it('cap a l’est a l’equador avança un grau per 111 km', () => {
    const p = destinationPoint(0, 0, 90, 111.19);
    expect(p.lat).toBeCloseTo(0, 3);
    expect(p.lon).toBeCloseTo(1, 1);
  });

  it('la longitud surt normalitzada a ±180°', () => {
    const p = destinationPoint(0, 179.9, 90, 50);
    expect(p.lon).toBeLessThanOrEqual(180);
    expect(p.lon).toBeGreaterThanOrEqual(-180);
  });

  it('a distància zero torna el mateix punt', () => {
    const p = destinationPoint(41.4, 2.2, 123, 0);
    expect(p.lat).toBeCloseTo(41.4, 6);
    expect(p.lon).toBeCloseTo(2.2, 6);
  });
});

describe('bearingDelta', () => {
  it('gir simple en sentit horari', () => {
    expect(bearingDelta(250, 300)).toBe(50);
  });

  it('gir simple en sentit antihorari', () => {
    expect(bearingDelta(300, 250)).toBe(-50);
  });

  it('creuar el nord va pel camí curt', () => {
    expect(bearingDelta(350, 10)).toBe(20);
    expect(bearingDelta(10, 350)).toBe(-20);
  });

  it('mig món exacte és 180 en un sol sentit, mai −180', () => {
    expect(Math.abs(bearingDelta(0, 180))).toBe(180);
  });
});

describe('sectorRing', () => {
  it('és un anell tancat que comença i acaba a l’origen', () => {
    const ring = sectorRing(42.8, -1.6, 260, 300, 30);
    expect(ring[0]).toEqual([-1.6, 42.8]);
    expect(ring[ring.length - 1]).toEqual([-1.6, 42.8]);
    // Origen + (steps+1) punts d'arc + tancament.
    expect(ring.length).toBe(24 + 3);
  });

  it('l’arc queda a la distància demanada', () => {
    const ring = sectorRing(42.8, -1.6, 260, 300, 30, 8);
    // Un punt del mig de l'arc: comprovem la distància pel mètode invers
    // (una projecció local n'hi ha prou per a 30 km).
    const [lonMid, latMid] = ring[5];
    const dLat = (latMid - 42.8) * 111.32;
    const dLon = (lonMid - -1.6) * 111.32 * Math.cos((42.8 * Math.PI) / 180);
    expect(Math.hypot(dLat, dLon)).toBeCloseTo(30, 0);
  });

  it('un sector que creua el nord no dona la volta al revés', () => {
    const ring = sectorRing(42.8, -1.6, 350, 10, 20, 4);
    // Tots els punts de l'arc han de quedar al nord del punt: si l'arc hagués
    // anat pel camí llarg (350° → 10° per l'oest i el sud), n'hi hauria al sud.
    for (const [, lat] of ring.slice(1, -1)) {
      expect(lat).toBeGreaterThan(42.8);
    }
  });

  it('un sector degenerat (mateix rumb) segueix sent un anell vàlid', () => {
    const ring = sectorRing(42.8, -1.6, 284, 284, 25, 12);
    expect(ring.length).toBeGreaterThanOrEqual(4);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});
