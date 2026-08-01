/**
 * Proves del garbell d'horitzó.
 *
 * Tot amb terreny sintètic: `sampleHorizonWindow` rep el lector d'elevació per
 * paràmetre justament perquè es pugui provar sense tocar cap tessel·la. Amb un
 * terreny inventat sabem la resposta exacta i podem comprovar que la fórmula
 * d'altura aparent, la curvatura i l'horitzó marí fan el que diuen.
 *
 * El biaix del garbell té direcció obligatòria i aquí es comprova: ha de ser
 * OPTIMISTA. Un garbell optimista deixa passar candidats dolents, que el càlcul
 * complet descarta després; un de pessimista es carrega candidats bons i
 * aquests ja no els recupera ningú.
 */

import { describe, expect, it } from 'vitest';
import type { GeoLocation } from '../astro/types';
import { horizonDipDeg } from '../horizon/raycast';
import {
  DEFAULT_SIEVE_RINGS,
  MAX_SIEVE_RANGE_KM,
  MIN_SIEVE_RANGE_KM,
  clipSieveRings,
  sampleHorizonWindow,
  sieveRangeKm,
  windowAltitudeAt,
  windowDistanceAt,
  type HorizonWindow,
} from './window';
import type { ElevationReader } from './types';

const ORIGIN: GeoLocation = { lat: 41.7665, lon: -2.479, elevation: 1000 };

/** Azimut del Sol al mig de la totalitat des de Sòria, el 12-08-2026. */
const SUN_AZ = 283.5;

const PLA: ElevationReader = () => 1000;

/**
 * Paret nord-sud a ponent, entre 6,6 i 8,3 km de l'origen, 1.700 m per damunt
 * de l'altiplà. A 6,8 km, 1.700 m es veuen a 13,9°: tapa qualsevol Sol baix.
 */
function paretAPonent(alturaM: number): ElevationReader {
  return (lon) => (lon < ORIGIN.lon - 0.08 && lon > ORIGIN.lon - 0.1 ? alturaM : 1000);
}

describe('abast del garbell', () => {
  it('resol la distància més enllà de la qual res no pot tapar el Sol', () => {
    // Els tres números de la capçalera de `window.ts`, amb 2.000 m de relleu.
    expect(sieveRangeKm(1.4)).toBeCloseTo(68.7, 0);
    expect(sieveRangeKm(3)).toBeCloseTo(36.4, 0);
    // A 12,5° l'equació dona 9 km, però el mínim mana: el camp proper sempre
    // s'ha de mirar, hi hagi el Sol on hi hagi.
    expect(sieveRangeKm(12.5)).toBe(MIN_SIEVE_RANGE_KM);
  });

  it('la curvatura hi és, i escurça l’abast', () => {
    // Sense el terme d²/2R, a 1,4° l'equació donaria 82 km en comptes de 69, i
    // baixaríem tessel·les que no poden canviar cap resposta.
    const senseCurvatura = 2000 / Math.tan(1.4 * (Math.PI / 180)) / 1000;
    expect(senseCurvatura).toBeGreaterThan(80);
    expect(sieveRangeKm(1.4)).toBeLessThan(senseCurvatura);
  });

  it('decreix amb l’altura del Sol i mai surt de la forquilla', () => {
    let anterior = Infinity;
    for (let alt = 0; alt <= 40; alt += 0.5) {
      const km = sieveRangeKm(alt);
      expect(km).toBeGreaterThanOrEqual(MIN_SIEVE_RANGE_KM);
      expect(km).toBeLessThanOrEqual(MAX_SIEVE_RANGE_KM);
      expect(km).toBeLessThanOrEqual(anterior + 1e-9);
      anterior = km;
    }
  });

  it('un Sol sota l’horitzó no allarga l’abast més enllà del sostre', () => {
    expect(sieveRangeKm(-5)).toBe(MAX_SIEVE_RANGE_KM);
  });
});

describe('retall dels anells', () => {
  it('amb el Sol alt només queda el camp proper', () => {
    const rings = clipSieveRings(15, DEFAULT_SIEVE_RINGS);
    expect(rings).toEqual([{ zoom: 11, maxDistanceKm: 15 }]);
  });

  it('amb el Sol baix s’obre el camp llunyà, retallat a l’abast', () => {
    const rings = clipSieveRings(68.7, DEFAULT_SIEVE_RINGS);
    expect(rings).toHaveLength(2);
    expect(rings[1].maxDistanceKm).toBeCloseTo(68.7, 6);
    expect(rings[1].zoom).toBe(10);
  });

  it('els anells surten sempre ordenats i sense buits', () => {
    const rings = clipSieveRings(40, [
      { maxDistanceKm: 90, zoom: 10 },
      { maxDistanceKm: 15, zoom: 11 },
    ]);
    expect(rings.map((r) => r.maxDistanceKm)).toEqual([15, 40]);
  });
});

