/**
 * Proves de l'embut.
 *
 * ── PER QUÈ EXISTEIX LA PRIMERA PROVA ───────────────────────────────────────
 *
 * L'auditoria va trobar que `toResult` llegia sis camps del lloc equivocat de
 * l'objecte. Tots els resultats sortien amb `undefined` i amb `NaN`, i la
 * conseqüència pitjor era silenciosa: `edgeUncertain` es calculava com
 * `NaN < 2`, que és sempre fals, i per tant l'avís de «ets a la vora de la
 * franja i no ho podem decidir» no s'encenia mai. Justament el contrari del
 * que ha de fer aquesta aplicació. Res no petava i cap prova no ho veia.
 *
 * Per això `expectSoundResult` no comprova un camp concret sinó TOTS, i el
 * mapa `FIELD_KINDS` està tipat contra `SpotResult`: si algú hi afegeix un
 * camp, aquest fitxer deixa de compilar fins que digui quina forma ha de tenir.
 *
 * ── SENSE XARXA ─────────────────────────────────────────────────────────────
 *
 * `searchSpots` accepta el lector d'elevació, la precàrrega de tessel·les i el
 * càlcul del perfil per paràmetre. Aquí s'hi injecta terreny sintètic: sabem la
 * resposta exacta i la prova és determinista. L'astronomia, en canvi, és la de
 * veritat — no té sentit inventar-se un eclipsi.
 */

import { describe, expect, it } from 'vitest';
import type { GeoLocation } from '../astro/types';
import type { TileId } from '../horizon/elevation';
import { HORIZON_PROFILE_VERSION, type HorizonProfile } from '../horizon/profile';
import {
  ELEVATION_MISMATCH_THRESHOLD_M,
  TERRESTRIAL_REFRACTION_K,
} from '../horizon/raycast';
import { approxDistanceKm, buildCandidateGrid, kmPerDegLon } from './grid';
import { searchSpots, suppressNearby } from './search';
import { sampleHorizonWindow } from './window';
import type {
  ElevationReader,
  SpotResult,
  SpotSearchOptions,
  SpotSearchProgress,
} from './types';

/* ------------------------------------------------------------------- llocs */

/** Sòria: ben endins de la franja del 12-08-2026, amb el Sol a 7,2°. */
const SORIA: GeoLocation = { lat: 41.7665, lon: -2.479, elevation: 1000 };

/** Prop del límit nord de la franja: el marge umbral hi val menys d'1 segon d'arc. */
const VORA: GeoLocation = { lat: 43.0, lon: -2.479, elevation: 1000 };

/** Madrid: fora de la franja. Hi ha eclipsi, però no hi ha fase central. */
const MADRID: GeoLocation = { lat: 40.4168, lon: -3.7038, elevation: 650 };

const ECLIPSE = '2026-08-12';

/* ---------------------------------------------------------------- terrenys */

/** Altiplà pla a 1.000 m. Res no pot tapar el Sol. */
const ALTIPLA: ElevationReader = () => 1000;

/**
 * Paret nord-sud a ponent de Sòria, entre 7,9 i 9,5 km, 2.000 m per damunt de
 * l'altiplà. A 8 km es veu a 14°, i fins i tot des del racó més oriental del
 * radi (uns 14 km de biaix) encara fa 8°: per damunt del Sol de tots els
 * candidats. Se'ls menja la fase central a tots alhora.
 *
 * FORA DE L'ABAST DEL SALT AL CIM, a posta: amb 6 km de radi i cel·les de
 * 2 km, cap mostra de cap cel·la passa dels 6,9 km (6 + 0,45 × 2). Si la paret
 * comencés més a prop, els candidats de la vora s'hi enfilarien — que és
 * exactament el que el motor ha de fer ara — i aquest escenari vol provar el
 * cas contrari: el mur que NINGÚ del radi no pot escalar.
 */
const PARET: ElevationReader = (lon) =>
  lon < SORIA.lon - 0.095 && lon > SORIA.lon - 0.115 ? 3000 : 1000;

/* ------------------------------------------------------- dobles de la xarxa */

interface PrefetchLog {
  lots: number;
  tiles: TileId[];
}

function fakePrefetch(log: PrefetchLog): NonNullable<SpotSearchOptions['prefetch']> {
  return (tiles, options) => {
    log.lots++;
    for (const tile of tiles) log.tiles.push(tile);
    options.onTileDone?.(tiles.length, tiles.length);
    return Promise.resolve({
      requested: tiles.length,
      loaded: tiles.length,
      failed: 0,
    });
  };
}

