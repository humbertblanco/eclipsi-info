/**
 * Alineació: on t'has de posar perquè el Sol eclipsat quedi damunt d'un cim,
 * d'un castell o d'un arbre.
 *
 * ── LA GEOMETRIA ────────────────────────────────────────────────────────────
 *
 * En un instant donat el Sol té un azimut A i una altura aparent h. Perquè un
 * element quedi just a sota del Sol s'han de complir dues condicions, i les
 * dues es resolen per separat:
 *
 *   AZIMUT    l'observador ha de ser sobre la línia que passa per l'element
 *             amb el rumb OPOSAT al del Sol, perquè mirant l'element miri
 *             també cap a A.
 *   ALTURA    la punta de l'element ha de quedar a la mateixa altura APARENT
 *             que el Sol, i això fixa la distància.
 *
 * La segona condició és la inversa exacta d'`apparentAltitudeDeg` de
 * `core/horizon/raycast.ts` — la mateixa fórmula amb la mateixa curvatura i la
 * mateixa refracció terrestre, resolta per la distància en comptes de per
 * l'angle. Amb el Sol a 2° la curvatura no és un detall: per a un cim 1000 m
 * per damunt teu, la trigonometria plana et posaria a 38,2 km i la bona et
 * posa a 35,0 km. Tres quilòmetres de diferència, i el cim fora d'enquadrament.
 *
 * ── PER QUÈ NO N'HI HA PROU AMB LA GEOMETRIA ────────────────────────────────
 *
 * Aquesta és la funcionalitat per la qual la gent paga altres aplicacions, i
 * totes s'aturen aquí: et donen la línia i et desitgen sort. Amb el Sol entre
 * 1,4° i 12,5°, la línia sola menteix la meitat de les vegades, perquè entre
 * tu i l'element hi ha terreny. Per això aquí, un cop trobat el punt, es torna
 * a baixar el raig fins a l'element i es comprova que es vegi de veritat.
 *
 * La comprovació val doble: com que la punta de l'element i el Sol queden a la
 * MATEIXA altura aparent, el que tapi l'un tapa l'altre. Un sol raig respon
 * les dues preguntes.
 *
 * ── COM ES BUSCA EL PUNT ────────────────────────────────────────────────────
 *
 * No s'itera sobre la fórmula tancada: es camina la línia des de l'element cap
 * enfora i es mira on la punta creua l'altura del Sol. La raó és que el terra
 * on et poses no és pla — la teva cota canvia a cada pas i entra dins de la
 * mateixa equació que estem resolent. Caminar-la té tres avantatges: no
 * divergeix mai, troba TOTS els punts vàlids (amb terreny dentat n'hi pot
 * haver més d'un) i de passada dona el perfil del terreny que fa falta per a
 * la comprovació.
 *
 * Hi ha un teorema petit i útil amagat aquí: si un relleu del mig tapa
 * l'element, dalt d'aquell relleu hi ha un punt d'alineació més proper. Per
 * això la resposta a «em tapa una carena» sovint no és «no es pot» sinó
 * «puja-hi». La cerca ho troba sola.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { DEG, RAD, STANDARD_ATMOSPHERE } from '../astro/constants';
import { computeLocalCircumstances } from '../astro/contacts';
import { sampleAt } from '../astro/ephemeris';
import type { Atmosphere, GeoLocation, LocalCircumstances } from '../astro/types';
import {
  DEFAULT_ZOOM,
  lonLatToTilePixel,
  TILE_SIZE,
  tileKey,
  type TileId,
} from '../horizon/elevation';
import {
  apparentAltitudeDeg,
  curvatureDropM,
  destination,
  effectiveEarthRadiusM,
  groundResolutionM,
  minSampleDistanceM,
  TERRESTRIAL_REFRACTION_K,
} from '../horizon/raycast';
import { approxDistanceKm, compassName } from './grid';
import type { ElevationReader } from './types';

/* ── Tipus públics ────────────────────────────────────────────────────────── */

/** Instant de l'eclipsi amb què s'alinea l'element. */
export type AlignmentMoment = 'c1' | 'c2' | 'max' | 'c3' | 'c4';

export interface AlignmentTarget {
  /** Nom per ensenyar: «Castell de Loarre», «el pi gros». */
  name: string;
  lat: number;
  lon: number;
  /**
   * Cota absoluta de la punta, en metres. Si la saps, mana sobre tota la resta:
   * els cims catalogats i les torres tenen cota publicada i el model del
   * terreny no.
   */
  summitElevationM?: number;
  /**
   * Altura de l'element per damunt del terreny, en metres. És el camí per als
   * arbres, els campanars i els castells: el model és de terreny nu i no en sap
   * res.
   */
  heightAboveGroundM?: number;
  /** Cota del peu de l'element. Si falta, es llegeix del model. */
  groundElevationM?: number;
}

export interface AlignmentOptions {
  eclipseId: string;
  target: AlignmentTarget;
  /** Quin instant de l'eclipsi. Per defecte l'inici de la fase central. */
  moment?: AlignmentMoment;
  /** Instant explícit en ms d'època. Si hi és, mana sobre `moment`. */
  atUtcMs?: number;
  /** On ets ara. Només serveix per dir-te què et costa arribar-hi. */
  origin?: GeoLocation;
  atmosphere?: Atmosphere;
  /**
   * Lectura del model del terreny. Sense això la geometria es resol igual, però
   * NO hi ha comprovació de terreny i el resultat ho diu.
   */
  elevation?: ElevationReader;
  elevationZoom?: number;
  /** Altura de l'ull per damunt del terreny, en metres. Per defecte 1,6. */
  eyeHeightM?: number;
  /**
   * Graus que ha de quedar el CENTRE del Sol per damunt de la punta.
   *
   * Zero vol dir el disc centrat a la punta, que és la foto clàssica: mitja
   * corona per damunt del cim. Posant-hi el radi angular del Sol (~0,26°) el
   * disc queda recolzat just a sobre sense tocar-lo.
   */
  sunAboveTargetDeg?: number;
  refractionK?: number;
  /** Distància màxima admissible fins a l'element, en km. Per defecte 40. */
  maxDistanceKm?: number;
  /** Distància mínima admissible, en metres. Per defecte 3. */
  minDistanceM?: number;
  /** Cota per als trams sense dades del model. Per defecte, la del peu de l'element. */
  fallbackGroundElevationM?: number;
  /**
   * Puja a 0 m les cotes negatives. Les tessel·les porten batimetria i mar
   * endins llegiríem −2000 m: el que et tapa és la superfície de l'aigua.
   */
  clampToSeaLevel?: boolean;
  /**
   * Comprova si al punt trobat hi ha fase central. Val dues cerques d'arrels
   * (uns 10 ms) i evita enviar algú a un punt ben alineat però fora de la
   * franja. Per defecte, cert.
   */
  checkCentral?: boolean;
}

