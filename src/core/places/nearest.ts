/**
 * Tria del nucli i llindars de distància.
 *
 * Tot el que hi ha aquí és pur: entra una llista de candidats i unes
 * coordenades, i surt un `PlaceName`. Cap xarxa, cap rellotge, cap
 * emmagatzematge. És on viu la decisió que de veritat importa —quin lloc et
 * dius que ets— i per això es pot provar sencera sense simular res.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en Node.
 */

import { EARTH_EQUATORIAL_RADIUS_KM } from '../astro/constants';
import {
  SETTLEMENT_RADIUS_KM,
  SETTLEMENT_RANKS,
  type PlaceName,
  type PlacePrecision,
  type Settlement,
} from './types';

const DEG = Math.PI / 180;

/**
 * Llindar per dir el nom sol, en km.
 *
 * Per sota d'un quilòmetre i mig de la VORA del nucli, dir "a 1 km de Cervera"
 * és soroll: hi ets. Per damunt, la distància és informació de debò, perquè un
 * quilòmetre i mig a peu són vint minuts i en cotxe és una decisió.
 */
export const AT_PLACE_KM = 1.5;

/**
 * Llindar per deixar de dir el nom, en km.
 *
 * Passats vint-i-cinc quilòmetres, "a 31 km de Ribadeo" no situa ningú: és
 * mitja hora de cotxe i pel mig hi ha vint pobles més que no surten al mapa
 * d'OSM o que queden fora del radi consultat. Val més dir la comarca, que és
 * veritat, que no una precisió que no tenim.
 *
 * La xifra no és rodona per casualitat: la franja de totalitat del 12 d'agost
 * de 2026 fa uns 290 km d'ample, i vint-i-cinc quilòmetres són el gruix de
 * terreny dins del qual moure's encara canvia la durada de manera apreciable.
 */
export const REGION_ONLY_KM = 25;

/**
 * Distància real al node per damunt de la qual SEMPRE es pinta la xifra, en km.
 *
 * PER QUÈ CAL UN SEGON LLINDAR. `edgeDistanceKm` resta el radi típic del rang, i
 * el rang el posa OpenStreetMap. A Espanya, `place=city` no vol dir «més de cent
 * mil habitants»: vol dir, sovint, capital de província. Consultant Photon el
 * 2026-08-01, Terol (36.000 habitants, taca urbana d'un quilòmetre i mig de
 * radi) surt com a `city`, i Burgos (180.000) com a `town`. L'etiqueta no mesura
 * la ciutat. Plantat a 4,4 km del node de Terol, enmig del camp, la vora
 * estimada donava 1,4 km i l'app deia «ets a Terol» sense cap xifra: quatre
 * quilòmetres i mig amagats darrere d'un supòsit de densitat.
 *
 * EL VALOR ÉS EL RADI MÉS GRAN QUE EL PROPI MODEL ADMET. Més enllà d'aquesta
 * distància el model ja no diu res —cap nucli s'estén tant, segons la seva
 * pròpia taula—, i el que no se sap no s'afirma. Així el supòsit pot decidir el
 * NOM però no pot fer desaparèixer la distància. A dins d'Oviedo, a 2,6 km del
 * node, se segueix dient el nom sol, que és el que toca.
 *
 * (Es va mirar si Photon donava l'extensió real per no haver de suposar res.
 * La dona, però és el TERME MUNICIPAL: per a Terol, 27 × 31 km, un radi
 * equivalent de 16,6 km. I per als nuclis cartografiats com a node —Oviedo,
 * Burgos— no la dona. No serveix.)
 */
export const AT_PLACE_MAX_CENTRE_KM = Math.max(
  ...Object.values(SETTLEMENT_RADIUS_KM),
);

/** Distància de cercle màxim entre dos punts, en km. */
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dPhi = p2 - p1;
  const dLambda = (lon2 - lon1) * DEG;
  const h =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_EQUATORIAL_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distància estimada a la vora del nucli, en km. Mai negativa.
 *
 * La font dona el node central del poble, no el seu perímetre. Sense aquesta
 * correcció, plantat a la plaça d'una ciutat de dos-cents mil habitants
 * l'aplicació diria "a 3 km d'Oviedo", que és fals: hi ets a dins.
 */
export function edgeDistanceKm(centreDistanceKm: number, rank: Settlement['rank']): number {
  return Math.max(0, centreDistanceKm - SETTLEMENT_RADIUS_KM[rank]);
}

/** Un candidat amb les seves dues distàncies ja calculades. */
export interface RankedSettlement {
  settlement: Settlement;
  distanceKm: number;
  edgeDistanceKm: number;
}

/** Índex de mida: 0 la ciutat més gran, 3 el llogaret. */
function sizeIndex(rank: Settlement['rank']): number {
  return SETTLEMENT_RANKS.indexOf(rank);
}

