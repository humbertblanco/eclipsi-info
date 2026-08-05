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

/**
 * Els setze rumbs, per dir «14 km al nord-oest» i no «a 312°».
 *
 * SÓN SETZE I NO VUIT a posta: amb vuit, un punt a 283° es descriu com «a
 * l'oest» i un altre a 260° també, i qui hi va per un camí de carena els busca
 * al mateix lloc. La rosa de setze parteix el que els vuit ajunten.
 *
 * LES DUES LLENGÜES VIUEN JUNTES aquí i no una a `core` i l'altra a la
 * interfície. Una llista partida en dos fitxers és la manera segura que un dia
 * en creixi una i l'altra no: el mateix defecte que ja ha calgut arreglar amb
 * el veredicte, amb el guió de la totalitat i amb la zona de l'AR.
 */
const COMPASS: Record<'ca' | 'es' | 'en', readonly string[]> = {
  ca: [
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
  ],
  es: [
    'norte',
    'nor-noreste',
    'noreste',
    'este-noreste',
    'este',
    'este-sureste',
    'sureste',
    'sur-sureste',
    'sur',
    'sur-suroeste',
    'suroeste',
    'oeste-suroeste',
    'oeste',
    'oeste-noroeste',
    'noroeste',
    'nor-noroeste',
  ],
  en: [
    'north',
    'north-northeast',
    'northeast',
    'east-northeast',
    'east',
    'east-southeast',
    'southeast',
    'south-southeast',
    'south',
    'south-southwest',
    'southwest',
    'west-southwest',
    'west',
    'west-northwest',
    'northwest',
    'north-northwest',
  ],
};

/** Nom del rumb. Per defecte, català: és l'idioma amb què va néixer el mòdul. */
export function compassName(degrees: number, locale: 'ca' | 'es' | 'en' = 'ca'): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS[locale][index];
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

/* ------------------------------------------------ el punt que representa la cel·la */

/**
 * Fraccions del pas amb què se submostreja una cel·la, per eix.
 *
 * Cinc per costat i el CENTRE PRIMER: el centre és el punt de la retícula, i
 * anar-hi primer fa que un empat exacte (terreny pla) no mogui mai el candidat.
 * El pas entre mostres surt de 0,2 × pas de graella — 400 m amb el pas de 2 km
 * per defecte — que és el gra del que aquest submostreig pot veure: un cim o
 * una platja més estrets que això poden passar desapercebuts, i es diu al
 * comentari de cost de `search.ts` en comptes d'amagar-ho.
 */
const CELL_FRACTIONS = [0, -0.4, -0.2, 0.2, 0.4] as const;

/**
 * Radi màxim del submostreig, en fraccions del pas.
 *
 * La cel·la de Voronoi d'una graella hexagonal de pas s té l'inradi a s/2:
 * quedant-nos a 0,45·s cap mostra no trepitja la cel·la del veí, i per tant
 * dos candidats no poden acabar mai damunt del mateix punt exacte.
 */
const CELL_MAX_FRACTION = 0.45;

export interface CellPeakOptions {
  /** Pas de la graella, en km. Defineix la mida de la cel·la a explorar. */
  spacingKm: number;
  elevation: ElevationReader;
  zoom: number;
}

/**
 * Veredicte d'una cel·la: el seu millor punt de terra, aigua pertot, o res.
 *
 * - `land`: hi ha terra (cota > 0). `lat`/`lon` són el màxim local trobat.
 * - `water`: el model té dades i CAP mostra puja de 0 m. Mar o làmina d'aigua
 *   al nivell del mar; no és cap lloc on plantar-se.
 * - `unknown`: cap mostra amb dades. MAI s'interpreta com a aigua: un forat
 *   del model no pot esborrar un lloc del mapa.
 */
export type CellPeak =
  | { kind: 'land'; lat: number; lon: number; elevation: number; samples: number }
  | { kind: 'water'; samples: number }
  | { kind: 'unknown'; samples: number };

/**
 * Troba el punt que ha de representar una cel·la: el seu màxim local de cota.
 *
 * ── PER QUÈ EL CIM I NO EL CENTRE ───────────────────────────────────────────
 *
 * El centre geomètric d'una cel·la és un accident de la retícula. El cim del
 * turó que hi hagi dins és el lloc amb l'horitzó geomètric més net — més
 * segons de fase central, que és exactament el que el motor puntua — i és on
 * un humà aniria de tota manera. Calcular el perfil al centre i recomanar «la
 * zona» seria enviar la gent al mig del camp amb el mirador a 400 m.
 *
 * ── PER QUÈ TAMBÉ ÉS EL FILTRE DE MAR ───────────────────────────────────────
 *
 * Les mateixes mostres responen les dues preguntes alhora. Terrarium codifica
 * el mar com a 0 o negatiu (porta batimetria), així que una cel·la on cap
 * mostra puja de 0 m és aigua i es descarta. El llindar és ESTRICTAMENT ≤ 0:
 * un sorral a +1 m amb ponent net és un lloc excel·lent per a aquests
 * eclipsis, i un tall «a prop de zero» se l'enduria. I una cel·la mixta —el
 * centre a l'aigua però la platja a dins— no es perd: el màxim local cau a la
 * platja i el candidat s'hi muda. El cim rescata el que el filtre sol negaria.
 *
 * Cost: fins a 21 lectures del model per cel·la (5×5 retallat al disc), ja
 * sense xarxa perquè les tessel·les del disc s'han baixat abans. Contra les
 * ~12.000 mostres que costa el garbell d'horitzó d'un sol candidat, és soroll.
 */
