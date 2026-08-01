/**
 * Raycast del perfil d'horitzó 360°.
 *
 * Per cada azimut llancem un raig sobre el model digital del terreny i ens
 * quedem amb l'altura APARENT màxima que hi trobem. El resultat és la silueta
 * real del terreny vista des del punt de l'observador, que és el que decideix
 * si l'eclipsi del 12-08-2026 — amb el Sol entre 1,4° i 12,5° a Espanya — es
 * veu o se'l menja una serralada.
 *
 * EL TERME DE CURVATURA NO ÉS OPCIONAL. L'altura aparent d'un punt del terreny
 * a distància d és:
 *
 *     alt = atan2( h(d) − h0 − d²/(2·R_eff),  d )
 *
 * amb R_eff = R_terra/(1−k) i k = 0,13 (refracció terrestre estàndard, que
 * corba els raigs cap avall i fa "veure" un 15% més enllà de l'horitzó
 * geomètric). El terme d²/(2·R_eff) val 6,8 m a 10 km, 44 m a 25 km i 437 m a
 * 80 km. Sense ell, un cim a 80 km surt 0,31° massa alt — el mateix ordre de
 * magnitud que les altures solars que estem mesurant, o sigui un error fatal.
 *
 * Estratègia de zoom per anells: baixar 150 km de radi a z12 serien milers de
 * tessel·les. Com que la resolució angular que necessitem és constant, la
 * resolució LINEAL pot créixer amb la distància: z12 (~30 m) fins a 10 km,
 * z11 (~60 m) fins a 40 km i z10 (~120 m) fins a 150 km. A 40 km, 60 m de
 * terreny subtendeixen 0,09°; a 150 km, 120 m en subtendeixen 0,05°. Ens ho
 * podem permetre.
 *
 * Cap dependència de DOM més enllà de la que ja té `elevation.ts` (que fa
 * servir OffscreenCanvas amb fallback): aquest mòdul està pensat per córrer
 * dins d'un Web Worker.
 */

import { DEG, EARTH_EQUATORIAL_RADIUS_KM, RAD } from '../astro/constants';
import type { GeoLocation } from '../astro/types';
import {
  DEFAULT_ZOOM,
  elevationAtSync,
  lonLatToTilePixel,
  prefetchTiles,
  TILE_SIZE,
  tileBoundsLonLat,
  tileKey,
  type TileId,
} from './elevation';
import { HORIZON_PROFILE_VERSION, type HorizonProfile } from './profile';

/** Radi terrestre en metres. Reutilitzem la constant del nucli astronòmic. */
const EARTH_RADIUS_M = EARTH_EQUATORIAL_RADIUS_KM * 1000;

/**
 * Coeficient de refracció terrestre estàndard. És la fracció de la curvatura
 * de la Terra que compensa el gradient de densitat de l'aire baix. 0,13 és el
 * valor de manual per a atmosfera mitjana; en inversions tèrmiques fortes
 * (matinades fredes sobre plana) pot arribar a 0,25 i deixar veure per damunt
 * de cims que "haurien" de tapar. Ho deixem configurable per això mateix.
 */
export const TERRESTRIAL_REFRACTION_K = 0.13;

/** 1440 raigs. Pas de 0,25°, la meitat del diàmetre aparent del Sol. */
export const DEFAULT_AZIMUTH_STEP_DEG = 0.25;

export interface HorizonRing {
  /** Distància fins on s'aplica aquest anell, en km. */
  maxDistanceKm: number;
  zoom: number;
}

export const DEFAULT_RINGS: HorizonRing[] = [
  { maxDistanceKm: 10, zoom: 12 },
  { maxDistanceKm: 40, zoom: 11 },
  { maxDistanceKm: 150, zoom: 10 },
];

