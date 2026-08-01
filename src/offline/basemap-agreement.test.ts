/**
 * El mapa i la precàrrega han de demanar EXACTAMENT la mateixa URL.
 *
 * PER QUÈ CAL UN TEST PER A UNA COSA TAN TONTA. Perquè ja havia passat i no ho
 * veia ningú: la precàrrega baixava `tile.openstreetmap.org` i el mapa demanava
 * `{a,b,c}.basemaps.cartocdn.com`. Les memòries cau es claven a la URL sencera,
 * o sigui que l'encert era zero. L'usuari demanava «prepara'm el viatge»,
 * s'esperava tota la descàrrega, conduïa fins a la franja, obria el mapa sense
 * cobertura i el trobava en blanc. La capçalera de `config.ts` ja diu que és
 * «el pitjor error possible en aquesta aplicació», i tot i així hi era.
 *
 * Ara el mapa construeix les seves tessel·les des de `BASEMAP.urlTemplate`, o
 * sigui que la coincidència és estructural i no una promesa. El que aquest
 * fitxer vigila és que la plantilla segueixi essent utilitzable per les dues
 * bandes: una sola URL, sense subdominis rotatius i amb les tres coordenades.
 */

import { describe, expect, it } from 'vitest';
import { BASEMAP, BASEMAP_SOURCES, basemapTileUrl } from './config';

describe('el mapa i la precàrrega comparteixen proveïdor', () => {
  it('no hi ha subdominis rotatius', () => {
    // Cada subdomini és una URL diferent i una entrada de memòria cau que no
    // trobarà ningú. Amb HTTP/2 no serveixen de res des de fa anys.
    expect(BASEMAP.urlTemplate).not.toMatch(/^https:\/\/[abc]\./);
    for (const source of Object.values(BASEMAP_SOURCES)) {
      expect(source.urlTemplate).not.toMatch(/^https:\/\/[abc]\./);
    }
  });

  it('la plantilla porta les tres coordenades i res més per substituir', () => {
    expect(BASEMAP.urlTemplate).toContain('{z}');
    expect(BASEMAP.urlTemplate).toContain('{x}');
    expect(BASEMAP.urlTemplate).toContain('{y}');
    const url = basemapTileUrl(7, 62, 47);
    expect(url).not.toContain('{');
    expect(url).toBe('https://basemaps.cartocdn.com/dark_all/7/62/47.png');
  });

  it('la font activa és la fosca, que és la que demana el sistema de disseny', () => {
    expect(BASEMAP.id).toBe('carto-dark');
  });
});
