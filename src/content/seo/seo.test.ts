import { describe, expect, it } from 'vitest';
import { ECLIPSES } from '../../core/eclipses/catalog';
import { pointsForEclipse } from '../../data/observation-points/catalog';
import { SEO_CITIES } from './cities';
import { SEO_LOCALES, prefix } from './strings';
import { SEO_EVENT_WINDOWS } from './events';

describe('catàleg de pàgines SEO', () => {
  it('té identificadors i coordenades de ciutat únics i vàlids', () => {
    expect(new Set(SEO_CITIES.map((city) => city.id)).size).toBe(SEO_CITIES.length);
    for (const city of SEO_CITIES) {
      expect(city.id).toMatch(/^[a-z0-9-]+$/);
      expect(city.lat).toBeGreaterThanOrEqual(-90);
      expect(city.lat).toBeLessThanOrEqual(90);
      expect(city.lon).toBeGreaterThanOrEqual(-180);
      expect(city.lon).toBeLessThanOrEqual(180);
      for (const locale of SEO_LOCALES) {
        expect(city.name[locale]).not.toBe('');
        expect(city.region[locale]).not.toBe('');
        expect(city.context[locale]).not.toBe('');
      }
    }
  });

  it('pot generar les quatre variants de totes les entitats', () => {
    expect(SEO_LOCALES).toEqual(['ca', 'es', 'en', 'fr']);
    expect(prefix('ca')).toBe('');
    expect(prefix('fr')).toBe('fr/');
    const entities = ECLIPSES.length + ECLIPSES.length * SEO_CITIES.length
      + ECLIPSES.reduce((sum, eclipse) => sum + pointsForEclipse(eclipse.id).length, 0);
    // Les entitats locals més les tres guies editorials, totes en 4 idiomes.
    expect((entities + 3) * SEO_LOCALES.length).toBe(1312);
  });

  it('cada interval global conté el màxim de l’eclipsi', () => {
    for (const eclipse of ECLIPSES) {
      const window = SEO_EVENT_WINDOWS[eclipse.id];
      expect(window).toBeDefined();
      const maximum = Date.parse(eclipse.greatestEclipseUtc);
      expect(Date.parse(window.start)).toBeLessThan(maximum);
      expect(Date.parse(window.end)).toBeGreaterThan(maximum);
      for (const locale of SEO_LOCALES) expect(window.area[locale]).not.toBe('');
    }
  });
});
