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

/**
 * El que fa falta per escriure la frase del fracàs, en l'idioma que sigui.
 *
 * PER QUÈ SÓN DADES I NO UNA FRASE. Abans `AlignmentImpossible` portava el text
 * ja escrit, i en català. Mentre aquest mòdul no el muntava ningú, això era
 * gratis; en obrir-lo a la interfície voldria dir que qui té l'app en castellà
 * rep la meitat de les respostes en català — exactament el defecte que en
 * aquest projecte ja s'ha hagut d'arreglar al veredicte, al guió de la
 * totalitat i a la zona de la realitat augmentada.
 *
 * La frase la fa `describeAlignment`, que és qui sap l'idioma.
 */
export interface AlignmentProblemDetail {
  targetName: string;
  /** Altura aparent del Sol a l'instant demanat. Null quan encara no se sap. */
  sunAltitudeDeg: number | null;
  /** Límit de distància acceptat, en km. */
  maxDistanceKm: number;
  /** Cota de la punta de l'element, quan se'n sap. */
  topElevationM: number | null;
  /** Quin contacte es demanava, quan el problema és que allà no existeix. */
  moment: AlignmentMoment | null;
}

export interface AlignmentImpossible {
  ok: false;
  problem: AlignmentProblem;
  /** Distància que demanaria la geometria, en km, quan en surt alguna. */
  wouldNeedKm: number | null;
  /** Les xifres del fracàs. La frase la munta `describeAlignment`. */
  detail: AlignmentProblemDetail;
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

/**
 * Idiomes en què aquest mòdul sap escriure.
 *
 * És el tipus literal i no el `Locale` de `src/i18n` a posta: `core` no importa
 * res de la capa d'interfície. És el mateix que fa `core/astro/gradient.ts`.
 */
export type AlignmentLocale = 'ca' | 'es';

type Bilingual = Record<AlignmentLocale, string>;

const MOMENT_LABEL: Record<AlignmentMoment, Bilingual> = {
  c1: { ca: 'al primer contacte', es: 'en el primer contacto' },
  c2: { ca: 'a l’inici de la fase central', es: 'al inicio de la fase central' },
  max: { ca: 'al màxim de l’eclipsi', es: 'en el máximo del eclipse' },
  c3: { ca: 'al final de la fase central', es: 'al final de la fase central' },
  c4: { ca: 'al quart contacte', es: 'en el cuarto contacto' },
};

/** El mateix instant dit com a nom, per encaixar-lo dins d'una negació. */
const MOMENT_NOUN: Record<AlignmentMoment, Bilingual> = {
  c1: { ca: 'primer contacte', es: 'primer contacto' },
  c2: { ca: 'fase central', es: 'fase central' },
  max: { ca: 'màxim', es: 'máximo' },
  c3: { ca: 'fase central', es: 'fase central' },
  c4: { ca: 'quart contacte', es: 'cuarto contacto' },
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
  detail: AlignmentProblemDetail,
): AlignmentImpossible {
  return { ok: false, problem, wouldNeedKm, detail };
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
    return impossible('no-elevation', null, {
      targetName: target.name,
      sunAltitudeDeg: null,
      maxDistanceKm: options.maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM,
      topElevationM: null,
      moment: null,
    });
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
      return impossible('no-contact', null, {
        targetName: target.name,
        sunAltitudeDeg: null,
        maxDistanceKm: options.maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM,
        topElevationM,
        moment,
      });
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
  const detail: AlignmentProblemDetail = {
    targetName: name,
    sunAltitudeDeg: failure.sunAltitudeDeg,
    maxDistanceKm: options.maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM,
    topElevationM,
    moment: null,
  };

  return impossible(
    failure.problem,
    failure.problem === 'out-of-range' ? failure.wouldNeedKm : null,
    detail,
  );
}
/* ── Text ─────────────────────────────────────────────────────────────────── */

/*
 * TOT EL TEXT D'AQUEST MÒDUL ÉS BILINGÜE, I NO ÉS UN AFEGIT COSMÈTIC.
 *
 * Aquesta funcionalitat es va escriure sencera en català perquè no la muntava
 * ningú. En obrir-la a la interfície, una sola frase catalana a l'app d'algú que
 * l'ha posat en castellà és el mateix defecte que ja s'ha hagut d'arreglar tres
 * vegades en aquest projecte (el veredicte, el guió de la totalitat i la zona
 * de la realitat augmentada), i sempre pel mateix motiu: el text vivia lluny de
 * la pantalla i ningú el va veure fins que era a producció.
 *
 * LES DUES LLENGÜES NO COMPARTEIXEN FÓRMULA. El català apostrofa l'article dels
 * rumbs que comencen per vocal («cap a l'oest») i contrau la preposició («del
 * castell»); el castellà només contrau «de el» → «del». Intentar una sola
 * funció per als dos casos donaria un text escrit a martellades en tots dos
 * idiomes, i per això cadascun té la seva línia.
 */

/*
 * LA COMA DECIMAL.
 *
 * Aquest mòdul escrivia `toFixed(2)`, o sigui «6.23°», i tota la resta de
 * l'aplicació escriu «6,23°». No és una manca d'estil: ESTAT.md ja documenta
 * que veure les dues notacions a la mateixa pantalla fa dubtar de totes dues
 * xifres, i aquí passaria literalment —la fitxa del mapa i aquest text es
 * llegeixen l'un sota l'altre.
 *
 * Català i castellà escriuen els números igual; es passa l'idioma igualment
 * perquè el dia que n'entri un tercer no s'hagi de descobrir amb un «1.083 m»
 * a la pantalla d'algú.
 */
const NUM: Record<AlignmentLocale, string> = { ca: 'ca-ES', es: 'es-ES' };

function decimals(value: number, digits: number, locale: AlignmentLocale): string {
  return new Intl.NumberFormat(NUM[locale], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatDeg(value: number, locale: AlignmentLocale): string {
  return `${decimals(value, 2, locale)}°`;
}

function formatKm(km: number, locale: AlignmentLocale): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${decimals(km, 2, locale)} km`;
  return `${decimals(km, 1, locale)} km`;
}

function formatMeters(m: number, locale: AlignmentLocale): string {
  return m < 10 ? `${decimals(m, 1, locale)} m` : `${Math.round(m)} m`;
}

/**
 * «cap al nord», però «cap a l'oest». Els rumbs que comencen per vocal volen
 * article apostrofat, i escriure-ho malament fa que tot el text soni a màquina.
 * En castellà no hi ha apòstrof i l'article és sempre el mateix.
 */
function towards(bearingDeg: number, locale: AlignmentLocale): string {
  const name = compassName(bearingDeg, locale);
  if (locale === 'es') return `hacia el ${name}`;
  return /^[aeiou]/.test(name) ? `cap a l’${name}` : `cap al ${name}`;
}

/**
 * «de» més el nom de l'element, amb la contracció feta.
 *
 * En català «de el castell» no existeix: és «del castell». El nom ens arriba de
 * fora amb article o sense — «el castell», «la torre», «l'ermita», «Loarre» —,
 * i la contracció s'ha de resoldre aquí o el text queda escrit a martellades.
 * El castellà té la mateixa contracció amb «el» i cap més.
 */
function of(name: string, locale: AlignmentLocale): string {
  if (locale === 'es') {
    if (/^el /i.test(name)) return `del ${name.slice(3)}`;
    return `de ${name}`;
  }
  if (/^el /i.test(name)) return `del ${name.slice(3)}`;
  if (/^els /i.test(name)) return `dels ${name.slice(4)}`;
  return `de ${name}`;
}

function formatSeconds(seconds: number, locale: AlignmentLocale): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  const min = locale === 'es' ? 'min' : 'min';
  return rest === 0 ? `${minutes} ${min}` : `${minutes} ${min} ${rest} s`;
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
 * Per què no hi ha cap punt on plantar-se, dit amb les xifres del cas.
 *
 * Cada problema té la seva frase perquè cada problema demana una decisió
 * diferent: si el Sol ja s'ha post no hi ha res a fer, si l'element és massa
 * baix cal buscar-ne un altre, i si el punt cau massa lluny només cal eixamplar
 * el límit. Una frase genèrica de «no es pot» les faria semblar el mateix.
 */
function impossibleHeadline(
  outcome: AlignmentImpossible,
  locale: AlignmentLocale,
): string {
  const { detail, problem, wouldNeedKm } = outcome;
  const name = detail.targetName;
  const target = of(name, locale);
  const sun = detail.sunAltitudeDeg === null ? null : formatDeg(detail.sunAltitudeDeg, locale);
  const maxKm = detail.maxDistanceKm;

  switch (problem) {
    case 'no-elevation':
      return locale === 'es'
        ? `No sabemos a qué cota está ${name}. Sin el modelo del terreno ni una cota dada no hay nada que calcular.`
        : `No sabem a quina cota és ${name}. Sense el model del terreny ni una cota donada no hi ha res a calcular.`;

    case 'no-contact': {
      const noun =
        detail.moment === null
          ? locale === 'es'
            ? 'ese contacto'
            : 'aquell contacte'
          : MOMENT_NOUN[detail.moment][locale];
      return locale === 'es'
        ? `Desde ${target} no hay ${noun}: el eclipse no llega a esa fase en este punto.`
        : `Des ${target} no hi ha ${noun}: l’eclipsi no arriba a aquesta fase en aquest punt.`;
    }

    case 'sun-below-horizon':
      return locale === 'es'
        ? `En ese instante el Sol está a ${sun} de altura aparente. Por debajo del horizonte no hay ningún punto desde el que quede encima ${target}.`
        : `En aquell instant el Sol és a ${sun} d’altura aparent. Per sota de l’horitzó no hi ha cap punt des d’on quedi damunt ${target}.`;

    case 'target-too-low':
      return locale === 'es'
        ? `Con el Sol a ${sun}, ${name} no se levanta lo suficiente por encima del terreno de alrededor: la punta ya nace por debajo del Sol y ninguna distancia se la sube.`
        : `Amb el Sol a ${sun}, ${name} no s’aixeca prou per damunt del terreny del voltant: la punta ja neix per sota del Sol i cap distància no l’hi puja.`;

    case 'out-of-range': {
      const top =
        detail.topElevationM === null ? '' : ` (${Math.round(detail.topElevationM)} m)`;
      if (wouldNeedKm === null) {
        return locale === 'es'
          ? `Con el Sol a ${sun}, la punta ${target}${top} todavía queda por encima del Sol a ${maxKm} km. La curvatura de la Tierra rebaja el elemento más deprisa de lo que el Sol baja.`
          : `Amb el Sol a ${sun}, la punta ${target}${top} encara queda per damunt del Sol a ${maxKm} km. La curvatura de la Terra rebaixa l’element més de pressa del que el Sol hi baixa.`;
      }
      return locale === 'es'
        ? `Con el Sol a ${sun} habría que ponerse a unos ${formatKm(wouldNeedKm, locale)} ${target}, más allá del límite de ${maxKm} km que has pedido.`
        : `Amb el Sol a ${sun} caldria plantar-se a uns ${formatKm(wouldNeedKm, locale)} ${target}, més enllà del límit de ${maxKm} km que has demanat.`;
    }
  }
}

/**
 * El resultat, llest per ensenyar.
 *
 * Aquí és on la incertesa es diu en veu alta: la tolerància de posició, el
 * terreny que no es veu, el model que no porta ni arbres ni edificis. Un punt
 * amb cinc decimals i sense cap d'aquestes frases seria una precisió falsa.
 *
 * L'IDIOMA VE PER DEFECTE EN CATALÀ perquè hi ha crides i proves anteriors a
 * l'idioma; qui pinta text a la pantalla l'ha de passar SEMPRE.
 */
export function describeAlignment(
  outcome: AlignmentOutcome,
  locale: AlignmentLocale = 'ca',
): AlignmentText {
  if (!outcome.ok) {
    return {
      headline: impossibleHeadline(outcome, locale),
      coordinates: null,
      approach: null,
      tolerance: null,
      terrain: null,
      caveats: [],
    };
  }

  const es = locale === 'es';
  const target = of(outcome.targetName, locale);

  const when =
    outcome.moment === null
      ? es
        ? 'en el instante pedido'
        : 'a l’instant demanat'
      : MOMENT_LABEL[outcome.moment][locale];

  const headline = es
    ? `${when.charAt(0).toUpperCase()}${when.slice(1)}, el Sol queda encima` +
      ` ${target} a ${formatDeg(outcome.sunAltitudeDeg, locale)} de altura,` +
      ` ${towards(outcome.sunAzimuthDeg, locale)}.`
    : `${when.charAt(0).toUpperCase()}${when.slice(1)}, el Sol queda damunt` +
      ` ${target} a ${formatDeg(outcome.sunAltitudeDeg, locale)} d’altura,` +
      ` ${towards(outcome.sunAzimuthDeg, locale)}.`;

  const coordinates = `${outcome.point.lat.toFixed(5)}, ${outcome.point.lon.toFixed(5)}`;

  const fromTarget = es
    ? `El punto está a ${formatKm(outcome.point.distanceKm, locale)} ${target},` +
      ` ${towards(outcome.bearingFromTargetDeg, locale)}, a` +
      ` ${Math.round(outcome.point.groundElevationM)} m de altitud.`
    : `El punt és a ${formatKm(outcome.point.distanceKm, locale)} ${target},` +
      ` ${towards(outcome.bearingFromTargetDeg, locale)}, a` +
      ` ${Math.round(outcome.point.groundElevationM)} m d’altitud.`;

  const approach =
    outcome.fromOrigin === null
      ? fromTarget
      : es
        ? `A ${formatKm(outcome.fromOrigin.distanceKm, locale)} de donde estás,` +
          ` ${towards(outcome.fromOrigin.bearingDeg, locale)}, en línea recta.` +
          ` ${fromTarget}`
        : `A ${formatKm(outcome.fromOrigin.distanceKm, locale)} d’on ets,` +
          ` ${towards(outcome.fromOrigin.bearingDeg, locale)}, en línia recta.` +
          ` ${fromTarget}`;

  const tolerance = es
    ? `Tienes ${formatMeters(outcome.toleranceAlongM, locale)} de margen adelante o atrás y` +
      ` ${formatMeters(outcome.toleranceLateralM, locale)} de lado. Más allá, la punta se sale del disco solar.`
    : `Tens ${formatMeters(outcome.toleranceAlongM, locale)} de marge endavant o endarrere i` +
      ` ${formatMeters(outcome.toleranceLateralM, locale)} de costat. Més enllà, la punta se surt del disc solar.`;

  const terrain = describeTerrain(outcome, locale);

  const caveats: string[] = [];

  if (outcome.terrain.checked) {
    caveats.push(
      es
        ? 'El modelo del terreno es de terreno desnudo: no hay ni árboles ni edificios. Compruébalo sobre la imagen de la cámara.'
        : 'El model del terreny és de terreny nu: no hi ha ni arbres ni edificis. Comprova-ho sobre la imatge de la càmera.',
    );
    if (outcome.terrain.coverage < 1) {
      const pct = Math.round((1 - outcome.terrain.coverage) * 100);
      caveats.push(
        es
          ? `Faltan datos del terreno en un ${pct} % del recorrido: en esos tramos no sabemos qué hay.`
          : `Falten dades del terreny en un ${pct} % del recorregut: en aquests trams no sabem què hi ha.`,
      );
    }
  }

  if (outcome.centralDurationSec !== null && outcome.centralDurationSec <= 0) {
    caveats.push(
      es
        ? 'Desde este punto no hay fase central: el Sol queda alineado pero no del todo tapado.'
        : 'Des d’aquest punt no hi ha fase central: el Sol hi queda alineat però no del tot tapat.',
    );
  } else if (outcome.centralDurationSec !== null) {
    const dur = formatSeconds(outcome.centralDurationSec, locale);
    caveats.push(
      es ? `En el punto hay ${dur} de fase central.` : `Al punt hi ha ${dur} de fase central.`,
    );
  }

  if (outcome.edgeUncertain) {
    caveats.push(
      es
        ? 'Estás en el borde de la franja, y ahí el margen es más pequeño que el error de las efemérides (unos 2 segundos de arco): que haya fase central no se puede dar por seguro.'
        : 'Ets a la vora de la franja, i allà el marge és més petit que l’error de les efemèrides (uns 2 segons d’arc): que hi hagi fase central no es pot donar per segur.',
    );
  }

  for (const other of outcome.alternatives) {
    const where = `${formatKm(other.distanceKm, locale)} ${target}`;
    caveats.push(
      es
        ? `Sobre la misma línea la alineación también se da a ${where}` +
          `${other.terrainClear ? '.' : ', pero con el terreno de por medio.'}`
        : `Sobre la mateixa línia l’alineació també es dona a ${where}` +
          `${other.terrainClear ? '.' : ', però amb el terreny pel mig.'}`,
    );
  }

  return { headline, coordinates, approach, tolerance, terrain, caveats };
}

function describeTerrain(outcome: AlignmentSolution, locale: AlignmentLocale): string {
  const t = outcome.terrain;
  const es = locale === 'es';
  const name = outcome.targetName;
  const target = of(name, locale);

  if (t.skipped === 'too-close') {
    return es
      ? `El punto queda a ${formatKm(outcome.point.distanceKm, locale)} ${target}:` +
          ' en medio no cabe ni una celda del modelo del terreno, así que no hay nada que comprobar. Míratelo sobre la imagen de la cámara.'
      : `El punt queda a ${formatKm(outcome.point.distanceKm, locale)} ${target}:` +
          ' entremig no hi cap ni una cel·la del model del terreny, i per tant no hi ha res a comprovar. Mira-t’ho sobre la imatge de la càmera.';
  }

  if (!t.checked) {
    return es
      ? `Sin datos del terreno: no se ha podido comprobar que desde ahí se vea ${name}.`
      : `Sense dades del terreny: no s’ha pogut comprovar que des d’allà es vegi ${name}.`;
  }

  if (!t.clear) {
    const distance =
      t.foregroundDistanceKm === null
        ? ''
        : es
          ? ` El obstáculo está a ${formatKm(t.foregroundDistanceKm, locale)} del punto.`
          : ` L’obstacle és a ${formatKm(t.foregroundDistanceKm, locale)} del punt.`;
    return es
      ? `El terreno de en medio tapa ${name} por ${formatDeg(-t.marginDeg, locale)}, y con él el Sol.` +
          ` Desde este punto no sirve.${distance}`
      : `El terreny del mig tapa ${name} per ${formatDeg(-t.marginDeg, locale)}, i amb ell el Sol.` +
          ` Des d’aquest punt no serveix.${distance}`;
  }

  if (t.hiddenBaseM > 1) {
    return es
      ? `La punta se ve con ${formatDeg(t.marginDeg, locale)} de margen, pero el terreno de en medio` +
          ` esconde los ${formatMeters(t.hiddenBaseM, locale)} de abajo.`
      : `La punta es veu amb ${formatDeg(t.marginDeg, locale)} de marge, però el terreny del mig` +
          ` n’amaga els ${formatMeters(t.hiddenBaseM, locale)} de baix.`;
  }

  return es
    ? `El terreno de en medio no se mete: ${name} se ve de arriba abajo,` +
        ` con ${formatDeg(t.marginDeg, locale)} de margen.`
    : `El terreny del mig no s’hi posa: ${name} es veu de dalt a baix,` +
        ` amb ${formatDeg(t.marginDeg, locale)} de marge.`;
}
