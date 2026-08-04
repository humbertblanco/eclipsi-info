/**
 * El PRESSUPOST OFFLINE: què cap de debò al telèfon, i què se n'hi va sense
 * que ningú se n'adoni.
 *
 * ── PER QUÈ AQUEST FITXER EXISTEIX ──────────────────────────────────────────
 *
 * `basemap-agreement.test.ts` i `terrain-agreement.test.ts` vigilen que les
 * dues bandes demanin LA MATEIXA URL. Aquest en vigila una altra família
 * d'errors, tan silenciosa com aquella i amb el mateix final: l'usuari prem
 * «prepara'm el viatge», la barra arriba al 100 %, condueix fins a la franja i
 * al camp li falta alguna cosa.
 *
 * Les tres maneres conegudes que això passi, i que aquí es proven una per una:
 *
 *  1. UNA URL ÒRFENA. Un fitxer nou a `public/` que l'app demana en temps
 *     d'execució però que ni entra al precache (`globPatterns` no el casa) ni
 *     té regla de `runtimeCaching`. En desenvolupament i a casa funciona
 *     perfectament —hi ha xarxa—, i al camp és un 404. Ara mateix el risc té
 *     nom i cognoms: `globPatterns` NO inclou `json`, i tant
 *     `scripts/build-viewpoints.ts` com `scripts/build-cloud-clim.ts` escriuen
 *     JSON a `public/data/`. El dia que s'hi executin, aquesta prova es posa
 *     vermella abans que ningú desplegui.
 *
 *  2. UN ACTIU QUE CAU DEL PRECACHE PER MIDA. Workbox descarta en silenci tot
 *     el que passa de `maximumFileSizeToCacheInBytes` i el build segueix
 *     endavant sense dir res. Si el tros del mapa creix —i està creixent: hi
 *     entren el mapa de calor, 119 kB de punts oficials i el que vingui—, el
 *     dia que passi el límit l'app deixarà d'obrir-se sense xarxa i el
 *     desplegament no haurà avisat.
 *
 *  3. UNA QUOTA QUE NO VOL DIR EL QUE ES PENSA. `maxEntries` compta ENTRADES,
 *     no bytes, i una tessel·la terrarium no pesa el que diu `config.ts`.
 *     Vegeu la secció de pesos aquí sota.
 *
 * ── ELS PESOS SÓN MESURATS, NO ESTIMATS ─────────────────────────────────────
 *
 * `TERRAIN_KB_MEASURED` i `BASEMAP_KB_MEASURED` surten d'una descàrrega real
 * (3-08-2026): les tessel·les del pla de Reinosa, mostrejades per zoom, 39 de
 * terrarium i 36 de CARTO, comptades byte a byte. Coincideixen amb les dues
 * mesures que ja hi havia al projecte i que ningú havia portat fins aquí:
 * `core/spots/search.ts` («121 kB de mitjana (mesurat)») i
 * `core/heat/compute.ts` («bytes (121 kB/tessel·la)»).
 *
 * NO ES FA XARXA DES D'AQUÍ. Una prova que baixa tessel·les és una prova que
 * falla quan AWS té un mal dia, i llavors ningú se la creu. El que es fixa
 * aquí és el número mesurat, amb la data i la mostra escrites, perquè es pugui
 * refer amb una ordre quan calgui.
 *
 * ── QUÈ NO PROVA AQUEST FITXER ──────────────────────────────────────────────
 *
 * No prova el `dist/` si no existeix: qui es baixi el repositori i executi la
 * suite sense compilar no ha de veure cap alarma falsa. Les proves que el
 * necessiten es salten soles i ho diuen.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import viteConfigSource from '../../vite.config.ts?raw';
import {
  AVG_BASEMAP_TILE_BYTES,
  AVG_TERRAIN_TILE_BYTES,
  basemapTileUrl,
  CACHE_BASEMAP,
  CACHE_DATA,
  CACHE_TERRAIN,
  terrainTileUrl,
} from './config';
import { planBasemapTiles, planPrepare } from './plan';
import type { TileId } from '../core/horizon/elevation';

/* ─────────────────────────────── els números mesurats ─────────────────────── */

