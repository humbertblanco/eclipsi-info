/**
 * Banc de proves sintètic del seguiment de realitat augmentada.
 *
 * PER QUÈ EXISTEIX. Aquest codi s'ha d'escriure sense telèfon a la mà, i "ara
 * sembla que va millor" no és una mesura. Aquí es construeix una escena
 * texturada, s'hi fa girar una càmera una quantitat CONEGUDA, se'n generen els
 * fotogrames que en sortirien, i es comprova amb un número si el que mesura el
 * seguidor coincideix amb el gir que se li ha aplicat i si la postura fusionada
 * es queda clavada damunt de l'escena.
 *
 * LA PEÇA CLAU: els fotogrames es generen amb `unprojectFromScreen`, que és
 * exactament la inversa de la projecció amb què l'aplicació dibuixa la
 * superposició. Si el seguidor i la projecció discrepessin en un signe o en una
 * escala, això ho veuria — que és justament el tipus d'error que al mòbil es
 * veu com "la superposició llisca sobre el paisatge" i que no es pot atribuir a
 * cap causa concreta mirant-s'ho.
 */

import { describe, expect, it } from 'vitest';
import {
  FrameTracker,
  FocalEstimator,
  geometryFor,
  gridSizeForFrame,
  type TrackerGeometry,
  type VisualRotation,
} from './visualTracker';
import { PoseFusion, rotationToPoseDelta } from './poseFusion';
import {
  cameraPointingFromQuaternion,
  unprojectFromScreen,
  DEFAULT_CALIBRATION,
  type CameraPointing,
} from './orientation';
import { quaternionFromEulerZXY } from './quaternion';
import { OrientationSmoother, DEFAULT_SMOOTHING } from './smoothing';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Generador determinista: un test que falla una vegada de cada deu no serveix. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/**
 * Panorama procedimental: una funció del cel que dona un valor de gris.
 *
 * Suma de sinusoides amb direccions i freqüències aleatòries però fixes. Les
 * freqüències es limiten perquè el detall més fi ocupi uns quants píxels de la
 * graella reduïda: si hi hagués estructura per sota del píxel, el mostreig
 * l'aliasaria i el que mesuraria el seguidor seria l'àlies, no el moviment.
 */
function makePanorama(seed: number): (azDeg: number, altDeg: number) => number {
  const rnd = makeRandom(seed);
  const waves: Array<[number, number, number, number]> = [];
  let ampSum = 0;
  for (let i = 0; i < 36; i++) {
    // Fins a 36 cicles per radià: un període de 1,6°, uns tres píxels de
    // graella. Prou fi per exigir precisió subpíxel i prou gros per no aliasar.
    const freq = 2 + rnd() * 34;
    const dir = rnd() * Math.PI * 2;
    const phase = rnd() * Math.PI * 2;
    const amp = 1 / (1 + i * 0.12);
    ampSum += amp;
    waves.push([freq * Math.cos(dir), freq * Math.sin(dir), phase, amp]);
  }

  return (azDeg: number, altDeg: number) => {
    const az = azDeg * DEG;
    const alt = altDeg * DEG;
    let sum = 0;
    for (const [fx, fy, phase, amp] of waves) {
      sum += amp * Math.sin(fx * az + fy * alt + phase);
    }
    return 128 + (110 * sum) / ampSum;
  };
}

/** Postura de càmera a partir d'azimut, altura i gir. */
function pose(azimuth: number, altitude: number, roll = 0, screenAngle = 0): CameraPointing {
  return { azimuth, altitude, roll, screenAngle };
}

/**
 * Genera el fotograma que veuria la càmera en aquesta postura.
 *
 * Cada píxel de la graella es converteix a coordenades de pantalla, es
 * desprojecta amb la MATEIXA geometria que fa servir l'aplicació per dibuixar,
 * i se'n mostreja el panorama. El resultat és, per construcció, el que hauria
 * de veure la càmera si la projecció de l'aplicació fos correcta.
 */
