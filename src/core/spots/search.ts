/**
 * L'embut.
 *
 * ── EL COST ÉS EL PROBLEMA ──────────────────────────────────────────────────
 *
 * Escombrar 25 km al voltant amb candidats cada 2 km són 567 punts. Fer-hi el
 * càlcul de veritat a tots — circumstàncies locals exactes, perfil d'horitzó
 * complet i veredicte — costaria (números de `naiveProfileCost`, a Sòria):
 *
 *     circumstàncies exactes   567 × 5,2 ms        =  2,9 s
 *     perfil complet           567 × 2,65 M mostres = 1.504 M mostres
 *     tessel·les               567 × 155            = 87.885 tessel·les
 *
 * Les tessel·les són el mur: a 121 kB de mitjana (mesurat) són 10 GB de xarxa.
 * No és lent, és impossible. L'embut existeix per això i no per elegància.
 *
 * ── LES QUATRE ETAPES, I QUÈ COSTA CADA UNA ─────────────────────────────────
 *
 *  A. ASTRONOMIA BARATA — 4 crides a efemèrides per candidat en comptes de 520
 *     (vegeu `fastCentral.ts`). 0,07 ms per candidat: els 567 candidats en
 *     40 ms. Descarta tot el que ni tan sols té fase central teòrica prou
 *     llarga; a la vora de la franja això sol ser la meitat de la graella.
 *
 *  B. TESSEL·LES COMPARTIDES — i aquí hi ha el guany més gros de tots. Els
 *     candidats són veïns i els seus horitzons miren gairebé el mateix
 *     terreny: la unió de les tessel·les que necessiten tots plegats és un
 *     disc de radi (radi de cerca + abast del garbell), no 567 discos. Passem
 *     de 87.885 tessel·les a 64. Tres ordres de magnitud, i surt de demanar-les
 *     totes de cop en comptes de per candidat.
 *
 *  B′. TERRA O MAR, I EL CIM DE CADA CEL·LA — amb el disc de terra a memòria,
 *     cada cel·la es descarta si és aigua (cota ≤ 0 a totes les mostres) o es
 *     muda al seu màxim local de terra. Té secció pròpia més avall: és el que
 *     evita recomanar el mar i el que fa que els candidats siguin cims.
 *
 *  C. GARBELL D'HORITZÓ — només els azimuts on hi haurà el Sol, amb el terreny
 *     gruixut i l'abast que dicta l'altura solar (vegeu `window.ts`). Unes
 *     12.000 mostres per candidat en comptes de 2,6 milions: 220 vegades menys.
 *
 *  D. FINALISTES — els millors, i només els millors, passen pel motor de
 *     veritat: `computeLocalCircumstances` + `computeHorizonProfile` +
 *     `computeVisibility`. És el mateix camí que el veredicte de «ho veuré des
 *     d'aquí?», sense cap drecera. També aquí les tessel·les es demanen totes
 *     de cop per als cinc finalistes junts.
 *
 * `SpotSearchCost` publica els números reals de cada execució al costat del que
 * hauria costat el camí ingenu. No és decoració: és l'única manera de saber si
 * l'embut segueix valent la pena quan algú en canviï els paràmetres.
 *
 * ── MESURAT, AMB XARXA DE VERITAT ───────────────────────────────────────────
 *
 * `npx tsx scripts/spots-cost.ts <lloc> <radi> <pas>` baixa les tessel·les
 * reals d'AWS i compta els bytes que passen. Radi 25 km, pas 2 km, 5 finalistes:
 *
 *                              Sòria 2026     Barcelona 2028
 *     Sol al mig de la central      7,2°            0,6°
 *     abast del garbell            15,7 km         90 km
 *     candidats                   567             567 (543 vius)
 *     A astronomia                 96 ms          101 ms
 *     B tessel·les              2.227 ms (45)   3.201 ms (98)
 *     C garbell                 2.299 ms        7.044 ms
 *       mostres del terreny         5,0 M          16,4 M
 *     D1 tessel·les fines         520 ms (19)   1.853 ms (42)
 *     D2 càlcul complet           911 ms        2.300 ms
 *     ─────────────────────────────────────────────────────
 *     total                      6,1 s          14,5 s
 *     xarxa                    64 tess · 7,5 MB  140 tess · 12,5 MB
 *     estalvi de xarxa            ×1.373           ×612
 *     estalvi de terreny            ×227            ×71
 *
 * Barcelona el 26-01-2028 és el pitjor cas de tots tres eclipsis: el Sol es pon
 * DURANT l'anularitat, `sieveRangeKm` obre el garbell fins al sostre de 90 km i
 * tot es multiplica. Tot i així són 12,5 MB i quinze segons, contra els 7,7 GB
 * del camí ingenu. Si algú toca els paràmetres, aquesta taula es torna a fer en
 * una ordre.
 *
 * ── B′. TERRA O MAR, I EL CIM DE CADA CEL·LA ────────────────────────────────
 *
 * A Barcelona 2028, tres dels cinc finalistes queien al Mediterrani: la
 * graella és geomètrica i el model dona zero (o batimetria negativa) sobre
 * l'aigua, que passa per una plana perfecta amb l'horitzó lliure — o sigui,
 * per un lloc excel·lent on cap observador no es pot plantar.
 *
 * Ara, entre baixar les tessel·les i pagar el garbell, cada cel·la passa per
 * `findCellPeak`: es descarta si cap mostra no puja de 0 m (terrarium codifica
 * el mar com a 0 o negatiu) i, si és terra, el candidat es muda al màxim local
 * de la cel·la. El llindar és ESTRICTAMENT ≤ 0 — una platja a +1 m sobreviu —
 * i les dues decisions surten de les mateixes 21 mostres. El salt al cim també
 * rescata les cel·les mixtes de la costa: centre a l'aigua, platja a dins.
 *
 * QUÈ COSTA I QUÈ ESTALVIA. El filtre llegeix ≤ 21 mostres per candidat
 * (~11.000 en una cerca de 567) sobre un grapat de tessel·les z11 que cobreixen
 * el disc de cerca i que el garbell hauria baixat igualment: en total val menys
 * que el garbell d'UN sol candidat (~12.000 mostres). En una cerca costanera
 * típica —l'origen a la línia de costa, mig disc a l'aigua— descarta la meitat
 * de les cel·les vives: a 25 km/2 km són ~280 candidats que ja no paguen ni
 * garbell (~3,4 M mostres estalviades) ni les seves tessel·les de falca, perquè
 * la unió de falques de l'etapa B es calcula DESPRÉS del filtre, només amb els
 * supervivents. El descarte real de cada cerca es publica a
 * `cost.tiles.entered − cost.tiles.survived`.
 *
 * LÍMITS CONEGUTS, DITS AQUÍ I NO AMAGATS. (1) El submostreig 5×5 té un gra de
 * 0,2 × pas (400 m amb el pas per defecte): un illot o una barra de sorra més
 * estrets que això poden no rebre cap mostra i la cel·la es perd — mesurat
 * sobre terrarium, l'illa de Tarifa dona −0,35 m i cauria fins i tot mostrada,
 * mentre que la punta del delta de l'Ebre (+0,02 m) sobreviu pels pèls. La
 * solució de veritat segueix sent una màscara de costa. (2) Les tessel·les del
 * disc z11 inclouen les de mar: fan falta justament per saber que és mar.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { STANDARD_ATMOSPHERE } from '../astro/constants';
import { computeLocalCircumstances } from '../astro/contacts';
import type { GeoLocation } from '../astro/types';
import { elevationAtSync, prefetchTiles, tileKey } from '../horizon/elevation';
import type { TileId } from '../horizon/elevation';
import {
  clipRings,
  computeHorizonProfile,
  DEFAULT_AZIMUTH_STEP_DEG,
  DEFAULT_RINGS,
  groundResolutionM,
  horizonDipDeg,
  ringTiles,
  type HorizonRing,
} from '../horizon/raycast';
import { computeVisibility } from '../visibility/verdict';
import {
  approxDistanceKm,
  bearingDeg,
  buildCandidateGrid,
  candidateId,
  findCellPeak,
} from './grid';
import { buildCentralSeed, fastCentralPhase, sunTrackAt } from './fastCentral';
import type { CentralSeed, FastCentral } from './fastCentral';
import { compareSpots, DEFAULT_SPOT_WEIGHTS, scoreSpot } from './score';
import {
  clipSieveRings,
  DEFAULT_SIEVE_RINGS,
  sampleHorizonWindow,
  sieveRangeKm,
  windowAltitudeAt,
  windowDistanceAt,
} from './window';
import type { HorizonWindow } from './window';
import { SpotSearchError } from './errors';
import type {
  SpotCandidate,
  SpotResult,
  SpotSearchCost,
  SpotSearchOptions,
  SpotSearchOutcome,
  SpotSearchProgress,
  SpotSearchStage,
  StageCost,
} from './types';

/* -------------------------------------------------------------- paràmetres */

