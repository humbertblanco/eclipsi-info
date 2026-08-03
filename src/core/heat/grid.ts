/**
 * La graella del mapa de calor: quines cel·les es pinten i on cauen.
 *
 * ── PER QUÈ LES CEL·LES SÓN TESSEL·LES I NO UNA RETÍCULA PRÒPIA ─────────────
 *
 * Una cel·la d'aquest mapa és una tessel·la de Web Mercator d'un zoom fix, o
 * sigui una subdivisió exacta de la tessel·la que el mapa ja ensenya: el zoom
 * de cel·la és el del mapa MÉS QUATRE, i per tant cada tessel·la visible queda
 * partida en 16 × 16 cel·les. D'aquí surten tres coses que una retícula pròpia
 * (com la hexagonal de `spots/grid.ts`) no dona:
 *
 *  1. L'IDENTIFICADOR ÉS ESTABLE PER CONSTRUCCIÓ. `z/x/y` no depèn d'on tenies
 *     el mapa quan vas demanar la passada: dues passades amb el mateix zoom
 *     tornen exactament els mateixos identificadors per a les cel·les comunes,
 *     i per tant la memòria cau (`cache.ts`) encerta sempre en comptes de fer
 *     un no-encert per cada moviment de mig quilòmetre. La graella hexagonal
 *     de la cerca de llocs s'ancora a una retícula global justament pel mateix
 *     motiu; aquí surt de franc.
 *  2. EL POLÍGON QUE ES PINTA JA EXISTEIX. `tileBoundsLonLat` dona les quatre
 *     cantonades. Cap conversió, cap solapament, cap escletxa entre veïnes.
 *  3. NO CAL RE-ENQUADRAR EN FER ZOOM. En canviar de nivell, cada cel·la vella
 *     conté exactament quatre de noves.
 *
 * La contrapartida honesta: en Mercator la cel·la no és quadrada sobre el
 * terreny — a 41° fa uns 920 m d'est a oest i uns 690 m de nord a sud a zoom
 * 15 (la deformació de Mercator és 1/cos φ). Per a un mapa de calor això no
 * mou cap número: el que es calcula és el punt, no l'àrea. `sizeKm` publica el
 * costat est-oest, que és el que fa servir el submostreig del cim.
 *
 * ── RESOLUCIÓ ADAPTATIVA, I EL SOSTRE ───────────────────────────────────────
 *
 * A zoom 9 la cel·la fa ~3,7 km, a 10 ~1,8 km i a 11 o més ~0,9 km (mesurat a
 * 41° de latitud). Per sota del zoom 9 la cel·la seria de desenes de km i la
 * pregunta «quants segons se'n menja el relleu» ja no té resposta a aquella
 * escala: el nivell 2 no s'ofereix (`terrainAvailable: false`) i el mapa només
 * pot pintar la durada teòrica. Dir-ho al tipus és el contracte: qui pinta no
 * ha d'endevinar quan una xifra és una mesura i quan és una estimació.
 *
 * I hi ha un SOSTRE DUR de 800 cel·les per passada. No és un número rodó
 * qualsevol: mesurat, 800 cel·les llegeixen 7,09 M mostres del terreny, que amb
 * tessel·les reals són ~3,3 s de garbell més ~1,9 s de xarxa (la taula sencera,
 * amb el que hi ha mesurat i el que hi ha extrapolat, és a la capçalera de
 * `compute.ts`). Passar-ne mou el mapa cap a la desena de segons, que és on la
 * gent deixa de mirar. Si en surten més, s'engruixeix la cel·la (un zoom menys,
 * quatre vegades menys cel·les) fins que hi càpiguen — i, si en sobren,
 * s'afina de tornada.
 *
 * ON ES TOQUEN EL SOSTRE I LA RESOLUCIÓ, DIT CLAR. Una pantalla de mòbil fa
 * ~1,5 × 2,7 tessel·les, o sigui ~24 × 43 = 1.030 cel·les a la resolució
 * nominal: just per damunt del sostre. En un mòbil amb el retall a la franja
 * mossegant una mica, la passada hi cap; en un enquadrament ample (tauleta,
 * escriptori, o mirant la franja de lluny) baixa un nivell i les cel·les
 * dupliquen de costat. És el preu del sostre i és la tria correcta: val més un
 * mapa gruixut de seguida que un de fi que no arriba mai.
 *
 * ── EL RETALL A LA FRANJA ───────────────────────────────────────────────────
 *
 * Fora de la franja de centralitat la resposta ja la sabem: zero segons. No es
 * calcula, no es baixa terreny i no es pinta. El retall és punt-dins-polígon
 * contra `eclipsePathToGeoJson(computeEclipsePath(id)).band` amb un marge de
 * ~10 km, perquè el límit de la franja té la seva pròpia incertesa i pintar
 * just fins a la ratlla seria fingir una precisió que no tenim.
 *
 * COMPTE AMB EL 2026: la seva franja comença a Sibèria, PASSA PEL POL i baixa
 * cap a Islàndia i la Península (vegeu `path.ts`, `drawableRuns`). L'anell del
 * polígon ja arriba retallat a ±80° de latitud i sense salts de longitud —
 * mesurat: 499 vèrtexs, longituds de −33,9° a +5,6°, salt màxim 14,2° — i per
 * això el test punt-dins-polígon d'aquí pot ser el clàssic i prou. Si algun dia
 * `path.ts` deixés de retallar, això s'hauria de tornar a mirar.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { computeEclipsePath, eclipsePathToGeoJson } from '../eclipses/path';
import { tileBoundsLonLat } from '../horizon/elevation';
import { kmPerDegLon } from '../spots/grid';

/** Km d'un grau de latitud. Constant a efectes pràctics, com a `spots/grid.ts`. */
const KM_PER_DEG_LAT = 111.32;

