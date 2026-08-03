/**
 * La climatologia de nuvolositat com a GRAELLA, per poder-la pintar sencera.
 *
 * ── PER QUÈ EXISTEIX AQUEST FITXER ──────────────────────────────────────────
 *
 * `outlook.ts` respon molt bé una pregunta: «i AQUÍ, què sol fer el cel?».
 * Quinze peticions a l'arxiu d'ERA5, una per any, i una xifra honesta per a un
 * punt. El problema apareix quan la pregunta canvia de forma: «i ON, dins de la
 * franja, sol fer millor cel?». Aquella pregunta no es respon amb un punt, es
 * respon amb un mapa, i un mapa de quaranta o vuitanta cel·les en directe
 * serien de sis-centes a mil dues-centes peticions cada vegada que algú mou el
 * mapa. És inviable per a l'usuari (minuts d'espera amb dades mòbils), abusiu
 * per a una API gratuïta sense clau, i sobretot INNECESSARI: la climatologia
 * d'un punt no canvia. `CLIMATOLOGY_TTL_MS` ja ho diu — cent vuitanta dies —
 * perquè la resposta d'avui i la de d'aquí a mig any són la mateixa.
 *
 * Per tant es calcula UN COP, en temps de compilació (`scripts/build-cloud-clim.ts`),
 * i es publica com un fitxer estàtic. Aquest mòdul és l'altre extrem: llegeix
 * aquell fitxer, el valida i el converteix en cel·les pintables. Res més. No hi
 * ha `fetch` aquí dins a posta — `core/` no baixa fitxers, els rep ja carregats,
 * i així el mateix codi serveix per al navegador, per a un Worker i per als
 * tests de Node.
 *
 * ── QUINA RESOLUCIÓ TÉ AIXÒ, DIT AMB EL NÚMERO MESURAT ──────────────────────
 *
 * La graella es publica a 0,25° (uns 25 km). La creença de partida era que
 * aquella era la malla d'ERA5 i que baixar-ne més seria fingir detall. S'ha
 * mesurat i NO ÉS AIXÒ: demanant a l'arxiu d'Open-Meteo latituds separades
 * 0,02°, les coordenades que torna estan enganxades a una malla de 0,0703125°
 * —7,8 km— i la nuvolositat canvia gairebé a cada salt. Un transsecte de 20
 * punts sobre Burgos (12-11-2024, 09 UTC) dona 10 valors diferents de 20, amb
 * trams iguals de 0,088° de mitjana: si a sota hi hagués una malla de 0,25°
 * interpolada, els trams farien 0,25°. O sigui que la font resol tres vegades i
 * mitja més fi del que aquí es publica, i amb informació de debò.
 *
 * Es publica a 0,25° igualment, i per raons de cost, no de física: a 0,0703° la
 * franja del 2026 tindria unes onze mil dues-centes cel·les en comptes de 888
 * —creixen amb el quadrat del pas—, generar-la costaria més de cent mil crides
 * a Open-Meteo en comptes de vuit mil i mig (deu dies sencers del límit diari
 * del pla gratuït) i el JSON passaria d'uns 55 kB a més d'un megabyte que
 * l'usuari s'ha de baixar per anar sense cobertura. La diferència entre les dues
 * coses importa: 0,25° no INVENTA res —cap cel·la ensenya més detall del que la
 * font en sap— però tampoc no és el límit de la font, i qui llegeixi aquest
 * fitxer ha de saber que hi ha marge si algun dia val la pena pagar-lo.
 *
 * Conseqüència directa que la interfície no pot amagar: el valor d'una cel·la
 * és el del seu CENTRE, no la mitjana del rectangle. Es pinta uniforme perquè
 * és el que se'n sap, no perquè el cel ho sigui.
 *
 * Els índexs `ix`/`iy` són ABSOLUTS sobre la malla de 0,25° (lat = iy · 0,25,
 * lon = ix · 0,25): dues graelles generades en dos moments diferents parlen
 * exactament de les mateixes cel·les i es poden comparar sense reprojectar res.
 *
 * ── QUÈ ES DESA I QUÈ NO ────────────────────────────────────────────────────
 *
 * La `score` de cada cel·la és la MITJANA de les puntuacions any per any, no la
 * puntuació de la nuvolositat mitjana. És la mateixa decisió —i el mateix codi—
 * que `buildClimatology` a `outlook.ts`, i és deliberada: la mitjana de «net,
 * net, tapat, tapat» no és «mig tapat sempre», i per triar on vas el que
 * importa és quantes vegades va sortir bé. Si el color del mapa i la xifra de
 * la fitxa del punt sortissin de criteris diferents, l'usuari veuria una cel·la
 * verda i, en tocar-la, un número que no hi lliga.
 *
 * Per la mateixa raó el fitxer porta la `scoringVersion`: si algú toca els
 * pesos de `layers.ts` i no torna a generar el JSON, aquest mòdul es nega a
 * llegir-lo en comptes de pintar colors d'una física antiga.
 */

