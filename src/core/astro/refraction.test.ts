/**
 * Tests de `refraction.ts`.
 *
 * Els valors de referència de la capçalera de `refraction.ts` (0,48° a
 * l'horitzó, 0,29° a 2°, 0,07° a 12°) són els de la fórmula de Sæmundsson
 * (1986) amb l'atmosfera estàndard, i són els que fa servir tothom.
 *
 * A més, la refracció d'aquest mòdul està validada CONTRA L'IGN: la seva taula
 * de municipis publica l'altura aparent arrodonida a graus enters i les seves
 * infografies publiquen l'altura vertadera amb una dècima. Aplicant aquest
 * mòdul a la segona s'obté la primera als 39 municipis de la mostra, incloent-hi
 * Menorca amb el Sol a 1,4°, on la refracció val 0,33°. Aquesta comprovació és
 * a `tests/golden/circumstances.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { refractionDeg, applyRefraction, discFlattening } from './refraction';
import { STANDARD_ATMOSPHERE } from './constants';

describe('refractionDeg', () => {
  /**
   * Valors exactes de Sæmundsson a 1010 mb i 10 °C, calculats a mà amb
   * R = 1,02 / tan(h + 10,3/(h + 5,11)) minuts d'arc.
   *
   * Ull amb la capçalera de `refraction.ts`: hi diu «a 2° → ~0,29°» i «a 5° →
   * ~0,17°», i la fórmula en dona 0,282° i 0,161°. Són les xifres rodones de
   * les taules a l'ús, que estan tabulades per altura APARENT, no vertadera.
   * La diferència (0,008°) no té cap efecte pràctic, però els tests van contra
   * el que la fórmula calcula de veritat, no contra la xifra arrodonida.
   */
  const SAEMUNDSSON: Array<[number, number]> = [
    [0, 0.48303],
    [2, 0.28210],
    [5, 0.16124],
    [12, 0.07604],
    [20, 0.04569],
    [45, 0.01688],
  ];

  it.each(SAEMUNDSSON)('a %s° val %s°', (altitude, expected) => {
    expect(refractionDeg(altitude)).toBeCloseTo(expected, 5);
  });

  it('coincideix amb les xifres rodones documentades al mòdul', () => {
    // Tolerància de 0,01° perquè les xifres de la capçalera estan arrodonides
    // a dos decimals i, com s'explica més amunt, tabulades per altura aparent.
    const documented: Array<[number, number]> = [
      [0, 0.48],
      [2, 0.29],
      [5, 0.17],
      [12, 0.07],
    ];
    for (const [altitude, rounded] of documented) {
      expect(Math.abs(refractionDeg(altitude) - rounded)).toBeLessThanOrEqual(0.01);
    }
  });

  it('al zenit és pràcticament nul·la', () => {
    // Sæmundsson no s'anul·la exactament a 90°: hi dona −0,00003°, és a dir
    // −0,12 segons d'arc de refracció negativa, que no té sentit físic però
    // tampoc cap conseqüència (és mil vegades més petit que el disc solar).
    // Es documenta aquí perquè ningú no s'espanti si mai ho veu.
    expect(Math.abs(refractionDeg(90))).toBeLessThan(0.001);
  });

  it('prop de l’horitzó val més que el radi del Sol', () => {
    // El fet que justifica tot aquest mòdul: als eclipsis de 2026 i 2028 a
    // Espanya la refracció desplaça el Sol més del que fa el seu propi disc.
    const sunRadius = 0.2634;
    expect(refractionDeg(0)).toBeGreaterThan(sunRadius);
    expect(refractionDeg(2)).toBeGreaterThan(sunRadius);
    // A 12° ja no: allà la refracció és petita comparada amb el disc.
    expect(refractionDeg(12)).toBeLessThan(sunRadius);
  });

  it('decreix de manera monòtona amb l’altura', () => {
    let previous = Infinity;
    for (let h = 0; h <= 89; h += 0.5) {
      const r = refractionDeg(h);
      expect(r).toBeLessThan(previous);
      previous = r;
    }
  });

  it('és sempre positiva i finita, també per sota de l’horitzó', () => {
    // La saturació a −1,9° existeix perquè la tangent de la fórmula explota
    // just per sota. Sense ella el motor tornaria valors absurds mentre busca
    // la posta de Sol, que és exactament on més s'usa.
    for (const h of [-5, -3, -1.9, -1, -0.833, 0]) {
      const r = refractionDeg(h);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(1);
    }
  });

  it('l’aire fred i dens refracta més que el càlid i enrarit', () => {
    const cold = refractionDeg(2, { pressureMb: 1030, temperatureC: -5 });
    const standard = refractionDeg(2, STANDARD_ATMOSPHERE);
    const warm = refractionDeg(2, { pressureMb: 980, temperatureC: 35 });
    expect(cold).toBeGreaterThan(standard);
    expect(standard).toBeGreaterThan(warm);
  });

  it('l’atmosfera estàndard és el valor per defecte', () => {
    expect(refractionDeg(3)).toBe(refractionDeg(3, STANDARD_ATMOSPHERE));
  });

  it('escala linealment amb la pressió', () => {
    const half = refractionDeg(10, { pressureMb: 505, temperatureC: 10 });
    const full = refractionDeg(10, { pressureMb: 1010, temperatureC: 10 });
    expect(half).toBeCloseTo(full / 2, 10);
  });
});

describe('applyRefraction', () => {
  it('suma la refracció a l’altura geomètrica', () => {
    expect(applyRefraction(2)).toBeCloseTo(2 + refractionDeg(2), 12);
  });

  it('puja el Sol per sobre de l’horitzó quan geomètricament ja s’ha post', () => {
    // Per això la posta "oficial" es defineix a −0,833° d'altura vertadera:
    // amb refracció el disc encara es veu sencer.
    expect(applyRefraction(-0.4)).toBeGreaterThan(0);
  });

  it('és monòtona creixent (no capgira l’ordre de dos astres)', () => {
    // Si no ho fos, un astre més alt podria semblar més baix i la vista de
    // realitat augmentada dibuixaria la Lluna per sobre del Sol.
    let previous = -Infinity;
    for (let h = -1.5; h <= 90; h += 0.25) {
      const a = applyRefraction(h);
      expect(a).toBeGreaterThan(previous);
      previous = a;
    }
  });
});

describe('discFlattening', () => {
  const sunRadius = 0.2634;

  it('a gran altura el disc és rodó', () => {
    expect(discFlattening(80, sunRadius)).toBeCloseTo(1, 3);
  });

  it('a 2° d’altura l’aplanament ronda el 8%', () => {
    const f = discFlattening(2, sunRadius);
    expect(f).toBeGreaterThan(0.88);
    expect(f).toBeLessThan(0.96);
  });

  it('a l’horitzó l’aplanament ronda el 18%', () => {
    const f = discFlattening(0, sunRadius);
    expect(f).toBeGreaterThan(0.76);
    expect(f).toBeLessThan(0.88);
  });

  it('sempre aplana, mai no estira', () => {
    for (let h = 0; h <= 90; h += 1) {
      const f = discFlattening(h, sunRadius);
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThanOrEqual(1.000001);
    }
  });

  it('com més amunt, més rodó', () => {
    let previous = -Infinity;
    for (let h = 0.5; h <= 60; h += 0.5) {
      const f = discFlattening(h, sunRadius);
      expect(f).toBeGreaterThan(previous);
      previous = f;
    }
  });
});
