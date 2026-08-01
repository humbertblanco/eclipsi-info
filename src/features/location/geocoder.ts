/**
 * Cercar un lloc pel seu nom.
 *
 * AQUEST FITXER NO ÉS EL GEOCODIFICADOR: és la peça que l'endolla a la
 * interfície. El client viu a `src/core/places/` i el construeix una altra
 * tasca; aquí només se'l consumeix i se'n tradueix el resultat a la forma que
 * la fulla de tria sap pintar.
 *
 * PER QUÈ ELS NOMS SÍ QUE PODEN DEPENDRE DE LA XARXA. La regla general del
 * producte és que el dia de l'eclipsi, dins la franja, la xarxa mòbil estarà
 * saturada, i per això el terreny i les efemèrides es calculen al dispositiu.
 * Els noms de lloc són l'excepció decidida: buscar «Peníscola» es fa a casa
 * mentre es planifica, i a dalt del turó el que mana són les coordenades, que
 * ja les tens. Si la crida falla, es cau a les coordenades i la resta segueix
 * igual — cap error a la cara de l'usuari, cap pantalla bloquejada.
 *
 * PER QUÈ ES FA SERVIR `searchPlacesWhenSettled` I NO `searchPlaces`. El mòdul
 * de topònims porta la seva pròpia política de ritme: espera que qui escriu
 * pari (320 ms) i no deixa passar més d'una petició per segon, perquè el servei
 * és gratuït i té condicions d'ús. Posar-hi un segon temporitzador a sobre no
 * el faria més educat, només afegiria retard damunt del retard. La política de
 * ritme és d'ells; aquí només se n'accepta el resultat, inclòs el cas en què
 * una consulta queda substituïda per una de més nova.
 *
 * ES POT SUBSTITUIR (`setPlaceSearch`) per als tests, que així no toquen la
 * xarxa, i per si algun dia el client canvia.
 */

import {
  MIN_SEARCH_LENGTH,
  PLACES_ATTRIBUTION,
  SUPERSEDED,
  searchPlacesWhenSettled,
  type PlaceSuggestion,
} from '../../core/places';

/**
 * Atribució obligatòria del servei de topònims.
 *
 * NO ÉS OPCIONAL: la llicència de les dades ho exigeix, igual que la
 * d'OpenStreetMap al mapa i la de Fred Espenak a les efemèrides. Es reexporta
 * des d'aquí perquè qui pinti resultats de cerca no hagi de saber d'on surten
 * per poder complir-ho.
 */
export { PLACES_ATTRIBUTION };

/** Un resultat de cerca. És el mínim per poder-hi anar i per poder-lo anomenar. */
export interface PlaceHit {
  /** Identificador estable. L'identificador d'OSM quan n'hi ha. */
  id: string;
  /** Nom del lloc: «Peníscola / Peñíscola». */
  name: string;
  /** Context per desempatar: «el Baix Maestrat · Comunitat Valenciana». */
  detail: string | null;
  lat: number;
  lon: number;
  /**
   * Què és.
   *
   * IMPORTA MÉS DEL QUE SEMBLA: qui planifica un eclipsi busca colls i cims
   * («Puerto de San Isidro», «Peña Ubiña») tant com pobles, perquè el que va a
   * buscar és horitzó net de ponent. Distingir-los a la llista evita triar el
   * poble de la vall quan el que volies era el port.
   */
  kind: PlaceSuggestion['kind'];
}

export interface PlaceSearchOptions {
  signal?: AbortSignal;
  limit?: number;
  /** Punt de referència per ordenar els resultats. Normalment, on ets. */
  biasLat?: number;
  biasLon?: number;
}

/** El contracte que ha de complir un client de topònims. */
export interface PlaceSearch {
  (query: string, options?: PlaceSearchOptions): Promise<readonly PlaceHit[]>;
}

/**
 * Com ha anat la cerca.
 *
 * PER QUÈ ELS ERRORS SÓN VALORS I NO EXCEPCIONS: cada cas demana a l'usuari una
 * cosa diferent. «No hi ha xarxa» vol dir toca el mapa; «cap resultat» vol dir
 * escriu-ho d'una altra manera; «el servei ha fallat» vol dir torna-ho a provar.
 * Un `catch` que els ajunta acaba en un «hi ha hagut un error» que no ajuda
 * ningú a decidir res.
 *
 * `superseded` no és cap d'aquestes coses: vol dir que l'usuari ha seguit
 * escrivint i aquesta consulta ja no interessa. Qui el rebi no ha de tocar la
 * pantalla, perquè n'hi ha una altra de camí.
 */
export type SearchOutcome =
  | { status: 'ok'; hits: readonly PlaceHit[] }
  | { status: 'empty' }
  | { status: 'superseded' }
  | { status: 'offline' }
  | { status: 'failed' };

/** Longitud mínima de la consulta. La fixa el mòdul de topònims. */
export const MIN_QUERY_LENGTH = MIN_SEARCH_LENGTH;

/**
 * Quants resultats es demanen.
 *
 * Cinc caben en una fulla de mòbil sense fer-la desplaçar amb files de 44 px
 * (`--tap-min`), i qui no troba el que busca entre els cinc primers el que ha
 * de fer és escriure millor la cerca, no baixar.
 */
export const SEARCH_LIMIT = 5;

/* --- el client, i com se substitueix ------------------------------------- */

function toHit(suggestion: PlaceSuggestion): PlaceHit {
  return {
    id: suggestion.osmId ?? `${suggestion.lat},${suggestion.lon}`,
    name: suggestion.name,
    detail: suggestion.context === '' ? null : suggestion.context,
    lat: suggestion.lat,
    lon: suggestion.lon,
    kind: suggestion.kind,
  };
}

let override: PlaceSearch | null = null;

/** Substitueix el client. Passa `null` per tornar al de debò. */
export function setPlaceSearch(fn: PlaceSearch | null): void {
  override = fn;
}

/** Torna al client de debò. Els tests el criden en acabar. */
export function resetPlaceSearch(): void {
  override = null;
}

/* --- l'única funció que crida la interfície ------------------------------ */

export async function searchPlaces(
  query: string,
  options: PlaceSearchOptions = {},
): Promise<SearchOutcome> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return { status: 'empty' };

  // Sense xarxa no s'intenta la petició: el navegador trigaria el temps d'espera
  // sencer a fallar i l'usuari veuria una filadora eterna en comptes d'una frase
  // que li diu què passa i què pot fer.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { status: 'offline' };
  }

  const limit = options.limit ?? SEARCH_LIMIT;

  try {
    if (override !== null) {
      const hits = await override(trimmed, { ...options, limit });
      return hits.length === 0 ? { status: 'empty' } : { status: 'ok', hits };
    }

    const result = await searchPlacesWhenSettled(trimmed, {
      limit,
      signal: options.signal,
      biasLat: options.biasLat,
      biasLon: options.biasLon,
    });
    if (result === SUPERSEDED) return { status: 'superseded' };
    return result.length === 0
      ? { status: 'empty' }
      : { status: 'ok', hits: result.map(toHit) };
  } catch (err) {
    // Una cerca cancel·lada no és un error: és que l'usuari ha seguit escrivint.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'superseded' };
    }
    return { status: 'failed' };
  }
}
