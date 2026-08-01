/**
 * `skyState()`: una crida, tot l'estat de la llum en un instant.
 *
 * És la porta d'entrada del mòdul i està pensada per ser cridada un cop per
 * fotograma des del renderitzador. Tot el que hi ha a dins és pur i
 * determinista: mateixa entrada, mateixa sortida, sense estat global ni DOM.
 *
 * L'ALTURA QUE S'HI PASSA ÉS L'APARENT (`sample.sun.altitudeApparent`). Si
 * només tens la geomètrica, posa `altitudeIsGeometric: true` i el mòdul li
 * aplica la refracció. Als eclipsis espanyols de 2026 i 2028, amb el Sol entre
 * 1° i 12°, confondre-les canvia la il·luminància en desenes de per cent.
 *
 * Cap dependència de DOM.
 */

import { STANDARD_ATMOSPHERE } from '../astro/constants';
import { applyRefraction } from '../astro/refraction';
import type { Atmosphere, EclipseSample } from '../astro/types';
import { colorfulness, eyeState } from './adaptation';
import { skyPalette } from './color';
import { FULL_MOON_LUX } from './constants';
import {
  diffuseHorizontalIlluminanceLux,
  eclipseIlluminance,
  equivalentSunAltitudeDeg as equivalentAltitude,
} from './illuminance';
import {
  luminousFractionFromObscuration,
  uncoveredLuminousFraction,
} from './solarDisc';
import type { EyeState, LightPhase, SkyState } from './types';

/**
 * Per sota d'aquesta fracció de flux, la franja taronja de 360° ja hi és del
 * tot. No és un llindar arbitrari: correspon als últims segons abans del segon
 * contacte, que és quan l'ombra t'arriba i el color de l'horitzó canvia de
 * debò. Serveix per no fer un salt de color d'un fotograma a l'altre.
 */
export const TOTALITY_RAMP_FRACTION = 1e-3;

/** Geometria dels dos discos, si es coneix. */
export interface DiscGeometry {
  /** Separació angular dels centres, en graus. */
  separationDeg: number;
  /** Radi angular del Sol, en graus. */
  sunRadiusDeg: number;
  /** Radi angular de la Lluna, en graus. */
  moonRadiusDeg: number;
}

