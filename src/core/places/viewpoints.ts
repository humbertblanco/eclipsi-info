/**
 * Els miradors: la meitat PURA de la funció.
 *
 * ── PER QUÈ VIU AQUÍ I NO A `src/data/` ─────────────────────────────────────
 *
 * Perquè un mirador és un LLOC, i els llocs ja tenen carpeta. `photon.ts` et
 * diu com es diu el punt on ets; això et diu quins punts amb nom hi ha dins de
 * la franja. Són les dues cares de la mateixa pregunta i comparteixen font
 * (OpenStreetMap) i atribució (ODbL), o sigui que separar-les per carpetes
 * hauria estat separar-les per casualitat.
 *
 * Amb un matís que val la pena dir fort, perquè contradiu la capçalera del
 * barril: `places/index.ts` es presenta com «l'únic mòdul de `src/core` que
 * necessita xarxa i no funciona sense». Aquest fitxer és exactament el
 * contrari, i a posta. La geocodificació inversa passa a la butxaca de
 * l'usuari, en temps d'execució, amb cobertura; els miradors es cuinen en
 * temps de compilació (`scripts/build-viewpoints.ts`) i arriben al telèfon com
 * un fitxer estàtic. La competència ven «+22.000 miradors» com a funció de
 * pagament i els demana a un servei en viu: el dia de l'eclipsi, amb 50.000
 * persones dins d'una franja de 100 km d'amplada i la cobertura mòbil
 * col·lapsada, aquella funció no existeix. La nostra sí.
 *
 * I `src/data/` hauria estat una carpeta nova per a un sol fitxer que trenca la
 * regla del projecte: el que és pur i té proves viu a `src/core/**`.
 *
 * ── QUÈ FA AQUEST MÒDUL I QUÈ FA L'SCRIPT ───────────────────────────────────
 *
 * L'script parla amb Overpass, reintenta, canvia de mirall i escriu fitxers.
 * Res d'això es pot provar. Aquí hi ha tot el que sí que es pot: validar el que
 * arriba, decidir què és rellevant i saber si un punt cau dins de la franja.
 * La divisió té una conseqüència pràctica que no és teòrica: la CONSULTA a
 * Overpass es fa amb rectangles, que són un SUPERCONJUNT deliberat de la
 * franja, i el retall exacte el fa `insideBand` d'aquí. Un rectangle mal posat
 * només fa baixar dades de més; un retall mal fet posaria miradors on l'eclipsi
 * no és total, que és mentir.
 *
 * ── EL CRITERI DE RELLEVÀNCIA, I PER QUÈ N'HI HA D'HAVER UN ─────────────────
 *
 * OpenStreetMap té, dins de la franja del 2026, desenes de milers de
 * `natural=peak` amb nom. Posar-los tots al telèfon serien megabytes de JSON
 * per a una llista que ningú no pot llegir: entre dos turons bessons separats
 * 800 m no hi ha cap decisió a prendre. L'embut és aquest, i cada esglaó té el
 * seu perquè:
 *
 *  1. ESQUEMA. Nom no buit, coordenades finites i dins de rang, i per als cims
 *     una cota numèrica. Un cim amb nom i sense cota sol ser un microtopònim
 *     local que no surt a cap mapa; a més, sense cota no el podem ordenar.
 *  2. DUPLICATS. El mateix nom a menys de `dedupeM` metres és una sola cosa
 *     mapada dues vegades (node + àrea). Es queda el que porta cota, i entre
 *     iguals el node.
 *  3. DENSITAT. Una malla de `cellKm` km i, per cel·la, com a molt `perCell`
 *     llocs. L'ordre dins de la cel·la: primer els `tourism=viewpoint` —són
 *     llocs SENYALITZATS, amb accés i sovint aparcament, que és exactament el
 *     que necessita algú que hi va en cotxe amb temps comptat— i després els
 *     cims per cota. La malla és el que garanteix repartiment geogràfic: sense
 *     ella, un tall global per cota deixaria els Pirineus plens i Castella
 *     buida.
 *  4. SOSTRE. Si tot i així el fitxer no cabria, NO es talla per la cua: es
 *     torna a passar l'esglaó 3 amb la malla més gran. Tallar per la cua vol
 *     dir esborrar sempre la mateixa regió; eixamplar la malla vol dir
 *     aprimar-ho tot per igual. El `cellKm` amb què ha acabat cada eclipsi es
 *     desa dins del JSON, perquè un número que ha canviat sol s'ha de poder
 *     llegir després.
 *
 * ── ATRIBUCIÓ ───────────────────────────────────────────────────────────────
 *
 * Les dades són d'OpenStreetMap i van sota ODbL 1.0. `OSM_ODBL_ATTRIBUTION`
 * s'escriu DINS de cada JSON generat i ha de sortir també a la interfície allà
 * on es pintin els miradors, igual que hi surt l'atribució del mapa base.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en Node i en un
 * Worker.
 */

import {
  approxDistanceKm,
  distanceToCenterLineKm,
  eclipsePathToGeoJson,
} from '../eclipses/path';
import type { EclipsePath, PathPoint } from '../eclipses/path';
import { kmPerDegLon } from '../spots/grid';

/* ------------------------------------------------------------- atribució */

/** Atribució obligatòria de les dades d'OpenStreetMap. */
export const OSM_ODBL_ATTRIBUTION =
  '© col·laboradors d’OpenStreetMap, sota llicència ODbL 1.0';

/** On es llegeixen les condicions de la llicència. */
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