function renderFrame(
  panorama: (azDeg: number, altDeg: number) => number,
  geometry: TrackerGeometry,
  camera: CameraPointing,
  noiseAmplitude = 0,
  seed = 1,
): Float32Array {
  const { gridWidth: w, gridHeight: h, scaleX, scaleY, focalPx } = geometry;
  const viewport = {
    width: w * scaleX,
    height: h * scaleY,
    focalPx,
  };
  const out = new Float32Array(w * h);
  const rnd = makeRandom(seed);

  for (let gy = 0; gy < h; gy++) {
    const screenY = (gy + 0.5) * scaleY;
    for (let gx = 0; gx < w; gx++) {
      const screenX = (gx + 0.5) * scaleX;
      const ray = unprojectFromScreen(
        screenX,
        screenY,
        camera,
        DEFAULT_CALIBRATION,
        viewport,
      );
      let value = panorama(ray.azimuth, ray.altitude);
      if (noiseAmplitude > 0) value += (rnd() - 0.5) * 2 * noiseAmplitude;
      out[gy * w + gx] = value;
    }
  }
  return out;
}

/**
 * Geometria del cas real que ens interessa: un iPhone en vertical.
 *
 * Flux de 720×1280 —el que lliuren iOS i Android quan giren el vídeo— dins del
 * marc 3:4 de `.viewport` amb 390 px CSS d'amplada. La focal de 500 px
 * correspon a uns 42° de camp a pantalla, que és el que es veu amb la càmera
 * principal retallada a 3:4.
 */
function portraitGeometry(focalPx = 500): TrackerGeometry {
  const geometry = geometryFor(720, 1280, 390, 520, focalPx);
  if (!geometry) throw new Error('geometria impossible');
  return geometry;
}

/** Mesura el gir entre dues postures passant pel seguidor. */
function measureBetween(
  panorama: (azDeg: number, altDeg: number) => number,
  geometry: TrackerGeometry,
  from: CameraPointing,
  to: CameraPointing,
): VisualRotation {
  const tracker = new FrameTracker();
  expect(tracker.measure(renderFrame(panorama, geometry, from), geometry, null)).toBeNull();
  const result = tracker.measure(renderFrame(panorama, geometry, to), geometry, null);
  if (!result) throw new Error('el seguidor no ha pogut mesurar');
  return result;
}

describe('geometria de la graella', () => {
  it('respecta la relació d’aspecte del flux', () => {
    // Un flux vertical de 9:16 no pot acabar en una graella apaïsada.
    const { gridWidth, gridHeight } = gridSizeForFrame(720, 1280);
    expect(gridWidth).toBe(88);
    expect(gridHeight).toBe(156);
    // La distorsió residual entre els dos eixos ha de ser inferior a l'1%.
    const aspectError = Math.abs((gridWidth / gridHeight) / (720 / 1280) - 1);
    expect(aspectError).toBeLessThan(0.01);
  });

  it('els dos eixos tenen escales DIFERENTS, i aquest era el defecte', () => {
    const geometry = portraitGeometry();
    // Amb `object-fit: cover`, 720×1280 dins de 390×520 escala per l'amplada.
    expect(geometry.scaleX).toBeCloseTo((720 / 88) * (390 / 720), 6);
    expect(geometry.scaleY).toBeCloseTo((1280 / 156) * (390 / 720), 6);

    // La versió anterior aplicava `displayWidth / 96` als DOS eixos amb una
    // graella de 96×72. En vertical això subestimava el moviment per aquest
    // factor, i per això la superposició lliscava en inclinar amunt i avall.
    const oldScale = 390 / 96;
    const oldVerticalError = ((1280 / 72) * (390 / 720)) / oldScale;
    expect(oldVerticalError).toBeGreaterThan(2.3);
    expect(oldVerticalError).toBeLessThan(2.4);
  });
});

