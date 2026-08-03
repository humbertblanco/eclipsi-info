/**
 * Proves de l'amplada de la vora d'incertesa.
 *
 * La part aritmètica és curta i el que de veritat s'ha de vigilar és que el
 * número segueixi lligat al motor: la banda que es pinta ha de sortir de
 * `computeUncertainty` i ha de cobrir, per força, la discrepància mesurada
 * entre els nostres dos motors d'ombra (ESTAT §5). Si algun dia algú toca σ o
 * el gradient del marge i la banda es queda més estreta que aquells 2,9 km, el
 * mapa estaria pintant una certesa que el projecte té documentat que no té.
 */

import { describe, expect, it } from 'vitest';
import {
  EDGE_BAND_STEPS,
  ENGINE_PATH_DISCREPANCY_KM,
  MAX_EDGE_BAND_HALF_WIDTH_KM,
  edgeBandHalfWidthKm,
  edgeBandProfile,
  edgeBandSteps,
} from './edgeBand';
import { computeLocalCircumstances } from './contacts';
import { computeUncertainty } from './uncertainty';

describe('edgeBandHalfWidthKm', () => {
  it('respecta la semiamplada que dona el motor', () => {
    expect(edgeBandHalfWidthKm(9.38)).toBeCloseTo(9.38, 6);
    expect(edgeBandHalfWidthKm(12)).toBeCloseTo(12, 6);
  });

  it('mai per sota de la discrepància dels dos motors', () => {
    // Un gradient molt fort donaria una banda estretíssima, i seria mentida:
    // la franja dibuixada i el motor de punts ja discrepen 2,9 km entre ells.
    expect(edgeBandHalfWidthKm(0.4)).toBe(ENGINE_PATH_DISCREPANCY_KM);
    expect(edgeBandHalfWidthKm(0)).toBe(ENGINE_PATH_DISCREPANCY_KM);
  });

  it('mai per sobre del sostre, i sense punt es respon el sostre', () => {
    // Gradient nul: σ/gradient és infinit. Allà on no sabem quant no sabem, el
    // dubte és tot el que en podem dir — però dibuixable.
    expect(edgeBandHalfWidthKm(Number.POSITIVE_INFINITY)).toBe(MAX_EDGE_BAND_HALF_WIDTH_KM);
    expect(edgeBandHalfWidthKm(Number.NaN)).toBe(MAX_EDGE_BAND_HALF_WIDTH_KM);
    expect(edgeBandHalfWidthKm(null)).toBe(MAX_EDGE_BAND_HALF_WIDTH_KM);
    expect(edgeBandHalfWidthKm(undefined)).toBe(MAX_EDGE_BAND_HALF_WIDTH_KM);
    expect(edgeBandHalfWidthKm(3_000)).toBe(MAX_EDGE_BAND_HALF_WIDTH_KM);
  });

  it('el signe no hi pinta res', () => {
    expect(edgeBandHalfWidthKm(-9.4)).toBeCloseTo(9.4, 6);
  });
});

describe('la banda i el motor', () => {
  it('cobreix la discrepància dels 2,9 km documentada a l’ESTAT §5', () => {
    /*
     * Bilbao, a menys de quatre quilòmetres del límit nord del 12 d'agost del
     * 2026: el cas exacte per al qual existeix aquesta capa. La semiamplada que
     * en surt ha de ser una xifra d'ordre deu quilòmetres —σ = 2″ sobre un
     * gradient de ~0,20″/km— i, sobretot, ha de contenir de sobres els 2,9 km
     * que separen els nostres dos motors.
     */
    const location = { lat: 43.26, lon: -2.93, elevation: 0 };
    const circumstances = computeLocalCircumstances('2026-08-12', location);
    const uncertainty = computeUncertainty('2026-08-12', circumstances, {
      locateSeaLevelLimit: false,
    });

    const half = edgeBandHalfWidthKm(uncertainty.limitUncertaintyKm);
    expect(half).toBeGreaterThan(ENGINE_PATH_DISCREPANCY_KM);
    expect(half).toBeGreaterThan(5);
    expect(half).toBeLessThan(MAX_EDGE_BAND_HALF_WIDTH_KM);
    // I la banda sencera ha de ser més ampla que la distància al límit d'un
    // punt que el motor ja qualifica de dubtós: si no, el dibuix contradiria
    // el text.
    expect(uncertainty.centralPhaseUncertain).toBe(true);
    expect(half).toBeGreaterThan(uncertainty.limit?.km ?? 0);
  });
});

describe('edgeBandProfile', () => {
  it('val 1 damunt del límit i 0 a la vora de la banda', () => {
    expect(edgeBandProfile(0)).toBeCloseTo(1, 12);
    expect(edgeBandProfile(1)).toBeCloseTo(0, 12);
    expect(edgeBandProfile(-1)).toBeCloseTo(0, 12);
  });

  it('és simètric i decreixent cap enfora', () => {
    expect(edgeBandProfile(0.3)).toBeCloseTo(edgeBandProfile(-0.3), 12);
    expect(edgeBandProfile(0.2)).toBeGreaterThan(edgeBandProfile(0.6));
  });

  it('fora de la banda no es dispara: es queda a zero', () => {
    expect(edgeBandProfile(4)).toBe(0);
    expect(edgeBandProfile(-4)).toBe(0);
  });
});

describe('edgeBandSteps', () => {
  const PEAK = 0.26;
  const steps = edgeBandSteps(10, PEAK);

  it('cobreix de −semiamplada a +semiamplada sense forats ni encavalcaments', () => {
    expect(steps.length).toBe(EDGE_BAND_STEPS * 2);
    expect(steps[0].fromKm).toBeCloseTo(-10, 9);
    expect(steps[steps.length - 1].toKm).toBeCloseTo(10, 9);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].fromKm).toBeCloseTo(steps[i - 1].toKm, 9);
    }
  });

  it('el degradat és simètric i s’esvaeix cap enfora', () => {
    for (let i = 0; i < steps.length / 2; i++) {
      const mirror = steps[steps.length - 1 - i];
      expect(steps[i].opacity).toBeCloseTo(mirror.opacity, 9);
    }
    // De la vora cap al centre, sempre amunt.
    for (let i = 1; i < steps.length / 2; i++) {
      expect(steps[i].opacity).toBeGreaterThan(steps[i - 1].opacity);
    }
  });

  it('cap tram no passa de l’opacitat de cresta ni baixa a zero', () => {
    for (const step of steps) {
      expect(step.opacity).toBeGreaterThan(0);
      expect(step.opacity).toBeLessThanOrEqual(PEAK);
    }
  });

  it('sense amplada no hi ha trams', () => {
    expect(edgeBandSteps(0, PEAK)).toEqual([]);
    expect(edgeBandSteps(Number.NaN, PEAK)).toEqual([]);
    expect(edgeBandSteps(Number.POSITIVE_INFINITY, PEAK)).toEqual([]);
  });
});
