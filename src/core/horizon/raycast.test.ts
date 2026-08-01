/**
 * Tests de la matemàtica pura del perfil d'horitzó.
 *
 * Aquí NO es baixa cap tessel·la: tot el que es prova és determinista i
 * offline. La part que toca la xarxa (`prefetchTiles`, `computeHorizonProfile`)
 * es prova a mà contra llocs coneguts, no en aquesta bateria.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  apparentAltitudeDeg,
  clipRings,
  computeHorizonProfile,
  curvatureDropM,
  destination,
  effectiveEarthRadiusM,
  ELEVATION_MISMATCH_THRESHOLD_M,
  groundResolutionM,
  horizonDipDeg,
  horizonDistanceM,
  minSampleDistanceM,
  NEAR_FIELD_CELLS,
  ringSignature,
  ringTiles,
  TERRESTRIAL_REFRACTION_K,
} from './raycast';
import { lonLatToTilePixel, releaseTiles } from './elevation';
import {
  flatHorizonProfile,
  horizonAltitudeAt,
  horizonDistanceAt,
  horizonSampler,
  isHorizonProfile,
  maxHorizonAltitude,
  normalizeAzimuth,
  profileFromJson,
  profileToJson,
  HORIZON_PROFILE_VERSION,
  type HorizonProfile,
} from './profile';

const EARTH_RADIUS_M = 6378136.6;

/** Perfil de joguina amb quatre raigs, un per punt cardinal. */
function toyProfile(altitudes: number[], distances?: number[]): HorizonProfile {
  return {
    version: HORIZON_PROFILE_VERSION,
    lat: 41.7665,
    lon: -2.479,
    observerElevation: 1065,
    demElevation: 1065,
    requestedElevation: 1065,
    elevationMismatchM: 0,
    elevationSuspect: false,
    elevationSource: 'dem',
    heightAboveGroundM: 0,
    nearFieldM: 57,
    azimuthStepDeg: 360 / altitudes.length,
    altitudes,
    distancesKm: distances ?? altitudes.map(() => 1),
    maxRangeKm: 150,
    refractionK: TERRESTRIAL_REFRACTION_K,
    ringSignature: 'test',
    coverage: 1,
    computedAtMs: 0,
  };
}

describe('radi efectiu i curvatura', () => {
  it('el radi efectiu amplia el de la Terra un 15% amb k = 0,13', () => {
    expect(effectiveEarthRadiusM()).toBeCloseTo(EARTH_RADIUS_M / 0.87, 0);
    // La refracció terrestre fa "veure" més enllà de l'horitzó geomètric.
    expect(effectiveEarthRadiusM()).toBeGreaterThan(EARTH_RADIUS_M);
  });

  it('sense refracció (k = 0) el radi efectiu és el de la Terra', () => {
    expect(effectiveEarthRadiusM(0)).toBeCloseTo(EARTH_RADIUS_M, 0);
  });

  it('la caiguda per curvatura creix amb el quadrat de la distància', () => {
    expect(curvatureDropM(10_000)).toBeCloseTo(6.8, 1);
    expect(curvatureDropM(25_000)).toBeCloseTo(42.6, 1);
    expect(curvatureDropM(80_000)).toBeCloseTo(436.5, 0);
    // Doblar la distància multiplica la caiguda per quatre.
    expect(curvatureDropM(80_000) / curvatureDropM(40_000)).toBeCloseTo(4, 6);
  });
});