import { bandForScore, SCORING_VERSION } from './layers';
import type { CloudLayers, SkyBand } from './types';
import type { Feature, FeatureCollection, Polygon } from 'geojson';

/**
 * Marca del format. Va DINS del fitxer i no al nom: el nom del fitxer el
 * decideix qui el publica i pot canviar, però un JSON que arriba a aquest
 * mòdul ha de poder dir ell mateix què és.
 */
export const CLIM_GRID_FORMAT = 'eclipsi.clouds-clim.v1';

/**
 * Columnes de la graella, en format columnar i no com a llista d'objectes.
 *
 * Amb nou-centes cel·les i tretze camps, la llista d'objectes repetiria tretze
 * noms de clau nou-centes vegades: el JSON passa de ~55 kB a ~200 kB. En una
 * app que es baixa sencera per funcionar sense cobertura, això són 140 kB que
 * l'usuari es carrega a la motxilla per res. Totes les columnes tenen la
 * mateixa llargada, i `parseCloudClimGrid` ho comprova abans que ningú les faci
 * servir.
 *
 * Tots els valors són ENTERS. La font són percentatges sencers i la mitjana de
 * quatre-centes mostres no guanya cap significat amb decimals; arrodonir aquí
 * estalvia la meitat del fitxer i no canvia cap color ni cap frase.
 */
export interface CloudClimColumns {
  /** Índex de columna sobre la malla ERA5: lon = ix · stepDeg. */
  ix: number[];
  /** Índex de fila sobre la malla ERA5: lat = iy · stepDeg. */
  iy: number[];
  /** Puntuació de visió del cel, 0-100. Mitjana de les puntuacions horàries. */
  score: number[];
  /** Quartils de la mateixa sèrie de puntuacions, 0-100. */
  p25: number[];
  p75: number[];
  /** Percentatge d'observacions amb cel net i amb cel tapat, 0-100. */
  clear: number[];
  cloudy: number[];
  /** Cobertura mitjana de cada capa i total, 0-100. */
  low: number[];
  mid: number[];
  high: number[];
  total: number[];
  /** Anys d'arxiu que han donat dades en aquesta cel·la. */
  years: number[];
  /** Observacions horàries que han entrat a l'estadística. */
  samples: number[];
}

/** El fitxer sencer, tal com surt de `scripts/build-cloud-clim.ts`. */
export interface CloudClimGrid {
  format: typeof CLIM_GRID_FORMAT;
  eclipseId: string;
  /** Versió de la física de puntuació amb què es va generar. */
  scoringVersion: number;
  /** Quan es va generar, en ms d'època. Per poder-ne dir l'edat. */
  builtAtMs: number;
  /** D'on surt la dada, dit en clar. */
  source: string;
  /** Atribució obligatòria per la llicència de les dades. */
  attribution: string;
  /** Primer i últim any de la sèrie, inclosos. */
  firstYear: number;
  lastYear: number;
  /** Dies a banda i banda de la data que entren a la finestra. */
  windowDays: number;
  /** Pas de la malla, en graus. Ha de ser el d'ERA5. */
  stepDeg: number;
  /**
   * Instants del màxim local més primerenc i més tardà de la graella, en ms
   * d'època. Cada cel·la s'ha consultat a la SEVA hora, no a una hora comuna;
   * aquests dos valors diuen quant s'obre aquell ventall. Per al 2026 són cinc
   * minuts i quart de punta a punta —de la Corunya a Maó—, cosa que amb dades
   * horàries vol dir que totes les cel·les acaben mirant les mateixes hores.
   */
  firstTargetMs: number;
  lastTargetMs: number;
  cells: CloudClimColumns;
}

/** Una cel·la ja llesta per pintar i per explicar. */
export interface ClimCell {
  ix: number;
  iy: number;
  /** Centre de la cel·la, que és el punt que s'ha consultat de veritat. */
  lat: number;
  lon: number;
  /** Vores de la cel·la, per dibuixar-la com a rectangle. */
  west: number;
  south: number;
  east: number;
  north: number;
  score: number;
  band: SkyBand;
  p25: number;
  p75: number;
  /** Fraccions de 0 a 1, com a `ClimatologyStats`. */
  clearFraction: number;
  cloudyFraction: number;
  layers: CloudLayers;
  years: number;
  sampleCount: number;
}

