/**
 * Tests de `lightState()`: la connexió entre el model físic de `core/sky` i el
 * filtre CSS que s'aplica al vídeo de la càmera.
 *
 * El que aquí es blinda no és cap decimal del filtre, és el MISSATGE. La vista
 * de càmera existeix per respondre "i si em quedo a trenta quilòmetres de la
 * franja, què veuré?", i la resposta honesta té tres peces:
 *
 *   1. sense eclipsi el filtre no ha de tocar res,
 *   2. amb el 95% del Sol tapat encara ha de semblar de dia, perquè la llum
 *      ha caigut trenta vegades però l'ull se n'empassa vint,
 *   3. a la totalitat el filtre ha de canviar de naturalesa, no de grau.
 *
 * Si algun dia algú torna a posar-hi una corba triada a ull, el punt 2 és el
 * que se'n ressentirà primer: totes les corbes inventades fan que el 95%
 * sembli fosc, i és mentida.
 */

import { describe, expect, it } from 'vitest';
import type { EclipseSample } from '../../core/astro/types';
import { coveredAreaFraction } from '../../core/sky';
import { lightState } from './renderMixed';

/** Radis angulars típics d'un eclipsi total: k = R_lluna/R_sol ≈ 1,02. */
const SUN_RADIUS_DEG = 0.2666;
const MOON_RADIUS_DEG = 0.2724;

/**
 * Separació dels centres que dona aquesta obscuració, per bisecció.
 *
 * Cal construir la mostra amb la GEOMETRIA coherent i no només amb el número
 * d'obscuració, perquè `lightState` passa els dos radis i la separació al
 * model i el model se'ls creu: és així com pot integrar l'enfosquiment del
 * limbe en comptes d'estimar-lo.
 */
