/**
 * El mapa de calor: quants segons de la fase central sobreviuen al relleu, per
 * cel·les.
 *
 * ── QUÈ APORTA, QUAN JA TENIM `spots/search.ts` ─────────────────────────────
 *
 * El mateix motor, girat. La cerca de llocs respon «on m'he de plantar?» i
 * torna vuit punts; això respon «i tota aquesta comarca, com està?» i torna
 * vuit-centes cel·les pintades. La diferència de forma és tota la diferència
 * de cost: aquí no hi ha finalistes, ni perfil complet, ni etapa D. Són les
 * etapes A, B′ i C de `search.ts` i prou, i quan s'acaben, s'acaba.
 *
 * ── DOS NIVELLS, I EL MAPA NO ESPERA MAI EN BLANC ───────────────────────────
 *
 * NIVELL 1 — TEORIA. `buildCentralSeed` + `fastCentralPhase` per cel·la: la
 * durada de fase central que hi ha, sense mirar cap muntanya. ZERO xarxa i
 * 0,07 ms per cel·la (mesurat a `fastCentral.ts`). És el que es pinta de
 * seguida, i és honest perquè el tipus ho diu: `detail: 'theory'` i
 * `visibleSec: null` — «encara no hem mirat el terreny».
 *
 * NIVELL 2 — RELLEU. El cim de cada cel·la (`findCellPeak`), el garbell
 * d'azimuts al voltant del Sol (`sampleHorizonWindow`, no els 360°) i la
 * integració dels segons que queden per damunt del terreny
 * (`integrateVisibleCentral`, la mateixa funció que fa servir la cerca).
 * Llavors `detail` passa a `'sieve'` i `visibleSec` deixa de ser nul.
 *
 * La frontera entre estimació i mesura viu al TIPUS i no en un comentari,
 * exactament com `SpotResult.detail`. Un mapa de calor que pinta teoria i
 * mesura del mateix color és una mentida ben dibuixada.
 *
 * ── EL PRESSUPOST D'UNA PASSADA, I QUÈ HI HA MESURAT I QUÈ EXTRAPOLAT ───────
 *
 * Passada plena: 800 cel·les (el sostre de `grid.ts`) d'1,82 km, enquadrament
 * de 74 × 50 km al voltant de Sòria. Aquestes columnes SÓN MESURADES, però amb
 * un lector d'elevació sintètic: comptabilitzen l'aritmètica del garbell i no
 * la descodificació de les tessel·les de veritat.
 *
 *                              Sòria 2026      Barcelona 2028
 *     Sol al mig de la central      7,2°             0,6°
 *     abast del garbell            15,7 km          90 km
 *     nivell 1 (teoria)             52 ms           53 ms
 *     cims + falques             44-55 ms           85 ms
 *     nivell 2 (garbell)           322 ms        1.018 ms
 *       mostres del terreny         7,09 M          24,20 M
 *       per cel·la                  8.860           30.250
 *     tessel·les                   38 (27 z11 +    43 (24 z11 +
 *                                   11 z10)         19 z10)
 *     crides a efemèrides       4.016            4.008
 *
 * (La primera passada d'un procés en gasta 94 ms al nivell 1 en comptes de 52:
 * és el JIT escalfant-se, i es diu perquè algú que ho mesuri no es pensi que
 * les xifres de dalt són optimistes.)
 *
 * I ARA L'EXTRAPOLACIÓ, dita com a tal. Amb tessel·les reals, l'etapa C de
 * `spots/search.ts` va mesurar 5,0 M mostres en 2.299 ms (0,46 µs per mostra) i
 * 45 tessel·les en 2.227 ms de baixada i descodificació (~50 ms per tessel·la).
 * Aplicant-ho a les xifres de dalt:
 *
 *                              Sòria 2026      Barcelona 2028
 *     garbell amb terreny real     ~3,3 s          ~10,4 s
 *     xarxa                        ~1,9 s          ~2,2 s
 *       bytes (121 kB/tessel·la)   ~4,5 MB         ~5,1 MB
 *     passada sencera              ~5,2 s          ~12,6 s
 *
 * Tres conseqüències que aquest pressupost imposa al disseny, i que per això
 * són al codi i no a la llista de desitjos:
 *
 *  1. EL NIVELL 1 EXISTEIX. Cinc segons amb el mapa en blanc no són acceptables
 *     i cinquanta mil·lisegons sí. Per això es publica la teoria abans de tocar
 *     cap tessel·la.
 *  2. LA MEMÒRIA CAU EXISTEIX (`cache.ts`). La segona passada del mateix tros
 *     de mapa costa una lectura d'IndexedDB, no cinc segons ni 4,5 MB.
 *  3. EL SOSTRE ÉS 800. A 1.600 cel·les el 2028 se'n va als vint-i-cinc segons,
 *     i ningú no espera vint-i-cinc segons mirant un mapa.
 *
 * El 26-01-2028 segueix sent el pitjor cas dels tres eclipsis pel mateix motiu
 * que a `search.ts`: el Sol es pon DURANT l'anularitat, `sieveRangeKm` obre el
 * garbell fins al sostre de 90 km i cada cel·la llegeix tres vegades i mitja
 * més terreny.
 *
 * ── EL LLAVOR ÉS LOCAL, I ÉS UNA DECISIÓ ────────────────────────────────────
 *
 * `fastCentralPhase` ajusta una paràbola al voltant d'un instant de referència
 * i la seva capçalera diu clarament que l'aproximació es degrada amb la
 * distància a aquell punt: 0,36 s d'error mesurat sobre una graella de 55 km.
 * Una cerca de llocs fa 50 km de diàmetre i n'hi ha prou amb un llavor; un
 * enquadrament de mapa a zoom 9 en fa 200. Per això aquí el llavor NO és únic:
 * n'hi ha un per tessel·la de zoom 8 (~120 km de costat a 41°), calculat al
 * centre de la tessel·la. Costa 8 crides a efemèrides per pedaç —davant de les
 * 5 per cel·la— i manté cada cel·la dins de l'escala on l'ajust val el que
 * promet. Ancorat a la tessel·la i no a l'enquadrament: dues passades del
 * mateix tros de mapa fan servir el MATEIX llavor, i per tant donen el mateix
 * número i la memòria cau segueix valent.
 *
 * ── EL MAR NO S'AMAGA, PERÒ TAMPOC NO ES RECOMANA ───────────────────────────
 *
 * `search.ts` descarta les cel·les d'aigua: recomanar el Mediterrani a algú que
 * hi ha d'anar amb cotxe és absurd. Aquí NO es descarten, i és a posta: aquest
 * mapa no recomana res, respon «quant se'n menja el relleu» — i sobre el mar la
 * resposta és «res», que és certa i útil (la costa del davant sí que és un
 * lloc). El que sí que s'hereta és el salt al cim: una cel·la es pinta pel seu
 * MILLOR punt, no pel seu centre. És optimista dins de la cel·la, i s'ha de
 * llegir així: el color diu «aquí hi ha un lloc des d'on es veuen tants
 * segons», no «tota aquesta cel·la els veu».
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { STANDARD_ATMOSPHERE } from '../astro/constants';
import type { Atmosphere } from '../astro/types';
import {
  elevationAtSync,
  prefetchTiles,
  tileKey,
  type TileId,
} from '../horizon/elevation';
import { horizonDipDeg, ringTiles, type HorizonRing } from '../horizon/raycast';
import { buildCentralSeed, fastCentralPhase, sunTrackAt } from '../spots/fastCentral';
import type { CentralSeed, FastCentral } from '../spots/fastCentral';
import { findCellPeak } from '../spots/grid';
import { integrateVisibleCentral } from '../spots/search';
import type { ElevationReader } from '../spots/types';
import {
  clipSieveRings,
  DEFAULT_SIEVE_RINGS,
  sampleHorizonWindow,
  sieveRangeKm,
} from '../spots/window';
import { tilesForBbox, type HeatBbox, type HeatCell } from './grid';

/**
 * Versió del motor de càlcul.
 *
 * Qualsevol canvi que mogui els números —el garbell, el llavor, la integració—
 * l'ha de pujar. `cache.ts` la posa a la clau: números vells d'un motor vell no
 * s'han de servir mai com si fossin d'aquest.
 */