/**
 * Bytes reals d'una tessel·la terrarium, per zoom, en kB.
 *
 * Mostra: 39 tessel·les del pla de Reinosa (42,999 N · 4,138 O), 3-08-2026,
 * `https://s3.amazonaws.com/elevation-tiles-prod/terrarium`. El rang de la
 * mostra va de 88 a 148 kB.
 *
 * Les tessel·les baixes NO són més lleugeres: un PNG terrarium és soroll
 * d'elevació als tres canals i comprimeix pitjor com més món hi cap a dins.
 */
const TERRAIN_KB_MEASURED: Readonly<Record<number, number>> = {
  9: 137.2,
  10: 122.6,
  11: 128.1,
  12: 121.7,
};

/** Mitjana global de la mateixa mostra, en bytes. */
const TERRAIN_BYTES_MEASURED = Math.round(127.2 * 1024);

/**
 * Bytes reals d'una tessel·la de CARTO `dark_all`, per zoom, en kB. Mateixa
 * data, 36 tessel·les del mateix pla. Color pla: comprimeix molt bé.
 */
const BASEMAP_KB_MEASURED: Readonly<Record<number, number>> = {
  9: 10.1,
  10: 6.8,
  11: 7.0,
  12: 5.7,
  13: 4.8,
  14: 5.6,
};

/** Mitjana global de la mateixa mostra, en bytes. */
const BASEMAP_BYTES_MEASURED = Math.round(6.7 * 1024);

/** Quatre punts de la franja del 2026, repartits d'oest a est i de terra a mar. */
const POINTS: ReadonlyArray<{ name: string; lat: number; lon: number }> = [
  { name: 'Reinosa', lat: 42.999, lon: -4.138 },
  { name: 'Burgos', lat: 42.3295, lon: -3.70347 },
  { name: 'Lleida', lat: 41.60521, lon: 0.66007 },
  { name: 'Platja de Palma', lat: 39.51777, lon: 2.7426 },
];

/** Pes real d'una llista de tessel·les, amb la taula per zoom. */
function measuredBytes(tiles: readonly TileId[], table: Readonly<Record<number, number>>): number {
  return tiles.reduce((sum, tile) => {
    const kb = table[tile.z];
    // Un zoom sense mesura seria un forat silenciós al pressupost: val més que
    // salti aquí que no pas comptar-lo com a zero.
    expect(kb, `no hi ha mesura per al zoom ${tile.z}`).toBeGreaterThan(0);
    return sum + kb * 1024;
  }, 0);
}

/* ───────────────────────────── llegir la configuració ─────────────────────── */

const ROOT = new URL('../../', import.meta.url);

/** Els `globPatterns` del build, tal com estan escrits a `vite.config.ts`. */
function precacheExtensions(): string[] {
  const match = viteConfigSource.match(/globPatterns:\s*\[\s*'([^']+)'/);
  expect(match, 'vite.config.ts ja no declara globPatterns com abans').not.toBeNull();
  const inner = match?.[1].match(/\{([^}]+)\}/);
  expect(inner, `el patró ${match?.[1]} ja no té la llista d'extensions entre claus`).not.toBeNull();
  return (inner?.[1] ?? '').split(',').map((e) => e.trim());
}

/**
 * Els `globIgnores` del build, com a expressions regulars sobre el camí.
 *
 * Es tradueix el glob a mà perquè només se n'admet la forma que fem servir:
 * `**` per a qualsevol prefix de carpetes i `*` dins d'un sol tram. Si algú hi
 * posa una forma més exòtica, val més que això peti aquí que no pas que la
 * prova hi passi per sobre i deixi de vigilar el que vigila.
 */
function precacheIgnores(): RegExp[] {
  const block = viteConfigSource.match(/globIgnores:\s*\[([^\]]*)\]/);
  if (block === null) return [];
  return [...block[1].matchAll(/'([^']+)'/g)].map(([, glob]) => {
    const source = glob
      .split('/')
      .map((part) =>
        part === '**'
          ? '(?:.*)'
          : part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'),
      )
      .join('/')
      .replace(/\(\?:\.\*\)\//g, '(?:.*/)?');
    return new RegExp(`^${source}$`);
  });
}

