/**
 * L'ull: la diferència entre la llum que HI HA i la llum que NOTES.
 *
 * Aquesta diferència no és un detall de render, és el contingut. La gent que es
 * queda a 30 km de la franja de totalitat veu un 95% del Sol tapat i s'espera
 * que es faci fosc. No es fa fosc. Hi ha dues raons i totes dues són aquí:
 *
 *  1. AMB EL 95% TAPAT ENCARA QUEDA MOLTA LLUM EN TERMES ABSOLUTS. Un 3% del
 *     Sol són uns 3.000 lux: catorze mil vegades la lluna plena, i cinc vegades
 *     el que necessites per llegir.
 *
 *  2. L'ULL COMPENSA. La resposta visual és compressiva (llei de potència de
 *     Stevens amb exponent ~1/3 sobre el nivell d'adaptació) i a més el nivell
 *     d'adaptació SEGUEIX la llum. Resultat: una caiguda de 30 vegades es nota
 *     com una caiguda d'una vegada i mitja.
 *
 * I hi ha una tercera cosa, que és la que fa que la totalitat sigui un cop de
 * puny: l'adaptació TÉ INÈRCIA. Els últims 30 segons abans del segon contacte
 * la llum cau tres ordres de magnitud i l'ull no arriba a temps. Per això
 * `adaptEye` és una funció amb pas de temps i no una fórmula estàtica.
 *
 * LÍMITS DEL MODEL: això és fotometria, no psicofísica de laboratori. Els
 * exponents estan calibrats contra relats d'observadors i contra les xifres
 * publicades d'il·luminància, no contra un experiment amb subjectes. Les xifres
 * de "fracció percebuda" s'han de llegir com un ordre de magnitud del que sent
 * una persona, no com una mesura.
 *
 * Cap dependència de DOM.
 */

import {
  DEFAULT_GROUND_ALBEDO,
  MESOPIC_LOWER_CD_M2,
  MESOPIC_UPPER_CD_M2,
  REFERENCE_DAYLIGHT_LUX,
} from './constants';
import type { EyeState, VisionRegime } from './types';

/**
 * Exponent de la llei de potència de Stevens per a la brillantor.
 * B ∝ (E/E_adaptació)^0,33. És el valor de manual per a la brillantor
 * percebuda en condicions fotòpiques.
 */
export const STEVENS_BRIGHTNESS_EXPONENT = 0.33;

/**
 * Com de bé segueix l'adaptació la llum, en equilibri.
 *
 * Si valgués 1, l'ull compensaria TOT i cap escena no semblaria mai més fosca
 * que cap altra, cosa que és falsa (un paisatge de lluna plena no sembla de
 * dia). Si valgués 0, no hi hauria adaptació. 0,62 és el que fa quadrar el
 * model amb els relats: el 90% tapat "sembla que passi un núvol prim", el 99%
 * ja és "estrany i gris", i la totalitat "és de nit".
 *
 * ÉS EL PARÀMETRE MÉS TOU DE TOT EL MÒDUL. Està calibrat contra descripcions
 * qualitatives, no contra mesures.
 */
export const ADAPTATION_FOLLOW = 0.62;

/**
 * Constant de temps de l'adaptació quan la llum BAIXA, en segons.
 *
 * L'adaptació a la foscor té dues branques (Hecht & Shlaer 1937): la dels cons,
 * que arrenca de seguida i s'acaba en cinc o set minuts, i la dels bastons, que
 * en triga vint o trenta. Durant una totalitat de dos minuts només hi juga la
 * dels cons.
 *
 * Amb 40 s la fracció percebuda durant una totalitat va d'un 0,05 als primers
 * segons a un 0,27 al cap de dos minuts, que és el que descriuen els
 * observadors: al segon contacte sembla que t'apaguin el món, i al cap de mig
 * minut ja distingeixes cares, l'horitzó i els detalls de la corona.
 *
 * La branca dels bastons NO està modelada: en dos minuts amb prou feines
 * arrenca, i modelar-la donaria una totalitat més clara del que és.
 */
export const DARK_ADAPTATION_TAU_S = 40;

/**
 * Constant de temps quan la llum PUJA, en segons.
 * L'adaptació a la llum és molt més ràpida que a la foscor; per això el tercer
 * contacte enlluerna i es recupera de seguida.
 */
export const LIGHT_ADAPTATION_TAU_S = 2;

/** Diàmetre mínim i màxim de la pupil·la humana, en mm. */
export const PUPIL_MIN_MM = 1.5;
export const PUPIL_MAX_MM = 8;

/**
 * Exponent de l'efecte Hunt: el colorit creix amb la luminància.
 * Calibrat perquè un dia cobert (1.000 lx) conservi un ~80% del colorit d'un
 * dia de sol. És l'ingredient que fa que l'enfosquiment de l'eclipsi es vegi
 * "metàl·lic" i no "de capvespre".
 */