describe('el seguidor mesura el gir que se li ha aplicat', () => {
  const panorama = makePanorama(7);
  const geometry = portraitGeometry();

  it('un gir d’azimut cap a la dreta dona yaw POSITIU i de la mida correcta', () => {
    const r = measureBetween(panorama, geometry, pose(270, 10), pose(271, 10));
    expect(r.yawRad * RAD).toBeGreaterThan(0);
    expect(r.yawRad * RAD).toBeCloseTo(1, 1);
    expect(Math.abs(r.pitchRad * RAD)).toBeLessThan(0.06);
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it('una inclinació cap amunt dona pitch POSITIU i de la mida correcta', () => {
    const r = measureBetween(panorama, geometry, pose(270, 10), pose(270, 11));
    expect(r.pitchRad * RAD).toBeGreaterThan(0);
    expect(r.pitchRad * RAD).toBeCloseTo(1, 1);
    expect(Math.abs(r.yawRad * RAD)).toBeLessThan(0.06);
  });

  it('inclinar cap avall dona pitch NEGATIU', () => {
    const r = measureBetween(panorama, geometry, pose(270, 10), pose(270, 9));
    expect(r.pitchRad * RAD).toBeCloseTo(-1, 1);
  });

  it('un gir de canell es mesura com a roll i no com a translació', () => {
    const r = measureBetween(panorama, geometry, pose(270, 10, 0), pose(270, 10, 2));
    // El signe és el del gir de la càmera al voltant de l'eix òptic.
    expect(Math.abs(r.rollRad * RAD)).toBeCloseTo(2, 1);
    // I sobretot: NO s'ha de confondre amb un canvi d'azimut o d'altura, que és
    // el que passava amb la mediana de translacions.
    expect(Math.abs(r.yawRad * RAD)).toBeLessThan(0.15);
    expect(Math.abs(r.pitchRad * RAD)).toBeLessThan(0.15);
  });

  it('mesura girs molt per sota d’un píxel de graella (subpíxel)', () => {
    // Un píxel de graella són 0,51° en horitzontal amb aquesta geometria. Un
    // gir de 0,15° no arriba ni a un terç de píxel: sense interpolació
    // subpíxel el resultat seria zero o un píxel sencer, mai 0,15°.
    const stepPerPixelDeg = (geometry.scaleX / geometry.focalPx) * RAD;
    expect(stepPerPixelDeg).toBeGreaterThan(0.4);

    const r = measureBetween(panorama, geometry, pose(270, 10), pose(270.15, 10));
    expect(r.yawRad * RAD).toBeGreaterThan(0.1);
    expect(r.yawRad * RAD).toBeLessThan(0.2);
  });

  it('LA REGRESSIÓ: el moviment vertical no es queda al 42%', () => {
    // Aquest és el test que hauria enxampat el defecte. Amb la graella
    // esclafada i un sol factor d'escala, una inclinació d'1° es mesurava com
    // 0,42°, i la superposició es quedava enrere just en el gest que l'usuari
    // fa tota l'estona: mirar amunt i avall buscant el Sol.
    const r = measureBetween(panorama, geometry, pose(200, 25), pose(200, 26));
    const measuredDeg = r.pitchRad * RAD;
    expect(measuredDeg / 1).toBeGreaterThan(0.95);
    expect(measuredDeg / 1).toBeLessThan(1.05);
  });

  it('aguanta amb soroll de sensor a la imatge', () => {
    const tracker = new FrameTracker();
    tracker.measure(renderFrame(panorama, geometry, pose(270, 10), 12, 3), geometry, null);
    const r = tracker.measure(
      renderFrame(panorama, geometry, pose(270.8, 10), 12, 9),
      geometry,
      null,
    );
    expect(r).not.toBeNull();
    // Amb ±12 nivells de soroll damunt d'una textura d'amplitud 110, l'error
    // de l'escala mesurada es queda al 7,5%: prou per confiar-hi, i el que hi
    // quedi ho corregeix l'estirada del sensor.
    expect(r!.yawRad * RAD / 0.8).toBeGreaterThan(0.85);
    expect(r!.yawRad * RAD / 0.8).toBeLessThan(1.15);
    expect(r!.confidence).toBeGreaterThan(0.35);
  });

  it('avisa quan el gir supera el que es pot mesurar', () => {
    // Sense predicció, el radi de cerca limita el gir mesurable. Passat el
    // límit el número surt massa PETIT, que és pitjor que no tenir-ne cap: cal
    // que ho digui perquè qui el rebi torni al sensor.
    const r = measureBetween(panorama, geometry, pose(270, 10), pose(279, 10));
    expect(r.saturated).toBe(true);
    expect(r.confidence).toBe(0);
  });

  it('amb la predicció del sensor, un gir gran es mesura igualment', () => {
    const tracker = new FrameTracker();
    tracker.measure(renderFrame(panorama, geometry, pose(270, 10)), geometry, null);
    const hint = { pitchRad: 0, yawRad: 9 * DEG, rollRad: 0 };
    const r = tracker.measure(
      renderFrame(panorama, geometry, pose(279, 10)),
      geometry,
      hint,
    );
    expect(r).not.toBeNull();
    expect(r!.saturated).toBe(false);
    expect(r!.yawRad * RAD).toBeCloseTo(9, 0);
  });
});

describe('el gir de la imatge es reparteix bé entre azimut i altura', () => {
  it('amb el telèfon dret, yaw va a l’azimut i pitch a l’altura', () => {
    const d = rotationToPoseDelta({ pitchRad: 2 * DEG, yawRad: 3 * DEG }, 0, 0);
    expect(d.dAzDeg).toBeCloseTo(3, 6);
    expect(d.dAltDeg).toBeCloseTo(2, 6);
  });

  it('amb la pantalla en apaisat, els eixos s’intercanvien', () => {
    // `screenAngle` = 90°: el que a la imatge és horitzontal, al món és
    // vertical. Sense aquest terme, girar el telèfon de costat feia que
    // inclinar-lo es llegís com canviar de rumb.
    const d = rotationToPoseDelta({ pitchRad: 2 * DEG, yawRad: 3 * DEG }, 90, 0);
    expect(d.dAzDeg).toBeCloseTo(2, 6);
    expect(d.dAltDeg).toBeCloseTo(-3, 6);
  });

  it('a prop del zenit un grau d’azimut és menys d’un grau de cel', () => {
    const d = rotationToPoseDelta({ pitchRad: 0, yawRad: 1 * DEG }, 0, 60);
    expect(d.dAzDeg).toBeCloseTo(1 / Math.cos(60 * DEG), 6);
  });
});

/**
 * Simulació completa: sensor sorollós, fotogrames de vídeo a 30 Hz i bucle de
 * dibuix a 60 Hz, damunt d'una trajectòria coneguda.
 */
function runSequence(options: {
  /** Trajectòria real de la càmera, per fotograma de dibuix. */
  path: (i: number) => { azimuth: number; altitude: number; roll: number };
  steps: number;
  sensorNoiseDeg: number;
  /** Multiplica la mesura visual: −1 serveix per provar el signe invertit. */
  visualSign?: number;
  /** Error d'escala de la focal, com a factor. 1 = focal exacta. */
  focalError?: number;
  seed?: number;
}): {
  errorDeg: number[];
  agreement: number;
  sensorOnlyErrorDeg: number[];
} {
  const panorama = makePanorama(options.seed ?? 11);
  const trueGeometry = portraitGeometry(500);
  // El seguidor treballa amb la focal que CREU que té, que no té per què ser la
  // de veritat: és el cas de l'objectiu ultra-angular.
  const assumedGeometry = portraitGeometry(500 * (options.focalError ?? 1));

  const tracker = new FrameTracker();
  const fusion = new PoseFusion();
  const smoother = new OrientationSmoother(DEFAULT_SMOOTHING);
  const rnd = makeRandom(97);

  const errorDeg: number[] = [];
  const sensorOnlyErrorDeg: number[] = [];
  const dt = 1 / 60;
  let previousFrame: CameraPointing | null = null;
  let shownPose: { azimuth: number; altitude: number } | null = null;
  let lastSmoothed = { azimuth: 0, altitude: 0 };

  for (let i = 0; i < options.steps; i++) {
    const truth = options.path(i);
    const camera = pose(truth.azimuth, truth.altitude, truth.roll);

    // --- sensor: veritat + soroll, passat pel filtre que s'envia ---
    const noisyAz = truth.azimuth + (rnd() - 0.5) * 2 * options.sensorNoiseDeg;
    const noisyAlt = truth.altitude + (rnd() - 0.5) * 2 * options.sensorNoiseDeg * 0.3;
    const q = quaternionFromEulerZXY(360 - noisyAz, 90 + noisyAlt, 0);
    const smoothed = cameraPointingFromQuaternion(smoother.push(q, dt));
    lastSmoothed = { azimuth: smoothed.azimuth, altitude: smoothed.altitude };

    // --- vídeo a 30 Hz: només la meitat dels fotogrames de dibuix en porten un
    let visual: VisualRotation | null = null;
    if (i % 2 === 0) {
      const gray = renderFrame(panorama, trueGeometry, camera);
      const hint = previousFrame
        ? {
            pitchRad: (truth.altitude - previousFrame.altitude) * DEG,
            yawRad:
              ((truth.azimuth - previousFrame.azimuth) *
                Math.cos(truth.altitude * DEG)) *
              DEG,
            rollRad: 0,
          }
        : null;
      visual = tracker.measure(gray, assumedGeometry, hint);
      previousFrame = camera;
      shownPose = truth;
      if (visual && options.visualSign === -1) {
        visual = {
          ...visual,
          pitchRad: -visual.pitchRad,
          yawRad: -visual.yawRad,
          rollRad: -visual.rollRad,
        };
      }
    }

    const fused = fusion.update({
      sensorAzimuthDeg: smoothed.azimuth,
      sensorAltitudeDeg: smoothed.altitude,
      imageRollDeg: truth.roll,
      newFrame: i % 2 === 0,
      visual,
      sensorSpeedDegPerSec: smoother.getTelemetry().angularSpeedDegPerSec,
      dtSec: dt,
    });

    // LA REFERÈNCIA ÉS LA POSTURA DEL FOTOGRAMA QUE S'ESTÀ VEIENT, no la de
    // l'instant. Entre dos fotogrames de vídeo, la imatge de la pantalla no
    // canvia; si la superposició hi avancés, es desenganxaria del paisatge
    // durant mig fotograma i tornaria a lloc — que és tremolor pur. El que
    // s'ha de mesurar és si la superposició coincideix amb la imatge que
    // l'usuari té al davant.
    const shown = shownPose ?? truth;

    if (i > 60) {
      errorDeg.push(
        angularErrorDeg(fused.azimuthDeg, fused.altitudeDeg, shown.azimuth, shown.altitude),
      );
      sensorOnlyErrorDeg.push(
        angularErrorDeg(
          lastSmoothed.azimuth,
          lastSmoothed.altitude,
          shown.azimuth,
          shown.altitude,
        ),
      );
    }
  }

  return { errorDeg, agreement: fusion.telemetry.agreement, sensorOnlyErrorDeg };
}

/** Separació angular real entre dues direccions, en graus. */
function angularErrorDeg(az1: number, alt1: number, az2: number, alt2: number): number {
  const toVec = (az: number, alt: number): [number, number, number] => {
    const a = az * DEG;
    const e = alt * DEG;
    return [Math.cos(e) * Math.sin(a), Math.cos(e) * Math.cos(a), Math.sin(e)];
  };
  const [x1, y1, z1] = toVec(az1, alt1);
  const [x2, y2, z2] = toVec(az2, alt2);
  return Math.acos(Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2))) * RAD;
}

