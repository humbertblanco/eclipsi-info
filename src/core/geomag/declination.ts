/**
 * Declinació magnètica: el pont entre el que diu la brúixola i el que calcula
 * l'astronomia.
 *
 * LA PREGUNTA QUE AQUEST FITXER CONTESTA, i que es respon malament a mig
 * internet: el rumb que dona el navegador, ¿és nord magnètic o nord geogràfic?
 *
 * ÉS MAGNÈTIC. Als dos sistemes. Verificat al codi font, no per rumors:
 *
 *  - iOS. `webkitCompassHeading` surt de WebCoreMotionManager.mm, que fa
 *    `heading = newHeading.magneticHeading`. La cadena és
 *    WebCoreMotionManager → DeviceOrientationClientIOS::orientationChanged →
 *    WebDeviceOrientationUpdateProviderProxy (el camí de WebKit2, o sigui
 *    Safari i tots els WKWebView) → l'atribut IDL `webkitCompassHeading`. La
 *    propietat `trueHeading` de CoreLocation, que sí que porta la declinació
 *    aplicada, NO apareix enlloc del codi de producció de WebKit.
 *    https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/WebCoreMotionManager.mm
 *
 *  - Android. Chromium serveix `deviceorientationabsolute` des de
 *    ABSOLUTE_ORIENTATION_QUATERNION, que és TYPE_ROTATION_VECTOR, i la
 *    documentació d'Android diu explícitament que l'eix Y d'aquest sensor
 *    apunta al nord MAGNÈTIC. Per això Android publica
 *    `android.hardware.GeomagneticField` — una implementació del WMM — perquè
 *    sigui l'aplicació qui faci la conversió.
 *
 * CONSEQÜÈNCIA DE DISSENY. La correcció és la mateixa als dos sistemes:
 * azimut geogràfic = rumb del sensor + declinació. Res de branques per
 * plataforma, que és justament on s'amaguen els errors de signe. Si algú algun
 * dia "arregla" això aplicant-la només a Android, la superposició es
 * desplaçarà el doble de la declinació a iOS, que a Canàries són set graus.
 *
 * AVÍS DE L'ESPECIFICACIÓ. El W3C NO diu quin nord és el marc absolut de
 * `deviceorientationabsolute`: parla del "sistema de referència de la Terra" i
 * prou. O sigui que això és comportament d'implementació, no garantia. Totes
 * les implementacions actuals fan servir nord magnètic, però convé un test de
 * regressió amb dispositiu real abans de cada publicació gran.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import type { GeoLocation } from '../astro/types';
import { magneticField, decimalYear } from './wmm';
import { WMM_VALID_FROM, WMM_VALID_TO } from './wmm2025';

export type DeclinationStatus =
  /** Dins la validesa del model. */
  | 'ok'
  /** Fora de la finestra de validesa: el número és una extrapolació. */
  | 'expired'
  /** No s'ha pogut calcular. La correcció que s'ha d'aplicar és zero. */
  | 'unavailable';

export interface DeclinationResult {
  /** Graus a SUMAR al rumb magnètic per obtenir l'azimut geogràfic. */
  declinationDeg: number;
  status: DeclinationStatus;
  /** Intensitat horitzontal del camp, en nT. Serveix per acotar el soroll. */
  horizontalNt: number;
  /**
   * Soroll de rumb, en graus, que un magnetòmetre de mòbil hi aporta com a
   * terra irreductible en aquest lloc.
   *
   * Els magnetòmetres de mòbil estan dominats per soroll blanc d'uns ±200 nT
   * RMS. El rumb surt d'un arctangent sobre la component HORITZONTAL, així que
   * el soroll angular és atan(200 nT / H). A latituds mitjanes, amb H ≈ 25 µT,
   * són uns 0,46°. És la xifra que diu que cap filtre no farà miracles: el Sol
   * fa 0,53° de diàmetre.
   */
  headingNoiseFloorDeg: number;
}

/** Soroll RMS típic d'un magnetòmetre de mòbil, en nT. */
const MAGNETOMETER_RMS_NT = 200;

