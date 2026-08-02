/**
 * Efemèrides topocèntriques del Sol i la Lluna.
 *
 * TOPOCÈNTRIQUES, no geocèntriques: la paral·laxi lunar val gairebé 1°, que és
 * el doble del diàmetre aparent del Sol. Calcular un eclipsi amb posicions
 * geocèntriques desplaça les hores de contacte desenes de minuts i pot
 * convertir una totalitat en una parcial. `Astronomy.Equator` amb un observador
 * i `ofdate = true` ja fa la correcció.
 */

// `astronomy-engine` declara una build ESM dins d'un paquet sense
// `"type": "module"`. El resultat és que Node en carrega la versió CommonJS i
// ens arriba embolcallada dins de `.default`, mentre que Vite en carrega la
// ESM de veritat i ens la dona plana. Sense aquest desembolcall el motor
// funciona al navegador però peta als tests, que és el pitjor dels dos mons.
import * as AstronomyNs from 'astronomy-engine';

const Astronomy = ((AstronomyNs as unknown as { default?: typeof AstronomyNs })
  .default ?? AstronomyNs) as typeof AstronomyNs;

const { Body, Equator, Horizon, Observer } = Astronomy;

// Els noms desestructurats són valors, no tipus: els tipus s'han de prendre
// del namespace original.
type Observer = AstronomyNs.Observer;
type EquatorialCoordinates = AstronomyNs.EquatorialCoordinates;

import {
  AU_KM,
  EARTH_EQUATORIAL_RADIUS_KM,
  MOON_RADIUS_RATIO_PENUMBRAL,
  MOON_RADIUS_RATIO_UMBRAL,
  RAD,
  STANDARD_ATMOSPHERE,
  SUN_RADIUS_ARCSEC_AT_1AU,
} from './constants';
import { installDeltaT } from './deltaT';

// Estat global de la biblioteca: s'ha d'instal·lar abans de qualsevol càlcul.
// El polinomi que porta per defecte és del 2006 i extrapola sis segons de més
// per al 2026, cosa que desplaça totes les hores de contacte.
installDeltaT();
import { applyRefraction } from './refraction';
import { angularSeparation, eclipseMagnitude, eclipseObscuration } from './geometry';
import type { Atmosphere, EclipseSample, GeoLocation, SkyPosition } from './types';

function toObserver(location: GeoLocation): Observer {
  return new Observer(location.lat, location.lon, location.elevation);
}

/** Radi angular aparent del Sol, en graus, per a una distància donada en UA. */
export function sunAngularRadius(distanceAu: number): number {
  return SUN_RADIUS_ARCSEC_AT_1AU / distanceAu / 3600;
}

/**
 * Radi angular aparent de la Lluna, en graus.
 *
 * El paràmetre `k` no és únic: els contactes umbrals (C2/C3) en volen un de
 * més petit que els penombrals (C1/C4). Vegeu la nota a `constants.ts` — no és
 * un detall, són desenes de segons de durada de totalitat.
 *
 * SENSE VALOR PER DEFECTE, a posta: triar el k ÉS la decisió, i el valor
 * «mitjà» que hi havia aquí va fer que magnitud i veredicte es contradiguessin
 * al caire de la franja (vegeu constants.ts).
 */
export function moonAngularRadius(distanceAu: number, k: number): number {
  const distanceKm = distanceAu * AU_KM;
  return Math.asin((k * EARTH_EQUATORIAL_RADIUS_KM) / distanceKm) * RAD;
}

function toSkyPosition(
  eq: EquatorialCoordinates,
  time: Date,
  observer: Observer,
  angularRadius: number,
  atmosphere: Atmosphere,
): SkyPosition {
  // Demanem l'horitzontal SENSE refracció (la seva opció 'normal' l'aplicaria
  // amb una atmosfera fixa) perquè volem controlar nosaltres el model i
  // poder-hi passar la pressió i la temperatura reals del dia. Ometent el
  // paràmetre, la llibreria no aplica cap correcció.
  const hor = Horizon(time, observer, eq.ra, eq.dec, undefined);

  return {
    azimuth: hor.azimuth,
    altitudeTrue: hor.altitude,
    altitudeApparent: applyRefraction(hor.altitude, atmosphere),
    ra: eq.ra,
    dec: eq.dec,
    distanceAu: eq.dist,
    angularRadius,
  };
}

/**
 * Estat complet de l'eclipsi en un instant per a un lloc.
 * Aquesta és la funció que es crida milers de vegades: tot el que és car
 * (cerca d'arrels, render de la simulació) hi passa per sobre.
 */
export function sampleAt(
  time: Date,
  location: GeoLocation,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): EclipseSample {
  const observer = toObserver(location);

  const sunEq = Equator(Body.Sun, time, observer, true, true);
  const moonEq = Equator(Body.Moon, time, observer, true, true);

  const sunRadius = sunAngularRadius(sunEq.dist);
  // El radi UMBRAL, el mateix que decideix on són C2 i C3: així la magnitud,
  // l'obscuració i el disc que es dibuixa no poden contradir mai el `kind`
  // que surt dels contactes. Amb el penombral d'abans, al caire de la franja
  // la fitxa deia «Parcial · magnitud 1,034».
  const moonRadius = moonAngularRadius(moonEq.dist, MOON_RADIUS_RATIO_UMBRAL);

  const separation = angularSeparation(sunEq.ra, sunEq.dec, moonEq.ra, moonEq.dec);

  return {
    time,
    sun: toSkyPosition(sunEq, time, observer, sunRadius, atmosphere),
    moon: toSkyPosition(moonEq, time, observer, moonRadius, atmosphere),
    separation,
    magnitude: eclipseMagnitude(separation, sunRadius, moonRadius),
    obscuration: eclipseObscuration(separation, sunRadius, moonRadius),
  };
}

/**
 * Només la separació menys el llindar donat. És el que consumeix la cerca
 * d'arrels, i evita construir l'objecte `EclipseSample` sencer a cada
 * iteració.
 *
 * @param inner si és cert, el llindar és |Rs - Rm| (contactes C2/C3);
 *              si no, Rs + Rm (contactes C1/C4)
 */
export function separationMinusLimit(
  timeMs: number,
  location: GeoLocation,
  inner: boolean,
): number {
  const observer = toObserver(location);
  const time = new Date(timeMs);

  const sunEq = Equator(Body.Sun, time, observer, true, true);
  const moonEq = Equator(Body.Moon, time, observer, true, true);

  const sunRadius = sunAngularRadius(sunEq.dist);
  const separation = angularSeparation(sunEq.ra, sunEq.dec, moonEq.ra, moonEq.dec);

  // Cada família de contactes vol el seu `k`. Amb el valor equivocat als
  // contactes umbrals, la totalitat s'allarga fins a 23 s al caire de la
  // franja, que és on més mal fa.
  const moonRadius = moonAngularRadius(
    moonEq.dist,
    inner ? MOON_RADIUS_RATIO_UMBRAL : MOON_RADIUS_RATIO_PENUMBRAL,
  );

  const limit = inner
    ? Math.abs(sunRadius - moonRadius)
    : sunRadius + moonRadius;

  return separation - limit;
}
