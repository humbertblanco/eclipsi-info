/**
 * Refracció atmosfèrica.
 *
 * Aquest mòdul és petit però és crític per a aquest projecte. Els eclipsis de
 * 2026 i 2028 a Espanya passen amb el Sol entre 1° i 12° sobre l'horitzó, i a
 * aquestes altures la refracció val més que el radi del propi Sol:
 *
 *    altura real 12° → refracció 0,076°
 *    altura real  5° → refracció 0,161°
 *    altura real  2° → refracció 0,282°
 *    altura real  0° → refracció 0,483°
 *
 * (Són els valors que dona de veritat la fórmula de sota per a altura
 * VERTADERA. Les taules a l'ús solen portar 0,29° a 2° i 0,17° a 5°, però estan
 * tabulades per altura APARENT, que no és el mateix punt de partida.)
 *
 * (el radi del Sol és ~0,27°)
 *
 * REGLA D'ÚS: la refracció s'aplica a l'ALTURA de cada astre, per saber on el
 * veurem realment i per comparar amb el perfil d'horitzó. NO s'aplica mai a la
 * separació angular Sol-Lluna, perquè tots dos astres estan pràcticament a la
 * mateixa altura i es refracten igual: la geometria de l'eclipsi no canvia.
 */

import { STANDARD_ATMOSPHERE, DEG } from './constants';
import type { Atmosphere } from './types';

/**
 * Refracció segons Sæmundsson (1986), que és la fórmula per anar d'altura
 * VERTADERA (geomètrica) a altura APARENT — que és exactament la direcció que
 * necessitem nosaltres.
 *
 * @param trueAltitudeDeg altura geomètrica en graus
 * @returns refracció en graus, a sumar a l'altura vertadera
 */
export function refractionDeg(
  trueAltitudeDeg: number,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): number {
  // Per sota d'aquest límit la fórmula deixa de tenir sentit físic i, de tota
  // manera, l'astre ja fa estona que no es veu. Saturem per evitar que la
  // tangent exploti i ens torni valors absurds.
  const h = Math.max(trueAltitudeDeg, -1.9);

  // R en minuts d'arc.
  const arcmin = 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG);

  // Correcció per pressió i temperatura respecte a l'atmosfera estàndard.
  const factor =
    (atmosphere.pressureMb / 1010) * (283 / (273 + atmosphere.temperatureC));

  return (arcmin * factor) / 60;
}

/** Altura aparent = altura geomètrica + refracció. */
export function applyRefraction(
  trueAltitudeDeg: number,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): number {
  return trueAltitudeDeg + refractionDeg(trueAltitudeDeg, atmosphere);
}

/**
 * Aplana el disc d'un astre prop de l'horitzó.
 *
 * La refracció és més forta a la vora inferior del disc que a la superior, i
 * per això el Sol es veu ovalat quan es pon. A 2° d'altura l'aplanament és
 * d'un ~8%, i a l'horitzó arriba al ~18%: és perfectament visible a la càmera,
 * i si no ho reproduïm la simulació no quadrarà amb el que l'usuari veu.
 *
 * @returns factor d'escala vertical del disc (1 = rodó)
 */
export function discFlattening(
  trueAltitudeDeg: number,
  angularRadiusDeg: number,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): number {
  const top = applyRefraction(trueAltitudeDeg + angularRadiusDeg, atmosphere);
  const bottom = applyRefraction(trueAltitudeDeg - angularRadiusDeg, atmosphere);
  const apparentDiameter = top - bottom;
  return apparentDiameter / (2 * angularRadiusDeg);
}
