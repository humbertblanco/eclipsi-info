/**
 * Proves de les decisions que els dibuixos no poden amagar.
 *
 * No s'asserteixen píxels ni classes: es comprova que un horitzó provisional
 * no es converteixi en una mesura, que la velocitat divergent perdi la xifra i
 * que un punt exterior no es faci passar per una posició proporcional dins de
 * la franja.
 */

import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { computeShadowMotion } from '../../core/astro/shadow';
import type { BandLimitDistance } from '../../core/astro/uncertainty';
import { flatHorizonProfile } from '../../core/horizon/profile';
import { computeVisibility } from '../../core/visibility/verdict';
import { trajectorySamples } from '../sim/samples';
import {
  buildBandPositionModel,
  buildFingerprintModel,
  buildShadowApproachModel,
} from './model';

const TAFALLA = { lat: 42.531, lon: -1.675, elevation: 426 };

describe('empremta del punt', () => {
  const circumstances = computeLocalCircumstances('2026-08-12', TAFALLA);

  it('un relleu pendent no es publica com un zero visible', () => {
    const model = buildFingerprintModel(circumstances, null, null);
    expect(model.terrain).toBe('assumed');
    expect(model.metric).toBeNull();
  });

  it('amb perfil mesurat, l’arc és la fracció que dona el veredicte', () => {
    const profile = flatHorizonProfile(TAFALLA.lat, TAFALLA.lon, TAFALLA.elevation);
    const samples = trajectorySamples(circumstances, TAFALLA);
    const verdict = computeVisibility(circumstances, profile, samples);
    const model = buildFingerprintModel(circumstances, profile, verdict);
    expect(model.terrain).toBe('measured');
    expect(model.metric).toBeCloseTo(verdict.centralVisibleFraction, 8);
    expect(model.horizon.length).toBeGreaterThan(60);
  });
});

describe('ombra que s’acosta', () => {
  const circumstances = computeLocalCircumstances('2026-08-12', TAFALLA);
  const motion = computeShadowMotion('2026-08-12', circumstances);

  it('avança de zero a u entre l’avís i C2', () => {
    expect(motion).not.toBeNull();
    const start = buildShadowApproachModel(motion!, circumstances, motion!.watchFromUtc.getTime());
    const end = buildShadowApproachModel(
      motion!,
      circumstances,
      circumstances.contacts.c2!.time.getTime(),
    );
    expect(start?.progress).toBe(0);
    expect(end?.progress).toBe(1);
  });

  it('una velocitat divergent deixa de ser una xifra', () => {
    expect(motion).not.toBeNull();
    const model = buildShadowApproachModel(
      { ...motion!, speedDiverging: true },
      circumstances,
      motion!.watchFromUtc.getTime(),
    );
    expect(model?.speedKmh).toBeNull();
  });

  it('distingeix l’anularitat i no fabrica una ombra central en un parcial', () => {
    const valencia = { lat: 39.4699, lon: -0.3763, elevation: 15 };
    const annular = computeLocalCircumstances('2028-01-26', valencia);
    const annularMotion = computeShadowMotion('2028-01-26', annular);
    expect(annular.kind).toBe('annular');
    expect(annularMotion).not.toBeNull();
    expect(buildShadowApproachModel(annularMotion!, annular, annularMotion!.watchFromUtc.getTime())?.kind)
      .toBe('annular');

    const partial = computeLocalCircumstances('2027-08-02', { lat: 41.3874, lon: 2.1686, elevation: 12 });
    expect(partial.kind).toBe('partial');
    expect(computeShadowMotion('2027-08-02', partial)).toBeNull();
  });
});

describe('posició dins la franja', () => {
  const base: BandLimitDistance = {
    side: 'north',
    inside: true,
    km: 30,
    bearingDeg: 0,
    inwardBearingDeg: 180,
    bandWidthKm: 300,
    seaLevelPoint: null,
    seaLevelKm: null,
    elevationShiftKm: 0,
  };

  it('mesura la posició interior des del límit del mateix motor', () => {
    const model = buildBandPositionModel(base, 120, 6);
    expect(model.point).toBeCloseTo(0.1, 8);
    expect(model.center).toBeCloseTo(0.5, 8);
    expect(model.uncertaintyFraction).toBeCloseTo(0.02, 8);
  });

  it('un punt exterior ocupa la ranura exterior, no una falsa escala', () => {
    const model = buildBandPositionModel({ ...base, inside: false, km: 900 }, 930, 6);
    expect(model.point).toBe(-0.08);
    expect(model.distanceToLimitKm).toBe(900);
  });
});