export interface AlignmentTerrainCheck {
  /** Cert si el model ha pogut dir alguna cosa. Fals sense dades del terreny. */
  checked: boolean;
  /**
   * Per què no s'ha comprovat res. Les dues raons volen dir coses molt
   * diferents i no es poden ensenyar igual: `no-model` és que no tenim terreny,
   * i `too-close` és que l'element és tan a prop que entre tu i ell no hi cap
   * ni una cel·la del model — que és un cas perfectament bo, no un problema.
   */
  skipped: 'no-model' | 'too-close' | null;
  /** Cert si res del mig arriba a tapar la punta de l'element (ni el Sol). */
  clear: boolean;
  /** Altura aparent màxima del terreny que hi ha entremig, en graus. */
  foregroundAltitudeDeg: number;
  /** Distància del punt que la marca, en km des de l'observador. */
  foregroundDistanceKm: number | null;
  /** Marge de la punta per damunt d'aquell terreny, en graus. Negatiu = tapat. */
  marginDeg: number;
  /** Metres de l'element, comptats des del peu cap amunt, que queden amagats. */
  hiddenBaseM: number;
  /** Fracció de mostres del recorregut amb dades del model, de 0 a 1. */
  coverage: number;
}

export interface AlignmentPoint {
  lat: number;
  lon: number;
  /** Cota del terreny al punt, en metres. */
  groundElevationM: number;
  /** Cota de l'ull: el terreny més `eyeHeightM`. */
  eyeElevationM: number;
  /** Distància fins a l'element, en km. */
  distanceKm: number;
  /** Cert si des d'aquí l'element es veu sense res al mig. */
  terrainClear: boolean;
}

export interface AlignmentSolution {
  ok: true;
  eclipseId: string;
  targetName: string;
  /** Instant de l'alineació, en ms d'època. */
  atUtcMs: number;
  /** Quin contacte s'ha fet servir. Null si l'instant venia donat. */
  moment: AlignmentMoment | null;

  point: AlignmentPoint;
  /** Rumb de l'element vist des del punt, en graus. Coincideix amb l'azimut del Sol. */
  bearingToTargetDeg: number;
  /** Rumb del punt vist des de l'element, en graus. */
  bearingFromTargetDeg: number;
  sunAzimuthDeg: number;
  /** Altura APARENT del Sol al punt, en graus. És la que es compara amb el terreny. */
  sunAltitudeDeg: number;
  /** Radi angular aparent del Sol, en graus. Marca com de fina és l'alineació. */
  sunAngularRadiusDeg: number;
  /** Altura aparent de la punta de l'element des del punt, en graus. */
  targetAltitudeDeg: number;
  /** Cota de la punta, en metres. */
  targetTopElevationM: number;
  /** Cota del peu de l'element, en metres. */
  targetGroundElevationM: number;

  /**
   * Metres que et pots moure endavant o endarrere abans que la punta se surti
   * del disc solar. És la tolerància que decideix si això és una foto o un
   * viatge perdut.
   *
   * És una derivada, o sigui una banda simètrica sobre una corba que no ho és:
   * la banda de veritat és un metre més llarga cap enrere que cap endavant. La
   * diferència queda per sota del que sap situar un GPS.
   */
  toleranceAlongM: number;
  /** El mateix, de costat. */
  toleranceLateralM: number;

  terrain: AlignmentTerrainCheck;
  /** Altres punts de la mateixa línia on l'alineació també es dona. */
  alternatives: AlignmentPoint[];

  /** Des d'on ets. Null si no ens has dit on ets. */
  fromOrigin: { distanceKm: number; bearingDeg: number } | null;

  /** Durada de la fase central al punt, en segons. Null si no s'ha comprovat. */
  centralDurationSec: number | null;
  /** Cert quan el marge umbral és més petit que l'error de les efemèrides. */
  edgeUncertain: boolean;
}

/** Per què no hi ha cap punt on plantar-se. */
export type AlignmentProblem =
  /** No sabem a quina cota és la punta de l'element. */
  | 'no-elevation'
  /** Des de l'element, aquell contacte no existeix. */
  | 'no-contact'
  /** En aquell instant el Sol ja no és per damunt de l'horitzó. */
  | 'sun-below-horizon'
  /** L'element no s'aixeca prou per damunt del terreny del voltant. */
  | 'target-too-low'
  /** Caldria plantar-se més lluny del límit acceptat. */
  | 'out-of-range';

export interface AlignmentImpossible {
  ok: false;
  problem: AlignmentProblem;
  /** Distància que demanaria la geometria, en km, quan en surt alguna. */
  wouldNeedKm: number | null;
  /** Frase en català que diu què passa. Mai una xifra sense sentit. */
  message: string;
}

export type AlignmentOutcome = AlignmentSolution | AlignmentImpossible;

/* ── Constants del mòdul ──────────────────────────────────────────────────── */

/**
 * Altura de l'ull per defecte, en metres.
 *
 * Aquí SÍ que val 1,6 i no 0 com al perfil d'horitzó. Al perfil interessa el
 * veredicte pessimista; aquí interessa reproduir des d'on mira de veritat una
 * càmera al trípode, perquè 1,6 m desplacen el punt d'alineació desenes de
 * metres quan el Sol és a 2°.
 */
export const DEFAULT_EYE_HEIGHT_M = 1.6;

const DEFAULT_MAX_DISTANCE_KM = 40;
const DEFAULT_MIN_DISTANCE_M = 3;

/**
 * Pas del recorregut de la línia: una fracció de la distància, acotada.
 *
 * Prop de l'element l'altura aparent de la punta cau molt de pressa i cal
 * mostrejar fi; a deu quilòmetres, 25 m de terreny no canvien res. La fracció
 * manté l'error angular del mostreig constant en comptes de constant en metres.
 */
const SCAN_STEP_FRACTION = 0.02;
const MIN_SCAN_STEP_M = 1;
const MAX_SCAN_STEP_M = 25;

/** Bisseccions per afinar un creuament un cop emmarcat entre dues mostres. */
const CROSSING_BISECTIONS = 10;

