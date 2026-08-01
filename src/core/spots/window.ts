/**
 * Horitzó de finestra: només els azimuts que importen.
 *
 * ── EL PROBLEMA ─────────────────────────────────────────────────────────────
 *
 * Un perfil d'horitzó complet són 1.440 raigs, ~150 tessel·les i 2,6 milions de
 * mostres. Per a 570 candidats serien 1,5 mil milions de mostres i 85.000
 * tessel·les. No és una qüestió d'optimitzar: no es pot fer.
 *
 * ── QUÈ ES POT ESTALVIAR ────────────────────────────────────────────────────
 *
 * 1. ELS AZIMUTS. Per saber si veuràs la totalitat només cal el terreny en la
 *    direcció on hi haurà el Sol. Durant una fase central de dos minuts el Sol
 *    es desplaça menys d'un grau en azimut. Amb una finestra de ±4° al voltant
 *    d'aquella direcció n'hi ha de sobres, i són 33 raigs en comptes de 1.440:
 *    43 vegades menys.
 *
 * 2. LA RESOLUCIÓ. El garbell ordena, no publica. Amb z11 al camp proper i z10
 *    al llunyà, en comptes de la piràmide z12/z11/z10 del perfil de veritat, la
 *    mostra val 57 i 114 m i les mostres per raig baixen a la meitat.
 *
 * 3. L'ABAST. Un obstacle a distància d ha de sobresortir d·tan(α) + d²/2R per
 *    tapar el Sol a altura α. Amb el relleu més gran que hi ha a la península
 *    per damunt d'un observador (~2.000 m), la distància més enllà de la qual
 *    ja no pot tapar res val 69 km amb el Sol a 1,4°, 36 km a 3° i 8 km a
 *    12,5°. `sieveRangeKm` resol aquesta equació. Amb el Sol alt, el garbell
 *    mira 15 km i prou.
 *
 * ── EL BIAIX, I CAP A ON VA ─────────────────────────────────────────────────
 *
 * Aquest horitzó és OPTIMISTA: amb 57 m de mostra, un talús de 40 m a 300 m de
 * distància (que val 7,6°) pot passar desapercebut. És deliberat i és l'única
 * direcció acceptable. Un garbell optimista deixa passar candidats dolents, que
 * el càlcul complet dels finalistes descarta. Un de pessimista descartaria
 * candidats bons, i aquests ja no els recupera ningú.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { DEG, EARTH_EQUATORIAL_RADIUS_KM, RAD } from '../astro/constants';
import type { GeoLocation } from '../astro/types';
import {
  effectiveEarthRadiusM,
  groundResolutionM,
  horizonDipDeg,
  horizonDistanceM,
  minSampleDistanceM,
  TERRESTRIAL_REFRACTION_K,
  type HorizonRing,
} from '../horizon/raycast';
import type { ElevationReader } from './types';

const EARTH_RADIUS_M = EARTH_EQUATORIAL_RADIUS_KM * 1000;

/**
 * Relleu màxim, en metres, que un observador de la península pot tenir per
 * damunt seu dins del radi que explorem.
 *
 * És el que separa una plana de la Manxa (~650 m) del cim del Mulhacén
 * (3.479 m) o de l'Aneto (3.404 m). Dos mil metres cobreix qualsevol
 * combinació real amb marge; el que hi hagi més enllà d'aquesta distància no
 * pot tapar el Sol encara que sigui Everest.
 */
export const MAX_RELIEF_M = 2000;

/** L'abast del garbell no baixa mai d'aquí: el camp proper sempre compta. */
export const MIN_SIEVE_RANGE_KM = 15;
/** Ni puja d'aquí: més enllà el model és massa gruixut per decidir res. */
export const MAX_SIEVE_RANGE_KM = 90;

/**
 * Distància més enllà de la qual res pot tapar un Sol a `sunAltitudeDeg`.
 *
 * Resol d²/(2·R_eff) + d·tan(α) − H = 0, que és la condició que un objecte
 * H metres més alt que tu, a distància d, es vegi justament a altura α un cop
 * descomptada la curvatura. El terme de curvatura no és opcional: sense ell,
 * amb el Sol a 1,4° l'equació donaria 82 km en comptes de 69, i baixaríem
 * tessel·les de terreny que no poden canviar cap resposta.
 */
