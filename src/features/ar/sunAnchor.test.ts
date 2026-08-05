/**
 * L'àncora de Sol, mesurada.
 *
 * Mateixa filosofia que el banc de la silueta: es pinta la imatge que la
 * càmera veuria amb la MATEIXA projecció que fa servir l'app (una taca de
 * bloom gaussiana clavada on el Sol projecta), i es demana al detector que
 * recuperi la postura partint d'una de dolenta. Valors en 0-1 a posta: el
 * detector ha de ser cec a l'escala del fotograma, perquè al mòbil arriba en
 * 0-255 i ningú no ho promet enlloc.
 */

import { describe, expect, it } from 'vitest';
import {
  detectSunBlob,
  fitSunFix,
  sunFixFrom,
  crescentCentroidOffsetDeg,
  expectedBrightBody,
  mergeAnchors,
  acceptRefinedPeak,
  SunTemporalGuide,
  refineSunCrop,
} from './sunAnchor';
import {
  projectToScreen,
  unprojectFromScreen,
  angularSeparationDeg,
  type CameraPointing,
} from './orientation';
import type { Viewport } from './cameraGeometry';
import type { TrackerGeometry } from './visualTracker';
import type { SkylineFix } from './skyline';
import type { EclipseSample, SkyPosition } from '../../core/astro/types';
import { intensityAtRadiusFraction } from '../../core/sky/solarDisc';
import { normalizeDelta } from './poseFusion';

const CALIBRATION = { azimuthOffset: 0, altitudeOffset: 0, sensorFovDeg: 66 };

const VIEWPORT: Viewport = { width: 390, height: 640, focalPx: 340 };

const GEOMETRY: TrackerGeometry = {
  gridWidth: 88,
  gridHeight: 176,
  scaleX: VIEWPORT.width / 88,
  scaleY: VIEWPORT.height / 176,
  focalPx: VIEWPORT.focalPx,
};

function pointing(azimuth: number, altitude: number, roll = 0): CameraPointing {
  return { azimuth, altitude, roll, screenAngle: 0 };
}

function skyPos(azimuth: number, altitude: number, angularRadius = 0.266): SkyPosition {
  return {
    azimuth,
    altitudeTrue: altitude,
    altitudeApparent: altitude,
    ra: 0,
    dec: 0,
    distanceAu: 1,
    angularRadius,
  };
}

/** Mostra d'eclipsi sintètica: Sol i Lluna on es digui. */
function sample(
  sun: SkyPosition,
  moon: SkyPosition,
  separationDeg: number,
): EclipseSample {
  return {
    time: new Date(0),
    sun,
    moon,
    separation: separationDeg,
    magnitude: 0,
    obscuration: 0,
  };
}

/** Sense eclipsi: la Lluna ben lluny. */
function clearSample(sun: SkyPosition): EclipseSample {
  return sample(sun, skyPos(sun.azimuth + 90, sun.altitudeApparent), 90);
}

interface BlobSpec {
  azimuth: number;
  altitude: number;
  amplitude: number;
  sigmaGridPx: number;
}

/**
 * Pinta el fotograma: cel amb gradient vertical suau + taques de bloom
 * gaussianes clavades on cada cos projecta amb la càmera VERTADERA.
 */
function renderSunGray(
  camera: CameraPointing,
  blobs: readonly BlobSpec[],
  options: { noiseAmplitude?: number; seed?: number } = {},
): Float32Array {
  const { gridWidth: w, gridHeight: h } = GEOMETRY;
  const gray = new Float32Array(w * h);
  const noise = options.noiseAmplitude ?? 0;
  let s = (options.seed ?? 7) >>> 0;
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };

  // Posicions de les taques en coordenades de GRAELLA.
  const centres = blobs
    .map((b) => {
      const p = projectToScreen(b.azimuth, b.altitude, camera, CALIBRATION, VIEWPORT);
      return p.visible
        ? {
            gx: (p.x - VIEWPORT.width / 2) / GEOMETRY.scaleX + w / 2 - 0.5,
            gy: (p.y - VIEWPORT.height / 2) / GEOMETRY.scaleY + h / 2 - 0.5,
            amplitude: b.amplitude,
            sigma: b.sigmaGridPx,
          }
        : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      // Cel una mica més clar amunt, com un capvespre de debò.
      let v = 0.72 - 0.15 * (gy / h);
      for (const c of centres) {
        const d2 = (gx - c.gx) ** 2 + (gy - c.gy) ** 2;
        v += c.amplitude * Math.exp(-d2 / (2 * c.sigma * c.sigma));
      }
      if (noise > 0) v += (rnd() - 0.5) * 2 * noise;
      gray[gy * w + gx] = Math.min(1, Math.max(0, v));
    }
  }
  return gray;
}