/** Latitud on Web Mercator es talla. Més enllà no hi ha ni tessel·les ni mapa. */
const MERCATOR_LAT_LIMIT = 85.0511;

/**
 * Cel·les que es calculen com a màxim en una passada. Vegeu la capçalera: surt
 * del cost mesurat del garbell, no d'una xifra rodona.
 */
export const MAX_CELLS_PER_PASS = 800;

/** Marge de tolerància al voltant de la franja, en km. */
export const BAND_MARGIN_KM = 10;

/**
 * Diferència entre el zoom del mapa i el de la cel·la: 16 × 16 cel·les per
 * tessel·la visible.
 */
const CELL_ZOOM_OFFSET = 4;

/** Zoom de cel·la més fi que s'ofereix (~0,9 km a 41°). Més enllà no aporta res. */
const MAX_CELL_ZOOM = 15;
/** Zoom de cel·la més gruixut que s'ofereix a un mapa allunyat (~7,4 km a 41°). */
const MIN_OFFERED_CELL_ZOOM = 12;
/**
 * Zoom de cel·la més gruixut al qual pot arribar l'engruiximent del sostre.
 *
 * Zoom 2 són setze cel·les per a tot el planeta. No és cap resolució útil i no
 * s'ofereix mai (`resolutionForZoom` no baixa de 12): és el terra que garanteix
 * que el sostre de cel·les es pugui complir SEMPRE, fins i tot si algú demana
 * el món sencer sense retallar a la franja. Amb un terra més alt, aquell cas
 * tornaria desenes de milers de cel·les i el sostre seria una promesa falsa.
 */
const MIN_CELL_ZOOM = 2;
/**
 * Per sota d'aquest zoom de mapa, el nivell 2 (relleu) no s'ofereix: la cel·la
 * ja fa desenes de km i la pregunta no té resposta a aquella escala.
 */
const MIN_TERRAIN_MAP_ZOOM = 9;