describe('altura aparent del terreny', () => {
  it('un cim a 80 km surt ~0,31° massa alt si s’oblida la curvatura', () => {
    const withCurvature = apparentAltitudeDeg(1500, 700, 80_000);
    const withoutCurvature = (Math.atan2(1500 - 700, 80_000) * 180) / Math.PI;
    const errorDeg = withoutCurvature - withCurvature;

    // Aquest és exactament l'error que faria canviar un veredicte de
    // visibilitat amb el Sol a 3° d'altura.
    expect(errorDeg).toBeGreaterThan(0.3);
    expect(errorDeg).toBeLessThan(0.32);
  });

  it('a poca distància la curvatura amb prou feines es nota', () => {
    const withCurvature = apparentAltitudeDeg(1000, 0, 2000);
    const withoutCurvature = (Math.atan2(1000, 2000) * 180) / Math.PI;
    expect(Math.abs(withoutCurvature - withCurvature)).toBeLessThan(0.01);
  });

  it('dos punts a la mateixa altura: el llunyà es veu per sota de l’horitzontal', () => {
    // No és cap error d'arrodoniment: és la curvatura de la Terra. Un cim de
    // la teva mateixa altura a 30 km ja et queda 61 m avall, 0,12° per sota de
    // l'horitzontal — la meitat del diàmetre aparent del Sol.
    const alt = apparentAltitudeDeg(1000, 1000, 30_000);
    expect(alt).toBeLessThan(0);
    expect(alt).toBeCloseTo(-0.1172, 3);
  });

  it('un punt més baix dona altura negativa', () => {
    expect(apparentAltitudeDeg(0, 1000, 5000)).toBeLessThan(0);
  });

  it('coincideix amb la trigonometria elemental si k anul·la la curvatura', () => {
    // Amb la caiguda restada a mà, ha de donar l'angle geomètric exacte.
    const drop = curvatureDropM(10_000);
    expect(apparentAltitudeDeg(1000 + drop, 0, 10_000)).toBeCloseTo(
      (Math.atan2(1000, 10_000) * 180) / Math.PI,
      9,
    );
  });
});

describe('depressió de l’horitzó', () => {
  it('coincideix amb el màxim de la fórmula d’altura aparent sobre mar', () => {
    const h0 = 232;
    let best = -Infinity;
    for (let d = 1000; d <= 200_000; d += 250) {
      best = Math.max(best, apparentAltitudeDeg(0, h0, d));
    }
    expect(horizonDipDeg(h0)).toBeCloseTo(best, 3);
  });

  it('és negativa i creix amb l’altura de l’observador', () => {
    expect(horizonDipDeg(0)).toBe(-0);
    expect(horizonDipDeg(232)).toBeLessThan(0);
    expect(horizonDipDeg(2000)).toBeLessThan(horizonDipDeg(232));
    // Un observador a 232 m veu l'horitzó marí uns 0,46° per sota.
    expect(horizonDipDeg(232)).toBeCloseTo(-0.4557, 3);
  });

  it('la distància a l’horitzó marí és coherent amb la depressió', () => {
    const h0 = 1065;
    const d = horizonDistanceM(h0);
    // La depressió surt de la fórmula d'angle petit i l'altura aparent d'un
    // atan: coincideixen fins al tercer decimal de grau, que és molt millor que
    // qualsevol cosa que puguem mesurar sobre el terreny.
    expect(apparentAltitudeDeg(0, h0, d)).toBeCloseTo(horizonDipDeg(h0), 3);
    // Des de Sòria (1065 m) l'horitzó marí quedaria a ~125 km.
    expect(d / 1000).toBeCloseTo(125, 0);
  });
});

describe('resolució del terreny per zoom', () => {
  it('z12 dona ~30 m i cada zoom menys el dobla', () => {
    const lat = 42;
    expect(groundResolutionM(12, lat)).toBeGreaterThan(25);
    expect(groundResolutionM(12, lat)).toBeLessThan(32);
    expect(groundResolutionM(11, lat) / groundResolutionM(12, lat)).toBeCloseTo(2, 9);
    expect(groundResolutionM(10, lat) / groundResolutionM(12, lat)).toBeCloseTo(4, 9);
  });

  it('la resolució es contreu amb el cosinus de la latitud', () => {
    expect(groundResolutionM(12, 60)).toBeCloseTo(groundResolutionM(12, 0) * 0.5, 6);
  });
});