export interface SkyStateOptions {
  atmosphere?: Atmosphere;
  /**
   * Geometria exacta dels discos. SI LA TENS, PASSA-LA: amb la geometria el
   * model calcula la fracció de flux integrant l'enfosquiment del limbe sobre
   * el tros de Sol que queda, que és el càlcul correcte. Sense ella cal
   * estimar-la a partir de l'obscuració, i això falla als eclipsis anulars
   * profunds, on el que queda és un anell enganxat al limbe.
   */
  discs?: DiscGeometry;
  /**
   * Fase, si es coneix per una altra via. Només s'usa quan no hi ha `discs`.
   * Serveix sobretot per distingir una anularitat d'una parcial profunda.
   */
  phase?: LightPhase;
  /** Cert si `sunAltitudeDeg` és geomètrica i cal refractar-la. */
  altitudeIsGeometric?: boolean;
  /**
   * Nivell d'adaptació de l'ull, en lux, si el vas seguint amb `adaptEye`.
   * Si no s'hi posa, se suposa l'ull ja adaptat: la sortida mostra la
   * percepció d'algú que ja fa estona que hi és, no el xoc del segon contacte.
   */
  adaptationLux?: number;
  /** Brillantor de la corona, 1 = mitjana del cicle solar. */
  coronaFactor?: number;
  /** Albedo del paisatge, per passar d'il·luminància a luminància. */
  groundAlbedo?: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Frase curta, declarativa i sense xifres.
 *
 * Sense xifres a propòsit: les xifres van als camps numèrics de `SkyState`
 * perquè la interfície les pugui pintar en mono tabular, com mana el sistema de
 * disseny. Barrejar-les dins d'una frase les treu de la graella.
 */
function headlineFor(phase: LightPhase, lightFraction: number): string {
  if (phase === 'total') {
    return 'Foscor de crepuscle en ple dia. L’horitzó s’encén en totes direccions.';
  }
  if (phase === 'annular') {
    return 'L’anell no deixa que es faci fosc. La llum queda grisa i plana.';
  }
  if (phase === 'clear') return 'Cel net. Encara no ha començat res.';

  if (lightFraction > 0.85) return 'Encara no es nota res.';
  if (lightFraction > 0.55) {
    return 'La llum ja ha baixat força, però l’ull ho compensa i no ho veus.';
  }
  if (lightFraction > 0.2) return 'Sembla que hagi passat un núvol prim.';
  if (lightFraction > 0.06) {
    return 'La llum es torna metàl·lica, sense l’escalfor d’un capvespre.';
  }
  if (lightFraction > 0.012) {
    return 'Llum grisa i estranya. Les ombres es tornen esmolades.';
  }
  if (lightFraction > 0.001) return 'Cau de pressa. Això ja no sembla de dia.';
  return 'Els últims segons. La foscor arriba de cop.';
}

function resolvePhase(
  obscuration: number,
  discs: DiscGeometry | undefined,
  declared: LightPhase | undefined,
): LightPhase {
  if (discs) {
    const { separationDeg, sunRadiusDeg, moonRadiusDeg } = discs;
    if (separationDeg <= Math.abs(moonRadiusDeg - sunRadiusDeg)) {
      return moonRadiusDeg >= sunRadiusDeg ? 'total' : 'annular';
    }
    return separationDeg < sunRadiusDeg + moonRadiusDeg ? 'partial' : 'clear';
  }
  if (declared) return declared;
  // Sense geometria ni fase declarada, només l'obscuració exactament plena
  // compta com a totalitat. El llindar NO es rebaixa a 0,999 a propòsit: un
  // 99,9% és exactament el que veu qui es queda un parell de quilòmetres fora
  // de la franja, i confondre-ho amb una totalitat seria mentir-li just en el
  // cas que aquesta aplicació existeix per respondre.
  if (obscuration >= 1) return 'total';
  return obscuration > 0 ? 'partial' : 'clear';
}

/**
 * Estat de la llum, del color i de la percepció per a un instant de l'eclipsi.
 *
 * @param obscuration fracció de l'ÀREA del disc solar tapada, de 0 a 1
 * @param sunAltitudeDeg altura APARENT del Sol, en graus
 */
export function skyState(
  obscuration: number,
  sunAltitudeDeg: number,
  options: SkyStateOptions = {},
): SkyState {
  const atmosphere = options.atmosphere ?? STANDARD_ATMOSPHERE;
  const altitude = options.altitudeIsGeometric
    ? applyRefraction(sunAltitudeDeg, atmosphere)
    : sunAltitudeDeg;

  const obsc = clamp01(obscuration);
  const phase = resolvePhase(obsc, options.discs, options.phase);

  // Fracció del FLUX solar que encara arriba. Amb geometria s'integra
  // l'enfosquiment del limbe; sense geometria, s'estima.
  const luminousFraction = options.discs
    ? uncoveredLuminousFraction(
        options.discs.separationDeg,
        options.discs.sunRadiusDeg,
        options.discs.moonRadiusDeg,
      )
    : phase === 'total'
      ? 0
      : luminousFractionFromObscuration(obsc);

  const illuminance = eclipseIlluminance(luminousFraction, altitude, {
    atmosphere,
    coronaFactor: options.coronaFactor,
  });

  const lux = illuminance.totalLux;
  const clearLux = illuminance.clearSkyLux;

  const eye: EyeState = eyeState(lux, clearLux, {
    adaptationLux: options.adaptationLux,
    groundAlbedo: options.groundAlbedo,
  });

  // Saturació RELATIVA: comparem el colorit que hi ha amb el que hi hauria amb
  // el Sol a la mateixa altura i sense eclipsi. Així un capvespre normal surt
  // amb els seus colors sencers i només l'eclipsi despinta l'escena.
  //
  // Es mesura amb la llum que emet EL CEL, no amb la que il·lumina el terra.
  // El cel és una font pròpia: durant la totalitat el paisatge cau al règim
  // mesòpic i es queda gris, però la franja de l'horitzó continua sent prou
  // lluminosa per veure-la de color. Fer servir la il·luminància del terra
  // aquí despintaria l'única cosa que la gent recorda de la totalitat.
  const skyOwnLux =
    illuminance.diffuseLux + illuminance.leakageLux + illuminance.coronaLux;
  const clearSkyOwnLux = Math.max(
    skyOwnLux,
    diffuseHorizontalIlluminanceLux(altitude),
  );
  // Albedo 1: L = E/π és la luminància mitjana de l'hemisferi celeste.
  const clearColorfulness = colorfulness(clearSkyOwnLux, 1);
  const saturationScale =
    clearColorfulness > 0
      ? clamp01(colorfulness(skyOwnLux, 1) / clearColorfulness)
      : 1;

  // Un eclipsi anular no arriba mai a la totalitat encara que el flux baixi
  // molt: sempre hi queda l'anell, i per tant mai no hi ha franja de 360°.
  const totalCapable = options.discs
    ? options.discs.moonRadiusDeg >= options.discs.sunRadiusDeg
    : phase !== 'annular';
  const totality = totalCapable
    ? clamp01(1 - luminousFraction / TOTALITY_RAMP_FRACTION)
    : 0;

  const palette = skyPalette({
    sunAltitudeDeg: altitude,
    luminanceScale: eye.perceivedFraction,
    saturationScale,
    luminousFraction,
    totality,
  });

  return {
    phase,
    illuminanceLux: lux,
    clearSkyIlluminanceLux: clearLux,
    lightFraction: clamp01(lux / clearLux),
    luminousFraction,
    obscuration: obsc,
    breakdown: {
      directLux: illuminance.directLux,
      diffuseLux: illuminance.diffuseLux,
      leakageLux: illuminance.leakageLux,
      coronaLux: illuminance.coronaLux,
      airMass: illuminance.airMass,
      transmittance: illuminance.transmittance,
      directNormalLux: illuminance.directNormalLux,
    },
    eye,
    palette,
    equivalentSunAltitudeDeg: equivalentAltitude(lux, atmosphere),
    timesFullMoon: lux / FULL_MOON_LUX,
    headline: headlineFor(phase, clamp01(lux / clearLux)),
  };
}

/**
 * El mateix, però a partir d'una mostra del motor astronòmic.
 *
 * És la manera recomanada de cridar-ho des del renderitzador: la mostra ja
 * porta l'altura aparent i els dos radis angulars, o sigui que el model pot
 * fer servir la geometria exacta i no ha d'estimar res.
 */
export function skyStateFromSample(
  sample: EclipseSample,
  options: Omit<SkyStateOptions, 'discs' | 'altitudeIsGeometric' | 'phase'> = {},
): SkyState {
  return skyState(sample.obscuration, sample.sun.altitudeApparent, {
    ...options,
    discs: {
      separationDeg: sample.separation,
      sunRadiusDeg: sample.sun.angularRadius,
      moonRadiusDeg: sample.moon.angularRadius,
    },
  });
}
