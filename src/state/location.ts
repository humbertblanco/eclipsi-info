/**
 * El model de la ubicació: què és un lloc triat i d'on ha sortit.
 *
 * PER QUÈ AIXÒ ÉS UN MÒDUL I NO TRES CAMPS DINS D'UN HOOK. Tot el que diu
 * aquesta app depèn del punt: l'hora dels contactes, l'azimut, l'altura del
 * Sol, si el terreny et tapa i si ets dins o fora de la franja. Cinc
 * quilòmetres canvien el veredicte. Per tant la pregunta «d'on ha sortit
 * aquest punt» no és metadada: és tan important com les coordenades, i ha de
 * viatjar SEMPRE enganxada a elles. Si viatgés per separat, hi hauria un
 * moment en què la pantalla ensenya xifres d'un lloc i l'etiqueta d'un altre,
 * que és exactament el problema que aquest mòdul existeix per evitar.
 *
 * Aquí no hi ha React ni DOM: només el model i les regles. La persistència és
 * a `recentPlaces.ts` i la interfície a `src/features/location/`.
 */

import type { GeoLocation } from '../core/astro/types';

/** D'on han sortit les coordenades que s'estan fent servir ara mateix. */
export type LocationOrigin =
  /** Del GPS del dispositiu. */
  | 'gps'
  /** L'usuari ha tocat un punt del mapa. */
  | 'map'
  /** L'usuari ha triat un resultat de la cerca per nom. */
  | 'search'
  /** L'usuari l'ha repescat de l'historial. */
  | 'recent'
  /**
   * Cap de les anteriors: el punt d'exemple amb què arrenca l'app.
   *
   * Aquest valor obliga la interfície a dir-ho. Abans l'app arrencava sobre la
   * línia central a Astúries sense distingir-ho de res, i es podia estar una
   * estona mirant hores i durades d'un lloc on no hi seràs mai.
   */
  | 'default';

/** D'on surt l'altitud. La bona és sempre `dem`. */
/**
 * D'on surt l'altitud del punt.
 *
 *  - `dem`      del model digital del terreny. És l'única bona: el GPS té
 *               ±10-30 m d'error vertical i trenta metres canvien el veredicte
 *               d'horitzó.
 *  - `gps`      del GPS, quan encara no tenim la tessel·la. S'ha de dir.
 *  - `assumed`  no la sabem i s'ha posat zero.
 *  - `pending`  el punt ja és fix però la tessel·la encara està de camí. La
 *               posició horitzontal SÍ que és bona, i és la que mana a totes
 *               les xifres tret del veredicte d'horitzó.
 */
export type ElevationSource = 'dem' | 'gps' | 'assumed' | 'pending';

/**
 * Un punt fixat, amb tot el que cal per poder-ne respondre «i això d'on surt?».
 */
export interface FixedLocation {
  location: GeoLocation;
  origin: LocationOrigin;
  /**
   * Nom del lloc quan es coneix. És `null` mentre no s'ha resolt o quan no es
   * pot resoldre: els noms depenen de la xarxa i les coordenades no.
   */
  label: string | null;
  /** Precisió horitzontal declarada pel GPS, en metres. Null si no ve del GPS. */
  accuracyM: number | null;
  elevationSource: ElevationSource;
  /**
   * Altitud que deia el GPS, si en deia alguna. NO s'utilitza mai per calcular:
   * es guarda només per poder avisar quan discrepa molt del model del terreny.
   */
  gpsElevationM: number | null;
  /** Quan es va fixar aquest punt, en ms d'època. */
  atMs: number;
  /**
   * Cert quan el punt ve d'una sessió anterior i no d'un gest d'ara.
   *
   * Recuperar l'últim lloc en obrir l'app és còmode i alhora és exactament la
   * manera de tornar a mirar xifres d'un altre lloc sense adonar-se'n. Es
   * recupera, però es diu.
   */
  restored: boolean;
}

/**
 * Punt d'exemple mentre l'usuari no en tria cap: la línia central a Astúries
 * el 12 d'agost de 2026.
 *
 * L'altitud es deixa a zero A PROPÒSIT i es resol contra el model del terreny
 * abans de fer-la servir. Escriure-hi un valor a mà sembla inofensiu i no ho
 * és: el perfil d'horitzó compara l'altura de l'observador amb la del terreny
 * del MATEIX model, i si les dues xifres vénen de fonts diferents, cada raig
 * «veu» terreny per damunt seu des del primer metre. Deu metres de discrepància
 * a cinquanta metres de distància són onze graus d'horitzó fals, que es menja
 * qualsevol eclipsi amb el Sol baix.
 */
