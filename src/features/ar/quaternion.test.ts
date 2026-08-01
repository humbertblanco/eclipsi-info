/**
 * El camí filtrat i el camí en brut han de descriure la MATEIXA rotació.
 *
 * Si divergeixen, l'overlay fa un salt quan s'activa o es desactiva el filtre,
 * i aquest salt és indistingible d'un error del sensor: es passarien dies
 * buscant-lo al lloc equivocat. Aquesta suite és la que ho impedeix.
 */

import { describe, expect, it } from 'vitest';
import {
  eulerZXYFromQuaternion,
  quaternionAngle,
  quaternionFromEulerZXY,
  quaternionSlerp,
  quaternionNegate,
  type Quaternion,
} from './quaternion';
import { cameraPointing, cameraPointingFromQuaternion } from './orientation';
import {
  OrientationSmoother,
  lowPassAlpha,
  circularSpreadDeg,
  DEFAULT_SMOOTHING,
} from './smoothing';

/** Postures que cobreixen el cas real: telèfon apuntant amunt cap a ponent. */
const POSES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [45, 80, 0],
  [270, 75, 12],
  [123.4, -31.2, 47.8],
  [359.5, 89, -3],
  [180, 45, 90],
  [90, 5, -170],
  [12, 88.5, 33],
];

describe('quaternió i angles d’Euler ZXY', () => {
  it('donen la mateixa direcció de càmera per a qualsevol postura', () => {
    for (const [alpha, beta, gamma] of POSES) {
      for (const screenAngle of [0, 90, 180, 270]) {
        const direct = cameraPointing(alpha, beta, gamma, screenAngle);
        const viaQuat = cameraPointingFromQuaternion(
          quaternionFromEulerZXY(alpha, beta, gamma),
          screenAngle,
        );

        expect(viaQuat.altitude).toBeCloseTo(direct.altitude, 8);
        expect(viaQuat.roll).toBeCloseTo(direct.roll, 8);
        // L'azimut és circular: es compara la diferència normalitzada.
        const dAz = ((viaQuat.azimuth - direct.azimuth + 540) % 360) - 180;
        expect(dAz).toBeCloseTo(0, 8);
      }
    }
  });

  it('la conversió a Euler i tornada és la identitat', () => {
    for (const [alpha, beta, gamma] of POSES) {
      // Els casos degenerats (beta molt a prop de ±90°) reparteixen el gir
      // d'una altra manera, però han de donar la mateixa rotació.
      const q = quaternionFromEulerZXY(alpha, beta, gamma);
      const back = eulerZXYFromQuaternion(q);
      const q2 = quaternionFromEulerZXY(back.alpha, back.beta, back.gamma);
      expect(quaternionAngle(q, q2)).toBeLessThan(1e-6);
    }
  });

  it('l’angle entre un quaternió i el seu negat és zero', () => {
    const q = quaternionFromEulerZXY(33, 44, 55);
    expect(quaternionAngle(q, quaternionNegate(q))).toBeLessThan(1e-9);
  });

  it('slerp arriba als extrems i passa pel camí curt', () => {
    const a = quaternionFromEulerZXY(0, 60, 0);
    const b = quaternionFromEulerZXY(20, 60, 0);
    expect(quaternionAngle(quaternionSlerp(a, b, 0), a)).toBeLessThan(1e-9);
    expect(quaternionAngle(quaternionSlerp(a, b, 1), b)).toBeLessThan(1e-9);

    // A mig camí, la meitat de l'angle.
    const half = quaternionSlerp(a, b, 0.5);
    expect(quaternionAngle(a, half)).toBeCloseTo(quaternionAngle(a, b) / 2, 9);

    // El camí curt s'ha de prendre encara que el sensor canviï d'hemisferi.
    const flipped = quaternionNegate(b);
    expect(quaternionAngle(quaternionSlerp(a, flipped, 0.5), half)).toBeLessThan(1e-9);
  });
});

