/**
 * La graella de candidats.
 *
 * És una graella HEXAGONAL (files desplaçades mitja cel·la), no quadrada. Dues
 * raons: cobreix la mateixa àrea amb un 13 % menys de punts per a la mateixa
 * distància màxima a un punt qualsevol, i no té direccions privilegiades — amb
 * una graella quadrada, dos punts en diagonal queden un 41 % més lluny que dos
 * de veïns, i els resultats s'alineen amb els eixos de la graella en comptes
 * d'amb el relleu.
 *
 * La graella s'ancora a una retícula global i no al punt de l'usuari. Si
 * s'ancorés al punt, el degoteig del GPS mouria tots els candidats uns metres a
 * cada cerca, els resultats ballarien i no es podria reaprofitar res del que ja
 * s'ha calculat.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { DEG, EARTH_EQUATORIAL_RADIUS_KM, RAD } from '../astro/constants';
import type { GeoLocation } from '../astro/types';
import type { ElevationReader, SpotCandidate } from './types';

/** Km d'un grau de latitud. Constant a efectes pràctics. */
const KM_PER_DEG_LAT = (Math.PI * EARTH_EQUATORIAL_RADIUS_KM) / 180;

/** Alçada d'una fila hexagonal respecte del pas horitzontal. */
const ROW_FACTOR = Math.sqrt(3) / 2;

export interface CandidateGridOptions {
  radiusKm: number;
  spacingKm: number;
  /** Lectura d'elevació. Si no n'hi ha, tots els candidats hereten la cota de l'origen. */
  elevation?: ElevationReader;
  /** Zoom amb què llegir la cota dels candidats. */
  elevationZoom?: number;
}

/**
 * Km d'un grau de longitud a una latitud donada.
 * A 42° un grau de longitud són 82,7 km i no 111: ignorar-ho estiraria la
 * graella un 34 % en direcció est-oest.
 */
export function kmPerDegLon(latDeg: number): number {
  return KM_PER_DEG_LAT * Math.cos(latDeg * DEG);
}

/**
 * Distància aproximada entre dos punts, en km.
 *
 * Equirectangular: per sota dels 100 km l'error respecte de la fórmula
 * d'haversine és de metres, i no volem pagar quatre funcions trigonomètriques
 * per candidat quan n'hi ha centenars.
 */
export function approxDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const meanLat = (lat1 + lat2) / 2;
  const dx = (lon2 - lon1) * kmPerDegLon(meanLat);
  const dy = (lat2 - lat1) * KM_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/** Rumb inicial d'un punt a un altre, en graus des del nord cap a l'est. */
export function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const meanLat = (lat1 + lat2) / 2;
  const dx = (lon2 - lon1) * kmPerDegLon(meanLat);
  const dy = (lat2 - lat1) * KM_PER_DEG_LAT;
  return ((Math.atan2(dx, dy) * RAD) % 360 + 360) % 360;
}

/** Els setze rumbs, en català, per dir «14 km al nord-oest» i no «a 312°». */
const COMPASS = [
  'nord',
  'nord-nord-est',
  'nord-est',
  'est-nord-est',
  'est',
  'est-sud-est',
  'sud-est',
  'sud-sud-est',
  'sud',
  'sud-sud-oest',
  'sud-oest',
  'oest-sud-oest',
  'oest',
  'oest-nord-oest',
  'nord-oest',
  'nord-nord-oest',
];

/** Nom del rumb en català. */
export function compassName(degrees: number): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS[index];
}

/**
 * Clau estable d'un candidat.
 *
 * Cinc decimals són ~1 m: prou per no confondre mai dos candidats i prou poc
 * per no dependre de l'últim bit d'un `double`.
 */
export function candidateId(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

/**
 * Candidats dins d'un radi al voltant d'un punt.
 *
 * L'origen s'inclou sempre com a primer candidat encara que no caigui damunt de
 * la retícula: el lloc on ja ets és el que has de poder comparar amb la resta,
 * i que no hi sortís seria absurd.
 */
export function buildCandidateGrid(
  origin: GeoLocation,
  options: CandidateGridOptions,
): SpotCandidate[] {
  const { radiusKm, spacingKm, elevation, elevationZoom = 11 } = options;
  if (spacingKm <= 0 || radiusKm <= 0) return [];

  const rowKm = spacingKm * ROW_FACTOR;

  // Ancoratge a la retícula global: la fila i la columna zero cauen sempre a la
  // mateixa latitud i longitud, visqui on visqui l'usuari.
  const anchorRow = Math.round((origin.lat * KM_PER_DEG_LAT) / rowKm);
  const rows = Math.ceil(radiusKm / rowKm);

  const cota = (lat: number, lon: number): number =>
    elevation?.(lon, lat, elevationZoom) ?? origin.elevation;

  const seen = new Set<string>();
  const candidates: SpotCandidate[] = [];

  const push = (lat: number, lon: number) => {
    const id = candidateId(lat, lon);
    if (seen.has(id)) return;
    const distanceKm = approxDistanceKm(origin.lat, origin.lon, lat, lon);
    if (distanceKm > radiusKm) return;
    seen.add(id);
    candidates.push({
      lat,
      lon,
      elevation: cota(lat, lon),
      distanceKm,
      bearingDeg: bearingDeg(origin.lat, origin.lon, lat, lon),
    });
  };

  push(origin.lat, origin.lon);

  for (let r = -rows; r <= rows; r++) {
    const rowIndex = anchorRow + r;
    const lat = (rowIndex * rowKm) / KM_PER_DEG_LAT;
    // Mitja cel·la de desplaçament a les files senars: això és l'hexàgon.
    const offsetKm = (Math.abs(rowIndex) % 2) * (spacingKm / 2);

    // A cada fila el semiample és el que queda del radi un cop consumida la
    // distància en latitud. Sense això calcularíem el quadrat que conté el
    // disc i llençaríem un 21 % dels punts.
    const dyKm = Math.abs(r * rowKm);
    if (dyKm > radiusKm) continue;
    const halfKm = Math.sqrt(radiusKm * radiusKm - dyKm * dyKm);

    // Prop del pol un grau de longitud no val res i la divisió explotaria.
    // Un metre de mínim manté la graella definida sense canviar res a la
    // península, que és on això s'ha de fer servir.
    const degPerLonRow = Math.max(kmPerDegLon(lat), 0.001);
    const anchorCol = Math.round(
      (origin.lon * degPerLonRow - offsetKm) / spacingKm,
    );
    const cols = Math.ceil(halfKm / spacingKm) + 1;

    for (let c = -cols; c <= cols; c++) {
      const xKm = (anchorCol + c) * spacingKm + offsetKm;
      push(lat, xKm / degPerLonRow);
    }
  }

  return candidates;
}
