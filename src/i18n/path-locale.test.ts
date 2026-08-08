import { describe, expect, it } from 'vitest';
import { localeFromPathname, pathnameForLocale, type Locale } from './index';
import { seoPath, type SeoRoute } from '../content/seo/routes';

describe('idioma compartible a la ruta', () => {
  it('reconeix català, castellà i anglès a l’arrel', () => {
    expect(localeFromPathname('/', '/')).toBe('ca');
    expect(localeFromPathname('/es', '/')).toBe('es');
    expect(localeFromPathname('/es/', '/')).toBe('es');
    expect(localeFromPathname('/en', '/')).toBe('en');
    expect(localeFromPathname('/en/', '/')).toBe('en');
    expect(localeFromPathname('/fr/', '/')).toBe('fr');
  });

  it('respecta una publicació dins d’un subdirectori', () => {
    expect(localeFromPathname('/eclipsi/', '/eclipsi/')).toBe('ca');
    expect(localeFromPathname('/eclipsi/es/', '/eclipsi/')).toBe('es');
    expect(localeFromPathname('/eclipsi/en/', '/eclipsi/')).toBe('en');
    expect(localeFromPathname('/eclipsi/fr/', '/eclipsi/')).toBe('fr');
    expect(pathnameForLocale('ca', '/eclipsi/')).toBe('/eclipsi/');
    expect(pathnameForLocale('es', '/eclipsi/')).toBe('/eclipsi/es/');
    expect(pathnameForLocale('en', '/eclipsi/')).toBe('/eclipsi/en/');
    expect(pathnameForLocale('fr', '/eclipsi/')).toBe('/eclipsi/fr/');
  });

  /*
   * LES RUTES D'AQUESTA PROVA ES GENEREN; NO S'ESCRIUEN.
   *
   * La versió anterior comprovava `/eclipsi/12-agost-2026/`,
   * `/es/eclipse/12-agosto-2026/` i `/fr/lieu/tarragone/`. Cap de les tres
   * existeix: la llesca de data és `12-08-2026` i el segment francès de ciutat
   * és `ville`, no `lieu`. Passaven totes perquè `localeFromPathname()` només
   * mira el primer segment i li és igual què hi hagi darrere — o sigui que la
   * prova no comprovava res del que el seu nom promet.
   *
   * Amb `seoPath()` les rutes són les que el generador escriurà de debò, i el
   * dia que un segment canviï, aquesta prova canviarà amb ell.
   */
  it('reconeix l’idioma a les pàgines editorials que es generen de debò', () => {
    const casos: [Locale, SeoRoute][] = [
      ['ca', { kind: 'eclipse', slug: '12-08-2026' }],
      ['es', { kind: 'city', slug: 'valencia', eclipseSlug: '12-08-2026' }],
      ['en', { kind: 'guide', slug: 'solar-eclipse-safety' }],
      ['fr', { kind: 'point', slug: 'cat-tarragona-anella-mediterrania', eclipseSlug: '12-08-2026' }],
    ];
    for (const [locale, route] of casos) {
      expect(localeFromPathname(seoPath(locale, route), '/'), seoPath(locale, route)).toBe(locale);
    }
    expect(localeFromPathname('/eclipsi/es/eclipse/2026/', '/eclipsi/')).toBe('es');
  });

  it('torna null fora de la base, que és l’únic cas en què pot', () => {
    /*
     * Aquesta asserció s'havia esborrat, i era la que documentava per què el
     * tipus de retorn és `Locale | null`. Dins de la base la funció no pot
     * tornar `null` mai —tot el que no és `es`, `en` o `fr` és català—, i per
     * tant l'única manera d'obtenir-lo és demanar un camí de FORA. Sense això,
     * la guarda `if (routed !== null)` de `detectLocale()` sembla morta i algú
     * la retiraria, amb la branca de `localStorage` al darrere.
     */
    expect(localeFromPathname('/una-altra-cosa/', '/eclipsi/')).toBeNull();
    expect(localeFromPathname('/eclipsi-vell/', '/eclipsi/')).toBeNull();
    // I dins de la base, mai: qualsevol camí desconegut és català.
    expect(localeFromPathname('/inventat/', '/')).toBe('ca');
  });
});
