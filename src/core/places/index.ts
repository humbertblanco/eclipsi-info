/**
 * Noms de lloc — barril públic.
 *
 * QUÈ HI HA AQUÍ DINS, en una frase: convertir "43,3619°, −5,8494°" en
 * "Oviedo" o en "a 2,3 km de Cervera", i el nom que algú escriu en unes
 * coordenades on plantar-se.
 *
 * LA GEOCODIFICACIÓ ÉS L'ÚNICA PART DE `src/core/**` QUE NECESSITA XARXA I NO
 * FUNCIONA SENSE. És una decisió presa a consciència: el terreny, les
 * efemèrides i el veredicte de visibilitat sí que van sense connexió i
 * seguiran anant-hi. El nom del lloc, no; i quan no hi arriba, es cauen les
 * coordenades i no passa res més.
 *
 * L'EXCEPCIÓ, I ÉS DELIBERADA: `viewpoints.ts`. Els miradors i els cims de la
 * franja també són llocs d'OpenStreetMap, però no es demanen mai en temps
 * d'execució: es preextreuen amb `scripts/build-viewpoints.ts` i viatgen amb
 * l'app com un fitxer estàtic. Serveixen justament quan ja ets al camp i no hi
 * ha cobertura, que és quan cap servei en viu no és una opció.
 *
 * ATRIBUCIÓ OBLIGATÒRIA: `PLACES_ATTRIBUTION` ha de sortir a la interfície allà
 * on es faci servir el servei, i `OSM_ODBL_ATTRIBUTION` allà on es pintin els
 * miradors, igual que hi surten la d'OpenStreetMap al mapa i la de Fred
 * Espenak a les efemèrides.
 */

export {
  PLACES_ATTRIBUTION,
  PLACES_ATTRIBUTION_URL,
  PLACES_USER_AGENT,
  fetchNearbySettlements,
  fetchPlaceSearch,
} from './photon';

export {
  CACHE_GRID_DECIMALS,
  PLACE_CACHE_KEY,
  cacheKeyFor,
  createPlaceCache,
  snapCoordinate,
} from './cache';
export type { PlaceCache, PlaceCacheStorage } from './cache';

export {
  MAP_SETTLE_MS,
  MIN_REQUEST_INTERVAL_MS,
  SEARCH_SETTLE_MS,
  SUPERSEDED,
  createRequestQueue,
  createSettler,
} from './queue';
export type { RequestQueue, Settler, Superseded } from './queue';

export {
  AT_PLACE_KM,
  REGION_ONLY_KM,
  buildPlaceName,
  distanceKm,
  edgeDistanceKm,
  precisionFor,
  AT_PLACE_MAX_CENTRE_KM,
  rankSettlements,
  regionLabel,
} from './nearest';
export type { RankedSettlement } from './nearest';

export { catalanOf, describePlace, formatDistanceKm } from './describe';
export type { PlaceLabel, PlaceLocale } from './describe';

export {
  MIN_SEARCH_LENGTH,
  createPlaceResolver,
  peekPlaceName,
  placeResolver,
  reverseGeocode,
  reverseGeocodeWhenSettled,
  searchPlaces,
  searchPlacesWhenSettled,
} from './resolver';
export type { PlaceResolver, PlaceResolverOptions } from './resolver';

export {
  DEFAULT_RELEVANCE,
  OSM_COPYRIGHT_URL,
  OSM_LICENSE_ID,
  OSM_ODBL_ATTRIBUTION,
  bandChunks,
  bandGeometry,
  boxKey,
  chunkQueryBoxes,
  decimateByCell,
  dedupeViewpoints,
  insideAnyBox,
  insideBand,
  parseElevationM,
  parseViewpointFile,
  selectViewpoints,
  splitAntimeridian,
  toViewpoint,
  viewpointsFileName,
} from './viewpoints';
export type {
  BandBox,
  BandChunk,
  BandGeometry,
  BandOptions,
  OverpassElement,
  RelevanceOptions,
  SelectionResult,
  SelectionStats,
  Viewpoint,
  ViewpointFile,
  ViewpointKind,
} from './viewpoints';

export { PlaceLookupError, SETTLEMENT_RADIUS_KM, SETTLEMENT_RANKS } from './types';
export type {
  PlaceName,
  PlacePrecision,
  PlaceRequestOptions,
  PlaceSubkind,
  PlaceSuggestion,
  Settlement,
  SettlementRank,
} from './types';