/** Identificador SPDX de la llicència, per a qui llegeixi el JSON amb codi. */
export const OSM_LICENSE_ID = 'ODbL-1.0';

/* ----------------------------------------------------------------- tipus */

/**
 * Què és el punt.
 *
 * Només dues coses, i no per simplificar: són les dues úniques etiquetes
 * d'OSM que responen «des d'on ho miro». `tourism=viewpoint` és un lloc que
 * algú ha senyalitzat com a mirador; `natural=peak`, un cim amb nom i cota.
 * La resta del relleu (colls, serres, fites) no promet cap horitzó lliure.
 */
export type ViewpointKind = 'viewpoint' | 'peak';

/** Un mirador, tal com viatja dins del JSON i tal com el llegeix l'app. */
export interface Viewpoint {
  /**
   * Identificador OSM amb prefix de tipus: `n` node, `w` way, `r` relation.
   * Amb prefix perquè el node 12345 i la via 12345 són coses diferents i sense
   * la lletra col·lidirien en qualsevol `Map` o clau de React.
   */
  id: string;
  name: string;
  /** Graus nord, arrodonits a 5 decimals (~1 m: el que val un rètol). */
  lat: number;
  /** Graus est, arrodonits a 5 decimals. */
  lon: number;
  /** Cota en metres si OSM en dona. Obligatòria als cims, opcional als miradors. */
  ele?: number;
  kind: ViewpointKind;
}

/** Element cru de l'API d'Overpass, amb només el que ens interessa. */
export interface OverpassElement {
  type?: string;
  id?: number | string;
  lat?: number;
  lon?: number;
  /** Les vies i relacions no tenen coordenada pròpia: `out center` en dona una. */
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

/** Paràmetres del filtre de rellevància. Es desen dins del JSON generat. */
export interface RelevanceOptions {
  /** Costat de la malla de densitat, en km. */
  cellKm: number;
  /** Llocs que sobreviuen per cel·la. */
  perCell: number;
  /** Radi per considerar que dos llocs amb el mateix nom són el mateix, en m. */
  dedupeM: number;
  /** Sostre de llocs per eclipsi. Si es passa, s'eixampla la malla. */
  maxCount: number;
  /** Factor amb què creix `cellKm` a cada volta del sostre. */
  growthFactor: number;
}

/**
 * Valors per defecte.
 *
 * `cellKm = 4` surt de la distància que separa dues decisions diferents: dins
 * d'un quadrat de 4 km hi caps amb el cotxe en cinc minuts i l'horitzó llunyà
 * és pràcticament el mateix, o sigui que oferir-ne dos punts és oferir soroll.
 * `perCell = 2` deixa conviure el mirador senyalitzat i el cim de la cel·la,
 * que sovint són coses ben diferents (un balcó a la carretera i un cim a peu).
 * `dedupeM = 200` és l'ordre de magnitud amb què OSM desplaça un node respecte
 * del centroide de l'àrea que descriu el mateix lloc.
 * `maxCount = 2300` surt d'una mesura i no d'un càlcul: el fitxer del 2026 va
 * donar 98 B per entrada (131 kB per a 1.336 llocs, capçalera inclosa), o
 * sigui que 2.300 són uns 225 kB i l'objectiu de 250 kB per eclipsi queda amb
 * marge per a noms més llargs dels que hi ha ara.
 */
export const DEFAULT_RELEVANCE: RelevanceOptions = {
  cellKm: 4,
  perCell: 2,
  dedupeM: 200,
  maxCount: 2300,
  growthFactor: 1.5,
};

/** El fitxer sencer que es publica a `public/data/`. */
export interface ViewpointFile {
  eclipseId: string;
  /** Quan es va generar, en ISO. Serveix per saber com de vella és l'extracció. */
  generatedAt: string;
  attribution: string;
  attributionUrl: string;
  license: string;
  /** Consulta i servidor d'on surt, per poder-ho reproduir. */
  source: string;
  /** Marge afegit a la franja, en km. */
  marginKm: number;
  /** Els paràmetres amb què es va filtrar, amb el `cellKm` REAL de sortida. */
  relevance: RelevanceOptions;
  count: number;
  viewpoints: Viewpoint[];
}

/* ------------------------------------------------------- esglaó 1: esquema */

/**
 * Passa una cota d'OSM a metres.
 *
 * L'etiqueta `ele` és text lliure i a OSM hi ha de tot: `1234`, `1234 m`,
 * `1.234` (que en castellà és mil dos-cents trenta-quatre i en anglès és un
 * metre i escaig), `1234,5`, `4000 ft`. Aquí s'accepta el que és inequívoc i
 * es rebutja la resta, que és el costat correcte: una cota inventada acabaria
 * ordenant els cims d'una comarca al revés.
 *
 *  · s'admet el punt com a decimal (`1234.5`) i la coma com a decimal
 *    (`1234,5`), perquè totes dues formes són freqüents i no ambigües;
 *  · el punt com a separador de milers (`1.234`) es rebutja, perquè `1.234`
 *    tant pot ser 1.234 m com 1,234 m i no hi ha manera de saber-ho;
 *  · qualsevol unitat que no siguin metres (`ft`, `'`) es rebutja;
 *  · el rang admissible és [−450, 9000] m: per sota hi ha el mar Mort i per
 *    damunt no hi ha res.
 */
export function parseElevationM(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const text = raw.trim().replace(/\s*m$/i, '').trim();
  if (text === '') return undefined;
  // Un punt amb exactament tres xifres al darrere és un separador de milers
  // tan sovint com un decimal: no es pot desfer l'ambigüitat, es descarta.
  if (/^-?\d{1,3}\.\d{3}$/.test(text)) return undefined;
  if (!/^-?\d+(?:[.,]\d+)?$/.test(text)) return undefined;
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value) || value < -450 || value > 9000) return undefined;
  return Math.round(value * 10) / 10;
}

