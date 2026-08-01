/**
 * El color del cel: capvespre normal, enfosquiment d'eclipsi i totalitat.
 *
 * La idea que ho ordena tot és que aquests tres colors són DIFERENTS i la
 * diferència té una explicació física senzilla:
 *
 *  CAPVESPRE. La llum baixa PERQUÈ el camí òptic s'allarga. El camí llarg es
 *  menja el blau, o sigui que a més de baixar, la llum s'enrogeix. El cel es
 *  torna taronja per ponent i blau fosc per llevant, i tot plegat és molt
 *  saturat.
 *
 *  ECLIPSI PARCIAL PROFUND. La llum baixa PERÒ EL CAMÍ ÒPTIC NO CANVIA: el Sol
 *  és on era, l'aire és el mateix, només n'hi ha menys, de Sol. No hi ha cap
 *  enrogiment. El cel conserva exactament el to blau que li tocava per aquella
 *  hora del dia, però amb molta menys luminància — i el colorit percebut baixa
 *  amb la luminància (efecte Hunt). Blau correcte + luminància baixa + colorit
 *  baix = aquell gris metàl·lic, com de plom o de peltre, que descriu tothom qui
 *  ho ha viscut. No cal inventar-hi cap to: surt sol.
 *
 *  TOTALITAT. Aquí la geometria canvia de debò. Estàs dins d'un con d'ombra de
 *  cent o dos-cents quilòmetres i tot el que il·lumina el teu cel ve de FORA de
 *  l'ombra. Al zenit et queda un blau crepuscular fosc (llum de l'atmosfera
 *  alta), i arran d'horitzó, en TOTES les direccions, hi ha la franja taronja de
 *  l'atmosfera il·luminada de lluny vista amb camí rasant. Aquesta franja de
 *  360° és la signatura visual que no té cap capvespre del món: un capvespre
 *  només és taronja per un costat.
 *
 * LÍMITS DEL MODEL: els colors d'ancoratge estan triats a ull contra
 * fotografies, no calculats amb transport radiatiu ni amb funcions de
 * coincidència de color. El que està modelat de veritat és el COMPORTAMENT
 * (quin to, quanta luminància, quant colorit i on va la franja taronja); els
 * valors RGB concrets són una interpretació.
 *
 * Cap dependència de DOM: aquí només es calculen números i cadenes.
 */

import type { Rgb, SkyPalette } from './types';