export interface HeatBbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface HeatCell {
  /** Clau estable: `z/x/y` de la tessel·la que ÉS la cel·la. */
  id: string;
  /** Centre de la cel·la, en graus. */
  lat: number;
  lon: number;
  /** Anell tancat [lon, lat], llest per a un `Polygon` de GeoJSON. */
  poly: [number, number][];
  /** Zoom de la tessel·la-cel·la. */
  cellZoom: number;
  /** Costat est-oest de la cel·la a la seva latitud, en km. */
  sizeKm: number;
}

export interface HeatResolution {
  cellZoom: number;
  /** Costat de la cel·la a 41° de latitud, en km. Per poder-ho dir a l'usuari. */
  approxKm: number;
  /**
   * Fals quan a aquest zoom no té sentit oferir el nivell 2. El mapa pot
   * pintar la durada teòrica, però no ha de prometre cap mesura de relleu.
   */
  terrainAvailable: boolean;
}

/** Latitud de referència per publicar la mida de cel·la. Espanya central. */
const REFERENCE_LAT = 41;

/** Costat est-oest d'una tessel·la de zoom `z` a una latitud, en km. */
export function cellSizeKm(cellZoom: number, latDeg: number): number {
  return (360 / 2 ** cellZoom) * kmPerDegLon(latDeg);
}

/**
 * Quina resolució toca a un zoom de mapa.
 *
 * z ≤ 8 → 7,4 km i sense relleu; z9 → 3,7 km; z10 → 1,8 km; z11+ → 0,9 km.
 */
export function resolutionForZoom(mapZoom: number): HeatResolution {
  const cellZoom = Math.min(
    MAX_CELL_ZOOM,
    Math.max(MIN_OFFERED_CELL_ZOOM, Math.round(mapZoom) + CELL_ZOOM_OFFSET),
  );
  return {
    cellZoom,
    approxKm: cellSizeKm(cellZoom, REFERENCE_LAT),
    terrainAvailable: Math.round(mapZoom) >= MIN_TERRAIN_MAP_ZOOM,
  };
}

/* ------------------------------------------------------------ la franja */

export interface BandClip {
  /** Anell exterior del polígon de la franja, [lon, lat]. */
  ring: readonly [number, number][];
  bbox: HeatBbox;
}

const bandCache = new Map<string, BandClip>();

/**
 * Anell de la franja d'un eclipsi, calculat un sol cop per identificador.
 *
 * `computeEclipsePath` costa entre 108 i 147 ms (mesurat, els tres eclipsis del
 * catàleg) i el resultat no depèn de res més que de l'identificador: recalcular-lo
 * a cada moviment del mapa seria pagar un dècim de segon per no res.
 */
export function bandClipFor(eclipseId: string): BandClip {
  const cached = bandCache.get(eclipseId);
  if (cached) return cached;

  const ring = eclipsePathToGeoJson(computeEclipsePath(eclipseId)).band.geometry
    .coordinates[0] as [number, number][];

  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }

  const clip: BandClip = { ring, bbox: { west, south, east, north } };
  bandCache.set(eclipseId, clip);
  return clip;
}

/** Punt dins de l'anell, per llançament de raig cap a l'est. */
function ringContains(ring: readonly [number, number][], lon: number, lat: number): boolean {
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
 * Distància d'un punt a l'anell de la franja, en km.
 *
 * Equirectangular local al punt, com `distanceToCenterLineKm` de `path.ts`: la
 * pregunta només s'ha de respondre bé prop del mínim —a deu quilòmetres del
 * límit— i allà l'error és de metres.
 */
function distanceToRingKm(
  ring: readonly [number, number][],
  lon: number,
  lat: number,
): number {
  const kx = kmPerDegLon(lat);
  let best = Infinity;

  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - lon) * kx;
    const ay = (ring[i][1] - lat) * KM_PER_DEG_LAT;
    const bx = (ring[i + 1][0] - lon) * kx;
    const by = (ring[i + 1][1] - lat) * KM_PER_DEG_LAT;

    const d2a = ax * ax + ay * ay;
    if (d2a < best) best = d2a;

    const ux = bx - ax;
    const uy = by - ay;
    const len2 = ux * ux + uy * uy;
    if (len2 < 1e-9) continue;
    const t = -(ax * ux + ay * uy) / len2;
    if (t <= 0 || t >= 1) continue;
    const px = ax + t * ux;
    const py = ay + t * uy;
    const d2 = px * px + py * py;
    if (d2 < best) best = d2;
  }

  // L'últim vèrtex el cobreix el tancament de l'anell; si l'anell fos buit,
  // Infinity és la resposta correcta i no zero.
  return Math.sqrt(best);
}