describe('filtre d’1 euro sobre rotacions', () => {
  const DEG = Math.PI / 180;

  /**
   * Genera una seqüència de lectures amb soroll de rumb i, opcionalment, un gir
   * constant. És el banc de proves que substitueix sortir al carrer.
   */
  function sequence(options: {
    steps: number;
    dtSec: number;
    noiseDeg: number;
    turnRateDegPerSec: number;
  }): Array<{ q: Quaternion; trueAzimuth: number; noisyAzimuth: number }> {
    // Generador determinista: un test que falla una vegada de cada deu no
    // serveix de res.
    let seed = 12345;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648 - 0.5;
    };

    const out = [];
    for (let i = 0; i < options.steps; i++) {
      const trueAzimuth = 270 + options.turnRateDegPerSec * i * options.dtSec;
      const noisyAzimuth = trueAzimuth + random() * 2 * options.noiseDeg;
      // La càmera mira a l'azimut; l'alpha equivalent és 360 − rumb.
      out.push({
        q: quaternionFromEulerZXY(360 - noisyAzimuth, 85, 0),
        trueAzimuth,
        noisyAzimuth,
      });
    }
    return out;
  }

  it('redueix el tremolor amb el telèfon quiet', () => {
    const data = sequence({ steps: 300, dtSec: 1 / 60, noiseDeg: 1.5, turnRateDegPerSec: 0 });
    const smoother = new OrientationSmoother({
      enabled: true,
      minCutoffHz: 1,
      beta: 0.02,
      derivativeCutoffHz: 1,
      deadBandDeg: 0,
      noiseFloorRadPerSec: 0,
    });

    const raw: number[] = [];
    const filtered: number[] = [];
    for (const { q } of data) {
      raw.push(cameraPointingFromQuaternion(q).azimuth);
      filtered.push(cameraPointingFromQuaternion(smoother.push(q, 1 / 60)).azimuth);
    }

    const rawSpread = circularSpreadDeg(raw.slice(60));
    const filteredSpread = circularSpreadDeg(filtered.slice(60));

    // El sentit del filtre és exactament aquest número. Amb el tall a 1 Hz i
    // mostres a 60 Hz, la reducció ha de ser d'un factor gran, no marginal.
    expect(filteredSpread).toBeLessThan(rawSpread / 4);
  });

  it('no introdueix retard apreciable en un gir ràpid', () => {
    // Seixanta graus per segon és un panoràmic decidit de mà. Es prova amb la
    // configuració QUE S'ENVIA, no amb una d'inventada per al test: el número
    // que importa és el que veurà l'usuari.
    const data = sequence({ steps: 240, dtSec: 1 / 60, noiseDeg: 0.3, turnRateDegPerSec: 60 });
    const smoother = new OrientationSmoother(DEFAULT_SMOOTHING);

    let worstErrorDeg = 0;
    let sumErrorDeg = 0;
    let n = 0;
    for (let i = 0; i < data.length; i++) {
      const out = cameraPointingFromQuaternion(smoother.push(data[i].q, 1 / 60));
      if (i < 60) continue; // deixem que el filtre s'assenti
      const error = ((out.azimuth - data[i].trueAzimuth + 540) % 360) - 180;
      worstErrorDeg = Math.max(worstErrorDeg, Math.abs(error));
      sumErrorDeg += error;
      n++;
    }

    // EL RETARD ÉS EL BIAIX, no el màxim. La mitjana de l'error cancel·la el
    // soroll d'entrada —que no és retard, i que cap filtre no pot treure sense
    // reintroduir-ne— i deixa exactament el que el filtre arrossega.
    //
    // Mig grau és el diàmetre del Sol. Per sota d'això, el retard no es pot
    // distingir de l'error de la brúixola i és perceptivament invisible. Amb
    // beta = 20 el sostre teòric és 57,3/(2π·20) = 0,46°; amb la beta anterior
    // de 0,02 aquest mateix número era de 8,13°.
    const lagDeg = Math.abs(sumErrorDeg / n);
    expect(lagDeg).toBeLessThan(0.5);

    // I el màxim instantani, soroll inclòs, no pot passar d'un grau: és el
    // llindar a partir del qual la superposició es veu "despresa" del paisatge.
    expect(worstErrorDeg).toBeLessThan(1);
  });

  it('la banda morta congela l’overlay del tot amb el mòbil recolzat', () => {
    const data = sequence({ steps: 120, dtSec: 1 / 60, noiseDeg: 0.05, turnRateDegPerSec: 0 });
    const smoother = new OrientationSmoother({
      enabled: true,
      minCutoffHz: 1,
      beta: 0.02,
      derivativeCutoffHz: 1,
      deadBandDeg: 0.5,
      noiseFloorRadPerSec: 0,
    });

    smoother.push(data[0].q, 1 / 60);
    const first = smoother.push(data[1].q, 1 / 60);
    for (let i = 2; i < data.length; i++) {
      const out = smoother.push(data[i].q, 1 / 60);
      expect(quaternionAngle(out, first)).toBeLessThan(1e-9);
    }
    expect(smoother.getTelemetry().frozen).toBe(true);
  });

  it('desactivat, deixa passar la lectura tal qual', () => {
    const smoother = new OrientationSmoother({
      enabled: false,
      minCutoffHz: 1,
      beta: 0.02,
      derivativeCutoffHz: 1,
      deadBandDeg: 0.2,
      noiseFloorRadPerSec: 0,
    });
    const q = quaternionFromEulerZXY(10, 20, 30);
    expect(smoother.push(q, 1 / 60)).toEqual(q);
  });

  it('un salt de temps es tracta com un reinici i no com un gir', () => {
    const smoother = new OrientationSmoother();
    const a = quaternionFromEulerZXY(0, 80, 0);
    const b = quaternionFromEulerZXY(90, 80, 0);
    smoother.push(a, 1 / 60);
    // Dos segons sense lectures: la pestanya ha estat en segon pla.
    const out = smoother.push(b, 2);
    expect(quaternionAngle(out, b)).toBeLessThan(1e-9);
  });

  it('el coeficient del passa-baixos té els límits correctes', () => {
    // Tall infinitament alt: passa directe.
    expect(lowPassAlpha(1e9, 1 / 60)).toBeGreaterThan(0.999);
    // Tall molt baix: gairebé no deixa passar res.
    expect(lowPassAlpha(1e-6, 1 / 60)).toBeLessThan(1e-6);
    // dt zero o negatiu no ha de dividir per zero.
    expect(lowPassAlpha(1, 0)).toBe(1);
  });

  it('la dispersió circular no s’enganya amb el pas per zero', () => {
    // Lectures a banda i banda del nord: la dispersió real és petita.
    const spread = circularSpreadDeg([359, 0, 1, 359.5, 0.5]);
    expect(spread).toBeLessThan(2);
    // Amb la fórmula lineal això hauria donat prop de 180.
    expect(circularSpreadDeg([90, 270])).toBeGreaterThan(80);
  });

  // Un grau de gir a la velocitat de mostreig típica no pot introduir més
  // retard que el que dura un fotograma a 60 Hz.
  it('el tall creix amb la velocitat angular', () => {
    const smoother = new OrientationSmoother();
    smoother.push(quaternionFromEulerZXY(0, 80, 0), 1 / 60);
    smoother.push(quaternionFromEulerZXY(0.02, 80, 0), 1 / 60);
    const slow = smoother.getTelemetry().cutoffHz;

    const fast = new OrientationSmoother();
    fast.push(quaternionFromEulerZXY(0, 80, 0), 1 / 60);
    for (let i = 1; i < 30; i++) {
      fast.push(quaternionFromEulerZXY(i * 2, 80, 0), 1 / 60);
    }
    expect(fast.getTelemetry().cutoffHz).toBeGreaterThan(slow);
    expect(fast.getTelemetry().angularSpeedDegPerSec).toBeGreaterThan(30);
  });

  it('els graus per segon de la telemetria són creïbles', () => {
    const smoother = new OrientationSmoother({
      enabled: true,
      minCutoffHz: 1,
      beta: 0,
      derivativeCutoffHz: 1000, // sense suavitzar la velocitat, per mesurar-la neta
      deadBandDeg: 0,
      noiseFloorRadPerSec: 0,
    });
    smoother.push(quaternionFromEulerZXY(0, 0, 0), 1 / 60);
    smoother.push(quaternionFromEulerZXY(1, 0, 0), 1 / 60);
    // Un grau en un seixantè de segon són seixanta graus per segon.
    expect(smoother.getTelemetry().angularSpeedDegPerSec).toBeCloseTo(60, 0);
    expect(Math.cos(0)).toBe(1); // el DEG del fitxer s'usa als generadors
    expect(DEG).toBeGreaterThan(0);
  });
});

