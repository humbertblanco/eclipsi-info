/**
 * Quaternions d'orientació, i per què els angles d'Euler no serveixen aquí.
 *
 * EL PROBLEMA. La temptació és suavitzar alpha, beta i gamma per separat. No
 * funciona, i falla justament quan importa:
 *
 *  - Alpha té una discontinuïtat de 359° a 0°. Un filtre lineal, en aquell
 *    salt, fa recórrer a la superposició tota la volta del cel en un fotograma.
 *  - Prop de beta = ±90° —que és exactament com es té el telèfon quan
 *    s'apunta al cel— hi ha bloqueig de cardan: alpha i gamma descriuen la
 *    mateixa rotació i els seus valors salten sense que el telèfon s'hagi
 *    mogut.
 *
 * La solució és convertir PRIMER a quaternió i suavitzar sobre la varietat de
 * rotacions, on ni hi ha discontinuïtats ni hi ha coordenades degenerades.
 *
 * CONVENI. Component escalar `w` al final: [x, y, z, w]. La rotació porta del
 * marc del dispositiu al marc del món (X est, Y nord, Z amunt).
 *
 * Cap dependència de DOM.
 */

export type Quaternion = readonly [x: number, y: number, z: number, w: number];

export const IDENTITY_QUATERNION: Quaternion = [0, 0, 0, 1];

const DEG = Math.PI / 180;

/**
 * Quaternió a partir dels angles d'Euler del W3C, en l'ordre intrínsec ZXY.
 *
 * És la mateixa composició que fa `rotationMatrix` a `orientation.ts`: primer
 * un gir d'alpha al voltant de Z, després beta al voltant de X, i finalment
 * gamma al voltant de Y. Aquesta funció i aquella han de descriure sempre la
 * mateixa rotació; si algun dia divergeixen, la superposició saltarà entre el
 * camí filtrat i el camí en brut.
 */
export function quaternionFromEulerZXY(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): Quaternion {
  const halfZ = alphaDeg * DEG * 0.5;
  const halfX = betaDeg * DEG * 0.5;
  const halfY = gammaDeg * DEG * 0.5;

  const cz = Math.cos(halfZ);
  const sz = Math.sin(halfZ);
  const cx = Math.cos(halfX);
  const sx = Math.sin(halfX);
  const cy = Math.cos(halfY);
  const sy = Math.sin(halfY);

  // q = qZ · qX · qY
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
}

/**
 * Angles d'Euler ZXY a partir d'un quaternió.
 *
 * Cal per tornar al camí de càlcul existent, que treballa amb alpha/beta/gamma.
 * A beta = ±90° els angles són degenerats; en aquest cas es reparteix tot el
 * gir a alpha i es deixa gamma a zero, que és la convenció habitual i evita
 * que la superposició faci un tomb quan el telèfon apunta al zenit.
 */
export function eulerZXYFromQuaternion(q: Quaternion): {
  alpha: number;
  beta: number;
  gamma: number;
} {
  const [x, y, z, w] = q;

  // sin(beta) surt del terme m21 de la matriu de rotació equivalent.
  const sinBeta = Math.max(-1, Math.min(1, 2 * (y * z + w * x)));
  const beta = Math.asin(sinBeta);

  let alpha: number;
  let gamma: number;

  if (Math.abs(sinBeta) > 0.999999) {
    alpha = Math.atan2(2 * (x * y + w * z), 1 - 2 * (y * y + z * z));
    gamma = 0;
  } else {
    alpha = Math.atan2(-2 * (x * y - w * z), 1 - 2 * (x * x + z * z));
    gamma = Math.atan2(-2 * (x * z - w * y), 1 - 2 * (x * x + y * y));
  }

  const RAD = 180 / Math.PI;
  return {
    alpha: ((alpha * RAD) % 360 + 360) % 360,
    beta: beta * RAD,
    gamma: gamma * RAD,
  };
}

export function quaternionDot(a: Quaternion, b: Quaternion): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