function peakToPeak(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values);
}

describe('la postura fusionada es queda clavada damunt de l’escena', () => {
  /** Inclinar 30° amunt i tornar: el gest que l'usuari fa buscant el Sol. */
  const tiltPath = (i: number) => ({
    azimuth: 250,
    altitude: 10 + 15 * (1 - Math.cos((i / 90) * Math.PI)),
    roll: 0,
  });

  it('inclinant 30° amunt i avall, l’error no arriba a mig grau', () => {
    const { errorDeg, sensorOnlyErrorDeg, agreement } = runSequence({
      path: tiltPath,
      steps: 300,
      sensorNoiseDeg: 1.2,
    });

    // El criteri d'acceptació del carrer: la silueta del terreny no s'ha de
    // desenganxar de les muntanyes. El que ho fa visible no és l'error mitjà
    // sinó el que VARIA durant el gest.
    expect(peakToPeak(errorDeg)).toBeLessThan(0.5);
    expect(Math.max(...errorDeg)).toBeLessThan(0.5);

    // I ha de ser clarament millor que anar només amb el sensor.
    expect(peakToPeak(errorDeg)).toBeLessThan(peakToPeak(sensorOnlyErrorDeg));

    // Les dues fonts s'han de confirmar mútuament. El sostre d'aquesta xifra
    // no el posa la fusió sinó el SOROLL DEL SENSOR: a 30 Hz, l'increment que
    // veu el sensor en un fotograma té un soroll comparable al senyal, i la
    // correlació no pot passar de 0,85-0,90 encara que tot funcioni
    // perfectament. El que importa és que sigui clarament positiva.
    expect(agreement).toBeGreaterThan(0.75);
  });

  it('girant 90° d’azimut i tornant, tampoc', () => {
    const { errorDeg, agreement } = runSequence({
      path: (i) => ({
        azimuth: 250 + 45 * (1 - Math.cos((i / 110) * Math.PI)),
        altitude: 15,
        roll: 0,
      }),
      steps: 300,
      sensorNoiseDeg: 1.2,
    });
    expect(peakToPeak(errorDeg)).toBeLessThan(0.5);
    expect(agreement).toBeGreaterThan(0.75);
  });

  it('amb el telèfon quiet, el soroll queda molt per sota de mig grau', () => {
    const { errorDeg, sensorOnlyErrorDeg } = runSequence({
      path: () => ({ azimuth: 250, altitude: 20, roll: 0 }),
      steps: 300,
      sensorNoiseDeg: 1.5,
    });
    expect(peakToPeak(errorDeg)).toBeLessThan(0.5);
    // L'ancoratge visual ha de treure com a mínim la meitat del tremolor que
    // deixa passar el filtre del sensor tot sol.
    expect(peakToPeak(errorDeg)).toBeLessThan(peakToPeak(sensorOnlyErrorDeg) / 2);
  });

  it('amb el telèfon tombat, el gir no es confon amb un canvi de rumb', () => {
    const { errorDeg } = runSequence({
      path: (i) => ({
        azimuth: 250,
        altitude: 10 + 12 * (1 - Math.cos((i / 90) * Math.PI)),
        roll: 25,
      }),
      steps: 300,
      sensorNoiseDeg: 1.2,
    });
    expect(peakToPeak(errorDeg)).toBeLessThan(0.6);
  });

  it('EL SIGNE: invertir la mesura visual empitjora l’error diverses vegades', () => {
    // Aquesta és la comprovació que el banc de proves existeix per fer. Si el
    // signe estigués invertit, la fusió sumaria el moviment en comptes de
    // cancel·lar-lo i la superposició es mouria el doble — que és exactament el
    // que un usuari descriuria com "llisca sobre el paisatge".
    const good = runSequence({ path: tiltPath, steps: 300, sensorNoiseDeg: 1.2 });
    const bad = runSequence({
      path: tiltPath,
      steps: 300,
      sensorNoiseDeg: 1.2,
      visualSign: -1,
    });

    expect(Math.max(...bad.errorDeg)).toBeGreaterThan(4 * Math.max(...good.errorDeg));
    // I la telemetria ho ha de DIR, perquè al camp es pugui diagnosticar sense
    // haver de deduir-ho de com es veu.
    expect(good.agreement).toBeGreaterThan(0.75);
    expect(bad.agreement).toBeLessThan(-0.75);
  });

  it('una focal equivocada es nota, i és la raó de mesurar-la', () => {
    // L'ultra-angular d'iOS dona una focal molt més petita de la que se suposa.
    // L'ancoratge visual llavors mesura girs massa grossos i la superposició se
    // separa del paisatge proporcionalment al que s'ha girat.
    const { errorDeg } = runSequence({
      path: tiltPath,
      steps: 300,
      sensorNoiseDeg: 1.2,
      focalError: 0.6,
    });
    expect(Math.max(...errorDeg)).toBeGreaterThan(1);
  });
});