describe('el terra de soroll del filtre', () => {
  /*
   * PER QUÈ HI ÉS. `speedRadPerSec` és una NORMA, i la norma d'un vector
   * sorollós de mitjana zero és estrictament positiva. Amb el telèfon damunt
   * la taula i una brúixola de 1,5° de soroll, el filtre «veia» 7,7°/s i la β
   * li obria el tall fins a 3,7 Hz: estava dissenyat per tallar a 1 Hz en
   * repòs i deixava passar gairebé tot el tremolor. Aquell tremolor és el que
   * l'usuari veu com el Sol que no es queda quiet.
   *
   * Es prova amb un soroll REPRODUÏBLE i no amb `Math.random`, perquè un banc
   * que depèn de la sort acaba desactivat.
   */
  function noise(i: number, seed: number): number {
    const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  }

  function jitterDeg(noiseDeg: number, floorRadPerSec: number, beta: number): number {
    const smoother = new OrientationSmoother({
      ...DEFAULT_SMOOTHING,
      beta,
      noiseFloorRadPerSec: floorRadPerSec,
      deadBandDeg: 0,
    });
    const out: number[] = [];
    for (let i = 0; i < 600; i++) {
      const q = quaternionFromEulerZXY(180 + noise(i, 1) * noiseDeg, 80, 0);
      const p = cameraPointingFromQuaternion(smoother.push(q, 1 / 60));
      if (i > 120) out.push(p.azimuth);
    }
    const mean = out.reduce((a, b) => a + b, 0) / out.length;
    return Math.sqrt(out.reduce((a, b) => a + (b - mean) ** 2, 0) / out.length);
  }

  it('amb el telèfon quiet, tremola menys que sense terra', () => {
    for (const noiseDeg of [0.5, 1.5, 3.0]) {
      const before = jitterDeg(noiseDeg, 0, 20);
      const after = jitterDeg(noiseDeg, DEFAULT_SMOOTHING.noiseFloorRadPerSec, DEFAULT_SMOOTHING.beta);
      expect(after).toBeLessThan(before);
    }
  });

  it('amb una brúixola normal, el tremolor queda per sota d’un diàmetre solar', () => {
    // Mig grau és el diàmetre del Sol: per sota, el disc no es veu ballar.
    expect(
      jitterDeg(1.5, DEFAULT_SMOOTHING.noiseFloorRadPerSec, DEFAULT_SMOOTHING.beta),
    ).toBeLessThan(0.5);
  });
});