/** Rectangle geogràfic. Graus, est i nord positius. */
export interface GeoBBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/* --------------------------------------------------------------- validació */

export type ClimGridErrorCode =
  /** No és un objecte, o no porta la marca de format. */
  | 'bad-format'
  /** Es va generar amb uns altres pesos de puntuació: els colors mentirien. */
  | 'scoring-mismatch'
  /** Les columnes no tenen la mateixa llargada. */
  | 'ragged'
  /** Algun valor cau fora del rang que el seu significat permet. */
  | 'bad-range';

/**
 * Error de lectura de la graella.
 *
 * NO PORTA TEXT D'USUARI, i és a posta. Que aquest fitxer estigui malmès no és
 * cap cosa que l'usuari hagi fet ni pugui arreglar: és un defecte de la
 * compilació. La resposta honesta a la interfície és no ensenyar la capa —una
 * capa que no hi és s'entén sola— i no pas un missatge d'error que el deixi
 * mirant una pantalla que no pot fer res per canviar.
 */
export class CloudClimGridError extends Error {
  readonly code: ClimGridErrorCode;

  constructor(message: string, code: ClimGridErrorCode) {
    super(message);
    this.name = 'CloudClimGridError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumberField(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CloudClimGridError(`El camp «${key}» no és un número`, 'bad-format');
  }
  return value;
}

function readStringField(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new CloudClimGridError(`El camp «${key}» no és un text`, 'bad-format');
  }
  return value;
}

function readColumn(source: Record<string, unknown>, key: string): number[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    throw new CloudClimGridError(`La columna «${key}» no hi és`, 'bad-format');
  }
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isFinite(entry)) {
      throw new CloudClimGridError(
        `La columna «${key}» porta un valor que no és un número`,
        'bad-format',
      );
    }
  }
  return value as number[];
}

/** Columnes que han d'anar de 0 a 100 perquè són percentatges. */
const PERCENT_COLUMNS = [
  'score',
  'p25',
  'p75',
  'clear',
  'cloudy',
  'low',
  'mid',
  'high',
  'total',
] as const;

/**
 * Llegeix i valida el JSON de la graella.
 *
 * VALIDA DE VERITAT i no fa un `as CloudClimGrid`. Aquest fitxer arriba per
 * xarxa, es desa a la memòria cau del service worker i pot quedar-hi mesos: si
 * un dia es publica truncat o d'una versió antiga, el que s'ha d'ensenyar no és
 * un mapa amb colors inventats sinó cap mapa. Els rangs es comproven columna
 * per columna perquè un percentatge de 140 pintaria un verd que no existeix i
 * ningú se n'adonaria mirant la pantalla.
 */