/** Posició en graella del punt simètric respecte del centre òptic. */
function mirroredBlob(camera: CameraPointing, of: BlobSpec, amplitude: number): BlobSpec {
  const p = projectToScreen(of.azimuth, of.altitude, camera, CALIBRATION, VIEWPORT);
  const mx = VIEWPORT.width - p.x;
  const my = VIEWPORT.height - p.y;
  const ray = unprojectFromScreen(mx, my, camera, CALIBRATION, VIEWPORT);
  return { azimuth: ray.azimuth, altitude: ray.altitude, amplitude, sigmaGridPx: of.sigmaGridPx };
}

describe('la detecció de la taca del Sol', () => {
  it('clava el centroide per sota de 0,15° a diverses posicions i mides', () => {
    for (const [dAz, dAlt] of [
      [0, 0],
      [8, 3],
      [-10, -4],
      [5, 8],
    ]) {
      for (const sigma of [0.7, 1.0, 1.6]) {
        const camera = pointing(250, 10);
        const sunAz = 250 + dAz;
        const sunAlt = 10 + dAlt;
        const gray = renderSunGray(camera, [
          { azimuth: sunAz, altitude: sunAlt, amplitude: 1, sigmaGridPx: sigma },
        ]);
        const blob = detectSunBlob(gray, GEOMETRY, VIEWPORT, null);
        expect(blob, `σ=${sigma} a ${dAz},${dAlt}`).not.toBeNull();
        const ray = unprojectFromScreen(blob!.screenX, blob!.screenY, camera, CALIBRATION, VIEWPORT);
        // Amb un bloom de menys d'un píxel el nucli són 2-3 píxels que a més
        // retallen tots a 1,0 (pesos uniformes): la quantització de la
        // graella i el gradient del cel manen (~0,2°). És el sòl físic del
        // pas coarse i el motiu pel qual el refinador d'alta resolució
        // existeix. Amb el bloom normal (σ ≥ 1) es demana el llistó alt.
        const limit = sigma < 1 ? 0.25 : 0.15;
        expect(
          angularSeparationDeg(ray.azimuth, ray.altitude, sunAz, sunAlt),
          `σ=${sigma} a ${dAz},${dAlt}`,
        ).toBeLessThan(limit);
      }
    }
  });

  it('amb un fotograma uniforme o de soroll no s’inventa cap Sol', () => {
    const flat = new Float32Array(GEOMETRY.gridWidth * GEOMETRY.gridHeight).fill(0.5);
    expect(detectSunBlob(flat, GEOMETRY, VIEWPORT, null)).toBeNull();

    const camera = pointing(250, 10);
    const noisy = renderSunGray(camera, [], { noiseAmplitude: 0.1, seed: 3 });
    const blob = detectSunBlob(noisy, GEOMETRY, VIEWPORT, null);
    // Si el soroll produeix cap taqueta d'un píxel, el fix l'ha de rebutjar.
    if (blob !== null) {
      const fix = fitSunFix(blob, skyPos(250, 10), camera, CALIBRATION, VIEWPORT);
      expect(fix).toBeNull();
    }
  });

  it('un píxel calent prop de la predicció no pot apartar un Sol vàlid', () => {
    const camera = pointing(250, 10);
    const gray = renderSunGray(camera, [
      { azimuth: 244, altitude: 13, amplitude: 1, sigmaGridPx: 1 },
    ]);
    const predicted = projectToScreen(250, 10, camera, CALIBRATION, VIEWPORT);
    const hotGridX = Math.round(
      (predicted.x - VIEWPORT.width / 2) / GEOMETRY.scaleX + GEOMETRY.gridWidth / 2 - 0.5,
    );
    const hotGridY = Math.round(
      (predicted.y - VIEWPORT.height / 2) / GEOMETRY.scaleY + GEOMETRY.gridHeight / 2 - 0.5,
    );
    gray[hotGridY * GEOMETRY.gridWidth + hotGridX] = 1;

    const blob = detectSunBlob(gray, GEOMETRY, VIEWPORT, { x: predicted.x, y: predicted.y });
    expect(blob).not.toBeNull();
    expect(blob!.areaPx).toBeGreaterThanOrEqual(2);
    const ray = unprojectFromScreen(blob!.screenX, blob!.screenY, camera, CALIBRATION, VIEWPORT);
    expect(angularSeparationDeg(ray.azimuth, ray.altitude, 244, 13)).toBeLessThan(0.3);
  });

  it('una vela difusa no passa: el cel cremat sencer no és cap Sol', () => {
    const camera = pointing(250, 10);
    const gray = renderSunGray(camera, [
      { azimuth: 250, altitude: 12, amplitude: 1, sigmaGridPx: 5 },
    ]);
    expect(detectSunBlob(gray, GEOMETRY, VIEWPORT, null)).toBeNull();
  });

  it('el fantasma de lent, simètric pel centre, no confon ni degrada', () => {
    const camera = pointing(250, 10);
    const sun: BlobSpec = { azimuth: 244, altitude: 14, amplitude: 1, sigmaGridPx: 1 };
    const gray = renderSunGray(camera, [sun, mirroredBlob(camera, sun, 0.9)]);
    const blob = detectSunBlob(gray, GEOMETRY, VIEWPORT, null);
    expect(blob).not.toBeNull();
    expect(blob!.ambiguous).toBe(false);
    const ray = unprojectFromScreen(blob!.screenX, blob!.screenY, camera, CALIBRATION, VIEWPORT);
    expect(angularSeparationDeg(ray.azimuth, ray.altitude, 244, 14)).toBeLessThan(0.2);
  });

  it('dos candidats semblants NO simètrics: sense predicció calla, amb predicció dubta', () => {
    const camera = pointing(250, 10);
    // El segon és al MATEIX costat vertical: fora de la recta pel centre
    // òptic — cap fantasma de lent no cau allà.
    const gray = renderSunGray(camera, [
      { azimuth: 245, altitude: 12, amplitude: 1, sigmaGridPx: 1 },
      { azimuth: 256, altitude: 14, amplitude: 1, sigmaGridPx: 1 },
    ]);
    expect(detectSunBlob(gray, GEOMETRY, VIEWPORT, null)).toBeNull();

    const predicted = projectToScreen(245, 12, camera, CALIBRATION, VIEWPORT);
    const blob = detectSunBlob(gray, GEOMETRY, VIEWPORT, { x: predicted.x, y: predicted.y });
    expect(blob).not.toBeNull();
    expect(blob!.ambiguous).toBe(true);
    const ray = unprojectFromScreen(blob!.screenX, blob!.screenY, camera, CALIBRATION, VIEWPORT);
    expect(angularSeparationDeg(ray.azimuth, ray.altitude, 245, 12)).toBeLessThan(0.3);
  });
});