/** Arrodoniment de coordenades a 5 decimals (~1 m), per no engreixar el JSON. */
function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

const TYPE_PREFIX: Record<string, string> = { node: 'n', way: 'w', relation: 'r' };

/**
 * Converteix un element d'Overpass en un mirador, o el descarta.
 *
 * Descarta —i cada motiu és una decisió, no un descuit—:
 *  · el que no porta nom: un punt sense nom no és cap lloc que puguis dir en
 *    veu alta ni buscar en un mapa, i n'hi ha desenes de milers;
 *  · el que no porta coordenada utilitzable (ni pròpia ni `center`);
 *  · el cim sense cota llegible (vegeu la capçalera i `parseElevationM`);
 *  · el que no és ni mirador ni cim.
 */
export function toViewpoint(element: OverpassElement): Viewpoint | null {
  const tags = element.tags;
  if (!tags) return null;

  const kind: ViewpointKind | null =
    tags.tourism === 'viewpoint' ? 'viewpoint' : tags.natural === 'peak' ? 'peak' : null;
  if (kind === null) return null;

  const name = typeof tags.name === 'string' ? tags.name.trim() : '';
  if (name === '') return null;

  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const prefix = TYPE_PREFIX[element.type ?? 'node'];
  if (prefix === undefined) return null;
  if (element.id === undefined || element.id === null) return null;

  const ele = parseElevationM(tags.ele);
  if (kind === 'peak' && ele === undefined) return null;

  const viewpoint: Viewpoint = {
    id: `${prefix}${element.id}`,
    name,
    lat: round5(lat),
    lon: round5(lon),
    kind,
  };
  if (ele !== undefined) viewpoint.ele = ele;
  return viewpoint;
}

/* ---------------------------------------------------- esglaó 2: duplicats */

/**
 * Normalitza un nom per comparar-lo: minúscules, sense accents i sense
 * puntuació. «Peña Ubiña» i «Pena Ubina» són el mateix lloc mapat per dues
 * persones diferents, i a OSM això passa constantment.
 */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Entre dos duplicats, es queda el que porta cota; en cas d'empat, el node. */
function betterOf(a: Viewpoint, b: Viewpoint): Viewpoint {
  if ((a.ele !== undefined) !== (b.ele !== undefined)) return a.ele !== undefined ? a : b;
  if (a.id.startsWith('n') !== b.id.startsWith('n')) return a.id.startsWith('n') ? a : b;
  return a;
}

/**
 * Fusiona els llocs que són el mateix lloc.
 *
 * El criteri és nom normalitzat idèntic I distància per sota de `radiusM`. Els
 * dos alhora: hi ha vuit «Mirador del Ebro» repartits per la vall i no són el
 * mateix, i hi ha nodes i àrees separats 80 m que sí que ho són.
 *
 * La comparació es fa dins de cada grup de nom, no entre tots amb tots: amb
 * desenes de milers d'entrades, N² serien milers de milions de distàncies.
 */
export function dedupeViewpoints(list: readonly Viewpoint[], radiusM: number): Viewpoint[] {
  const byName = new Map<string, Viewpoint[]>();
  const order: Viewpoint[] = [];

  for (const item of list) {
    const key = normalizeName(item.name);
    const group = byName.get(key);
    if (group === undefined) {
      byName.set(key, [item]);
      order.push(item);
      continue;
    }

    const twinIndex = group.findIndex(
      (other) => approxDistanceKm(other, item) * 1000 <= radiusM,
    );
    if (twinIndex < 0) {
      group.push(item);
      order.push(item);
      continue;
    }

    // El perdedor no es desa enlloc: desapareix del fitxer i prou. Si el que
    // guanya és el nou, ocupa el LLOC del vell dins de l'ordre de sortida, per
    // no moure la posició geogràfica de l'entrada dins del fitxer.
    const winner = betterOf(group[twinIndex], item);
    if (winner !== group[twinIndex]) {
      const slot = order.indexOf(group[twinIndex]);
      if (slot >= 0) order[slot] = winner;
      group[twinIndex] = winner;
    }
  }

  return order;
}

/* ----------------------------------------------------- esglaó 3: densitat */

/**
 * Ordre dins d'una cel·la: primer el mirador senyalitzat, després el cim més
 * alt. L'identificador desempata perquè el resultat no depengui de l'ordre en
 * què Overpass hagi tornat les coses — un fitxer generat dos cops ha de ser
 * byte a byte el mateix.
 */
