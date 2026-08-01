/**
 * Proves de la graella de candidats.
 *
 * Les tres promeses de `grid.ts` són comprovables i totes tres tenen
 * conseqüències visibles: que la graella sigui hexagonal (cap direcció
 * privilegiada), que estigui ancorada a una retícula global (el degoteig del
 * GPS no ha de moure els resultats) i que el lloc on ja ets hi surti sempre.
 */

import { describe, expect, it } from 'vitest';
import type { GeoLocation } from '../astro/types';
import {
  approxDistanceKm,
  bearingDeg,
  buildCandidateGrid,
  candidateId,
  compassName,
  kmPerDegLon,
} from './grid';

const ORIGIN: GeoLocation = { lat: 41.7665, lon: -2.479, elevation: 1065 };

describe('geometria bàsica', () => {
  it('un grau de longitud a 42° són uns 82,7 km', () => {
    // A l'equador, 111,32 km. A 42°, el cosinus se n'emporta una quarta part
    // llarga: ignorar-ho estiraria la graella un 34 % en direcció est-oest.
    expect(kmPerDegLon(0)).toBeCloseTo(111.32, 1);
    expect(kmPerDegLon(42)).toBeCloseTo(82.7, 1);
  });

  it('la distància equirectangular s’assembla a la real a escala de la cerca', () => {
    // Sòria a Burgos són 119,30 km per la fórmula d'haversine amb el radi
    // mitjà. Aquí surten uns 140 m més perquè el mòdul fa servir el radi
    // EQUATORIAL: un biaix constant del 0,12 %, que a 25 km de radi de cerca
    // són 30 m. És el que promet la capçalera de `grid.ts` — "l'error és de
    // metres" — i no afecta cap classificació.
    const soriaBurgos = approxDistanceKm(41.7665, -2.479, 42.3439, -3.6969);
    expect(soriaBurgos).toBeCloseTo(119.3, 0);

    // A l'escala on es fa servir de debò, la diferència és de desenes de metres.
    const vintKm = approxDistanceKm(41.7665, -2.479, 41.9465, -2.479);
    expect(vintKm).toBeCloseTo(20.015, 1);
  });

  it('els rumbs cardinals surten on toca', () => {
    expect(bearingDeg(41, -2, 42, -2)).toBeCloseTo(0, 6);
    expect(bearingDeg(41, -2, 41, -1)).toBeCloseTo(90, 6);
    expect(bearingDeg(41, -2, 40, -2)).toBeCloseTo(180, 6);
    expect(bearingDeg(41, -2, 41, -3)).toBeCloseTo(270, 6);
  });

  it('el nom del rumb és en català i mai queda fora de la rosa', () => {
    expect(compassName(0)).toBe('nord');
    expect(compassName(360)).toBe('nord');
    expect(compassName(-90)).toBe('oest');
    expect(compassName(283.5)).toBe('oest-nord-oest');
  });

  it('la clau d’un candidat té cinc decimals i no depèn de l’últim bit', () => {
    expect(candidateId(41.766512345, -2.4790054)).toBe('41.76651,-2.47901');
  });
});

