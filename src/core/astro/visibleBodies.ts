/**
 * Planetes i estrelles brillants visibles durant la totalitat.
 *
 * Durant els dos minuts de totalitat el cel s'enfosqueix prou perquè surtin
 * els planetes. És una de les coses que la gent que hi ha estat recorda, i una
 * de les que més es perden per no saber on mirar: amb un minut i mig de temps
 * no hi ha marge per buscar res a l'atzar.
 *
 * Per als eclipsis espanyols val la pena saber que Venus i Mercuri sempre
 * queden a prop del Sol —són planetes interiors— i per tant surten dins del
 * mateix tros de cel que ja estàs mirant.
 */

import * as AstronomyNs from 'astronomy-engine';
import { applyRefraction } from './refraction';
import { STANDARD_ATMOSPHERE } from './constants';
import type { Atmosphere, GeoLocation } from './types';

const Astronomy = ((AstronomyNs as unknown as { default?: typeof AstronomyNs })
  .default ?? AstronomyNs) as typeof AstronomyNs;

const { Body, Equator, Horizon, Observer, Illumination } = Astronomy;

export interface VisibleBody {
  name: string;
  azimuth: number;
  altitude: number;
  /** Magnitud aparent. Com més petita, més brillant. */
  magnitude: number;
}

/** Els que de veritat es poden veure a ull nu en un cel de totalitat. */
const CANDIDATES = [
  { body: Body.Venus, name: 'Venus' },
  { body: Body.Jupiter, name: 'Júpiter' },
  { body: Body.Mercury, name: 'Mercuri' },
  { body: Body.Mars, name: 'Mart' },
  { body: Body.Saturn, name: 'Saturn' },
] as const;

/**
 * Límit de magnitud durant la totalitat.
 *
 * El cel d'una totalitat s'assembla al crepuscle nàutic, no a la nit tancada:
 * s'hi veuen els planetes brillants i poca cosa més. Posar-hi estrelles de
 * magnitud 3 seria mentir a l'usuari i fer-lo buscar el que no hi trobarà.
 */
const MAGNITUDE_LIMIT = 2.2;

export function visibleBodiesDuringTotality(
  time: Date,
  location: GeoLocation,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): VisibleBody[] {
  const observer = new Observer(location.lat, location.lon, location.elevation);
  const out: VisibleBody[] = [];

  for (const candidate of CANDIDATES) {
    const eq = Equator(candidate.body, time, observer, true, true);
    const hor = Horizon(time, observer, eq.ra, eq.dec, undefined);

    // Per sota de l'horitzó no hi és, i molt arran tampoc no es veurà amb
    // l'extinció que hi ha a un grau d'altura.
    if (hor.altitude < 1) continue;

    const magnitude = Illumination(candidate.body, time).mag;
    if (magnitude > MAGNITUDE_LIMIT) continue;

    out.push({
      name: candidate.name,
      azimuth: hor.azimuth,
      altitude: applyRefraction(hor.altitude, atmosphere),
      magnitude,
    });
  }

  return out.sort((a, b) => a.magnitude - b.magnitude);
}