/**
 * Perfil complet a partir del terreny sintètic.
 *
 * Es fa amb `sampleHorizonWindow` obrint la finestra a 360°: així el perfil dels
 * finalistes surt del mateix nucli de raytracing que el garbell i les dues
 * etapes són comparables. Amb `centreAzimuthDeg = 180` i `halfWidthDeg = 180`,
 * el primer raig cau a 0° i `altitudes[i]` correspon a l'azimut `i · pas`, que
 * és el conveni de `HorizonProfile`.
 */
function syntheticProfile(
  terrain: ElevationReader,
): NonNullable<SpotSearchOptions['computeProfile']> {
  return (location, options) => {
    const rays = Math.round(360 / options.azimuthStepDeg);
    const step = 360 / rays;
    const zoom = options.rings[0]?.zoom ?? 11;
    const dem = terrain(location.lon, location.lat, zoom) ?? location.elevation;
    const observerElevation = dem + options.eyeHeightM;

    const window = sampleHorizonWindow(location, observerElevation, {
      centreAzimuthDeg: 180,
      halfWidthDeg: 180,
      stepDeg: step,
      rings: options.rings,
      elevation: terrain,
    });

    const profile: HorizonProfile = {
      version: HORIZON_PROFILE_VERSION,
      lat: location.lat,
      lon: location.lon,
      observerElevation,
      demElevation: dem,
      requestedElevation: location.elevation,
      elevationMismatchM: location.elevation - dem,
      elevationSuspect:
        Math.abs(location.elevation - dem) > ELEVATION_MISMATCH_THRESHOLD_M,
      elevationSource: 'dem',
      heightAboveGroundM: options.eyeHeightM,
      nearFieldM: 0,
      azimuthStepDeg: step,
      // El raig de 360° és el mateix que el de 0°: en sobra un.
      altitudes: window.altitudes.slice(0, rays),
      distancesKm: window.distancesKm.slice(0, rays),
      maxRangeKm: window.rangeKm,
      refractionK: TERRESTRIAL_REFRACTION_K,
      ringSignature: 'test',
      coverage: window.coverage,
      computedAtMs: Date.now(),
    };
    return Promise.resolve(profile);
  };
}

/** Llança una cerca petita i barata, amb tot el que toca la xarxa substituït. */
function start(
  origin: GeoLocation,
  terrain: ElevationReader,
  overrides: Partial<SpotSearchOptions> = {},
) {
  const log: PrefetchLog = { lots: 0, tiles: [] };
  const pending = searchSpots({
    eclipseId: ECLIPSE,
    origin,
    radiusKm: 6,
    spacingKm: 2,
    finalists: 3,
    limit: 5,
    elevation: terrain,
    prefetch: fakePrefetch(log),
    computeProfile: syntheticProfile(terrain),
    // Un pas gruixut i un abast curt: la prova mira el camí del codi, no la
    // precisió del perfil, i 720 raigs per finalista no hi aporten res.
    refineStepDeg: 2,
    refineMaxRangeKm: 12,
    ...overrides,
  });
  return { pending, log };
}

/** El mateix, ja esperat. La majoria de proves només volen el resultat. */
async function run(
  origin: GeoLocation,
  terrain: ElevationReader,
  overrides: Partial<SpotSearchOptions> = {},
) {
  const { pending, log } = start(origin, terrain, overrides);
  return { outcome: await pending, log };
}

/* --------------------------------------------- comprovació camp per camp */

type FieldKind = 'number' | 'string' | 'boolean' | 'number-or-null' | 'status' | 'parts';

/**
 * Forma esperada de cada camp de `SpotResult`.
 *
 * El tipus mapat amb `-?` obliga que hi siguin TOTS. Aquesta és la xarxa que
 * hauria hagut d'existir quan `toResult` llegia sis camps del lloc equivocat.
 */
const FIELD_KINDS: { [K in keyof SpotResult]-?: FieldKind } = {
  id: 'string',
  lat: 'number',
  lon: 'number',
  elevation: 'number',
  distanceKm: 'number',
  bearingDeg: 'number',
  score: 'number',
  parts: 'parts',
  detail: 'string',
  centralVisibleSec: 'number',
  centralTotalSec: 'number',
  centralLostSec: 'number',
  clearanceDeg: 'number',
  horizonAltitudeDeg: 'number',
  blockingDistanceKm: 'number-or-null',
  climbToRecoverM: 'number-or-null',
  sunAzimuthDeg: 'number',
  sunAltitudeDeg: 'number',
  midCentralMs: 'number',
  status: 'status',
  edgeUncertain: 'boolean',
  coverage: 'number',
};

