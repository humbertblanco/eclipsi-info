import { describe, expect, it } from 'vitest';
import { localeFromPathname, pathnameForLocale } from './index';

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

  it('reconeix l’idioma en pàgines editorials profundes', () => {
    expect(localeFromPathname('/eclipsi/12-agost-2026/', '/')).toBe('ca');
    expect(localeFromPathname('/es/eclipse/12-agosto-2026/', '/')).toBe('es');
    expect(localeFromPathname('/en/guide/solar-eclipse-safety/', '/')).toBe('en');
    expect(localeFromPathname('/fr/lieu/tarragone/', '/')).toBe('fr');
    expect(localeFromPathname('/eclipsi/es/eclipse/2026/', '/eclipsi/')).toBe('es');
  });
});
