/**
 * Tipus dels noms de lloc.
 *
 * QUÈ RESOL AQUEST MÒDUL: convertir unes coordenades en una frase que una
 * persona pugui dir en veu alta. "43,3619°, −5,8494°" no li serveix a ningú per
 * saber si val la pena moure's; "a 2,4 km de Bulnes de Arriba" sí.
 *
 * REGLA QUE ATRAVESSA TOT EL MÒDUL: el nom és un EXTRA. La trajectòria, els
 * contactes, el terreny i el veredicte de visibilitat es calculen sense
 * xarxa i no depenen d'aquí per a res. Si el servei falla, s'ensenyen les
 * coordenades i s'acaba la història: cap error a la cara de l'usuari.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en Node.
 */

/**
 * Mida del nucli, tal com la classifica OpenStreetMap.
 *
 * Importa perquè decideix dues coses: quin candidat guanya quan n'hi ha
 * diversos a prop, i a quina distància es pot considerar que ja hi ets a dins.
 * Una ciutat de 200.000 habitants ocupa quilòmetres; un llogaret, dos carrers.
 */
export type SettlementRank = 'city' | 'town' | 'village' | 'hamlet';

/** Ordre de gran a petit. Serveix per desempatar. */
export const SETTLEMENT_RANKS: readonly SettlementRank[] = [
  'city',
  'town',
  'village',
  'hamlet',
];

/**
 * Radi típic de cada classe de nucli, en km.
 *
 * D'ON SURTEN AQUESTES XIFRES, perquè no són arbitràries. La font dona el NODE
 * central del nucli, no el seu perímetre; la distància a aquell node no és la
 * distància al poble. Amb una densitat urbana espanyola d'uns 5.000 hab/km² i
 * els llindars de població que OSM fa servir per etiquetar:
 *
 *   · `city`    (>100.000 hab) → 20-60 km² → radi 2,5-4,4 km → agafem 3,0
 *   · `town`    (5.000-50.000) → 1-10 km²  → radi 0,6-1,8 km → agafem 1,2
 *   · `village` (200-5.000)    → 0,2-1 km² → radi 0,25-0,6 km → agafem 0,5
 *   · `hamlet`  (<200 hab)     → molt petit             → agafem 0,2
 *
 * Es fan servir per estimar la distància a la VORA del nucli, que és la que
 * decideix si dius "Oviedo" o "a 5 km d'Oviedo". La distància que es PINTA,
 * en canvi, és sempre la real al node: inventar-se una xifra més afalagadora
 * seria mentir, i aquesta app no arrodoneix mai a favor.
 */
export const SETTLEMENT_RADIUS_KM: Record<SettlementRank, number> = {
  city: 3.0,
  town: 1.2,
  village: 0.5,
  hamlet: 0.2,
};

/** Un nucli habitat, tal com el torna el servei. */
export interface Settlement {
  /** Nom oficial. Pot ser bilingüe ("Oviedo / Uviéu") i es deixa tal qual. */
  name: string;
  rank: SettlementRank;
  lat: number;
  lon: number;
  /** Comarca o província, segons la comunitat. `null` si la font no en dona. */
  county: string | null;
  /** Comunitat autònoma o regió equivalent. */
  state: string | null;
  /** Codi ISO del país en minúscules ("es", "fr", "pt"). */
  countryCode: string | null;
  /** Identificador OSM ("N240109189"). Clau estable per a llistes. */
  osmId: string | null;
}

/**
 * Quanta precisió té el nom que ensenyem.
 *
 *  · `at`     — hi ets a dins o al costat. S'ensenya el nom sol.
 *  · `near`   — n'ets a prop. S'ensenya "a X km de <nom>".
 *  · `region` — el nucli més proper queda massa lluny per anomenar-lo sense
 *               fer creure una precisió que no hi és. Només comarca/regió.
 *  · `none`   — no hi ha res. Coordenades.
 */
export type PlacePrecision = 'at' | 'near' | 'region' | 'none';

/** Resultat d'una geocodificació inversa. */
export interface PlaceName {
  /** Nucli habitat més proper trobat. `null` si no n'hi ha cap a l'abast. */
  settlement: Settlement | null;
  /**
   * Distància real de l'observador al node del nucli, en km. És la xifra que
   * es pinta. `null` si no hi ha nucli.
   */
  distanceKm: number | null;
  /**
   * Distància estimada a la VORA del nucli, en km (mai negativa). És la xifra
   * que decideix `precision`, no la que es pinta. Vegeu `SETTLEMENT_RADIUS_KM`.
   */
  edgeDistanceKm: number | null;
  precision: PlacePrecision;
  /** Comarca/província i comunitat, ja netes de repeticions. `null` si no n'hi ha. */
  region: string | null;
  /** Coordenades consultades, arrodonides a la cel·la de la memòria cau. */
  queriedLat: number;
  queriedLon: number;
  /** Quan es va baixar de la xarxa, en ms d'època. */
  fetchedAtMs: number;
  /** Cert si ve de la memòria cau i no de la xarxa. */
  cached: boolean;
}

/**
 * Matís de què és exactament un resultat del cercador, més fi que `kind`.
 *
 * PER QUÈ CAL, si `kind` ja distingeix poble, cim i «altres»: perquè hi ha
 * parelles de resultats que amb nom i context es pinten IGUALS i no ho són.
 * Buscant «Burgos» arriben la ciutat (place=city) i el terme municipal
 * (boundary=administrative), tots dos «Burgos — Castilla y León», i sense
 * saber quin és quin no hi ha manera de triar. El matís el posa la font;
 * les paraules per ensenyar-lo les posa la interfície quan li fan falta.
 *
 * Els quatre primers són els rangs de `place` d'OSM tal qual; els tres
 * següents són les capes administratives (terme, comarca o província, regió);
 * la resta, el relleu i els miradors que el cercador deixa passar.
 */
export type PlaceSubkind =
  | 'city'
  | 'town'
  | 'village'
  | 'hamlet'
  | 'municipality'
  | 'county'
  | 'region'
  | 'peak'
  | 'saddle'
  | 'pass'
  | 'viewpoint';

/** Un resultat del cercador de llocs (geocodificació directa). */
export interface PlaceSuggestion {
  /** Nom del lloc. */
  name: string;
  /**
   * Context per desambiguar: municipi, comarca i comunitat, separats per " · ".
   * Sense això hi ha tres Cervera i no se sap quina és quina.
   */
  context: string;
  lat: number;
  lon: number;
  /**
   * Què és. El cercador de llocs d'aquesta app no busca només pobles: la gent
   * escriu "Puerto de San Isidro" o "Peña Ubiña", que són coll i cim.
   */
  kind: 'settlement' | 'peak' | 'other';
  /** El mateix, amb el matís que desempata els que es veuen iguals. */
  subkind: PlaceSubkind;
  /** Identificador OSM. Clau estable per a la llista. */
  osmId: string | null;
}

/** Opcions comunes de les crides. */
export interface PlaceRequestOptions {
  /** Per a proves i per a Node: implementació de `fetch`. */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** Salta la memòria cau i força una consulta nova. */
  forceRefresh?: boolean;
}

/**
 * Error del mòdul.
 *
 * Existeix per poder-lo distingir d'un error de programació, NO per ensenyar-lo
 * a l'usuari: un nom de lloc que no arriba no és un problema que ell pugui
 * resoldre. Qui el capturi ha de caure a les coordenades i callar.
 */
export class PlaceLookupError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'PlaceLookupError';
  }
}