const DEFAULT_RADIUS_KM = 25;
const DEFAULT_SPACING_KM = 2;
const DEFAULT_FINALISTS = 5;
const DEFAULT_LIMIT = 8;
const DEFAULT_SIEVE_HALF_WIDTH_DEG = 4;
const DEFAULT_SIEVE_STEP_DEG = 0.25;

/**
 * Pas azimutal del perfil dels finalistes.
 *
 * El perfil de veritat en fa servir 0,25°, la meitat del diàmetre del Sol. Aquí
 * pugem a 0,5° — un diàmetre solar sencer — i el cost del raycast es divideix
 * per dos. És una concessió conscient: pot suavitzar una osca estreta de la
 * carena, i per això el resultat d'un finalista no substitueix mai el veredicte
 * complet del lloc on l'usuari acabi anant.
 */
const DEFAULT_REFINE_STEP_DEG = 0.5;

/**
 * Fracció de la millor durada teòrica per sota de la qual un candidat ni tan
 * sols entra al garbell.
 *
 * La meitat és un tall generós a posta. Descartar per teoria és perillós — el
 * que decideix és el terreny — i aquest filtre només serveix per no gastar
 * terreny en punts que ja han perdut la meitat de la totalitat abans de mirar
 * cap muntanya.
 */
const MIN_CENTRAL_FRACTION = 0.5;

/** Mostres amb què s'integra la fase central al garbell. */
const SIEVE_TRACK_STEPS = 40;

/** Cada quants candidats es cedeix el fil, perquè es pugui cancel·lar. */
const YIELD_EVERY = 24;

/**
 * Repartiment del progrés entre etapes. Són fraccions del temps de rellotge
 * mesurat, no del nombre d'operacions: baixar tessel·les domina de llarg.
 */
const STAGE_WEIGHTS_FULL: Record<SpotSearchStage, number> = {
  grid: 0.01,
  astro: 0.05,
  tiles: 0.34,
  sieve: 0.15,
  refineTiles: 0.3,
  refine: 0.15,
  done: 0,
};

const STAGE_WEIGHTS_SIEVE_ONLY: Record<SpotSearchStage, number> = {
  grid: 0.02,
  astro: 0.08,
  tiles: 0.55,
  sieve: 0.35,
  refineTiles: 0,
  refine: 0,
  done: 0,
};