describe('la memòria temporal del Sol', () => {
  function temporalFix(deltaAzimuthDeg: number, deltaAltitudeDeg: number): SkylineFix {
    return {
      azimuthDeg: 250 + deltaAzimuthDeg,
      altitudeDeg: 10 + deltaAltitudeDeg,
      deltaAzimuthDeg,
      deltaAltitudeDeg,
      rmsPx: 1,
      used: 6,
      confidence: 0.8,
      altitudeOnly: false,
    };
  }

  it('no guia fins que tres fotogrames concordants confirmen el lock', () => {
    const guide = new SunTemporalGuide();
    const camera = pointing(260, 11, 17);
    guide.observe(temporalFix(-10, -1), 1_000);
    guide.observe(temporalFix(-9.9, -1.1), 1_033);
    expect(guide.correctedCamera(camera, 1_040)).toBeNull();

    guide.observe(temporalFix(-10.1, -0.9), 1_066);
    const corrected = guide.correctedCamera(camera, 1_070);
    expect(corrected).not.toBeNull();
    expect(Math.abs(normalizeDelta(corrected!.azimuth - 250))).toBeLessThan(0.15);
    expect(Math.abs(corrected!.altitude - 10)).toBeLessThan(0.15);
    expect(corrected!.roll).toBe(17);
  });

  it('caduca durant una ocultació i reset elimina qualsevol pista', () => {
    const guide = new SunTemporalGuide();
    for (let i = 0; i < 3; i++) guide.observe(temporalFix(4, 0.5), 2_000 + i * 33);
    expect(guide.correctedCamera(pointing(250, 10), 2_100)).not.toBeNull();
    expect(guide.correctedCamera(pointing(250, 10), 2_800)).toBeNull();

    for (let i = 0; i < 3; i++) guide.observe(temporalFix(4, 0.5), 3_000 + i * 33);
    guide.reset();
    expect(guide.correctedCamera(pointing(250, 10), 3_100)).toBeNull();
  });

  it('un salt incompatible inicia una adquisició nova en comptes d’arrossegar el lock', () => {
    const guide = new SunTemporalGuide();
    for (let i = 0; i < 3; i++) guide.observe(temporalFix(-8, 0), 4_000 + i * 33);
    expect(guide.correctedCamera(pointing(258, 10), 4_100)).not.toBeNull();

    guide.observe(temporalFix(3, 0), 4_133);
    expect(guide.correctedCamera(pointing(247, 10), 4_140)).toBeNull();
    guide.observe(temporalFix(3.1, 0), 4_166);
    guide.observe(temporalFix(2.9, 0), 4_199);
    const reacquired = guide.correctedCamera(pointing(247, 10), 4_200);
    expect(reacquired).not.toBeNull();
    expect(Math.abs(normalizeDelta(reacquired!.azimuth - 250))).toBeLessThan(0.15);
  });

  it('els misses no inventen cap observació ni allarguen la frescor', () => {
    const guide = new SunTemporalGuide();
    for (let i = 0; i < 3; i++) guide.observe(temporalFix(2, 0), 5_000 + i * 33);
    guide.observe(null, 5_500);
    guide.observe(null, 5_700);
    expect(guide.correctedCamera(pointing(248, 10), 5_800)).toBeNull();
  });

  it('un candidat ambigu o una mostra fora d’ordre no poden ensenyar la guia', () => {
    const guide = new SunTemporalGuide();
    const doubtful = { ...temporalFix(5, 0), confidence: 0.5 };
    guide.observe(doubtful, 5_000);
    guide.observe(doubtful, 5_033);
    guide.observe(doubtful, 5_066);
    expect(guide.correctedCamera(pointing(245, 10), 5_100)).toBeNull();

    guide.observe(temporalFix(2, 0), 6_000);
    guide.observe(temporalFix(2, 0), 5_999);
    guide.observe(temporalFix(2, 0), 6_033);
    expect(guide.correctedCamera(pointing(248, 10), 6_040)).toBeNull();
    guide.observe(temporalFix(2, 0), 6_066);
    expect(guide.correctedCamera(pointing(248, 10), 6_070)).not.toBeNull();
  });

  it('desempata un reflex nou després del lock sense deixar de cercar tota la imatge', () => {
    const guide = new SunTemporalGuide();
    const truth = pointing(250, 10);
    const sensor = pointing(258, 10);
    const sun = skyPos(250, 12);

    // Primer, tres fotogrames nets adquireixen el Sol i aprenen els −8° de
    // biaix. El fix és el mateix camí real que usa ARView, no una drecera.
    for (let i = 0; i < 3; i++) {
      const clean = renderSunGray(truth, [
        { azimuth: sun.azimuth, altitude: sun.altitudeApparent, amplitude: 1, sigmaGridPx: 1 },
      ]);
      const blob = detectSunBlob(clean, GEOMETRY, VIEWPORT, null);
      guide.observe(fitSunFix(blob!, sun, sensor, CALIBRATION, VIEWPORT), 6_000 + i * 33);
    }

    const guidedCamera = guide.correctedCamera(sensor, 6_100);
    expect(guidedCamera).not.toBeNull();
    const expected = projectToScreen(
      sun.azimuth,
      sun.altitudeApparent,
      guidedCamera!,
      CALIBRATION,
      VIEWPORT,
    );

    // Apareix una taca rival just on la brúixola CRUA hauria posat el Sol.
    // El detector continua veient les dues a la graella completa, però la
    // predicció temporal fa guanyar la que ha mantingut la trajectòria.
    const rawExpectedRay = unprojectFromScreen(
      projectToScreen(sun.azimuth, sun.altitudeApparent, sensor, CALIBRATION, VIEWPORT).x,
      projectToScreen(sun.azimuth, sun.altitudeApparent, sensor, CALIBRATION, VIEWPORT).y,
      truth,
      CALIBRATION,
      VIEWPORT,
    );
    const withRival = renderSunGray(truth, [
      { azimuth: sun.azimuth, altitude: sun.altitudeApparent, amplitude: 1, sigmaGridPx: 1 },
      {
        azimuth: rawExpectedRay.azimuth,
        altitude: rawExpectedRay.altitude,
        amplitude: 0.95,
        sigmaGridPx: 1,
      },
    ]);
    const chosen = detectSunBlob(withRival, GEOMETRY, VIEWPORT, { x: expected.x, y: expected.y });
    expect(chosen).not.toBeNull();
    const chosenRay = unprojectFromScreen(
      chosen!.screenX,
      chosen!.screenY,
      truth,
      CALIBRATION,
      VIEWPORT,
    );
    expect(
      angularSeparationDeg(
        chosenRay.azimuth,
        chosenRay.altitude,
        sun.azimuth,
        sun.altitudeApparent,
      ),
    ).toBeLessThan(0.3);
  });
});

