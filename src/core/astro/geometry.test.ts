/**
 * Tests de la matemàtica pura de `geometry.ts`.
 *
 * Aquí no hi ha efemèrides ni temps: només discos i angles. Si aquests tests
 * fallen, tota la resta de la validació no vol dir res, perquè els contactes es
 * troben resolent justament aquestes equacions.
 */

import { describe, it, expect } from 'vitest';
import {
  angularSeparation,
  eclipseMagnitude,
  eclipseObscuration,
} from './geometry';

/** L'ascensió recta va en HORES: un grau són 1/15 d'hora. */
const H = (deg: number) => deg / 15;

describe('angularSeparation', () => {
  it('val zero per a dos punts idèntics', () => {
    expect(angularSeparation(H(120), 35, H(120), 35)).toBeCloseTo(0, 12);
  });

  it('sobre l’equador celeste, la separació és la diferència d’ascensió recta', () => {
    expect(angularSeparation(H(10), 0, H(13), 0)).toBeCloseTo(3, 10);
  });

  it('sobre un meridià, la separació és la diferència de declinació', () => {
    expect(angularSeparation(H(45), -20, H(45), 12)).toBeCloseTo(32, 10);
  });

  it('dona la volta pel 0h: 359° i 1° estan a 2°, no a 358°', () => {
    // Aquest és el cas que trenca qualsevol implementació que resti angles
    // sense normalitzar. Passa de veritat: el Sol i la Lluna creuen l'origen
    // d'ascensions rectes i, si no es tracta bé, la separació fa un salt de
    // gairebé 360° i la cerca d'arrels troba contactes inexistents.
    expect(angularSeparation(H(359), 0, H(1), 0)).toBeCloseTo(2, 10);
    expect(angularSeparation(H(1), 0, H(359), 0)).toBeCloseTo(2, 10);
  });

  it('la volta pel 0h també funciona fora de l’equador', () => {
    // A declinació 60° la separació NO és 2·cos(60°) = 1° exacte: això només
    // és l'aproximació de petits angles. La llei del cosinus esfèric dona
    // 0,99996°, i és contra això que s'ha de comparar.
    const dec = (60 * Math.PI) / 180;
    const exact =
      (Math.acos(
        Math.sin(dec) ** 2 + Math.cos(dec) ** 2 * Math.cos((2 * Math.PI) / 180),
      ) *
        180) /
      Math.PI;
    expect(angularSeparation(H(359), 60, H(1), 60)).toBeCloseTo(exact, 10);
    expect(exact).toBeCloseTo(0.9999619, 6);
  });

  it('és simètrica', () => {
    const a = angularSeparation(H(100), 22, H(103), -5);
    const b = angularSeparation(H(103), -5, H(100), 22);
    expect(a).toBeCloseTo(b, 12);
  });

  it('els pols oposats estan a 180°', () => {
    expect(angularSeparation(H(0), 90, H(180), -90)).toBeCloseTo(180, 10);
  });

  it('manté la precisió amb separacions minúscules', () => {
    // El motiu de fer servir atan2(|u×v|, u·v) i no acos(u·v): al voltant dels
    // contactes les separacions són de dècimes de grau i `acos` d'un valor
    // proper a 1 hi perd la meitat dels dígits. Aquí demanem 0,001 segons
    // d'arc sobre una separació d'un segon d'arc.
    const oneArcsec = 1 / 3600;
    expect(angularSeparation(H(80), 0, H(80 + oneArcsec), 0)).toBeCloseTo(
      oneArcsec,
      9,
    );
  });
});

describe('eclipseMagnitude', () => {
  // Radis típics de l'eclipsi del 12/08/2026, en graus.
  const sun = 0.2634;
  const moon = 0.2723;

  it('val 0 si els discos no es toquen', () => {
    expect(eclipseMagnitude(1, sun, moon)).toBe(0);
  });

  it('val 0 justament quan els discos són tangents exteriors (C1 i C4)', () => {
    expect(eclipseMagnitude(sun + moon, sun, moon)).toBe(0);
  });

  it('val la meitat quan la Lluna cobreix mig diàmetre solar', () => {
    // sep = Rs + Rm − Ds, amb Ds = mig diàmetre solar cobert = Rs.
    expect(eclipseMagnitude(moon, sun, moon)).toBeCloseTo(0.5, 12);
  });

  it('a la tangència interior (C2 i C3) val la raó de radis', () => {
    expect(eclipseMagnitude(moon - sun, sun, moon)).toBeCloseTo(moon / sun, 12);
  });

  it('es manté plana durant tota la totalitat', () => {
    // Aquest és el motiu pel qual `contacts.ts` busca el mínim de la SEPARACIÓ
    // i no el màxim de la magnitud: dins de la totalitat la magnitud és
    // constant i una cerca ternària no hi convergiria enlloc.
    const a = eclipseMagnitude(0, sun, moon);
    const b = eclipseMagnitude((moon - sun) / 2, sun, moon);
    const c = eclipseMagnitude(moon - sun, sun, moon);
    expect(a).toBeCloseTo(b, 12);
    expect(b).toBeCloseTo(c, 12);
    expect(a).toBeGreaterThan(1);
  });

  it('en un eclipsi anular es queda per sota d’1', () => {
    const annularMoon = 0.2555; // Lluna a l'apogeu, com el 26/01/2028.
    expect(eclipseMagnitude(0, sun, annularMoon)).toBeCloseTo(
      annularMoon / sun,
      12,
    );
    expect(eclipseMagnitude(0, sun, annularMoon)).toBeLessThan(1);
  });

  it('creix de manera monòtona a mesura que els discos s’acosten', () => {
    let previous = -1;
    for (let sep = sun + moon; sep >= moon - sun; sep -= 0.005) {
      const m = eclipseMagnitude(sep, sun, moon);
      expect(m).toBeGreaterThanOrEqual(previous);
      previous = m;
    }
  });
});

