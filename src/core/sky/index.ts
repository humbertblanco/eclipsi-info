/**
 * Model físic de la llum durant l'eclipsi.
 *
 * Per què existeix aquest mòdul: enfosquir el cel amb una corba triada a ull
 * fa una simulació bonica i falsa. I aquí la falsedat té conseqüències, perquè
 * la pregunta que es fa la gent és literalment "i si em quedo aquí, a trenta
 * quilòmetres de la franja, què veuré?". La resposta honesta —que amb el 95%
 * del Sol tapat encara sembla de dia, i que la diferència amb la totalitat no
 * és de grau sinó de naturalesa— només es pot donar amb números.
 *
 * PER ON COMENÇAR
 *
 *   import { skyState } from './core/sky';
 *   const sky = skyState(sample.obscuration, sample.sun.altitudeApparent, {
 *     discs: {
 *       separationDeg: sample.separation,
 *       sunRadiusDeg: sample.sun.angularRadius,
 *       moonRadiusDeg: sample.moon.angularRadius,
 *     },
 *   });
 *   // o, més curt:
 *   const sky = skyStateFromSample(sample);
 *
 *   sky.illuminanceLux          → la llum que hi ha, en lux
 *   sky.eye.perceivedFraction   → la claror que notes, de 0 a 1
 *   sky.eye.compensation        → quantes vegades l'ull t'amaga la caiguda
 *   sky.palette.zenith          → color del cel per pintar
 *   sky.equivalentSunAltitudeDeg → "tens tanta llum com amb el Sol a X graus"
 *
 * QUÈ ESTÀ MODELAT DE DEBÒ I QUÈ NO
 *
 *   Sòlid: massa d'aire (Kasten & Young), extinció del feix directe,
 *   enfosquiment del limbe i la seva conseqüència sobre el flux, ordres de
 *   magnitud de la il·luminància en tot el rang, i la separació entre llum
 *   física i llum percebuda.
 *
 *   Calibrat contra taules publicades: la component difusa i tots els
 *   crepuscles.
 *
 *   Estimat: la fuita de llum dins de l'ombra (bo a un factor 3) i els
 *   paràmetres de l'adaptació de l'ull (calibrats contra relats, no contra
 *   experiments).
 *
 *   No hi és: núvols, boira, calitja variable, albedo real del terreny,
 *   asimetria de l'ombra en moviment i les bandes d'ombra. Res d'això no és
 *   difícil d'afegir; simplement no s'ha fet i val més dir-ho.
 *
 * Cap fitxer d'aquest directori toca el DOM: tot ha de poder córrer en un
 * Worker o en Node.
 */

export type {
  EyeState,
  IlluminanceBreakdown,
  LightPhase,
  Rgb,
  SkyPalette,
  SkyState,
  VisionRegime,
} from './types';

export {
  CORONA_FLUX_RATIO,
  DEFAULT_GROUND_ALBEDO,
  EXTRATERRESTRIAL_ILLUMINANCE_LUX,
  FORBES_EXPONENT,
  FULL_MOON_LUX,
  LIMB_DARKENING_U,
  NIGHT_SKY_LUX,
  REFERENCE_DAYLIGHT_LUX,
  UMBRAL_LEAKAGE_FRACTION,
} from './constants';

export {
  coveredAreaFraction,
  intensityAtRadiusFraction,
  limbDarkenedIntensity,
  luminousFractionFromObscuration,
  MEAN_DISC_INTENSITY,
  uncoveredLuminousFraction,
} from './solarDisc';

export {
  airMass,
  beamTransmittance,
  clearSkyIlluminanceLux,
  diffuseHorizontalIlluminanceLux,
  directHorizontalIlluminanceLux,
  directNormalIlluminanceLux,
  eclipseIlluminance,
  equivalentSunAltitudeDeg,
  umbralLeakageFraction,
  verticalOpticalDepth,
} from './illuminance';
export type { EclipseIlluminanceOptions } from './illuminance';

export {
  adaptEye,
  colorfulness,
  DARK_ADAPTATION_TAU_S,
  eyeState,
  LIGHT_ADAPTATION_TAU_S,
  perceivedBrightness,
  pupilDiameterMm,
  sceneLuminanceCdM2,
  steadyAdaptationLux,
  visionRegime,
} from './adaptation';
export type { EyeOptions } from './adaptation';

export {
  linearToSrgb,
  mixLinear,
  parseHex,
  skyPalette,
  srgbToLinear,
  sunlightTemperatureK,
  toCss,
  toneColor,
} from './color';
export type { SkyPaletteInput } from './color';

export { skyState, skyStateFromSample, TOTALITY_RAMP_FRACTION } from './skyState';
export type { DiscGeometry, SkyStateOptions } from './skyState';
