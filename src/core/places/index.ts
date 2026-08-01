/**
 * Noms de lloc — barril públic.
 *
 * QUÈ HI HA AQUÍ DINS, en una frase: convertir "43,3619°, −5,8494°" en
 * "Oviedo" o en "a 2,3 km de Cervera", i el nom que algú escriu en unes
 * coordenades on plantar-se.
 *
 * L'ÚNIC MÒDUL DE `src/core/**` QUE NECESSITA XARXA I NO FUNCIONA SENSE. És una
 * decisió presa a consciència: el terreny, les efemèrides i el veredicte de
 * visibilitat sí que van sense connexió i seguiran anant-hi. El nom del lloc,
 * no; i quan no hi arriba, es cauen les coordenades i no passa res més.
 *
 * ATRIBUCIÓ OBLIGATÒRIA: `PLACES_ATTRIBUTION` ha de sortir a la interfície allà
 * on es faci servir el servei, igual que hi surten la d'OpenStreetMap al mapa i
 * la de Fred Espenak a les efemèrides.
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

export { PlaceLookupError, SETTLEMENT_RADIUS_KM, SETTLEMENT_RANKS } from './types';
export type {
  PlaceName,
  PlacePrecision,
  PlaceRequestOptions,
  PlaceSuggestion,
  Settlement,
  SettlementRank,
} from './types';