describe('desplaçament sobre el cercle màxim', () => {
  /** Metres per grau sobre l'esfera que fem servir. */
  const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180;

  it('cap al nord només canvia la latitud', () => {
    const p = destination(41.7665, -2.479, 0, M_PER_DEG);
    expect(p.lon).toBeCloseTo(-2.479, 9);
    expect(p.lat - 41.7665).toBeCloseTo(1, 6);
  });

  it('cap al sud baixa la latitud', () => {
    const p = destination(41.7665, -2.479, 180, M_PER_DEG);
    expect(p.lat - 41.7665).toBeCloseTo(-1, 6);
  });

  it('cap a l’est des de l’equador manté la latitud', () => {
    const p = destination(0, 0, 90, 500_000);
    expect(p.lat).toBeCloseTo(0, 9);
    expect(p.lon).toBeGreaterThan(0);
  });

  it('a latitud 42 el mateix desplaçament est val més graus de longitud', () => {
    const p = destination(42, 0, 90, 100_000);
    const equator = destination(0, 0, 90, 100_000);
    expect(p.lon).toBeGreaterThan(equator.lon);
    // Els meridians convergeixen: 1/cos(42°) ≈ 1,35.
    expect(p.lon / equator.lon).toBeCloseTo(1 / Math.cos((42 * Math.PI) / 180), 2);
  });

  it('una distància nul·la deixa el punt on era', () => {
    const p = destination(43.3619, -5.8494, 217, 0);
    expect(p.lat).toBeCloseTo(43.3619, 9);
    expect(p.lon).toBeCloseTo(-5.8494, 9);
  });

  it('anar i tornar per l’azimut oposat recupera l’origen', () => {
    const out = destination(41.7665, -2.479, 270, 80_000);
    // A 80 km i latitud mitjana, el rumb invers no és exactament az+180 per la
    // convergència dels meridians; comprovem la distància, no el rumb.
    const back = destination(out.lat, out.lon, 90, 80_000);
    expect(Math.abs(back.lat - 41.7665)).toBeLessThan(0.01);
  });

  it('la longitud es manté dins de [-180, 180]', () => {
    const p = destination(0, 179.9, 90, 100_000);
    expect(p.lon).toBeLessThanOrEqual(180);
    expect(p.lon).toBeGreaterThanOrEqual(-180);
    expect(p.lon).toBeLessThan(0); // ha saltat l'antimeridià
  });
});