function cellRank(a: Viewpoint, b: Viewpoint): number {
  if (a.kind !== b.kind) return a.kind === 'viewpoint' ? -1 : 1;
  const byEle = (b.ele ?? -Infinity) - (a.ele ?? -Infinity);
  if (byEle !== 0) return byEle;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Deixa com a molt `perCell` llocs per cel·la de `cellKm` km de costat.
 *
 * La malla s'ancora a l'equador i al meridià zero, no al conjunt de dades: si
 * s'ancorés a les dades, afegir un sol punt nou a l'extrem de la franja mouria
 * TOTES les cel·les i el fitxer canviaria sencer entre dues generacions.
 *
 * L'amplada en graus de longitud es calcula a la latitud de cada punt
 * (`kmPerDegLon`), o sigui que les cel·les són quadrats de veritat sobre el
 * terreny i no rectangles estirats a mesura que es puja cap al nord.
 */
export function decimateByCell(
  list: readonly Viewpoint[],
  cellKm: number,
  perCell: number,
): Viewpoint[] {
  const latSize = cellKm / 111.195;
  const cells = new Map<string, Viewpoint[]>();

  for (const item of list) {
    const row = Math.floor(item.lat / latSize);
    // La longitud de la cel·la es mesura a la latitud del CENTRE de la fila,
    // no a la del punt: dos punts de la mateixa fila han de caure a la mateixa
    // columna, i si cadascun fes servir la seva latitud no hi caurien.
    const rowLat = (row + 0.5) * latSize;
    const lonSize = cellKm / Math.max(1, kmPerDegLon(rowLat));
    const col = Math.floor(item.lon / lonSize);
    const key = `${row}/${col}`;

    const cell = cells.get(key);
    if (cell === undefined) cells.set(key, [item]);
    else cell.push(item);
  }

  const kept = new Set<Viewpoint>();
  for (const cell of cells.values()) {
    cell.sort(cellRank);
    for (const item of cell.slice(0, perCell)) kept.add(item);
  }

  // Es retorna en l'ordre d'entrada i no per cel·les: així el fitxer conserva
  // l'ordre geogràfic amb què s'ha recorregut la franja i es llegeix millor.
  return list.filter((item) => kept.has(item));
}

/* -------------------------------------------------------- esglaó 4: sostre */

export interface SelectionStats {
  /** Elements crus que ha tornat Overpass. */
  received: number;
  /** Els que passen l'esquema. */
  valid: number;
  /** Els que cauen dins de la franja + marge. */
  inBand: number;
  /** Els que queden després de fusionar duplicats. */
  deduped: number;
  /** Els que queden després de la malla de densitat. */
  kept: number;
  /** Voltes que ha calgut donar al sostre. */
  passes: number;
  /** El `cellKm` REAL amb què s'ha acabat. */
  cellKm: number;
}

export interface SelectionResult {
  viewpoints: Viewpoint[];
  stats: SelectionStats;
  /** Els paràmetres tal com han quedat, per desar-los al JSON. */
  relevance: RelevanceOptions;
}

/**
 * L'embut sencer, sobre elements ja retallats a la franja.
 *
 * `insideBand` no es crida des d'aquí a posta: qui munta el fitxer ja té la
 * franja calculada i la reutilitza per a tots els trams, i tornar-la a passar
 * per aquí obligaria a arrossegar-la fins al fons de l'embut.
 */
export function selectViewpoints(
  inBand: readonly Viewpoint[],
  options: Partial<RelevanceOptions> = {},
  counts: { received?: number; valid?: number } = {},
): SelectionResult {
  const relevance: RelevanceOptions = { ...DEFAULT_RELEVANCE, ...options };

  const deduped = dedupeViewpoints(inBand, relevance.dedupeM);

  let cellKm = relevance.cellKm;
  let kept = decimateByCell(deduped, cellKm, relevance.perCell);
  let passes = 1;

  // 1a VOLTA: CRÉIXER FINS QUE HI CAP. El sostre no talla per la cua, eixampla
  // la malla (vegeu la capçalera). El límit de voltes és una xarxa de seguretat
  // contra un `growthFactor` mal posat (≤ 1 no faria créixer res i giraria per
  // sempre).
  let tooFine = 0;
  while (kept.length > relevance.maxCount && passes < 24 && relevance.growthFactor > 1) {
    tooFine = cellKm;
    cellKm *= relevance.growthFactor;
    kept = decimateByCell(deduped, cellKm, relevance.perCell);
    passes += 1;
  }

  /*
   * 2a VOLTA: TORNAR ENRERE FINS AL LÍMIT. Créixer a salts de ×1,5 passa de
   * llarg, i passar de llarg són llocs llençats per res.
   *
   * MESURAT amb el 2026: la malla anava 4 → 6 → 9 → 13,5 → 20,25 km i el
   * fitxer sortia amb 1.336 llocs i 131 kB, quan el sostre en permetia 2.000 i
   * l'objectiu de mida són 250 kB. Mig pressupost llençat per un salt massa
   * gran. Amb la bisecció entre l'últim pas que NO cabia i el primer que sí, la
   * malla s'atura al gra més fi que hi cap. Vuit passos deixen l'interval en
   * un 0,4 % del seu valor: molt més fi que qualsevol diferència visible.
   */
  if (tooFine > 0) {
    let lo = tooFine; // no hi cabia
    let hi = cellKm; // hi cabia
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      const attempt = decimateByCell(deduped, mid, relevance.perCell);
      passes += 1;
      if (attempt.length > relevance.maxCount) {
        lo = mid;
      } else {
        hi = mid;
        cellKm = mid;
        kept = attempt;
      }
    }
  }

  return {
    viewpoints: kept,
    relevance: { ...relevance, cellKm: Math.round(cellKm * 100) / 100 },
    stats: {
      received: counts.received ?? inBand.length,
      valid: counts.valid ?? inBand.length,
      inBand: inBand.length,
      deduped: deduped.length,
      kept: kept.length,
      passes,
      cellKm: Math.round(cellKm * 100) / 100,
    },
  };
}

/* ------------------------------------------------------ la franja i el marge */