/** Creuaments que es guarden com a molt. Més enllà, la llista ja no ajuda. */
const MAX_CROSSINGS = 4;

/**
 * Distància a la qual es pren la segona mostra del Sol per modelar com canvia
 * al llarg de la línia.
 *
 * L'altura del Sol depèn del punt des d'on mires: allunyar-se 10 km cap al Sol
 * la puja gairebé 0,09°, que amb el Sol baix són centenars de metres de
 * distància d'alineació. Amb dues mostres n'hi ha prou perquè, en aquesta
 * escala, la variació és recta.
 */
const SUN_MODEL_SPAN_M = 20_000;

/** Passades per encaixar el rumb. Dues ja tanquen; la tercera és per si de cas. */
const BEARING_PASSES = 3;
/** Error de rumb per sota del qual ja no val la pena tornar-hi, en graus. */
const BEARING_TOLERANCE_DEG = 0.002;

const MOMENT_LABEL: Record<AlignmentMoment, string> = {
  c1: 'al primer contacte',
  c2: 'a l’inici de la fase central',
  max: 'al màxim de l’eclipsi',
  c3: 'al final de la fase central',
  c4: 'al quart contacte',
};

/** El mateix instant dit com a nom, per encaixar-lo dins d'una negació. */
const MOMENT_NOUN: Record<AlignmentMoment, string> = {
  c1: 'primer contacte',
  c2: 'fase central',
  max: 'màxim',
  c3: 'fase central',
  c4: 'quart contacte',
};

/* ── Geometria pura ───────────────────────────────────────────────────────── */

/**
 * A quina distància t'has de posar perquè un punt `riseM` metres per damunt
 * dels teus ulls es vegi a `apparentAltDeg` graus.
 *
 * És la inversa exacta d'`apparentAltitudeDeg`. Aïllant la distància de
 *
 *     tan(alt) = (rise − d²/(2·R_eff)) / d
 *
 * queda una equació de segon grau en d amb una única arrel positiva:
 *
 *     d = R_eff · ( −tan(alt) + √(tan²(alt) + 2·rise/R_eff) )
 *
 * Torna `null` quan no hi ha solució, que passa sempre que l'element no queda
 * per damunt teu: cap distància fa pujar una cosa que tens a sota.
 */
export function alignmentDistanceM(
  riseM: number,
  apparentAltDeg: number,
  k: number = TERRESTRIAL_REFRACTION_K,
): number | null {
  const rEff = effectiveEarthRadiusM(k);
  const t = Math.tan(apparentAltDeg * DEG);
  const discriminant = t * t + (2 * riseM) / rEff;
  if (discriminant < 0) return null;

  const d = rEff * (-t + Math.sqrt(discriminant));
  return Number.isFinite(d) && d > 0 ? d : null;
}

/**
 * Quants metres es mou el punt d'alineació per cada grau que es mogui l'altura
 * del Sol. Surt de derivar la fórmula de sobre, i és sempre negatiu: si el Sol
 * puja, el punt s'acosta.
 *
 * Aquest número és el que converteix «el Sol fa mig grau» en «tens vint metres
 * de marge».
 */
function distancePerDegreeM(
  distanceM: number,
  apparentAltDeg: number,
  k: number,
): number {
  const rEff = effectiveEarthRadiusM(k);
  const altRad = apparentAltDeg * DEG;
  const t = Math.tan(altRad);
  const sec2 = 1 / (Math.cos(altRad) * Math.cos(altRad));
  const denominator = distanceM / rEff + t;
  if (Math.abs(denominator) < 1e-12) return 0;
  return (-distanceM * sec2 * DEG) / denominator;
}

/** Normalitza un angle a [0, 360). */
function normalizeDeg(value: number): number {
  return ((value % 360) + 360) % 360;
}

/** Diferència d'angles portada a (−180, 180]. */
function wrapDeg(value: number): number {
  const wrapped = normalizeDeg(value);
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

/**
 * Rumb inicial d'un punt a un altre sobre el cercle màxim.
 *
 * Aquí NO serveix l'aproximació equirectangular de `grid.ts`: a 42° de latitud,
 * deu quilòmetres cap a l'est fan girar els meridians 0,08°, que és un terç del
 * radi del Sol. Just la mena d'error que treu el cim de dins del disc.
 */
export function initialBearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = lat1 * DEG;
  const phi2 = lat2 * DEG;
  const dLon = (lon2 - lon1) * DEG;

  const y = Math.sin(dLon) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);

  return normalizeDeg(Math.atan2(y, x) * RAD);
}

/* ── Tessel·les que fan falta ─────────────────────────────────────────────── */

/**
 * Tessel·les que cobreixen el passadís entre dos punts.
 *
 * `elevationAtSync` només llegeix el que ja s'ha baixat, i aquest mòdul no toca
 * la xarxa. La manera de fer-lo servir de veritat és en dues tacades: primer
 * `solveAlignment` sense lector d'elevació (geometria sola, amb la cota de
 * l'element que ja tinguis), després baixar aquestes tessel·les, i llavors
 * tornar-lo a cridar amb el lector perquè comprovi el terreny.
 *
 * Es mostreja cada quart de tessel·la i s'hi afegeix un marge d'una tessel·la a
 * cada costat: la línia pot passar arran de la cantonada de dues tessel·les i
 * el mostreig sol no ho veuria.
 */
export function tilesAlongLine(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  zoom: number = DEFAULT_ZOOM,
  marginTiles = 1,
): TileId[] {
  const distanceM = approxDistanceKm(from.lat, from.lon, to.lat, to.lon) * 1000;
  const bearing = initialBearingDeg(from.lat, from.lon, to.lat, to.lon);
  const stepM = Math.max(1, (TILE_SIZE / 4) * groundResolutionM(zoom, from.lat));

  const seen = new Set<string>();
  const tiles: TileId[] = [];
  const n = 2 ** zoom;

  const add = (lat: number, lon: number): void => {
    const centre = lonLatToTilePixel(lon, lat, zoom);
    for (let dx = -marginTiles; dx <= marginTiles; dx++) {
      for (let dy = -marginTiles; dy <= marginTiles; dy++) {
        const y = centre.y + dy;
        if (y < 0 || y >= n) continue;
        const x = ((((centre.x + dx) % n) + n) % n);
        const tile: TileId = { z: zoom, x, y };
        const key = tileKey(tile);
        if (seen.has(key)) continue;
        seen.add(key);
        tiles.push(tile);
      }
    }
  };

  add(from.lat, from.lon);
  for (let d = stepM; d < distanceM; d += stepM) {
    const p = destination(from.lat, from.lon, bearing, d);
    add(p.lat, p.lon);
  }
  add(to.lat, to.lon);

  return tiles;
}