describe('interpolació del perfil', () => {
  const profile = toyProfile([0, 10, 20, 30]); // N, E, S, O cada 90°

  it('als azimuts exactes torna el valor del raig', () => {
    expect(horizonAltitudeAt(profile, 0)).toBeCloseTo(0, 9);
    expect(horizonAltitudeAt(profile, 90)).toBeCloseTo(10, 9);
    expect(horizonAltitudeAt(profile, 180)).toBeCloseTo(20, 9);
    expect(horizonAltitudeAt(profile, 270)).toBeCloseTo(30, 9);
  });

  it('interpola linealment entre dos raigs', () => {
    expect(horizonAltitudeAt(profile, 45)).toBeCloseTo(5, 9);
    expect(horizonAltitudeAt(profile, 135)).toBeCloseTo(15, 9);
    expect(horizonAltitudeAt(profile, 22.5)).toBeCloseTo(2.5, 9);
  });

  it('tanca la volta entre l’últim raig i el primer', () => {
    // Entre 270° (30) i 360°=0° (0): a 315° ha de valer 15, no 30 ni 0.
    expect(horizonAltitudeAt(profile, 315)).toBeCloseTo(15, 9);
    expect(horizonAltitudeAt(profile, 359.999)).toBeCloseTo(0, 3);
    expect(horizonAltitudeAt(profile, 360)).toBeCloseTo(horizonAltitudeAt(profile, 0), 9);
  });

  it('és contínua travessant el nord', () => {
    const abans = horizonAltitudeAt(profile, 359.99);
    const despres = horizonAltitudeAt(profile, 0.01);
    expect(Math.abs(abans - despres)).toBeLessThan(0.01);
  });

  it('accepta azimuts negatius i de més d’una volta', () => {
    expect(horizonAltitudeAt(profile, -90)).toBeCloseTo(30, 9);
    expect(horizonAltitudeAt(profile, -45)).toBeCloseTo(15, 9);
    expect(horizonAltitudeAt(profile, 450)).toBeCloseTo(10, 9);
    expect(horizonAltitudeAt(profile, 720 + 180)).toBeCloseTo(20, 9);
  });

  it('funciona amb el pas real de 0,25°', () => {
    const n = 1440;
    const altitudes = Array.from({ length: n }, (_, i) => i * 0.25);
    const fine = toyProfile(altitudes);
    expect(fine.azimuthStepDeg).toBeCloseTo(0.25, 9);
    expect(horizonAltitudeAt(fine, 100)).toBeCloseTo(100, 9);
    expect(horizonAltitudeAt(fine, 100.125)).toBeCloseTo(100.125, 9);
    // L'últim tram torna cap al valor del raig 0.
    expect(horizonAltitudeAt(fine, 359.875)).toBeCloseTo((359.75 + 0) / 2, 9);
  });

  it('un perfil d’un sol raig és constant', () => {
    const flat = toyProfile([7]);
    expect(horizonAltitudeAt(flat, 0)).toBe(7);
    expect(horizonAltitudeAt(flat, 123)).toBe(7);
  });

  it('normalitza els azimuts a [0, 360)', () => {
    expect(normalizeAzimuth(-1)).toBeCloseTo(359, 9);
    expect(normalizeAzimuth(360)).toBe(0);
    expect(normalizeAzimuth(725)).toBeCloseTo(5, 9);
  });
});

describe('distància de l’obstacle', () => {
  const profile = toyProfile([1, 2, 3, 4], [5, 60, 12, 3]);

  it('agafa el raig més proper i no interpola', () => {
    expect(horizonDistanceAt(profile, 90)).toBe(60);
    // A 100° el raig més proper segueix sent el de 90°: mai una mitjana de
    // 60 i 12 km, que no descriuria cap obstacle real.
    expect(horizonDistanceAt(profile, 100)).toBe(60);
    expect(horizonDistanceAt(profile, 140)).toBe(12);
  });

  it('també tanca la volta', () => {
    expect(horizonDistanceAt(profile, 359)).toBe(5);
    expect(horizonDistanceAt(profile, -10)).toBe(5);
  });
});

describe('utilitats del perfil', () => {
  it('troba el punt més alt', () => {
    const top = maxHorizonAltitude(toyProfile([1, 9, 3, 4], [5, 60, 12, 3]));
    expect(top.azimuthDeg).toBe(90);
    expect(top.altitudeDeg).toBe(9);
    expect(top.distanceKm).toBe(60);
  });

  it('el mostrejador és equivalent a cridar horizonAltitudeAt', () => {
    const profile = toyProfile([0, 10, 20, 30]);
    const sample = horizonSampler(profile);
    expect(sample(45)).toBeCloseTo(horizonAltitudeAt(profile, 45), 12);
  });

  it('el perfil pla és optimista i mai amaga el Sol', () => {
    const flat = flatHorizonProfile(41, -2, 700);
    expect(flat.altitudes).toHaveLength(360);
    expect(horizonAltitudeAt(flat, 271.3)).toBe(0);
  });
});