const PART_KEYS = ['centralSeconds', 'clearance', 'closeness', 'altitude'] as const;

function expectSoundResult(result: SpotResult): void {
  const record = result as unknown as Record<string, unknown>;

  // Cap camp de més: si algú en treu un del tipus i el deixa a `toResult`,
  // aquí es veurà.
  expect(Object.keys(record).sort()).toEqual(Object.keys(FIELD_KINDS).sort());

  for (const [field, kind] of Object.entries(FIELD_KINDS)) {
    const value = record[field];
    const on = `camp «${field}»`;

    switch (kind) {
      case 'number':
        expect(typeof value, on).toBe('number');
        expect(Number.isFinite(value as number), on).toBe(true);
        break;
      case 'number-or-null':
        if (value !== null) {
          expect(typeof value, on).toBe('number');
          expect(Number.isFinite(value as number), on).toBe(true);
        }
        break;
      case 'string':
        expect(typeof value, on).toBe('string');
        expect((value as string).length, on).toBeGreaterThan(0);
        break;
      case 'boolean':
        expect(typeof value, on).toBe('boolean');
        break;
      case 'status':
        // `null` mentre el resultat sigui una estimació del garbell.
        if (value !== null) expect(typeof value, on).toBe('string');
        break;
      case 'parts':
        expect(Object.keys(value as object).sort(), on).toEqual([...PART_KEYS].sort());
        for (const key of PART_KEYS) {
          const part = (value as Record<string, unknown>)[key];
          expect(typeof part, `${on}.${key}`).toBe('number');
          expect(Number.isFinite(part as number), `${on}.${key}`).toBe(true);
          expect(part as number, `${on}.${key}`).toBeGreaterThanOrEqual(0);
          expect(part as number, `${on}.${key}`).toBeLessThanOrEqual(1);
        }
        break;
    }
  }
}

/* ================================================================== proves */

describe('cap resultat amb forats', () => {
  it('cap camp de SpotResult no surt undefined ni NaN, ni al garbell ni al càlcul complet', async () => {
    const casos = await Promise.all([
      run(SORIA, ALTIPLA, { refine: false }),
      run(SORIA, ALTIPLA, { refine: true }),
      run(SORIA, PARET, { refine: false }),
      run(SORIA, PARET, { refine: true }),
    ]);
    for (const { outcome } of casos) {
      expect(outcome.results.length).toBeGreaterThan(0);
      for (const result of outcome.results) expectSoundResult(result);
    }
  });

  it('tampoc quan dins del radi no hi arriba la franja', async () => {
    // Madrid: hi ha eclipsi però no hi ha totalitat. La divisió per la millor
    // durada de la zona seria 0/0 si el marcador no ho tingués previst.
    const { outcome } = await run(MADRID, ALTIPLA);
    expect(outcome.centralReachable).toBe(false);
    expect(outcome.bestCentralSec).toBe(0);
    expect(outcome.results.length).toBeGreaterThan(0);
    for (const result of outcome.results) {
      expectSoundResult(result);
      expect(result.centralTotalSec).toBe(0);
      expect(result.centralVisibleSec).toBe(0);
      expect(result.parts.centralSeconds).toBe(0);
    }
  });

  it('el cost tampoc no porta NaN enlloc', async () => {
    const { outcome } = await run(SORIA, ALTIPLA);
    const cost = outcome.cost;
    const stages = ['grid', 'astro', 'tiles', 'sieve', 'refineTiles', 'refine'] as const;
    for (const stage of stages) {
      for (const [key, value] of Object.entries(cost[stage])) {
        expect(Number.isFinite(value), `${stage}.${key}`).toBe(true);
        expect(value as number, `${stage}.${key}`).toBeGreaterThanOrEqual(0);
      }
    }
    for (const key of ['totalMs', 'uniqueTiles', 'tilesIfNaive', 'terrainSamplesIfNaive'] as const) {
      expect(Number.isFinite(cost[key]), key).toBe(true);
    }
  });
});