export function quaternionNormalize(q: Quaternion): Quaternion {
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  if (n < 1e-12) return IDENTITY_QUATERNION;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** Nega el quaternió. q i −q són la mateixa rotació però no interpolen igual. */
export function quaternionNegate(q: Quaternion): Quaternion {
  return [-q[0], -q[1], -q[2], -q[3]];
}

/**
 * Producte de Hamilton: la rotació `b` composta DESPRÉS de `a` en el marc
 * local d'`a` (multiplicació per la dreta = rotació intrínseca). És el que
 * cal per empènyer una postura amb una velocitat angular expressada en els
 * eixos del DISPOSITIU, que és com les dona el giroscopi.
 */
export function quaternionMultiply(a: Quaternion, b: Quaternion): Quaternion {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/**
 * Quaternió que porta de `a` a `b`, pel camí curt: delta = b · conjugat(a).
 *
 * El signe es tria perquè la part escalar surti positiva. q i −q són la
 * mateixa rotació però no el mateix camí: sense aquesta correcció, un canvi
 * d'hemisferi del sensor —que passa sol i sense que el telèfon es mogui— es
 * llegiria com un gir de 360°.
 */
export function quaternionDelta(a: Quaternion, b: Quaternion): Quaternion {
  const sign = quaternionDot(a, b) < 0 ? -1 : 1;
  const [ax, ay, az, aw] = a;
  const bx = b[0] * sign;
  const by = b[1] * sign;
  const bz = b[2] * sign;
  const bw = b[3] * sign;

  return [
    bx * aw - bw * ax - by * az + bz * ay,
    by * aw - bw * ay - bz * ax + bx * az,
    bz * aw - bw * az - bx * ay + by * ax,
    bw * aw + bx * ax + by * ay + bz * az,
  ];
}

/**
 * Angle de la rotació que separa dos quaternions, en radians, sempre a [0, π].
 *
 * ES CALCULA AMB `atan2` I NO AMB `acos`. Amb `acos` del producte escalar,
 * l'angle de dos quaternions IDÈNTICS no surt zero sinó 3·10⁻⁸ rad: prop d'1
 * el cosinus és pla i l'arccosinus n'amplifica l'error de coma flotant per
 * 10⁸. Aquí això no és una curiositat numèrica — és soroll que el filtre
 * d'1 euro llegeix com a velocitat angular. Amb `atan2(|v|, w)` l'error és
 * proporcional a l'angle i dos quaternions iguals donen zero exacte.
 */
export function quaternionAngle(a: Quaternion, b: Quaternion): number {
  const d = quaternionDelta(a, b);
  const vLen = Math.hypot(d[0], d[1], d[2]);
  return 2 * Math.atan2(vLen, Math.abs(d[3]));
}

/**
 * Vector de rotació que porta de `a` a `b`: eix per angle, en radians.
 *
 * PER QUÈ UN VECTOR I NO UN ANGLE. Per estimar la velocitat angular la
 * temptació és fer servir `quaternionAngle`, que és un escalar. No serveix:
 * l'angle és sempre positiu, i per tant el soroll d'un sensor quiet NO
 * s'anul·la en fer-ne la mitjana — s'acumula. El filtre llegiria aquell soroll
 * rectificat com si fos un gir de debò, obriria la freqüència de tall i es
 * desactivaria ell mateix justament en el cas per al qual existeix.
 *
 * Amb el vector, el soroll apunta cada vegada cap a una banda diferent i es
 * cancel·la en el passa-baixos, mentre que un gir de debò manté l'eix i
 * sobreviu. És la generalització correcta de la derivada amb signe del filtre
 * d'1 euro escalar.
 */
export function quaternionRotationVector(
  a: Quaternion,
  b: Quaternion,
): readonly [number, number, number] {
  const [dx, dy, dz, dw] = quaternionDelta(a, b);

  const vLen = Math.hypot(dx, dy, dz);
  if (vLen < 1e-12) return [0, 0, 0];

  const angle = 2 * Math.atan2(vLen, Math.abs(dw));
  const k = angle / vLen;
  return [dx * k, dy * k, dz * k];
}

/**
 * Interpolació esfèrica. Per a angles molt petits cau a interpolació lineal
 * normalitzada, que hi és numèricament indistingible i no divideix per zero.
 */
export function quaternionSlerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let dot = quaternionDot(a, b);
  let target = b;

  // Hemisferi: sempre pel camí curt.
  if (dot < 0) {
    target = quaternionNegate(b);
    dot = -dot;
  }

  if (dot > 0.9995) {
    return quaternionNormalize([
      a[0] + (target[0] - a[0]) * t,
      a[1] + (target[1] - a[1]) * t,
      a[2] + (target[2] - a[2]) * t,
      a[3] + (target[3] - a[3]) * t,
    ]);
  }

  const theta = Math.acos(Math.min(1, dot));
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;

  return quaternionNormalize([
    a[0] * wa + target[0] * wb,
    a[1] * wa + target[1] * wb,
    a[2] * wa + target[2] * wb,
    a[3] * wa + target[3] * wb,
  ]);
}
