/**
 * Model barat de la fase central, per al primer garbell.
 *
 * ── EL PROBLEMA ─────────────────────────────────────────────────────────────
 *
 * `computeLocalCircumstances` costa 5,2 ms per punt (mesurat). La major part
 * se'n va a buscar C1 i C4 recorrent hores amb pas de 30 s: unes 520 crides a
 * efemèrides. Per a 570 candidats són 3 segons de fil bloquejat abans de poder
 * ni mirar el terreny, i C1 i C4 no ens interessen gens per decidir on
 * plantar-se.
 *
 * ── LA SOLUCIÓ ──────────────────────────────────────────────────────────────
 *
 * Prop del màxim, la Lluna es mou respecte del Sol en línia recta i a velocitat
 * constant. Llavors el quadrat de la separació és exactament una paràbola:
 *
 *     sep(t)² = sep_min² + v²·(t − t₀)²
 *
 * Tres mostres al voltant d'un instant de referència determinen la paràbola
 * sencera: el vèrtex dona t₀ i sep_min, i el coeficient quadràtic dona v². La
 * fase central és el tram on sep < |R☉ − R☾|, o sigui
 *
 *     mitja durada = √(L² − sep_min²) / v      amb L = |R☉ − R☾|
 *
 * Quatre crides a efemèrides per candidat en comptes de 520. Mesurat: 0,070 ms
 * per candidat, 74 vegades més barat.
 *
 * ── FINS ON ARRIBA ──────────────────────────────────────────────────────────
 *
 * Contra `computeLocalCircumstances`, sobre una graella de 121 punts que cobreix
 * 55 × 58 km al voltant de Sòria per a l'eclipsi del 12-08-2026:
 *
 *     pitjor error de durada    0,36 s
 *     crides a efemèrides       4 per candidat
 *
 * Tres dècimes de segon sobre una totalitat de 100 s no canvien cap
 * classificació. Però NO és la xifra que es publica: els finalistes tornen a
 * passar pel motor exacte. Aquest model només serveix per ordenar i descartar.
 *
 * L'aproximació es degrada amb la distància al punt de referència, perquè el
 * moviment relatiu deixa de ser recte. Per això la referència es pren al centre
 * de la cerca i el radi es limita.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import * as AstronomyNs from 'astronomy-engine';

// Mateix desembolcall que a `ephemeris.ts`: la biblioteca arriba dins de
// `.default` a Node i plana a Vite.
const Astronomy = ((AstronomyNs as unknown as { default?: typeof AstronomyNs })
  .default ?? AstronomyNs) as typeof AstronomyNs;
const { Body, Equator, Horizon, Observer } = Astronomy;

import {
  MOON_RADIUS_RATIO_UMBRAL,
  STANDARD_ATMOSPHERE,
} from '../astro/constants';
import { getEclipse } from '../eclipses/catalog';
import { angularSeparation } from '../astro/geometry';
import { moonAngularRadius, sunAngularRadius } from '../astro/ephemeris';
import { applyRefraction } from '../astro/refraction';
import type { Atmosphere, GeoLocation } from '../astro/types';

/**
 * Separació de les tres mostres de la paràbola, en ms.
 *
 * Ha de ser prou gran perquè la diferència de segons ordre no es perdi en el
 * soroll de coma flotant i prou petita perquè el moviment relatiu encara sigui
 * recte. Entre 30 i 120 s el resultat no canvia (mesurat): 60 s és el mig.
 */
const PARABOLA_SPAN_MS = 60_000;

/** Interval de les diferències finites que donen les velocitats del Sol. */
const RATE_SPAN_MS = 60_000;

/** Separació angular Sol-Lluna i radis, en un instant. */
function separationAt(
  tMs: number,
  observer: AstronomyNs.Observer,
): { sepDeg: number; sunRadiusDeg: number; moonRadiusDeg: number } {
  const time = new Date(tMs);
  const sun = Equator(Body.Sun, time, observer, true, true);
  const moon = Equator(Body.Moon, time, observer, true, true);
  return {
    sepDeg: angularSeparation(sun.ra, sun.dec, moon.ra, moon.dec),
    sunRadiusDeg: sunAngularRadius(sun.dist),
    // Radi UMBRAL: és el que mana als contactes C2 i C3. Amb el radi mitjà la
    // totalitat s'allarga fins a 23 s al caire de la franja.
    moonRadiusDeg: moonAngularRadius(moon.dist, MOON_RADIUS_RATIO_UMBRAL),
  };
}

