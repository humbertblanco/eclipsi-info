/**
 * El mapa, la precàrrega i el càlcul de l'horitzó han de demanar EXACTAMENT la
 * mateixa tessel·la d'elevació.
 *
 * ÉS EL MATEIX ERROR D'ABANS AMB UNA PEÇA MÉS. `basemap-agreement.test.ts`
 * explica la història sencera: la precàrrega baixava `tile.openstreetmap.org`,
 * el mapa demanava `{a,b,c}.basemaps.cartocdn.com`, les memòries cau es claven
 * a la URL sencera i per tant l'encert era zero. L'usuari demanava «prepara'm
 * el viatge», s'esperava la descàrrega, conduïa fins a la franja i obria un
 * mapa en blanc. Va costar dues vegades trobar-ho perquè tot semblava
 * funcionar: la barra de progrés arribava al final igualment.
 *
 * ARA HI HA UN TERCER CLIENT DE LES MATEIXES TESSEL·LES. Fins a la fase F1 el
 * terrarium d'AWS només el demanava `core/horizon/elevation.ts` per calcular
 * el perfil d'horitzó. Des que el mapa pinta relleu ombrejat, MapLibre demana
 * aquelles mateixes tessel·les pel seu compte, amb una plantilla `{z}/{x}/{y}`
 * que viu a `offline/config.ts` mentre l'arrel «de veritat» és una constant
 * privada de `elevation.ts` (duplicada a posta: `core/**` no pot dependre de
 * la capa offline). Tres llocs, una sola URL possible. Un caràcter de
 * diferència i el relleu del mapa aniria per xarxa al camp, amb la memòria cau
 * `eclipsi-relleu-v1` plena de les tessel·les bones i sense fer-les servir.
 *
 * Per això aquest fitxer llegeix el CODI FONT de `vite.config.ts` i de
 * `elevation.ts` en comptes de repetir-ne les constants: el que ha de saltar
 * és el DESACORD entre bandes, i una còpia més de la cadena aquí dins només
 * seria un quart lloc per divergir.
 */

import { describe, expect, it } from 'vitest';
import viteConfigSource from '../../vite.config.ts?raw';
import elevationSource from '../core/horizon/elevation.ts?raw';
import { DEFAULT_ZOOM } from '../core/horizon/elevation';
import {
  CACHE_TERRAIN,
  HILLSHADE_MAX_ZOOM,
  TERRAIN_TILE_BASE,
  TERRAIN_TILE_TEMPLATE,
  terrainTileUrl,
} from './config';

/**
 * Converteix un literal d'expressió regular llegit del codi font en una
 * `RegExp` de debò. Es fa a mà perquè `new RegExp(literal)` tractaria les
 * barres i les banderes com a text.
 */
function toRegExp(literal: string): RegExp {
  const end = literal.lastIndexOf('/');
  return new RegExp(literal.slice(1, end), literal.slice(end + 1));
}

/** Els `urlPattern:` del `runtimeCaching` del service worker, tal com estan escrits. */
function serviceWorkerUrlPatterns(): RegExp[] {
  const literals = [
    ...viteConfigSource.matchAll(
      /urlPattern:\s*(\/(?:\\.|\[[^\]]*\]|[^/\\\n])+\/[gimsuy]*)/g,
    ),
  ].map((match) => match[1]);
  // Si això falla, és que el `runtimeCaching` ha canviat de forma i aquest
  // fitxer ja no llegeix el que es pensa que llegeix.
  expect(literals.length).toBeGreaterThanOrEqual(2);
  return literals.map(toRegExp);
}