/* ── Comprovació de terreny ───────────────────────────────────────────────── */

export interface LineOfSightOptions {
  elevation: ElevationReader;
  elevationZoom?: number;
  refractionK?: number;
  clampToSeaLevel?: boolean;
  /** Cota que s'assumeix als trams sense dades del model. */
  fallbackGroundElevationM?: number;
  /** Cota del peu de l'element, per dir quants metres en queden amagats. */
  targetGroundElevationM?: number;
}

function emptyTerrainCheck(
  skipped: 'no-model' | 'too-close' = 'no-model',
): AlignmentTerrainCheck {
  return {
    checked: false,
    skipped,
    clear: true,
    foregroundAltitudeDeg: 0,
    foregroundDistanceKm: null,
    marginDeg: 0,
    hiddenBaseM: 0,
    coverage: 0,
  };
}

/**
 * Comprova que des d'un punt es vegi de veritat la punta d'un element.
 *
 * Baixa el raig que va de l'ull a la punta i mira si algun tros de terreny del
 * mig s'hi posa pel davant. És el pas que converteix una línia sobre un mapa en
 * una foto.
 *
 * Dues exclusions, i cap de les dues és arbitrària:
 *
 *  - El camp proper de l'observador (dues cel·les del model). A cinquanta
 *    metres, deu metres de desnivell són 11°: allà el que llegim no és terreny,
 *    és el que s'ha inventat la interpolació entre quatre píxels.
 *  - L'última cel·la i mitja abans de l'element. La cel·la del model que conté
 *    el cim CONTÉ el cim: si no l'excloguéssim, tot cim es taparia a si mateix.
 */
export function checkLineOfSight(
  observer: { lat: number; lon: number; eyeElevationM: number },
  target: { lat: number; lon: number; topElevationM: number },
  options: LineOfSightOptions,
): AlignmentTerrainCheck {
  const {
    elevation,
    elevationZoom = DEFAULT_ZOOM,
    refractionK = TERRESTRIAL_REFRACTION_K,
    clampToSeaLevel = true,
    fallbackGroundElevationM = target.topElevationM,
    targetGroundElevationM = target.topElevationM,
  } = options;

  const distanceM =
    approxDistanceKm(observer.lat, observer.lon, target.lat, target.lon) * 1000;
  if (!(distanceM > 0)) return emptyTerrainCheck('too-close');

  const bearing = initialBearingDeg(
    observer.lat,
    observer.lon,
    target.lat,
    target.lon,
  );

  const nearFieldM = minSampleDistanceM(elevationZoom, observer.lat);
  const targetCellM = 1.5 * groundResolutionM(elevationZoom, target.lat);
  const lastM = distanceM - targetCellM;

  const targetAltitudeDeg = apparentAltitudeDeg(
    target.topElevationM,
    observer.eyeElevationM,
    distanceM,
    refractionK,
  );

  if (lastM <= nearFieldM) {
    // Massa a prop: entre l'ull i l'element no hi cap ni una mostra fiable del
    // model. No hi ha res a dir, i dir que està lliure seria inventar-s'ho.
    return emptyTerrainCheck('too-close');
  }

  const stepM = Math.min(MAX_SCAN_STEP_M, Math.max(2, distanceM / 600));

  let bestAltitudeDeg = -Infinity;
  let bestDistanceM = 0;
  let sampled = 0;
  let withData = 0;

  for (let s = nearFieldM; s <= lastM; s += stepM) {
    const p = destination(observer.lat, observer.lon, bearing, s);
    const raw = elevation(p.lon, p.lat, elevationZoom);
    sampled++;

    let ground: number;
    if (raw === undefined) {
      ground = fallbackGroundElevationM;
    } else {
      withData++;
      ground = clampToSeaLevel ? Math.max(raw, 0) : raw;
    }

    const alt = apparentAltitudeDeg(ground, observer.eyeElevationM, s, refractionK);
    if (alt > bestAltitudeDeg) {
      bestAltitudeDeg = alt;
      bestDistanceM = s;
    }
  }

  if (sampled === 0 || bestAltitudeDeg === -Infinity) {
    return emptyTerrainCheck('too-close');
  }

  // Cap mostra amb dades no és «està lliure»: és que no ho hem mirat. Dir-ho
  // d'una altra manera seria donar per bo un camí que no hem vist mai.
  if (withData === 0) return emptyTerrainCheck('no-model');

  // Fins on arriba la silueta del terreny quan la prolonguem a la distància de
  // l'element: tot el que quedi per sota d'aquesta cota, no el veus.
  const sightlineElevationM =
    observer.eyeElevationM +
    Math.tan(bestAltitudeDeg * DEG) * distanceM +
    curvatureDropM(distanceM, refractionK);

  return {
    checked: true,
    skipped: null,
    clear: bestAltitudeDeg < targetAltitudeDeg,
    foregroundAltitudeDeg: bestAltitudeDeg,
    foregroundDistanceKm: bestDistanceM / 1000,
    marginDeg: targetAltitudeDeg - bestAltitudeDeg,
    hiddenBaseM: Math.max(0, sightlineElevationM - targetGroundElevationM),
    coverage: withData / sampled,
  };
}

/* ── Recorregut de la línia ───────────────────────────────────────────────── */

/** Com canvia el Sol al llarg de la línia. Recte, i n'hi ha prou. */
interface SunLineModel {
  azimuthDeg: number;
  altitudeDeg: number;
  azimuthPerMDeg: number;
  altitudePerMDeg: number;
  angularRadiusDeg: number;
}

function sunAzimuthAtM(model: SunLineModel, distanceM: number): number {
  return model.azimuthDeg + model.azimuthPerMDeg * distanceM;
}

function sunAltitudeAtM(model: SunLineModel, distanceM: number): number {
  return model.altitudeDeg + model.altitudePerMDeg * distanceM;
}

interface ScanContext {
  targetLat: number;
  targetLon: number;
  backAzimuthDeg: number;
  topElevationM: number;
  eyeHeightM: number;
  sun: SunLineModel;
  sunAboveTargetDeg: number;
  refractionK: number;
  elevationZoom: number;
  clampToSeaLevel: boolean;
  fallbackGroundElevationM: number;
  elevation: ElevationReader | undefined;
}

