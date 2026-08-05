import { describe, expect, it } from 'vitest';
import { getGuide } from './guide';

describe('guia específica de cada eclipsi', () => {
  it('no ensenya la secció de Sol baix per a l’eclipsi del 2 d’agost de 2027', () => {
    for (const locale of ['ca', 'es'] as const) {
      expect(
        getGuide(locale, '2027-08-02', { sunAltitudeDeg: 55 }).some(
          (section) => section.id === 'lowsun',
        ),
      ).toBe(false);
    }
  });

  it('la conserva per als eclipsis baixos de 2026 i 2028', () => {
    for (const eclipseId of ['2026-08-12', '2028-01-26']) {
      expect(
        getGuide('ca', eclipseId, { sunAltitudeDeg: 8 }).some(
          (section) => section.id === 'lowsun',
        ),
      ).toBe(true);
    }
  });

  it('depèn de la geometria local i no només de l’any', () => {
    expect(
      getGuide('ca', '2027-08-02', { sunAltitudeDeg: 10 }).some(
        (section) => section.id === 'lowsun',
      ),
    ).toBe(true);
    expect(
      getGuide('ca', '2026-08-12', { sunAltitudeDeg: 30 }).some(
        (section) => section.id === 'lowsun',
      ),
    ).toBe(false);
  });
});