export function parseCloudClimGrid(value: unknown): CloudClimGrid {
  if (!isRecord(value)) {
    throw new CloudClimGridError('La graella no és un objecte', 'bad-format');
  }
  if (value.format !== CLIM_GRID_FORMAT) {
    throw new CloudClimGridError(
      `Format desconegut: ${String(value.format)}`,
      'bad-format',
    );
  }

  const scoringVersion = readNumberField(value, 'scoringVersion');
  if (scoringVersion !== SCORING_VERSION) {
    throw new CloudClimGridError(
      `La graella es va generar amb la física de puntuació ${scoringVersion} i ara ` +
        `correm la ${SCORING_VERSION}: cal tornar a generar-la`,
      'scoring-mismatch',
    );
  }

  const stepDeg = readNumberField(value, 'stepDeg');
  if (!(stepDeg > 0)) {
    throw new CloudClimGridError('El pas de la malla ha de ser positiu', 'bad-range');
  }

  const firstYear = readNumberField(value, 'firstYear');
  const lastYear = readNumberField(value, 'lastYear');
  if (lastYear < firstYear) {
    throw new CloudClimGridError('L’últim any és anterior al primer', 'bad-range');
  }

  const rawCells = value.cells;
  if (!isRecord(rawCells)) {
    throw new CloudClimGridError('La graella no porta cel·les', 'bad-format');
  }

  const cells: CloudClimColumns = {
    ix: readColumn(rawCells, 'ix'),
    iy: readColumn(rawCells, 'iy'),
    score: readColumn(rawCells, 'score'),
    p25: readColumn(rawCells, 'p25'),
    p75: readColumn(rawCells, 'p75'),
    clear: readColumn(rawCells, 'clear'),
    cloudy: readColumn(rawCells, 'cloudy'),
    low: readColumn(rawCells, 'low'),
    mid: readColumn(rawCells, 'mid'),
    high: readColumn(rawCells, 'high'),
    total: readColumn(rawCells, 'total'),
    years: readColumn(rawCells, 'years'),
    samples: readColumn(rawCells, 'samples'),
  };

  const count = cells.ix.length;
  for (const [key, column] of Object.entries(cells)) {
    if (column.length !== count) {
      throw new CloudClimGridError(
        `La columna «${key}» té ${column.length} valors i «ix» en té ${count}`,
        'ragged',
      );
    }
  }

  for (const key of PERCENT_COLUMNS) {
    const column = cells[key];
    for (let i = 0; i < column.length; i++) {
      const entry = column[i];
      if (entry < 0 || entry > 100) {
        throw new CloudClimGridError(
          `«${key}» val ${entry} a la cel·la ${i}: un percentatge va de 0 a 100`,
          'bad-range',
        );
      }
    }
  }

  for (let i = 0; i < count; i++) {
    if (!Number.isInteger(cells.ix[i]) || !Number.isInteger(cells.iy[i])) {
      throw new CloudClimGridError(
        `La cel·la ${i} no cau sobre la malla: els índexs han de ser enters`,
        'bad-range',
      );
    }
    if (cells.p25[i] > cells.p75[i]) {
      throw new CloudClimGridError(
        `A la cel·la ${i} el quartil inferior supera el superior`,
        'bad-range',
      );
    }
    if (cells.years[i] < 1 || cells.samples[i] < 1) {
      throw new CloudClimGridError(
        `La cel·la ${i} diu tenir ${cells.years[i]} anys i ${cells.samples[i]} mostres`,
        'bad-range',
      );
    }
  }

  return {
    format: CLIM_GRID_FORMAT,
    eclipseId: readStringField(value, 'eclipseId'),
    scoringVersion,
    builtAtMs: readNumberField(value, 'builtAtMs'),
    source: readStringField(value, 'source'),
    attribution: readStringField(value, 'attribution'),
    firstYear,
    lastYear,
    windowDays: readNumberField(value, 'windowDays'),
    stepDeg,
    firstTargetMs: readNumberField(value, 'firstTargetMs'),
    lastTargetMs: readNumberField(value, 'lastTargetMs'),
    cells,
  };
}

/* ---------------------------------------------------------- cel·les pintables */

/** Converteix la fila `index` de les columnes en una cel·la pintable. */
function cellAt(grid: CloudClimGrid, index: number): ClimCell {
  const { cells, stepDeg } = grid;
  const ix = cells.ix[index];
  const iy = cells.iy[index];
  const lat = iy * stepDeg;
  const lon = ix * stepDeg;
  const half = stepDeg / 2;
  const score = cells.score[index];

  return {
    ix,
    iy,
    lat,
    lon,
    west: lon - half,
    south: lat - half,
    east: lon + half,
    north: lat + half,
    score,
    // El color surt del MATEIX llindar que la fitxa del punt. Vegeu la
    // capçalera: si aquí es fes servir cap altra regla, una cel·la verda podria
    // obrir una fitxa que digués «cel a mitges».
    band: bandForScore(score),
    p25: cells.p25[index],
    p75: cells.p75[index],
    clearFraction: cells.clear[index] / 100,
    cloudyFraction: cells.cloudy[index] / 100,
    layers: {
      low: cells.low[index],
      mid: cells.mid[index],
      high: cells.high[index],
      total: cells.total[index],
    },
    years: cells.years[index],
    sampleCount: cells.samples[index],
  };
}

/**
 * Les cel·les que toquen el rectangle visible.
 *
 * Es compara la CEL·LA SENCERA amb el rectangle, no el seu centre: una cel·la
 * de 0,25° fa uns 25 km, i amb el criteri del centre la fila de dalt i la de
 * l'esquerra desapareixerien mig fora de la pantalla just quan l'usuari arrossega
 * el mapa cap allà. La capa ha d'omplir el marc fins a la vora.
 *
 * NO CREUA L'ANTIMERIDIÀ, i no és cap descuit: les tres franges d'aquest
 * catàleg passen per Espanya i el mapa no hi arriba mai. Afegir-hi la partició
 * en dos rectangles seria codi que no es provaria mai amb dades de veritat, que
 * és la manera segura de tenir-lo trencat el dia que calgui.
 */