/**
 * Cel·les del model per sota de les quals no mostregem.
 *
 * El camp proper té un braç de palanca brutal: a 50 m de distància, 10 m de
 * desnivell són 11°. Per sota d'una cel·la del model no hi ha informació de
 * cap mena — el que hi llegim és el que s'ha inventat la interpolació
 * bilineal entre quatre píxels —, i just allà és on qualsevol error es
 * multiplica. Comencem a dues cel·les, que a z12 i latitud ibèrica són uns
 * 57 m.
 *
 * El que queda per sobre d'aquest tall SÍ que és senyal i no soroll: si ets en
 * un pendent, el terreny a 60 m amunt et tapa de veritat. Per això el tall és
 * modest — la protecció de debò contra falsos horitzons és que h0 surti del
 * mateix model que el terreny (vegeu `computeHorizonProfile`), no aquest
 * marge.
 */
export const NEAR_FIELD_CELLS = 2;

/**
 * Distància mínima de mostreig, derivada de la resolució real del model a
 * aquell zoom i aquella latitud. No és un número màgic: és la mida de la
 * cel·la del terreny multiplicada per `cells`.
 */
export function minSampleDistanceM(
  zoom: number,
  latDeg: number,
  cells: number = NEAR_FIELD_CELLS,
): number {
  return cells * groundResolutionM(zoom, latDeg);
}

/**
 * Diferència, en metres, a partir de la qual considerem que l'altitud que ens
 * han passat no és de fiar.
 *
 * L'error vertical típic d'un GPS de mòbil és de ±10 a ±30 m. Quinze metres
 * queda per sobre del desacord normal entre el model i una cota ben presa, i
 * per sota de l'error d'un GPS: el que caigui més enllà gairebé segur que ve
 * del GPS o d'un valor escrit a mà.
 */
export const ELEVATION_MISMATCH_THRESHOLD_M = 15;

export interface HorizonProgress {
  phase: 'tiles' | 'raycast';
  /** Progrés global de 0 a 1. */
  ratio: number;
  loadedTiles: number;
  totalTiles: number;
  /** Text llest per ensenyar a la interfície, en català. */
  message: string;
}

export interface RaycastOptions {
  azimuthStepDeg?: number;
  rings?: HorizonRing[];
  refractionK?: number;
  /**
   * Altura de l'observador PER DAMUNT DEL TERRENY DEL MODEL, en metres.
   *
   * És un desplaçament relatiu, mai una altitud absoluta: l'origen sempre és
   * la cota que el model dona al punt on ets. Aquí és on van els casos reals
   * d'estar enfilat a alguna cosa que el model no coneix — un mirador, un
   * terrat, el sostre d'un cotxe, una torre.
   *
   * Per defecte 0, no 1,6: el veredicte que en surt és lleugerament
   * PESSIMISTA (el terreny et tapa una mica abans del que et taparà de
   * veritat), i val més equivocar-se cap al costat que fa que l'usuari busqui
   * un lloc millor.
   */
  eyeHeightM?: number;
  /**
   * Puja a 0 m les elevacions negatives. Les tessel·les terrarium inclouen
   * batimetria: mar endins llegiríem −2000 m i l'horitzó marí sortiria molt més
   * avall del que és. La superfície de l'aigua és a 0 m i és el que et tapa.
   */
  clampToSeaLevel?: boolean;
  onProgress?: (progress: HorizonProgress) => void;
  signal?: AbortSignal;
}

/** Radi efectiu de la Terra un cop absorbida la refracció terrestre. */
export function effectiveEarthRadiusM(k: number = TERRESTRIAL_REFRACTION_K): number {
  return EARTH_RADIUS_M / (1 - k);
}

/**
 * Quant baixa un objecte per la curvatura de la Terra, en metres, a distància
 * `distanceM`. És el terme que fa que l'horitzó existeixi.
 */
export function curvatureDropM(
  distanceM: number,
  k: number = TERRESTRIAL_REFRACTION_K,
): number {
  return (distanceM * distanceM) / (2 * effectiveEarthRadiusM(k));
}

/**
 * Altura aparent, en graus, d'un punt del terreny a `distanceM` de l'observador.
 * Aquesta és la fórmula nuclear de tot el mòdul.
 */
