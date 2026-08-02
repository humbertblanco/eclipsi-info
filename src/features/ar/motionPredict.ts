/**
 * Predicció de la postura amb el giroscopi cru.
 *
 * PER QUÈ. Entre que el sensor llegeix, el filtre suavitza, la fusió decideix
 * i la pantalla pinta, la postura dibuixada va un fotograma llarg endarrere
 * del mòbil. Quiet no es nota (la quietud ja és quieta per construcció);
 * movent-se és EL retard que l'ull veu. El giroscopi dona la velocitat
 * angular instantània en els eixos del dispositiu (`devicemotion.rotationRate`),
 * i empènyer la postura aquests 30-40 ms endavant és la diferència entre
 * «va bé» i «va clavat».
 *
 * COM. La postura és un quaternió món-des-de-dispositiu; una velocitat
 * angular en eixos de DISPOSITIU s'hi composa per la DRETA (rotació
 * intrínseca): q' = q ⊗ exp(ω·dt/2). El costat de la multiplicació no es
 * raona, es CLAVA al banc contra la integració d'Euler del mateix sistema —
 * és la mena de signe que surt car endevinar.
 *
 * Els eixos de `rotationRate`: alpha gira al voltant de Z del dispositiu,
 * beta d'X, gamma d'Y — les mateixes definicions que `deviceorientation`.
 *
 * Sense DOM. La declinació magnètica s'anul·la sola: la predicció és una
 * DIFERÈNCIA de dues postures que la porten igual.
 */

import {
  quaternionMultiply,
  quaternionNormalize,
  type Quaternion,
} from './quaternion';
import { cameraPointingFromQuaternion } from './orientation';
import { normalizeDelta } from './poseFusion';

const DEG = Math.PI / 180;

export interface RotationRate {
  /** Al voltant de Z del dispositiu, en graus per segon. */
  alphaDps: number;
  /** Al voltant d'X del dispositiu. */
  betaDps: number;
  /** Al voltant d'Y del dispositiu. */
  gammaDps: number;
}

/**
 * Quant es mourà la punteria de la càmera si el gir actual continua `dtSec`
 * segons més, en graus d'azimut, altura i roll d'imatge.
 */
export function predictedPointingDelta(
  q: Quaternion,
  screenAngle: number,
  rate: RotationRate,
  dtSec: number,
): { dAzDeg: number; dAltDeg: number; dRollDeg: number } {
  if (!(dtSec > 0)) return { dAzDeg: 0, dAltDeg: 0, dRollDeg: 0 };

  const wx = rate.betaDps * DEG;
  const wy = rate.gammaDps * DEG;
  const wz = rate.alphaDps * DEG;
  const omega = Math.hypot(wx, wy, wz);
  if (!(omega > 1e-9)) return { dAzDeg: 0, dAltDeg: 0, dRollDeg: 0 };

  const half = (omega * dtSec) / 2;
  const k = Math.sin(half) / omega;
  const dq: Quaternion = [wx * k, wy * k, wz * k, Math.cos(half)];

  const predicted = quaternionNormalize(quaternionMultiply(q, dq));

  const before = cameraPointingFromQuaternion(q, screenAngle);
  const after = cameraPointingFromQuaternion(predicted, screenAngle);

  return {
    dAzDeg: normalizeDelta(after.azimuth - before.azimuth),
    dAltDeg: after.altitude - before.altitude,
    dRollDeg: normalizeDelta(after.roll - before.roll),
  };
}