export const DEFAULT_LOCATION: GeoLocation = {
  lat: 43.3619,
  lon: -5.8494,
  elevation: 0,
};

/**
 * Discrepància d'altitud a partir de la qual s'avisa, en metres.
 *
 * D'ON SURT EL 50. Els dos números tenen error i tots dos són coneguts:
 * l'altitud vertical d'un GPS de mòbil té ±10 a ±30 m, i les tessel·les
 * terrarium a zoom 12 tenen ~30 m de resolució horitzontal, cosa que en un
 * pendent del 30 % dona ±9 m de vertical. Sumant en quadratura, la discrepància
 * NORMAL entre les dues xifres és d'uns √(30² + 10²) ≈ 32 m. Per sota d'això no
 * hi ha res a dir: és el soroll esperat i avisar-ne seria cridar el llop.
 *
 * Per damunt de 50 m ja no és soroll de sensor. Vol dir una de tres: ets dins
 * d'un edifici alt, el GPS ha agafat una posició dolenta, o el model del
 * terreny no té la teva vall. Les tres canvien el veredicte i s'han de dir.
 *
 * QUÈ HI HA EN JOC: 50 m de diferència d'altura sobre un obstacle a 1 km són
 * 2,9° d'horitzó, i el 12 d'agost de 2026 la totalitat a Espanya passa amb el
 * Sol entre 12° i 1° sobre l'horitzó. Tres graus, allà, són tot l'eclipsi.
 */
export const ELEVATION_DISAGREEMENT_M = 50;

/**
 * Cert quan l'altitud del GPS i la del model del terreny discrepen prou com
 * per haver-ho de dir. La que es fa servir per calcular és sempre la del model.
 */
export function elevationDisagrees(fix: FixedLocation): boolean {
  if (fix.gpsElevationM === null) return false;
  if (fix.elevationSource !== 'dem') return false;
  return Math.abs(fix.gpsElevationM - fix.location.elevation) > ELEVATION_DISAGREEMENT_M;
}

/**
 * Cert quan les xifres que es veuen NO són del lloc de l'usuari i cal dir-ho
 * amb totes les lletres, no amb un matís.
 */
export function isPlaceholder(fix: FixedLocation | null): boolean {
  return fix === null || fix.origin === 'default';
}

/**
 * Radi per sota del qual dos punts són el mateix lloc, en metres.
 *
 * D'ON SURT EL 150. El pendent més fort de la durada de la fase central que es
 * troba de veritat és d'uns 15 s/km, i només passa arran del límit de la
 * franja; al mig no arriba ni a 1 s/km. A 15 s/km, 150 m són 2,3 s de
 * diferència, i la incertesa de les efemèrides sobre qualsevol hora de
 * contacte ja és de ±3,4 s el 2026 (±4,3 s el 2027, ±4,7 s el 2028; vegeu
 * `core/astro/uncertainty.ts`). O sigui que dos punts a menys de 150 m no els
 * podem distingir honestament ni en el pitjor cas, i guardar-los com a dues
 * entrades diferents de l'historial seria fingir una precisió que no tenim.
 */
export const SAME_PLACE_M = 150;

const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;

/**
 * Distància entre dos punts sobre l'esfera, en metres.
 *
 * Fórmula de l'haversine. A les distàncies d'aquesta app (de metres a centenars
 * de quilòmetres) l'error d'assumir esfera en comptes d'el·lipsoide és del
 * 0,3 %, i cap decisió del producte no en depèn: la diferència entre 12,0 i
 * 12,04 km no canvia si val la pena moure's.
 */
export function distanceM(a: GeoLocation, b: GeoLocation): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const sLat = Math.sin(dLat / 2);
  const sLon = Math.sin(dLon / 2);
  const h =
    sLat * sLat + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * sLon * sLon;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cert quan dos punts són, a efectes d'aquesta app, el mateix lloc. */
export function isSamePlace(a: GeoLocation, b: GeoLocation): boolean {
  return distanceM(a, b) < SAME_PLACE_M;
}
