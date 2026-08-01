/** Tipus compartits del nucli astronòmic. */

export interface GeoLocation {
  /** Latitud en graus, positiva al nord. */
  lat: number;
  /** Longitud en graus, positiva a l'est. */
  lon: number;
  /**
   * Altitud sobre el nivell del mar en metres.
   *
   * IMPORTANT: no s'ha d'omplir mai amb l'altitud del GPS (±10-30 m d'error
   * vertical). S'ha d'agafar del model digital del terreny a partir de
   * (lat, lon), que és molt més fiable. 30 m d'error en altitud desplacen
   * l'horitzó visible prou com per canviar el veredicte de visibilitat.
   */
  elevation: number;
}

export interface Atmosphere {
  pressureMb: number;
  temperatureC: number;
}

/** Posició d'un astre al cel local. */
export interface SkyPosition {
  /** Azimut en graus: 0 = nord, 90 = est, 180 = sud, 270 = oest. */
  azimuth: number;
  /** Altura geomètrica sobre l'horitzó, en graus, sense refracció. */
  altitudeTrue: number;
  /**
   * Altura aparent, amb refracció atmosfèrica aplicada.
   * Aquesta és la que s'ha de comparar amb el perfil d'horitzó i la que
   * s'ha de dibuixar a la vista de realitat augmentada.
   */
  altitudeApparent: number;
  /** Ascensió recta topocèntrica, en hores. */
  ra: number;
  /** Declinació topocèntrica, en graus. */
  dec: number;
  /** Distància a l'observador, en UA. */
  distanceAu: number;
  /** Radi angular aparent, en graus. */
  angularRadius: number;
}

/** Estat complet de l'eclipsi en un instant, per a un lloc concret. */
export interface EclipseSample {
  time: Date;
  sun: SkyPosition;
  moon: SkyPosition;
  /** Separació angular entre els centres dels dos discos, en graus. */
  separation: number;
  /**
   * Magnitud: fracció del DIÀMETRE solar coberta.
   * >= 1 vol dir que el disc lunar cobreix tot el diàmetre del Sol.
   */
  magnitude: number;
  /** Obscuració: fracció de l'ÀREA del disc solar coberta, de 0 a 1. */
  obscuration: number;
}

export type EclipseKind = 'none' | 'partial' | 'annular' | 'total';

/** Els cinc instants clàssics d'un eclipsi solar vist des d'un lloc. */
export interface Contacts {
  /** Primer contacte: comença la fase parcial. */
  c1?: EclipseSample;
  /** Segon contacte: comença la totalitat o l'anularitat. */
  c2?: EclipseSample;
  /** Màxim de l'eclipsi (magnitud màxima). Sempre existeix si hi ha eclipsi. */
  max: EclipseSample;
  /** Tercer contacte: acaba la totalitat o l'anularitat. */
  c3?: EclipseSample;
  /** Quart contacte: acaba la fase parcial. */
  c4?: EclipseSample;
}

export interface LocalCircumstances {
  eclipseId: string;
  location: GeoLocation;
  atmosphere: Atmosphere;
  kind: EclipseKind;
  contacts: Contacts;
  /** Durada de la fase central (totalitat o anularitat) en segons. */
  centralDurationSec: number;
  /** Durada total de l'eclipsi (C1 a C4) en segons. */
  partialDurationSec: number;
  /**
   * Cert si alguna de les fases passa amb el Sol per sota de l'horitzó
   * astronòmic. No té en compte el terreny: això ho fa el mòdul de visibilitat.
   */
  sunBelowHorizonDuringEvent: boolean;

  /**
   * Marge umbral al màxim, en segons d'arc.
   *
   * És la distància que et separa de la fase central: negatiu vol dir que hi
   * ets a dins, positiu que en quedes fora. Zero és exactament el límit de la
   * franja.
   */
  umbralMarginArcsec: number;

  /**
   * Cert quan el marge umbral és més petit que l'error de les efemèrides i,
   * per tant, NO podem decidir honestament si hi haurà fase central.
   *
   * Això no és una excusa: està mesurat. L'error de posició relativa
   * Sol-Lluna d'`astronomy-engine` és d'uns 1,5″, i als municipis del caire de
   * la franja el marge que separa veure la totalitat de no veure-la és de
   * 0,13″ a 0,22″. Estem deu vegades per sota de la resolució que caldria.
   *
   * En aquesta franja de dos o tres quilòmetres a cada vora, la interfície ha
   * de dir que la resposta és incerta i aconsellar moure's cap endins, en
   * comptes de donar un sí o un no que no ens podem permetre. Un "no" fals fa
   * que algú no vagi; un "sí" fals fa que algú es planti al lloc equivocat.
   */
  edgeUncertain: boolean;
}