describe('serialització', () => {
  it('sobreviu a una volta per JSON', () => {
    const profile = toyProfile([0, 10, 20, 30]);
    const restored = profileFromJson(profileToJson(profile));
    expect(restored).not.toBeNull();
    expect(restored?.altitudes).toEqual(profile.altitudes);
    expect(restored?.lat).toBe(profile.lat);
  });

  it('rebutja versions antigues i objectes que no ho són', () => {
    const stale = { ...toyProfile([1, 2, 3, 4]), version: 0 };
    expect(isHorizonProfile(stale)).toBe(false);
    expect(isHorizonProfile(null)).toBe(false);
    expect(isHorizonProfile({})).toBe(false);
    expect(profileFromJson('{{no és json')).toBeNull();
  });

  it('rebutja perfils amb altures no finites', () => {
    const broken = toyProfile([1, Number.NaN, 3, 4]);
    expect(isHorizonProfile(broken)).toBe(false);
  });
});

describe('camp proper', () => {
  it('la distància mínima surt de la resolució del model, no d’un número fix', () => {
    const lat = 43.3619;
    expect(minSampleDistanceM(12, lat)).toBeCloseTo(
      NEAR_FIELD_CELLS * groundResolutionM(12, lat),
      9,
    );
    // A z12 i latitud asturiana són uns 57 m.
    expect(minSampleDistanceM(12, lat)).toBeGreaterThan(50);
    expect(minSampleDistanceM(12, lat)).toBeLessThan(65);
  });

  it('creix quan el model és més gruixut', () => {
    expect(minSampleDistanceM(10, 43)).toBeCloseTo(minSampleDistanceM(12, 43) * 4, 6);
  });
});

/**
 * REGRESSIÓ del bug d'Oviedo.
 *
 * Símptoma: el perfil sortia pla a ~11,4° en TOTS els azimuts i el veredicte
 * deia "el terreny tapa la totalitat sencera, obstacle a 0,0 km".
 *
 * Causa: h0 venia d'una cota escrita a mà (232 m) mentre que el terreny es
 * llegia del model, que allà en dona una altra. Amb 10 m de desacord, la
 * mostra més propera del raig dona atan(10/50) ≈ 11°, i com que és la que té
 * el braç de palanca més curt guanya el màxim de tots els azimuts.
 *
 * Cap accés a la xarxa: `fetch`, `createImageBitmap` i `OffscreenCanvas` són
 * postissos que fabriquen tessel·les terrarium d'un terreny pla conegut.
 */