export function findCellPeak(
  lat: number,
  lon: number,
  options: CellPeakOptions,
): CellPeak {
  const { spacingKm, elevation, zoom } = options;

  let samples = 0;
  let best: { lat: number; lon: number; elevation: number } | null = null;
  let hasData = false;

  for (const fy of CELL_FRACTIONS) {
    for (const fx of CELL_FRACTIONS) {
      if (Math.hypot(fx, fy) > CELL_MAX_FRACTION + 1e-9) continue;
      const sampleLat = lat + (fy * spacingKm) / KM_PER_DEG_LAT;
      const sampleLon = lon + (fx * spacingKm) / kmPerDegLon(lat);

      samples++;
      const h = elevation(sampleLon, sampleLat, zoom);
      if (h === undefined) continue;
      hasData = true;

      // Estrictament més alt: el terreny pla deixa el candidat al centre,
      // que és el primer de la llista de fraccions.
      if (h > 0 && (best === null || h > best.elevation)) {
        best = { lat: sampleLat, lon: sampleLon, elevation: h };
      }
    }
  }

  if (best !== null) return { kind: 'land', ...best, samples };
  return hasData ? { kind: 'water', samples } : { kind: 'unknown', samples };
}

/**
 * Candidats dins d'un radi al voltant d'un punt.
 *
 * L'origen s'inclou sempre com a primer candidat encara que no caigui damunt de
 * la retícula: el lloc on ja ets és el que has de poder comparar amb la resta,
 * i que no hi sortís seria absurd. Per això mateix l'origen NO passa ni pel
 * filtre d'aigua ni pel salt al cim: és on ets, no on t'enviem.
 *
 * AMB LECTOR DE COTES, cada cel·la de retícula es representa pel seu màxim
 * local de terra (`findCellPeak`): el candidat es muda al cim de la cel·la i
 * les cel·les d'aigua (cota ≤ 0 a totes les mostres) no entren. Sense lector
 * —el cas de la cerca real, que encara no té cap tessel·la— la graella és
 * purament geomètrica i aquesta feina la fa `searchSpots` així que el relleu
 * arriba. Un candidat mudat al cim pot quedar uns centenars de metres més
 * enllà del radi si la seva cel·la cavalca la vora: es queda, perquè el que
 * promet el radi és quines CEL·LES s'exploren, no on cau el millor punt de
 * cada una.
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

  const seen = new Set<string>();
  const candidates: SpotCandidate[] = [];

  const push = (lat: number, lon: number, isOrigin: boolean) => {
    // La clau de duplicats és la del punt de RETÍCULA, abans de cap salt al
    // cim: dues cel·les diferents no comparteixen mai retícula, i el salt no
    // ha de poder fer aparèixer ni desaparèixer candidats per arrodoniment.
    const id = candidateId(lat, lon);
    if (seen.has(id)) return;
    const distanceKm = approxDistanceKm(origin.lat, origin.lon, lat, lon);
    if (distanceKm > radiusKm) return;
    seen.add(id);

    let elevationM = origin.elevation;
    if (elevation !== undefined) {
      if (isOrigin) {
        elevationM = elevation(lon, lat, elevationZoom) ?? origin.elevation;
      } else {
        const peak = findCellPeak(lat, lon, {
          spacingKm,
          elevation,
          zoom: elevationZoom,
        });
        if (peak.kind === 'water') return;
        if (peak.kind === 'land') {
          lat = peak.lat;
          lon = peak.lon;
          elevationM = peak.elevation;
        }
        // `unknown`: es queda al centre amb la cota heretada, com sempre.
      }
    }

    candidates.push({
      lat,
      lon,
      elevation: elevationM,
      distanceKm: approxDistanceKm(origin.lat, origin.lon, lat, lon),
      bearingDeg: bearingDeg(origin.lat, origin.lon, lat, lon),
    });
  };

  push(origin.lat, origin.lon, true);

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
      push(lat, xKm / degPerLonRow, false);
    }
  }

  return candidates;
}
