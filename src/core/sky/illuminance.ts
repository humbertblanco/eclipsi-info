/**
 * Quants lux hi ha a terra.
 *
 * El model té tres peces i cadascuna té el seu abast:
 *
 *  1. FEIX DIRECTE. Física de debò: il·luminància extraterrestre × Beer-Lambert
 *     amb la massa d'aire de Kasten & Young i una correcció de Forbes. És el
 *     tram que importa als eclipsis espanyols de 2026 i 2028, on el Sol està
 *     entre 1° i 12°: allà el feix ja ha travessat entre 5 i 30 atmosferes i
 *     n'ha perdut més del 80%.
 *
 *  2. CEL DIFÚS. Calibrat contra la taula canònica d'il·luminàncies (posta
 *     ~400 lx, crepuscle civil 3,4 lx, crepuscle nàutic 0,008 lx). No hi ha
 *     fórmula tancada honesta per al crepuscle: la llum ve de l'atmosfera alta
 *     il·luminada de biaix, i això és transport radiatiu en tres dimensions.
 *     Interpolem en logaritme entre ancoratges publicats i ho diem clar.
 *
 *  3. FUITA DINS DE L'OMBRA + CORONA. És el que fa que la totalitat siguin lux
 *     i no micro-lux.
 *
 * L'ALTURA QUE S'HI PASSA HA DE SER L'APARENT (refractada), és a dir
 * `sample.sun.altitudeApparent`. Prop de l'horitzó la refracció puja el Sol
 * mig grau, i mig grau allà baix val gairebé un factor 2 en il·luminància.
 *
 * Cap dependència de DOM.
 */

import { STANDARD_ATMOSPHERE, DEG } from '../astro/constants';
import { applyRefraction } from '../astro/refraction';
import type { Atmosphere } from '../astro/types';
import {
  CORONA_FLUX_RATIO,
  EXTRATERRESTRIAL_ILLUMINANCE_LUX,
  FORBES_EXPONENT,
  LOW_SUN_LEAKAGE_BOOST,
  NIGHT_SKY_LUX,
  REFERENCE_PRESSURE_MB,
  TAU_AEROSOL,
  TAU_OTHER,
  TAU_OZONE,
  TAU_RAYLEIGH,
  UMBRAL_LEAKAGE_FRACTION,
} from './constants';
import type { IlluminanceBreakdown } from './types';

/**
 * Massa d'aire relativa, fórmula de Kasten & Young (1989).
 *
 *   m = 1 / (sin h + 0,50572 · (h + 6,07995)^−1,6364)
 *
 * Val 1 al zenit i 37,92 a l'horitzó. Reprodueix les taules amb un error < 0,1%
 * fins a l'horitzó mateix, cosa que la fórmula ingènua 1/sin h no fa ni de
 * lluny: a 2° d'altura 1/sin h dona 28,7 quan la bona és 19,4.
 *
 * @param apparentAltitudeDeg altura APARENT en graus
 */
export function airMass(apparentAltitudeDeg: number): number {
  // Per sota de l'horitzó no hi ha feix directe; retornem el valor de
  // l'horitzó per no deixar la funció indefinida.
  const h = Math.min(90, Math.max(0, apparentAltitudeDeg));
  return 1 / (Math.sin(h * DEG) + 0.50572 * Math.pow(h + 6.07995, -1.6364));
}

/**
 * Gruix òptic vertical de l'atmosfera per a la banda fotòpica.
 * Només la part de Rayleigh escala amb la pressió: els aerosols i l'ozó no
 * segueixen la pressió de superfície de cap manera senzilla.
 */
export function verticalOpticalDepth(
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): number {
  const pressureScale = atmosphere.pressureMb / REFERENCE_PRESSURE_MB;
  return TAU_RAYLEIGH * pressureScale + TAU_AEROSOL + TAU_OZONE + TAU_OTHER;
}

/**
 * Transmitància del feix directe, de 0 a 1.
 *
 * Beer-Lambert amb el gruix òptic corregit per l'efecte de Forbes: Θ = τ₀·m^0,8
 * en comptes de τ₀·m. Vegeu `FORBES_EXPONENT` per al perquè.
 */
