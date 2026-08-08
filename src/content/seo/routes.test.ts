/**
 * LA PROVA QUE HAURIA ESTALVIAT LES 1.328 PÀGINES INVISIBLES.
 *
 * El defecte que va passar no era una opció mal escrita: era que la frase
 * «aquests camins no són de l'app» vivia a dos llocs —el generador i la
 * configuració del service worker— i el segon no ho sabia. El resultat va ser
 * que el `navigateFallback` responia l'esquelet de l'app a totes les URL
 * editorials, i qui hi arribava de Google veia l'app amb el punt que tingués
 * desat de l'última sessió.
 *
 * Aquesta prova compara les dues coses que abans no es miraven: **el camí que
 * el generador escriurà de debò** i **el patró que el service worker farà
 * servir per no tocar-lo**. Si algú afegeix una mena de pàgina i se n'oblida a
 * `SEO_SEGMENTS`, o si algú toca el patró, aquí es veu.
 *
 * I la comprovació inversa, que és igual d'important: les rutes que SÍ que són
 * de l'app —l'arrel de cada idioma i «Com funciona», que l'app llegeix de
 * `location.pathname`— han de continuar caient dins del fallback. Un patró
 * massa ample deixaria l'app sense esquelet offline, que és el defecte contrari
 * i es notaria molt menys.
 */

import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../i18n';
import {
  SEO_FIRST_SEGMENTS,
  SEO_LOCALE_CODES,
  SEO_PRECACHE_IGNORES,
  SEO_SEGMENTS,
  SEO_SITE,
  seoNavigationDenylist,
  seoPath,
  seoPrefix,
  seoUrl,
  type SeoKind,
} from './routes';

const KINDS: SeoKind[] = ['eclipse', 'city', 'point', 'guide', 'guides'];

/** Un camí d'exemple per a cada mena, amb dades que existeixen de debò. */
const EXEMPLES: Record<SeoKind, { slug: string; eclipseSlug?: string }> = {
  eclipse: { slug: '12-08-2026' },
  city: { slug: 'barcelona', eclipseSlug: '12-08-2026' },
  point: { slug: 'cat-tarragona-anella-mediterrania', eclipseSlug: '12-08-2026' },
  guide: { slug: 'seguretat-eclipsi-solar' },
  guides: { slug: '' },
};

describe('les rutes editorials', () => {
  it('parla dels mateixos idiomes que l’app', () => {
    // Si algú afegeix un idioma a l'app i no aquí, es generarien pàgines a
    // mitges: nav amb quatre banderes i canòniques amb tres.
    expect([...SEO_LOCALE_CODES]).toEqual([...LOCALES]);
    for (const locale of SEO_LOCALE_CODES) {
      expect(Object.keys(SEO_SEGMENTS[locale]).sort()).toEqual([...KINDS].sort());
    }
  });

  it('el català viu a l’arrel i la resta en subdirectori', () => {
    expect(seoPrefix('ca')).toBe('');
    expect(seoPrefix('es')).toBe('es/');
    expect(seoPrefix('fr')).toBe('fr/');
  });

  it('tot camí té barra inicial i barra final, i cap de doble', () => {
    // La barra final evita una redirecció 301 per visita. La barra doble no ha
    // arribat a passar mai, i per això es prova: aquí és on apareixeria el dia
    // que algú compongui un camí amb un prefix que ja porti barra.
    for (const locale of SEO_LOCALE_CODES) {
      for (const kind of KINDS) {
        const path = seoPath(locale, { kind, ...EXEMPLES[kind] });
        expect(path.startsWith('/'), `${locale}/${kind}: ${path}`).toBe(true);
        expect(path.endsWith('/'), `${locale}/${kind}: ${path}`).toBe(true);
        expect(path.includes('//'), `${locale}/${kind}: ${path}`).toBe(false);
        expect(seoUrl(locale, { kind, ...EXEMPLES[kind] })).toBe(`${SEO_SITE}${path.slice(1)}`);
      }
    }
  });

  it('la fitxa local porta l’eclipsi al camí i la pàgina d’eclipsi no el repeteix', () => {
    expect(seoPath('ca', EXEMPLES.city && { kind: 'city', ...EXEMPLES.city })).toBe(
      '/ciutat/barcelona/12-08-2026/',
    );
    expect(seoPath('fr', { kind: 'point', ...EXEMPLES.point })).toBe(
      '/fr/site-officiel/cat-tarragona-anella-mediterrania/12-08-2026/',
    );
    expect(seoPath('en', { kind: 'eclipse', ...EXEMPLES.eclipse })).toBe('/en/eclipse/12-08-2026/');
    expect(seoPath('es', { kind: 'guides', slug: '' })).toBe('/es/guia/');
  });
});

describe('el service worker i les pàgines editorials', () => {
  const denylist = seoNavigationDenylist();
  const casa = (path: string) => denylist.some((pattern) => pattern.test(path));

  it('cap camí que el generador escriurà no el pot servir l’esquelet de l’app', () => {
    // AQUESTA és la comparació que faltava. No es prova el patró contra unes
    // cadenes escrites a mà: es prova contra el que `seoPath()` generarà.
    for (const locale of SEO_LOCALE_CODES) {
      for (const kind of KINDS) {
        const path = seoPath(locale, { kind, ...EXEMPLES[kind] });
        expect(casa(path), `${path} l’hauria de servir el fitxer, no l’app`).toBe(true);
      }
    }
  });

  it('les rutes que SÍ que són de l’app continuen tenint esquelet', () => {
    // «Com funciona» i la seva subpàgina de premsa les llegeix `App.tsx` de
    // `location.pathname`: si el patró se les mengés, quedarien sense app.
    for (const path of [
      '/',
      '/es/',
      '/en/',
      '/fr/',
      '/com-funciona/',
      '/com-funciona/premsa/',
      '/es/com-funciona/',
      '/fr/com-funciona/premsa/',
    ]) {
      expect(casa(path), `${path} és una ruta de l’app i necessita l’esquelet`).toBe(false);
    }
  });

  it('el precache ignora exactament els mateixos primers segments', () => {
    // Dues llistes derivades de la mateixa font no poden divergir; el que es
    // comprova aquí és que segueixin derivant-se'n i no se n'hagi escrit una.
    expect(SEO_PRECACHE_IGNORES).toEqual(SEO_FIRST_SEGMENTS.map((s) => `**/${s}/**`));
    expect(SEO_FIRST_SEGMENTS).toContain('guia');
    // «guia» el comparteixen la guia i el seu índex: ha de sortir un sol cop.
    expect(SEO_FIRST_SEGMENTS.filter((s) => s === 'guia')).toHaveLength(1);
  });
});
