/**
 * Tests de `adaptation.ts`.
 *
 * Aquí es prova la part del model que no és fotometria sinó fisiologia. Els
 * valors de referència són qualitatius a propòsit: el que ha de quedar
 * blindat és el COMPORTAMENT (l'ull amaga la caiguda, i deixa d'amagar-la quan
 * la caiguda va massa de pressa), no una xifra decimal que no tenim.
 */

import { describe, it, expect } from 'vitest';
import {
  adaptEye,
  colorfulness,
  DARK_ADAPTATION_TAU_S,
  eyeState,
  LIGHT_ADAPTATION_TAU_S,
  perceivedBrightness,
  pupilDiameterMm,
  sceneLuminanceCdM2,
  steadyAdaptationLux,
  visionRegime,
} from './adaptation';
import { clearSkyIlluminanceLux, eclipseIlluminance } from './illuminance';

describe('sceneLuminanceCdM2', () => {
  it('un dia de sol són uns 5.700 cd/m² sobre gris mitjà', () => {
    expect(sceneLuminanceCdM2(100_000)).toBeCloseTo((0.18 * 100_000) / Math.PI, 6);
    expect(sceneLuminanceCdM2(100_000)).toBeGreaterThan(5000);
    expect(sceneLuminanceCdM2(100_000)).toBeLessThan(6500);
  });
});

describe('pupilDiameterMm', () => {
  it('es tanca en ple sol i s’obre de nit', () => {
    expect(pupilDiameterMm(5700)).toBeLessThanOrEqual(2);
    expect(pupilDiameterMm(0.01)).toBeCloseTo(5.5, 1);
    expect(pupilDiameterMm(1e-6)).toBeGreaterThan(6.5);
  });

  it('mai no surt del rang fisiològic', () => {
    for (const l of [1e9, 1e4, 1, 1e-4, 1e-10]) {
      expect(pupilDiameterMm(l)).toBeGreaterThanOrEqual(1.5);
      expect(pupilDiameterMm(l)).toBeLessThanOrEqual(8);
    }
  });

  it('la pupil·la no explica l’adaptació', () => {
    // De ple sol a nit tancada l'àrea només canvia un factor ~25, i la llum
    // canvia deu ordres de magnitud. La resta la fa la retina, i per això el
    // model no es basa en la pupil·la.
    const areaRatio = (pupilDiameterMm(1e-8) / pupilDiameterMm(1e4)) ** 2;
    expect(areaRatio).toBeLessThan(40);
  });
});

describe('visionRegime', () => {
  it('classifica els tres règims segons CIE 191', () => {
    expect(visionRegime(sceneLuminanceCdM2(100_000))).toBe('photopic');
    // La totalitat cau al règim mesòpic: per això els colors se’n van.
    expect(visionRegime(sceneLuminanceCdM2(7))).toBe('mesopic');
    expect(visionRegime(sceneLuminanceCdM2(0.002))).toBe('scotopic');
  });
});

describe('perceivedBrightness', () => {
  it('l’ull adaptat veu l’escena "normal"', () => {
    expect(perceivedBrightness(1000, 1000)).toBeCloseTo(1, 12);
  });

  it('segueix una llei de potència compressiva', () => {
    // Dividir la llum per 10 no divideix la sensació per 10.
    const p = perceivedBrightness(100, 1000);
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThan(0.5);
  });
});

describe('steadyAdaptationLux', () => {
  it('segueix la llum, però no del tot', () => {
    // Si la seguís del tot, cap escena no semblaria mai més fosca que cap
    // altra, i un paisatge de lluna plena semblaria de dia.
    const bright = steadyAdaptationLux(100_000);
    const dim = steadyAdaptationLux(100);
    expect(dim).toBeLessThan(bright);
    expect(dim).toBeGreaterThan(100);
  });
});

