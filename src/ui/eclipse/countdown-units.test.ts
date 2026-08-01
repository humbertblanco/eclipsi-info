/**
 * El compte enrere ha de cabre a la caixa.
 *
 * L'usuari ho va veure a la pantalla: amb l'eclipsi a onze dies vista sortien
 * quatre grups —«11 d 04 h 23 min 15 s»— i a 32 px de mono en un mòbil de
 * 390 px allò se'n va fora. Aquí no es mesuren píxels, que dependrien de la
 * font i del navegador; es fixa la regla que ho evita, que és no passar mai de
 * tres unitats i que les que hi surtin siguin les que informen.
 *
 * És un test de la lògica pura i no del component perquè la bateria d'aquest
 * projecte corre a Node sense DOM. La regla viu tota a `unitsFor`, així que
 * provar-la aquí prova el que decideix.
 */

import { describe, expect, it } from 'vitest';
import { split, unitsFor } from './countdownParts';

const at = (ms: number) => unitsFor(split(ms));

describe('unitats del compte enrere', () => {
  it('amb dies per davant no ensenya els segons', () => {
    expect(at(11 * 86_400_000 + 4 * 3_600_000 + 23 * 60_000 + 15_000)).toEqual([
      'd',
      'h',
      'min',
    ]);
  });

  it('el mateix dia ensenya hores, minuts i segons', () => {
    expect(at(4 * 3_600_000 + 23 * 60_000 + 15_000)).toEqual(['h', 'min', 's']);
  });

  it('a l’última hora, només minuts i segons', () => {
    expect(at(7 * 60_000 + 3_000)).toEqual(['min', 's']);
  });

  it('mai més de tres unitats, sigui quin sigui l’instant', () => {
    const spans = [
      0,
      999,
      59_000,
      3_599_999,
      3_600_000,
      86_399_999,
      86_400_000,
      365 * 86_400_000,
      5_000,
      3 * 86_400_000,
    ];
    for (const span of spans) {
      const units = at(span);
      expect(units.length).toBeGreaterThan(0);
      expect(units.length).toBeLessThanOrEqual(3);
    }
  });

  it('les unitats sempre van de gran a petita i sense forats', () => {
    const order = ['d', 'h', 'min', 's'];
    for (const span of [0, 60_000, 3_600_000, 86_400_000, 40 * 86_400_000]) {
      const units = at(span);
      const idx = units.map((u) => order.indexOf(u));
      for (let i = 1; i < idx.length; i++) expect(idx[i]).toBe(idx[i - 1] + 1);
    }
  });

  it('`split` reparteix bé el temps passat, que ve en negatiu', () => {
    expect(split(-(2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000))).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    });
  });
});