describe('l’avís de la vora de la franja', () => {
  it('no s’encén ben endins de la franja', async () => {
    const { outcome } = await run(SORIA, ALTIPLA, { refine: false });
    expect(outcome.results.length).toBeGreaterThan(0);
    for (const result of outcome.results) expect(result.edgeUncertain).toBe(false);
  });

  it('s’encén a tocar del límit, que és l’única cosa honesta que es pot dir allà', async () => {
    // Aquest és el cas que la regressió de `toResult` feia impossible: amb
    // `NaN < 2` sempre fals, aquí no s'hauria encès mai cap avís.
    const { outcome } = await run(VORA, ALTIPLA, { refine: false });
    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.results.some((r) => r.edgeUncertain)).toBe(true);
  });
});

describe('el terreny decideix', () => {
  it('sobre l’altiplà es veu tota la fase central i no cal pujar enlloc', async () => {
    const { outcome } = await run(SORIA, ALTIPLA);
    for (const result of outcome.results) {
      expect(result.centralVisibleSec).toBeCloseTo(result.centralTotalSec, 0);
      expect(result.centralLostSec).toBeLessThan(1);
      expect(result.clearanceDeg).toBeGreaterThan(0);
      expect(result.climbToRecoverM).toBeNull();
    }
  });

  it('darrere la paret no es veu res, i es diu quant hauries de pujar', async () => {
    const { outcome } = await run(SORIA, PARET, { refine: false });
    for (const result of outcome.results) {
      expect(result.centralTotalSec).toBeGreaterThan(0);
      expect(result.centralVisibleSec).toBe(0);
      expect(result.centralLostSec).toBeCloseTo(result.centralTotalSec, 6);
      expect(result.clearanceDeg).toBeLessThan(0);
      expect(result.blockingDistanceKm).not.toBeNull();
      expect(result.blockingDistanceKm as number).toBeGreaterThan(1);
      expect(result.blockingDistanceKm as number).toBeLessThan(20);
      // Δh ≈ dèficit(rad) × distància. Amb 7° de dèficit a 7 km són ~850 m:
      // el missatge correcte no és «puja», és «canvia de lloc».
      expect(result.climbToRecoverM).not.toBeNull();
      expect(result.climbToRecoverM as number).toBeGreaterThan(100);
    }
  });

  it('un terreny sense dades es diu amb la cobertura, no s’amaga', async () => {
    const buit: ElevationReader = () => undefined;
    const { outcome } = await run(SORIA, buit, { refine: false });
    for (const result of outcome.results) {
      expectSoundResult(result);
      expect(result.coverage).toBe(0);
    }
  });
});

describe('l’embut', () => {
  it('les tessel·les compartides són el guany gros: tres ordres de magnitud', async () => {
    // Aquesta és la prova que justifica que existeixi tot aquest mòdul. Si algú
    // canvia els paràmetres i el guany s'esfuma, aquí es veurà.
    const { outcome, log } = await run(SORIA, ALTIPLA, {
      radiusKm: 25,
      spacingKm: 2,
      refine: false,
    });

    expect(outcome.candidates).toBe(567);
    expect(outcome.cost.tilesIfNaive).toBeGreaterThan(50_000);
    expect(outcome.cost.uniqueTiles).toBeLessThan(outcome.cost.tilesIfNaive / 100);
    // Cap tessel·la demanada dues vegades: la comptabilitat del cost seria una
    // mentida si el mateix fitxer es baixés a dues etapes.
    const claus = log.tiles.map((t) => `${t.z}/${t.x}/${t.y}`);
    expect(new Set(claus).size).toBe(claus.length);
  });

  it('el garbell mira una fracció ínfima del terreny del camí ingenu', async () => {
    const { outcome } = await run(SORIA, ALTIPLA, {
      radiusKm: 25,
      spacingKm: 2,
      refine: false,
    });
    const cost = outcome.cost;
    expect(cost.sieve.terrainSamples).toBeGreaterThan(0);
    expect(cost.sieve.terrainSamples).toBeLessThan(cost.terrainSamplesIfNaive / 100);
  });

  it('l’astronomia barata descarta abans de tocar cap tessel·la', async () => {
    const { outcome } = await run(MADRID, ALTIPLA, { radiusKm: 25, refine: false });
    const cost = outcome.cost;
    expect(cost.astro.entered).toBe(outcome.candidates);
    expect(cost.astro.entered).toBeGreaterThan(500);
    expect(cost.astro.survived).toBeLessThanOrEqual(cost.astro.entered);
    expect(cost.astro.ephemerisCalls).toBeGreaterThan(0);
    // Quatre o cinc crides per candidat, no les ~520 de `computeLocalCircumstances`.
    expect(cost.astro.ephemerisCalls).toBeLessThan(cost.astro.entered * 10);
    // Les tessel·les es demanen DESPRÉS del garbell astronòmic.
    expect(cost.tiles.entered).toBe(cost.astro.survived);
  });

  it('aturar-se al garbell no baixa cap tessel·la fina ni promet res que no sap', async () => {
    const { outcome } = await run(SORIA, ALTIPLA, { refine: false });
    expect(outcome.estimatedOnly).toBe(true);
    expect(outcome.cost.refineTiles.tiles).toBe(0);
    expect(outcome.cost.refine.ms).toBe(0);
    for (const spot of outcome.results) {
      expect(spot.detail).toBe('sieve');
      expect(spot.status).toBeNull();
    }
  });

  it('els finalistes passen pel motor de veritat i queden marcats', async () => {
    const { outcome } = await run(SORIA, ALTIPLA, { finalists: 3, limit: 5 });
    expect(outcome.estimatedOnly).toBe(false);
    const complets = outcome.results.filter((r) => r.detail === 'full');
    expect(complets.length).toBeGreaterThan(0);
    expect(complets.length).toBeLessThanOrEqual(3);
    for (const spot of complets) {
      expect(spot.status).not.toBeNull();
      expect(typeof spot.status).toBe('string');
    }
  });
});