/**
 * Cert si el punt és dins de la franja o a menys de `marginKm` del seu límit.
 */
export function bandContains(
  clip: BandClip,
  lon: number,
  lat: number,
  marginKm: number = BAND_MARGIN_KM,
): boolean {
  if (clip.ring.length < 3) return false;

  // Rebuig barat per caixa: la immensa majoria de cel·les d'una passada cauen
  // ben lluny de la franja i no han de pagar cap recorregut de l'anell.
  const dLat = marginKm / KM_PER_DEG_LAT;
  const dLon = marginKm / Math.max(kmPerDegLon(lat), 0.001);
  if (
    lat < clip.bbox.south - dLat ||
    lat > clip.bbox.north + dLat ||
    lon < clip.bbox.west - dLon ||
    lon > clip.bbox.east + dLon
  ) {
    return false;
  }

  if (ringContains(clip.ring, lon, lat)) return true;
  return distanceToRingKm(clip.ring, lon, lat) <= marginKm;
}

/* ------------------------------------------------------------ la graella */

export interface ViewportOptions {
  /** Sostre de cel·les. Per defecte `MAX_CELLS_PER_PASS`. */
  maxCells?: number;
  /** Marge al voltant de la franja, en km. */
  marginKm?: number;
  /** Força un zoom de cel·la concret. Només per a proves i mesures. */
  cellZoom?: number;
}

/** Índex de tessel·la que conté una longitud, a un zoom. */
function tileX(lon: number, z: number): number {
  const n = 2 ** z;
  return Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
}

/** Índex de tessel·la que conté una latitud, a un zoom. */
function tileY(lat: number, z: number): number {
  const n = 2 ** z;
  const clamped = Math.min(MERCATOR_LAT_LIMIT, Math.max(-MERCATOR_LAT_LIMIT, lat));
  const rad = (clamped * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return Math.min(n - 1, Math.max(0, Math.floor(y)));
}

function buildCell(cellZoom: number, x: number, y: number): HeatCell {
  const b = tileBoundsLonLat(cellZoom, x, y);
  // Centre geomètric en graus i no en Mercator: la diferència en latitud dins
  // d'una cel·la de 900 m és de centímetres, i el punt ha de ser el que un
  // humà entendria per «el mig d'aquest quadrat del mapa».
  const lat = (b.north + b.south) / 2;
  const lon = (b.west + b.east) / 2;
  return {
    id: `${cellZoom}/${x}/${y}`,
    lat,
    lon,
    poly: [
      [b.west, b.south],
      [b.east, b.south],
      [b.east, b.north],
      [b.west, b.north],
      [b.west, b.south],
    ],
    cellZoom,
    sizeKm: cellSizeKm(cellZoom, lat),
  };
}

/**
 * Tessel·les d'un zoom que cobreixen un rectangle geogràfic.
 *
 * `ringTiles` de `horizon/raycast.ts` cobreix DISCS, que és el que necessita un
 * raig d'horitzó. Un enquadrament de mapa és un rectangle, i cobrir-lo amb el
 * disc que el conté vol dir baixar fins a un 27 % més de tessel·les de terreny
 * —xarxa de l'usuari, al camp— per res. Per això aquesta funció existeix i no
 * s'ha reaprofitat aquella.
 */
export function tilesForBbox(
  bbox: HeatBbox,
  zoom: number,
): { z: number; x: number; y: number }[] {
  if (!(bbox.east > bbox.west) || !(bbox.north > bbox.south)) return [];
  const x0 = tileX(bbox.west, zoom);
  const x1 = tileX(bbox.east, zoom);
  const y0 = tileY(bbox.north, zoom);
  const y1 = tileY(bbox.south, zoom);

  const tiles: { z: number; x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) tiles.push({ z: zoom, x, y });
  }
  return tiles;
}

