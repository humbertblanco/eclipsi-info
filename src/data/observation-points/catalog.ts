/**
 * Catàleg dels punts d'observació OFICIALS: els recintes que les
 * administracions han habilitat, amb serveis i seguretat, per veure-hi
 * l'eclipsi.
 *
 * PER QUÈ ÉS ESTÀTIC I CURAT A MÀ, quan tota la resta de l'app es calcula.
 *
 * Primer: no hi ha cap API d'això. Ni una. Cada administració ho publica com
 * pot i com vol, i les vuit que hi ha aquí dins ho fan de vuit maneres
 * diferents: Astúries té un endpoint PHP que torna JSON amb `lat`/`lng` (l'únic
 * que s'assembla a una API); Castella i Lleó penja un `.xlsx` amb UTM i graus
 * decimals; la Generalitat de Catalunya els posa dins de l'HTML com a enllaços
 * `google.com/maps?q=lat,lon`; el Govern de Navarra, el d'Aragó, el de les
 * Illes Balears i la Generalitat Valenciana publiquen NOMS DE LLOC i prou; i la
 * Comunitat de Madrid, que és la darrera que hi ha entrat, publica NOMÉS EL
 * MUNICIPI —ni recinte ni adreça— repartit entre una llista a la pàgina web i
 * un PDF a part amb els que tenen totalitat. Cap format es manté d'un any per
 * l'altre i cap té versionat. Un carregador automàtic seria un carregador
 * trencat.
 *
 * Segon, i decisiu: el 12 d'agost a les 20.29 la xarxa mòbil estarà saturada
 * exactament a sobre d'aquests punts, que és on s'hi haurà concentrat la gent.
 * Una dada que només serveix el dia de l'eclipsi no es pot anar a buscar el dia
 * de l'eclipsi. Va al paquet, i s'acaba la conversa. Són 160 kB de JSON abans
 * de minificar — cars, però és el preu de no dependre de ningú quan compta.
 *
 * LES TRES REGLES QUE NO ES TOQUEN.
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
 *    ("ubicació estimada"). De 274 punts, 162 són exactes i 112 estimats.
 *
 *    Aquestes 112 coordenades són dades d'OpenStreetMap i, per ODbL, demanen
 *    atribució al panell de crèdits — la mateixa que ja hi ha per als noms de
 *    lloc (`PLACES_ATTRIBUTION_URL`, `core/places/photon.ts`).
 *
 *    Que primer les posés a ull i després les comprovés contra OSM no va sortir
 *    de franc: la vintena de Navarra ballaven de mitjana un quilòmetre i mig, i
 *    Arguedas i Sendaviva eren a més de deu quilòmetres del seu lloc. A ull no
 *    n'hi ha prou ni per a un poble que et penses que coneixes.
 *
 * 3. UN PUNT DE PARCIALITAT NO ES BARREJA MAI AMB UN DE DINS DE LA FRANJA.
 *    `phase: 'central'` vol dir que des d'allà s'hi veu la totalitat (o
 *    l'anularitat); `phase: 'partial'`, que no, encara que la font sigui igual
 *    d'oficial. Ho ha de saber qui mira el mapa ABANS de tocar el punt, no
 *    després d'obrir la fitxa.
 *
 * PER QUÈ ARA HI HA PUNTS FORA DE LA FRANJA, quan la primera tanda els
 * prohibia. La regla vella deia que un punt oficial fora de la franja no hi
 * entrava, i el cas d'escola eren els vuit de Salamanca de la Junta de Castilla
 * y León (marge umbral de +5,4″ a +18,7″, línia central de 175 a 237 km enllà).
 * Es va escriure per una por raonable: que algú conduís tres hores per no veure
 * la totalitat.
 *
 * La por era raonable i la conclusió, equivocada. A Madrid el 12 d'agost del
 * 2026 el Sol queda tapat al 99,97 % i hi viuen tres milions de persones; la
 * Comunitat de Madrid hi ha habilitat punts oficials i la gent hi anirà. Negar
 * que existeixen no fa que ningú es mogui cap a la franja: fa que qui no es pot
 * moure no trobi res. I el motor ja diu la veritat de cada punt sense
 * embellir-la — a Brunete dirà "parcial, 99,88 %, zero segons de totalitat".
 * Amb aquesta frase a la vista, ensenyar el punt no enganya ningú. El que
 * enganyava era amagar-lo.
 *
 * Els vuit de Salamanca, doncs, hi poden tornar el dia que algú els repassi:
 * ja no els exclou cap regla, només que ningú no els ha tornat a picar.
 *
 * Tampoc no hi ha Galícia ni Euskadi, i no per oblit: el portal de la Xunta
 * (`eclipse.xunta.gal`) i el d'Euskadi (`eklipsea.euskadi.eus`) publiquen mapes
 * de zones i remeten al visor de l'IGN, però cap dels dos no dona una llista de
 * punts amb nom. Comprovat el 3 d'agost del 2026. Quan la publiquin s'hi
 * afegeix; inventar-se-la seria pitjor que no tenir-ne.
 *
 * ELS ALTRES DOS ECLIPSIS SÓN LLISTES BUIDES, A POSTA. Repassat font a font el
 * 3 d'agost del 2026 i continuen sense un sol punt oficial publicat. Queda
 * escrit ON s'ha mirat, perquè el proper que hi torni comenci per on toca i no
 * repeteixi la cerca sencera:
 *
 * - `https://trioeclipses.es/puntos-de-observacion` és el portal del Govern de
 *   l'Estat (Comissió Interministerial per al Trio d'Eclipsis) i, malgrat el
 *   nom de la secció, NO publica cap punt: enllaça els portals autonòmics. Els
 *   onze que hi enllaça (Aragó, Astúries, Balears, Castella i Lleó,
 *   Castella-la Manxa, Catalunya, Euskadi, Galícia, Madrid, Navarra i València)
 *   parlen només del 12 d'agost del 2026. Andalusia, que és qui té la franja
 *   del 2027, no hi surt.
 * - Andalusia encara està DECIDINT on posar-los, i ho diu ella mateixa: el 2
 *   d'agost del 2026 va fer una jornada d'assaig sobre el terreny —accessos,
 *   aparcaments, serveis bàsics, assistència sanitària— precisament per triar
 *   emplaçaments, i l'Oficina Tècnica dels Eclipsis d'Andalusia (Fundación
 *   Descubre) té un cercador de punts ANUNCIAT, no publicat. El que sí que hi
 *   ha és el recompte dels municipis dins de la franja del 2027: 115, que són
 *   10 a Almeria, 16 a Granada, 31 a Cadis i 58 a Màlaga. Un municipi NO és un
 *   punt, i el motor ho diu amb números: al centre de Màlaga hi ha 100,0 s de
 *   totalitat, a la platja de la Misericòrdia 110,3 s, al Puerto de la Torre
 *   72,3 s i set quilòmetres al nord del centre, cap ni un — el límit nord de
 *   la franja creua aquell meridià a 36,78516 N. Dir "Màlaga" no col·loca
 *   ningú enlloc.
 * - Per a l'anular del 2028, Múrcia —que té la franja creuant-li tot el
 *   territori— ha muntat una comissió (Tri-E) que declara que "estudia" els
 *   espais d'observació. Estudiar no és publicar. Cap llista, enlloc.
 * - Al nord d'Àfrica i a Egipte, on hi ha els 6 min 23 s del 2027, tot el que
 *   surt publicat són paquets d'agències de viatges amb el recinte inclòs al
 *   preu. No és una font institucional i per la regla 1 no hi entra.
 *
 * Un fitxer buit és una resposta honesta; omplir-lo amb "llocs bonics" seria
 * fer passar una recomanació nostra per una decisió d'un govern.
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

/**
 * Si des del punt s'hi veu la fase central de l'eclipsi o només la parcial.
 * Vegeu la regla 3 de la capçalera.
 *
 * PER QUÈ ÉS UN CAMP DESAT I NO ES DERIVA EN VIU, que era l'altra opció i té
 * l'avantatge evident de no poder quedar mai desactualitzada.
 *
 * Perquè costa massa allà on caldria: `computeLocalCircumstances` triga 4,36 ms
 * per punt (mesurat, 969 ms per als 222 punts de la primera tanda), i el mapa
 * pinta els 274 de cop. Són 1,2 s de fil principal bloquejat cada vegada que
 * s'obre el mapa, per una dada que entre dos desplegaments no canvia mai.
 *
 * I l'argument de quedar desactualitzat no s'aguanta aquí, perquè
 * `catalog.test.ts` compara aquest camp amb el motor punt per punt a cada
 * execució de la suite. Si algú mou una coordenada i no toca el `phase`, la
 * suite peta. És exactament el mateix tracte que té `precision`.
 */
