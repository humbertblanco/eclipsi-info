/**
 * Catàleg dels punts d'observació OFICIALS: els recintes que les
 * administracions han habilitat, amb serveis i seguretat, per veure-hi
 * l'eclipsi.
 *
 * PER QUÈ ÉS ESTÀTIC I CURAT A MÀ, quan tota la resta de l'app es calcula.
 *
 * Primer: no hi ha cap API d'això. Ni una. Cada administració ho publica com
 * pot i com vol, i les set que hi ha aquí dins ho fan de set maneres diferents:
 * Astúries té un endpoint PHP que torna JSON amb `lat`/`lng` (l'únic que
 * s'assembla a una API); Castella i Lleó penja un `.xlsx` amb UTM i graus
 * decimals; la Generalitat de Catalunya els posa dins de l'HTML com a enllaços
 * `google.com/maps?q=lat,lon`; el Govern de Navarra, el d'Aragó, el de les
 * Illes Balears i la Generalitat Valenciana publiquen NOMS DE LLOC i prou. Cap
 * format es manté d'un any per l'altre i cap té versionat. Un carregador
 * automàtic seria un carregador trencat.
 *
 * Segon, i decisiu: el 12 d'agost a les 20.29 la xarxa mòbil estarà saturada
 * exactament a sobre d'aquests punts, que és on s'hi haurà concentrat la gent.
 * Una dada que només serveix el dia de l'eclipsi no es pot anar a buscar el dia
 * de l'eclipsi. Va al paquet, i s'acaba la conversa. Són 119 kB de JSON abans
 * de minificar — cars, però és el preu de no dependre de ningú quan compta.
 *
 * LES DUES REGLES QUE NO ES TOQUEN.
 *
 * 1. LA FONT SEMPRE VISIBLE. Cada punt porta qui l'ha anunciat i l'URL on ho
 *    diu. Qui no s'ho cregui ha de poder anar-hi a mirar en dos tocs. No hi ha
 *    cap punt "nostre" en aquest fitxer: si no ho ha publicat una
 *    administració, no hi és.
 * 2. UNA COORDENADA MAI ES FINGEIX. `precision: 'exact'` vol dir que la
 *    coordenada surt PUBLICADA de la font. `precision: 'estimated'` vol dir que
 *    la font només dona un nom de lloc i la coordenada l'hem hagut de buscar a
 *    OpenStreetMap (el node del poble, la platja o el recinte): pot ballar un
 *    quilòmetre llarg i la interfície ho ha de dir amb totes les lletres
 *    ("ubicació estimada"). De 222 punts, 162 són exactes i 60 estimats.
 *
 *    Aquestes 60 coordenades són dades d'OpenStreetMap i, per ODbL, demanen
 *    atribució al panell de crèdits — la mateixa que ja hi ha per als noms de
 *    lloc (`PLACES_ATTRIBUTION_URL`, `core/places/photon.ts`).
 *
 *    Que primer les posés a ull i després les comprovés contra OSM no va sortir
 *    de franc: la vintena de Navarra ballaven de mitjana un quilòmetre i mig, i
 *    Arguedas i Sendaviva eren a més de deu quilòmetres del seu lloc. A ull no
 *    n'hi ha prou ni per a un poble que et penses que coneixes.
 *
 * QUÈ NO HI HA I PER QUÈ. Els punts que les administracions recomanen però que
 * queden FORA de la franja de centralitat no hi entren. La Junta de Castilla y
 * León, per exemple, en publica vuit a la província de Salamanca: són bons per
 * veure-hi l'eclipsi parcial, però el marge umbral hi és de +5,4″ a +18,7″ i la
 * línia central passa entre 175 i 237 km enllà. Pintar-los al mapa al costat
 * dels altres seria convidar algú a conduir tres hores per no veure la
 * totalitat. `catalog.test.ts` ho comprova punt per punt amb el motor.
 *
 * Tampoc no hi ha Galícia, i no per oblit: el portal de la Xunta remet als
 * ajuntaments i no publica cap llista pròpia de punts amb nom. Quan la publiqui
 * s'hi afegeix; inventar-se-la seria pitjor que no tenir-ne.
 *
 * ELS ALTRES DOS ECLIPSIS SÓN LLISTES BUIDES, A POSTA. A l'agost del 2026, per
 * al total del 2027 i l'anular del 2028 encara no hi ha cap punt oficial
 * anunciat per cap administració (la Junta d'Andalusia només ha comptat els 115
 * municipis dins de la franja del 2027, que no és el mateix). Un fitxer buit és
 * una resposta honesta; omplir-lo amb "llocs bonics" seria fer passar una
 * recomanació nostra per una decisió d'un govern.
 */