/** Resultat quan no es pot calcular res: correcció zero i dit clarament. */
export const MAGNETIC_DECLINATION_UNAVAILABLE: DeclinationResult = {
  declinationDeg: 0,
  status: 'unavailable',
  horizontalNt: 0,
  headingNoiseFloorDeg: 0,
};

/**
 * Declinació magnètica en un punt i una data.
 *
 * Mai llança. Una posició dolenta o una data absurda han de degradar la
 * superposició, no fer caure la vista de càmera: l'usuari és a fora, al
 * capvespre, i l'aplicació ha de seguir dibuixant encara que la brúixola no
 * serveixi.
 */
export function declination(
  location: Pick<GeoLocation, 'lat' | 'lon'> & { elevation?: number },
  date: Date = new Date(),
): DeclinationResult {
  const { lat, lon } = location;
  const elevation = location.elevation ?? 0;

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    !Number.isFinite(date.getTime())
  ) {
    return MAGNETIC_DECLINATION_UNAVAILABLE;
  }

  const field = magneticField(lat, lon, Number.isFinite(elevation) ? elevation : 0, date);
  if (!Number.isFinite(field.declinationDeg)) return MAGNETIC_DECLINATION_UNAVAILABLE;

  const year = decimalYear(date);
  const status: DeclinationStatus =
    year >= WMM_VALID_FROM && year <= WMM_VALID_TO ? 'ok' : 'expired';

  const h = Math.max(1, field.horizontalNt);

  return {
    declinationDeg: field.declinationDeg,
    status,
    horizontalNt: field.horizontalNt,
    headingNoiseFloorDeg: (Math.atan(MAGNETOMETER_RMS_NT / h) * 180) / Math.PI,
  };
}

/**
 * Aplica la declinació a un rumb magnètic i normalitza a [0, 360).
 *
 * S'ha de cridar UN sol cop per lectura. Aplicar-la dues vegades és pitjor que
 * no aplicar-la: l'error es duplica en comptes d'anul·lar-se.
 *
 * COMPTE: això espera un RUMB. No s'ha d'aplicar mai a l'`alpha` de
 * `deviceorientation`, que va en sentit contrari. Vegeu `trueAzimuth`.
 */
export function magneticToTrueHeading(
  magneticHeadingDeg: number,
  declinationDeg: number,
): number {
  return ((magneticHeadingDeg + declinationDeg) % 360 + 360) % 360;
}

/**
 * Passa l'azimut cap on apunta la càmera de magnètic a geogràfic.
 *
 * ÉS LA FUNCIÓ QUE S'HA DE FER SERVIR A LA VISTA DE REALITAT AUGMENTADA, i
 * existeix per evitar una trampa de signe que duplicaria l'error en comptes
 * d'eliminar-lo.
 *
 * LA TRAMPA. A iOS, el rumb magnètic arriba com a `webkitCompassHeading` i el
 * codi de sensors el converteix a l'`alpha` equivalent amb `360 − rumb`, perquè
 * la resta del càlcul sigui idèntica a Android. Aquell `alpha` ja va en sentit
 * CONTRARI al rumb. Si algú hi aplica `magneticToTrueHeading` pensant que és un
 * rumb, la correcció entra amb el signe canviat: a Tenerife, on la declinació
 * és de −3,51°, l'error passaria dels 3,51° originals a 7,02° — més de tretze
 * diàmetres solars, i en la direcció equivocada.
 *
 * Aquí la correcció s'aplica a l'AZIMUT ja calculat, que sí que és una direcció
 * del món com ho és la del Sol. Un gir de tot el marc del món al voltant de la
 * vertical no altera ni l'altura ni el gir de la imatge, així que sumar-la al
 * final és exactament equivalent a haver-la aplicat a l'origen, i molt més
 * difícil d'equivocar.
 */
export function trueAzimuth(cameraAzimuthDeg: number, declinationDeg: number): number {
  return ((cameraAzimuthDeg + declinationDeg) % 360 + 360) % 360;
}