describe('el refinament full-resolution', () => {
  function cropWithDiscs(
    width: number,
    height: number,
    discs: Array<{ x: number; y: number; radius: number; value: number }>,
  ): Uint8ClampedArray {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let value = 40;
        for (const disc of discs) {
          if (Math.hypot(x - disc.x, y - disc.y) <= disc.radius) value = disc.value;
        }
        const i = (y * width + x) * 4;
        rgba[i] = value;
        rgba[i + 1] = value;
        rgba[i + 2] = value;
        rgba[i + 3] = 255;
      }
    }
    return rgba;
  }

  it('tria el component del candidat i mai el punt mig entre Sol i reflex', () => {
    const rgba = cropWithDiscs(32, 32, [
      { x: 10, y: 16, radius: 2, value: 255 },
      { x: 23, y: 16, radius: 2, value: 255 },
    ]);
    const refined = refineSunCrop(rgba, 32, 32, { x: 10.5, y: 16 });
    expect(refined).not.toBeNull();
    expect(Math.abs(refined!.x - 10)).toBeLessThan(0.1);
    expect(Math.abs(refined!.y - 16)).toBeLessThan(0.1);
    expect(refined!.areaPx).toBe(13);
  });

  it('el pic retornat pertany al component triat, no a una taca aliena', () => {
    const rgba = cropWithDiscs(32, 32, [
      { x: 9, y: 14, radius: 2, value: 250 },
      { x: 24, y: 18, radius: 2, value: 255 },
    ]);
    const refined = refineSunCrop(rgba, 32, 32, { x: 9, y: 14 });
    expect(refined).not.toBeNull();
    expect(refined!.peak).toBeCloseTo(250, 5);
    expect(refined!.x).toBeCloseTo(9, 5);
  });

  it('tolera components units només en diagonal i retalls invàlids callen', () => {
    const rgba = cropWithDiscs(8, 8, [
      { x: 3, y: 3, radius: 0, value: 255 },
      { x: 4, y: 4, radius: 0, value: 255 },
    ]);
    const refined = refineSunCrop(rgba, 8, 8, { x: 3.5, y: 3.5 });
    expect(refined).not.toBeNull();
    expect(refined!.areaPx).toBe(2);
    expect(refineSunCrop(new Uint8ClampedArray(3), 8, 8, { x: 4, y: 4 })).toBeNull();
  });

  it('un píxel calent al centre no guanya el bloom solar del mateix retall', () => {
    const rgba = cropWithDiscs(32, 32, [
      { x: 16, y: 16, radius: 0, value: 255 },
      { x: 21, y: 16, radius: 2, value: 255 },
    ]);
    const refined = refineSunCrop(rgba, 32, 32, { x: 16, y: 16 });
    expect(refined).not.toBeNull();
    expect(refined!.x).toBeCloseTo(21, 5);
    expect(refined!.areaPx).toBe(13);
  });
});