describe('la llista', () => {
  it('va ordenada per nota i no en torna més de les demanades', async () => {
    const { outcome } = await run(SORIA, ALTIPLA, { limit: 4, radiusKm: 10 });
    const results = outcome.results;
    expect(results.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score - 1e-9);
    }
  });

  it('no són vuit versions del mateix turó: hi ha separació mínima', async () => {
    const minSeparationKm = 4;
    const { outcome } = await run(SORIA, ALTIPLA, {
      radiusKm: 12,
      spacingKm: 2,
      minSeparationKm,
      limit: 8,
      refine: false,
    });
    const results = outcome.results;
    expect(results.length).toBeGreaterThan(1);
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const dLat = (results[i].lat - results[j].lat) * 111.195;
        const dLon =
          (results[i].lon - results[j].lon) *
          111.195 *
          Math.cos((results[i].lat * Math.PI) / 180);
        expect(Math.hypot(dLat, dLon)).toBeGreaterThanOrEqual(minSeparationKm - 1e-6);
      }
    }
  });

  it('cada resultat porta una clau estable i única', async () => {
    const { outcome } = await run(SORIA, ALTIPLA, { refine: false });
    const results = outcome.results;
    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(results.length);
    for (const result of results) {
      expect(result.id).toBe(`${result.lat.toFixed(5)},${result.lon.toFixed(5)}`);
    }
  });
});

describe('supressió de veïns', () => {
  it('es queda el primer de cada zona, que és el millor perquè la llista ve ordenada', () => {
    const punts = [
      { name: 'a', km: 0 },
      { name: 'b', km: 1 },
      { name: 'c', km: 5 },
      { name: 'd', km: 5.5 },
      { name: 'e', km: 12 },
    ];
    const kept = suppressNearby(punts, 3, (x, y) => Math.abs(x.km - y.km));
    expect(kept.map((p) => p.name)).toEqual(['a', 'c', 'e']);
  });

  it('amb separació zero no toca res', () => {
    const punts = [{ km: 0 }, { km: 0 }];
    expect(suppressNearby(punts, 0, () => 0)).toHaveLength(2);
  });
});

describe('el mar no és un lloc', () => {
  /**
   * Costa sintètica a ponent de Sòria: mar obert amb batimetria (−30 m), una
   * plataforma arran d'aigua exactament a 0 m —terrarium codifica el mar així,
   * amb zero o negatiu— i terra a 1.000 m. El Sol de l'eclipsi cau a ponent,
   * o sigui que les cel·les de mar tenen l'horitzó més net de tots: sense
   * filtre de terra, el motor les recomanava per damunt de la costa real.
   */
  const COSTA: ElevationReader = (lon) => {
    if (lon < SORIA.lon - 0.05) return -30;
    if (lon < SORIA.lon - 0.01) return 0;
    return 1000;
  };

  it('cap resultat no cau a cota ≤ 0: en plena aigua no s’hi pot plantar ningú', async () => {
    const { outcome } = await run(SORIA, COSTA, {
      refine: false,
      limit: 12,
      minSeparationKm: 2,
    });
    expect(outcome.results.length).toBeGreaterThan(0);
    for (const result of outcome.results) {
      expect(result.elevation, `resultat ${result.id}`).toBeGreaterThan(0);
    }
  });

  it('el descarte es publica al cost, i les cel·les de mar no paguen garbell', async () => {
    const { outcome } = await run(SORIA, COSTA, { refine: false });
    const cost = outcome.cost;
    // El filtre viu a l'etapa de tessel·les: hi entren tots els vius de
    // l'astronomia i només en surten els de terra ferma.
    expect(cost.tiles.entered).toBe(cost.astro.survived);
    expect(cost.tiles.survived).toBeLessThan(cost.tiles.entered);
    // I el garbell —l'etapa cara— només mira els supervivents.
    expect(cost.sieve.entered).toBe(cost.tiles.survived);
  });
});