/** Els `urlPattern:` del `runtimeCaching`, com a expressions regulars de debò. */
function runtimeCachingPatterns(): RegExp[] {
  const literals = [
    ...viteConfigSource.matchAll(/urlPattern:\s*(\/(?:\\.|\[[^\]]*\]|[^/\\\n])+\/[gimsuy]*)/g),
  ].map((m) => m[1]);
  expect(literals.length).toBeGreaterThanOrEqual(2);
  return literals.map((literal) => {
    const end = literal.lastIndexOf('/');
    return new RegExp(literal.slice(1, end), literal.slice(end + 1));
  });
}

/** El `maximumFileSizeToCacheInBytes` del build, avaluat. */
function maximumPrecacheFileSize(): number {
  const match = viteConfigSource.match(/maximumFileSizeToCacheInBytes:\s*([\d *]+),/);
  expect(match, 'vite.config.ts ja no declara maximumFileSizeToCacheInBytes').not.toBeNull();
  return (match?.[1] ?? '0')
    .split('*')
    .map((n) => Number(n.trim()))
    .reduce((a, b) => a * b, 1);
}

/**
 * El tros de configuració de cada memòria cau, amb el nom ja resolt.
 *
 * Es talla per `cacheName:` i fins al següent (o fins al final): així cap
 * comentari llarg no fa que una opció d'un bloc sembli de l'altre, que és
 * exactament l'error que aquest fitxer va cometre el primer dia.
 */
function cacheBlocks(): Array<[string, string]> {
  const marks = [...viteConfigSource.matchAll(/cacheName:\s*(\w+)/g)];
  return marks.map((mark, index) => {
    const start = mark.index ?? 0;
    const end = index + 1 < marks.length ? (marks[index + 1].index ?? undefined) : undefined;
    const constant = mark[1];
    const declared = viteConfigSource.match(new RegExp(`const ${constant} = '([^']+)'`));
    return [declared?.[1] ?? constant, viteConfigSource.slice(start, end)] as [string, string];
  });
}

/** Els `maxEntries` de cada memòria cau. */
function maxEntriesByCache(): Map<string, number> {
  const out = new Map<string, number>();
  for (const [name, block] of cacheBlocks()) {
    const match = block.match(/maxEntries:\s*(\d+)/);
    if (match) out.set(name, Number(match[1]));
  }
  return out;
}

/* ───────────────────────────────── fitxers de disc ────────────────────────── */

function walk(dir: URL, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(new URL(`${entry.name}/`, dir), `${name}/`));
    else out.push(name);
  }
  return out;
}

/**
 * Fitxers de `public/` que el navegador NO ha de demanar mai.
 *
 * `robots.txt`, `sitemap.xml` i `.htaccess` són per al servidor i per als
 * rastrejadors; `404.html` el serveix Apache quan una ruta no existeix, i dins
 * de l'app aquest cas el resol el `navigateFallback`. Cap dels quatre no fa
 * falta al camp, i per això queden fora de la comprovació d'orfandat.
 */
const SERVER_ONLY = new Set([
  'robots.txt',
  'sitemap.xml',
  '.htaccess',
  '404.html',
  // Material editorial sota demanda: no forma part de l'app de camp i no ha
  // d'engreixar la instal·lació offline de cada visitant.
  'press/simulacio-eclipsi.png',
  'press/vista-escriptori.png',
  'press/nota-premsa-eclipsi-info.docx',
]);

const DIST = new URL('dist/', ROOT);
const SW = new URL('sw.js', DIST);
const HAS_DIST = existsSync(SW);