describe('el fix de Sol recupera la brúixola', () => {
  function recover(errorAz: number, errorAlt: number, roll = 0) {
    const truth = pointing(250, 10, roll);
    const gray = renderSunGray(truth, [
      { azimuth: 250, altitude: 12, amplitude: 1, sigmaGridPx: 1 },
    ]);
    const sensor = pointing(250 + errorAz, 10 + errorAlt, roll);
    const blob = detectSunBlob(gray, GEOMETRY, VIEWPORT, null);
    expect(blob).not.toBeNull();
    // El blob s'ha pintat amb la veritat però es desprojecta amb el SENSOR:
    // la diferència és exactament l'error que el fix ha de denunciar.
    return sunFixFrom(blob, sensor, CALIBRATION, VIEWPORT, clearSample(skyPos(250, 12)));
  }

  it('un error de brúixola de deu graus es recupera per sota de 0,3°', () => {
    const fix = recover(10, 0);
    expect(fix).not.toBeNull();
    expect(Math.abs(normalizeDelta(fix!.azimuthDeg - 250))).toBeLessThan(0.3);
    expect(fix!.altitudeOnly).toBe(false);
    expect(fix!.confidence).toBeGreaterThan(0.5);
  });

  it('errors combinats i amb el canell girat també', () => {
    const fix = recover(-7, 2, 20);
    expect(fix).not.toBeNull();
    expect(Math.abs(normalizeDelta(fix!.azimuthDeg - 250))).toBeLessThan(0.4);
    expect(Math.abs(fix!.altitudeDeg - 10)).toBeLessThan(0.4);
  });

  it('més enllà de la plausibilitat, res: 30° no és biaix, és un fanal', () => {
    expect(recover(30, 0)).toBeNull();
    expect(recover(0, 5)).toBeNull();
  });

  it('si el terreny tapa el Sol segons el model, la taca no ancora', () => {
    const truth = pointing(250, 10);
    const gray = renderSunGray(truth, [
      { azimuth: 250, altitude: 5, amplitude: 1, sigmaGridPx: 1 },
    ]);
    const blob = detectSunBlob(gray, GEOMETRY, VIEWPORT, null);
    expect(blob).not.toBeNull();
    const fix = sunFixFrom(
      blob,
      truth,
      CALIBRATION,
      VIEWPORT,
      clearSample(skyPos(250, 5)),
      () => 10, // la carena és a 10°: el Sol de debò no es pot veure
    );
    expect(fix).toBeNull();
  });

  it('de nit no es busca res', () => {
    const blob = {
      screenX: 100,
      screenY: 100,
      areaPx: 6,
      peak: 1,
      compactness: 1,
      ambiguous: false,
    };
    expect(
      fitSunFix(blob, skyPos(250, -3), pointing(250, 10), CALIBRATION, VIEWPORT),
    ).toBeNull();
  });
});