function separationForObscuration(obscuration: number): number {
  if (obscuration <= 0) return SUN_RADIUS_DEG + MOON_RADIUS_DEG + 0.1;
  if (obscuration >= 1) return 0;

  let lo = 0;
  let hi = SUN_RADIUS_DEG + MOON_RADIUS_DEG;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (coveredAreaFraction(mid, SUN_RADIUS_DEG, MOON_RADIUS_DEG) > obscuration) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

function sampleAt(obscuration: number, altitudeDeg: number): EclipseSample {
  const separation = separationForObscuration(obscuration);
  return {
    time: new Date('2026-08-12T20:30:00Z'),
    sun: {
      azimuth: 280,
      altitudeTrue: altitudeDeg,
      altitudeApparent: altitudeDeg,
      ra: 9.4,
      dec: 14.5,
      distanceAu: 1.013,
      angularRadius: SUN_RADIUS_DEG,
    },
    moon: {
      azimuth: 280,
      altitudeTrue: altitudeDeg,
      altitudeApparent: altitudeDeg,
      ra: 9.4,
      dec: 14.5,
      distanceAu: 0.0024,
      angularRadius: MOON_RADIUS_DEG,
    },
    separation,
    magnitude: Math.max(
      0,
      (SUN_RADIUS_DEG + MOON_RADIUS_DEG - separation) / (2 * SUN_RADIUS_DEG),
    ),
    obscuration: coveredAreaFraction(separation, SUN_RADIUS_DEG, MOON_RADIUS_DEG),
  };
}

/** Els tres factors del filtre CSS, per poder-los provar un per un. */
function filterValues(cssFilter: string): {
  brightness: number;
  saturate: number;
  contrast: number;
} {
  const read = (name: string): number => {
    const match = new RegExp(`${name}\\(([0-9.]+)\\)`).exec(cssFilter);
    expect(match, `el filtre hauria de portar ${name}(): ${cssFilter}`).not.toBeNull();
    return Number(match?.[1]);
  };
  return {
    brightness: read('brightness'),
    saturate: read('saturate'),
    contrast: read('contrast'),
  };
}

describe('lightState: sense eclipsi', () => {
  it('amb obscuració 0 el filtre és neutre, sigui quina sigui l’altura', () => {
    // El filtre representa el que l'eclipsi CANVIA sobre la imatge de la
    // càmera. Sense eclipsi no hi ha res a canviar, i això ha de valer tant
    // amb el Sol alt com amb el Sol a 2°, que és com el tindrem el 2026.
    for (const altitude of [60, 30, 12, 5, 2]) {
      const light = lightState(sampleAt(0, altitude));
      const { brightness, saturate, contrast } = filterValues(light.cssFilter);

      expect(brightness).toBeCloseTo(1, 3);
      expect(saturate).toBeCloseTo(1, 3);
      expect(contrast).toBeCloseTo(1, 3);
      expect(light.physicalFraction).toBeCloseTo(1, 4);
      expect(light.perceived).toBeCloseTo(1, 4);
    }
  });
});

describe('lightState: el 95% encara sembla de dia', () => {
  it('la llum cau trenta vegades i la imatge amb prou feines s’enfosqueix', () => {
    // EL PUNT CLAU DE TOTA L'APLICACIÓ.
    const light = lightState(sampleAt(0.95, 60));
    const { brightness, saturate } = filterValues(light.cssFilter);

    // La física: amb el 95% de l'ÀREA tapada queda un 3,4% de la llum, no un
    // 5%, perquè el que resta és la vora fosca del disc.
    expect(light.physicalFraction).toBeLessThan(0.045);
    expect(light.physicalFraction).toBeGreaterThan(0.02);

    // La percepció: l'ull s'ha ajustat i encara veu dues terceres parts de la
    // claror. Amb la corba d'arrel cúbica que hi havia abans això sortia 0,32,
    // és a dir "s'ha fet fosc", i és fals.
    expect(light.perceived).toBeGreaterThan(0.6);
    expect(brightness).toBeGreaterThan(0.6);

    // I el color encara hi és gairebé tot: el viratge metàl·lic ve després.
    expect(saturate).toBeGreaterThan(0.75);

    // La compensació de l'ull, en una línia: la caiguda física és més de deu
    // vegades més gran que la percebuda.
    const physicalDrop = 1 / light.physicalFraction;
    const perceivedDrop = 1 / light.perceived;
    expect(physicalDrop / perceivedDrop).toBeGreaterThan(10);
  });

  it('encara al 99% la imatge no ha caigut ni a la meitat', () => {
    const light = lightState(sampleAt(0.99, 60));
    expect(light.physicalFraction).toBeLessThan(0.01);
    expect(light.perceived).toBeGreaterThan(0.45);
  });

  it('el 95% amb el Sol baix es nota igual de poc', () => {
    // La comparació és sempre contra el mateix cel sense eclipsi, de manera
    // que un Sol a 2° no fa que l'eclipsi sembli més profund del que és: el
    // que fa és que TOT plegat sigui més fosc, i això la càmera ja ho veurà.
    const high = lightState(sampleAt(0.95, 60));
    const low = lightState(sampleAt(0.95, 2));
    expect(low.perceived).toBeCloseTo(high.perceived, 2);
  });
});

describe('lightState: totalitat', () => {
  it('la totalitat és fosca de debò i despintada', () => {
    const light = lightState(sampleAt(1, 60));
    const { brightness, saturate, contrast } = filterValues(light.cssFilter);

    // Uns 7 lux sobre 97.000: quatre ordres de magnitud, i és el que mesuren
    // les totalitats amb el Sol alt.
    expect(light.physicalFraction).toBeLessThan(2e-4);
    expect(light.physicalFraction).toBeGreaterThan(1e-5);

    // La imatge cau a un terç llarg i perd més de la meitat del color: el
    // paisatge ha entrat al règim mesòpic i els bastons no veuen colors.
    expect(brightness).toBeLessThan(0.4);
    expect(saturate).toBeLessThan(0.6);
    expect(contrast).toBeGreaterThan(1.3);
  });

  it('la diferència amb el 95% és de naturalesa, no de grau', () => {
    const partial = lightState(sampleAt(0.95, 60));
    const total = lightState(sampleAt(1, 60));

    // La llum cau 500 vegades més...
    expect(partial.physicalFraction / total.physicalFraction).toBeGreaterThan(200);
    // ...i tot i la compensació de l'ull, la imatge es parteix per dos.
    expect(partial.perceived / total.perceived).toBeGreaterThan(1.8);
  });
});

describe('lightState: la corba sencera', () => {
  it('brightness i physicalFraction baixen sempre en tapar-se més Sol', () => {
    let previousBrightness = Infinity;
    let previousFraction = Infinity;
    for (const obsc of [0, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 0.999, 1]) {
      const light = lightState(sampleAt(obsc, 40));
      const { brightness } = filterValues(light.cssFilter);
      expect(brightness).toBeLessThan(previousBrightness);
      expect(light.physicalFraction).toBeLessThan(previousFraction);
      previousBrightness = brightness;
      previousFraction = light.physicalFraction;
    }
  });

  it('reprodueix l’escala de l’AAS, amb l’enfosquiment del limbe inclòs', () => {
    // Referència: 100.000 lx amb Sol ple, 25.000 al 75%, ~1.000 al 99%.
    // Sobre el global horitzontal de cel serè (uns 115.000 lx amb el Sol al
    // zenit) això són fraccions de 0,25 i 0,01. El model n'hi posa una mica
    // menys perquè hi entra l'enfosquiment del limbe, que l'escala lineal de
    // l'AAS no té: al 75% queda el 21% del flux i al 99%, el 0,58%.
    const at75 = lightState(sampleAt(0.75, 90)).physicalFraction;
    const at99 = lightState(sampleAt(0.99, 90)).physicalFraction;

    expect(at75).toBeGreaterThan(0.18);
    expect(at75).toBeLessThan(0.25);
    expect(at99).toBeGreaterThan(0.004);
    expect(at99).toBeLessThan(0.01);
  });

  it('el filtre sempre és una cadena CSS vàlida i acotada', () => {
    for (const obsc of [0, 0.5, 0.9, 0.99, 1]) {
      for (const altitude of [60, 12, 2]) {
        const light = lightState(sampleAt(obsc, altitude));
        expect(light.cssFilter).toMatch(
          /^brightness\([0-9.]+\) saturate\([0-9.]+\) contrast\([0-9.]+\)$/,
        );
        const { brightness, saturate, contrast } = filterValues(light.cssFilter);
        expect(brightness).toBeGreaterThan(0);
        expect(brightness).toBeLessThanOrEqual(1);
        expect(saturate).toBeGreaterThanOrEqual(0);
        expect(saturate).toBeLessThanOrEqual(1);
        expect(contrast).toBeGreaterThanOrEqual(1);
        expect(contrast).toBeLessThan(1.4);
      }
    }
  });
});