/** Rectangle geogràfic amb longituds ja reduïdes a ±180°. */
export interface BandBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Un tram de la franja: els dos límits dins d'una finestra temporal, i el
 * rectangle (amb marge) que el conté.
 *
 * PER QUÈ EN TRAMS I NO D'UNA PEÇA. Perquè la franja és global: la del 2026
 * comença a l'oceà Àrtic i acaba a les Balears, i el seu rectangle únic seria
 * mig planeta. Un rectangle així no es pot demanar a Overpass —hi ha un servei
 * comunitari a l'altra banda— i, sobretot, el punt-dins-de-polígon sobre un
 * anell que dona la volta al món no vol dir res. En trams de poc més de dos
 * centenars de quilòmetres, cada rectangle és petit i les longituds del tram
 * no fan cap salt.
 */
export interface BandChunk {
  startMs: number;
  endMs: number;
  north: PathPoint[];
  south: PathPoint[];
  /**
   * Punts de les TAPES que cauen al tram.
   *
   * Als extrems del recorregut la franja no està limitada per cap tangència
   * sinó pel terminador, i allà la vora no és ni el límit nord ni el sud sinó
   * la tapa (vegeu `eclipses/path.ts`). Al 12-08-2026, el límit nord s'acaba a
   * les 18:30:17 i la franja encara dura fins a les 18:34:05: tot aquell tram
   * —Balears incloses— té vora, però no en té de «nord». Sense comptar-hi les
   * tapes, el darrer tram es descartava sencer per manca de límit nord i Palma
   * (39,57 / 2,65), amb 96 s de totalitat, no queia dins de cap rectangle de
   * consulta.
   */
  cap: PathPoint[];
  /** Rectangle del tram amb el marge ja afegit, reduït a ±180°. */
  box: BandBox;
}

export interface BandOptions {
  /** Marge al voltant de la franja, en km. */
  marginKm?: number;
  /** Longitud de cada tram mesurada sobre la línia central, en km. */
  chunkKm?: number;
  /**
   * Latitud per damunt de la qual no es fan trams.
   *
   * 80° és el mateix tall que fa servir `eclipsePathToGeoJson`, i pel mateix
   * motiu de fons: per damunt, Web Mercator ja no dibuixa la franja, o sigui
   * que el mapa d'aquesta app no hi podria ensenyar el que hi trobés. A la
   * pràctica costa poc: el tram àrtic del 2026 és gel marí i oceà.
   *
   * AMB UNA ASIMETRIA QUE VAL MÉS DIR QUE AMAGAR: aquest límit governa QUÈ ES
   * DEMANA, no què s'accepta. `insideBand` treballa amb els límits sencers i
   * per tant deixa passar el que sí que és dins de la franja per damunt dels
   * 80°, i les cel·les de consulta, ancorades a una malla global, sobresurten
   * una mica del tram. Del 2026 en va sortir així un cim de Groenlàndia a
   * 80,58°N (n8968938148, «Nunatâmeporten»), que hi és legítimament: allà la
   * totalitat existeix. El que NO es pot prometre és que la cobertura per
   * damunt del límit sigui completa — és el que caigui dins de les cel·les que
   * s'hagin demanat, i prou.
   */
  latLimitDeg?: number;
}

const DEFAULT_MARGIN_KM = 20;
const DEFAULT_CHUNK_KM = 220;
const DEFAULT_LAT_LIMIT_DEG = 80;
const KM_PER_DEG_LAT = 111.195;

/** Redueix una longitud a [−180°, 180°). Les del camí venen desenrotllades. */
function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Punts d'una corba dins d'una finestra temporal, amb un veí a cada banda. */
function sliceWithNeighbours(
  points: readonly PathPoint[],
  startMs: number,
  endMs: number,
): PathPoint[] {
  let first = -1;
  let last = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i].timeMs >= startMs && points[i].timeMs <= endMs) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return [];
  // El veí de cada banda cus els trams: sense ell, entre dos rectangles
  // consecutius hi quedaria una escletxa d'uns quants quilòmetres justament
  // allà on la franja passa d'un tram a l'altre.
  return points.slice(Math.max(0, first - 1), Math.min(points.length, last + 2));
}

/**
 * Talla la franja en trams d'uns `chunkKm` de recorregut.
 *
 * Es mesura sobre la línia CENTRAL i no pel temps, i la diferència no és
 * acadèmica: als extrems del recorregut l'ombra corre molt més que al mig —
 * l'anular del 2028 travessa la Península sencera en els darrers 57 segons— i
 * trams d'igual durada haurien posat tot Espanya dins d'un sol rectangle
 * continental.
 */
