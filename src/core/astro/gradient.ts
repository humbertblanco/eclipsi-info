/**
 * Quant guanyes si et mous.
 *
 * PER QUÈ EXISTEIX AQUEST MÒDUL. La pregunta que es fa qualsevol que mira un
 * mapa d'eclipsi no és "quants segons duraré" sinó "val la pena que em mogui?".
 * I la resposta canvia brutalment segons on siguis: al mig de la franja,
 * caminar un quilòmetre no et dona ni un segon; a tres quilòmetres del límit,
 * el mateix quilòmetre te'n pot donar quinze. La gent que decideix malament ho
 * fa gairebé sempre a la segona situació.
 *
 * COM ES CALCULA. La durada de la fase central és un camp escalar sobre el
 * territori, i el que volem és el seu gradient. S'avalua a quatre punts al
 * voltant de l'observador i se'n fa la diferència centrada.
 *
 * Té una propietat que ens va molt bé i que no cal calcular a part: com que la
 * durada és pràcticament constant al llarg de la franja i només canvia en
 * travessar-la, **el gradient apunta sol cap a la línia central**. No cal
 * saber la geometria de la franja per dir cap a on s'ha d'anar: surt de la
 * mesura.
 *
 * COST. Quatre avaluacions de circumstàncies locals, unes desenes de
 * mil·lisegons. Es pot cridar cada cop que canvia la ubicació.
 */

import { computeLocalCircumstances } from './contacts';
import { STANDARD_ATMOSPHERE } from './constants';
import type { Atmosphere, GeoLocation } from './types';

const KM_PER_DEG_LAT = 111.32;
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Distància a la qual es prenen les mostres per a la diferència centrada. */
const STEP_KM = 1;

export interface DurationGradient {
  /** Durada de la fase central al punt de l'observador, en segons. */
  centralSec: number;
  /**
   * Guany màxim en segons per quilòmetre. Zero o negatiu vol dir que ja ets on
   * has de ser, o que des d'aquí no hi ha fase central en cap direcció propera.
   */
  secondsPerKm: number;
  /**
   * Rumb cap on cal moure's per guanyar temps, en graus (0 = nord).
   * Null quan el gradient és massa petit per tenir direcció significativa.
   */
  bearingDeg: number | null;
  /**
   * Cert quan el gradient és prou fort perquè valgui la pena dir-ho.
   *
   * Al mig de la franja el gradient és de dècimes de segon per quilòmetre:
   * ensenyar-ho seria soroll i faria moure gent sense motiu.
   */
  worthMoving: boolean;
  /**
   * Estimació de quants quilòmetres caldria fer per arribar al màxim de
   * durada, seguint el rumb. Null si el gradient no permet extrapolar.
   *
   * COMPTE: és una extrapolació lineal d'una funció que no ho és. Serveix per
   * dir "uns deu quilòmetres", mai per donar una xifra exacta.
   */
  approxKmToBest: number | null;
  /** Durada estimada al punt òptim, en segons. */
  approxBestSec: number | null;
}

/** Llindar a partir del qual val la pena suggerir un desplaçament. */
const WORTH_MOVING_SEC_PER_KM = 1.5;

function offsetLocation(
  base: GeoLocation,
  northKm: number,
  eastKm: number,
): GeoLocation {
  const kmPerDegLon = KM_PER_DEG_LAT * Math.cos(base.lat * DEG);
  return {
    lat: base.lat + northKm / KM_PER_DEG_LAT,
    lon: base.lon + (kmPerDegLon > 1e-6 ? eastKm / kmPerDegLon : 0),
    // L'altitud es manté: aquí ens interessa l'efecte de moure's per la
    // GEOMETRIA de la franja, no el d'enfilar-se. Guanyar altura és una altra
    // palanca i la tracta el veredicte d'horitzó.
    elevation: base.elevation,
  };
}

function centralDurationAt(
  eclipseId: string,
  location: GeoLocation,
  atmosphere: Atmosphere,
): number {
  return computeLocalCircumstances(eclipseId, location, atmosphere).centralDurationSec;
}

export function computeDurationGradient(
  eclipseId: string,
  location: GeoLocation,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): DurationGradient {
  const here = computeLocalCircumstances(eclipseId, location, atmosphere);
  const centralSec = here.centralDurationSec;

  const north = centralDurationAt(eclipseId, offsetLocation(location, STEP_KM, 0), atmosphere);
  const south = centralDurationAt(eclipseId, offsetLocation(location, -STEP_KM, 0), atmosphere);
  const east = centralDurationAt(eclipseId, offsetLocation(location, 0, STEP_KM), atmosphere);
  const west = centralDurationAt(eclipseId, offsetLocation(location, 0, -STEP_KM), atmosphere);

  // Diferència centrada: (f(x+h) − f(x−h)) / 2h.
  const dNorth = (north - south) / (2 * STEP_KM);
  const dEast = (east - west) / (2 * STEP_KM);

  const magnitude = Math.hypot(dNorth, dEast);

  if (magnitude < 1e-3) {
    return {
      centralSec,
      secondsPerKm: 0,
      bearingDeg: null,
      worthMoving: false,
      approxKmToBest: null,
      approxBestSec: null,
    };
  }

  const bearing = (Math.atan2(dEast, dNorth) * RAD + 360) % 360;

  // Extrapolació fins al màxim, amb la segona derivada estimada al llarg del
  // gradient. Si la corba no és còncava, no s'extrapola res.
  const secondDerivative =
    (north + south - 2 * centralSec) / (STEP_KM * STEP_KM) +
    (east + west - 2 * centralSec) / (STEP_KM * STEP_KM);

  let approxKmToBest: number | null = null;
  let approxBestSec: number | null = null;
  if (secondDerivative < -1e-6) {
    const km = magnitude / -secondDerivative;
    // Més enllà d'uns quants centenars de quilòmetres l'extrapolació lineal ja
    // no vol dir res: la franja fa 290 km d'ample.
    if (km > 0 && km < 400) {
      approxKmToBest = km;
      approxBestSec = centralSec + (magnitude * km) / 2;
    }
  }

  return {
    centralSec,
    secondsPerKm: magnitude,
    bearingDeg: bearing,
    worthMoving: magnitude >= WORTH_MOVING_SEC_PER_KM,
    approxKmToBest,
    approxBestSec,
  };
}

/** Rumb a text, per a la interfície. */
export function bearingToCardinal(bearing: number, locale: 'ca' | 'es' | 'en' | 'fr' = 'ca'): string {
  const names = locale === 'ca'
    ? ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-oest', 'oest', 'nord-oest']
    : locale === 'es'
      ? ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste']
      : locale === 'en'
        ? ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']
        : ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
  const index = Math.round(((bearing % 360) + 360) % 360 / 45) % 8;
  return names[index];
}