describe('el relleu del mapa i el perfil d’horitzó demanen la mateixa tessel·la', () => {
  it('la plantilla i la funció donen la mateixa URL, caràcter per caràcter', () => {
    // Tres casos amb xifres que no es confonen entre elles: si algú es
    // descuidés una substitució o intercanviés {x} i {y}, aquí es veuria.
    const casos: Array<[number, number, number]> = [
      [12, 2027, 1546],
      [9, 253, 193],
      [0, 0, 0],
    ];

    for (const [z, x, y] of casos) {
      const desDeLaPlantilla = TERRAIN_TILE_TEMPLATE.replace('{z}', String(z))
        .replace('{x}', String(x))
        .replace('{y}', String(y));
      expect(desDeLaPlantilla).toBe(terrainTileUrl(z, x, y));
      expect(desDeLaPlantilla).not.toContain('{');
    }

    // I la cadena literal, perquè el test digui quina URL és sense haver
    // d'anar a buscar-la: aquesta és la que hi ha a `eclipsi-relleu-v1`.
    expect(terrainTileUrl(12, 2027, 1546)).toBe(
      'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/2027/1546.png',
    );
  });

  it('la plantilla porta les tres coordenades i cap altre marcador', () => {
    // MapLibre substitueix {z}, {x}, {y} i prou. Qualsevol altre marcador
    // ({ratio}, {a-c}, una clau d'API) arribaria a la xarxa sense substituir i
    // trencaria la coincidència amb el que ha desat la precàrrega.
    const marcadors = [...TERRAIN_TILE_TEMPLATE.matchAll(/\{[^}]*\}/g)].map((m) => m[0]);
    expect(marcadors.sort()).toEqual(['{x}', '{y}', '{z}']);
  });

  it('no hi ha subdominis rotatius', () => {
    // Cada subdomini és una clau de memòria cau diferent que no trobarà ningú.
    // La mateixa regla que ja s'aplica a la cartografia base.
    expect(TERRAIN_TILE_TEMPLATE).not.toMatch(/^https:\/\/[a-d]\./);
    expect(TERRAIN_TILE_BASE).not.toMatch(/^https:\/\/[a-d]\./);
  });

  it('l’arrel és idèntica a la que té privada core/horizon/elevation.ts', () => {
    /*
     * `elevation.ts` no exporta `TILE_URL` i no ha de fer-ho: `core/**` és
     * motor pur i no pot dependre de la capa offline, i exportar-la només per
     * al test seria obrir una porta que després algú faria servir al revés.
     * Llegim el codi font i comparem la cadena literal. Si algú canvia
     * d'allotjament en un dels dos fitxers, aquí es posa vermell.
     */
    const match = elevationSource.match(/const TILE_URL = '([^']+)'/);
    expect(match, 'elevation.ts ja no declara TILE_URL com una cadena literal').not.toBeNull();
    expect(match?.[1]).toBe(TERRAIN_TILE_BASE);

    // I la mateixa extensió a la mateixa posició: `loadTile` munta la URL amb
    // `${TILE_URL}/${key}.png` i `key` és «z/x/y». Si un costat passés a .webp
    // o afegís un sufix de resolució, les dues URL deixarien de coincidir
    // encara que l'arrel fos la mateixa.
    expect(elevationSource).toMatch(/\$\{TILE_URL\}\/\$\{key\}\.png/);
    expect(TERRAIN_TILE_TEMPLATE).toBe(`${TERRAIN_TILE_BASE}/{z}/{x}/{y}.png`);
  });

  it('el service worker cobreix la URL que demanen el mapa i la precàrrega', () => {
    /*
     * El `runtimeCaching` de `vite.config.ts` és qui decideix què acaba dins de
     * `eclipsi-relleu-v1`. Llegim els seus patrons del codi font perquè, si
     * algú canvia el host a UN DELS DOS COSTATS, cap patró no casarà amb la
     * nostra URL i això saltarà — que és exactament el senyal que fa dos anys
     * no va donar ningú.
     */
    const patterns = serviceWorkerUrlPatterns();
    const url = terrainTileUrl(12, 2027, 1546);
    const encerts = patterns.filter((pattern) => pattern.test(url));
    expect(encerts).toHaveLength(1);
  });

  it('la memòria cau del relleu es diu igual als dos costats', () => {
    // `vite.config.ts` no pot importar `src/offline/config.ts` (corre a Node en
    // temps de compilació), així que el nom del calaix està duplicat. Si se
    // separen, la precàrrega escriu en un calaix que el service worker no
    // llegeix mai: l'app dirà que està preparada i al camp estarà buida.
    const match = viteConfigSource.match(/const CACHE_TERRAIN = '([^']+)'/);
    expect(match?.[1]).toBe(CACHE_TERRAIN);
  });

  it('el mapa no baixa cap zoom que l’horitzó no aprofiti mai', () => {
    /*
     * `HILLSHADE_MAX_ZOOM` és el sostre que se li dona a MapLibre; per sobre
     * sobreescala la tessel·la de z12 en comptes de demanar-ne de noves. Ha de
     * ser el mateix zoom amb què `elevation.ts` calcula el perfil (~30 m a
     * latituds ibèriques): si el mapa en demanés de més fines, cada tessel·la
     * de relleu seria una descàrrega que no serveix a ningú més i que ocupa
     * lloc al mateix calaix que sí que fa falta.
     */
    expect(HILLSHADE_MAX_ZOOM).toBe(DEFAULT_ZOOM);
    expect(HILLSHADE_MAX_ZOOM).toBe(12);
  });
});