export function apparentAltitudeDeg(
  targetElevationM: number,
  observerElevationM: number,
  distanceM: number,
  k: number = TERRESTRIAL_REFRACTION_K,
): number {
  const rise = targetElevationM - observerElevationM - curvatureDropM(distanceM, k);
  return Math.atan2(rise, distanceM) * RAD;
}

/**
 * Depressió de l'horitzó marí, en graus (negativa), per a un observador a
 * `observerElevationM`.
 *
 * Serveix de terra al perfil: com que el terreny enlloc no està per sota del
 * nivell del mar de manera rellevant, l'horitzó real MAI pot ser més baix que
 * el que dona una superfície a 0 m estesa fins a l'infinit. Sense aquest terra,
 * un observador a 2000 m tindria un perfil massa alt en els sectors on el
 * terreny cau més enllà dels 150 km que explorem.
 */
export function horizonDipDeg(
  observerElevationM: number,
  k: number = TERRESTRIAL_REFRACTION_K,
): number {
  const h = Math.max(observerElevationM, 0);
  return -Math.sqrt((2 * h) / effectiveEarthRadiusM(k)) * RAD;
}

/** Distància a l'horitzó marí, en metres. */
export function horizonDistanceM(
  observerElevationM: number,
  k: number = TERRESTRIAL_REFRACTION_K,
): number {
  const h = Math.max(observerElevationM, 0);
  return Math.sqrt(2 * h * effectiveEarthRadiusM(k));
}

/** Mida en metres d'un píxel de tessel·la a un zoom i una latitud donats. */
export function groundResolutionM(zoom: number, latDeg: number): number {
  return (
    (2 * Math.PI * EARTH_RADIUS_M * Math.cos(latDeg * DEG)) /
    (TILE_SIZE * 2 ** zoom)
  );
}

/**
 * Punt destí seguint un cercle màxim (fórmula directa de navegació). Cal fer-ho
 * amb esfèrica i no amb una aproximació plana: a 150 km i a latitud 42°, tractar
 * la Terra com un pla desplaça el punt més d'1,5 km per la convergència dels
 * meridians, prou per apuntar a una vall en comptes d'a un cim.
 */
export function destination(
  latDeg: number,
  lonDeg: number,
  azimuthDeg: number,
  distanceM: number,
): { lat: number; lon: number } {
  const lat1 = latDeg * DEG;
  const lon1 = lonDeg * DEG;
  const az = azimuthDeg * DEG;
  const delta = distanceM / EARTH_RADIUS_M;

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinDelta = Math.sin(delta);
  const cosDelta = Math.cos(delta);

  const sinLat2 = sinLat1 * cosDelta + cosLat1 * sinDelta * Math.cos(az);
  const lat2 = Math.asin(sinLat2);
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(az) * sinDelta * cosLat1,
      cosDelta - sinLat1 * sinLat2,
    );

  return { lat: lat2 * RAD, lon: ((lon2 * RAD + 540) % 360) - 180 };
}

/**
 * Anells per defecte retallats a un radi màxim.
 *
 * És l'única palanca que exposem sobre la configuració d'anells: qui vulgui
 * estalviar dades mòbils pot demanar 60 km i perdre només els relleus més
 * llunyans (que, a canvi, són els que menys alts es veuen).
 */
export function clipRings(
  maxRangeKm: number,
  rings: HorizonRing[] = DEFAULT_RINGS,
): HorizonRing[] {
  const sorted = rings.slice().sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
  return sorted
    .filter((_, index) => {
      const previous = index === 0 ? 0 : sorted[index - 1].maxDistanceKm;
      return previous < maxRangeKm;
    })
    .map((ring) => ({ ...ring, maxDistanceKm: Math.min(ring.maxDistanceKm, maxRangeKm) }));
}

/**
 * Signatura de la configuració. Va dins del perfil i dins de la clau de la
 * memòria cau: si canviem els anells, el pas o la refracció, els perfils vells
 * deixen de ser vàlids i s'han de recalcular.
 */