export const HEAT_ENGINE_VERSION = 1;

/**
 * Cel·les per bloc publicat.
 *
 * Noranta-sis és una vuitena part d'una passada plena: amb el cost extrapolat
 * del garbell (~4 ms per cel·la amb tessel·les reals), el mapa guanya una
 * franja nova cada 0,4 s. Blocs més petits inunden el `postMessage` del Worker
 * i fan treballar React per res; més grossos i el mapa es pinta a batzegades.
 */
const DEFAULT_BLOCK_SIZE = 96;

/** Mitja amplada de la finestra d'azimuts del garbell, en graus. */
const DEFAULT_SIEVE_HALF_WIDTH_DEG = 4;
/** Pas azimutal del garbell, en graus. */
const DEFAULT_SIEVE_STEP_DEG = 0.25;

/**
 * Zoom de la tessel·la que defineix un pedaç de llavor. A 41° fa ~118 km de
 * costat, que és l'escala on l'ajust parabòlic de `fastCentral.ts` segueix
 * donant dècimes de segon d'error.
 */
const SEED_TILE_ZOOM = 8;

/**
 * Fins on ha arribat el càlcul d'una cel·la.
 *
 * `theory` = només efemèrides, cap muntanya mirada. `sieve` = el terreny ha
 * dit la seva, amb el mateix garbell gruixut i optimista que la cerca de llocs
 * (vegeu `window.ts`: mai pessimista, perquè un fals negatiu no el recupera
 * ningú).
 */