describe('finestra d’horitzó', () => {
  it('sobre un altiplà pla, l’horitzó surt arran de zero', () => {
    const window = sampleHorizonWindow(ORIGIN, 1000, {
      centreAzimuthDeg: SUN_AZ,
      halfWidthDeg: 4,
      stepDeg: 0.25,
      rings: [{ maxDistanceKm: 15, zoom: 11 }],
      elevation: PLA,
    });
    // Qui mana és el terreny als teus peus, no la caiguda de l'horitzó marí:
    // l'altiplà és a la teva mateixa cota i la mostra més propera —a 114 m— es
    // veu a menys d'una mil·lèsima de grau per sota de l'horitzontal.
    for (const alt of window.altitudes) {
      expect(alt).toBeCloseTo(0, 3);
      expect(alt).toBeLessThan(0);
      expect(alt).toBeGreaterThan(horizonDipDeg(1000));
    }
    expect(window.coverage).toBe(1);
  });

  it('des d’un penya-segat sobre el mar, el que et tapa és la curvatura', () => {
    // Mil metres damunt del mar: cap terreny no arriba a l'horitzó i el terra
    // el posa la caiguda geomètrica, a 121 km. Sense aquest terra, un observador
    // alt tindria un horitzó a −3,9° (l'últim anell mostrejat) i el motor
    // creuria que veu un Sol que en realitat ja s'ha post.
    const window = sampleHorizonWindow(ORIGIN, 1000, {
      centreAzimuthDeg: SUN_AZ,
      halfWidthDeg: 4,
      stepDeg: 0.25,
      rings: [{ maxDistanceKm: 15, zoom: 11 }],
      elevation: () => 0,
    });
    const dip = horizonDipDeg(1000);
    expect(dip).toBeCloseTo(-0.946, 3);
    for (const alt of window.altitudes) expect(alt).toBeCloseTo(dip, 9);
    for (const km of window.distancesKm) expect(km).toBeCloseTo(121.1, 0);
  });

  it('mesura una paret coneguda amb l’error de la curvatura i prou', () => {
    const window = sampleHorizonWindow(ORIGIN, 1000, {
      centreAzimuthDeg: SUN_AZ,
      halfWidthDeg: 4,
      stepDeg: 0.25,
      rings: [{ maxDistanceKm: 15, zoom: 11 }],
      elevation: paretAPonent(2700),
    });
    const dist = windowDistanceAt(window, SUN_AZ);
    const alt = windowAltitudeAt(window, SUN_AZ);

    expect(dist).toBeGreaterThan(6.5);
    expect(dist).toBeLessThan(8.4);
    // atan(1.700 / distància), menys la caiguda per curvatura (uns 3 m a 6,8 km).
    const geometric = Math.atan(1700 / (dist * 1000)) * (180 / Math.PI);
    expect(alt).toBeLessThan(geometric);
    expect(alt).toBeGreaterThan(geometric - 0.1);
  });

  it('el biaix va cap a l’optimisme: el que se salta, se salta per sota', () => {
    // Una osca estreta —60 m de gruix, per sota de la cel·la de 57 m del
    // model— es pot perdre. El que MAI pot passar és inventar-se terreny que
    // no hi és: l'horitzó mesurat no pot superar el del mateix terreny
    // mostrejat amb un pas quatre vegades més fi.
    const fi = sampleHorizonWindow(ORIGIN, 1000, {
      centreAzimuthDeg: SUN_AZ,
      halfWidthDeg: 4,
      stepDeg: 0.25,
      rings: [{ maxDistanceKm: 15, zoom: 13 }],
      elevation: paretAPonent(2700),
    });
    const gruixut = sampleHorizonWindow(ORIGIN, 1000, {
      centreAzimuthDeg: SUN_AZ,
      halfWidthDeg: 4,
      stepDeg: 0.25,
      rings: [{ maxDistanceKm: 15, zoom: 10 }],
      elevation: paretAPonent(2700),
    });
    expect(windowAltitudeAt(gruixut, SUN_AZ)).toBeLessThanOrEqual(
      windowAltitudeAt(fi, SUN_AZ) + 1e-9,
    );
  });

  it('els forats de dades es diuen, no es compten com a zero metres', () => {
    // Un forat no pot passar per terreny a nivell del mar: seria un horitzó
    // inventat, i inventat cap avall, que és la direcció perillosa.
    const ambForat: ElevationReader = (lon) => (lon < ORIGIN.lon - 0.05 ? undefined : 1000);
    const window = sampleHorizonWindow(ORIGIN, 1000, {
      centreAzimuthDeg: SUN_AZ,
      halfWidthDeg: 4,
      stepDeg: 0.25,
      rings: [{ maxDistanceKm: 15, zoom: 11 }],
      elevation: ambForat,
    });
    expect(window.coverage).toBeGreaterThan(0);
    expect(window.coverage).toBeLessThan(1);
  });

  it('compta les mostres que ha llegit de veritat', () => {
    let llegides = 0;
    const comptador: ElevationReader = (...args) => {
      llegides++;
      return PLA(...args);
    };
    const window = sampleHorizonWindow(ORIGIN, 1000, {
      centreAzimuthDeg: SUN_AZ,
      halfWidthDeg: 4,
      stepDeg: 0.25,
      rings: [{ maxDistanceKm: 15, zoom: 11 }],
      elevation: comptador,
    });
    expect(window.samples).toBe(llegides);
    // 33 raigs, no 1.440: aquest és el guany del garbell.
    expect(window.altitudes).toHaveLength(33);
  });

  it('una finestra que creua el nord no es parteix per la meitat', () => {
    const window = sampleHorizonWindow(ORIGIN, 1000, {
      centreAzimuthDeg: 1,
      halfWidthDeg: 4,
      stepDeg: 0.5,
      rings: [{ maxDistanceKm: 15, zoom: 11 }],
      elevation: PLA,
    });
    expect(window.fromAzimuthDeg).toBe(-3);
    // 357° i 3° són veïns: tots dos han de caure dins de la finestra i tots dos
    // han de donar l'altiplà, no el valor retingut d'un extrem.
    expect(windowAltitudeAt(window, 357)).toBeCloseTo(windowAltitudeAt(window, -3), 9);
    expect(windowAltitudeAt(window, 3)).toBeCloseTo(windowAltitudeAt(window, 1), 6);
    expect(windowAltitudeAt(window, 3)).toBeCloseTo(0, 3);
  });
});