/**
 * Ordena els candidats pel criteri que decideix el nom.
 *
 * S'ordena per distància a la VORA, no al centre. Això fa que una ciutat de la
 * qual ets a dins guanyi un llogaret que té el rètol dos quilòmetres més a
 * prop, i que enmig del no-res guanyi sempre el que et queda més a la vora,
 * sigui de la mida que sigui.
 *
 * Empat: el nucli més gran. Dos noms igual de vàlids i el gran és el que
 * l'altra gent coneixerà quan li diguis on ets.
 */
export function rankSettlements(
  candidates: readonly Settlement[],
  lat: number,
  lon: number,
): RankedSettlement[] {
  return candidates
    .map((settlement) => {
      const centre = distanceKm(lat, lon, settlement.lat, settlement.lon);
      return {
        settlement,
        distanceKm: centre,
        edgeDistanceKm: edgeDistanceKm(centre, settlement.rank),
      };
    })
    .sort((a, b) => {
      const byEdge = a.edgeDistanceKm - b.edgeDistanceKm;
      if (Math.abs(byEdge) > 1e-9) return byEdge;
      return sizeIndex(a.settlement.rank) - sizeIndex(b.settlement.rank);
    });
}

/**
 * Quin text toca, segons la distància a la vora del nucli.
 *
 * `centreKm` és la distància real al node. Es demana perquè el veredicte «hi
 * ets, no cal xifra» no pot dependre només d'una resta feta amb un radi suposat
 * (vegeu `AT_PLACE_MAX_CENTRE_KM`). Si no es passa, es fa servir només la vora,
 * que és el comportament de sempre.
 */
export function precisionFor(edgeKm: number, centreKm?: number): PlacePrecision {
  const farFromNode = centreKm !== undefined && centreKm > AT_PLACE_MAX_CENTRE_KM;
  if (edgeKm < AT_PLACE_KM && !farFromNode) return 'at';
  if (edgeKm <= REGION_ONLY_KM) return 'near';
  return 'region';
}

/** Marques diacrítiques combinants, per poder comparar «León» amb «leon». */
const DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Normalitza un nom de regió per poder-lo comparar.
 * Sense accents, en minúscules i sense les fórmules administratives que no
 * diuen res ("Principado de Asturias" i "Asturias" són el mateix lloc).
 */
function normalizeRegion(value: string): string {
  const bare = value
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .trim();
  return bare
    .replace(
      /^(principado de|principau d[e']?|comunidad foral de|comunidad autonoma de|comunitat autonoma de|comunidad de|comunitat de|region de|regio de|provincia de|provincia d[e']?)\s+/,
      '',
    )
    .trim();
}

/**
 * Els noms bilingües venen units amb barra ("Asturias / Asturies"). Cada meitat
 * és un nom vàlid del mateix lloc, i per comparar-los cal mirar-los tots.
 */
function regionTokens(value: string): Set<string> {
  return new Set(
    value
      .split('/')
      .map((part) => normalizeRegion(part))
      .filter((part) => part.length > 0),
  );
}

/** Cert si dos textos anomenen la mateixa regió. */
function sameRegion(a: string, b: string): boolean {
  const left = regionTokens(a);
  for (const token of regionTokens(b)) {
    if (left.has(token)) return true;
  }
  return false;
}

/**
 * Comarca (o província) i comunitat, en una línia i sense repeticions.
 *
 * "Segarra, Catalunya" sí; "Asturias / Asturies, Principado de Asturias" no,
 * que és dir dues vegades el mateix. Els noms es deixen tal com els dona la
 * font, també els bilingües: traduir topònims és inventar-se'ls.
 */
export function regionLabel(county: string | null, state: string | null): string | null {
  if (county && state) {
    return sameRegion(county, state) ? county : `${county}, ${state}`;
  }
  return county ?? state ?? null;
}

/**
 * Construeix el resultat a partir dels candidats.
 *
 * `queriedLat`/`queriedLon` són les coordenades ARRODONIDES a la cel·la de la
 * memòria cau, no les crues: així el que es desa i el que es torna descriuen
 * exactament el mateix punt.
 */
export function buildPlaceName(
  candidates: readonly Settlement[],
  queriedLat: number,
  queriedLon: number,
  fetchedAtMs: number,
): PlaceName {
  const ranked = rankSettlements(candidates, queriedLat, queriedLon);
  const best = ranked[0];

  if (!best) {
    return {
      settlement: null,
      distanceKm: null,
      edgeDistanceKm: null,
      precision: 'none',
      region: null,
      queriedLat,
      queriedLon,
      fetchedAtMs,
      cached: false,
    };
  }

  return {
    settlement: best.settlement,
    distanceKm: best.distanceKm,
    edgeDistanceKm: best.edgeDistanceKm,
    precision: precisionFor(best.edgeDistanceKm, best.distanceKm),
    region: regionLabel(best.settlement.county, best.settlement.state),
    queriedLat,
    queriedLon,
    fetchedAtMs,
    cached: false,
  };
}