describe('regressió: origen vertical autoconsistent amb el model', () => {
  const OBSERVER = { lat: 43.3619, lon: -5.8494 };
  /** Cota que dona el model sintètic a tot arreu. */
  const DEM_ELEVATION = 240;

  /** Una sola tessel·la de terreny pla, reaprofitada per a totes. */
  const flatTile = (() => {
    const size = 256;
    const data = new Uint8ClampedArray(size * size * 4);
    const v = DEM_ELEVATION + 32768;
    for (let i = 0; i < size * size; i++) {
      data[i * 4] = Math.floor(v / 256);
      data[i * 4 + 1] = Math.floor(v) % 256;
      data[i * 4 + 2] = Math.round((v - Math.floor(v)) * 256);
      data[i * 4 + 3] = 255;
    }
    return { data, width: size, height: size };
  })();

  const globals = globalThis as unknown as Record<string, unknown>;
  const original = {
    fetch: globals.fetch,
    createImageBitmap: globals.createImageBitmap,
    OffscreenCanvas: globals.OffscreenCanvas,
  };

  beforeEach(() => {
    releaseTiles();
    globals.fetch = async () => ({ ok: true, status: 200, blob: async () => ({}) });
    globals.createImageBitmap = async () => ({ close() {} });
    globals.OffscreenCanvas = class {
      // Sense propietats de paràmetre: `erasableSyntaxOnly` no les permet.
      width = 256;
      height = 256;
      getContext() {
        return { drawImage: () => {}, getImageData: () => flatTile };
      }
    };
  });

  afterAll(() => {
    releaseTiles();
    globals.fetch = original.fetch;
    globals.createImageBitmap = original.createImageBitmap;
    globals.OffscreenCanvas = original.OffscreenCanvas;
  });

  /** Anells petits: només volem el camp proper, que és on era el bug. */
  const options = {
    azimuthStepDeg: 10,
    rings: [{ maxDistanceKm: 2, zoom: 12 }],
  };

  it('NO fabrica un horitzó pla de 11° quan l’altitud rebuda va 10 m per sota del model', async () => {
    const profile = await computeHorizonProfile(
      { ...OBSERVER, elevation: DEM_ELEVATION - 10 },
      options,
    );

    const top = maxHorizonAltitude(profile);

    // Amb el bug, això valia ~11,4°. Amb h0 tret del mateix model que el
    // terreny, un pla a l'altura dels teus peus t'ha de tapar just a 0°: ni un
    // mur inventat ni res per sota.
    expect(top.altitudeDeg).toBeLessThan(0.01);
    expect(top.altitudeDeg).toBeGreaterThan(-0.05);

    // I terreny pla vol dir perfil pla: cap azimut es pot desmarcar.
    const spread = Math.max(...profile.altitudes) - Math.min(...profile.altitudes);
    expect(spread).toBeLessThan(0.01);
  });

  it('pren h0 del model i no del que li han passat', async () => {
    const profile = await computeHorizonProfile(
      { ...OBSERVER, elevation: DEM_ELEVATION - 10 },
      options,
    );
    expect(profile.demElevation).toBeCloseTo(DEM_ELEVATION, 3);
    expect(profile.observerElevation).toBeCloseTo(DEM_ELEVATION, 3);
    expect(profile.requestedElevation).toBe(DEM_ELEVATION - 10);
    expect(profile.elevationMismatchM).toBeCloseTo(-10, 3);
    expect(profile.elevationSource).toBe('dem');
    expect(profile.coverage).toBe(1);
  });

  it('l’altura sobre el terra és un desplaçament, no una altitud absoluta', async () => {
    const profile = await computeHorizonProfile(
      { ...OBSERVER, elevation: 0 },
      { ...options, eyeHeightM: 25 },
    );
    expect(profile.observerElevation).toBeCloseTo(DEM_ELEVATION + 25, 3);
    expect(profile.heightAboveGroundM).toBe(25);
    // Enfilat 25 m per damunt del pla, l'horitzó baixa una mica més.
    expect(maxHorizonAltitude(profile).altitudeDeg).toBeCloseTo(
      horizonDipDeg(DEM_ELEVATION + 25),
      2,
    );
  });

  it('marca com a sospitosa una altitud que no quadra amb el model', async () => {
    const bad = await computeHorizonProfile(
      { ...OBSERVER, elevation: DEM_ELEVATION - 40 },
      options,
    );
    expect(bad.elevationSuspect).toBe(true);
    // El perfil segueix sent bo tot i l'avís: h0 no venia d'aquella xifra.
    expect(maxHorizonAltitude(bad).altitudeDeg).toBeLessThan(0.1);

    const good = await computeHorizonProfile(
      { ...OBSERVER, elevation: DEM_ELEVATION + ELEVATION_MISMATCH_THRESHOLD_M - 1 },
      options,
    );
    expect(good.elevationSuspect).toBe(false);
  });

  it('no mostreja per sota del camp proper', async () => {
    const profile = await computeHorizonProfile(
      { ...OBSERVER, elevation: DEM_ELEVATION },
      options,
    );
    expect(profile.nearFieldM).toBeCloseTo(
      minSampleDistanceM(12, OBSERVER.lat),
      6,
    );
    expect(profile.nearFieldM).toBeGreaterThan(groundResolutionM(12, OBSERVER.lat));
  });
});

