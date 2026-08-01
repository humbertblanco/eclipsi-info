/**
 * Tipus del cercador de llocs.
 *
 * La pregunta que respon aquest mòdul ve just després de «ho veuré des d'aquí?».
 * És «doncs on m'he de plantar?»: escombrar el voltant, puntuar cada punt i
 * tornar-ne un grapat amb els segons que hi veuràs, què te'ls menja i què et
 * costa arribar-hi.
 *
 * Tot són números plans, cadenes i arrays: els resultats travessen un
 * `postMessage` des del Worker sense cap transformació. Res de `Map`, res de
 * classes. Les úniques dates viatgen com a mil·lisegons d'època.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import type { Atmosphere, GeoLocation } from '../astro/types';
import type { HorizonProfile } from '../horizon/profile';
import type { HorizonRing } from '../horizon/raycast';
import type { VisibilityStatus } from '../visibility/verdict';

/**
 * Lectura d'elevació SENSE await, a partir de tessel·les ja baixades.
 *
 * S'injecta en comptes d'importar-se perquè el garbell llegeix milions de
 * mostres i ha de ser provable sense xarxa: als tests hi passem un terreny
 * sintètic i el resultat és determinista. Torna `undefined` quan no hi ha
 * dades, que mai s'ha d'interpretar com a zero metres.
 */
export type ElevationReader = (
  lonDeg: number,
  latDeg: number,
  zoom: number,
) => number | undefined;

/** Un punt de la graella, abans de saber-ne res. */
export interface SpotCandidate {
  lat: number;
  lon: number;
  /** Cota del model del terreny al punt, en metres. */
  elevation: number;
  /** Distància des d'on ets ara, en km sobre el terreny. */
  distanceKm: number;
  /** Rumb des d'on ets ara, en graus des del nord cap a l'est. */
  bearingDeg: number;
}

/**
 * Fins on ha arribat el càlcul d'un resultat.
 *
 * Es publica perquè la diferència importa i no es pot amagar: un `sieve` és una
 * estimació amb terreny gruixut i pot equivocar-se en desenes de segons; un
 * `full` ha passat pel mateix motor que el veredicte de «ho veuré des d'aquí?».
 */
export type SpotDetail = 'sieve' | 'full';

export interface SpotScoreParts {
  /** Segons de fase central realment visibles, normalitzats. 0 a 1. */
  centralSeconds: number;
  /** Marge de l'horitzó sota el Sol, normalitzat. 0 a 1. */
  clearance: number;
  /** Proximitat des d'on ets, normalitzada. 0 a 1. */
  closeness: number;
  /** Altura guanyada respecte d'on ets, normalitzada. 0 a 1. */
  altitude: number;
}

export interface SpotResult {
  /** Clau estable del punt de la graella. Serveix de `key` a React. */
  id: string;
  lat: number;
  lon: number;
  /** Cota del model del terreny, en metres. */
  elevation: number;
  distanceKm: number;
  bearingDeg: number;

  /** Puntuació de 0 a 100. */
  score: number;
  parts: SpotScoreParts;
  detail: SpotDetail;

  /** Segons de fase central que veuràs de debò des d'aquí. */
  centralVisibleSec: number;
  /** Segons de fase central que hi ha, segons les efemèrides. */
  centralTotalSec: number;
  /** Segons que se'n menja el relleu. */
  centralLostSec: number;

  /**
   * Marge mínim del centre del Sol sobre el terreny durant la fase central, en
   * graus. Negatiu vol dir que en algun moment queda amagat.
   */
  clearanceDeg: number;
  /** Altura del terreny a l'azimut del Sol al mig de la fase central, en graus. */
  horizonAltitudeDeg: number;
  /** Distància de l'obstacle que marca aquell horitzó, en km. */
  blockingDistanceKm: number | null;
  /** Metres a pujar per recuperar el que es perd, si es perd res. */
  climbToRecoverM: number | null;

  /** Azimut del Sol al mig de la fase central, en graus. */
  sunAzimuthDeg: number;
  /** Altura APARENT del Sol al mig de la fase central, en graus. */
  sunAltitudeDeg: number;
  /** Instant del mig de la fase central, en ms d'època. */
  midCentralMs: number;

  /** Veredicte del motor de visibilitat. Només als resultats `full`. */
  status: VisibilityStatus | null;
  /**
   * Cert quan el marge umbral és més petit que l'error de les efemèrides i no
   * podem decidir honestament si hi haurà fase central. Vora de la franja.
   */
  edgeUncertain: boolean;
  /** Fracció de mostres del terreny amb dades, de 0 a 1. Per sota d'1 hi ha forats. */
  coverage: number;
}

export type SpotSearchStage =
  | 'grid'
  | 'astro'
  | 'tiles'
  | 'sieve'
  | 'refineTiles'
  | 'refine'
  | 'done';