/* ------------------------------------------------------------------ utillatge */

function emptyStage(): StageCost {
  return {
    entered: 0,
    survived: 0,
    ms: 0,
    ephemerisCalls: 0,
    terrainSamples: 0,
    tiles: 0,
  };
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function abortIfNeeded(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new SpotSearchError('cancelled');
}

/** Progrés acumulat fins a l'inici d'una etapa. */
function stageStart(
  weights: Record<SpotSearchStage, number>,
  stage: SpotSearchStage,
): number {
  const order: SpotSearchStage[] = [
    'grid',
    'astro',
    'tiles',
    'sieve',
    'refineTiles',
    'refine',
  ];
  let sum = 0;
  for (const s of order) {
    if (s === stage) break;
    sum += weights[s];
  }
  return sum;
}

/* ------------------------------------------------- comptabilitat del terreny */

/**
 * Mostres que recorre UN raig a través d'una pila d'anells.
 *
 * No és cap estimació: el raycast avança a pas fix dins de cada anell, i el pas
 * és la mida de la cel·la del model a aquell zoom i aquella latitud. El que sí
 * que ignora és el tall de camp proper —un parell de mostres per raig—, que a
 * les centenars que en surten no mou res.
 */
function raySamples(latDeg: number, rings: HorizonRing[]): number {
  const sorted = rings.slice().sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
  let total = 0;
  let inner = 0;
  for (const ring of sorted) {
    const outerM = ring.maxDistanceKm * 1000;
    if (outerM > inner) total += (outerM - inner) / groundResolutionM(ring.zoom, latDeg);
    inner = outerM;
  }
  return total;
}

/** Mostres del terreny d'un perfil sencer, per poder comptabilitzar l'etapa D. */
function profileSamples(
  latDeg: number,
  rings: HorizonRing[],
  azimuthStepDeg: number,
): number {
  const rays = Math.max(1, Math.round(360 / azimuthStepDeg));
  return Math.round(rays * raySamples(latDeg, rings));
}

/** Tessel·les i mostres que costaria UN perfil complet, per poder-ho comparar. */
function naiveProfileCost(centre: GeoLocation): {
  tiles: number;
  samples: number;
} {
  const seen = new Set<string>();
  let inner = 0;

  for (const ring of DEFAULT_RINGS) {
    const outerM = ring.maxDistanceKm * 1000;
    for (const tile of ringTiles(centre.lat, centre.lon, {
      zoom: ring.zoom,
      innerM: inner,
      outerM,
    })) {
      seen.add(tileKey(tile));
    }
    inner = outerM;
  }

  return {
    tiles: seen.size,
    samples: profileSamples(centre.lat, DEFAULT_RINGS, DEFAULT_AZIMUTH_STEP_DEG),
  };
}

/* ---------------------------------------------------- estat viu d'un candidat */

interface LiveCandidate {
  candidate: SpotCandidate;
  central: FastCentral;
  /** Abast que demana l'altura del Sol en aquest punt, en km. */
  rangeKm: number;
  rings: HorizonRing[];
  /* omplerts pel garbell */
  centralVisibleSec: number;
  clearanceDeg: number;
  horizonAltitudeDeg: number;
  blockingDistanceKm: number | null;
  coverage: number;
  score: number;
  parts: SpotResult['parts'];
}

/**
 * Segons de fase central visibles segons el garbell.
 *
 * S'integra la trajectòria del Sol sobre la finestra d'horitzó amb 40 passos i
 * es refina cada creuament interpolant linealment, igual que fa el motor de
 * veritat. No es busca UN sol creuament: el perfil és dentat i el Sol es pot
 * amagar darrere una carena, tornar a sortir per una collada i tornar-se a
 * amagar. Un únic creuament donaria per perduts segons que sí que es veuen.
 */
export function integrateVisibleCentral(
  seed: CentralSeed,
  central: FastCentral,
  horizon: HorizonWindow,
): { visibleSec: number; worstClearanceDeg: number } {
  if (central.centralSec <= 0) {
    const track = sunTrackAt(seed, central, 0);
    return {
      visibleSec: 0,
      worstClearanceDeg:
        track.altitudeApparentDeg - windowAltitudeAt(horizon, track.azimuthDeg),
    };
  }

  const half = central.centralSec / 2;
  const dt = central.centralSec / SIEVE_TRACK_STEPS;

  const clearanceAt = (offsetSec: number): number => {
    const track = sunTrackAt(seed, central, offsetSec);
    return track.altitudeApparentDeg - windowAltitudeAt(horizon, track.azimuthDeg);
  };

  let visibleSec = 0;
  let worst = Infinity;
  let prev = clearanceAt(-half);
  if (prev < worst) worst = prev;

  for (let i = 1; i <= SIEVE_TRACK_STEPS; i++) {
    const current = clearanceAt(-half + i * dt);
    if (current < worst) worst = current;

    if (prev >= 0 && current >= 0) {
      visibleSec += dt;
    } else if (prev < 0 && current < 0) {
      /* res visible en aquest tram */
    } else {
      const fraction = prev / (prev - current);
      visibleSec += prev >= 0 ? fraction * dt : (1 - fraction) * dt;
    }
    prev = current;
  }

  return { visibleSec, worstClearanceDeg: worst };
}

/**
 * Deixa només un resultat per zona.
 *
 * Sense això la llista serien vuit versions del mateix turó, perquè els
 * candidats veïns comparteixen horitzó i puntuen gairebé igual. Es recorre la
 * llista ja ordenada i es descarta tot el que caigui a menys de `minKm` d'un de
 * millor: el primer que hi arriba es queda la zona.
 */
/**
 * Descarta els candidats que queden massa a prop d'un de millor.
 *
 * La distància la posa qui crida, perquè els candidats no sempre porten la
 * posició al mateix lloc: els vius la tenen dins de `.candidate`. Lligar
 * aquesta funció a una forma concreta amb `T extends {lat, lon}` obligava a
 * fer conversions forçades a la crida, i era d'on venien la meitat dels errors
 * de tipus d'aquest fitxer.
 */
export function suppressNearby<T>(
  ranked: T[],
  minKm: number,
  distance: (a: T, b: T) => number,
): T[] {
  if (minKm <= 0) return ranked;
  const kept: T[] = [];
  for (const item of ranked) {
    if (kept.every((other) => distance(item, other) >= minKm)) kept.push(item);
  }
  return kept;
}

/* ------------------------------------------------------------------- la cerca */

export async function searchSpots(
  options: SpotSearchOptions,
): Promise<SpotSearchOutcome> {
  const {
    eclipseId,
    origin,
    radiusKm = DEFAULT_RADIUS_KM,
    spacingKm = DEFAULT_SPACING_KM,
    finalists = DEFAULT_FINALISTS,
    limit = DEFAULT_LIMIT,
    minSeparationKm = spacingKm * 2,
    weights = DEFAULT_SPOT_WEIGHTS,
    atmosphere = STANDARD_ATMOSPHERE,
    eyeHeightM = 0,
    sieveRings = DEFAULT_SIEVE_RINGS,
    sieveHalfWidthDeg = DEFAULT_SIEVE_HALF_WIDTH_DEG,
    sieveStepDeg = DEFAULT_SIEVE_STEP_DEG,
    refineStepDeg = DEFAULT_REFINE_STEP_DEG,
    refineMaxRangeKm,
    refine = true,
    onProgress,
    signal,
    elevation = elevationAtSync,
    prefetch = prefetchTiles,
    computeProfile,
  } = options;

  const stageWeights = refine ? STAGE_WEIGHTS_FULL : STAGE_WEIGHTS_SIEVE_ONLY;
  const startedAt = Date.now();

  const cost: SpotSearchCost = {
    grid: emptyStage(),
    astro: emptyStage(),
    tiles: emptyStage(),
    sieve: emptyStage(),
    refineTiles: emptyStage(),
    refine: emptyStage(),
    totalMs: 0,
    uniqueTiles: 0,
    tilesIfNaive: 0,
    terrainSamplesIfNaive: 0,
  };

  const downloaded = new Set<string>();

  /*
   * EL PROGRÉS NO PORTA CAP FRASE, I ABANS EN PORTAVA UNA.
   *
   * `report` rebia un `message` escrit aquí en català («Baixant el relleu (3 de
   * 150 tessel·les)») que viatjava dins de `SpotSearchProgress` fins al Worker
   * i fins a la pantalla. No el pintava ningú —`SpotSearchPanel` ja componia la
   * seva frase a partir de `stage`, que sí que és un codi— però hi era, i un
   * canal de text en català obert cap a la interfície s'acaba fent servir. El
   * que queda és la DADA: quina etapa, quant en portem i quants candidats
   * queden vius. Les paraules, a `features/spots/strings.ts`.
   */
  const report = (
    stage: SpotSearchStage,
    within: number,
    examined: number,
    alive: number,
  ): void => {
    const progress: SpotSearchProgress = {
      stage,
      ratio: Math.min(
        1,
        stageStart(stageWeights, stage) + stageWeights[stage] * Math.min(1, within),
      ),
      examined,
      alive,
    };
    onProgress?.(progress);
  };

  /* ---- etapa 0: la graella -------------------------------------------- */

  abortIfNeeded(signal);
  let t0 = Date.now();
  report('grid', 0, 0, 0);

  // Les cotes encara no es poden llegir: no hi ha cap tessel·la baixada. Els
  // candidats hereten la d'on ets, que a efectes de la paral·laxi topocèntrica
  // del garbell no canvia res, i es corregeixen amb el model a l'etapa C.
  const candidates = buildCandidateGrid(origin, { radiusKm, spacingKm });
  cost.grid.entered = candidates.length;
  cost.grid.survived = candidates.length;
  cost.grid.ms = Date.now() - t0;

  const naive = naiveProfileCost(origin);
  cost.tilesIfNaive = naive.tiles * candidates.length;
  cost.terrainSamplesIfNaive = naive.samples * candidates.length;

  /* ---- etapa A: astronomia barata ------------------------------------- */

  t0 = Date.now();
  report('astro', 0, 0, 0);

  const seed = buildCentralSeed(eclipseId, origin, atmosphere);
  cost.astro.ephemerisCalls += seed.ephemerisCalls;
  cost.astro.entered = candidates.length;

  const scanned: LiveCandidate[] = [];
  let bestCentralSec = 0;

  for (let i = 0; i < candidates.length; i++) {
    if (i % YIELD_EVERY === 0) {
      await yieldToEventLoop();
      abortIfNeeded(signal);
      report(
        'astro',
        i / candidates.length,
        i,
        scanned.length,
      );
    }

    const candidate = candidates[i];
    const fast = fastCentralPhase(
      { lat: candidate.lat, lon: candidate.lon, elevation: candidate.elevation },
      seed,
    );
    cost.astro.ephemerisCalls += fast.ephemerisCalls;
    if (fast.centralSec > bestCentralSec) bestCentralSec = fast.centralSec;

    const rangeKm = sieveRangeKm(fast.sunAltitudeApparentDeg);
    scanned.push({
      candidate,
      central: fast,
      rangeKm,
      rings: clipSieveRings(rangeKm, sieveRings),
      centralVisibleSec: 0,
      clearanceDeg: 0,
      horizonAltitudeDeg: 0,
      blockingDistanceKm: null,
      coverage: 0,
      score: 0,
      parts: { centralSeconds: 0, clearance: 0, closeness: 0, altitude: 0 },
    });
  }

  // Es reavalua després del filtre de terra: la franja pot arribar al radi
  // però només tocar-hi aigua, i llavors no és cap lloc on es pugui anar.
  let centralReachable = bestCentralSec > 0;
  const centralFloor = centralReachable ? bestCentralSec * MIN_CENTRAL_FRACTION : 0;

  // El Sol sota l'horitzó astronòmic no el rescata cap turó: aquests candidats
  // cauen sempre, hi hagi o no hi hagi franja a prop.
  //
  // COMPTE AMB QUIN INSTANT ES MIRA. Aquí es comprovava només l'altura al MIG
  // de la fase central, i això buidava la cerca sencera a mitja Espanya.
  //
  // El motiu: els eclipsis del 2026 i el 2028 s'acaben amb la posta de Sol, i a
  // la cua del recorregut el Sol es pon DURANT la fase central. Al mig ja és
  // sota l'horitzó mentre que al principi encara es veu — i aquells segons de
  // principi són precisament el que la persona anirà a veure.
  //
  // Mesurat: cercant des de Girona per al 2028 amb 25 km de radi, dels 567
  // candidats en sobrevivien ZERO, quan n'hi ha a 24,6 km amb 73 segons
  // d'anularitat visible. La capçalera d'aquest mòdul ja anomena el 2028 «el
  // pitjor cas dels tres eclipsis» i el garbell el descartava sencer.
  //
  // Ara es mira el MÀXIM sobre els tres instants que delimiten la fase central.
  // Cost: cap crida nova a efemèrides — `sunTrackAt` extrapola amb les taxes
  // que el llavor ja porta calculades.
  const alive = scanned.filter((item) => {
    if (item.central.centralSec < centralFloor) return false;

    const half = item.central.centralSec / 2;
    const highest = Math.max(
      sunTrackAt(seed, item.central, -half).altitudeApparentDeg,
      item.central.sunAltitudeApparentDeg,
      sunTrackAt(seed, item.central, half).altitudeApparentDeg,
    );

    // Contra la depressió de l'horitzó i no contra zero: des d'un cim el Sol
    // encara es veu quan geomètricament ja ha passat l'horitzó del mar.
    return highest > horizonDipDeg(item.candidate.elevation);
  });

  cost.astro.survived = alive.length;
  cost.astro.ms = Date.now() - t0;

  if (alive.length === 0) {
    cost.totalMs = Date.now() - startedAt;
    report('done', 1, candidates.length, 0);
    return {
      results: [],
      cost,
      origin,
      radiusKm,
      candidates: candidates.length,
      bestCentralSec,
      centralReachable,
      estimatedOnly: !refine,
    };
  }

  /* ---- etapa B: tessel·les compartides -------------------------------- */

  t0 = Date.now();
  cost.tiles.entered = alive.length;

  const groundZoom = sieveRings[0]?.zoom ?? 11;

  // B′ PRIMER: EL DISC DE TERRA. Abans de decidir quines falques de cel es
  // baixen, es baixa el disc de cerca sencer al zoom de terra — un grapat de
  // tessel·les z11 que la unió de falques hauria inclòs gairebé totes — per
  // poder llegir la cota de cada cel·la. Amb això el filtre de mar i el salt
  // al cim corren ABANS de la unió de falques, i les cel·les d'aigua no
  // arrosseguen ni garbell ni tessel·les pròpies. El marge d'un pas de graella
  // cobreix les cel·les que cavalquen la vora del radi.
  const discTileList = ringTiles(origin.lat, origin.lon, {
    zoom: groundZoom,
    innerM: 0,
    outerM: (radiusKm + spacingKm) * 1000,
  }).filter((tile) => !downloaded.has(tileKey(tile)));

  report(
    'tiles',
    0,
    0,
    alive.length,
  );

  const discFetch = await prefetch(discTileList, {
    signal,
    onTileDone: (done, total) => {
      report(
        'tiles',
        total === 0 ? 0.15 : 0.15 * (done / total),
        done,
        alive.length,
      );
    },
  });
  abortIfNeeded(signal);
  for (const tile of discTileList) downloaded.add(tileKey(tile));
  cost.tiles.tiles += discTileList.length;

  // El motiu viatja com a CODI, no com a frase: vegeu `spots/errors.ts`.
  if (discTileList.length > 0 && discFetch.loaded === 0) {
    throw new SpotSearchError('no-terrain');
  }

  // TERRA O MAR, I EL CIM DE CADA CEL·LA. Vegeu la capçalera (etapa B′) i
  // `findCellPeak` per al perquè. L'origen queda exempt de tot: és on ets.
  const landAlive: LiveCandidate[] = [];
  for (let i = 0; i < alive.length; i++) {
    if (i % YIELD_EVERY === 0) {
      await yieldToEventLoop();
      abortIfNeeded(signal);
      report(
        'tiles',
        0.15 + 0.1 * (i / alive.length),
        i,
        landAlive.length,
      );
    }

    const item = alive[i];
    const { candidate } = item;

    if (candidate.lat === origin.lat && candidate.lon === origin.lon) {
      landAlive.push(item);
      continue;
    }

    const peak = findCellPeak(candidate.lat, candidate.lon, {
      spacingKm,
      elevation,
      zoom: groundZoom,
    });
    cost.tiles.terrainSamples += peak.samples;

    // Aigua a totes les mostres: no és cap lloc. `unknown` (cap dada) es
    // queda: un forat del model no pot esborrar un lloc del mapa.
    if (peak.kind === 'water') continue;

    if (peak.kind === 'land') {
      const moved = peak.lat !== candidate.lat || peak.lon !== candidate.lon;
      candidate.elevation = peak.elevation;
      if (moved) {
        candidate.lat = peak.lat;
        candidate.lon = peak.lon;
        candidate.distanceKm = approxDistanceKm(
          origin.lat,
          origin.lon,
          peak.lat,
          peak.lon,
        );
        candidate.bearingDeg = bearingDeg(origin.lat, origin.lon, peak.lat, peak.lon);

        // El candidat ja no és on l'astronomia el va calcular. Prop de la vora
        // de la franja, mig quilòmetre mou la durada uns quants segons, i el
        // garbell integraria una trajectòria equivocada: es recalcula. Són 5
        // crides a efemèrides per candidat mogut, 0,07 ms — res.
        const fast = fastCentralPhase(
          { lat: peak.lat, lon: peak.lon, elevation: peak.elevation },
          seed,
        );
        cost.tiles.ephemerisCalls += fast.ephemerisCalls;
        item.central = fast;
        item.rangeKm = sieveRangeKm(fast.sunAltitudeApparentDeg);
        item.rings = clipSieveRings(item.rangeKm, sieveRings);
      }
    }

    landAlive.push(item);
  }

  // La millor durada de la zona es reavalua sobre el que ha quedat: si el
  // rècord el tenia una cel·la d'aigua, normalitzar-hi les notes castigaria
  // tots els llocs on SÍ que es pot anar contra un fantasma.
  bestCentralSec = 0;
  for (const item of landAlive) {
    if (item.central.centralSec > bestCentralSec) {
      bestCentralSec = item.central.centralSec;
    }
  }
  centralReachable = bestCentralSec > 0;

  if (landAlive.length === 0) {
    cost.tiles.survived = 0;
    cost.tiles.ms = Date.now() - t0;
    cost.uniqueTiles = downloaded.size;
    cost.totalMs = Date.now() - startedAt;
    report('done', 1, alive.length, 0);
    return {
      results: [],
      cost,
      origin,
      radiusKm,
      candidates: candidates.length,
      bestCentralSec,
      centralReachable,
      estimatedOnly: !refine,
    };
  }

  // NOMÉS EL TROS DE CEL QUE ES MIRARÀ. L'etapa C crida `sampleHorizonWindow`
  // amb una finestra de ±`sieveHalfWidthDeg` al voltant de l'azimut del Sol.
  // Baixar el disc sencer per llegir-ne aquella franja era pagar la resta amb
  // la connexió de l'usuari; el sector es passa a `ringTiles` i prou. La unió
  // es fa sobre els supervivents de terra, des de la posició ja mudada al cim.
  const sieveTiles = new Map<string, TileId>();
  for (const item of landAlive) {
    const wedge = {
      centreAzimuthDeg: item.central.sunAzimuthDeg,
      halfWidthDeg: sieveHalfWidthDeg,
    };
    let inner = 0;
    for (const ring of item.rings) {
      const outerM = ring.maxDistanceKm * 1000;
      for (const tile of ringTiles(
        item.candidate.lat,
        item.candidate.lon,
        { zoom: ring.zoom, innerM: inner, outerM },
        wedge,
      )) {
        sieveTiles.set(tileKey(tile), tile);
      }
      inner = outerM;
    }
  }

  const sieveTileList = [...sieveTiles.values()].filter(
    (tile) => !downloaded.has(tileKey(tile)),
  );
  report(
    'tiles',
    0.25,
    0,
    landAlive.length,
  );

  const sieveFetch = await prefetch(sieveTileList, {
    signal,
    onTileDone: (done, total) => {
      report(
        'tiles',
        total === 0 ? 1 : 0.25 + 0.75 * (done / total),
        done,
        landAlive.length,
      );
    },
  });
  abortIfNeeded(signal);

  for (const tile of sieveTileList) downloaded.add(tileKey(tile));
  cost.tiles.tiles += sieveTileList.length;
  cost.tiles.survived = landAlive.length;
  cost.tiles.ms = Date.now() - t0;

  if (sieveTileList.length > 0 && sieveFetch.loaded === 0) {
    throw new SpotSearchError('no-terrain');
  }

  /* ---- etapa C: garbell d'horitzó ------------------------------------- */

  t0 = Date.now();
  cost.sieve.entered = landAlive.length;

  for (let i = 0; i < landAlive.length; i++) {
    if (i % YIELD_EVERY === 0) {
      await yieldToEventLoop();
      abortIfNeeded(signal);
      report(
        'sieve',
        i / landAlive.length,
        i,
        landAlive.length,
      );
    }

    const item = landAlive[i];
    const { candidate } = item;

    // La cota surt del MODEL, mai del que ens hagin passat. Si h0 i el terreny
    // no venen del mateix model, la primera mostra del raig — a poques desenes
    // de metres — ja s'emporta el màxim de tots els azimuts i l'horitzó surt
    // pla i altíssim. Els candidats mudats al cim ja la porten (és la mateixa
    // lectura), però l'origen i les cel·les sense dades passen per aquí.
    const dem = elevation(candidate.lon, candidate.lat, groundZoom);
    if (dem !== undefined) candidate.elevation = dem;
    const observerElevationM = candidate.elevation + eyeHeightM;

    const horizon = sampleHorizonWindow(candidate, observerElevationM, {
      centreAzimuthDeg: item.central.sunAzimuthDeg,
      halfWidthDeg: sieveHalfWidthDeg,
      stepDeg: sieveStepDeg,
      rings: item.rings,
      elevation,
    });
    cost.sieve.terrainSamples += horizon.samples;

    const integrated = integrateVisibleCentral(seed, item.central, horizon);

    item.centralVisibleSec = Math.min(
      integrated.visibleSec,
      item.central.centralSec,
    );
    item.clearanceDeg = integrated.worstClearanceDeg;
    item.horizonAltitudeDeg = windowAltitudeAt(horizon, item.central.sunAzimuthDeg);
    item.blockingDistanceKm = windowDistanceAt(horizon, item.central.sunAzimuthDeg);
    item.coverage = horizon.coverage;

    const scored = scoreSpot({
      centralVisibleSec: item.centralVisibleSec,
      bestCentralSec,
      clearanceDeg: item.clearanceDeg,
      distanceKm: candidate.distanceKm,
      radiusKm,
      elevationM: candidate.elevation,
      originElevationM: origin.elevation,
      weights,
    });
    item.score = scored.score;
    item.parts = scored.parts;
  }

  cost.sieve.survived = landAlive.length;
  cost.sieve.ms = Date.now() - t0;

  // Aquí hi havia una crida a `suppressNearby` amb `minKm = 0`, que la funció
  // ignora i retorna l'entrada tal qual: codi mort que a més necessitava dues
  // conversions forçades per compilar. L'ordre real el fa el `sort` de sota.
  const ranked = landAlive.slice();

  // L'ordre i la supressió es fan sobre el resultat del garbell, que és
  // l'única informació disponible en aquest punt. Els segons visibles i la
  // cota viatgen amb la nota: són els desempats de `compareSpots`, que a
  // igualtat pràctica de segons prefereix el lloc alt (vegeu `score.ts`).
  ranked.sort((a, b) =>
    compareSpots(
      {
        score: a.score,
        distanceKm: a.candidate.distanceKm,
        centralVisibleSec: a.centralVisibleSec,
        elevation: a.candidate.elevation,
      },
      {
        score: b.score,
        distanceKm: b.candidate.distanceKm,
        centralVisibleSec: b.centralVisibleSec,
        elevation: b.candidate.elevation,
      },
    ),
  );

  const spread = suppressNearby(ranked, minSeparationKm, (a, b) =>
    Math.hypot(
      (a.candidate.lat - b.candidate.lat) * 111.195,
      (a.candidate.lon - b.candidate.lon) *
        111.195 *
        Math.cos((a.candidate.lat * Math.PI) / 180),
    ),
  );

  const shortlist = spread.slice(0, Math.max(limit, finalists));

  const results: SpotResult[] = shortlist.map((item) => toResult(item, 'sieve', null));

  if (!refine) {
    cost.totalMs = Date.now() - startedAt;
    cost.uniqueTiles = downloaded.size;
    report('done', 1, candidates.length, results.length);
    return {
      results: results.slice(0, limit),
      cost,
      origin,
      radiusKm,
      candidates: candidates.length,
      bestCentralSec,
      centralReachable,
      estimatedOnly: true,
    };
  }

  /* ---- etapa D1: tessel·les dels finalistes ---------------------------- */

  const chosen = spread.slice(0, finalists);
  t0 = Date.now();
  cost.refineTiles.entered = chosen.length;

  const refineRings = (item: LiveCandidate): HorizonRing[] =>
    clipRings(Math.min(refineMaxRangeKm ?? item.rangeKm, item.rangeKm));

  const finalTiles = new Map<string, TileId>();
  for (const item of chosen) {
    let inner = 0;
    for (const ring of refineRings(item)) {
      const outerM = ring.maxDistanceKm * 1000;
      for (const tile of ringTiles(item.candidate.lat, item.candidate.lon, {
        zoom: ring.zoom,
        innerM: inner,
        outerM,
      })) {
        finalTiles.set(tileKey(tile), tile);
      }
      inner = outerM;
    }
  }

  const finalTileList = [...finalTiles.values()].filter(
    (tile) => !downloaded.has(tileKey(tile)),
  );
  report(
    'refineTiles',
    0,
    0,
    chosen.length,
  );

  await prefetch(finalTileList, {
    signal,
    onTileDone: (done, total) => {
      report(
        'refineTiles',
        total === 0 ? 1 : done / total,
        done,
        chosen.length,
      );
    },
  });
  abortIfNeeded(signal);

  for (const tile of finalTileList) downloaded.add(tileKey(tile));
  cost.refineTiles.tiles = finalTileList.length;
  cost.refineTiles.survived = chosen.length;
  cost.refineTiles.ms = Date.now() - t0;

  /* ---- etapa D2: el càlcul de veritat ---------------------------------- */

  t0 = Date.now();
  cost.refine.entered = chosen.length;

  const profileOf =
    computeProfile ??
    ((location: GeoLocation, opts: {
      azimuthStepDeg: number;
      rings: HorizonRing[];
      eyeHeightM: number;
      signal?: AbortSignal;
    }) =>
      computeHorizonProfile(location, {
        azimuthStepDeg: opts.azimuthStepDeg,
        rings: opts.rings,
        eyeHeightM: opts.eyeHeightM,
        signal: opts.signal,
      }));

  for (let i = 0; i < chosen.length; i++) {
    abortIfNeeded(signal);
    report(
      'refine',
      i / chosen.length,
      i,
      chosen.length,
    );

    const item = chosen[i];
    const location: GeoLocation = {
      lat: item.candidate.lat,
      lon: item.candidate.lon,
      elevation: item.candidate.elevation,
    };

    const circumstances = computeLocalCircumstances(eclipseId, location, atmosphere);
    // Cada `computeLocalCircumstances` són ~520 parells de posicions, i el
    // veredicte n'hi afegeix uns 1.400 més entre escombrats i refinaments.
    cost.refine.ephemerisCalls += 1900;

    const rings = refineRings(item);
    // `computeHorizonProfile` no torna quantes mostres ha llegit, però el
    // recompte és determinista: pas fix dins de cada anell. Sense això, la
    // comparació amb el camí ingenu deixaria fora tot el cost dels finalistes i
    // l'estalvi publicat sortiria inflat.
    cost.refine.terrainSamples += profileSamples(location.lat, rings, refineStepDeg);

    const profile = await profileOf(location, {
      azimuthStepDeg: refineStepDeg,
      rings,
      eyeHeightM,
      signal,
    });

    const verdict = computeVisibility(circumstances, profile);

    const index = results.findIndex(
      (r) => r.id === candidateId(item.candidate.lat, item.candidate.lon),
    );
    if (index >= 0) {
      const scored = scoreSpot({
        centralVisibleSec: verdict.centralVisibleSec,
        bestCentralSec,
        clearanceDeg: worstClearanceOf(verdict),
        distanceKm: item.candidate.distanceKm,
        radiusKm,
        elevationM: profile.demElevation,
        originElevationM: origin.elevation,
        weights,
      });

      results[index] = {
        ...results[index],
        detail: 'full',
        elevation: profile.demElevation,
        score: scored.score,
        parts: scored.parts,
        centralVisibleSec: verdict.centralVisibleSec,
        centralTotalSec: verdict.centralTotalSec,
        centralLostSec: verdict.centralLostSec,
        clearanceDeg: worstClearanceOf(verdict),
        horizonAltitudeDeg: verdict.horizonAltitudeAtMaxDeg,
        blockingDistanceKm: verdict.blockingDistanceKm,
        climbToRecoverM: verdict.climbToRecoverM,
        sunAltitudeDeg: verdict.sunAltitudeAtMaxDeg,
        status: verdict.status,
        edgeUncertain: circumstances.edgeUncertain,
        coverage: profile.coverage,
      };
    }
  }

  cost.refine.survived = chosen.length;
  cost.refine.ms = Date.now() - t0;
  cost.uniqueTiles = downloaded.size;
  cost.totalMs = Date.now() - startedAt;

  results.sort((a, b) => compareSpots(a, b));
  report('done', 1, candidates.length, results.length);

  return {
    results: results.slice(0, limit),
    cost,
    origin,
    radiusKm,
    candidates: candidates.length,
    bestCentralSec,
    centralReachable,
    estimatedOnly: false,
  };
}

/**
 * Marge d'horitzó equivalent d'un veredicte complet.
 *
 * `altitudeDeficitDeg` és el pitjor dèficit (positiu quan el terreny guanya).
 * Quan no se'n perd gens, el veredicte no publica quant de marge sobrava, així
 * que el deduïm de l'altura del Sol al màxim menys la del terreny. És
 * lleugerament conservador — el pitjor instant pot no ser el màxim — i és el
 * costat correcte per a un terme que serveix d'assegurança.
 */
function worstClearanceOf(verdict: {
  altitudeDeficitDeg: number;
  sunAltitudeAtMaxDeg: number;
  horizonAltitudeAtMaxDeg: number;
}): number {
  if (verdict.altitudeDeficitDeg > 0) return -verdict.altitudeDeficitDeg;
  return verdict.sunAltitudeAtMaxDeg - verdict.horizonAltitudeAtMaxDeg;
}

function toResult(
  item: LiveCandidate,
  detail: 'sieve' | 'full',
  status: SpotResult['status'],
): SpotResult {
  const { candidate } = item;
  const deficit = Math.max(0, -item.clearanceDeg);
  return {
    id: candidateId(candidate.lat, candidate.lon),
    lat: candidate.lat,
    lon: candidate.lon,
    elevation: candidate.elevation,
    distanceKm: candidate.distanceKm,
    bearingDeg: candidate.bearingDeg,
    score: item.score,
    parts: item.parts,
    detail,
    centralVisibleSec: item.centralVisibleSec,
    // Aquests surten de `item.central`, no de `item`. Llegint-los del lloc
    // equivocat sortien tots com a `undefined`, i el pitjor: `edgeUncertain`
    // quedava en `NaN < 2`, que és sempre fals, o sigui que l'avís de «ets a la
    // vora de la franja» no s'encenia mai. Justament el contrari del que ha de
    // fer aquesta app.
    centralTotalSec: item.central.centralSec,
    centralLostSec: Math.max(0, item.central.centralSec - item.centralVisibleSec),
    clearanceDeg: item.clearanceDeg,
    horizonAltitudeDeg: item.horizonAltitudeDeg,
    blockingDistanceKm: item.blockingDistanceKm,
    climbToRecoverM:
      deficit > 0 && item.blockingDistanceKm !== null && item.blockingDistanceKm > 0
        ? ((deficit * Math.PI) / 180) * item.blockingDistanceKm * 1000
        : null,
    sunAzimuthDeg: item.central.sunAzimuthDeg,
    sunAltitudeDeg: item.central.sunAltitudeApparentDeg,
    midCentralMs: item.central.midMs,
    status,
    // Dos segons d'arc és l'error de posició relativa Sol-Lluna
    // d'`astronomy-engine`, mesurat. Per sota, la resposta seria una moneda.
    edgeUncertain: Math.abs(item.central.umbralMarginArcsec) < 2,
    coverage: item.coverage,
  };
}