export type HeatDetail = 'theory' | 'sieve';

export interface HeatCellValue {
  /** Clau estable de la cel·la, `z/x/y`. */
  id: string;
  /**
   * Punt del qual surten els números. Al nivell 1 és el centre de la cel·la;
   * al nivell 2 és el seu cim, si el model n'ha trobat un.
   */
  lat: number;
  lon: number;
  /** Anell tancat de la cel·la, per pintar-la. */
  poly: [number, number][];
  /** Durada teòrica de la fase central al punt, en segons. */
  theoreticalSec: number;
  /**
   * Segons que sobreviuen al relleu. `null` mentre no s'hagi mirat el terreny
   * — i zero, sense mirar-lo, quan no hi ha fase central per perdre.
   */
  visibleSec: number | null;
  detail: HeatDetail;
  /** Fracció de mostres del terreny amb dades, de 0 a 1. Zero al nivell 1. */
  coverage: number;
}

export type HeatStage = 'theory' | 'tiles' | 'terrain' | 'done';

export interface HeatProgress {
  stage: HeatStage;
  /** Progrés global de 0 a 1. */
  ratio: number;
  /** Text llest per ensenyar, en català. */
  message: string;
  /** Cel·les ja resoltes. */
  done: number;
  total: number;
}

export interface HeatCost {
  cells: number;
  /** Cel·les servides per la memòria cau sense recalcular res. */
  fromCache: number;
  theoryMs: number;
  tilesMs: number;
  terrainMs: number;
  /** Tessel·les demanades (les repetides no compten). */
  tiles: number;
  terrainSamples: number;
  ephemerisCalls: number;
  totalMs: number;
  /**
   * Nivell realment assolit: 2 si alguna cel·la porta relleu, encara que
   * hagi arribat de la memòria cau i no s'hagi calculat res.
   */
  level: 1 | 2;
}

export interface HeatOutcome {
  eclipseId: string;
  cells: HeatCellValue[];
  cost: HeatCost;
}

/**
 * Memòria cau injectable.
 *
 * `compute.ts` NO importa `cache.ts`: així aquest mòdul segueix sent pur i
 * provable a Node sense IndexedDB, i qui munta el Worker decideix si hi ha
 * memòria cau o no. La mateixa raó per la qual `search.ts` rep el lector
 * d'elevació per paràmetre.
 */
export interface HeatCacheAdapter {
  read(
    eclipseId: string,
    ids: readonly string[],
  ): Promise<Map<string, HeatCellValue>>;
  write(eclipseId: string, cells: readonly HeatCellValue[]): Promise<void>;
}

export interface HeatComputeOptions {
  eclipseId: string;
  /** Cel·les a calcular, tal com les dona `cellsForViewport`. */
  cells: readonly HeatCell[];
  /** 1 = només teoria (zero xarxa). 2 = teoria i després relleu. */
  level?: 1 | 2;
  atmosphere?: Atmosphere;
  /** Altura de l'ull per damunt del terreny del model, en metres. */
  eyeHeightM?: number;
  sieveRings?: HorizonRing[];
  sieveHalfWidthDeg?: number;
  sieveStepDeg?: number;
  /** Cel·les per bloc publicat. */
  blockSize?: number;
  /** Publicació progressiva. Es crida un cop per bloc, amb el bloc sencer. */
  onBlock?: (cells: HeatCellValue[]) => void;
  onProgress?: (progress: HeatProgress) => void;
  signal?: AbortSignal;

