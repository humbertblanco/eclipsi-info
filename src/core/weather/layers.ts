/**
 * Física de la puntuació: per què un cel tapat de cirrus i un cel tapat
 * d'estratocúmuls no són el mateix cel.
 *
 * TOT EL MÒDUL EXISTEIX PER AQUESTA RAÓ. Una previsió que et digui "90 % de
 * nuvolositat" i prou és inútil per a un eclipsi: si aquell 90 % són cirrus a
 * 10 km d'alçada veuràs la corona perfectament, i si són estrats a 800 m no
 * veuràs absolutament res. La diferència entre les dues situacions és tot el
 * viatge.
 *
 * D'ON SURTEN ELS PESOS
 *
 * Cada capa la caracteritzem pel seu gruix òptic visible τ típic i en traiem
 * una transmissió efectiva:
 *
 *  - ALTS (> 6 km, cirrus i cirrostrats). La climatologia de cirrus de
 *    latituds mitjanes de Sassen i Comstock (2001), amb ~860 hores de lidar,
 *    dona τ visible mitjà 0,75 ± 0,91 i MEDIÀ 0,61. Amb τ = 0,6 la llei de
 *    Beer donaria una transmissió directa de 0,55, però el gel dels cirrus
 *    dispersa cap endavant de manera molt marcada: bona part de la llum
 *    desviada continua arribant a l'ull des de molt a prop del disc, i per
 *    això a través d'un vel de cirrus la corona encara es veu. Fixem la
 *    transmissió visual efectiva en 0,65.
 *    Sassen, K. i Comstock, J. M. (2001), "A Midlatitude Cirrus Cloud
 *    Climatology from the Facility for Atmospheric Remote Sensing. Part III:
 *    Radiative Properties", J. Atmos. Sci. 58, 2113-2127.
 *
 *  - MITJANS (2 a 6 km, altostrats i altocúmuls). Prou gruixuts per caure per
 *    damunt del llindar τ = 3,6 amb què la classificació ISCCP separa els
 *    núvols prims dels gruixuts. A través d'un altostrat el Sol es veu com un
 *    disc lletós i la corona ja s'ha perdut. Prenem τ ≈ 5, transmissió 0,20.
 *    Rossow, W. B. i Schiffer, R. A. (1999), "Advances in Understanding
 *    Clouds from ISCCP", Bull. Amer. Meteor. Soc. 80, 2261-2287.
 *
 *  - BAIXOS (< 2 km, estrats, estratocúmuls, cúmuls, boira). τ típic de 10 a
 *    40. Amb τ = 20 la transmissió és 2·10⁻⁹: el Sol desapareix del tot.
 *    Deixem 0,03 en comptes de zero perquè la vora d'un cúmul és més prima
 *    que el centre i perquè així la puntuació no col·lapsa a zero de cop.
 *
 * Els límits d'alçada de les capes (2 km i 6 km) són els que fa servir
 * Open-Meteo per definir `cloud_cover_low/mid/high`, i coincideixen amb la
 * divisió clàssica de l'Atles Internacional de Núvols de l'OMM per a latituds
 * mitjanes.
 *
 * COM ES COMBINEN
 *
 * Amb superposició ALEATÒRIA, que és el que fan els mateixos models: la
 * cobertura total que publica Open-Meteo és, dins de l'arrodoniment,
 * 1 − Π(1 − cᵢ). Ho hem verificat contra respostes reals de l'API. Per tant
 * la transmissió esperada del cel sencer és
 *
 *      T = Π_capes (1 − cᵢ · (1 − Tᵢ))
 *
 * on cᵢ és la fracció de cel coberta per la capa i Tᵢ la seva transmissió.
 * La puntuació és 100 · T, i es llegeix com "quina part de l'espectacle
 * t'arriba".
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import type {
  CloudLayerId,
  CloudLayers,
  CloudScore,
  HazeEstimate,
  LocalisedText,
  SkyBand,
} from './types';

/**
 * Transmissió visual efectiva de cada capa quan cobreix el cel del tot.
 * Aquests tres números són el cor del mòdul; qualsevol canvi s'ha de
 * justificar amb una font i s'ha de reflectir a la constant de versió.
 */
export const LAYER_TRANSMISSION: Record<CloudLayerId, number> = {
  low: 0.03,
  mid: 0.2,
  high: 0.65,
};

/** Opacitat = 1 − transmissió. És el que resta cada capa a la puntuació. */
export const LAYER_OPACITY: Record<CloudLayerId, number> = {
  low: 1 - LAYER_TRANSMISSION.low,
  mid: 1 - LAYER_TRANSMISSION.mid,
  high: 1 - LAYER_TRANSMISSION.high,
};