describe('eclipseObscuration', () => {
  const sun = 0.2634;
  const moon = 0.2723;

  it('val 0 si els discos no es toquen', () => {
    expect(eclipseObscuration(1, sun, moon)).toBe(0);
  });

  it('val 0 amb els discos tangents exteriors', () => {
    expect(eclipseObscuration(sun + moon, sun, moon)).toBe(0);
  });

  it('val 1 amb el Sol completament dins de la Lluna', () => {
    expect(eclipseObscuration(0, sun, moon)).toBe(1);
    expect(eclipseObscuration(moon - sun, sun, moon)).toBe(1);
  });

  it('en un anular val la raó d’ÀREES, no de diàmetres', () => {
    // La confusió magnitud/obscuració és exactament aquí: una Lluna que tapa el
    // 97% del diàmetre només tapa el 94% de l'àrea.
    const annularMoon = 0.2555;
    const expected = (annularMoon * annularMoon) / (sun * sun);
    expect(eclipseObscuration(0, sun, annularMoon)).toBeCloseTo(expected, 12);
    expect(expected).toBeLessThan(1);
  });

  it('amb discos iguals i centres coincidents val 1', () => {
    expect(eclipseObscuration(0, sun, sun)).toBe(1);
  });

  it('amb discos iguals i separació igual al radi, val la lent circular exacta', () => {
    // Àrea d'intersecció de dos cercles de radi r amb els centres a distància r:
    // 2·r²·(π/3 − √3/4). Dividida per π·r² dona una fracció que no depèn de r.
    const expected = (2 * (Math.PI / 3 - Math.sqrt(3) / 4)) / Math.PI;
    expect(eclipseObscuration(sun, sun, sun)).toBeCloseTo(expected, 12);
    expect(expected).toBeCloseTo(0.391002, 6);
  });

  it('queda per sota de la magnitud mentre la magnitud no frega l’1', () => {
    // La conseqüència perceptiva: amb magnitud 0,8 encara hi ha molta claror
    // perquè no s'ha tapat el 80% de la llum, sinó el 75%.
    //
    // El marge no val fins a magnitud 1: les dues corbes es creuen cap a 0,975
    // i, a partir d'allà, l'obscuració passa per damunt de la magnitud fins que
    // totes dues arriben al final de la parcialitat. Per això el test es limita
    // a magnitud <= 0,95, que és on l'afirmació és certa.
    for (let sep = moon - sun + 0.001; sep < sun + moon; sep += 0.005) {
      const m = eclipseMagnitude(sep, sun, moon);
      const o = eclipseObscuration(sep, sun, moon);
      if (m > 0.05 && m <= 0.95) expect(o).toBeLessThan(m);
    }
  });

  it('magnitud 0,8 tapa el 75% de l’àrea, no el 80%', () => {
    // Valor comprovat a mà amb l'àrea de la lent circular. Ull: la capçalera
    // de `geometry.ts` diu «el 71%»; el valor exacte per a aquests radis és
    // 0,7548, i per a dos discos exactament iguals, 0,7471. En cap dels dos
    // casos surt 0,71.
    const sep = sun + moon - 0.8 * 2 * sun;
    expect(eclipseMagnitude(sep, sun, moon)).toBeCloseTo(0.8, 10);
    expect(eclipseObscuration(sep, sun, moon)).toBeCloseTo(0.7548, 4);

    const equalDiscs = sun + sun - 0.8 * 2 * sun;
    expect(eclipseObscuration(equalDiscs, sun, sun)).toBeCloseTo(0.7471, 4);
  });

  it('creix de manera monòtona i mai no passa d’1', () => {
    let previous = -1;
    for (let sep = sun + moon; sep >= 0; sep -= 0.005) {
      const o = eclipseObscuration(sep, sun, moon);
      expect(o).toBeGreaterThanOrEqual(previous);
      expect(o).toBeLessThanOrEqual(1);
      previous = o;
    }
  });

  it('no retorna NaN als punts de tangència', () => {
    // Als contactes els arguments d'`acos` valen exactament ±1 i qualsevol
    // error d'arrodoniment els pot fer sortir del domini.
    for (const sep of [sun + moon, moon - sun, Math.abs(sun - moon)]) {
      expect(Number.isNaN(eclipseObscuration(sep, sun, moon))).toBe(false);
    }
  });
});
