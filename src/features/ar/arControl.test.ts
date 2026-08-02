/**
 * El rellotge governat: l'índex de mostra per a un instant.
 *
 * És la peça pura del contracte «un sol rellotge» entre SkyScreen i ARView:
 * el regle del HUD mou l'instant, l'instant tria la mostra, i els extrems han
 * de caure exactes — el C1 a la primera i el C4 a l'última.
 */

import { describe, expect, it } from 'vitest';
import { sampleIndexForTime } from './ARView';

describe('l’índex de mostra per a un instant', () => {
  const START = 1_000_000;
  const END = 2_000_000;
  const COUNT = 161;

  it('els extrems cauen a la primera i l’última mostra exactes', () => {
    expect(sampleIndexForTime(START, START, END, COUNT)).toBe(0);
    expect(sampleIndexForTime(END, START, END, COUNT)).toBe(COUNT - 1);
  });

  it('fora de rang es reté als extrems', () => {
    expect(sampleIndexForTime(START - 5000, START, END, COUNT)).toBe(0);
    expect(sampleIndexForTime(END + 5000, START, END, COUNT)).toBe(COUNT - 1);
  });

  it('el punt mitjà cau al mig, i l’índex és monòton', () => {
    expect(sampleIndexForTime((START + END) / 2, START, END, COUNT)).toBe(80);
    let prev = -1;
    for (let t = START; t <= END; t += 25_000) {
      const i = sampleIndexForTime(t, START, END, COUNT);
      expect(i).toBeGreaterThanOrEqual(prev);
      prev = i;
    }
  });

  it('una finestra degenerada no divideix per zero', () => {
    expect(sampleIndexForTime(123, 500, 500, COUNT)).toBe(0);
    expect(sampleIndexForTime(123, 500, 400, COUNT)).toBe(0);
    expect(sampleIndexForTime(123, 0, 1000, 1)).toBe(0);
    expect(sampleIndexForTime(123, 0, 1000, 0)).toBe(0);
  });
});