/** Les entrades del manifest de precache que ha generat Workbox. */
function precacheManifest(): string[] {
  const source = readFileSync(fileURLToPath(SW), 'utf8');
  return [...source.matchAll(/\{url:"([^"]+)",revision:/g)].map((m) => m[1]);
}

/* ══════════════════════════════════════════════════════════════════════════ */

describe('cap URL òrfena: tot el que es publica es pot tenir al telèfon', () => {
  it('cada fitxer de public/ o entra al precache o és de servidor', () => {
    /*
     * LA PROVA QUE HAVIA DE SALTAR I NO HI ERA. Un JSON nou a `public/data/`
     * (miradors d'OSM, climatologia de núvols) no casa amb cap extensió de
     * `globPatterns` i no té regla de `runtimeCaching`: l'app se'l demanaria
     * per xarxa cada vegada i al camp no el trobaria. I el pitjor és el que
     * l'usuari veuria: res. Ni error ni avís, només una capa que no hi és.
     *
     * L'arreglada té dues formes possibles i totes dues passen aquesta prova:
     * afegir `json` a `globPatterns` (i llavors compte amb el pes: mireu la
     * prova del pressupost del precache), o donar-li una regla pròpia de
     * `runtimeCaching` amb `StaleWhileRevalidate` i que la precàrrega el
     * baixi explícitament.
     */
    const extensions = precacheExtensions();
    const patterns = runtimeCachingPatterns();
    const orphans: string[] = [];

    for (const file of walk(new URL('public/', ROOT))) {
      if (SERVER_ONLY.has(file)) continue;
      const ext = file.split('.').pop() ?? '';
      if (extensions.includes(ext)) continue;
      // Encara pot estar salvat per una regla de runtime, si algú n'hi ha
      // posat una per al seu camí.
      const asUrl = `https://eclipsi.info/${file}`;
      if (patterns.some((p) => p.test(asUrl))) continue;
      orphans.push(file);
    }

    expect(
      orphans,
      'Aquests fitxers de public/ no els tindrà ningú sense cobertura. ' +
        "L'arreglada mínima és afegir `json` a `globPatterns` de vite.config.ts " +
        "(**/*.{js,css,html,svg,png,ico,webmanifest,woff2,json}); si el pes no hi cap, " +
        'la lenta és una regla de runtimeCaching pròpia i que la precàrrega els baixi.',
    ).toEqual([]);
  });

  it('la tessel·la del mapa base la cobreix exactament una regla', () => {
    // El bessó del que ja fa `terrain-agreement.test.ts` amb el terreny. Si
    // algú canvia de proveïdor a `config.ts` i s'oblida del `runtimeCaching`,
    // el service worker deixaria de desar el mapa i la precàrrega escriuria en
    // un calaix que ningú no llegiria mai.
    const hits = runtimeCachingPatterns().filter((p) => p.test(basemapTileUrl(9, 253, 193)));
    expect(hits).toHaveLength(1);
  });

  it('les memòries cau es diuen igual al build i a config.ts', () => {
    /*
     * Eren dues —tessel·les de relleu i cartografia— i ara són tres: els
     * catàlegs de `public/data/` (miradors, climatologia) tenen calaix propi
     * perquè no van al precache. La llista és explícita a posta: un nom que
     * es mogui d'una banda i no de l'altra vol dir que la precàrrega escriu
     * en un calaix que el service worker no llegeix mai.
     */
    const declared = [...maxEntriesByCache().keys()].sort();
    expect(declared).toEqual([CACHE_BASEMAP, CACHE_DATA, CACHE_TERRAIN].sort());
  });
});

describe('el pressupost del precache', () => {
  it.skipIf(!HAS_DIST)('res del que casa amb el glob no es queda fora del manifest', () => {
    if (!HAS_DIST) return;
    /*
     * Workbox descarta EN SILENCI el que passa de
     * `maximumFileSizeToCacheInBytes`. El build no falla, el desplegament no
     * avisa i el símptoma només apareix sense xarxa. Amb el tros del mapa a
     * 945 kB i creixent, aquesta és la prova que ho dirà a temps.
     *
     * `sw.js` i el seu propi temps d'execució queden fora a posta: Workbox no
     * es precacheja a si mateix.
     *
     * I EL QUE ES DEIXA FORA A MÀ TAMPOC NO COMPTA. `globIgnores` és una
     * exclusió DECLARADA —avui, `brand/og.png`, la targeta social de 320 kB
     * que només baixen els rastrejadors i que la interfície no pinta mai— i
     * el que aquesta prova vigila és el descart EN SILENCI. Llegir-lo del
     * mateix fitxer que el `globPatterns` és el que fa que treure un fitxer
     * del precache segueixi sent una decisió escrita i no un accident.
     */
    const manifest = new Set(precacheManifest());
    const extensions = precacheExtensions();
    const ignored = precacheIgnores();
    const missing = walk(DIST).filter(
      (file) =>
        extensions.includes(file.split('.').pop() ?? '') &&
        !manifest.has(file) &&
        !ignored.some((pattern) => pattern.test(file)) &&
        file !== 'sw.js' &&
        !/^workbox-[\da-f]+\.js$/.test(file),
    );
    expect(missing).toEqual([]);
  });

  it.skipIf(!HAS_DIST)('cap actiu no s’acosta al límit de mida del precache', () => {
    if (!HAS_DIST) return;
    const limit = maximumPrecacheFileSize();
    const biggest = precacheManifest()
      .map((url) => ({ url, size: statSync(fileURLToPath(new URL(url, DIST))).size }))
      .sort((a, b) => b.size - a.size)[0];
    // Un marge del 80 % i no del 100 %: el dia que un tros arribi al límit ja
    // serà massa tard, perquè el desplegament d'aquell dia ja anirà trencat.
    expect(biggest.size, `el tros més gros és ${biggest.url}`).toBeLessThan(limit * 0.8);
  });

  it.skipIf(!HAS_DIST)('el precache sencer cap en el que l’usuari pot esperar', () => {
    if (!HAS_DIST) return;
    /*
     * L'esquelet és el que fa que l'app s'obri sense xarxa, i es baixa SENCER
     * la primera vegada, abans que l'usuari hagi demanat res. Mesurat el
     * 3-08-2026: 59 entrades i 3,29 MiB, dels quals 2,4 MB són JavaScript.
     *
     * El sostre de 6 MiB no és una xifra rodona per fer bonic: per damunt, la
     * primera visita amb 4G dolenta passa dels deu segons abans de pintar res,
     * i qui obre l'app per primer cop és justament qui encara no sap si li
     * interessa.
     */
    const total = precacheManifest().reduce(
      (sum, url) => sum + statSync(fileURLToPath(new URL(url, DIST))).size,
      0,
    );
    expect(total).toBeLessThan(6 * 1024 * 1024);
  });
});

describe('el pla d’un punt, amb els pesos mesurats', () => {
  it('cap punt de la franja del 2026 no passa dels 30 MB reals', () => {
    /*
     * El sostre que aguanta la promesa. 30 MB són uns tres minuts amb 4G
     * mediocre i caben de sobres a qualsevol telèfon; per sobre, «prepara'm el
     * viatge» deixaria de ser raonable amb dades mòbils, que és exactament
     * quan la gent el prem (a l'àrea de servei, de camí).
     *
     * Mesurat: entre 20,1 i 21,3 MB per punt amb el relleu del mapa inclòs.
     */
    for (const point of POINTS) {
      const plan = planPrepare(point.lat, point.lon);
      const real =
        measuredBytes(plan.terrain, TERRAIN_KB_MEASURED) +
        measuredBytes(plan.basemap, BASEMAP_KB_MEASURED);
      expect(
        real,
        `${point.name}: ${(real / 1024 / 1024).toFixed(1)} MB reals amb ${plan.totalTiles} tessel·les`,
      ).toBeLessThan(30 * 1024 * 1024);
    }
  });

  it('DEFECTE CONEGUT: la xifra que veu l’usuari es queda curta', () => {
    /*
     * AIXÒ NO ÉS UNA PROVA D'UNA COSA QUE ESTÀ BÉ. És una prova de
     * caracterització: fixa un error que hi ha ARA perquè no creixi i perquè
     * qui l'arregli hagi de passar per aquí.
     *
     * `AVG_TERRAIN_TILE_BYTES` val 70 kB i una tessel·la terrarium en pesa 127
     * de mitjana (mesurat; i el projecte ja ho sabia, ho diuen `search.ts` i
     * `heat/compute.ts` amb 121 kB). `AVG_BASEMAP_TILE_BYTES` val 22 kB i CARTO
     * en serveix 6,7. Com que el terreny és el 97 % de la descàrrega, el net és
     * que el panell promet ~13,6 MB i se'n baixen ~21. Amb dades mòbils, dir
     * 13 i gastar-ne 21 és exactament la mena de cosa que aquesta app no fa
     * («una estimació no es vesteix mai de mesura»).
     *
     * QUAN S'ARREGLI `config.ts` —pujant el terrarium cap a 127 kB i baixant el
     * mapa cap a 7— aquesta prova es posarà vermella. És el que ha de passar:
     * llavors es canvia per la de dalt, la que compara amb els pesos mesurats,
     * i s'esborra aquesta.
     */
    for (const point of POINTS) {
      const plan = planPrepare(point.lat, point.lon);
      const real =
        measuredBytes(plan.terrain, TERRAIN_KB_MEASURED) +
        measuredBytes(plan.basemap, BASEMAP_KB_MEASURED);
      const ratio = real / plan.estimatedBytes;
      expect(ratio).toBeGreaterThan(1.4);
      // Si algú apuja radis o zooms sense tocar els pesos, l'error creixerà i
      // això saltarà encara que el total segueixi sota els 30 MB.
      expect(ratio).toBeLessThan(1.8);
    }
  });

  it('els pesos de config.ts són els que fan curta l’estimació, i no una altra cosa', () => {
    // Per si algú arregla el símptoma (la xifra) sense arreglar la causa (els
    // pesos), i per deixar el número mesurat escrit en un lloc executable.
    expect(AVG_TERRAIN_TILE_BYTES).toBeLessThan(TERRAIN_BYTES_MEASURED);
    expect(AVG_BASEMAP_TILE_BYTES).toBeGreaterThan(BASEMAP_BYTES_MEASURED);
  });
});

describe('les quotes de les memòries cau', () => {
  it('al calaix del relleu hi caben com a mínim tres punts preparats', () => {
    /*
     * `maxEntries` compta ENTRADES. El que importa és quants punts preparats hi
     * caben abans que Workbox comenci a podar: si en cabés un i mig, preparar
     * un segon lloc esborraria el primer i l'inventari seguiria dient que hi
     * és. Tres és el mínim honest — casa, el pla A i el pla B pel cel.
     *
     * Mesurat: 168 tessel·les de terreny per punt de mitjana.
     */
    const perPoint = Math.max(...POINTS.map((p) => planPrepare(p.lat, p.lon).terrain.length));
    const maxEntries = maxEntriesByCache().get(CACHE_TERRAIN);
    expect(maxEntries).toBeDefined();
    expect((maxEntries ?? 0) / perPoint).toBeGreaterThanOrEqual(3);
  });

  it('al calaix del mapa hi caben com a mínim tres punts preparats', () => {
    const perPoint = Math.max(...POINTS.map((p) => planBasemapTiles(p.lat, p.lon).length));
    const maxEntries = maxEntriesByCache().get(CACHE_BASEMAP);
    expect(maxEntries).toBeDefined();
    expect((maxEntries ?? 0) / perPoint).toBeGreaterThanOrEqual(3);
  });

  it('DEFECTE CONEGUT: maxEntries del relleu no és cap pressupost de disc', () => {
    /*
     * 4.000 entrades × 127 kB = 497 MB. Això no és una quota: és un permís per
     * omplir mig gigabyte abans que Workbox es plantegi podar res. I qui omple
     * aquest calaix no és la precàrrega (168 tessel·les per punt), sinó la
     * NAVEGACIÓ: el relleu ombrejat mentre es mou el mapa, el mapa de calor
     * (~40 tessel·les per passada) i la cerca de llocs (64-140 per cerca).
     *
     * Per què importa i no és només "ocupar lloc": totes dues memòries cau
     * porten `purgeOnQuotaError: true`, i això a Workbox vol dir
     * `deleteCacheAndMetadata()` — esborrar el calaix SENCER. O sigui que la
     * primera vegada que el navegador digui que no hi cap res més mentre
     * s'omple de tessel·les de navegació, se'n van també les que l'usuari va
     * baixar a posta per al viatge. I l'inventari (`store.ts`) seguirà dient
     * que aquell punt està preparat, perquè viu a una altra base de dades i
     * ningú no el comprova contra la memòria cau.
     *
     * LA RECOMANACIÓ, escrita aquí perquè no es perdi: baixar `maxEntries` a
     * un número que sigui un pressupost de debò (1.200 ≈ 150 MB) i, sobretot,
     * partir el calaix en dos —el que baixa la precàrrega i el que baixa la
     * navegació— perquè una quota plena no pugui endur-se mai el viatge.
     *
     * Mentre no es faci, aquesta prova fixa la mida del problema.
     */
    const maxEntries = maxEntriesByCache().get(CACHE_TERRAIN) ?? 0;
    const bytes = maxEntries * TERRAIN_BYTES_MEASURED;
    expect(bytes).toBeGreaterThan(400 * 1024 * 1024);
    // El dia que baixi de 200 MB, el defecte estarà arreglat i aquesta prova
    // s'ha de canviar per un sostre de debò (`toBeLessThan`).
    expect(bytes).toBeGreaterThan(200 * 1024 * 1024);
  });

  it('sabem exactament quins calaixos pot esborrar sencers una quota plena', () => {
    /*
     * `purgeOnQuotaError: true` no poda: crida `deleteCacheAndMetadata()`, que
     * fa `caches.delete(nom)`. Tot el calaix. Que ara siguin aquests dos és una
     * decisió defensable —són reconstruïbles amb xarxa—, però afegir-hi un
     * tercer calaix amb dades que NOMÉS es poden tenir baixant-les abans (la
     * climatologia de núvols, els miradors) seria una altra cosa: allò, un cop
     * esborrat i sense cobertura, no torna.
     *
     * Per això la llista és explícita i qualsevol addició ha de passar per
     * aquí.
     */
    const purgeable = cacheBlocks()
      .filter(([, block]) => block.includes('purgeOnQuotaError: true'))
      .map(([name]) => name);

    expect(purgeable.sort()).toEqual([CACHE_BASEMAP, CACHE_TERRAIN].sort());
  });
});

describe('les URL que no són tessel·les', () => {
  it('el terreny i el mapa no comparteixen regla', () => {
    // Si un patró casés amb totes dues coses, les tessel·les d'elevació
    // acabarien barrejades amb la cartografia i el `maxEntries` d'un calaix
    // podaria l'altre. Cada família té el seu.
    const patterns = runtimeCachingPatterns();
    const terrain = patterns.filter((p) => p.test(terrainTileUrl(12, 2027, 1546)));
    const basemap = patterns.filter((p) => p.test(basemapTileUrl(12, 2027, 1546)));
    expect(terrain).toHaveLength(1);
    expect(basemap).toHaveLength(1);
    expect(terrain[0].source).not.toBe(basemap[0].source);
  });

  it('els serveis en línia NO tenen regla de memòria cau, i és a posta', () => {
    /*
     * Photon (noms de lloc) i Open-Meteo (predicció) es demanen en temps
     * d'execució i no els cobreix cap regla. NO és cap oblit i per això ho diu
     * una prova:
     *
     *  · Una predicció servida de la memòria cau del service worker seria una
     *    predicció VELLA presentada com a fresca, i el panell del cel no podria
     *    dir-ne l'edat. La frescor la gestiona `core/weather/cache.ts`, que
     *    desa la resposta amb el seu `fetchedAtMs` i la interfície l'ensenya.
     *  · El cercador de noms de lloc no té sentit sense xarxa i té la seva
     *    pròpia memòria a `core/places/cache.ts`.
     *
     * El dia que algú hi afegeixi un `runtimeCaching`, aquesta prova saltarà i
     * l'obligarà a llegir això.
     */
    const patterns = runtimeCachingPatterns();
    for (const url of [
      'https://photon.komoot.io/api?q=Reinosa',
      'https://api.open-meteo.com/v1/forecast?latitude=43&longitude=-4',
      'https://archive-api.open-meteo.com/v1/archive?latitude=43&longitude=-4',
      'https://www.googletagmanager.com/gtag/js?id=G-1KCV75E6K8',
    ]) {
      expect(patterns.filter((p) => p.test(url))).toHaveLength(0);
    }
  });
});