export function beamTransmittance(
  apparentAltitudeDeg: number,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): number {
  const m = airMass(apparentAltitudeDeg);
  const tau = verticalOpticalDepth(atmosphere);
  return Math.exp(-tau * Math.pow(m, FORBES_EXPONENT));
}

/**
 * Il·luminància del Sol a incidència normal, a terra, en lux.
 * Zero per sota de l'horitzó aparent: allà el feix directe el tapa la Terra.
 */
export function directNormalIlluminanceLux(
  apparentAltitudeDeg: number,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): number {
  if (apparentAltitudeDeg <= 0) return 0;
  return (
    EXTRATERRESTRIAL_ILLUMINANCE_LUX *
    beamTransmittance(apparentAltitudeDeg, atmosphere)
  );
}

/** Component directa projectada sobre el terra pla, en lux. */
export function directHorizontalIlluminanceLux(
  apparentAltitudeDeg: number,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): number {
  if (apparentAltitudeDeg <= 0) return 0;
  return (
    directNormalIlluminanceLux(apparentAltitudeDeg, atmosphere) *
    Math.sin(apparentAltitudeDeg * DEG)
  );
}

/**
 * Ancoratges de la llum del cel (component difusa horitzontal), en lux.
 *
 * [altura aparent del Sol en graus, lux]
 *
 * D'on surt cada tram:
 *  - Per sobre de 0°: calibrats perquè difusa + directa reprodueixin les
 *    il·luminàncies globals horitzontals de cel serè tabulades (≈115 klx al
 *    zenit, ≈50 klx a 30°, ≈13 klx a 10°, ≈400 lx a l'horitzó).
 *  - Per sota de 0°: valors publicats dels crepuscles. 3,4 lx al final del
 *    crepuscle civil (−6°) i 0,008 lx al final del nàutic (−12°) són els que
 *    apareixen a la taula canònica; per sota de −18° ja és nit tancada i el
 *    model es planta al fons d'estrelles i airglow.
 *
 * LÍMIT DEL MODEL: aquests números són per a cel serè i aire net a nivell del
 * mar. Un dia de calitja pot restar-ne un 30%; un cel cobert, un 90%. El model
 * NO fa núvols.
 */
const DIFFUSE_ANCHORS: Array<[number, number]> = [
  [-18, NIGHT_SKY_LUX],
  [-15, 0.004],
  [-12, 0.008],
  [-9, 0.12],
  [-6, 3.4],
  [-3, 40],
  [-0.833, 200],
  [0, 400],
  [1, 850],
  [2, 1500],
  [3, 2100],
  [5, 3000],
  [7, 3900],
  [10, 5000],
  [15, 6400],
  [20, 7500],
  [30, 9000],
  [50, 11000],
  [90, 12000],
];

/** Interpolació lineal en log(lux) entre ancoratges. */
function interpolateAnchors(
  anchors: Array<[number, number]>,
  x: number,
): number {
  if (x <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (x >= last[0]) return last[1];

  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i];
    if (x <= x1) {
      const [x0, y0] = anchors[i - 1];
      const t = (x - x0) / (x1 - x0);
      return Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0)));
    }
  }
  return last[1];
}

/**
 * Llum del cel sobre un pla horitzontal, en lux, sense eclipsi.
 *
 * No depèn de `Atmosphere` a propòsit: els ancoratges venen de mesures que ja
 * porten dins la pressió, la temperatura i la terbolesa del dia en què es van
 * fer. Fingir una correcció seria precisió falsa.
 */
export function diffuseHorizontalIlluminanceLux(
  apparentAltitudeDeg: number,
): number {
  return interpolateAnchors(DIFFUSE_ANCHORS, apparentAltitudeDeg);
}

/** Il·luminància horitzontal total de cel serè SENSE eclipsi, en lux. */
export function clearSkyIlluminanceLux(
  apparentAltitudeDeg: number,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): number {
  return (
    directHorizontalIlluminanceLux(apparentAltitudeDeg, atmosphere) +
    diffuseHorizontalIlluminanceLux(apparentAltitudeDeg)
  );
}

/**
 * Fracció de llum ambiental que entra dins de l'ombra des de fora.
 * Creix amb el Sol baix perquè el con d'ombra travessa l'atmosfera molt
 * inclinat i la columna que tens al damunt surt de l'ombra a poca altura.
 */