export function ringSignature(
  rings: HorizonRing[],
  azimuthStepDeg: number,
  refractionK: number,
  heightAboveGroundM = 0,
): string {
  const zooms = rings
    .slice()
    .sort((a, b) => a.maxDistanceKm - b.maxDistanceKm)
    .map((r) => `z${r.zoom}:${r.maxDistanceKm}`)
    .join('|');
  // L'altura sobre el terreny hi entra perquè és l'únic que desplaça h0 ara
  // que la cota base surt del model: dos perfils del mateix punt amb l'ull a
  // altures diferents són perfils diferents.
  return `${zooms}@${azimuthStepDeg}k${refractionK}e${heightAboveGroundM}`;
}

interface RingPlan {
  zoom: number;
  innerM: number;
  outerM: number;
  stepM: number;
}

function planRings(rings: HorizonRing[], latDeg: number): RingPlan[] {
  const plan: RingPlan[] = [];
  let inner = 0;
  for (const ring of rings.slice().sort((a, b) => a.maxDistanceKm - b.maxDistanceKm)) {
    const outer = ring.maxDistanceKm * 1000;
    if (outer <= inner) continue;
    plan.push({
      zoom: ring.zoom,
      innerM: inner,
      outerM: outer,
      // El pas radial segueix la resolució de la tessel·la: mostrejar més fi no
      // afegeix informació (el model no en té) i mostrejar més gruixut es
      // menjaria carenes senceres.
      stepM: groundResolutionM(ring.zoom, latDeg),
    });
    inner = outer;
  }
  return plan;
}

/** Distància aproximada en metres, equirectangular. Sobra per triar tessel·les. */
function approxDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const meanLat = ((lat1 + lat2) / 2) * DEG;
  const dx = (lon2 - lon1) * DEG * Math.cos(meanLat) * EARTH_RADIUS_M;
  const dy = (lat2 - lat1) * DEG * EARTH_RADIUS_M;
  return Math.hypot(dx, dy);
}

/**
 * Sector d'azimut que de debò es mirarà. Vegeu `ringTiles`.
 */
export interface AzimuthWedge {
  centreAzimuthDeg: number;
  halfWidthDeg: number;
}

/** Diferència d'azimuts a l'interval (−180, 180]. */
function bearingDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

/** Azimut geogràfic aproximat des de l'observador fins a un punt. */
function approxBearingDeg(
  latDeg: number,
  lonDeg: number,
  toLat: number,
  toLon: number,
): number {
  const meanLat = ((latDeg + toLat) / 2) * DEG;
  const east = (toLon - lonDeg) * Math.cos(meanLat);
  const north = toLat - latDeg;
  return ((Math.atan2(east, north) * RAD) % 360 + 360) % 360;
}

/**
 * Cert si el sector d'azimut pot tocar la tessel·la.
 *
 * Es prova amb les quatre cantonades. Vist des de fora, una tessel·la abasta un
 * arc de menys de 180°, o sigui que l'interval d'azimuts que ocupa és el més
 * curt que conté les quatre; si l'observador hi cau a dins, l'abasta tot i no
 * es pot descartar mai. El marge d'un grau tapa que l'azimut es calcula amb
 * l'aproximació equirectangular, que a aquestes distàncies desvia molt menys.
 */
function wedgeTouchesTile(
  latDeg: number,
  lonDeg: number,
  bounds: { north: number; south: number; east: number; west: number },
  wedge: AzimuthWedge,
): boolean {
  const inside =
    latDeg >= bounds.south &&
    latDeg <= bounds.north &&
    lonDeg >= bounds.west &&
    lonDeg <= bounds.east;
  if (inside) return true;

  const corners: Array<[number, number]> = [
    [bounds.north, bounds.west],
    [bounds.north, bounds.east],
    [bounds.south, bounds.west],
    [bounds.south, bounds.east],
  ];
  const deltas = corners.map(([lat, lon]) =>
    bearingDelta(approxBearingDeg(latDeg, lonDeg, lat, lon), wedge.centreAzimuthDeg),
  );

  const reach = wedge.halfWidthDeg + 1;
  // Alguna cantonada dins del sector.
  if (deltas.some((d) => Math.abs(d) <= reach)) return true;
  // O bé el sector queda enmig de dues cantonades: n'hi ha a banda i banda i
  // l'arc que les separa és el curt.
  const min = Math.min(...deltas);
  const max = Math.max(...deltas);
  return min < 0 && max > 0 && max - min < 180;
}