describe('lectura de la finestra', () => {
  /** Finestra a mà, per comprovar la interpolació sense soroll de terreny. */
  const mostra: HorizonWindow = {
    fromAzimuthDeg: 280,
    stepDeg: 1,
    altitudes: [1, 3, 2, 8],
    distancesKm: [2, 4, 60, 5],
    coverage: 1,
    samples: 0,
    rangeKm: 15,
  };

  it('l’altura s’interpola entre els dos raigs veïns', () => {
    expect(windowAltitudeAt(mostra, 280)).toBe(1);
    expect(windowAltitudeAt(mostra, 280.5)).toBeCloseTo(2, 9);
    expect(windowAltitudeAt(mostra, 281)).toBe(3);
  });

  it('fora de la finestra reté l’extrem i no extrapola', () => {
    expect(windowAltitudeAt(mostra, 200)).toBe(1);
    expect(windowAltitudeAt(mostra, 350)).toBe(8);
  });

  it('la distància NO s’interpola: la mitjana de 2 km i 60 km no existeix', () => {
    // Entre dos raigs veïns, l'obstacle culminant pot ser un turó a 2 km en un
    // i una serralada a 60 km en l'altre. La mitjana no descriu cap terreny.
    expect(windowDistanceAt(mostra, 281.4)).toBe(4);
    expect(windowDistanceAt(mostra, 281.6)).toBe(60);
  });

  it('una finestra buida no rebenta', () => {
    const buida: HorizonWindow = {
      fromAzimuthDeg: 0,
      stepDeg: 1,
      altitudes: [],
      distancesKm: [],
      coverage: 0,
      samples: 0,
      rangeKm: 0,
    };
    expect(windowAltitudeAt(buida, 123)).toBe(0);
    expect(windowDistanceAt(buida, 123)).toBe(0);
  });
});