/** Azimut i altura GEOMÈTRICA del Sol, sense refracció. */
function sunHorizontalAt(
  tMs: number,
  observer: AstronomyNs.Observer,
): { azimuthDeg: number; altitudeTrueDeg: number } {
  const time = new Date(tMs);
  const eq = Equator(Body.Sun, time, observer, true, true);
  const hor = Horizon(time, observer, eq.ra, eq.dec, undefined);
  return { azimuthDeg: hor.azimuth, altitudeTrueDeg: hor.altitude };
}

/**
 * Referència compartida per tots els candidats d'una cerca.
 *
 * Es calcula un sol cop al centre. Conté l'instant al voltant del qual
 * s'ajusten les paràboles i les velocitats del Sol, que a través de tota la
 * zona de cerca varien menys d'un 1 % i no cal recalcular per punt.
 */
export interface CentralSeed {
  eclipseId: string;
  atmosphere: Atmosphere;
  /** Instant de referència, en ms d'època. */
  referenceMs: number;
  /** Velocitat vertical GEOMÈTRICA del Sol, en graus per segon. Negativa si es pon. */
  sunAltRateDegPerSec: number;
  /** Velocitat azimutal del Sol, en graus per segon. */
  sunAzRateDegPerSec: number;
  ephemerisCalls: number;
}

export interface FastCentral {
  /** Instant del mig de la fase central, en ms d'època. */
  midMs: number;
  /** Durada teòrica de la fase central, en segons. Zero si no n'hi ha. */
  centralSec: number;
  /**
   * Marge umbral al màxim, en segons d'arc. Negatiu = ets dins de la franja.
   * És la mateixa magnitud que `LocalCircumstances.umbralMarginArcsec`.
   */
  umbralMarginArcsec: number;
  /** Azimut del Sol al mig de la fase central, en graus. */
  sunAzimuthDeg: number;
  /** Altura geomètrica del Sol al mig de la fase central, en graus. */
  sunAltitudeTrueDeg: number;
  /** Altura aparent, amb refracció. És la que s'ha de comparar amb el terreny. */
  sunAltitudeApparentDeg: number;
  ephemerisCalls: number;
}

/**
 * Construeix la referència al centre de la cerca.
 *
 * L'instant de referència surt d'un ajust parabòlic exactament igual que el de
 * cada candidat, però partint de l'instant de màxim eclipsi global del catàleg.
 * Aquest pot estar a mitja hora del màxim local, prou lluny perquè la paràbola
 * ja no valgui — per això s'itera dues vegades: la primera aproximació ja cau a
 * pocs segons del màxim local i la segona hi és a sobre.
 */
export function buildCentralSeed(
  eclipseId: string,
  centre: GeoLocation,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): CentralSeed {
  const observer = new Observer(centre.lat, centre.lon, centre.elevation);
  const globalMaxMs = new Date(getEclipse(eclipseId).greatestEclipseUtc).getTime();

  let calls = 0;
  let referenceMs = globalMaxMs;

  // Dues passades. La primera parteix del màxim GLOBAL i fa servir un interval
  // ample per abraçar el desfasament amb el màxim local; la segona ja afina.
  for (const spanMs of [15 * 60_000, PARABOLA_SPAN_MS]) {
    const a = separationAt(referenceMs - spanMs, observer);
    const b = separationAt(referenceMs, observer);
    const c = separationAt(referenceMs + spanMs, observer);
    calls += 3;
    const ya = a.sepDeg * a.sepDeg;
    const yb = b.sepDeg * b.sepDeg;
    const yc = c.sepDeg * c.sepDeg;
    const curvature = ya - 2 * yb + yc;
    if (curvature <= 0) break;
    referenceMs += (-0.5 * (yc - ya) * spanMs) / curvature;
  }

  const before = sunHorizontalAt(referenceMs - RATE_SPAN_MS, observer);
  const after = sunHorizontalAt(referenceMs + RATE_SPAN_MS, observer);
  calls += 2;

  const seconds = (2 * RATE_SPAN_MS) / 1000;
  // L'azimut es desembolica abans de restar: al nord, 359,8° i 0,2° són dues
  // dècimes de diferència i no 359,6.
  let dAz = after.azimuthDeg - before.azimuthDeg;
  if (dAz > 180) dAz -= 360;
  if (dAz < -180) dAz += 360;

  return {
    eclipseId,
    atmosphere,
    referenceMs,
    sunAltRateDegPerSec: (after.altitudeTrueDeg - before.altitudeTrueDeg) / seconds,
    sunAzRateDegPerSec: dAz / seconds,
    ephemerisCalls: calls,
  };
}