  /* --- injecció, per poder provar sense xarxa --- */
  elevation?: ElevationReader;
  prefetch?: (
    tiles: TileId[],
    options: { signal?: AbortSignal; onTileDone?: (done: number, total: number) => void },
  ) => Promise<{ requested: number; loaded: number; failed: number }>;
  cache?: HeatCacheAdapter;
}

/* ------------------------------------------------------------------ utillatge */

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function abortIfNeeded(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error('Mapa de calor cancel·lat');
}

/**
 * Repartiment del progrés entre etapes. Fraccions del temps de rellotge
 * mesurat: baixar tessel·les i garbellar dominen, la teoria és soroll.
 */
const STAGE_WEIGHT = { theory: 0.05, tiles: 0.35, terrain: 0.6 } as const;

/* ---------------------------------------------------------------- el càlcul */

interface LiveCell {
  cell: HeatCell;
  value: HeatCellValue;
  seed: CentralSeed;
  /**
   * El model ràpid SENCER i no els seus camps escollits: `integrateVisibleCentral`
   * i `sunTrackAt` en necessiten l'altura geomètrica i l'aparent alhora, i
   * copiar-ne només un parell de números va costar un `undefined` silenciós.
   */
  central: FastCentral;
  rangeKm: number;
  rings: HorizonRing[];
  /** Cota del model al punt, en metres. */
  elevationM: number;
}

