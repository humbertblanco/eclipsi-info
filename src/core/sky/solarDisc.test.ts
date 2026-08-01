/**
 * Tests de `solarDisc.ts`.
 *
 * El que es prova aquí és l'afirmació que justifica tot el mòdul: la Lluna no
 * es menja la llum al mateix ritme que es menja l'àrea, perquè el limbe del Sol
 * és més fosc que el centre.
 */

import { describe, it, expect } from 'vitest';
import {
  coveredAreaFraction,
  intensityAtRadiusFraction,
  limbDarkenedIntensity,
  luminousFractionFromObscuration,
  MEAN_DISC_INTENSITY,
  uncoveredLuminousFraction,
} from './solarDisc';
import { eclipseObscuration } from '../astro/geometry';

/** Radis angulars típics de l'eclipsi total del 12 d'agost de 2026. */
const SUN_R = 0.2634;
const MOON_R = 0.2735;

describe('limbDarkenedIntensity', () => {
  it('val 1 al centre i 0,4 al limbe', () => {
    expect(limbDarkenedIntensity(1)).toBeCloseTo(1, 12);
    expect(limbDarkenedIntensity(0)).toBeCloseTo(0.4, 12);
  });

  it('el limbe brilla menys de la meitat que el centre', () => {
    // És el número que la gent no s'espera i el que fa que la corba de llum
    // no sigui la corba d'àrea.
    expect(limbDarkenedIntensity(0)).toBeLessThan(0.5);
  });

  it('intensitat i radi: monòtona decreixent del centre cap a la vora', () => {
    let previous = Infinity;
    for (let x = 0; x <= 1; x += 0.02) {
      const i = intensityAtRadiusFraction(x);
      expect(i).toBeLessThanOrEqual(previous);
      previous = i;
    }
    expect(intensityAtRadiusFraction(0)).toBeCloseTo(1, 12);
    expect(intensityAtRadiusFraction(1)).toBeCloseTo(0.4, 12);
  });

  it('el disc sencer brilla el 80% del que brillaria si fos tot com el centre', () => {
    // Per a la llei lineal, el flux integrat val 1 − u/3.
    let weighted = 0;
    let area = 0;
    const steps = 20000;
    for (let i = 0; i < steps; i++) {
      const x = (i + 0.5) / steps;
      weighted += intensityAtRadiusFraction(x) * x;
      area += x;
    }
    expect(weighted / area).toBeCloseTo(MEAN_DISC_INTENSITY, 5);
    expect(MEAN_DISC_INTENSITY).toBeCloseTo(0.8, 12);
  });
});

describe('coveredAreaFraction', () => {
  it('dona exactament el mateix que `core/astro/geometry.ts`', () => {
    // Els dos mòduls calculen la mateixa cosa i han de coincidir bit a bit,
    // perquè si divergeixen la simulació dibuixaria una obscuració i en
    // calcularia una altra.
    for (let d = 0; d <= 0.6; d += 0.001) {
      expect(coveredAreaFraction(d, SUN_R, MOON_R)).toBe(
        eclipseObscuration(d, SUN_R, MOON_R),
      );
    }
  });
});