interface LinePointReading {
  lat: number;
  lon: number;
  groundElevationM: number;
  hasData: boolean;
}

function readGroundAt(context: ScanContext, distanceM: number): LinePointReading {
  const p = destination(
    context.targetLat,
    context.targetLon,
    context.backAzimuthDeg,
    distanceM,
  );
  const raw = context.elevation?.(p.lon, p.lat, context.elevationZoom);
  if (raw === undefined) {
    return {
      lat: p.lat,
      lon: p.lon,
      groundElevationM: context.fallbackGroundElevationM,
      hasData: false,
    };
  }
  return {
    lat: p.lat,
    lon: p.lon,
    groundElevationM: context.clampToSeaLevel ? Math.max(raw, 0) : raw,
    hasData: true,
  };
}

/**
 * Diferència, en graus, entre l'altura aparent de la punta vista des de la
 * distància `distanceM` i l'altura on volem el Sol.
 *
 * Positiva = encara ets massa a prop i la punta et queda per damunt del Sol.
 * L'arrel d'aquesta funció és tot el problema.
 */
function altitudeGapDeg(context: ScanContext, distanceM: number): number {
  const reading = readGroundAt(context, distanceM);
  const eye = reading.groundElevationM + context.eyeHeightM;
  const targetDeg = apparentAltitudeDeg(
    context.topElevationM,
    eye,
    distanceM,
    context.refractionK,
  );
  const wantedDeg = sunAltitudeAtM(context.sun, distanceM) - context.sunAboveTargetDeg;
  return targetDeg - wantedDeg;
}

function scanStepM(distanceM: number): number {
  return Math.min(
    MAX_SCAN_STEP_M,
    Math.max(MIN_SCAN_STEP_M, distanceM * SCAN_STEP_FRACTION),
  );
}

interface LineScan {
  /** Distàncies, en metres des de l'element, on la punta creua l'altura del Sol. */
  crossingsM: number[];
  /**
   * Diferència a la primera mostra. Si ja és negativa, l'element neix per sota
   * de l'altura del Sol i no hi ha res a fer; si és positiva i no hi ha cap
   * creuament, el que passa és que el punt cau més enllà del límit.
   */
  firstGapDeg: number;
}

/**
 * Camina la línia des de l'element cap enfora i apunta on la punta creua
 * l'altura del Sol.
 *
 * Es guarden tots els creuaments de positiu a negatiu, no només el primer: amb
 * terreny dentat, la punta pot tornar a quedar per damunt del Sol quan el terra
 * puja (una carena) i tornar a caure després. Cada creuament és un lloc real on
 * plantar-se.
 */
function scanLine(
  context: ScanContext,
  minDistanceM: number,
  maxDistanceM: number,
): LineScan {
  const crossingsM: number[] = [];

  let prevD = minDistanceM;
  let prevGap = altitudeGapDeg(context, prevD);
  const firstGapDeg = prevGap;

  for (let d = prevD + scanStepM(prevD); d <= maxDistanceM; d += scanStepM(d)) {
    const gap = altitudeGapDeg(context, d);

    if (prevGap >= 0 && gap < 0 && crossingsM.length < MAX_CROSSINGS) {
      crossingsM.push(refineCrossingM(context, prevD, d));
    }

    prevD = d;
    prevGap = gap;
  }

  return { crossingsM, firstGapDeg };
}

/**
 * Afina un creuament ja emmarcat. Bissecció i no interpolació: entre dues
 * mostres el terra no és recte, i el que ens interessa és la distància on
 * l'equació es compleix amb el terreny que hi ha de veritat.
 */