export interface SpotSearchProgress {
  stage: SpotSearchStage;
  /** Progrés global de 0 a 1. */
  ratio: number;
  /** Text llest per ensenyar, en català. */
  message: string;
  /** Candidats processats a l'etapa actual. */
  examined: number;
  /** Candidats que segueixen vius. */
  alive: number;
}

/** Comptadors d'una etapa de l'embut. Es publiquen: el cost és part del disseny. */
export interface StageCost {
  /** Candidats que hi entren. */
  entered: number;
  /** Candidats que en surten vius. */
  survived: number;
  ms: number;
  /** Parells de posicions Sol-Lluna calculats. */
  ephemerisCalls: number;
  /** Mostres llegides del model del terreny. */
  terrainSamples: number;
  /** Tessel·les demanades a la xarxa en aquesta etapa (les repetides no compten). */
  tiles: number;
}

export interface SpotSearchCost {
  grid: StageCost;
  astro: StageCost;
  tiles: StageCost;
  sieve: StageCost;
  refineTiles: StageCost;
  refine: StageCost;
  totalMs: number;
  /** Tessel·les úniques baixades en tota la cerca. */
  uniqueTiles: number;
  /**
   * Tessel·les que hauria costat calcular el perfil complet de cada candidat,
   * una per una i sense compartir res. És el número que justifica l'embut.
   */
  tilesIfNaive: number;
  /** Mostres del terreny que hauria costat el mateix camí ingenu. */
  terrainSamplesIfNaive: number;
}

export interface SpotSearchOptions {
  eclipseId: string;
  /** On ets ara. També és el centre de la cerca. */
  origin: GeoLocation;
  /** Radi de la cerca, en km. */
  radiusKm?: number;
  /** Separació entre candidats de la graella, en km. */
  spacingKm?: number;
  /** Quants candidats passen del garbell al càlcul complet. */
  finalists?: number;
  /** Quants resultats es tornen com a màxim. */
  limit?: number;
  /**
   * Separació mínima entre dos resultats de la llista, en km. Sense això la
   * llista serien deu versions del mateix turó.
   */
  minSeparationKm?: number;
  weights?: SpotScoreWeights;
  atmosphere?: Atmosphere;
  /** Altura de l'ull per damunt del terreny del model, en metres. */
  eyeHeightM?: number;
  /**
   * Anells del garbell. El primer és el camp proper i el segon el llunyà;
   * el seu abast exterior el retalla l'altura del Sol de cada candidat.
   */
  sieveRings?: HorizonRing[];
  /** Mitja amplada de la finestra d'azimuts del garbell, en graus. */
  sieveHalfWidthDeg?: number;
  /** Pas azimutal del garbell, en graus. */
  sieveStepDeg?: number;
  /** Pas azimutal del perfil complet dels finalistes, en graus. */
  refineStepDeg?: number;
  /** Radi màxim del perfil complet dels finalistes, en km. */
  refineMaxRangeKm?: number;
  /**
   * Posa-ho a fals per aturar-se al garbell. Estalvia desenes de megabytes i
   * torna resultats estimats, marcats com a tals.
   */
  refine?: boolean;
  onProgress?: (progress: SpotSearchProgress) => void;
  signal?: AbortSignal;

  /* --- injecció, per poder provar sense xarxa --- */
  elevation?: ElevationReader;
  prefetch?: (
    tiles: { z: number; x: number; y: number }[],
    options: { signal?: AbortSignal; onTileDone?: (done: number, total: number) => void },
  ) => Promise<{ requested: number; loaded: number; failed: number }>;
  computeProfile?: (
    location: GeoLocation,
    options: {
      azimuthStepDeg: number;
      rings: HorizonRing[];
      eyeHeightM: number;
      signal?: AbortSignal;
    },
  ) => Promise<HorizonProfile>;
}

export interface SpotSearchOutcome {
  results: SpotResult[];
  cost: SpotSearchCost;
  /** Centre de la cerca, tal com s'ha fet servir. */
  origin: GeoLocation;
  radiusKm: number;
  /** Candidats de la graella inicial. */
  candidates: number;
  /** Millor durada teòrica de fase central trobada dins del radi, en segons. */
  bestCentralSec: number;
  /**
   * Fals quan dins del radi no hi arriba la franja de centralitat. Llavors la
   * llista només ordena per horitzó i distància, i s'ha de dir clarament.
   */
  centralReachable: boolean;
  /** Cert si la cerca s'ha aturat al garbell i els resultats són estimacions. */
  estimatedOnly: boolean;
}

/**
 * Pesos de la puntuació. Sumen 1 i es documenten a `score.ts`, que és on hi ha
 * el raonament de per què cada un val el que val.
 */
export interface SpotScoreWeights {
  centralSeconds: number;
  clearance: number;
  closeness: number;
  altitude: number;
}
