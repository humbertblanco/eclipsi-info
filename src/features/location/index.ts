/**
 * Barril públic del selector d'ubicació.
 *
 * QUÈ HI HA AQUÍ DINS, en una frase: la ubicació és la peça central de l'app i
 * aquest mòdul és tot el que la fa triable, visible i comparable.
 *
 *   · `LocationBar`   — on ets, d'on surt i quina precisió té. A totes les
 *                       pantalles, enganxada sota la capçalera.
 *   · `LocationSheet` — les quatre maneres de dir on seràs: GPS, nom, mapa i
 *                       coordenades, més l'historial.
 *   · `LocationGate`  — la primera pregunta de l'app, amb el perquè abans del
 *                       permís del navegador.
 *   · `ComparePanel`  — dos llocs i la diferència en segons de fase central.
 *
 * L'ESTAT NO VIU AQUÍ: viu a `src/state/useObserver.ts` i `src/state/location.ts`,
 * perquè les pantalles el necessiten encara que aquest selector no estigui
 * muntat. Aquí només hi ha la interfície i la lògica que li és pròpia.
 *
 * ELS NOMS DE LLOC els resol `PlaceName.tsx`, d'una altra tasca, sobre
 * `src/core/places/`. Aquí se'n reexporta el hook perquè `App` hi pugui
 * enganxar `observer.setLabel()`: així el nom que troba viatja al punt actiu,
 * a l'historial i a la comparació, i no només a la línia on es pinta.
 */

export { LocationBar } from './LocationBar';
export type { LocationBarProps } from './LocationBar';

export { ORIGIN_KEY, placeTitle } from './origin';

export { LocationSheet } from './LocationSheet';
export type { LocationSheetProps } from './LocationSheet';

export { LocationGate } from './LocationGate';
export type { LocationGateProps } from './LocationGate';

export { ComparePanel } from './ComparePanel';
export type { ComparePanelProps } from './ComparePanel';

export { useComparison } from './useComparison';
export type { ComparisonApi } from './useComparison';

export { usePlaceSearch } from './usePlaceSearch';
export type { PlaceSearchApi, UsePlaceSearchOptions } from './usePlaceSearch';

export { comparePlaces, WORTH_MOVING_SEC } from './compare';
export type { ComparedPlace, PlaceComparison } from './compare';

export { parseCoords } from './coords';
export type { ParsedCoords } from './coords';

/* L'endoll del client de topònims. La implementació viu a `src/core/places/`. */
export {
  MIN_QUERY_LENGTH,
  PLACES_ATTRIBUTION,
  SEARCH_LIMIT,
  resetPlaceSearch,
  searchPlaces,
  setPlaceSearch,
} from './geocoder';
export type {
  PlaceHit,
  PlaceSearch,
  PlaceSearchOptions,
  SearchOutcome,
} from './geocoder';

export { ls } from './strings';
export type { LocationStringKey } from './strings';

/* Noms de lloc. La implementació és de `PlaceName.tsx`, que aquesta tasca no
   toca; es reexporta perquè hi hagi una sola porta d'entrada al mòdul. */
export { PlaceName, PlaceNameSource, usePlaceName } from './PlaceName';
export type { PlaceNameProps, PlaceNameState } from './PlaceName';