describe('l’estimador de focal', () => {
  it('recupera la focal real a partir del gir del sensor', () => {
    // El seguidor treballa amb 300 px quan la focal de veritat és 500: mesurarà
    // girs 500/300 vegades massa grossos, i el sensor ho ha de desfer.
    const estimator = new FocalEstimator();
    const referenceFocal = 300;
    const trueFocal = 500;
    const rnd = makeRandom(5);

    // El sensor es simula com el que és: una POSTURA sorollosa de la qual
    // s'agafen diferències. El soroll d'un pas és el d'un grau i mig, que és el
    // que feia sortir la focal a la meitat quan s'ajustava fotograma a
    // fotograma; acumulat fins als vuit graus, queda al 5%.
    let truePose = 0;
    let previousNoisy = 0;
    for (let i = 0; i < 900; i++) {
      const trueStepRad = 0.6 * DEG;
      truePose += trueStepRad;
      const noisy = truePose + (rnd() - 0.5) * 3 * DEG;
      const visual = (trueStepRad * trueFocal) / referenceFocal;
      estimator.add(0, visual, noisy - previousNoisy, referenceFocal, 0.9);
      previousNoisy = noisy;
    }

    const focal = estimator.focalPx(referenceFocal);
    expect(focal).not.toBeNull();
    expect(focal!).toBeGreaterThan(trueFocal * 0.9);
    expect(focal!).toBeLessThan(trueFocal * 1.1);
  });

  it('no diu res mentre no en té prou', () => {
    const estimator = new FocalEstimator();
    estimator.add(0, 0.01, 0.01, 500, 0.9);
    expect(estimator.focalPx(500)).toBeNull();
    expect(estimator.count).toBe(0);
  });

  it('descarta les finestres on les dues fonts es contradiuen', () => {
    const estimator = new FocalEstimator();
    for (let i = 0; i < 200; i++) estimator.add(0, 0.6 * DEG, -0.6 * DEG, 500, 0.9);
    expect(estimator.count).toBe(0);
  });
});