export function umbralLeakageFraction(apparentAltitudeDeg: number): number {
  const sinH = Math.max(0, Math.sin(Math.max(0, apparentAltitudeDeg) * DEG));
  return UMBRAL_LEAKAGE_FRACTION * (1 + LOW_SUN_LEAKAGE_BOOST * (1 - sinH));
}

export interface EclipseIlluminanceOptions {
  atmosphere?: Atmosphere;
  /**
   * Brillantor de la corona respecte de la mitjana. 0,7 al mínim solar, 1,4 al
   * màxim. Els eclipsis de 2026-2028 cauen prop del màxim del cicle 25.
   */
  coronaFactor?: number;
  /** Passa `true` si l'altura que dones és geomètrica i cal refractar-la. */
  altitudeIsGeometric?: boolean;
}

/**
 * Il·luminància horitzontal durant l'eclipsi, en lux, amb el desglossament.
 *
 * @param luminousFraction fracció del FLUX del Sol que encara es veu (0 a 1).
 *   No és 1 − obscuració: fes servir `solarDisc.ts` per obtenir-la.
 * @param sunAltitudeDeg altura aparent del Sol en graus
 */
export function eclipseIlluminance(
  luminousFraction: number,
  sunAltitudeDeg: number,
  options: EclipseIlluminanceOptions = {},
): IlluminanceBreakdown & { totalLux: number; clearSkyLux: number } {
  const atmosphere = options.atmosphere ?? STANDARD_ATMOSPHERE;
  const h = options.altitudeIsGeometric
    ? applyRefraction(sunAltitudeDeg, atmosphere)
    : sunAltitudeDeg;

  const f = Math.max(0, Math.min(1, luminousFraction));

  const m = airMass(h);
  const transmittance = beamTransmittance(h, atmosphere);
  const directNormalLux = directNormalIlluminanceLux(h, atmosphere);
  const sinH = h > 0 ? Math.sin(h * DEG) : 0;

  const clearDirect = directNormalLux * sinH;
  const clearDiffuse = diffuseHorizontalIlluminanceLux(h);
  const clearSkyLux = clearDirect + clearDiffuse;

  // El feix i el cel local cauen tots dos amb la fracció de flux: la penombra
  // fa milers de quilòmetres, o sigui que tot el que tens a la vista està
  // eclipsat igual que tu. Això deixa de ser cert dins de l'ombra, i per això
  // hi ha el terme de fuita.
  const directLux = clearDirect * f;
  const diffuseLux = clearDiffuse * f;

  const leakageLux = umbralLeakageFraction(h) * clearSkyLux;
  const coronaLux =
    CORONA_FLUX_RATIO * (options.coronaFactor ?? 1) * directNormalLux * sinH;

  // El fons de nit no es resta mai: encara que tapessis el Sol del tot, les
  // estrelles hi continuen sent.
  const totalLux = Math.max(
    NIGHT_SKY_LUX,
    directLux + diffuseLux + leakageLux + coronaLux,
  );

  return {
    directLux,
    diffuseLux,
    leakageLux,
    coronaLux,
    airMass: m,
    transmittance,
    directNormalLux,
    totalLux,
    clearSkyLux: Math.max(NIGHT_SKY_LUX, clearSkyLux),
  };
}

/**
 * Altura del Sol, en graus, que sense eclipsi donaria aquesta il·luminància.
 *
 * Serveix per traduir l'eclipsi a llenguatge que tothom entén: "amb el 99%
 * tapat tens tanta llum com un quart d'hora després de la posta". Es resol per
 * bisecció perquè `clearSkyIlluminanceLux` és monòtona creixent amb l'altura.
 *
 * Se satura a −18° (nit) i a 90°.
 */
export function equivalentSunAltitudeDeg(
  lux: number,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): number {
  const target = Math.max(NIGHT_SKY_LUX, lux);
  if (target <= clearSkyIlluminanceLux(-18, atmosphere)) return -18;
  if (target >= clearSkyIlluminanceLux(90, atmosphere)) return 90;

  let lo = -18;
  let hi = 90;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (clearSkyIlluminanceLux(mid, atmosphere) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