export function bandChunks(path: EclipsePath, options: BandOptions = {}): BandChunk[] {
  const marginKm = options.marginKm ?? DEFAULT_MARGIN_KM;
  const chunkKm = options.chunkKm ?? DEFAULT_CHUNK_KM;
  const latLimit = options.latLimitDeg ?? DEFAULT_LAT_LIMIT_DEG;

  const windows: { startMs: number; endMs: number }[] = [];
  let windowStart = path.center[0]?.timeMs ?? path.startMs;
  let walked = 0;

  for (let i = 1; i < path.center.length; i++) {
    walked += approxDistanceKm(path.center[i - 1], path.center[i]);
    const isLast = i === path.center.length - 1;
    if (walked >= chunkKm || isLast) {
      windows.push({ startMs: windowStart, endMs: path.center[i].timeMs });
      windowStart = path.center[i].timeMs;
      walked = 0;
    }
  }

  const chunks: BandChunk[] = [];
  for (const window of windows) {
    const north = sliceWithNeighbours(path.northLimit, window.startMs, window.endMs).filter(
      (p) => Math.abs(p.lat) <= latLimit,
    );
    const south = sliceWithNeighbours(path.southLimit, window.startMs, window.endMs).filter(
      (p) => Math.abs(p.lat) <= latLimit,
    );
    const cap = [
      ...sliceWithNeighbours(path.startCap, window.startMs, window.endMs),
      ...sliceWithNeighbours(path.endCap, window.startMs, window.endMs),
    ].filter((p) => Math.abs(p.lat) <= latLimit);

    // Amb menys de dos punts de vora no hi ha res que acotar: és un tram que ja
    // no es pot ni dibuixar ni comprovar, i per tant tampoc no s'hi busca res.
    // Compten les tres corbes, no només els dos límits: als extrems del
    // recorregut la vora és la tapa (vegeu `BandChunk.cap`).
    if (north.length + south.length + cap.length < 2) continue;

    const box = boxOf([...north, ...south, ...cap], marginKm);
    if (box === null) continue;
    chunks.push({ startMs: window.startMs, endMs: window.endMs, north, south, cap, box });
  }

  return chunks;
}

/**
 * Rectangle que conté uns punts, amb marge. Retorna null si el tram té una
 * amplada de longitud absurda (per damunt de 180°), que només pot passar prop
 * del pol i que els límits de latitud ja haurien d'haver descartat.
 */
function boxOf(points: readonly PathPoint[], marginKm: number): BandBox | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  if (!Number.isFinite(minLat) || maxLon - minLon > 180) return null;

  const dLat = marginKm / KM_PER_DEG_LAT;
  // El marge en longitud es mesura a la latitud MÉS ALTA del tram, que és on
  // un grau val menys quilòmetres: així el marge real mai no es queda curt.
  const worstLat = Math.max(Math.abs(minLat), Math.abs(maxLat));
  const dLon = marginKm / Math.max(1, kmPerDegLon(worstLat));

  return {
    minLat: Math.max(-90, minLat - dLat),
    maxLat: Math.min(90, maxLat + dLat),
    minLon: minLon - dLon,
    maxLon: maxLon + dLon,
  };
}

/**
 * Parteix un rectangle que travessa l'antimeridià en els dos que sí que es
 * poden demanar. Overpass (i qualsevol altra API de rectangles) vol
 * minLon < maxLon: un tram del Pacífic amb les longituds desenrotllades no ho
 * compleix, i demanar-lo tal qual torna el rectangle COMPLEMENTARI — mig món.
 */
export function splitAntimeridian(box: BandBox): BandBox[] {
  if (box.maxLon - box.minLon >= 360) {
    return [{ ...box, minLon: -180, maxLon: 180 }];
  }
  const min = normalizeLon(box.minLon);
  const max = normalizeLon(box.maxLon);
  if (min <= max) return [{ ...box, minLon: min, maxLon: max }];
  return [
    { ...box, minLon: min, maxLon: 180 },
    { ...box, minLon: -180, maxLon: max },
  ];
}

/**
 * La franja preparada per preguntar-li si un punt hi cau a dins.
 *
 * `ring` és EXACTAMENT el polígon que l'app pinta al mapa: surt de
 * `eclipsePathToGeoJson`, i que sigui el mateix no és una comoditat sinó el
 * requisit. Si el filtre fes servir una geometria pròpia, hi hauria miradors
 * fora de la franja pintada, o buits dins, i l'usuari veuria la contradicció
 * de seguida.
 */
export interface BandGeometry {
  /** Anell tancat en ordre GeoJSON ([lon, lat]), el de `band` del mapa. */
  ring: readonly [number, number][];
  north: readonly PathPoint[];
  south: readonly PathPoint[];
  /**
   * Les dues TAPES: la vora dels extrems del recorregut, on la franja s'acaba
   * contra el terminador i no contra cap tangència. Compten per al marge igual
   * que els límits — un mirador vint quilòmetres més enllà de la tapa és tan
   * útil com un que és vint quilòmetres més enllà del límit nord.
   */
  caps: readonly (readonly PathPoint[])[];
  marginKm: number;
}

export function bandGeometry(path: EclipsePath, marginKm = DEFAULT_MARGIN_KM): BandGeometry {
  return {
    ring: eclipsePathToGeoJson(path).band.geometry.coordinates[0] as [number, number][],
    north: path.northLimit,
    south: path.southLimit,
    caps: [path.startCap, path.endCap],
    marginKm,
  };
}

