/**
 * Geometria de discos: separació angular, magnitud i obscuració.
 * Tot en graus.
 */

import { DEG, RAD } from './constants';

/**
 * Separació angular entre dues posicions equatorials.
 *
 * Es fa amb vectors unitaris i `atan2(|u×v|, u·v)` en comptes de la fórmula
 * clàssica del cosinus, perquè aquí les separacions són molt petites (dècimes
 * de grau) i `acos` d'un valor proper a 1 perd precisió catastròficament —
 * justament al voltant dels contactes, que és on necessitem tota la precisió.
 *
 * @param ra1 ascensió recta en HORES
 * @param dec1 declinació en GRAUS
 */
export function angularSeparation(
  ra1: number,
  dec1: number,
  ra2: number,
  dec2: number,
): number {
  const u = unitVector(ra1, dec1);
  const v = unitVector(ra2, dec2);

  const cross = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const crossMag = Math.hypot(cross[0], cross[1], cross[2]);
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

  return Math.atan2(crossMag, dot) * RAD;
}

function unitVector(raHours: number, decDeg: number): [number, number, number] {
  const ra = raHours * 15 * DEG;
  const dec = decDeg * DEG;
  const cosDec = Math.cos(dec);
  return [cosDec * Math.cos(ra), cosDec * Math.sin(ra), Math.sin(dec)];
}

/**
 * Magnitud de l'eclipsi: fracció del DIÀMETRE solar coberta per la Lluna.
 *
 * És la xifra que publiquen l'IGN i la NASA. Pot passar d'1 en un eclipsi
 * total (vol dir que el disc lunar és més gran que el solar).
 */
export function eclipseMagnitude(
  separation: number,
  sunRadius: number,
  moonRadius: number,
): number {
  if (separation >= sunRadius + moonRadius) return 0;
  if (separation <= Math.abs(moonRadius - sunRadius)) {
    // Fase central: el disc lunar tapa tot el diàmetre solar (total) o hi cap
    // sencer a dins (anular).
    return moonRadius / sunRadius;
  }
  return (sunRadius + moonRadius - separation) / (2 * sunRadius);
}

/**
 * Obscuració: fracció de l'ÀREA del disc solar tapada, de 0 a 1.
 *
 * És la magnitud perceptualment rellevant — la que determina quanta llum perds
 * de veritat. Una magnitud del 0,8 només tapa el 75,5% de l'àrea, i la gent
 * s'endú una sorpresa quan veu que encara hi ha molta claror.
 * (Amb dos discos exactament iguals surt el 74,7%; la xifra depèn una mica de
 * la raó de radis. Comprovat a `geometry.test.ts`.)
 *
 * Àrea d'intersecció de dos cercles (lents circulars).
 */
export function eclipseObscuration(
  separation: number,
  sunRadius: number,
  moonRadius: number,
): number {
  const d = separation;
  const r = sunRadius;
  const R = moonRadius;

  if (d >= r + R) return 0;
  if (d <= Math.abs(R - r)) {
    // Un disc conté l'altre. Si és la Lluna la que conté el Sol, obscuració
    // total; si és a l'inrevés (anular), en queda l'anell.
    return Math.min(1, (R * R) / (r * r));
  }

  const alpha = Math.acos((d * d + r * r - R * R) / (2 * d * r));
  const beta = Math.acos((d * d + R * R - r * r) / (2 * d * R));
  const triangle =
    0.5 *
    Math.sqrt(
      Math.max(0, (-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R)),
    );

  const intersection = r * r * alpha + R * R * beta - triangle;
  return Math.min(1, intersection / (Math.PI * r * r));
}