describe('configuració d’anells', () => {
  it('la signatura canvia si canvia qualsevol paràmetre', () => {
    const base = ringSignature(
      [{ maxDistanceKm: 150, zoom: 10 }],
      0.25,
      TERRESTRIAL_REFRACTION_K,
    );
    expect(base).not.toBe(
      ringSignature([{ maxDistanceKm: 150, zoom: 11 }], 0.25, TERRESTRIAL_REFRACTION_K),
    );
    expect(base).not.toBe(
      ringSignature([{ maxDistanceKm: 150, zoom: 10 }], 0.5, TERRESTRIAL_REFRACTION_K),
    );
    expect(base).not.toBe(
      ringSignature([{ maxDistanceKm: 150, zoom: 10 }], 0.25, 0.25),
    );
  });

  it('la signatura no depèn de l’ordre en què arriben els anells', () => {
    const a = ringSignature(
      [
        { maxDistanceKm: 40, zoom: 11 },
        { maxDistanceKm: 10, zoom: 12 },
      ],
      0.25,
      0.13,
    );
    const b = ringSignature(
      [
        { maxDistanceKm: 10, zoom: 12 },
        { maxDistanceKm: 40, zoom: 11 },
      ],
      0.25,
      0.13,
    );
    expect(a).toBe(b);
  });

  it('retallar el radi elimina els anells que queden fora', () => {
    const clipped = clipRings(25);
    expect(clipped).toHaveLength(2);
    expect(clipped[0]).toEqual({ maxDistanceKm: 10, zoom: 12 });
    expect(clipped[1]).toEqual({ maxDistanceKm: 25, zoom: 11 });
  });

  it('un radi més gran que el màxim deixa els anells intactes', () => {
    expect(clipRings(500)).toHaveLength(3);
  });
});

describe('sector d’azimut de ringTiles', () => {
  /*
   * PER QUÈ HI ÉS. El garbell del cercador de llocs només llegeix ±4° al
   * voltant de l'azimut del Sol, però baixava els 360° sencers d'una corona de
   * 40 km. Ara `ringTiles` accepta el sector. La prova que importa no és que en
   * baixi menys —això és fàcil i és fàcil fer-ho malament—, sinó que no en
   * falti ni una de les que els raigs travessaran: un forat al perfil no es
   * veu, es converteix en un horitzó més baix i en segons de totalitat que
   * l'app promet i el terreny es menja.
   */
  const LAT = 41.7665;
  const LON = -2.479;
  const RING = { zoom: 11, innerM: 0, outerM: 40_000 };

  it('no perd cap tessel·la que un raig del sector travessi', () => {
    const centre = 265;
    const half = 4;
    const wedge = ringTiles(LAT, LON, RING, {
      centreAzimuthDeg: centre,
      halfWidthDeg: half,
    });
    const have = new Set(wedge.map((t) => `${t.z}/${t.x}/${t.y}`));

    for (let az = centre - half; az <= centre + half; az += 0.25) {
      for (let m = 100; m <= RING.outerM; m += 250) {
        const point = destination(LAT, LON, az, m);
        const { z, x, y } = lonLatToTilePixel(point.lon, point.lat, RING.zoom);
        expect(have.has(`${z}/${x}/${y}`)).toBe(true);
      }
    }
  });

  it('és un subconjunt estricte del disc sencer', () => {
    const full = ringTiles(LAT, LON, RING);
    const wedge = ringTiles(LAT, LON, RING, {
      centreAzimuthDeg: 265,
      halfWidthDeg: 4,
    });
    const inFull = new Set(full.map((t) => `${t.z}/${t.x}/${t.y}`));
    for (const tile of wedge) {
      expect(inFull.has(`${tile.z}/${tile.x}/${tile.y}`)).toBe(true);
    }
    expect(wedge.length).toBeLessThan(full.length);
  });

  it('un sector de 180° per banda torna el disc sencer', () => {
    const full = ringTiles(LAT, LON, RING);
    const all = ringTiles(LAT, LON, RING, {
      centreAzimuthDeg: 0,
      halfWidthDeg: 180,
    });
    expect(all.length).toBe(full.length);
  });
});