/** Component sRGB (0-255) a llum lineal (0-1). */
export function srgbToLinear(component: number): number {
  const c = Math.max(0, Math.min(1, component / 255));
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Llum lineal (0-1) a component sRGB (0-255). */
export function linearToSrgb(value: number): number {
  const v = Math.max(0, Math.min(1, value));
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(c * 255);
}

/** `#RRGGBB` a Rgb. */
export function parseHex(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Rgb a `rgb(r,g,b)`, llest per a canvas o per a una variable CSS. */
export function toCss(color: Rgb): string {
  return `rgb(${color.r},${color.g},${color.b})`;
}

type ColorAnchor = [number, string];

/**
 * Color del zenit segons l'altura aparent del Sol.
 * De dia és el blau de Rayleigh; de nit, negre blavós.
 */
const ZENITH_ANCHORS: ColorAnchor[] = [
  [-18, '#04091A'],
  [-12, '#071630'],
  [-6, '#0E2246'],
  [-3, '#16305A'],
  [0, '#1E3F6E'],
  [2, '#2A5285'],
  [5, '#35659F'],
  [10, '#3E78BE'],
  [20, '#3C7ECD'],
  [30, '#3477CB'],
  [60, '#2E6FC4'],
  [90, '#2A6BC6'],
];

/**
 * Color de l'horitzó mirant CAP AL SOL. És la banda que s'enrogeix a la posta,
 * i el motiu pel qual s'enrogeix és el camí òptic llarg, no l'eclipsi.
 */
const SUNWARD_HORIZON_ANCHORS: ColorAnchor[] = [
  [-18, '#080D1A'],
  [-12, '#33202C'],
  [-6, '#8E4530'],
  [-3, '#C9663A'],
  [0, '#EE8A4A'],
  [2, '#F5A867'],
  [5, '#F3C892'],
  [10, '#E9DCC6'],
  [20, '#D6DEEC'],
  [30, '#CBDCF0'],
  [90, '#C6DAF2'],
];

/**
 * Color de l'horitzó D'ESQUENA AL SOL.
 *
 * Aquí, en un capvespre normal, hi ha el cinturó de Venus: una banda rosada
 * damunt de l'ombra blavosa de la Terra. Existeix com a camp propi justament
 * per poder ensenyar que durant la totalitat DESAPAREIX i tot l'horitzó es
 * torna igual de taronja.
 */
const OPPOSITE_HORIZON_ANCHORS: ColorAnchor[] = [
  [-18, '#060B18'],
  [-12, '#131A2E'],
  [-6, '#4A4260'],
  [-3, '#8E7286'],
  [0, '#C09AA6'],
  [2, '#A79EB8'],
  [5, '#9FB2CC'],
  [10, '#AFC4DC'],
  [30, '#B7CFEA'],
  [90, '#B7CFEA'],
];

/**
 * Color de la franja d'horitzó durant la totalitat.
 * És llum solar que ha viatjat cent o dos-cents quilòmetres arran de terra: el
 * mateix taronja d'una posta, però vingut de fora de l'ombra i present als
 * 360°.
 */
const TOTALITY_HORIZON_GLOW = parseHex('#D9743C');

/**
 * Realç de la franja d'horitzó durant la totalitat.
 *
 * A les fotografies la franja és entre cinc i deu vegades més lluminosa que el
 * zenit. A la pantalla això no cap, i tampoc no faria falta: el que s'ha
 * d'entendre és que hi ha un anell clar per sota i un cel fosc per sobre.
 * Comprimim el contrast a un factor 2,5.
 */
const TOTALITY_HORIZON_LUMINANCE_BOOST = 1.5;

/**
 * La franja d'horitzó és una font brillant i no cau al règim mesòpic tant com
 * la resta del cel. Per això conserva més color que el zenit.
 */
const TOTALITY_HORIZON_SATURATION_BOOST = 0.5;

function interpolateColorAnchors(anchors: ColorAnchor[], x: number): Rgb {
  if (x <= anchors[0][0]) return parseHex(anchors[0][1]);
  const last = anchors[anchors.length - 1];
  if (x >= last[0]) return parseHex(last[1]);

  for (let i = 1; i < anchors.length; i++) {
    if (x <= anchors[i][0]) {
      const [x0, hex0] = anchors[i - 1];
      const [x1, hex1] = anchors[i];
      const t = (x - x0) / (x1 - x0);
      return mixLinear(parseHex(hex0), parseHex(hex1), t);
    }
  }
  return parseHex(last[1]);
}

/**
 * Barreja de dos colors en llum LINEAL, no en sRGB.
 * Barrejar llums és sumar energies; fer-ho amb els valors gamma donaria
 * transicions que s'enfosqueixen pel mig.
 */
export function mixLinear(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t));
  const mix = (ca: number, cb: number) =>
    linearToSrgb(srgbToLinear(ca) * (1 - k) + srgbToLinear(cb) * k);
  return { r: mix(a.r, b.r), g: mix(a.g, b.g), b: mix(a.b, b.b) };
}

/**
 * Aplica luminància i saturació a un color, treballant en llum lineal.
 * La desaturació es fa cap al gris de la MATEIXA luminància, que és el que fa
 * l'ull quan perd colorit: no s'aclareix ni s'enfosqueix res, només marxa el to.
 */
export function toneColor(
  base: Rgb,
  luminanceScale: number,
  saturationScale: number,
): Rgb {
  const lr = srgbToLinear(base.r);
  const lg = srgbToLinear(base.g);
  const lb = srgbToLinear(base.b);

  // Coeficients de luminància relativa de la Rec. 709 / sRGB.
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  const s = Math.max(0, Math.min(1, saturationScale));
  const k = Math.max(0, luminanceScale);

  return {
    r: linearToSrgb((y + (lr - y) * s) * k),
    g: linearToSrgb((y + (lg - y) * s) * k),
    b: linearToSrgb((y + (lb - y) * s) * k),
  };
}

/**
 * Temperatura de color de la llum solar que arriba a terra, en K.
 *
 * Dues causes, independents:
 *  - L'altura del Sol. Més massa d'aire, més blau perdut: de ~5.800 K amb el
 *    Sol alt a ~2.000 K arran d'horitzó.
 *  - La forma del que queda del Sol. Quan només en queda una mitja lluna prima,
 *    tota la llum ve del LIMBE, que radia com un cos de ~4.900 K en comptes
 *    dels ~5.800 K del disc sencer. És un enrogiment real però petit, i és
 *    l'únic canvi de to que l'eclipsi provoca de debò.
 */