/** Punt dins d'un anell tancat, per llançament de raig (parell/senar). */
function pointInRing(ring: readonly [number, number][], lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Un punt cau dins de la franja o del seu marge.
 *
 * Dues comprovacions, i les dues fan falta:
 *
 *  1. DINS DEL POLÍGON de la franja: la totalitat de veritat.
 *  2. A MENYS DE `marginKm` d'un dels dos límits. El marge no és cap
 *     arrodoniment. El límit té una incertesa real (vegeu `uncertainty.ts`) i,
 *     sobretot, un mirador just a fora és informació útil: des d'allà saps
 *     exactament cap on has de caminar. Amb 20 km, per exemple, Madrid entra —
 *     n'és a 13,6 km MESURATS del límit sud del 2026, que és el mateix que dir
 *     que un madrileny té la totalitat a un quart d'hora de cotxe.
 *
 * PER QUÈ SOBRE EL CAMÍ SENCER I NO TRAM A TRAM, que és com es demanen les
 * dades. Perquè un tram no és cap polígon. Amb el Sol arran d'horitzó l'ombra
 * és una el·lipse de centenars de quilòmetres, i el límit nord i el límit sud
 * d'un MATEIX instant queden separats en la direcció de la marxa: al tram 25
 * del 2026, el límit nord és a l'est de Menorca mentre el sud passa per
 * Madrid, 772 km enrere (mesurat). Tancar aquells dos trossos amb dues cordes
 * i dir-ne polígon dibuixa una figura que no és la franja. Sobre el camí
 * sencer les úniques cordes són als dos extrems del recorregut, que és
 * exactament el que ja assumeix el mapa.
 */
export function insideBand(point: { lat: number; lon: number }, band: BandGeometry): boolean {
  // Les longituds de l'anell venen desenrotllades: el punt s'hi porta sumant
  // voltes senceres, o un anell a 190° i un punt a −170° serien la mateixa
  // vertical i sortirien a 360° l'un de l'altre.
  const reference = band.ring[0]?.[0] ?? point.lon;
  const shifted = point.lon + 360 * Math.round((reference - point.lon) / 360);
  if (band.ring.length >= 4 && pointInRing(band.ring, shifted, point.lat)) return true;

  // `distanceToCenterLineKm` no té res de central: és la distància d'un punt a
  // una polilínia de `PathPoint`, i normalitza les longituds ella mateixa.
  const toNorth = distanceToCenterLineKm(point, band.north);
  if (toNorth !== null && toNorth <= band.marginKm) return true;
  const toSouth = distanceToCenterLineKm(point, band.south);
  if (toSouth !== null && toSouth <= band.marginKm) return true;
  // I les tapes, que als extrems del recorregut són l'única vora que hi ha.
  return band.caps.some((cap) => {
    const km = distanceToCenterLineKm(point, cap);
    return km !== null && km <= band.marginKm;
  });
}

/**
 * Els rectangles PETITS amb què es demana un tram, ja retallats a la franja.
 *
 * ── PER QUÈ NO ES DEMANA EL RECTANGLE DEL TRAM I PROU ───────────────────────
 *
 * Perquè no cap. Mesurat el 3 d'agost de 2026 contra `overpass-api.de`: el
 * rectangle del tram 21 del 2026 (41,20 −10,23 → 44,05 +1,61 — el nord de la
 * Península i el sud de França) conté 26.708 elements i el servidor va trigar
 * 73 SEGONS només a COMPTAR-LOS; els dos trams següents van tornar
 * directament «the server is probably too busy to handle your request». I això
 * per a un rectangle de 307.000 km² dels quals la franja n'ocupa una minsa
 * part: la resta era mar Cantàbric i Occitània, baixats per res.
 *
 * El rectangle del tram és tan gros perquè amb el Sol a 7° l'ombra és una
 * el·lipse de sis-cents quilòmetres: el límit nord i el límit sud d'un MATEIX
 * instant no són l'un damunt de l'altre, sinó separats centenars de km en la
 * direcció de la marxa. El rectangle que els conté tots dos és inevitablement
 * enorme, per curts que es facin els trams.
 *
 * ── LA SOLUCIÓ: MALLA GLOBAL I DESCART PER MOSTREIG ─────────────────────────
 *
 * Es parteix el rectangle en cel·les de com a molt `maxSpanDeg` graus i es
 * llencen les que no toquen la franja. Dues decisions dins d'això:
 *
 *  · LA MALLA S'ANCORA AL MERIDIÀ ZERO, no al rectangle del tram. Així dos
 *    trams veïns —que se solapen molt, justament al final del recorregut—
 *    generen EXACTAMENT les mateixes cel·les allà on es trepitgen, i qui
 *    demana només les ha de desduplicar per clau. Ancorades al tram, cada
 *    solapament seria una descàrrega sencera repetida.
 *  · EL DESCART ÉS PER VÈRTEXS I PER MOSTREIG: es queda la cel·la si hi cau
 *    algun punt dels límits del tram o si algun d'un mostreig de 5×5 és dins
 *    de la franja (la de veritat, `insideBand`, no cap aproximació del tram).
 *    Amb cel·les d'un grau i escaig les mostres queden a menys de 30 km l'una
 *    de l'altra, i la franja més estreta dels tres eclipsis en fa més de cent
 *    d'amplada: no se n'escapa cap. Els vèrtexs hi són per als extrems, on la
 *    franja acaba en punxa i podria entrar en una cantonada sense que cap
 *    mostra hi caigui.
 */
export function chunkQueryBoxes(
  chunk: BandChunk,
  band: BandGeometry,
  maxSpanDeg = 1.2,
): BandBox[] {
  const span = Math.max(0.05, maxSpanDeg);
  const latFrom = Math.floor(chunk.box.minLat / span);
  const latTo = Math.floor(chunk.box.maxLat / span);
  const lonFrom = Math.floor(chunk.box.minLon / span);
  const lonTo = Math.floor(chunk.box.maxLon / span);

  const vertices = [...chunk.north, ...chunk.south, ...chunk.cap];
  const boxes: BandBox[] = [];

  for (let row = latFrom; row <= latTo; row++) {
    for (let col = lonFrom; col <= lonTo; col++) {
      const cell: BandBox = {
        minLat: Math.max(-90, row * span),
        maxLat: Math.min(90, (row + 1) * span),
        minLon: col * span,
        maxLon: (col + 1) * span,
      };
      if (touchesBand(cell, vertices, band)) boxes.push(cell);
    }
  }

  return boxes;
}

/** Mostreig de 5×5 dins de la cel·la, més els vèrtexs de la franja. */
function touchesBand(
  cell: BandBox,
  vertices: readonly PathPoint[],
  band: BandGeometry,
): boolean {
  // Els vèrtexs primer: és una comparació de quatre desigualtats i resol de
  // seguida les cel·les que la franja travessa de ple, que són la majoria de
  // les que sobreviuran.
  if (
    vertices.some(
      (p) =>
        p.lat >= cell.minLat &&
        p.lat <= cell.maxLat &&
        p.lon >= cell.minLon &&
        p.lon <= cell.maxLon,
    )
  ) {
    return true;
  }

  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const lat = cell.minLat + ((cell.maxLat - cell.minLat) * i) / steps;
    for (let j = 0; j <= steps; j++) {
      const lon = cell.minLon + ((cell.maxLon - cell.minLon) * j) / steps;
      if (insideBand({ lat, lon }, band)) return true;
    }
  }
  return false;
}