function refineCrossingM(context: ScanContext, loM: number, hiM: number): number {
  let lo = loM;
  let hi = hiM;
  for (let i = 0; i < CROSSING_BISECTIONS; i++) {
    const mid = (lo + hi) / 2;
    if (altitudeGapDeg(context, mid) >= 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ── Resolució ────────────────────────────────────────────────────────────── */

function contactMs(
  circumstances: LocalCircumstances,
  moment: AlignmentMoment,
): number | undefined {
  return circumstances.contacts[moment]?.time.getTime();
}

interface SolvedPoint {
  distanceM: number;
  backAzimuthDeg: number;
  reading: LinePointReading;
  eyeElevationM: number;
  terrain: AlignmentTerrainCheck;
  sunAzimuthDeg: number;
  sunAltitudeDeg: number;
  sunAngularRadiusDeg: number;
  alternatives: SolvedPoint[];
}

interface SolveFailure {
  problem: AlignmentProblem;
  wouldNeedKm: number | null;
  sunAltitudeDeg: number;
}

/**
 * Troba el punt per a un instant fixat.
 *
 * El rumb i la distància es resolen alternadament: es camina la línia amb el
 * rumb actual, i amb el punt que en surt es corregeix el rumb perquè mirant
 * l'element es miri exactament cap al Sol. Dues passades ja tanquen, perquè
 * l'error de rumb d'una passada és de centèsimes de grau.
 */
function solveAtInstant(
  options: AlignmentOptions,
  atUtcMs: number,
  topElevationM: number,
  targetGroundElevationM: number,
): { point: SolvedPoint } | { failure: SolveFailure } {
  const {
    target,
    atmosphere = STANDARD_ATMOSPHERE,
    elevation,
    elevationZoom = DEFAULT_ZOOM,
    eyeHeightM = DEFAULT_EYE_HEIGHT_M,
    sunAboveTargetDeg = 0,
    refractionK = TERRESTRIAL_REFRACTION_K,
    maxDistanceKm = DEFAULT_MAX_DISTANCE_KM,
    minDistanceM = DEFAULT_MIN_DISTANCE_M,
    fallbackGroundElevationM = targetGroundElevationM,
    clampToSeaLevel = true,
  } = options;

  const time = new Date(atUtcMs);
  const targetLocation: GeoLocation = {
    lat: target.lat,
    lon: target.lon,
    elevation: targetGroundElevationM,
  };
  const sunHere = sampleAt(time, targetLocation, atmosphere).sun;

  // Només el Sol post és un problema seu. Si el que no hi cap és el
  // desplaçament que has demanat, el recorregut ho dirà sol com a distància
  // fora de rang, que és el que passa de veritat.
  if (sunHere.altitudeApparent <= 0) {
    return {
      failure: {
        problem: 'sun-below-horizon',
        wouldNeedKm: null,
        sunAltitudeDeg: sunHere.altitudeApparent,
      },
    };
  }

  const maxDistanceM = maxDistanceKm * 1000;
  let backAzimuthDeg = normalizeDeg(sunHere.azimuth + 180);
  let lastFailure: SolveFailure | null = null;

  for (let pass = 0; pass < BEARING_PASSES; pass++) {
    // La segona mostra del Sol es pren sobre la línia que estem provant: així
    // el model recull tant com canvia l'altura del Sol com com giren els
    // meridians al llarg del recorregut.
    const far = destination(
      target.lat,
      target.lon,
      backAzimuthDeg,
      SUN_MODEL_SPAN_M,
    );
    const sunFar = sampleAt(
      time,
      { lat: far.lat, lon: far.lon, elevation: targetGroundElevationM },
      atmosphere,
    ).sun;

    const sun: SunLineModel = {
      azimuthDeg: sunHere.azimuth,
      altitudeDeg: sunHere.altitudeApparent,
      azimuthPerMDeg: wrapDeg(sunFar.azimuth - sunHere.azimuth) / SUN_MODEL_SPAN_M,
      altitudePerMDeg:
        (sunFar.altitudeApparent - sunHere.altitudeApparent) / SUN_MODEL_SPAN_M,
      angularRadiusDeg: sunHere.angularRadius,
    };

    const context: ScanContext = {
      targetLat: target.lat,
      targetLon: target.lon,
      backAzimuthDeg,
      topElevationM,
      eyeHeightM,
      sun,
      sunAboveTargetDeg,
      refractionK,
      elevationZoom,
      clampToSeaLevel,
      fallbackGroundElevationM,
      elevation,
    };

    const scan = scanLine(context, minDistanceM, maxDistanceM);

    if (scan.crossingsM.length === 0) {
      // Cap creuament vol dir una de dues coses ben diferents, i s'han de
      // distingir: o l'element ja neix per sota de l'altura del Sol (massa
      // baix) o encara hi queda per damunt al final del recorregut (massa
      // lluny).
      const problem: AlignmentProblem =
        scan.firstGapDeg < 0 ? 'target-too-low' : 'out-of-range';
      const wouldNeedM =
        problem === 'out-of-range'
          ? alignmentDistanceM(
              topElevationM -
                (readGroundAt(context, maxDistanceM).groundElevationM + eyeHeightM),
              sunAltitudeAtM(sun, maxDistanceM) - sunAboveTargetDeg,
              refractionK,
            )
          : null;
      lastFailure = {
        problem,
        wouldNeedKm: wouldNeedM === null ? null : wouldNeedM / 1000,
        sunAltitudeDeg: sunHere.altitudeApparent,
      };
      break;
    }

    const points = scan.crossingsM.map((distanceM) => {
      const reading = readGroundAt(context, distanceM);
      const eyeElevationM = reading.groundElevationM + eyeHeightM;
      const terrain = elevation
        ? checkLineOfSight(
            { lat: reading.lat, lon: reading.lon, eyeElevationM },
            { lat: target.lat, lon: target.lon, topElevationM },
            {
              elevation,
              elevationZoom,
              refractionK,
              clampToSeaLevel,
              fallbackGroundElevationM,
              targetGroundElevationM,
            },
          )
        : emptyTerrainCheck();

      const point: SolvedPoint = {
        distanceM,
        backAzimuthDeg,
        reading,
        eyeElevationM,
        terrain,
        sunAzimuthDeg: normalizeDeg(sunAzimuthAtM(sun, distanceM)),
        sunAltitudeDeg: sunAltitudeAtM(sun, distanceM),
        sunAngularRadiusDeg: sun.angularRadiusDeg,
        alternatives: [],
      };
      return point;
    });

    // El punt bo és el més proper a l'element des del qual l'element es vegi de
    // veritat. Si no n'hi ha cap de net, ens quedem el primer i ho diem: val
    // més un punt amb l'avís que amagar que no serveix.
    const chosen = points.find((p) => p.terrain.clear) ?? points[0];
    chosen.alternatives = points.filter((p) => p !== chosen);

    // Correcció del rumb: mirant des del punt cap a l'element, el rumb ha de
    // ser el del Sol. Si no ho és, girem la línia el que falti.
    const forward = initialBearingDeg(
      chosen.reading.lat,
      chosen.reading.lon,
      target.lat,
      target.lon,
    );
    const errorDeg = wrapDeg(chosen.sunAzimuthDeg - forward);

    if (Math.abs(errorDeg) < BEARING_TOLERANCE_DEG || pass === BEARING_PASSES - 1) {
      return { point: chosen };
    }
    backAzimuthDeg = normalizeDeg(backAzimuthDeg + errorDeg);
  }

  return {
    failure:
      lastFailure ?? {
        problem: 'out-of-range',
        wouldNeedKm: null,
        sunAltitudeDeg: 0,
      },
  };
}

function impossible(
  problem: AlignmentProblem,
  wouldNeedKm: number | null,
  message: string,
): AlignmentImpossible {
  return { ok: false, problem, wouldNeedKm, message };
}

function toAlignmentPoint(point: SolvedPoint): AlignmentPoint {
  return {
    lat: point.reading.lat,
    lon: point.reading.lon,
    groundElevationM: point.reading.groundElevationM,
    eyeElevationM: point.eyeElevationM,
    distanceKm: point.distanceM / 1000,
    terrainClear: point.terrain.clear,
  };
}

/**
 * On plantar-se perquè el Sol quedi damunt de l'element.
 *
 * Fa dues passades sobre els contactes: la primera els calcula al peu de
 * l'element per saber quin instant busquem, i la segona els torna a calcular al
 * punt trobat. No és cap floritura. L'instant de C2 es mou uns quants segons en
 * pocs quilòmetres, i cada segon el Sol baixa 0,004°: amb el Sol a 2° i un
 * element 100 m per damunt teu, això són prop de sis metres de punt d'alineació
 * per cada segon de diferència.
 */
export function solveAlignment(options: AlignmentOptions): AlignmentOutcome {
  const {
    eclipseId,
    target,
    moment = 'c2',
    atUtcMs,
    origin,
    atmosphere = STANDARD_ATMOSPHERE,
    elevation,
    elevationZoom = DEFAULT_ZOOM,
    checkCentral = true,
  } = options;

  // --- Cotes de l'element ---------------------------------------------------
  const demGround = elevation?.(target.lon, target.lat, elevationZoom);
  const targetGroundElevationM =
    target.groundElevationM ??
    demGround ??
    (target.summitElevationM !== undefined
      ? target.summitElevationM - (target.heightAboveGroundM ?? 0)
      : undefined);

  if (targetGroundElevationM === undefined) {
    return impossible(
      'no-elevation',
      null,
      `No sabem a quina cota és ${target.name}. Sense el model del terreny ni una cota donada no hi ha res a calcular.`,
    );
  }

  const topElevationM =
    target.summitElevationM ??
    targetGroundElevationM + (target.heightAboveGroundM ?? 0);

  // --- Instant --------------------------------------------------------------
  const targetLocation: GeoLocation = {
    lat: target.lat,
    lon: target.lon,
    elevation: targetGroundElevationM,
  };

  let usedMoment: AlignmentMoment | null = null;
  let instantMs: number;

  if (atUtcMs !== undefined) {
    instantMs = atUtcMs;
  } else {
    const atTarget = computeLocalCircumstances(eclipseId, targetLocation, atmosphere);
    const ms = contactMs(atTarget, moment);
    if (ms === undefined) {
      return impossible(
        'no-contact',
        null,
        `Des ${of(target.name)} no hi ha ${MOMENT_NOUN[moment]}: l’eclipsi no arriba a aquesta fase en aquest punt.`,
      );
    }
    usedMoment = moment;
    instantMs = ms;
  }

  // --- Primera solució ------------------------------------------------------
  let solved = solveAtInstant(options, instantMs, topElevationM, targetGroundElevationM);
  if ('failure' in solved) {
    return failureToOutcome(solved.failure, target.name, topElevationM, options);
  }

  // --- Segona passada, amb els contactes al punt trobat ---------------------
  let centralDurationSec: number | null = null;
  let edgeUncertain = false;

  if (checkCentral || usedMoment !== null) {
    const pointLocation: GeoLocation = {
      lat: solved.point.reading.lat,
      lon: solved.point.reading.lon,
      elevation: solved.point.reading.groundElevationM,
    };
    const atPoint = computeLocalCircumstances(eclipseId, pointLocation, atmosphere);
    centralDurationSec = atPoint.centralDurationSec;
    edgeUncertain = atPoint.edgeUncertain;

    if (usedMoment !== null) {
      const refinedMs = contactMs(atPoint, usedMoment);
      if (refinedMs !== undefined && Math.abs(refinedMs - instantMs) > 200) {
        instantMs = refinedMs;
        const again = solveAtInstant(
          options,
          instantMs,
          topElevationM,
          targetGroundElevationM,
        );
        if (!('failure' in again)) solved = again;
      }
    }
  }

  const point = solved.point;

  // --- Toleràncies ----------------------------------------------------------
  const refractionK = options.refractionK ?? TERRESTRIAL_REFRACTION_K;
  const radius = point.sunAngularRadiusDeg;
  const toleranceAlongM = Math.abs(
    distancePerDegreeM(point.distanceM, point.sunAltitudeDeg, refractionK) * radius,
  );
  const toleranceLateralM = point.distanceM * Math.tan(radius * DEG);

  const bearingToTargetDeg = initialBearingDeg(
    point.reading.lat,
    point.reading.lon,
    target.lat,
    target.lon,
  );

  return {
    ok: true,
    eclipseId,
    targetName: target.name,
    atUtcMs: instantMs,
    moment: usedMoment,
    point: toAlignmentPoint(point),
    bearingToTargetDeg,
    bearingFromTargetDeg: point.backAzimuthDeg,
    sunAzimuthDeg: point.sunAzimuthDeg,
    sunAltitudeDeg: point.sunAltitudeDeg,
    sunAngularRadiusDeg: radius,
    targetAltitudeDeg: apparentAltitudeDeg(
      topElevationM,
      point.eyeElevationM,
      point.distanceM,
      refractionK,
    ),
    targetTopElevationM: topElevationM,
    targetGroundElevationM,
    toleranceAlongM,
    toleranceLateralM,
    terrain: point.terrain,
    alternatives: point.alternatives.map(toAlignmentPoint),
    fromOrigin:
      origin === undefined
        ? null
        : {
            distanceKm: approxDistanceKm(
              origin.lat,
              origin.lon,
              point.reading.lat,
              point.reading.lon,
            ),
            bearingDeg: initialBearingDeg(
              origin.lat,
              origin.lon,
              point.reading.lat,
              point.reading.lon,
            ),
          },
    centralDurationSec,
    edgeUncertain,
  };
}

function failureToOutcome(
  failure: SolveFailure,
  name: string,
  topElevationM: number,
  options: AlignmentOptions,
): AlignmentImpossible {
  const maxKm = options.maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM;

  switch (failure.problem) {
    case 'sun-below-horizon':
      return impossible(
        'sun-below-horizon',
        null,
        `En aquell instant el Sol és a ${formatDeg(failure.sunAltitudeDeg)} d’altura aparent. Per sota de l’horitzó no hi ha cap punt des d’on quedi damunt ${of(name)}.`,
      );
    case 'target-too-low':
      return impossible(
        'target-too-low',
        null,
        `Amb el Sol a ${formatDeg(failure.sunAltitudeDeg)}, ${name} no s’aixeca prou per damunt del terreny del voltant: la punta ja neix per sota del Sol i cap distància no l’hi puja.`,
      );
    case 'out-of-range':
      return impossible(
        'out-of-range',
        failure.wouldNeedKm,
        failure.wouldNeedKm === null
          ? `Amb el Sol a ${formatDeg(failure.sunAltitudeDeg)}, la punta ${of(name)} (${Math.round(topElevationM)} m) encara queda per damunt del Sol a ${maxKm} km. La curvatura de la Terra rebaixa l’element més de pressa del que el Sol hi baixa.`
          : `Amb el Sol a ${formatDeg(failure.sunAltitudeDeg)} caldria plantar-se a uns ${formatKm(failure.wouldNeedKm)} ${of(name)}, més enllà del límit de ${maxKm} km que has demanat.`,
      );
    // Els altres problemes es detecten abans d'arribar aquí.
    case 'no-elevation':
    case 'no-contact':
      return impossible(failure.problem, null, `No es pot calcular l’alineació amb ${name}.`);
  }
}

/* ── Text ─────────────────────────────────────────────────────────────────── */

function formatDeg(value: number): string {
  return `${value.toFixed(2)}°`;
}

function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(2)} km`;
  return `${km.toFixed(1)} km`;
}

function formatMeters(m: number): string {
  return m < 10 ? `${m.toFixed(1)} m` : `${Math.round(m)} m`;
}

/**
 * «cap al nord», però «cap a l'oest». Els rumbs que comencen per vocal volen
 * article apostrofat, i escriure-ho malament fa que tot el text soni a màquina.
 */
function towards(bearingDeg: number): string {
  const name = compassName(bearingDeg);
  return /^[aeiou]/.test(name) ? `cap a l’${name}` : `cap al ${name}`;
}

/**
 * «de» més el nom de l'element, amb la contracció feta.
 *
 * En català «de el castell» no existeix: és «del castell». El nom ens arriba de
 * fora amb article o sense — «el castell», «la torre», «l'ermita», «Loarre» —,
 * i la contracció s'ha de resoldre aquí o el text queda escrit a martellades.
 */
function of(name: string): string {
  if (/^el /i.test(name)) return `del ${name.slice(3)}`;
  if (/^els /i.test(name)) return `dels ${name.slice(4)}`;
  return `de ${name}`;
}

function formatSeconds(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

export interface AlignmentText {
  /** Una frase amb el que passa. També és el text del cas sense solució. */
  headline: string;
  /** Coordenades del punt, llestes per copiar a un mapa. Null si no n'hi ha. */
  coordinates: string | null;
  /** Com arribar-hi des d'on ets. Null si no ens has dit on ets. */
  approach: string | null;
  /** Quant marge de posició tens. Null si no hi ha punt. */
  tolerance: string | null;
  /** Què diu el terreny. Null si no hi ha punt. */
  terrain: string | null;
  /** Avisos, un per línia. */
  caveats: string[];
}

/**
 * El resultat, en català i llest per ensenyar.
 *
 * Aquí és on la incertesa es diu en veu alta: la tolerància de posició, el
 * terreny que no es veu, el model que no porta ni arbres ni edificis. Un punt
 * amb cinc decimals i sense cap d'aquestes frases seria una precisió falsa.
 */
export function describeAlignment(outcome: AlignmentOutcome): AlignmentText {
  if (!outcome.ok) {
    return {
      headline: outcome.message,
      coordinates: null,
      approach: null,
      tolerance: null,
      terrain: null,
      caveats: [],
    };
  }

  const when =
    outcome.moment === null ? 'a l’instant demanat' : MOMENT_LABEL[outcome.moment];

  const headline =
    `${when.charAt(0).toUpperCase()}${when.slice(1)}, el Sol queda damunt` +
    ` ${of(outcome.targetName)} a ${formatDeg(outcome.sunAltitudeDeg)} d’altura,` +
    ` ${towards(outcome.sunAzimuthDeg)}.`;

  const coordinates = `${outcome.point.lat.toFixed(5)}, ${outcome.point.lon.toFixed(5)}`;

  const fromTarget =
    `El punt és a ${formatKm(outcome.point.distanceKm)} ${of(outcome.targetName)},` +
    ` ${towards(outcome.bearingFromTargetDeg)}, a` +
    ` ${Math.round(outcome.point.groundElevationM)} m d’altitud.`;

  const approach =
    outcome.fromOrigin === null
      ? fromTarget
      : `A ${formatKm(outcome.fromOrigin.distanceKm)} d’on ets,` +
        ` ${towards(outcome.fromOrigin.bearingDeg)}, en línia recta.` +
        ` ${fromTarget}`;

  const tolerance =
    `Tens ${formatMeters(outcome.toleranceAlongM)} de marge endavant o endarrere i` +
    ` ${formatMeters(outcome.toleranceLateralM)} de costat. Més enllà, la punta se surt del disc solar.`;

  const terrain = describeTerrain(outcome);

  const caveats: string[] = [];

  if (outcome.terrain.checked) {
    caveats.push(
      'El model del terreny és de terreny nu: no hi ha ni arbres ni edificis. Comprova-ho sobre la imatge de la càmera.',
    );
    if (outcome.terrain.coverage < 1) {
      caveats.push(
        `Falten dades del terreny en un ${Math.round((1 - outcome.terrain.coverage) * 100)} % del recorregut: en aquests trams no sabem què hi ha.`,
      );
    }
  }

  if (outcome.centralDurationSec !== null && outcome.centralDurationSec <= 0) {
    caveats.push(
      'Des d’aquest punt no hi ha fase central: el Sol hi queda alineat però no del tot tapat.',
    );
  } else if (outcome.centralDurationSec !== null) {
    caveats.push(
      `Al punt hi ha ${formatSeconds(outcome.centralDurationSec)} de fase central.`,
    );
  }

  if (outcome.edgeUncertain) {
    caveats.push(
      'Ets a la vora de la franja, i allà el marge és més petit que l’error de les efemèrides (uns 2 segons d’arc): que hi hagi fase central no es pot donar per segur.',
    );
  }

  for (const other of outcome.alternatives) {
    caveats.push(
      `Sobre la mateixa línia l’alineació també es dona a` +
        ` ${formatKm(other.distanceKm)} ${of(outcome.targetName)}` +
        `${other.terrainClear ? '.' : ', però amb el terreny pel mig.'}`,
    );
  }

  return { headline, coordinates, approach, tolerance, terrain, caveats };
}

function describeTerrain(outcome: AlignmentSolution): string {
  const t = outcome.terrain;

  if (t.skipped === 'too-close') {
    return (
      `El punt queda a ${formatKm(outcome.point.distanceKm)} ${of(outcome.targetName)}:` +
      ' entremig no hi cap ni una cel·la del model del terreny, i per tant no hi ha res a comprovar. Mira-t’ho sobre la imatge de la càmera.'
    );
  }

  if (!t.checked) {
    return `Sense dades del terreny: no s’ha pogut comprovar que des d’allà es vegi ${outcome.targetName}.`;
  }

  if (!t.clear) {
    const distance =
      t.foregroundDistanceKm === null
        ? ''
        : ` L’obstacle és a ${formatKm(t.foregroundDistanceKm)} del punt.`;
    return (
      `El terreny del mig tapa ${outcome.targetName} per ${formatDeg(-t.marginDeg)}, i amb ell el Sol.` +
      ` Des d’aquest punt no serveix.${distance}`
    );
  }

  if (t.hiddenBaseM > 1) {
    return (
      `La punta es veu amb ${formatDeg(t.marginDeg)} de marge, però el terreny del mig` +
      ` n’amaga els ${formatMeters(t.hiddenBaseM)} de baix.`
    );
  }

  return (
    `El terreny del mig no s’hi posa: ${outcome.targetName} es veu de dalt a baix,` +
    ` amb ${formatDeg(t.marginDeg)} de marge.`
  );
}
