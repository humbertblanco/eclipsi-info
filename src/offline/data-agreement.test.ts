/**
 * L'ACORD DELS CATÀLEGS DE `public/data/`: que qui els escriu, qui els demana i
 * qui els desa parlin del mateix fitxer.
 *
 * És el tercer germà de `terrain-agreement.test.ts` i `basemap-agreement.test.ts`,
 * i vigila la mateixa família d'errors, que en aquest projecte ja té historial:
 * una banda canvia un nom, l'altra no se n'assabenta, tot funciona a casa —hi ha
 * xarxa— i al camp la capa no hi és. Aquí les bandes són tres:
 *
 *  1. `scripts/build-viewpoints.ts` i `scripts/build-cloud-clim.ts` escriuen el
 *     fitxer amb el nom que diuen `viewpointsFileName()` (core/places) i
 *     `climGridFileName()` (core/weather).
 *  2. `src/offline/config.ts` en compon la URL. NO importa aquelles funcions a
 *     posta —vegeu-hi el comentari: arrossegaria mig `core/places` cap al paquet
 *     de la primera pintada i cap a scripts de Node—, o sigui que el nom hi és
 *     repetit i aquesta prova és l'única cosa que impedeix que se separin.
 *  3. El service worker (`vite.config.ts`) els desa amb una regla de
 *     `runtimeCaching` que casa per patró de camí. Si la URL deixés de casar-hi,
 *     el fitxer no entraria mai a `eclipsi-dades-v1`.
 *
 * NO ES FA XARXA DES D'AQUÍ. El que es compara són cadenes.
 */

import { describe, expect, it } from 'vitest';
import { cloudClimDataUrl, dataFileUrl, viewpointsDataUrl } from './config';
import { viewpointsFileName } from '../core/places/viewpoints';
import { climGridFileName } from '../core/weather/climGrid';

/**
 * El patró de la regla de `runtimeCaching` de `vite.config.ts`, copiat.
 *
 * Copiat i no importat perquè `vite.config.ts` és configuració de compilació i
 * no un mòdul del paquet. Que sigui una còpia és justament el motiu pel qual
 * val la pena que hi hagi una prova que la fa servir de debò.
 */
const SW_DATA_PATTERN = /\/data\/[^/]+\.json$/i;

const ECLIPSES = ['2026-08-12', '2027-08-02', '2028-01-26'];

describe('les URL dels catàlegs de dades', () => {
  it('diuen el mateix nom de fitxer que qui els escriu', () => {
    for (const id of ECLIPSES) {
      // `viewpointsFileName` ja porta la carpeta a dins; `climGridFileName`, no.
      expect(viewpointsDataUrl(id)).toBe(`/${viewpointsFileName(id)}`);
      expect(cloudClimDataUrl(id)).toBe(`/data/${climGridFileName(id)}`);
    }
  });

  it('casen amb la regla del service worker', () => {
    // Sense això, el fitxer no entraria a `eclipsi-dades-v1` i la capa seria
    // l'única cosa de l'app que no funciona sense cobertura.
    for (const id of ECLIPSES) {
      expect(viewpointsDataUrl(id)).toMatch(SW_DATA_PATTERN);
      expect(cloudClimDataUrl(id)).toMatch(SW_DATA_PATTERN);
    }
  });

  it('respecten el subdirectori del desplegament', () => {
    /*
     * El desplegament de llegat viu a `lacuinade.estic.online/eclipsi/` i
     * `BASE_URL` hi val `/eclipsi/`. Amb la URL absoluta escrita a mà, allà els
     * catàlegs serien un 404 silenciós: la capa no apareixeria i no ho diria
     * ningú.
     */
    expect(viewpointsDataUrl('2026-08-12', '/eclipsi/')).toBe(
      '/eclipsi/data/viewpoints-2026-08-12.json',
    );
    expect(cloudClimDataUrl('2026-08-12', '/eclipsi/')).toBe(
      '/eclipsi/data/clouds-clim-2026-08-12.json',
    );
  });

  it('toleren una arrel sense barra final', () => {
    // `import.meta.env.BASE_URL` sempre l'acaba portant, però qui cridi això
    // des d'un script o d'una prova no té per què saber-ho.
    expect(dataFileUrl('x.json', '/eclipsi')).toBe('/eclipsi/data/x.json');
    expect(dataFileUrl('x.json', '/')).toBe('/data/x.json');
    expect(dataFileUrl('x.json')).toBe('/data/x.json');
  });
});