describe('uncoveredLuminousFraction', () => {
  it('sense Lluna a sobre queda tota la llum', () => {
    expect(uncoveredLuminousFraction(1, SUN_R, MOON_R)).toBe(1);
    expect(uncoveredLuminousFraction(SUN_R + MOON_R, SUN_R, MOON_R)).toBe(1);
  });

  it('durant la totalitat no en queda gens', () => {
    expect(uncoveredLuminousFraction(0, SUN_R, MOON_R)).toBe(0);
    // El límit umbral és la diferència de radis.
    expect(uncoveredLuminousFraction(MOON_R - SUN_R, SUN_R, MOON_R)).toBe(0);
  });

  it('a l’inici de l’eclipsi la Lluna es menja MENYS llum que àrea', () => {
    // Entra pel limbe, que és la part fosca del disc.
    const d = 0.4;
    const area = coveredAreaFraction(d, SUN_R, MOON_R);
    const flux = uncoveredLuminousFraction(d, SUN_R, MOON_R);
    expect(area).toBeGreaterThan(0.1);
    expect(flux).toBeGreaterThan(1 - area);
  });

  it('a prop del màxim se’n menja MÉS que àrea', () => {
    // Ja ha tapat el centre brillant i el que queda és vora.
    const d = 0.05;
    const area = coveredAreaFraction(d, SUN_R, MOON_R);
    const flux = uncoveredLuminousFraction(d, SUN_R, MOON_R);
    expect(area).toBeGreaterThan(0.9);
    expect(flux).toBeLessThan(1 - area);
  });

  it('amb el 95% de l’àrea tapada queda un ~3% de la llum, no un 5%', () => {
    // El fet central del mòdul, amb la geometria real del 2026.
    let target = 0;
    for (let d = 0.5; d >= 0; d -= 0.0001) {
      if (coveredAreaFraction(d, SUN_R, MOON_R) >= 0.95) {
        target = d;
        break;
      }
    }
    const flux = uncoveredLuminousFraction(target, SUN_R, MOON_R);
    expect(flux).toBeGreaterThan(0.025);
    expect(flux).toBeLessThan(0.04);
    expect(flux).toBeLessThan(0.05);
  });

  it('és monòtona: com més a prop la Lluna, menys llum', () => {
    let previous = -Infinity;
    for (let d = 0; d <= SUN_R + MOON_R; d += 0.002) {
      const f = uncoveredLuminousFraction(d, SUN_R, MOON_R);
      expect(f).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = f;
    }
  });

  it('un eclipsi anular deixa molta menys llum del que sembla per l’àrea', () => {
    // 26 de gener de 2028: el disc lunar és més petit i queda un anell PRIM
    // enganxat al limbe, que és el tros fosc. L'àrea diu 92% tapat i la llum
    // diu 95%.
    const annularSun = 0.2725;
    const annularMoon = 0.261;
    const area = coveredAreaFraction(0, annularSun, annularMoon);
    const flux = uncoveredLuminousFraction(0, annularSun, annularMoon);
    expect(area).toBeGreaterThan(0.91);
    expect(flux).toBeLessThan(1 - area);
    // Però no s'anul·la mai: per això una anularitat no es fa fosca.
    expect(flux).toBeGreaterThan(0.04);
  });
});

describe('luminousFractionFromObscuration', () => {
  it('els extrems són exactes', () => {
    expect(luminousFractionFromObscuration(0)).toBeCloseTo(1, 6);
    expect(luminousFractionFromObscuration(1)).toBeCloseTo(0, 6);
  });

  it('creua la diagonal cap a un terç d’obscuració', () => {
    // Per sota d'aquest punt sobra llum respecte de l'àrea; per sobre, en falta.
    expect(luminousFractionFromObscuration(0.2)).toBeGreaterThan(0.8);
    expect(luminousFractionFromObscuration(0.5)).toBeLessThan(0.5);
  });

  it('reprodueix els valors de la corba d’enfosquiment del limbe', () => {
    const expected: Array<[number, number]> = [
      [0.5, 0.481],
      [0.75, 0.214],
      [0.9, 0.0737],
      [0.95, 0.0335],
      [0.99, 0.00579],
    ];
    for (const [obscuration, flux] of expected) {
      expect(luminousFractionFromObscuration(obscuration)).toBeCloseTo(flux, 3);
    }
  });

  it('és monòtona decreixent', () => {
    let previous = Infinity;
    for (let o = 0; o <= 1; o += 0.001) {
      const f = luminousFractionFromObscuration(o);
      expect(f).toBeLessThanOrEqual(previous + 1e-12);
      previous = f;
    }
  });

  it('s’acosta a la geometria exacta quan els discos són semblants', () => {
    // La taula està feta amb discos iguals. Amb els radis reals del 2026
    // l'error ha de ser petit fins ben amunt.
    for (let d = 0.5; d > 0.05; d -= 0.01) {
      const area = coveredAreaFraction(d, SUN_R, MOON_R);
      const exact = uncoveredLuminousFraction(d, SUN_R, MOON_R);
      const table = luminousFractionFromObscuration(area);
      expect(Math.abs(table - exact)).toBeLessThan(0.02);
    }
  });
});