describe('la graella', () => {
  it('el lloc on ja ets hi surt sempre i és el primer', () => {
    const grid = buildCandidateGrid(ORIGIN, { radiusKm: 10, spacingKm: 3 });
    expect(grid[0].lat).toBe(ORIGIN.lat);
    expect(grid[0].lon).toBe(ORIGIN.lon);
    expect(grid[0].distanceKm).toBeCloseTo(0, 9);
  });

  it('cap candidat surt del radi i no n’hi ha cap de repetit', () => {
    const grid = buildCandidateGrid(ORIGIN, { radiusKm: 12, spacingKm: 2 });
    const ids = new Set<string>();
    for (const c of grid) {
      expect(c.distanceKm).toBeLessThanOrEqual(12 + 1e-9);
      ids.add(candidateId(c.lat, c.lon));
    }
    expect(ids.size).toBe(grid.length);
  });

  it('25 km amb pas de 2 km són els 567 candidats de la capçalera de search.ts', () => {
    // Aquest número és el que justifica tot l'embut. Si canvia, el raonament
    // del cost de la capçalera deixa de valer i s'ha de tornar a escriure.
    const grid = buildCandidateGrid(ORIGIN, { radiusKm: 25, spacingKm: 2 });
    expect(grid.length).toBe(567);
  });

  it('és hexagonal: les files senars van desplaçades mitja cel·la', () => {
    const grid = buildCandidateGrid(ORIGIN, { radiusKm: 8, spacingKm: 2 });
    const latituds = [...new Set(grid.map((c) => c.lat))].sort((a, b) => a - b);
    // Dues files consecutives (deixant fora la de l'origen, que no cau a la
    // retícula) han de tenir les columnes desplaçades: cap longitud repetida.
    const fila = (lat: number) => grid.filter((c) => c.lat === lat).map((c) => c.lon);
    let trobat = false;
    for (let i = 1; i < latituds.length; i++) {
      const a = fila(latituds[i - 1]);
      const b = fila(latituds[i]);
      if (a.length < 3 || b.length < 3) continue;
      const compartides = a.filter((lon) => b.some((other) => Math.abs(other - lon) < 1e-9));
      expect(compartides.length).toBe(0);
      trobat = true;
    }
    expect(trobat).toBe(true);
  });

  it('cap punt del disc no queda a més d’un pas del candidat més proper', () => {
    // És la propietat que fa que la graella sigui una cobertura i no un mostreig
    // qualsevol: si hi hagués forats més grans que el pas, hi podria haver un
    // turó bo que el cercador no arribés a mirar mai.
    const spacingKm = 3;
    const radiusKm = 12;
    const grid = buildCandidateGrid(ORIGIN, { radiusKm, spacingKm });

    let pitjor = 0;
    for (let i = 0; i < 400; i++) {
      // Punts pseudoaleatoris deterministes dins del disc.
      const angle = (i * 137.508 * Math.PI) / 180;
      const r = radiusKm * 0.95 * Math.sqrt(((i * 61) % 400) / 400);
      const lat = ORIGIN.lat + (r * Math.cos(angle)) / 111.195;
      const lon = ORIGIN.lon + (r * Math.sin(angle)) / kmPerDegLon(ORIGIN.lat);
      let millor = Infinity;
      for (const c of grid) {
        const d = approxDistanceKm(lat, lon, c.lat, c.lon);
        if (d < millor) millor = d;
      }
      if (millor > pitjor) pitjor = millor;
    }
    expect(pitjor).toBeLessThan(spacingKm);
  });

  it('està ancorada a una retícula global: moure l’origen 30 m no mou els candidats', () => {
    // El degoteig d'un GPS és d'uns metres. Si la graella s'ancorés al punt de
    // l'usuari, cada lectura nova mouria els 567 candidats i cap resultat
    // calculat es podria reaprofitar.
    const a = buildCandidateGrid(ORIGIN, { radiusKm: 10, spacingKm: 2 });
    const mogut: GeoLocation = {
      lat: ORIGIN.lat + 0.0003,
      lon: ORIGIN.lon + 0.0003,
      elevation: ORIGIN.elevation,
    };
    const b = buildCandidateGrid(mogut, { radiusKm: 10, spacingKm: 2 });

    // Es comparen els candidats de retícula, no el primer de cada llista, que
    // és per definició el punt de l'usuari i sí que s'ha mogut.
    const clausA = new Set(a.slice(1).map((c) => candidateId(c.lat, c.lon)));
    const clausB = b.slice(1).map((c) => candidateId(c.lat, c.lon));
    const compartides = clausB.filter((id) => clausA.has(id));
    expect(compartides.length).toBeGreaterThan(clausB.length * 0.9);
  });

  it('sense lector de cotes, tothom hereta la d’on ets', () => {
    const grid = buildCandidateGrid(ORIGIN, { radiusKm: 6, spacingKm: 3 });
    for (const c of grid) expect(c.elevation).toBe(ORIGIN.elevation);
  });

  it('amb lector de cotes, cada candidat porta la seva', () => {
    const grid = buildCandidateGrid(ORIGIN, {
      radiusKm: 6,
      spacingKm: 3,
      elevation: (lon) => 500 + lon * 10,
    });
    for (const c of grid) expect(c.elevation).toBeCloseTo(500 + c.lon * 10, 9);
  });

  it('un pas o un radi no positius tornen una graella buida en comptes de penjar-se', () => {
    expect(buildCandidateGrid(ORIGIN, { radiusKm: 10, spacingKm: 0 })).toEqual([]);
    expect(buildCandidateGrid(ORIGIN, { radiusKm: 0, spacingKm: 2 })).toEqual([]);
  });

  it('cap camp d’un candidat no surt NaN', () => {
    const grid = buildCandidateGrid(ORIGIN, { radiusKm: 10, spacingKm: 2 });
    for (const c of grid) {
      expect(Number.isFinite(c.lat)).toBe(true);
      expect(Number.isFinite(c.lon)).toBe(true);
      expect(Number.isFinite(c.elevation)).toBe(true);
      expect(Number.isFinite(c.distanceKm)).toBe(true);
      expect(Number.isFinite(c.bearingDeg)).toBe(true);
      expect(c.bearingDeg).toBeGreaterThanOrEqual(0);
      expect(c.bearingDeg).toBeLessThan(360);
    }
  });
});