/**
 * Fase central aproximada per a un punt, a partir de la referència.
 * Quatre crides a efemèrides. Cap cerca d'arrels.
 */
export function fastCentralPhase(
  location: GeoLocation,
  seed: CentralSeed,
): FastCentral {
  const observer = new Observer(location.lat, location.lon, location.elevation);
  const h = PARABOLA_SPAN_MS;

  const a = separationAt(seed.referenceMs - h, observer);
  const b = separationAt(seed.referenceMs, observer);
  const c = separationAt(seed.referenceMs + h, observer);

  const ya = a.sepDeg * a.sepDeg;
  const yb = b.sepDeg * b.sepDeg;
  const yc = c.sepDeg * c.sepDeg;
  const curvature = ya - 2 * yb + yc;

  const midMs =
    curvature > 0
      ? seed.referenceMs + (-0.5 * (yc - ya) * h) / curvature
      : seed.referenceMs;

  const at = separationAt(midMs, observer);
  const sun = sunHorizontalAt(midMs, observer);

  const limitDeg = Math.abs(at.sunRadiusDeg - at.moonRadiusDeg);
  const umbralMarginArcsec = (at.sepDeg - limitDeg) * 3600;

  // v² és el coeficient quadràtic de sep² expressat en graus² per ms².
  const vSquared = curvature / (2 * h * h);
  const inside = limitDeg * limitDeg - at.sepDeg * at.sepDeg;

  const centralSec =
    inside > 0 && vSquared > 0 ? (2 * Math.sqrt(inside / vSquared)) / 1000 : 0;

  return {
    midMs,
    centralSec,
    umbralMarginArcsec,
    sunAzimuthDeg: sun.azimuthDeg,
    sunAltitudeTrueDeg: sun.altitudeTrueDeg,
    sunAltitudeApparentDeg: applyRefraction(sun.altitudeTrueDeg, seed.atmosphere),
    ephemerisCalls: 5,
  };
}

/**
 * Posició del Sol a `offsetSec` del mig de la fase central, sense tornar a
 * cridar les efemèrides.
 *
 * L'altura GEOMÈTRICA s'extrapola linealment amb la velocitat de la referència,
 * i la refracció s'aplica DESPRÉS, al valor extrapolat. Fer-ho a l'inrevés
 * seria un error de debò: prop de l'horitzó la refracció comprimeix el
 * moviment aparent, i a 1,5° d'altura la velocitat aparent és un 20 % menor que
 * la geomètrica. Extrapolar l'altura aparent amb una velocitat constant
 * s'equivocaria en dècimes de grau just on cada centèsima decideix.
 */
export function sunTrackAt(
  seed: CentralSeed,
  central: FastCentral,
  offsetSec: number,
): { azimuthDeg: number; altitudeApparentDeg: number } {
  const trueAlt = central.sunAltitudeTrueDeg + seed.sunAltRateDegPerSec * offsetSec;
  return {
    azimuthDeg: central.sunAzimuthDeg + seed.sunAzRateDegPerSec * offsetSec,
    altitudeApparentDeg: applyRefraction(trueAlt, seed.atmosphere),
  };
}