export const HUNT_EXPONENT = 0.05;

/**
 * Luminància d'un paisatge il·luminat amb aquesta il·luminància, en cd/m².
 * L = ρ·E/π per a una superfície difusa. Amb ρ = 0,18 (el gris mitjà), un dia
 * de sol són uns 5.700 cd/m².
 */
export function sceneLuminanceCdM2(
  lux: number,
  albedo: number = DEFAULT_GROUND_ALBEDO,
): number {
  return (albedo * Math.max(0, lux)) / Math.PI;
}

/**
 * Diàmetre de la pupil·la, fórmula de De Groot & Gebhard (1952):
 *
 *   log₁₀ d = 0,8558 − 0,000401 · (log₁₀ L + 8,6)³
 *
 * Va de ~1,5 mm en ple sol a ~7 mm de nit. Ull amb la temptació de pensar que
 * la pupil·la explica l'adaptació: només dona un factor 25 en àrea, i el marge
 * de llum que l'ull cobreix és de deu ordres de magnitud. La resta la fa la
 * retina.
 */
export function pupilDiameterMm(luminanceCdM2: number): number {
  const l = Math.max(1e-8, luminanceCdM2);
  const t = Math.log10(l) + 8.6;
  const d = Math.pow(10, 0.8558 - 0.000401 * t * t * t);
  return Math.max(PUPIL_MIN_MM, Math.min(PUPIL_MAX_MM, d));
}

/** Règim de la retina segons la luminància. Límits de CIE 191:2010. */
export function visionRegime(luminanceCdM2: number): VisionRegime {
  if (luminanceCdM2 >= MESOPIC_UPPER_CD_M2) return 'photopic';
  if (luminanceCdM2 <= MESOPIC_LOWER_CD_M2) return 'scotopic';
  return 'mesopic';
}

/**
 * Nivell d'adaptació d'equilibri: on s'acaba posant l'ull si el deixes estona
 * amb aquesta llum. No és igual a la llum: l'adaptació és incompleta.
 */
export function steadyAdaptationLux(lux: number): number {
  const e = Math.max(1e-6, lux);
  return (
    Math.pow(REFERENCE_DAYLIGHT_LUX, 1 - ADAPTATION_FOLLOW) *
    Math.pow(e, ADAPTATION_FOLLOW)
  );
}

/**
 * Fa avançar l'adaptació un pas de temps.
 *
 * L'adaptació és multiplicativa, o sigui que el relaxament es fa en logaritme.
 * Constants de temps diferents segons si la llum puja o baixa, perquè
 * fisiològicament són dos mecanismes distints.
 *
 * @param adaptationLux nivell actual d'adaptació, en lux
 * @param lux llum que hi ha ara, en lux
 * @param dtSeconds pas de temps
 * @returns nou nivell d'adaptació, en lux
 */
export function adaptEye(
  adaptationLux: number,
  lux: number,
  dtSeconds: number,
): number {
  const target = steadyAdaptationLux(lux);
  const current = Math.max(1e-6, adaptationLux);
  if (dtSeconds <= 0) return current;

  const tau = target < current ? DARK_ADAPTATION_TAU_S : LIGHT_ADAPTATION_TAU_S;
  const k = 1 - Math.exp(-dtSeconds / tau);
  const logNext = Math.log(current) + k * (Math.log(target) - Math.log(current));
  return Math.exp(logNext);
}

/**
 * Brillantor percebuda relativa al nivell d'adaptació, de 0 a 1.
 * 1 vol dir "tan clar com l'ull espera"; 0,3 vol dir "clarament fosc".
 */
export function perceivedBrightness(lux: number, adaptationLux: number): number {
  if (adaptationLux <= 0) return 0;
  const ratio = Math.max(0, lux) / adaptationLux;
  return Math.min(1, Math.pow(ratio, STEVENS_BRIGHTNESS_EXPONENT));
}

/**
 * Punt mig i pendent de la transició cromàtica, en log₁₀(cd/m²).
 *
 * Els límits de la CIE 191 (0,005 i 5 cd/m²) diuen entre quins valors de
 * luminància conviuen cons i bastons. NO diuen que per sota de 0,005 cd/m² el
 * color s'apagui de cop: la senyal cromàtica dels cons s'esllangueix, no cau
 * per un precipici. Aquí s'hi passa una transició suau que travessa els
 * MATEIXOS límits (5% de colorit a baix, 95% a dalt) i que s'acosta a zero
 * sense arribar-hi mai.
 *
 * PER QUÈ NO UNA RECTA RETALLADA: la versió anterior interpolava linealment
 * entre els dos límits i retallava a zero per sota. El retall deixava
 * `colorfulness` clavada exactament a 0 per sota de 0,087 lx, és a dir dues
 * dècades senceres —lluna plena, crepuscle nàutic i nit tancada— amb el mateix
 * número. Això no és cap llindar fisiològic, és un artefacte del retall, i es
 * menjava justament el tram on el model ha de saber distingir una totalitat
 * amb el Sol alt d'una amb el Sol arran d'horitzó.
 */