export function climCellsForViewport(grid: CloudClimGrid, bbox: GeoBBox): ClimCell[] {
  const half = grid.stepDeg / 2;
  const out: ClimCell[] = [];

  for (let i = 0; i < grid.cells.ix.length; i++) {
    const lat = grid.cells.iy[i] * grid.stepDeg;
    const lon = grid.cells.ix[i] * grid.stepDeg;
    if (lat + half < bbox.south || lat - half > bbox.north) continue;
    if (lon + half < bbox.west || lon - half > bbox.east) continue;
    out.push(cellAt(grid, i));
  }

  return out;
}

/** Totes les cel·les de la graella, sense filtrar. */
export function allClimCells(grid: CloudClimGrid): ClimCell[] {
  return grid.cells.ix.map((_, index) => cellAt(grid, index));
}

/**
 * La cel·la que conté un punt, si n'hi ha.
 *
 * És el que necessita la fitxa que s'obre en tocar el mapa. Cerca lineal a
 * posta: les graelles d'aquest catàleg tenen menys de mil cel·les i muntar-hi
 * un índex costaria més memòria (i més codi que es pot equivocar) que els
 * microsegons que estalviaria.
 */
export function climCellAt(
  grid: CloudClimGrid,
  lat: number,
  lon: number,
): ClimCell | null {
  const iy = Math.round(lat / grid.stepDeg);
  const ix = Math.round(lon / grid.stepDeg);
  for (let i = 0; i < grid.cells.ix.length; i++) {
    if (grid.cells.ix[i] === ix && grid.cells.iy[i] === iy) return cellAt(grid, i);
  }
  return null;
}

/** El rectangle que cobreix tota la graella. `null` si no té cap cel·la. */
export function climGridBounds(grid: CloudClimGrid): GeoBBox | null {
  if (grid.cells.ix.length === 0) return null;
  const half = grid.stepDeg / 2;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (let i = 0; i < grid.cells.ix.length; i++) {
    const lat = grid.cells.iy[i] * grid.stepDeg;
    const lon = grid.cells.ix[i] * grid.stepDeg;
    west = Math.min(west, lon - half);
    east = Math.max(east, lon + half);
    south = Math.min(south, lat - half);
    north = Math.max(north, lat + half);
  }

  return { west, south, east, north };
}

/** Propietats que viatgen amb cada rectangle del GeoJSON. */
export interface ClimCellProperties {
  score: number;
  band: SkyBand;
  clearFraction: number;
  cloudyFraction: number;
  years: number;
}

/**
 * Les cel·les com a GeoJSON de rectangles.
 *
 * Rectangles i no cercles difuminats: la cel·la és un tros de territori amb
 * vores rectes i un sol valor, i un rectangle ho diu tot sol. Un degradat radial
 * insinuaria que el valor és una mesura al centre que es va desdibuixant, que
 * és mig cert (vegeu la capçalera: el valor SÍ que és el del centre) però que
 * en un mapa es llegeix com «aquí ho sé i aquí ja no», i el que passa de debò
 * és que no en sabem res més fi enlloc.
 *
 * Les propietats són poques a posta: el que necessita el pintor per triar el
 * color i poc més. Tot el detall viu a `ClimCell`, que el mapa ja té a la mà
 * sense haver de llegir-lo de dins d'una `Feature`.
 */
export function climCellsToGeoJson(
  cells: readonly ClimCell[],
): FeatureCollection<Polygon, ClimCellProperties> {
  const features: Feature<Polygon, ClimCellProperties>[] = cells.map((cell) => ({
    type: 'Feature',
    properties: {
      score: cell.score,
      band: cell.band,
      clearFraction: cell.clearFraction,
      cloudyFraction: cell.cloudyFraction,
      years: cell.years,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [cell.west, cell.south],
          [cell.east, cell.south],
          [cell.east, cell.north],
          [cell.west, cell.north],
          [cell.west, cell.south],
        ],
      ],
    },
  }));

  return { type: 'FeatureCollection', features };
}

/**
 * Nom del fitxer de graella d'un eclipsi.
 *
 * Viu aquí i no a l'script perquè qui el genera i qui el llegeix han de fer
 * servir la mateixa regla. Amb un nom escrit a mà a cada banda, la primera
 * errada d'escriptura donaria una capa que no apareix mai i cap error visible.
 */
export function climGridFileName(eclipseId: string): string {
  return `clouds-clim-${eclipseId}.json`;
}