/** Alçades nominals de les capes en metres, tal com les defineix Open-Meteo. */
export const LAYER_BOUNDS_M: Record<CloudLayerId, { bottom: number; top: number }> = {
  low: { bottom: 0, top: 2000 },
  mid: { bottom: 2000, top: 6000 },
  high: { bottom: 6000, top: 12000 },
};

export const LAYER_ORDER: readonly CloudLayerId[] = ['low', 'mid', 'high'] as const;

/**
 * Llindars de la semàntica de color.
 *
 * 70: per sobre, com a molt tens un vel prim; la fase central es veu.
 * 35: per sota, és més probable que el Sol estigui tapat que no pas destapat.
 * Entre l'un i l'altre la resposta honesta és "depèn", i el color ho diu.
 */
export const BAND_CLEAR_MIN = 70;
export const BAND_PARTIAL_MIN = 35;

/**
 * Versió de la física de puntuació. Puja-la quan canviïn els pesos: la memòria
 * cau descarta el que no coincideixi i així ningú es queda amb puntuacions
 * calculades amb uns pesos que ja hem corregit.
 */
export const SCORING_VERSION = 1;

function clampPercent(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Classifica una puntuació de 0 a 100 en la semàntica de color del sistema. */
export function bandForScore(score: number): SkyBand {
  if (score >= BAND_CLEAR_MIN) return 'clear';
  if (score >= BAND_PARTIAL_MIN) return 'partial';
  return 'cloudy';
}

/**
 * Puntua un cel a partir de la cobertura de cada capa.
 *
 * `hasLayers` fals vol dir que el model no ha donat el desglossament i només
 * tenim la cobertura total. Aleshores hem de suposar alguna cosa, i suposem la
 * capa mitjana: és el compromís menys dolent, però la puntuació val molt menys
 * i el resultat ho marca amb `fromTotalOnly` perquè la interfície ho pugui dir.
 */
export function scoreCloudLayers(layers: CloudLayers, hasLayers = true): CloudScore {
  if (!hasLayers) {
    const cover = clampPercent(layers.total) / 100;
    const blocked = cover * LAYER_OPACITY.mid;
    const score = Math.round(100 * (1 - blocked));
    return {
      score,
      band: bandForScore(score),
      attribution: { low: 0, mid: blocked, high: 0 },
      blocked,
      dominant: blocked > 0 ? 'mid' : null,
      fromTotalOnly: true,
    };
  }

  // Transmissió de cada capa per separat, amb superposició aleatòria entre elles.
  const transmissionByLayer: Record<CloudLayerId, number> = { low: 1, mid: 1, high: 1 };
  for (const id of LAYER_ORDER) {
    const cover = clampPercent(layers[id]) / 100;
    transmissionByLayer[id] = 1 - cover * LAYER_OPACITY[id];
  }

  const transmission =
    transmissionByLayer.low * transmissionByLayer.mid * transmissionByLayer.high;
  const blocked = 1 - transmission;

  // Repartiment del bloqueig entre capes. Cada capa se n'emporta la part
  // proporcional al seu propi bloqueig: així la suma és exactament el bloqueig
  // total i les barres de la interfície no menteixen.
  const rawByLayer: Record<CloudLayerId, number> = {
    low: 1 - transmissionByLayer.low,
    mid: 1 - transmissionByLayer.mid,
    high: 1 - transmissionByLayer.high,
  };
  const rawSum = rawByLayer.low + rawByLayer.mid + rawByLayer.high;
  const attribution: Record<CloudLayerId, number> =
    rawSum > 0
      ? {
          low: (rawByLayer.low / rawSum) * blocked,
          mid: (rawByLayer.mid / rawSum) * blocked,
          high: (rawByLayer.high / rawSum) * blocked,
        }
      : { low: 0, mid: 0, high: 0 };

  let dominant: CloudLayerId | null = null;
  let best = 0;
  for (const id of LAYER_ORDER) {
    if (attribution[id] > best) {
      best = attribution[id];
      dominant = id;
    }
  }

  const score = Math.round(100 * transmission);
  return {
    score,
    band: bandForScore(score),
    attribution,
    blocked,
    dominant,
    fromTotalOnly: false,
  };
}

/**
 * Alçada equivalent de la capa d'aerosols, en km.
 *
 * Els aerosols es concentren a la capa límit; per damunt d'un parell de
 * quilòmetres l'aire ja és net. 1,2 km és el valor que es fa servir
 * habitualment per lligar la visibilitat de superfície amb el gruix òptic de
 * tota la columna.
 */
const AEROSOL_SCALE_HEIGHT_KM = 1.2;

/** Constant de Koschmieder: contrast del 2 % a la distància de visibilitat. */
const KOSCHMIEDER = 3.912;

/**
 * Extinció per aerosols al llarg de la línia de visió.
 *
 * A 3° d'altura el Sol travessa gairebé vint vegades més atmosfera que al
 * zenit, i una boirina que de dia no notaries se'l menja. Això NO entra a la
 * puntuació de núvols: és una altra cosa i s'ensenya a part, perquè un Sol
 * esmorteït encara es veu (i de fet es mira millor) mentre que un Sol tapat no.
 *
 * Fórmula de la massa d'aire: Kasten i Young (1989), vàlida fins a l'horitzó,
 * a diferència de l'aproximació 1/sin(h) que divergeix.
 */
export function estimateHaze(
  visibilityMeters: number | null | undefined,
  sunAltitudeDeg: number,
): HazeEstimate | null {
  if (
    visibilityMeters === null ||
    visibilityMeters === undefined ||
    !Number.isFinite(visibilityMeters) ||
    visibilityMeters <= 0
  ) {
    return null;
  }

  const visibilityKm = visibilityMeters / 1000;
  const h = Math.max(sunAltitudeDeg, 0);
  const rad = (Math.PI / 180) * h;
  const airmass = 1 / (Math.sin(rad) + 0.50572 * (h + 6.07995) ** -1.6364);

  const tauZenith = (KOSCHMIEDER * AEROSOL_SCALE_HEIGHT_KM) / visibilityKm;
  const slantOpticalDepth = tauZenith * airmass;

  return {
    visibilityKm,
    airmass,
    slantOpticalDepth,
    transmission: Math.exp(-slantOpticalDepth),
  };
}

/** Mitjana de diverses lectures de capes. Ignora les entrades buides. */
export function averageLayers(samples: readonly CloudLayers[]): CloudLayers {
  if (samples.length === 0) return { low: 0, mid: 0, high: 0, total: 0 };
  let low = 0;
  let mid = 0;
  let high = 0;
  let total = 0;
  for (const s of samples) {
    low += clampPercent(s.low);
    mid += clampPercent(s.mid);
    high += clampPercent(s.high);
    total += clampPercent(s.total);
  }
  const n = samples.length;
  return { low: low / n, mid: mid / n, high: high / n, total: total / n };
}

/**
 * Nom curt de cada capa per a la interfície.
 *
 * EL GÈNERE NO COINCIDEIX ENTRE ELS DOS IDIOMES i és a posta. En català
 * l'etiqueta concorda amb «núvols» (masculí: «baixos») i en castellà amb
 * «nubes» (femení: «bajas»). No és una traducció descuidada: `describeDominantLayer`
 * reutilitza aquesta mateixa etiqueta en minúscules dins d'una frase («els
 * núvols baixos» / «las nubes bajas»), i amb un «bajos» aquí la frase castellana
 * sortiria mal concordada.
 */
export const LAYER_LABEL: Record<CloudLayerId, LocalisedText> = {
  low: { ca: 'Baixos', es: 'Bajas', en: 'Low' },
  mid: { ca: 'Mitjans', es: 'Medias', en: 'Mid-level' },
  high: { ca: 'Alts', es: 'Altas', en: 'High' },
};

/** Què és cada capa i què et fa. Frases curtes, per a la interfície. */
export const LAYER_NOTE: Record<CloudLayerId, LocalisedText> = {
  low: {
    ca: 'Estrats i cúmuls, fins a 2 km. Tapen del tot.',
    es: 'Estratos y cúmulos, hasta 2 km. Tapan del todo.', en: 'Stratus and cumulus, up to 2 km. They can block the view completely.',
  },
  mid: {
    ca: 'Altostrats, de 2 a 6 km. El Sol es veu lletós, la corona no.',
    es: 'Altoestratos, de 2 a 6 km. El Sol se ve lechoso, la corona no.', en: 'Altostratus, from 2 to 6 km. The Sun looks milky and the corona is obscured.',
  },
  high: {
    ca: 'Cirrus, per damunt de 6 km. La corona encara passa.',
    es: 'Cirros, por encima de 6 km. La corona todavía pasa.', en: 'Cirrus above 6 km. The corona can still show through.',
  },
};
