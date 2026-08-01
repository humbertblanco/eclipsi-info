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
 * Els valors que existeixen de debò, per poder-los reconèixer en temps
 * d'execució.
 *
 * PER QUÈ CAL RECONÈIXER-LOS. Aquests dos camps viatgen per `localStorage`, que
 * és de l'usuari i sobreviu a les versions de l'app. Comprovar només que són
 * text no serveix de res: la barra de la ubicació fa `ORIGIN_KEY[fix.origin]`, i
 * amb un origen que no existeix això dona `undefined`, la cerca del text peta, i
 * la barra viu FORA de l'`ErrorBoundary` — o sigui que se'n duu tota l'app. I
 * com que el valor es torna a llegir del disc a cada arrencada, se l'endú també
 * a la següent, i a la següent: pantalla blanca fins a buidar les dades del
 * navegador. El que no entenem es descarta i s'acaba aquí.
 *
 * SÓN TAULES `Record<…, true>` I NO LLISTES a posta: si algun dia s'afegeix un
 * valor a la unió i no s'afegeix aquí, això no compila. Una llista `string[]` no
 * ho hauria dit mai.
 */
const KNOWN_ORIGINS: Record<LocationOrigin, true> = {
  gps: true,
  map: true,
  search: true,
  recent: true,
  default: true,
};

const KNOWN_ELEVATION_SOURCES: Record<ElevationSource, true> = {
  dem: true,
  gps: true,
  assumed: true,
  pending: true,
};

/** Cert si el valor és un origen que aquesta versió sap dir en paraules. */
export function isLocationOrigin(value: unknown): value is LocationOrigin {
  return typeof value === 'string' && Object.hasOwn(KNOWN_ORIGINS, value);
}

/** Cert si el valor és una font d'altitud que aquesta versió sap interpretar. */
export function isElevationSource(value: unknown): value is ElevationSource {
  return typeof value === 'string' && Object.hasOwn(KNOWN_ELEVATION_SOURCES, value);
}

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
 * Ondulació del geoide que suposem sota tot el catàleg, en metres.
 *
 * LES DUES XIFRES QUE COMPAREM NO ES COMPTEN DES DE LA MATEIXA SUPERFÍCIE.
 * L'especificació del W3C diu que `coords.altitude` és l'altura sobre
 * l'EL·LIPSOIDE WGS84, i Android la dona tal com li arriba del xip. El model
 * digital del terreny és ortomètric, comptat des del geoide: a Barcelona-el
 * Prat el model dona 4,0 m i la cota topogràfica de la pista és de 4 m. Entre
 * les dues superfícies, a Ibèria, hi ha de +49 a +56 m (EGM2008) — que és
 * exactament la mida d'`ELEVATION_DISAGREEMENT_M`.
 *
 * D'ON SURT EL 52: és el mig d'aquest interval. ÉS UNA CONSTANT GROSSERA i cal
 * dir-ho: no interpolem cap malla del geoide. El residu que deixa dins de la
 * zona del catàleg és de ±4 m, quinze vegades per sota del llindar d'avís, o
 * sigui que per a l'única cosa que en fem —decidir si dues altituds discrepen
 * per damunt de 50 m— no cal res més fi. Fora d'Ibèria aquest número no val.
 */
export const GEOID_UNDULATION_M = 52;

/**
 * Cert quan l'altitud del GPS i la del model del terreny discrepen prou com
 * per haver-ho de dir. La que es fa servir per calcular és sempre la del model.
 *
 * ES MIRA AMB ELS DOS DATUMS PERQUÈ NO SABEM EN QUIN ENS PARLA EL NAVEGADOR.
 * A iOS, CoreLocation ja resta el geoide i el que arriba és ortomètric, o sigui
 * comparable amb el model. A Android arriba sobre l'el·lipsoide i li falta
 * restar l'ondulació. No hi ha cap manera honesta de saber-ho des d'aquí: la
 * mateixa propietat, el mateix tipus i cap camp que ho digui. Comparar en cru
 * feia sortir l'avís a mig Android d'Ibèria sense que passés res —el sol
 * desnivell de datum ja passa el llindar—, i restar sempre l'hauria fet sortir
 * a tots els iPhone. Per això només es crida quan les dues xifres discrepen
 * LLEGIDES DE LES DUES MANERES.
 *
 * EL PREU ÉS UNA ZONA CEGA: una altitud del GPS entre 50 i 102 m per damunt del
 * terreny no s'avisa, perquè llegida com a el·lipsoïdal quadraria. Val la pena:
 * el que hi havia abans era un avís que sortia gairebé la meitat de les vegades
 * sense cap motiu, i això és el llop que el llindar de dalt existeix per no
 * cridar. Un avís que surt per res deixa de llegir-se, i llavors tampoc no
 * serveix el dia que és bo.
 */
export function elevationDisagrees(fix: FixedLocation): boolean {
  if (fix.gpsElevationM === null) return false;
  if (fix.elevationSource !== 'dem') return false;
  const asOrthometric = Math.abs(fix.gpsElevationM - fix.location.elevation);
  const asEllipsoidal = Math.abs(
    fix.gpsElevationM - GEOID_UNDULATION_M - fix.location.elevation,
  );
  return Math.min(asOrthometric, asEllipsoidal) > ELEVATION_DISAGREEMENT_M;
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