/** Clau estable d'un rectangle, per desduplicar els solapaments entre trams. */
export function boxKey(box: BandBox): string {
  return [box.minLat, box.minLon, box.maxLat, box.maxLon]
    .map((v) => v.toFixed(4))
    .join('/');
}

/**
 * Un punt cau dins d'algun dels rectangles (la comprovació gruixuda).
 *
 * La longitud del PUNT es porta al marc de cada rectangle sumant voltes
 * senceres, i no al revés. Normalitzar el rectangle era el camí curt i era
 * fals: `normalizeLon(180)` val −180, o sigui que un rectangle que acabés
 * justament a l'antimeridià —els que surten de `splitAntimeridian`— es
 * quedava amb el màxim per sota del mínim i no hi entrava mai res. Així
 * serveix igual per als rectangles ja reduïts a ±180° i per als que porten
 * les longituds desenrotllades del camí.
 */
export function insideAnyBox(
  point: { lat: number; lon: number },
  boxes: readonly BandBox[],
): boolean {
  return boxes.some((box) => {
    if (point.lat < box.minLat || point.lat > box.maxLat) return false;
    const centre = (box.minLon + box.maxLon) / 2;
    const lon = point.lon + 360 * Math.round((centre - point.lon) / 360);
    return lon >= box.minLon - 1e-9 && lon <= box.maxLon + 1e-9;
  });
}

/* ------------------------------------------------------- el fitxer publicat */

/**
 * Nom del fitxer d'un eclipsi, relatiu a l'arrel publicada.
 *
 * ATENCIÓ, REGLA D'OFFLINE: qualsevol URL que l'app demani ha de sortir de
 * `src/offline/config.ts`. Aquí només hi ha el NOM, que és una convenció
 * d'aquest mòdul i de l'script que l'escriu; qui munti la capa del mapa ha
 * d'afegir la constant de la URL allà i incloure `**\/*.json` al precache del
 * service worker, o els miradors seran l'única cosa de l'app que no funcioni
 * sense cobertura — justament la funció que existeix per funcionar-hi.
 */
export function viewpointsFileName(eclipseId: string): string {
  return `data/viewpoints-${eclipseId}.json`;
}

/**
 * Validació del fitxer en llegir-lo.
 *
 * Existeix perquè el fitxer arriba d'una memòria cau que pot ser de fa mesos i
 * d'una versió anterior de l'app. Un `JSON.parse` seguit d'un `as` seria creure
 * l'usuari sobre paraula; això comprova el que després es pinta i descarta,
 * entrada a entrada, el que no quadri. Un fitxer a mitges val més que cap.
 */
export function parseViewpointFile(value: unknown): ViewpointFile | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.eclipseId !== 'string' || raw.eclipseId === '') return null;
  if (!Array.isArray(raw.viewpoints)) return null;

  const viewpoints: Viewpoint[] = [];
  for (const item of raw.viewpoints) {
    if (typeof item !== 'object' || item === null) continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== 'string' || entry.id === '') continue;
    if (typeof entry.name !== 'string' || entry.name.trim() === '') continue;
    if (typeof entry.lat !== 'number' || !Number.isFinite(entry.lat)) continue;
    if (typeof entry.lon !== 'number' || !Number.isFinite(entry.lon)) continue;
    if (entry.lat < -90 || entry.lat > 90 || entry.lon < -180 || entry.lon > 180) continue;
    if (entry.kind !== 'viewpoint' && entry.kind !== 'peak') continue;

    const viewpoint: Viewpoint = {
      id: entry.id,
      name: entry.name,
      lat: entry.lat,
      lon: entry.lon,
      kind: entry.kind,
    };
    if (typeof entry.ele === 'number' && Number.isFinite(entry.ele)) {
      viewpoint.ele = entry.ele;
    }
    viewpoints.push(viewpoint);
  }

  return {
    eclipseId: raw.eclipseId,
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : '',
    attribution:
      typeof raw.attribution === 'string' ? raw.attribution : OSM_ODBL_ATTRIBUTION,
    attributionUrl:
      typeof raw.attributionUrl === 'string' ? raw.attributionUrl : OSM_COPYRIGHT_URL,
    license: typeof raw.license === 'string' ? raw.license : OSM_LICENSE_ID,
    source: typeof raw.source === 'string' ? raw.source : '',
    marginKm: typeof raw.marginKm === 'number' ? raw.marginKm : DEFAULT_MARGIN_KM,
    relevance: { ...DEFAULT_RELEVANCE, ...(raw.relevance as Partial<RelevanceOptions>) },
    count: viewpoints.length,
    viewpoints,
  };
}