/**
 * Les cel·les que toca calcular per a un enquadrament i un zoom.
 *
 * `band` pot ser l'identificador d'un eclipsi (l'anell es calcula i es recorda)
 * o un `BandClip` ja fet. Sense franja no es retalla res, que és el que volen
 * les proves de geometria pura.
 *
 * L'antimeridià queda fora del contracte a posta: cap dels tres eclipsis del
 * catàleg no el travessa per la banda que aquesta app ensenya, i partir
 * l'enquadrament en dos trossos seria codi que ningú no exercita mai. Si
 * `east < west`, l'enquadrament es descarta i no es torna cap cel·la.
 */
export function cellsForViewport(
  bbox: HeatBbox,
  mapZoom: number,
  band?: string | BandClip,
  options: ViewportOptions = {},
): HeatCell[] {
  const {
    maxCells = MAX_CELLS_PER_PASS,
    marginKm = BAND_MARGIN_KM,
    cellZoom: forcedZoom,
  } = options;

  if (!(bbox.east > bbox.west) || !(bbox.north > bbox.south)) return [];

  const clip =
    band === undefined ? null : typeof band === 'string' ? bandClipFor(band) : band;

  const wanted = forcedZoom ?? resolutionForZoom(mapZoom).cellZoom;

  /** Cel·les brutes de l'enquadrament a un zoom, abans de retallar. */
  const rawCount = (z: number): number => {
    const x0 = tileX(bbox.west, z);
    const x1 = tileX(bbox.east, z);
    const y0 = tileY(bbox.north, z);
    const y1 = tileY(bbox.south, z);
    return (x1 - x0 + 1) * (y1 - y0 + 1);
  };

  const generate = (z: number): HeatCell[] => {
    const x0 = tileX(bbox.west, z);
    const x1 = tileX(bbox.east, z);
    const y0 = tileY(bbox.north, z);
    const y1 = tileY(bbox.south, z);

    const cells: HeatCell[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cell = buildCell(z, x, y);
        if (clip !== null && !bandContains(clip, cell.lon, cell.lat, marginKm)) continue;
        cells.push(cell);
      }
    }
    return cells;
  };

  // Primer engruiximent, a ULL i sense generar res: no té sentit fabricar
  // desenes de milers de cel·les per llençar-ne el 98 %. Vuit vegades el sostre
  // és el marge que deixa treballar el retall a la franja —que sol quedar-se
  // una fracció petita de l'enquadrament— sense pagar una generació absurda.
  let cellZoom = wanted;
  while (cellZoom > MIN_CELL_ZOOM && rawCount(cellZoom) > maxCells * 8) cellZoom--;

  let cells = generate(cellZoom);

  // Engruiximent de debò: el sostre és dur.
  while (cells.length > maxCells && cellZoom > MIN_CELL_ZOOM) {
    cellZoom--;
    cells = generate(cellZoom);
  }

  // I afinament de tornada, que és el que rescata el cas normal. El retall a la
  // franja se sol quedar una llenca estreta de l'enquadrament, i sense això
  // l'estimació a ull de fa dues línies deixaria el mapa quatre vegades més
  // gruixut del que hi cabria — i cap usuari no entendria per què la seva
  // comarca es pinta a blocs de 15 km quan el mapa n'ensenya 30.
  while (cellZoom < wanted && cells.length * 4 <= maxCells) {
    const finer = generate(cellZoom + 1);
    if (finer.length > maxCells) break;
    cellZoom++;
    cells = finer;
  }

  return cells;
}