export function sieveRangeKm(
  sunAltitudeDeg: number,
  reliefM: number = MAX_RELIEF_M,
  k: number = TERRESTRIAL_REFRACTION_K,
): number {
  const rEff = effectiveEarthRadiusM(k);
  const tan = Math.tan(Math.max(sunAltitudeDeg, 0) * DEG);
  const distanceM =
    (Math.sqrt(tan * tan + (2 * reliefM) / rEff) - tan) * rEff;
  return Math.min(
    MAX_SIEVE_RANGE_KM,
    Math.max(MIN_SIEVE_RANGE_KM, distanceM / 1000),
  );
}

/**
 * Anells per defecte del garbell. El primer cobreix el camp proper amb 57 m de
 * mostra i el segon arriba fins on faci falta amb 114 m. L'abast exterior el
 * retalla `clipSieveRings` amb l'altura del Sol de cada candidat.
 */
export const DEFAULT_SIEVE_RINGS: HorizonRing[] = [
  { maxDistanceKm: 15, zoom: 11 },
  { maxDistanceKm: 90, zoom: 10 },
];

/** Retalla els anells del garbell a l'abast que demana l'altura del Sol. */
export function clipSieveRings(
  rangeKm: number,
  rings: HorizonRing[] = DEFAULT_SIEVE_RINGS,
): HorizonRing[] {
  const sorted = rings.slice().sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
  const clipped: HorizonRing[] = [];
  let inner = 0;
  for (const ring of sorted) {
    if (inner >= rangeKm) break;
    clipped.push({
      zoom: ring.zoom,
      maxDistanceKm: Math.min(ring.maxDistanceKm, rangeKm),
    });
    inner = ring.maxDistanceKm;
  }
  return clipped;
}

export interface HorizonWindow {
  /** Azimut del primer raig, en graus. */
  fromAzimuthDeg: number;
  stepDeg: number;
  /** Altura aparent del terreny per raig, amb curvatura i refracció terrestre. */
  altitudes: number[];
  /** Distància en km de l'obstacle que culmina a cada raig. */
  distancesKm: number[];
  /** Fracció de mostres que han trobat dades, de 0 a 1. */
  coverage: number;
  /** Mostres llegides. Serveix per comptabilitzar el cost real. */
  samples: number;
  /** Abast exterior realment explorat, en km. */
  rangeKm: number;
}

export interface HorizonWindowOptions {
  /** Azimut al centre de la finestra, en graus. */
  centreAzimuthDeg: number;
  /** Mitja amplada de la finestra, en graus. */
  halfWidthDeg: number;
  stepDeg: number;
  rings: HorizonRing[];
  refractionK?: number;
  clampToSeaLevel?: boolean;
  elevation: ElevationReader;
}

/**
 * Traça els raigs d'una finestra d'azimuts.
 *
 * És el mateix nucli que `computeHorizonProfile` — mateixa fórmula d'altura
 * aparent, mateixa curvatura, mateix terra d'horitzó marí — però sobre un tros
 * de cercle i sense tocar la xarxa: totes les tessel·les han d'estar ja
 * baixades. Ho fem síncron a posta: amb centenars de candidats, un `await` per
 * mostra costaria més que tot el càlcul.
 *
 * @param observerElevationM cota de l'observador segons el MODEL, més l'ull.
 *   Ha de sortir del mateix model que el terreny que mirem: si ve d'un GPS i
 *   difereix 10 m, la primera mostra del raig ja dona 11° i s'emporta el màxim
 *   de tots els azimuts.
 */