describe('adaptEye', () => {
  it('a la foscor va molt més a poc a poc que a la llum', () => {
    expect(DARK_ADAPTATION_TAU_S).toBeGreaterThan(LIGHT_ADAPTATION_TAU_S * 10);

    const start = 50_000;
    const darker = adaptEye(start, 10, 5);
    const brighter = adaptEye(10, 50_000, 5);

    // COM ES MESURA "QUANT HA AVANÇAT L'ULL": en logaritme, no en lux.
    //
    // `adaptEye` relaxa el nivell d'adaptació de manera MULTIPLICATIVA (és el
    // que fa la retina: guanys, no restes). El que avança exponencialment és
    // log(adaptació), i per tant el progrés només vol dir alguna cosa mesurat
    // en log. Fer-ho amb el quocient de lux barreja dues preguntes diferents:
    // "quant ha avançat l'ull" i "com de gros era el salt". En un salt de 10 lx
    // a 65.000 lx, haver fet el 92% del camí en logaritme encara deixa el
    // quocient de lux a 0,49; en un salt petit, el mateix 92% el deixaria a
    // 0,98. Un llindar sobre el quocient de lux, doncs, no prova cap propietat
    // del model: prova la mida del salt que li hem posat al davant.
    const progress = (from: number, to: number, target: number): number =>
      (Math.log(to) - Math.log(from)) / (Math.log(target) - Math.log(from));

    // En cinc segons (2,5 constants de temps) l'ull ja ha fet el 92% del camí
    // cap amunt: 1 − e^(−5/2). Cap avall, amb τ = 40 s, amb prou feines l'11%.
    expect(progress(10, brighter, steadyAdaptationLux(50_000))).toBeGreaterThan(
      0.9,
    );
    expect(progress(start, darker, steadyAdaptationLux(10))).toBeLessThan(0.15);
    // I la conseqüència que importa: en cinc segons de foscor l'ull encara
    // conserva més de la meitat del nivell d'adaptació diürn. Això és el xoc
    // del segon contacte.
    expect(darker / start).toBeGreaterThan(0.5);
  });

  it('convergeix cap al nivell d’equilibri i no el passa de llarg', () => {
    let a = steadyAdaptationLux(100_000);
    const target = steadyAdaptationLux(7);
    for (let t = 0; t < 600; t++) a = adaptEye(a, 7, 1);
    expect(a).toBeCloseTo(target, 1);
    expect(a).toBeGreaterThanOrEqual(target - 1e-6);
  });

  it('amb pas de temps zero no es mou', () => {
    expect(adaptEye(1234, 1, 0)).toBe(1234);
  });

  it('el segon contacte és un cop de puny i els ulls s’hi van fent', () => {
    // Aquesta és la corba que explica per què la totalitat es viu com un
    // apagat de llum i no com un capvespre ràpid.
    const clear = clearSkyIlluminanceLux(60);
    const total = eclipseIlluminance(0, 60).totalLux;

    let adaptation = steadyAdaptationLux(clear);
    const shock = eyeState(total, clear, { adaptationLux: adaptation });
    expect(shock.perceivedFraction).toBeLessThan(0.08);

    for (let t = 0; t < 120; t++) adaptation = adaptEye(adaptation, total, 1);
    const settled = eyeState(total, clear, { adaptationLux: adaptation });
    expect(settled.perceivedFraction).toBeGreaterThan(shock.perceivedFraction * 3);
    // Però ni de bon tros arriba al nivell d'un ull ja fet a la foscor: en dos
    // minuts els bastons no arrenquen.
    const fullyAdapted = eyeState(total, clear);
    expect(settled.perceivedFraction).toBeLessThan(fullyAdapted.perceivedFraction);
  });
});

describe('colorfulness', () => {
  it('baixa amb la llum i s’ensorra al règim mesòpic', () => {
    expect(colorfulness(100_000)).toBeCloseTo(1, 2);
    expect(colorfulness(1000)).toBeGreaterThan(0.7);
    expect(colorfulness(7)).toBeLessThan(0.45);
    expect(colorfulness(0.002)).toBeCloseTo(0, 2);
  });

  it('és monòtona', () => {
    let previous = -1;
    for (const lux of [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10_000, 100_000]) {
      const c = colorfulness(lux);
      expect(c).toBeGreaterThan(previous);
      previous = c;
    }
  });
});

describe('eyeState', () => {
  it('amb el 95% del Sol tapat la llum cau 30 vegades i tu en notes 1,5', () => {
    // El número que justifica tot el mòdul, i el que cal ensenyar a qui es
    // planteja quedar-se fora de la franja.
    const clear = clearSkyIlluminanceLux(60);
    const lux = eclipseIlluminance(0.0335, 60).totalLux;
    const eye = eyeState(lux, clear);

    expect(eye.physicalDropFactor).toBeGreaterThan(20);
    expect(eye.physicalDropFactor).toBeLessThan(45);
    expect(eye.perceivedDropFactor).toBeGreaterThan(1.2);
    expect(eye.perceivedDropFactor).toBeLessThan(2);
    expect(eye.compensation).toBeGreaterThan(10);
    // I encara és de dia de ple: règim fotòpic.
    expect(eye.regime).toBe('photopic');
  });

  it('sense eclipsi no hi ha res a compensar', () => {
    const clear = clearSkyIlluminanceLux(30);
    const eye = eyeState(clear, clear);
    expect(eye.physicalFraction).toBeCloseTo(1, 6);
    expect(eye.perceivedFraction).toBeCloseTo(1, 6);
    expect(eye.compensation).toBeCloseTo(1, 6);
  });

  it('la compensació creix a mesura que l’eclipsi avança', () => {
    const clear = clearSkyIlluminanceLux(60);
    let previous = 0;
    for (const flux of [1, 0.5, 0.2, 0.08, 0.03, 0.006]) {
      const eye = eyeState(eclipseIlluminance(flux, 60).totalLux, clear);
      expect(eye.compensation).toBeGreaterThan(previous);
      previous = eye.compensation;
    }
  });

  it('un capvespre normal no despinta res respecte d’ell mateix', () => {
    // La comparació és sempre contra el MATEIX cel sense eclipsi, o sigui que
    // baixar de sol a crepuscle no compta com a enfosquiment anòmal.
    for (const h of [30, 5, 0, -3]) {
      const clear = clearSkyIlluminanceLux(h);
      expect(eyeState(clear, clear).perceivedFraction).toBeCloseTo(1, 6);
    }
  });
});