/**
 * Tessel·les que cobreixen l'anell [innerM, outerM] al voltant del punt.
 *
 * Enumerem el rectangle que conté el disc exterior i descartem les tessel·les
 * que queden completament fora del disc o completament dins del forat interior
 * (que ja cobreix un anell de més resolució). Fer-ho amb la geometria de
 * l'anell, i no seguint els raigs, garanteix que no en falti cap.
 *
 * EL SECTOR D'AZIMUT. Qui només mirarà una finestra del cel —el garbell del
 * cercador de llocs en mira ±4° al voltant de l'azimut del Sol— pot passar-la
 * aquí i s'estalvia baixar la resta del disc. No és una optimització marginal:
 * el garbell baixava els 360° sencers d'una corona de 40 km per llegir-ne una
 * franja de vuit graus, i pagava en megabytes de la connexió de l'usuari, que
 * el dia de l'eclipsi i des d'un turó és el recurs escàs.
 *
 * Sense sector, comportament de sempre: el disc sencer.
 */
export function ringTiles(
  latDeg: number,
  lonDeg: number,
  ring: RingPlan | { zoom: number; innerM: number; outerM: number },
  wedge?: AzimuthWedge,
): TileId[] {
  const { zoom, innerM, outerM } = ring;

  // Marge d'una tessel·la a cada costat: el cost d'una tessel·la de més és
  // insignificant comparat amb un forat al perfil.
  const latSpan = ((outerM / EARTH_RADIUS_M) * RAD) * 1.05;
  const cosLat = Math.max(0.05, Math.cos(latDeg * DEG));
  const lonSpan = latSpan / cosLat;

  const north = Math.min(85, latDeg + latSpan);
  const south = Math.max(-85, latDeg - latSpan);
  const west = lonDeg - lonSpan;
  const east = lonDeg + lonSpan;

  const topLeft = lonLatToTilePixel(west, north, zoom);
  const bottomRight = lonLatToTilePixel(east, south, zoom);

  const n = 2 ** zoom;
  const tiles: TileId[] = [];

  for (let x = topLeft.x - 1; x <= bottomRight.x + 1; x++) {
    for (let y = topLeft.y - 1; y <= bottomRight.y + 1; y++) {
      if (y < 0 || y >= n) continue;
      const wrappedX = ((x % n) + n) % n;
      const bounds = tileBoundsLonLat(zoom, wrappedX, y);

      // Punt de la tessel·la més proper a l'observador i cantonada més llunyana.
      const nearLat = Math.min(bounds.north, Math.max(bounds.south, latDeg));
      const nearLon = Math.min(bounds.east, Math.max(bounds.west, lonDeg));
      const nearM = approxDistanceM(latDeg, lonDeg, nearLat, nearLon);
      if (nearM > outerM) continue;

      const farM = Math.max(
        approxDistanceM(latDeg, lonDeg, bounds.north, bounds.west),
        approxDistanceM(latDeg, lonDeg, bounds.north, bounds.east),
        approxDistanceM(latDeg, lonDeg, bounds.south, bounds.west),
        approxDistanceM(latDeg, lonDeg, bounds.south, bounds.east),
      );
      if (farM < innerM) continue;
      if (wedge !== undefined && !wedgeTouchesTile(latDeg, lonDeg, bounds, wedge)) {
        continue;
      }

      tiles.push({ z: zoom, x: wrappedX, y });
    }
  }

  return tiles;
}

/** Cedeix el fil perquè el Worker pugui atendre missatges (cancel·lacions). */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function abortIfNeeded(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error("Càlcul de l'horitzó cancel·lat");
}

/**
 * Calcula el perfil d'horitzó complet d'un punt.
 *
 * Dues fases ben separades: primer es baixen TOTES les tessel·les que faran
 * falta (fase lenta, amb progrés real i mesurable), i després es fa el raycast
 * en memòria, sense tocar la xarxa. Barrejar-ho faria impossible donar un
 * progrés honest i multiplicaria els `await` per milions.
 */
