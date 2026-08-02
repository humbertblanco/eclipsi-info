/**
 * La predicció amb giroscopi, CLAVADA contra la integració d'Euler.
 *
 * El costat de la multiplicació del quaternió (dreta = intrínseca) no es
 * raona: es comprova que empènyer la postura amb una velocitat angular en
 * eixos de dispositiu dona EXACTAMENT el mateix que integrar els angles
 * d'Euler del sistema en els casos on l'Euler és net (un sol eix actiu).
 * Si algú canvia el costat, això es posa vermell abans que el mòbil llisqui.
 */

import { describe, expect, it } from 'vitest';
import { predictedPointingDelta } from './motionPredict';
import { quaternionFromEulerZXY } from './quaternion';
import { cameraPointingFromQuaternion } from './orientation';
import { normalizeDelta } from './poseFusion';

describe('la predicció amb giroscopi', () => {
  it('girant sobre Z en pla, la predicció iguala la integració d’Euler', () => {
    // Dispositiu pla (β=γ=0): alpha puja amb rotationRate.alpha.
    const q = quaternionFromEulerZXY(40, 0, 0);
    const dt = 0.5;
    const rateDps = 20;
    const got = predictedPointingDelta(q, 0, { alphaDps: rateDps, betaDps: 0, gammaDps: 0 }, dt);

    const before = cameraPointingFromQuaternion(q, 0);
    const after = cameraPointingFromQuaternion(
      quaternionFromEulerZXY(40 + rateDps * dt, 0, 0),
      0,
    );
    expect(got.dAzDeg).toBeCloseTo(normalizeDelta(after.azimuth - before.azimuth), 6);
    expect(Math.abs(got.dAltDeg)).toBeLessThan(1e-6);
  });

  it('amb el mòbil dret, el gir de beta és inclinació pura', () => {
    // β=90 és la postura de treball: càmera a l'horitzó. rotationRate.beta
    // continua girant sobre l'X del dispositiu.
    const q = quaternionFromEulerZXY(120, 80, 0);
    const dt = 0.04;
    const rateDps = 30;
    const got = predictedPointingDelta(q, 0, { alphaDps: 0, betaDps: rateDps, gammaDps: 0 }, dt);

    const before = cameraPointingFromQuaternion(q, 0);
    const after = cameraPointingFromQuaternion(
      quaternionFromEulerZXY(120, 80 + rateDps * dt, 0),
      0,
    );
    expect(got.dAltDeg).toBeCloseTo(after.altitude - before.altitude, 6);
    expect(got.dAzDeg).toBeCloseTo(normalizeDelta(after.azimuth - before.azimuth), 6);
  });

  it('el gir de gamma amb el mòbil dret es veu com el que és', () => {
    const q = quaternionFromEulerZXY(200, 85, 10);
    const dt = 0.033;
    const rateDps = 45;
    const got = predictedPointingDelta(q, 0, { alphaDps: 0, betaDps: 0, gammaDps: rateDps }, dt);

    const before = cameraPointingFromQuaternion(q, 0);
    const after = cameraPointingFromQuaternion(
      quaternionFromEulerZXY(200, 85, 10 + rateDps * dt),
      0,
    );
    expect(got.dAzDeg).toBeCloseTo(normalizeDelta(after.azimuth - before.azimuth), 5);
    expect(got.dAltDeg).toBeCloseTo(after.altitude - before.altitude, 5);
    expect(got.dRollDeg).toBeCloseTo(normalizeDelta(after.roll - before.roll), 5);
  });

  it('sense gir o sense temps, cap moviment', () => {
    const q = quaternionFromEulerZXY(40, 30, 5);
    expect(predictedPointingDelta(q, 0, { alphaDps: 0, betaDps: 0, gammaDps: 0 }, 0.05)).toEqual({
      dAzDeg: 0,
      dAltDeg: 0,
      dRollDeg: 0,
    });
    expect(
      predictedPointingDelta(q, 0, { alphaDps: 50, betaDps: 10, gammaDps: 5 }, 0),
    ).toEqual({ dAzDeg: 0, dAltDeg: 0, dRollDeg: 0 });
  });

  it('l’angle de pantalla es respecta: la mateixa física, els eixos girats', () => {
    const q = quaternionFromEulerZXY(120, 85, 0);
    const dt = 0.04;
    const portrait = predictedPointingDelta(q, 0, { alphaDps: 0, betaDps: 25, gammaDps: 0 }, dt);
    const landscape = predictedPointingDelta(q, 90, { alphaDps: 0, betaDps: 25, gammaDps: 0 }, dt);
    // El món no canvia amb la pantalla: azimut i altura han de coincidir.
    expect(landscape.dAzDeg).toBeCloseTo(portrait.dAzDeg, 6);
    expect(landscape.dAltDeg).toBeCloseTo(portrait.dAltDeg, 6);
  });
});