import points2026 from './2026-08-12.json';
import points2027 from './2027-08-02.json';
import points2028 from './2028-01-26.json';

/**
 * Els tres del catàleg, escrits com a unió i no com a `string`, perquè el dia
 * que se n'afegeixi un quart el compilador demani el fitxer JSON que li falta
 * en comptes de tornar una llista buida en silenci.
 */
type CatalogedEclipseId = '2026-08-12' | '2027-08-02' | '2028-01-26';

/** D'on surt la coordenada. Vegeu la regla 2 de la capçalera. */
export type ObservationPrecision = 'exact' | 'estimated';

/**
 * Quina mena de lloc és.
 * - `official`: recinte habilitat per una administració, accés lliure.
 * - `event`: cal entrada o reserva prèvia (a Navarra totes en demanen).
 * - `observatory`: observatori o planetari amb jornada de portes obertes.
 */
export type ObservationKind = 'official' | 'event' | 'observatory';

export interface LocalizedText {
  ca: string;
  es: string;
}

export interface ObservationSource {
  /** Qui ho ha anunciat, tal com s'ha d'ensenyar a la fitxa i als crèdits. */
  who: string;
  /** On ho diu. Sempre https i sempre una pàgina que es pugui obrir. */
  url: string;
}

export interface ObservationPoint {
  id: string;
  name: LocalizedText;
  lat: number;
  lon: number;
  /**
   * Altitud del recinte, si la font la publica. El camp es diu `elevationM` i
   * no `elevation` a posta: NO és el `GeoLocation` del nucli astronòmic, i que
   * es diguin diferent evita que algú faci un spread d'un punt cap a dins del
   * motor i li passi una altitud que no ve del model del terreny (vegeu el
   * comentari de `GeoLocation.elevation` a `core/astro/types.ts`).
   */
  elevationM?: number;
  precision: ObservationPrecision;
  source: ObservationSource;
  kind: ObservationKind;
  /** Context curt: comarca, si cal entrada, per què la coordenada és estimada. */
  note?: LocalizedText;
}

/**
 * La conversió de tipus és aquí i només aquí.
 *
 * TypeScript llegeix el JSON i n'infereix `precision: string`, no
 * `'exact' | 'estimated'`: no hi ha manera de fer que un `.json` importat
 * s'estrenyi sol a una unió. L'alternativa seria validar-ho en temps d'execució
 * a cada arrencada, i pagar-ho cada vegada per a una dada que no canvia mai
 * entre desplegaments. Qui garanteix la forma és `catalog.test.ts`, que
 * recorre els tres fitxers camp a camp; si algú hi fica un `precision: "meh"`,
 * la suite peta abans que no arribi enlloc.
 */
const BY_ECLIPSE: Readonly<Record<CatalogedEclipseId, readonly ObservationPoint[]>> = {
  '2026-08-12': points2026 as ObservationPoint[],
  '2027-08-02': points2027 as ObservationPoint[],
  '2028-01-26': points2028 as ObservationPoint[],
};

/**
 * Punts oficials d'un eclipsi, en l'ordre en què són al fitxer.
 *
 * Torna una llista buida per a un identificador desconegut en comptes de
 * llançar: qui crida això és la capa del mapa, i un eclipsi sense punts és un
 * estat perfectament normal (el 2027 i el 2028 encara no en tenen cap). Fer-la
 * petar deixaria el mapa sense pintar per una cosa que no és cap error.
 */
export function pointsForEclipse(eclipseId: string): readonly ObservationPoint[] {
  return BY_ECLIPSE[eclipseId as CatalogedEclipseId] ?? [];
}

/**
 * Les fonts d'un eclipsi, sense repetits i en ordre alfabètic, per al panell de
 * crèdits. Set administracions per al 2026; cap per als altres dos.
 */
export function observationSourcesFor(eclipseId: string): readonly ObservationSource[] {
  const byUrl = new Map<string, ObservationSource>();
  for (const point of pointsForEclipse(eclipseId)) {
    if (!byUrl.has(point.source.url)) byUrl.set(point.source.url, point.source);
  }
  return [...byUrl.values()].sort((a, b) => a.who.localeCompare(b.who, 'ca'));
}

/** Un punt concret, per resoldre un enllaç compartit. */
export function findObservationPoint(
  eclipseId: string,
  pointId: string,
): ObservationPoint | undefined {
  return pointsForEclipse(eclipseId).find((p) => p.id === pointId);
}