describe('el punt de cada cel·la és el seu cim', () => {
  it('un turó dins d’una cel·la plana atrau el candidat', async () => {
    // La graella és determinista (retícula global), així que podem saber on
    // cauen els candidats abans de córrer la cerca i plantar el turó dins
    // d'una cel·la concreta, a un dels punts del submostreig 5×5.
    const reticle = buildCandidateGrid(SORIA, { radiusKm: 6, spacingKm: 2 });
    const cell = reticle.find((c) => c.distanceKm > 2.5 && c.distanceKm < 4.5);
    expect(cell).toBeDefined();
    if (!cell) return;

    const hillLat = cell.lat;
    const hillLon = cell.lon + (0.2 * 2) / kmPerDegLon(cell.lat);
    const TURO: ElevationReader = (lon, lat) =>
      approxDistanceKm(lat, lon, hillLat, hillLon) < 0.25 ? 1200 : 1000;

    const { outcome } = await run(SORIA, TURO, {
      refine: false,
      limit: 99,
      minSeparationKm: 0,
    });

    // El candidat d'aquella cel·la ha de ser AL turó, no al centre geomètric.
    const alCim = outcome.results.find(
      (r) => approxDistanceKm(r.lat, r.lon, hillLat, hillLon) < 0.05,
    );
    expect(alCim).toBeDefined();
    expect(alCim?.elevation).toBe(1200);
    // I el punt de retícula original ja no surt: s'ha mogut ell, no s'ha clonat.
    expect(
      outcome.results.some((r) => r.lat === cell.lat && r.lon === cell.lon),
    ).toBe(false);
  });
});

describe('progrés i cancel·lació', () => {
  it('el progrés no retrocedeix mai i acaba a 1', async () => {
    const passos: SpotSearchProgress[] = [];
    await run(SORIA, ALTIPLA, {
      onProgress: (progress) => passos.push(progress),
    });

    expect(passos.length).toBeGreaterThan(3);
    let anterior = -1;
    for (const pas of passos) {
      expect(pas.ratio).toBeGreaterThanOrEqual(anterior - 1e-9);
      expect(pas.ratio).toBeLessThanOrEqual(1);
      // Aquí es comprovava que `pas.message` no fos buit. El camp ja no
      // existeix: era una frase catalana nascuda al nucli i ningú no la
      // pintava (vegeu `SpotSearchProgress`). El que ha de portar el progrés
      // és l'etapa, que és un codi i sí que es pinta traduïda.
      expect(pas.stage.length).toBeGreaterThan(0);
      expect(Number.isFinite(pas.examined)).toBe(true);
      expect(Number.isFinite(pas.alive)).toBe(true);
      anterior = pas.ratio;
    }
    const ultim = passos[passos.length - 1];
    expect(ultim.stage).toBe('done');
    expect(ultim.ratio).toBe(1);
  });

  it('un senyal ja cancel·lat no arrenca la cerca', async () => {
    const controller = new AbortController();
    controller.abort();
    const { pending } = start(SORIA, ALTIPLA, { signal: controller.signal });
    await expect(pending).rejects.toThrow(/cancel/i);
  });

  it('cancel·lar a mitges atura la cerca', async () => {
    const controller = new AbortController();
    const { pending, log } = start(SORIA, ALTIPLA, {
      radiusKm: 25,
      spacingKm: 2,
      signal: controller.signal,
      onProgress: (progress) => {
        if (progress.stage === 'astro') controller.abort();
      },
    });
    await expect(pending).rejects.toThrow(/cancel/i);
    // No s'ha arribat a demanar cap tessel·la: la cancel·lació ha de fer efecte
    // abans de gastar xarxa, que és tot el sentit de poder cancel·lar.
    expect(log.lots).toBe(0);
  });
});