export async function computeHeat(options: HeatComputeOptions): Promise<HeatOutcome> {
  const {
    eclipseId,
    cells,
    level = 2,
    atmosphere = STANDARD_ATMOSPHERE,
    eyeHeightM = 0,
    sieveRings = DEFAULT_SIEVE_RINGS,
    sieveHalfWidthDeg = DEFAULT_SIEVE_HALF_WIDTH_DEG,
    sieveStepDeg = DEFAULT_SIEVE_STEP_DEG,
    blockSize = DEFAULT_BLOCK_SIZE,
    onBlock,
    onProgress,
    signal,
    elevation = elevationAtSync,
    prefetch = prefetchTiles,
    cache,
  } = options;

  const startedAt = Date.now();
  const cost: HeatCost = {
    cells: cells.length,
    fromCache: 0,
    theoryMs: 0,
    tilesMs: 0,
    terrainMs: 0,
    tiles: 0,
    terrainSamples: 0,
    ephemerisCalls: 0,
    totalMs: 0,
    level: 1,
  };

  /**
   * Per identificador i no en una llista: una cel·la es publica DUES vegades
   * —primer la teoria, després la mesura— i el resultat final n'ha de portar
   * una sola entrada, la bona. Qui escolta els blocs fa exactament el mateix:
   * substitueix per `id`.
   */
  const published = new Map<string, HeatCellValue>();

  const report = (stage: HeatStage, ratio: number, message: string): void => {
    onProgress?.({
      stage,
      ratio: Math.min(1, Math.max(0, ratio)),
      message,
      done: published.size,
      total: cells.length,
    });
  };

  const publish = (block: HeatCellValue[]): void => {
    if (block.length === 0) return;
    for (const value of block) published.set(value.id, value);
    onBlock?.(block);
  };

  /**
   * Desa un bloc sense fer esperar el mapa. Que la memòria cau falli —quota
   * plena, base tancada— no és cap error de càlcul i no pot tombar la passada.
   */
  const remember = (block: HeatCellValue[]): void => {
    if (!cache || block.length === 0) return;
    void cache.write(eclipseId, block).catch(() => {});
  };

  abortIfNeeded(signal);

  if (cells.length === 0) {
    cost.totalMs = Date.now() - startedAt;
    report('done', 1, 'Cap cel·la dins de la franja');
    return { eclipseId, cells: [...published.values()], cost };
  }

  /* ---- la memòria cau, primer de tot ----------------------------------- */

  // Aquest és el moment que justifica que la memòria cau existeixi: al camp,
  // sense cobertura, la zona que vas mirar a casa es repinta SENCERA i amb
  // números de relleu abans de calcular res.
  let pending: readonly HeatCell[] = cells;
  if (cache) {
    const known = await cache.read(
      eclipseId,
      cells.map((cell) => cell.id),
    );
    abortIfNeeded(signal);
    if (known.size > 0) {
      const hits: HeatCellValue[] = [];
      const misses: HeatCell[] = [];
      for (const cell of cells) {
        const hit = known.get(cell.id);
        // El polígon el torna a posar la graella d'ara: la memòria cau guarda
        // números, no geometria, i així un canvi de com es dibuixa la cel·la no
        // obliga a recalcular res.
        if (hit) hits.push({ ...hit, id: cell.id, poly: cell.poly });
        else misses.push(cell);
      }
      cost.fromCache = hits.length;
      publish(hits);
      pending = misses;
      if (hits.length > 0) cost.level = 2;
    }
  }

  /* ---- nivell 1: teoria, zero xarxa ------------------------------------ */

  let t0 = Date.now();
  report('theory', 0, `Calculant l’eclipsi a ${pending.length} cel·les`);

  /**
   * Llavors per pedaç de ~120 km. Vegeu la capçalera: un de sol per a un
   * enquadrament de 200 km trairia la promesa de `fastCentral.ts`.
   */
  const seeds = new Map<string, CentralSeed>();
  const seedFor = (lat: number, lon: number): CentralSeed => {
    const n = 2 ** SEED_TILE_ZOOM;
    const x = Math.floor(((lon + 180) / 360) * n);
    const rad = (Math.min(85, Math.max(-85, lat)) * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
    );
    const key = `${x}/${y}`;
    const existing = seeds.get(key);
    if (existing) return existing;

    // El llavor es fa al CENTRE de la tessel·la i no a la primera cel·la que hi
    // cau: així no depèn de per on s'ha començat a recórrer l'enquadrament.
    const centreLon = ((x + 0.5) / n) * 360 - 180;
    const t = Math.PI * (1 - (2 * (y + 0.5)) / n);
    const centreLat = (Math.atan(Math.sinh(t)) * 180) / Math.PI;

    const seed = buildCentralSeed(
      eclipseId,
      { lat: centreLat, lon: centreLon, elevation: 0 },
      atmosphere,
    );
    cost.ephemerisCalls += seed.ephemerisCalls;
    seeds.set(key, seed);
    return seed;
  };

  const live: LiveCell[] = [];
  let block: HeatCellValue[] = [];

  for (let i = 0; i < pending.length; i++) {
    if (i > 0 && i % blockSize === 0) {
      publish(block);
      block = [];
      await yieldToEventLoop();
      abortIfNeeded(signal);
      report(
        'theory',
        STAGE_WEIGHT.theory * (i / pending.length),
        `Calculant l’eclipsi a ${pending.length} cel·les`,
      );
    }

    const cell = pending[i];
    const seed = seedFor(cell.lat, cell.lon);
    // Cota zero al nivell 1: encara no hi ha cap tessel·la baixada, i la
    // paral·laxi topocèntrica de mil metres de cota mou la durada mil·lisegons.
    const fast = fastCentralPhase(
      { lat: cell.lat, lon: cell.lon, elevation: 0 },
      seed,
    );
    cost.ephemerisCalls += fast.ephemerisCalls;

    const value: HeatCellValue = {
      id: cell.id,
      lat: cell.lat,
      lon: cell.lon,
      poly: cell.poly,
      theoreticalSec: fast.centralSec,
      // Sense fase central no hi ha res que el relleu pugui menjar-se: el zero
      // és conegut sense mirar cap muntanya, i dir-ho `null` seria fer-se el
      // desmemoriat.
      visibleSec: fast.centralSec > 0 ? null : 0,
      detail: 'theory',
      coverage: 0,
    };
    block.push(value);

    if (fast.centralSec <= 0) continue;

    // El Sol sota l'horitzó no el rescata cap turó. Es mira el MÀXIM sobre els
    // tres instants que delimiten la fase central i no només el del mig: al
    // 2026 i al 2028 el Sol es pon DURANT la fase central, i mirar només el mig
    // buidava mitja Espanya (la regressió està explicada a `search.ts`).
    const half = fast.centralSec / 2;
    const highest = Math.max(
      sunTrackAt(seed, fast, -half).altitudeApparentDeg,
      fast.sunAltitudeApparentDeg,
      sunTrackAt(seed, fast, half).altitudeApparentDeg,
    );
    if (highest <= horizonDipDeg(0)) {
      value.visibleSec = 0;
      continue;
    }

    const rangeKm = sieveRangeKm(fast.sunAltitudeApparentDeg);
    live.push({
      cell,
      value,
      seed,
      central: fast,
      rangeKm,
      rings: clipSieveRings(rangeKm, sieveRings),
      elevationM: 0,
    });
  }

  publish(block);
  block = [];
  cost.theoryMs = Date.now() - t0;

  if (level < 2 || live.length === 0) {
    cost.totalMs = Date.now() - startedAt;
    report('done', 1, 'Mapa de calor llest');
    return { eclipseId, cells: [...published.values()], cost };
  }

  /* ---- nivell 2, etapa B′: tessel·les de terra i cim de cada cel·la ----- */

  t0 = Date.now();
  const groundZoom = sieveRings[0]?.zoom ?? 11;
  const downloaded = new Set<string>();

  // El disc de `search.ts` aquí és un rectangle: l'enquadrament de les cel·les
  // vives, eixamplat mitja cel·la perquè el submostreig del cim no surti fora
  // del que s'ha baixat.
  const bounds: HeatBbox = {
    west: Infinity,
    south: Infinity,
    east: -Infinity,
    north: -Infinity,
  };
  for (const item of live) {
    for (const [lon, lat] of item.cell.poly) {
      if (lon < bounds.west) bounds.west = lon;
      if (lon > bounds.east) bounds.east = lon;
      if (lat < bounds.south) bounds.south = lat;
      if (lat > bounds.north) bounds.north = lat;
    }
  }

  const groundTiles = tilesForBbox(bounds, groundZoom);
  report(
    'tiles',
    STAGE_WEIGHT.theory,
    `Baixant el terreny (0 de ${groundTiles.length} tessel·les)`,
  );

  const groundFetch = await prefetch(groundTiles, {
    signal,
    onTileDone: (done, total) => {
      report(
        'tiles',
        STAGE_WEIGHT.theory + STAGE_WEIGHT.tiles * 0.3 * (total === 0 ? 1 : done / total),
        `Baixant el terreny (${done} de ${total} tessel·les)`,
      );
    },
  });
  abortIfNeeded(signal);
  for (const tile of groundTiles) downloaded.add(tileKey(tile));
  cost.tiles += groundTiles.length;

  if (groundTiles.length > 0 && groundFetch.loaded === 0) {
    throw new Error(
      'No s’ha pogut baixar cap tessel·la del terreny. Comprova la connexió.',
    );
  }

  // El cim de cada cel·la. A diferència de `search.ts` NO es descarta l'aigua
  // (vegeu la capçalera): sobre el mar el relleu no es menja res i això també
  // és una resposta. El que sí que es fa és mudar el punt al màxim local, i
  // recalcular-hi l'astronomia si s'ha mogut de debò.
  for (let i = 0; i < live.length; i++) {
    if (i % blockSize === 0) {
      await yieldToEventLoop();
      abortIfNeeded(signal);
      report(
        'tiles',
        STAGE_WEIGHT.theory + STAGE_WEIGHT.tiles * (0.3 + 0.3 * (i / live.length)),
        'Buscant el punt alt de cada cel·la',
      );
    }

    const item = live[i];
    const peak = findCellPeak(item.cell.lat, item.cell.lon, {
      spacingKm: item.cell.sizeKm,
      elevation,
      zoom: groundZoom,
    });
    cost.terrainSamples += peak.samples;
    if (peak.kind !== 'land') continue;

    item.elevationM = peak.elevation;
    if (peak.lat === item.cell.lat && peak.lon === item.cell.lon) continue;

    item.value.lat = peak.lat;
    item.value.lon = peak.lon;

    // El punt ja no és on l'astronomia el va calcular. A la vora de la franja,
    // mig quilòmetre mou la durada uns quants segons i el garbell integraria
    // una trajectòria equivocada. Són 5 crides a efemèrides: 0,07 ms.
    const fast = fastCentralPhase(
      { lat: peak.lat, lon: peak.lon, elevation: peak.elevation },
      item.seed,
    );
    cost.ephemerisCalls += fast.ephemerisCalls;
    item.central = fast;
    item.value.theoreticalSec = fast.centralSec;
    item.rangeKm = sieveRangeKm(fast.sunAltitudeApparentDeg);
    item.rings = clipSieveRings(item.rangeKm, sieveRings);
  }

  /* ---- nivell 2, etapa B: les falques de cel compartides ---------------- */

  // Només el tros de cel que es mirarà: una falca de ±4° al voltant de l'azimut
  // del Sol per cel·la. La unió és molt més petita que la suma perquè les
  // cel·les són veïnes i miren gairebé el mateix terreny — és el mateix guany
  // que `search.ts` publica com a «tres ordres de magnitud».
  const wedgeTiles = new Map<string, TileId>();
  for (const item of live) {
    const wedge = {
      centreAzimuthDeg: item.central.sunAzimuthDeg,
      halfWidthDeg: sieveHalfWidthDeg,
    };
    let inner = 0;
    for (const ring of item.rings) {
      const outerM = ring.maxDistanceKm * 1000;
      for (const tile of ringTiles(
        item.value.lat,
        item.value.lon,
        { zoom: ring.zoom, innerM: inner, outerM },
        wedge,
      )) {
        const key = tileKey(tile);
        if (!downloaded.has(key)) wedgeTiles.set(key, tile);
      }
      inner = outerM;
    }
  }

  const wedgeList = [...wedgeTiles.values()];
  report(
    'tiles',
    STAGE_WEIGHT.theory + STAGE_WEIGHT.tiles * 0.6,
    `Baixant el relleu (0 de ${wedgeList.length} tessel·les)`,
  );

  await prefetch(wedgeList, {
    signal,
    onTileDone: (done, total) => {
      report(
        'tiles',
        STAGE_WEIGHT.theory +
          STAGE_WEIGHT.tiles * (0.6 + 0.4 * (total === 0 ? 1 : done / total)),
        `Baixant el relleu (${done} de ${total} tessel·les)`,
      );
    },
  });
  abortIfNeeded(signal);
  for (const tile of wedgeList) downloaded.add(tileKey(tile));
  cost.tiles += wedgeList.length;
  cost.tilesMs = Date.now() - t0;

  /* ---- nivell 2, etapa C: el garbell d'horitzó -------------------------- */

  t0 = Date.now();
  const base = STAGE_WEIGHT.theory + STAGE_WEIGHT.tiles;

  for (let i = 0; i < live.length; i++) {
    if (i > 0 && i % blockSize === 0) {
      publish(block);
      remember(block);
      block = [];
      await yieldToEventLoop();
      abortIfNeeded(signal);
      report(
        'terrain',
        base + STAGE_WEIGHT.terrain * (i / live.length),
        `Mirant l’horitzó de ${live.length} cel·les`,
      );
    }

    const item = live[i];

    // La cota surt del MODEL i mai del que ens hagin passat: si l'observador i
    // el terreny no venen del mateix model, la primera mostra del raig ja
    // s'emporta el màxim de tots els azimuts i l'horitzó surt pla i altíssim.
    const dem = elevation(item.value.lon, item.value.lat, groundZoom);
    if (dem !== undefined) item.elevationM = dem;

    const horizon = sampleHorizonWindow(
      { lat: item.value.lat, lon: item.value.lon, elevation: item.elevationM },
      item.elevationM + eyeHeightM,
      {
        centreAzimuthDeg: item.central.sunAzimuthDeg,
        halfWidthDeg: sieveHalfWidthDeg,
        stepDeg: sieveStepDeg,
        rings: item.rings,
        elevation,
      },
    );
    cost.terrainSamples += horizon.samples;

    const integrated = integrateVisibleCentral(item.seed, item.central, horizon);

    item.value.visibleSec = Math.min(integrated.visibleSec, item.central.centralSec);
    item.value.detail = 'sieve';
    item.value.coverage = horizon.coverage;
    block.push(item.value);
  }

  publish(block);
  remember(block);

  cost.terrainMs = Date.now() - t0;
  cost.level = 2;
  cost.totalMs = Date.now() - startedAt;
  report('done', 1, 'Mapa de calor llest');

  return { eclipseId, cells: [...published.values()], cost };
}
