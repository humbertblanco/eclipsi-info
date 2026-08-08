import { describe, expect, it } from 'vitest';
import { ECLIPSES } from '../../core/eclipses/catalog';
import { pointsForEclipse } from '../../data/observation-points/catalog';
import { EDITORIAL_GUIDE_IDS } from '../editorial-guides';
import { SEO_CITIES } from './cities';
import { SEO_LOCALES, prefix } from './strings';
import { SEO_EVENT_WINDOWS } from './events';
import { eclipseDateSlug, eclipseIdFromSlug } from './dateSlug';

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
    /*
     * EL NOMBRE ES DERIVA; EL 1312 ESCRIT A MÀ NO ERA EL QUE ES GENERAVA.
     *
     * Aquesta línia deia `toBe(1312)` i el generador n'escrivia 1.316. La
     * diferència són els quatre índexs de guies, un per idioma, que el compte
     * es deixava. Passava en verd perquè el compte i l'expectativa eren el
     * mateix error escrit dues vegades: cap dels dos costats no havia mirat mai
     * el generador.
     *
     * Ara el compte diu d'on surt cada terme, i el que el compara amb la
     * realitat és `scripts/check-built-html.ts`, que recorre el `dist/` de debò
     * al final de cada build.
     */
    const perLocale =
      ECLIPSES.length + // una fitxa per eclipsi
      ECLIPSES.length * SEO_CITIES.length + // cada ciutat a cada eclipsi
      ECLIPSES.reduce((sum, eclipse) => sum + pointsForEclipse(eclipse.id).length, 0) +
      EDITORIAL_GUIDE_IDS.length + // les guies editorials
      1; // el seu índex
    // 1.560 = 4 idiomes × (3 eclipsis + 3×37 ciutats + 272 punts + 3 guies + 1
    // índex). Va pujar de 1.316 el dia que el catàleg de ciutats va deixar de
    // ser només el de la franja del 2026: vegeu la capçalera de `cities.ts`.
    expect(perLocale * SEO_LOCALES.length).toBe(1560);
  });

  it('cada eclipsi té una àrea escrita en els quatre idiomes', () => {
    /*
     * AQUESTA PROVA ES DEIA «cada interval global conté el màxim de l'eclipsi» I
     * COMPROVAVA UNA COSA FALSA.
     *
     * El màxim global de l'anular del 2028 és a les 15:08:59 UTC i el primer
     * contacte entre tots els llocs que publiquem és a les 15:32:13: l'ombra
     * arriba a la península vint-i-quatre minuts més tard. Exigir que la
     * finestra contingui el màxim global obligava a inflar-la —la del 2028
     * començava dues hores i mitja abans que cap contacte real— i la prova
     * passava en verd mentre el JSON-LD contradeia la taula de la mateixa
     * pàgina.
     *
     * L'interval ara el deriva del motor `content/seo/events.ts`, i qui el
     * compara amb els contactes publicats és `content/seo/events.test.ts`. Aquí
     * hi queda el que sí que és d'aquest fitxer: que el topònim hi sigui.
     */
    for (const eclipse of ECLIPSES) {
      const window = SEO_EVENT_WINDOWS[eclipse.id];
      expect(window).toBeDefined();
      for (const locale of SEO_LOCALES) expect(window.area[locale]).not.toBe('');
    }
  });

  it('presenta les dates públiques en format europeu sense canviar l’id del motor', () => {
    expect(eclipseDateSlug('2026-08-12')).toBe('12-08-2026');
    expect(eclipseIdFromSlug('12-08-2026')).toBe('2026-08-12');
    expect(eclipseIdFromSlug('2026-08-12')).toBe('2026-08-12');
    expect(eclipseIdFromSlug('12/08/2026')).toBeNull();
  });
});
