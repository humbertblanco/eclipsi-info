/**
 * API pública del cercador de llocs.
 *
 * El punt d'entrada normal és `searchSpots`. La resta s'exporta per dues raons:
 * la interfície necessita les peces per explicar d'on surt cada xifra, i els
 * tests les han de poder provar per separat sense tocar la xarxa.
 *
 * `alignment.ts` no s'exporta des d'aquí a posta: encara s'està escrivint.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

export { searchSpots, integrateVisibleCentral, suppressNearby } from './search';

export {
  buildCandidateGrid,
  approxDistanceKm,
  bearingDeg,
  candidateId,
  compassName,
  findCellPeak,
  kmPerDegLon,
} from './grid';
export type { CandidateGridOptions, CellPeak, CellPeakOptions } from './grid';

export {
  buildCentralSeed,
  fastCentralPhase,
  sunTrackAt,
} from './fastCentral';
export type { CentralSeed, FastCentral } from './fastCentral';

export {
  scoreSpot,
  compareSpots,
  DEFAULT_SPOT_WEIGHTS,
  CLEARANCE_FULL_DEG,
  ALTITUDE_FULL_M,
  ALTITUDE_ZERO_M,
} from './score';
export type { SpotOrderKey, SpotScore, SpotScoreInput } from './score';

export {
  sampleHorizonWindow,
  windowAltitudeAt,
  windowDistanceAt,
  sieveRangeKm,
  clipSieveRings,
  DEFAULT_SIEVE_RINGS,
  MAX_RELIEF_M,
  MIN_SIEVE_RANGE_KM,
  MAX_SIEVE_RANGE_KM,
} from './window';
export type { HorizonWindow, HorizonWindowOptions } from './window';

export type {
  ElevationReader,
  SpotCandidate,
  SpotDetail,
  SpotResult,
  SpotScoreParts,
  SpotScoreWeights,
  SpotSearchCost,
  SpotSearchOptions,
  SpotSearchOutcome,
  SpotSearchProgress,
  SpotSearchStage,
  StageCost,
} from './types';