export async function computeHorizonProfile(
  location: GeoLocation,
  options: RaycastOptions = {},
): Promise<HorizonProfile> {
  const {
    azimuthStepDeg = DEFAULT_AZIMUTH_STEP_DEG,
    rings = DEFAULT_RINGS,
    refractionK = TERRESTRIAL_REFRACTION_K,
    eyeHeightM = 0,
    clampToSeaLevel = true,
    onProgress,
    signal,
  } = options;

  abortIfNeeded(signal);

  const plan = planRings(rings, location.lat);
  const maxRangeKm = plan.length > 0 ? plan[plan.length - 1].outerM / 1000 : 0;

  // --- Fase 1: tessel·les ---------------------------------------------------
  const wanted = new Map<string, TileId>();
  for (const ring of plan) {
    for (const tile of ringTiles(location.lat, location.lon, ring)) {
      wanted.set(tileKey(tile), tile);
    }
  }
  const tiles = [...wanted.values()];

  onProgress?.({
    phase: 'tiles',
    ratio: 0,
    loadedTiles: 0,
    totalTiles: tiles.length,
    message: `Baixant el relleu (0 de ${tiles.length} tessel·les)`,
  });

  // El pes de 0,9 no és arbitrari: la baixada domina el temps total (desenes de
  // segons amb dades mòbils) mentre que el raycast són uns pocs segons.
  const TILE_PHASE_WEIGHT = 0.9;

  const result = await prefetchTiles(tiles, {
    signal,
    onTileDone: (done, total) => {
      onProgress?.({
        phase: 'tiles',
        ratio: total === 0 ? TILE_PHASE_WEIGHT : (done / total) * TILE_PHASE_WEIGHT,
        loadedTiles: done,
        totalTiles: total,
        message: `Baixant el relleu (${done} de ${total} tessel·les)`,
      });
    },
  });

  abortIfNeeded(signal);

  if (tiles.length > 0 && result.loaded === 0) {
    throw new Error(
      "No s'ha pogut baixar cap tessel·la del terreny. Comprova la connexió.",
    );
  }

  // --- Fase 1b: origen vertical --------------------------------------------
  //
  // h0 ha de sortir del MATEIX model que el terreny amb què el compararem.
  //
  // Això no és una preferència d'estil: barrejar-los trenca el perfil sencer.
  // Si h0 ve d'un GPS o d'una cota escrita a mà i difereix del model en 10 m,
  // la primera mostra del raig — a poques desenes de metres — ja dona
  // atan(10/50) ≈ 11°, i com que és la mostra amb el braç de palanca més curt
  // guanya el màxim de TOTS els azimuts. El resultat és un horitzó pla d'11°
  // en tot el cercle, i un veredicte de "no ho veuràs" completament fals. Ja
  // ens ha passat.
  //
  // Prenent la cota del model al punt de l'observador, l'error s'anul·la: si
  // el model es pensa que tot plegat està 10 m més amunt, ho està igual per a
  // l'observador i per al terreny, i les diferències — que és l'únic que
  // importa — no canvien.
  const groundZoom = plan.length > 0 ? plan[0].zoom : DEFAULT_ZOOM;
  const demElevation = elevationAtSync(location.lon, location.lat, groundZoom);

  // Si la tessel·la de sota nostre no s'ha pogut baixar no tenim més remei que
  // fiar-nos del que ens han passat, però ho deixem dit al perfil.
  const elevationSource: 'dem' | 'requested' =
    demElevation === undefined ? 'requested' : 'dem';
  const groundElevation = demElevation ?? location.elevation;

  const elevationMismatchM =
    demElevation === undefined ? 0 : location.elevation - demElevation;
  const elevationSuspect =
    Math.abs(elevationMismatchM) > ELEVATION_MISMATCH_THRESHOLD_M;

  // --- Fase 2: raycast ------------------------------------------------------
  const rays = Math.round(360 / azimuthStepDeg);
  const step = 360 / rays;

  const observerH = groundElevation + eyeHeightM;
  const nearFieldM = minSampleDistanceM(groundZoom, location.lat);
  const rEff = effectiveEarthRadiusM(refractionK);
  const dip = horizonDipDeg(observerH, refractionK);
  const dipDistanceKm = horizonDistanceM(observerH, refractionK) / 1000;

  const lat0 = location.lat * DEG;
  const lon0 = location.lon * DEG;
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);

  const altitudes = new Array<number>(rays);
  const distancesKm = new Array<number>(rays);

  let sampled = 0;
  let withData = 0;

  for (let i = 0; i < rays; i++) {
    // Cedim el fil de tant en tant: si no, el Worker no pot atendre una
    // cancel·lació ni el navegador pot fer res durant tot el raycast.
    if ((i & 127) === 0) {
      await yieldToEventLoop();
      abortIfNeeded(signal);
      onProgress?.({
        phase: 'raycast',
        ratio: TILE_PHASE_WEIGHT + (i / rays) * (1 - TILE_PHASE_WEIGHT),
        loadedTiles: result.loaded,
        totalTiles: tiles.length,
        message: `Traçant l'horitzó (${Math.round((i / rays) * 100)} %)`,
      });
    }

    const az = i * step * DEG;
    const sinAz = Math.sin(az);
    const cosAz = Math.cos(az);

    let bestRise = -Infinity;
    let bestDistanceM = 0;

    for (const ring of plan) {
      const start = Math.max(ring.innerM + ring.stepM * 0.5, nearFieldM);
      for (let d = start; d <= ring.outerM; d += ring.stepM) {
        // Cercle màxim, amb les constants del raig hissades fora del bucle.
        const delta = d / EARTH_RADIUS_M;
        const sinDelta = Math.sin(delta);
        const cosDelta = Math.cos(delta);
        const sinLat = sinLat0 * cosDelta + cosLat0 * sinDelta * cosAz;
        const lat = Math.asin(sinLat);
        const lon =
          lon0 + Math.atan2(sinAz * sinDelta * cosLat0, cosDelta - sinLat0 * sinLat);

        sampled++;
        const raw = elevationAtSync(lon * RAD, lat * RAD, ring.zoom);
        if (raw === undefined) continue;
        withData++;

        const h = clampToSeaLevel ? Math.max(raw, 0) : raw;

        // Comparem el PENDENT (rise/d), no l'angle: així ens estalviem un
        // atan2 per mostra i el resultat és idèntic, perquè atan2 és monòtona.
        const rise = (h - observerH - (d * d) / (2 * rEff)) / d;
        if (rise > bestRise) {
          bestRise = rise;
          bestDistanceM = d;
        }
      }
    }

    const bestDeg = bestRise === -Infinity ? -Infinity : Math.atan(bestRise) * RAD;
    if (bestDeg > dip) {
      altitudes[i] = bestDeg;
      distancesKm[i] = bestDistanceM / 1000;
    } else {
      // Guanya l'horitzó marí: el que et tapa és la curvatura de la Terra, i el
      // punt culminant és a la distància de l'horitzó, no on hem mirat.
      altitudes[i] = dip;
      distancesKm[i] = dipDistanceKm;
    }
  }

  onProgress?.({
    phase: 'raycast',
    ratio: 1,
    loadedTiles: result.loaded,
    totalTiles: tiles.length,
    message: 'Horitzó llest',
  });

  return {
    version: HORIZON_PROFILE_VERSION,
    lat: location.lat,
    lon: location.lon,
    observerElevation: observerH,
    demElevation: groundElevation,
    requestedElevation: location.elevation,
    elevationMismatchM,
    elevationSuspect,
    elevationSource,
    heightAboveGroundM: eyeHeightM,
    nearFieldM,
    azimuthStepDeg: step,
    altitudes,
    distancesKm,
    maxRangeKm,
    refractionK,
    ringSignature: ringSignature(rings, azimuthStepDeg, refractionK, eyeHeightM),
    coverage: sampled === 0 ? 0 : withData / sampled,
    computedAtMs: Date.now(),
  };
}