const SUNLIGHT_TEMPERATURE_ANCHORS: Array<[number, number]> = [
  [-1, 1900],
  [0, 2200],
  [2, 3200],
  [5, 4200],
  [10, 4900],
  [20, 5400],
  [40, 5700],
  [90, 5800],
];

/** Caiguda màxima de temperatura quan tota la llum ve del limbe: 4.900/5.800. */
const LIMB_TEMPERATURE_DROP = 0.16;

export function sunlightTemperatureK(
  sunAltitudeDeg: number,
  luminousFraction: number,
): number {
  const anchors = SUNLIGHT_TEMPERATURE_ANCHORS;
  let base = anchors[anchors.length - 1][1];
  if (sunAltitudeDeg <= anchors[0][0]) base = anchors[0][1];
  else {
    for (let i = 1; i < anchors.length; i++) {
      if (sunAltitudeDeg <= anchors[i][0]) {
        const [x0, y0] = anchors[i - 1];
        const [x1, y1] = anchors[i];
        const t = (sunAltitudeDeg - x0) / (x1 - x0);
        base = y0 + t * (y1 - y0);
        break;
      }
    }
  }

  const f = Math.max(0, Math.min(1, luminousFraction));
  const limbWeight = (1 - f) * (1 - f);
  return base * (1 - LIMB_TEMPERATURE_DROP * limbWeight);
}

export interface SkyPaletteInput {
  /** Altura APARENT del Sol, en graus. */
  sunAltitudeDeg: number;
  /**
   * Luminància relativa al mateix cel SENSE eclipsi, de 0 a 1.
   * 1 = no es nota res. És la brillantor percebuda, no la física: la física
   * cauria 30.000 vegades durant la totalitat i cap pantalla no ho pot ensenyar.
   */
  luminanceScale: number;
  /** Colorit relatiu al mateix cel sense eclipsi, de 0 a 1. */
  saturationScale: number;
  /** Fracció de flux solar visible, de 0 a 1. Serveix per al to de la llum. */
  luminousFraction: number;
  /**
   * Pes de la totalitat, de 0 a 1. 1 = dins de l'ombra.
   * Val 0 en qualsevol fase parcial i en qualsevol anularitat.
   */
  totality: number;
}

/**
 * Colors del cel per a un instant.
 *
 * Regla que ho governa tot: el TO surt de l'altura real del Sol i la
 * LUMINÀNCIA surt de la llum que hi ha. Separar les dues coses és el que fa que
 * un eclipsi al migdia no es pinti com una posta de sol, que és l'error que
 * comet qualsevol simulació que enfosqueixi amb una corba i prou.
 */
export function skyPalette(input: SkyPaletteInput): SkyPalette {
  const {
    sunAltitudeDeg,
    luminanceScale,
    saturationScale,
    luminousFraction,
  } = input;
  const totality = Math.max(0, Math.min(1, input.totality));

  const zenith = toneColor(
    interpolateColorAnchors(ZENITH_ANCHORS, sunAltitudeDeg),
    luminanceScale,
    saturationScale,
  );

  const horizonLuminance = Math.min(
    1,
    luminanceScale * (1 + TOTALITY_HORIZON_LUMINANCE_BOOST * totality),
  );
  const horizonSaturation = Math.min(
    1,
    saturationScale * (1 + TOTALITY_HORIZON_SATURATION_BOOST * totality),
  );

  const sunwardBase = mixLinear(
    interpolateColorAnchors(SUNWARD_HORIZON_ANCHORS, sunAltitudeDeg),
    TOTALITY_HORIZON_GLOW,
    totality,
  );
  const oppositeBase = mixLinear(
    interpolateColorAnchors(OPPOSITE_HORIZON_ANCHORS, sunAltitudeDeg),
    TOTALITY_HORIZON_GLOW,
    totality,
  );

  return {
    zenith,
    horizonSunward: toneColor(sunwardBase, horizonLuminance, horizonSaturation),
    horizonOpposite: toneColor(oppositeBase, horizonLuminance, horizonSaturation),
    horizonGlowIsAllRound: totality >= 0.5,
    luminanceScale,
    saturationScale,
    sunlightTemperatureK: sunlightTemperatureK(sunAltitudeDeg, luminousFraction),
  };
}