describe('el creixent de l’eclipsi', () => {
  /**
   * Integració 2D directa del centroide de llum, per validar la radial: malla
   * fina sobre el disc solar, excloent el que tapa la Lluna, pesada per
   * l'enfosquiment de vora. En unitats de radi solar, sobre l'eix cap a la
   * Lluna.
   */
  function centroid2D(separationRs: number, moonRadiusRs: number): number {
    const N = 500;
    let sumW = 0;
    let sumWX = 0;
    for (let iy = 0; iy < N; iy++) {
      const y = -1 + (2 * (iy + 0.5)) / N;
      for (let ix = 0; ix < N; ix++) {
        const x = -1 + (2 * (ix + 0.5)) / N;
        const r = Math.hypot(x, y);
        if (r > 1) continue;
        if (Math.hypot(x - separationRs, y) <= moonRadiusRs) continue;
        const w = intensityAtRadiusFraction(r);
        sumW += w;
        sumWX += w * x;
      }
    }
    return sumW > 0 ? sumWX / sumW : 0;
  }

  it('coincideix amb la integració 2D directa', () => {
    const rs = 0.266;
    for (const [sepRs, moonRs] of [
      [0.8, 1.0],
      [0.5, 1.05],
      [1.2, 0.95],
    ]) {
      const sun = skyPos(250, 10, rs);
      const moon = skyPos(250, 10 + sepRs * rs, rs * moonRs);
      const s = sample(sun, moon, sepRs * rs);
      const got = crescentCentroidOffsetDeg(s);
      // La Lluna és amunt: el centre de llum fuig cap avall. L'eix és
      // vertical, o sigui que tot el desplaçament és d'altura.
      const expected = centroid2D(sepRs, moonRs) * rs;
      expect(Math.abs(got.dAltDeg - expected), `sep ${sepRs} rm ${moonRs}`).toBeLessThan(0.012);
      expect(Math.abs(got.dAzDeg)).toBeLessThan(1e-6);
      expect(got.dAltDeg).toBeLessThan(0); // fugint de la Lluna
    }
  });

  it('sense solapament, cap desplaçament', () => {
    const sun = skyPos(250, 10);
    const moon = skyPos(253, 10);
    const off = crescentCentroidOffsetDeg(sample(sun, moon, 3));
    expect(off.dAzDeg).toBe(0);
    expect(off.dAltDeg).toBe(0);
  });

  it('amb la correcció, un fix en plena parcialitat queda per sota de 0,12°', () => {
    const rs = 0.266;
    const truth = pointing(250, 10);
    const sun = skyPos(250, 12, rs);
    const moon = skyPos(250, 12 + 0.6 * rs, rs);
    const s = sample(sun, moon, 0.6 * rs);
    const offset = crescentCentroidOffsetDeg(s);

    // La càmera veu el CENTRE DE LLUM: la taca es pinta desplaçada.
    const gray = renderSunGray(truth, [
      {
        azimuth: sun.azimuth + offset.dAzDeg,
        altitude: sun.altitudeApparent + offset.dAltDeg,
        amplitude: 1,
        sigmaGridPx: 1,
      },
    ]);
    const blob = detectSunBlob(gray, GEOMETRY, VIEWPORT, null);
    const fix = sunFixFrom(blob, truth, CALIBRATION, VIEWPORT, s);
    expect(fix).not.toBeNull();
    // Amb la càmera a la veritat, el fix no ha de corregir gairebé res: la
    // correcció de creixent ha desfet el desplaçament del centre de llum.
    expect(Math.abs(fix!.deltaAltitudeDeg)).toBeLessThan(0.12);
    expect(Math.abs(fix!.deltaAzimuthDeg)).toBeLessThan(0.12);
  });

  it('el flux apaga la confiança: parcialitat fonda val menys, i a tocar de la totalitat res', () => {
    const rs = 0.266;
    const truth = pointing(250, 10);
    const gray = renderSunGray(truth, [
      { azimuth: 250, altitude: 12, amplitude: 1, sigmaGridPx: 1 },
    ]);
    const blob = detectSunBlob(gray, GEOMETRY, VIEWPORT, null);

    const clear = sunFixFrom(blob, truth, CALIBRATION, VIEWPORT, clearSample(skyPos(250, 12, rs)));
    const deepSun = skyPos(250, 12, rs);
    const deep = sunFixFrom(
      blob,
      truth,
      CALIBRATION,
      VIEWPORT,
      sample(deepSun, skyPos(250, 12 + 0.25 * rs, rs * 1.02), 0.25 * rs),
    );
    expect(clear).not.toBeNull();
    expect(deep).not.toBeNull();
    expect(deep!.confidence).toBeLessThan(clear!.confidence);

    const almostTotal = sunFixFrom(
      blob,
      truth,
      CALIBRATION,
      VIEWPORT,
      sample(deepSun, skyPos(250, 12 + 0.02 * rs, rs * 1.03), 0.02 * rs),
    );
    expect(almostTotal).toBeNull();
  });
});