const MESOPIC_MID_LOG10 =
  (Math.log10(MESOPIC_LOWER_CD_M2) + Math.log10(MESOPIC_UPPER_CD_M2)) / 2;
const MESOPIC_HALF_SPAN_LOG10 =
  (Math.log10(MESOPIC_UPPER_CD_M2) - Math.log10(MESOPIC_LOWER_CD_M2)) / 2;
/** tanh(atanh(0,9)) = 0,9, o sigui 95% de colorit al límit superior i 5% a l'inferior. */
const MESOPIC_SLOPE = Math.atanh(0.9) / MESOPIC_HALF_SPAN_LOG10;

/**
 * Pes de la senyal cromàtica dels cons, de 0 a 1, extrems exclosos.
 * És el desplaçament de Purkinje: en baixar la luminància els bastons prenen
 * el relleu i el color se'n va.
 */
function chromaticWeight(luminanceCdM2: number): number {
  const l = Math.log10(Math.max(1e-12, luminanceCdM2));
  return 0.5 * (1 + Math.tanh(MESOPIC_SLOPE * (l - MESOPIC_MID_LOG10)));
}

/**
 * Colorit absolut de l'escena, de 0 a 1.
 *
 * Dos efectes multiplicats:
 *  - Hunt: com menys luminància, menys colorit, també dins del règim fotòpic.
 *    És el que dona a l'eclipsi el seu aspecte metàl·lic sense necessitat de
 *    canviar cap to.
 *  - Purkinje: en entrar al règim mesòpic els bastons prenen el relleu i el
 *    color desapareix de debò. Durant la totalitat el paisatge ja és mig gris.
 *
 * És estrictament creixent en tot el rang: dues escenes amb llum diferent no
 * poden tenir mai el mateix colorit, per fosques que siguin totes dues.
 */
export function colorfulness(
  lux: number,
  albedo: number = DEFAULT_GROUND_ALBEDO,
): number {
  const hunt = Math.min(
    1,
    Math.pow(Math.max(1e-9, lux) / REFERENCE_DAYLIGHT_LUX, HUNT_EXPONENT),
  );

  return hunt * chromaticWeight(sceneLuminanceCdM2(lux, albedo));
}

export interface EyeOptions {
  /**
   * Nivell d'adaptació actual, en lux. Si no s'hi posa, se suposa l'ull
   * completament adaptat a la llum que hi ha. Passa-hi el valor que porta
   * `adaptEye` si vols ensenyar l'efecte de xoc del segon contacte.
   */
  adaptationLux?: number;
  groundAlbedo?: number;
}

/**
 * Estat complet de l'ull, comparant la llum eclipsada amb la que hi hauria
 * sense eclipsi al mateix moment del dia.
 *
 * La comparació es fa contra el MATEIX cel sense eclipsi, no contra el migdia:
 * el que volem explicar és "quant s'ha enfosquit respecte de fa un moment", que
 * és la pregunta que es fa l'usuari.
 */
export function eyeState(
  lux: number,
  clearSkyLux: number,
  options: EyeOptions = {},
): EyeState {
  const albedo = options.groundAlbedo ?? DEFAULT_GROUND_ALBEDO;
  const adaptationLux = options.adaptationLux ?? steadyAdaptationLux(lux);

  const luminance = sceneLuminanceCdM2(lux, albedo);

  const perceived = perceivedBrightness(lux, adaptationLux);
  const perceivedClear = perceivedBrightness(
    clearSkyLux,
    steadyAdaptationLux(clearSkyLux),
  );

  const physicalFraction = clearSkyLux > 0 ? Math.min(1, lux / clearSkyLux) : 0;
  const perceivedFraction =
    perceivedClear > 0 ? Math.min(1, perceived / perceivedClear) : 0;

  const physicalDropFactor = physicalFraction > 0 ? 1 / physicalFraction : Infinity;
  const perceivedDropFactor = perceivedFraction > 0 ? 1 / perceivedFraction : Infinity;

  return {
    adaptationLux,
    pupilDiameterMm: pupilDiameterMm(luminance),
    sceneLuminanceCdM2: luminance,
    regime: visionRegime(luminance),
    physicalFraction,
    perceivedFraction,
    physicalDropFactor,
    perceivedDropFactor,
    compensation:
      Number.isFinite(physicalDropFactor) && Number.isFinite(perceivedDropFactor)
        ? physicalDropFactor / perceivedDropFactor
        : 1,
    colorfulness: colorfulness(lux, albedo),
  };
}