export function sampleHorizonWindow(
  location: GeoLocation,
  observerElevationM: number,
  options: HorizonWindowOptions,
): HorizonWindow {
  const {
    centreAzimuthDeg,
    halfWidthDeg,
    stepDeg,
    rings,
    refractionK = TERRESTRIAL_REFRACTION_K,
    clampToSeaLevel = true,
    elevation,
  } = options;

  const rayCount = Math.max(1, Math.round((2 * halfWidthDeg) / stepDeg) + 1);
  const fromAzimuthDeg = centreAzimuthDeg - halfWidthDeg;

  const sorted = rings.slice().sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
  const rEff = effectiveEarthRadiusM(refractionK);
  const dip = horizonDipDeg(observerElevationM, refractionK);
  const dipDistanceKm = horizonDistanceM(observerElevationM, refractionK) / 1000;
  const nearFieldM = minSampleDistanceM(
    sorted.length > 0 ? sorted[0].zoom : 11,
    location.lat,
  );

  const lat0 = location.lat * DEG;
  const lon0 = location.lon * DEG;
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);

  const altitudes = new Array<number>(rayCount);
  const distancesKm = new Array<number>(rayCount);

  let samples = 0;
  let withData = 0;
  let rangeKm = 0;

  for (let i = 0; i < rayCount; i++) {
    const az = (fromAzimuthDeg + i * stepDeg) * DEG;
    const sinAz = Math.sin(az);
    const cosAz = Math.cos(az);

    let bestRise = -Infinity;
    let bestDistanceM = 0;
    let inner = 0;

    for (const ring of sorted) {
      const outerM = ring.maxDistanceKm * 1000;
      if (outerM <= inner) continue;
      const stepM = groundResolutionM(ring.zoom, location.lat);
      const start = Math.max(inner + stepM * 0.5, nearFieldM);

      for (let d = start; d <= outerM; d += stepM) {
        const delta = d / EARTH_RADIUS_M;
        const sinDelta = Math.sin(delta);
        const cosDelta = Math.cos(delta);
        const sinLat = sinLat0 * cosDelta + cosLat0 * sinDelta * cosAz;
        const lat = Math.asin(sinLat);
        const lon =
          lon0 + Math.atan2(sinAz * sinDelta * cosLat0, cosDelta - sinLat0 * sinLat);

        samples++;
        const raw = elevation(lon * RAD, lat * RAD, ring.zoom);
        if (raw === undefined) continue;
        withData++;

        const h = clampToSeaLevel ? Math.max(raw, 0) : raw;
        // Es compara el PENDENT i no l'angle: `atan` és monòtona i ens estalvia
        // una funció transcendent per mostra.
        const rise = (h - observerElevationM - (d * d) / (2 * rEff)) / d;
        if (rise > bestRise) {
          bestRise = rise;
          bestDistanceM = d;
        }
      }
      inner = outerM;
      if (outerM / 1000 > rangeKm) rangeKm = outerM / 1000;
    }

    const bestDeg = bestRise === -Infinity ? -Infinity : Math.atan(bestRise) * RAD;
    if (bestDeg > dip) {
      altitudes[i] = bestDeg;
      distancesKm[i] = bestDistanceM / 1000;
    } else {
      // Guanya l'horitzó marí: el que et tapa és la curvatura de la Terra.
      altitudes[i] = dip;
      distancesKm[i] = dipDistanceKm;
    }
  }

  return {
    fromAzimuthDeg,
    stepDeg,
    altitudes,
    distancesKm,
    coverage: samples === 0 ? 0 : withData / samples,
    samples,
    rangeKm,
  };
}

/**
 * Altura del terreny a un azimut, interpolada entre els dos raigs veïns.
 *
 * Fora de la finestra torna el raig de l'extrem més proper. No és cap
 * extrapolació sinó una retenció deliberada: qui pregunta fora de la finestra
 * pregunta per un azimut que aquesta cerca ha decidit que no importava, i
 * inventar-hi un valor seria pitjor que repetir el veí.
 */
export function windowAltitudeAt(
  profile: HorizonWindow,
  azimuthDeg: number,
): number {
  const n = profile.altitudes.length;
  if (n === 0) return 0;
  if (n === 1) return profile.altitudes[0];

  // Es desemboliquen els azimuts perquè una finestra pot creuar el nord: amb
  // el Sol ponent-se al NO, 355° i 3° han de ser veïns i no oposats.
  let delta = azimuthDeg - profile.fromAzimuthDeg;
  delta = ((delta % 360) + 360) % 360;
  if (delta > 180 + (n - 1) * profile.stepDeg * 0.5) delta -= 360;

  const position = delta / profile.stepDeg;
  if (position <= 0) return profile.altitudes[0];
  if (position >= n - 1) return profile.altitudes[n - 1];

  const i0 = Math.floor(position);
  const t = position - i0;
  return profile.altitudes[i0] * (1 - t) + profile.altitudes[i0 + 1] * t;
}

/**
 * Distància de l'obstacle que marca l'horitzó en un azimut.
 *
 * Aquí NO s'interpola: entre dos raigs veïns l'obstacle culminant pot ser un
 * turó a 2 km en un i una serralada a 60 km en l'altre, i la mitjana de 2 i 60
 * no descriu res que existeixi.
 */
export function windowDistanceAt(
  profile: HorizonWindow,
  azimuthDeg: number,
): number {
  const n = profile.distancesKm.length;
  if (n === 0) return 0;

  let delta = azimuthDeg - profile.fromAzimuthDeg;
  delta = ((delta % 360) + 360) % 360;
  if (delta > 180 + (n - 1) * profile.stepDeg * 0.5) delta -= 360;

  const index = Math.min(n - 1, Math.max(0, Math.round(delta / profile.stepDeg)));
  return profile.distancesKm[index];
}