export type ObservationPhase = 'central' | 'partial';

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
  /**
   * Totalitat/anularitat o només parcial. Obligatori a posta: un punt sense
   * aquest camp seria un punt que el mapa pintaria com si fos de dins de la
   * franja, que és justament l'error que la regla 3 vol impedir.
   */
  phase: ObservationPhase;
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
 * Els identificadors que aquest catàleg coneix, en ordre de calendari.
 *
 * Es deriven de `BY_ECLIPSE` i no s'escriuen a part: una segona llista podria
 * quedar-se sense el quart eclipsi el dia que n'hi hagi un, i llavors les seves
 * administracions no sortirien al bloc de crèdits de «Com funciona» sense que
 * res petés.
 */
export const OBSERVATION_ECLIPSE_IDS: readonly CatalogedEclipseId[] = Object.keys(
  BY_ECLIPSE,
) as CatalogedEclipseId[];

/** Fonts d'una llista de punts, sense repetits i en ordre alfabètic. */
function sourcesOf(points: readonly ObservationPoint[]): readonly ObservationSource[] {
  const byUrl = new Map<string, ObservationSource>();
  for (const point of points) {
    if (!byUrl.has(point.source.url)) byUrl.set(point.source.url, point.source);
  }
  return [...byUrl.values()].sort((a, b) => a.who.localeCompare(b.who, 'ca'));
}

/**
 * Les fonts d'un eclipsi, sense repetits i en ordre alfabètic, per al panell de
 * crèdits. Vuit administracions per al 2026; cap per als altres dos.
 */
export function observationSourcesFor(eclipseId: string): readonly ObservationSource[] {
  return sourcesOf(pointsForEclipse(eclipseId));
}

/**
 * Totes les administracions del catàleg, de tots els eclipsis alhora.
 *
 * És el que necessita una pàgina que no mira cap eclipsi en concret —«Com
 * funciona» explica l'app, no una data—, mentre que el diàleg del mapa vol les
 * de l'eclipsi que s'està mirant i per això té la funció d'abans. Avui les dues
 * responen el mateix, perquè només el 2026 té punts; el dia que el 2027 en
 * tingui, la diferència es notarà i cadascuna seguirà dient la veritat.
 */
export function allObservationSources(): readonly ObservationSource[] {
  return sourcesOf(OBSERVATION_ECLIPSE_IDS.flatMap((id) => [...pointsForEclipse(id)]));
}

/** Un punt concret, per resoldre un enllaç compartit. */
export function findObservationPoint(
  eclipseId: string,
  pointId: string,
): ObservationPoint | undefined {
  return pointsForEclipse(eclipseId).find((p) => p.id === pointId);
}