describe('la tria del cos i la fusió d’àncores', () => {
  it('de dia el Sol, al capvespre la Lluna, de nit tancat', () => {
    expect(expectedBrightBody(sample(skyPos(250, 10), skyPos(100, -20), 90))!.kind).toBe('sun');
    expect(expectedBrightBody(sample(skyPos(250, -5), skyPos(100, 30), 90))!.kind).toBe('moon');
    expect(expectedBrightBody(sample(skyPos(250, -5), skyPos(100, -10), 90))).toBeNull();
  });

  it('de dia segueix el cos cap al qual apunta la càmera', () => {
    const daylight = sample(skyPos(250, 30), skyPos(100, 35), 120);
    const pointingMoon = { azimuth: 102, altitude: 35, roll: 0, screenAngle: 0 };
    const pointingSun = { azimuth: 248, altitude: 30, roll: 0, screenAngle: 0 };

    expect(expectedBrightBody(daylight, pointingMoon)!.kind).toBe('moon');
    expect(expectedBrightBody(daylight, pointingSun)!.kind).toBe('sun');
  });

  it("durant l'eclipsi prioritza el Sol encara que els dos centres siguin al quadre", () => {
    const eclipsed = sample(skyPos(250, 12), skyPos(250.4, 12.2), 0.4);
    const camera = { azimuth: 250.4, altitude: 12.2, roll: 0, screenAngle: 0 };
    expect(expectedBrightBody(eclipsed, camera)!.kind).toBe('sun');
  });

  function fix(az: number, alt: number, confidence: number, altitudeOnly = false): SkylineFix {
    return {
      azimuthDeg: az,
      altitudeDeg: alt,
      deltaAzimuthDeg: 0,
      deltaAltitudeDeg: 0,
      rmsPx: 1,
      used: 8,
      confidence,
      altitudeOnly,
    };
  }

  it('amb un sol far, mana aquell', () => {
    const sun = fix(250, 10, 0.7);
    const terra = fix(251, 10.5, 0.6);
    expect(mergeAnchors(sun, null)).toBe(sun);
    expect(mergeAnchors(null, terra)).toBe(terra);
    expect(mergeAnchors(null, null)).toBeNull();
  });

  it('quan coincideixen, la fusió cau entremig i la confiança puja', () => {
    // Els fixos porten l'azimut en la convenció de normalizeAngle (−180, 180]:
    // les comparacions es fan amb diferències normalitzades, mai amb rangs.
    const merged = mergeAnchors(fix(250, 10, 0.8), fix(250.6, 10.4, 0.4));
    expect(merged).not.toBeNull();
    const dAz = normalizeDelta(merged!.azimuthDeg - 250);
    expect(dAz).toBeGreaterThan(0);
    expect(dAz).toBeLessThan(0.6);
    expect(merged!.altitudeDeg).toBeGreaterThan(10);
    expect(merged!.altitudeDeg).toBeLessThan(10.4);
    expect(merged!.confidence).toBeGreaterThan(0.8);
    expect(merged!.altitudeOnly).toBe(false);
  });

  it('l’azimut d’un fix només-altura no vota ni fa saltar la discrepància', () => {
    const merged = mergeAnchors(fix(250, 10, 0.5), fix(260, 10.4, 0.9, true));
    expect(merged).not.toBeNull();
    // L'azimut és el del Sol, intacte; l'altura sí que es fusiona.
    expect(Math.abs(normalizeDelta(merged!.azimuthDeg - 250))).toBeLessThan(1e-9);
    expect(merged!.altitudeDeg).toBeGreaterThan(10.2);
  });

  it('si els dos fars discrepen, prudència: guanya el més confiat amb la confiança tocada', () => {
    const merged = mergeAnchors(fix(250, 10, 0.8), fix(255, 10, 0.5));
    expect(merged).not.toBeNull();
    expect(merged!.azimuthDeg).toBe(250);
    expect(merged!.confidence).toBeCloseTo(0.8 * 0.6, 6);
  });

  it('el refinament que surt més fosc que el coarse es rebutja', () => {
    // El submostreig fa mitjanes: a resolució plena el pic només pot pujar.
    // Si baixa, el retall ha anat a parar a una altra cosa.
    expect(acceptRefinedPeak(200, 210)).toBe(true);
    expect(acceptRefinedPeak(200, 165)).toBe(true); // 0,825·coarse: dins del marge
    expect(acceptRefinedPeak(200, 150)).toBe(false); // 0,75·coarse: una vora de núvol
  });
});
