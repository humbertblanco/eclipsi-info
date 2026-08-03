/**
 * Configuració compartida entre el service worker (vite.config.ts) i la
 * precàrrega manual.
 *
 * PER QUÈ ESTÀ DUPLICADA: `vite.config.ts` corre a Node en temps de
 * compilació i no pot importar mòduls de `src/` que després aniran al paquet
 * del navegador sense arrossegar-hi mig projecte. La duplicació és petita i
 * està marcada als dos costats; el que no es pot fer és canviar-ne un i no
 * l'altre. Si els noms se separen, la precàrrega escriurà en una memòria cau
 * que el service worker no llegeix mai: l'app semblarà preparada i al camp
 * estarà buida.
 */

/** Memòria cau de les tessel·les d'elevació. Igual que a vite.config.ts. */
export const CACHE_TERRAIN = 'eclipsi-relleu-v1';

/** Memòria cau de la cartografia base. Igual que a vite.config.ts. */
export const CACHE_BASEMAP = 'eclipsi-mapa-v1';

/**
 * Memòria cau dels nostres catàlegs de `public/data/` (miradors, climatologia
 * de núvols). Igual que a vite.config.ts.
 *
 * No van al precache a posta: pesen centenars de kB i només els necessita qui
 * encén aquelles capes. Vegeu-hi el raonament sencer al costat de la regla.
 */
export const CACHE_DATA = 'eclipsi-dades-v1';

/**
 * Arrel de les tessel·les d'elevació terrarium (AWS Open Data, sense clau).
 *
 * Font: https://registry.opendata.aws/terrain-tiles/
 *
 * DUPLICAT A POSTA de `src/core/horizon/elevation.ts`, que la té privada.
 * `src/core/**` no pot dependre de la capa offline, i aquesta constant ha de
 * ser idèntica a les dues bandes: la precàrrega desa amb aquesta URL i el
 * càlcul de l'horitzó llegeix amb la seva. Un sol caràcter de diferència i
 * cap tessel·la precarregada no es trobaria.
 */
export const TERRAIN_TILE_BASE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';

/** URL d'una tessel·la d'elevació. */
export function terrainTileUrl(z: number, x: number, y: number): string {
  return `${TERRAIN_TILE_BASE}/${z}/${x}/${y}.png`;
}

/**
 * Plantilla de tessel·la d'elevació per a MapLibre (`{z}/{x}/{y}`).
 *
 * ÉS LA MATEIXA URL QUE `terrainTileUrl`, en forma de plantilla: el relleu
 * ombrejat del mapa i el càlcul de l'horitzó han de demanar byte a byte les
 * mateixes tessel·les, o la memòria cau `eclipsi-relleu-v1` es parteix en dues
 * meitats que no es troben mai. Ho vigila `terrain-agreement.test.ts`.
 */
export const TERRAIN_TILE_TEMPLATE = `${TERRAIN_TILE_BASE}/{z}/{x}/{y}.png`;

/**
 * Zoom màxim del relleu ombrejat al mapa.
 *
 * És el mateix zoom 12 (~30 m) amb què `core/horizon/elevation.ts` calcula el
 * perfil d'horitzó: per sobre MapLibre sobreescala la tessel·la en comptes de
 * demanar-ne de noves, o sigui que el mapa no baixa mai res que l'horitzó no
 * pogués necessitar igualment.
 */
export const HILLSHADE_MAX_ZOOM = 12;

/**
 * Descripció d'un proveïdor de tessel·les rasteritzades.
 *
 * ATENCIÓ per a qui munti el mapa: el component de MapLibre ha de construir
 * les URL amb EXACTAMENT aquesta plantilla. Les memòries cau del navegador
 * s'indexen per URL sencera; si el mapa demana `a.tile.openstreetmap.org` i
 * nosaltres hem desat `tile.openstreetmap.org`, no hi ha cap encert i tota la
 * precàrrega del mapa no serveix de res. Per això aquí no hi ha subdominis
 * rotatoris: amb HTTP/2 no aporten res i només multipliquen les claus.
 */
export interface BasemapSource {
  id: string;
  urlTemplate: string;
  /** Text d'atribució obligatori, per ensenyar sobre el mapa. */
  attribution: string;
  /** Zoom màxim que serveix el proveïdor. */
  maxZoom: number;
  tileSizePx: number;
}

/** Proveïdors coneguts. Tots dos els cobreix el `runtimeCaching` del build. */
export const BASEMAP_SOURCES: Record<'osm' | 'carto-dark', BasemapSource> = {
  osm: {
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
    tileSizePx: 256,
  },
  'carto-dark': {
    id: 'carto-dark',
    urlTemplate: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap · © CARTO',
    maxZoom: 20,
    tileSizePx: 256,
  },
};

/**
 * Cartografia base activa.
 *
 * ÉS LA MATEIXA QUE FA SERVIR `src/features/map/EclipseMap.tsx`, i ho ha de
 * continuar sent: la precàrrega desa per URL sencera, així que si el mapa
 * demanés un proveïdor diferent del que hem baixat, tot el que hem desat no
 * s'utilitzaria mai i el mapa sortiria gris al camp. Canviar de proveïdor vol
 * dir canviar-ho als DOS llocs.
 *
 * Sobre la política d'ús d'OpenStreetMap.org: prohibeix la descàrrega massiva
 * i fixa el llindar en 250 tessel·les de zoom 13 o superior. `BASEMAP_LEVELS`
 * en baixa unes 50 per punt, i només quan la persona ho demana explícitament
 * per a un lloc concret. Hi ha una prova que ho vigila (`plan.test.ts`).
 *
 * I ho ERA: aquí hi deia `osm` mentre el mapa demanava `carto-dark`, i des de
 * subdominis rotatius que aquest fitxer prohibeix explícitament. Les memòries
 * cau es claven a la URL sencera, o sigui que l'encert era zero: l'usuari
 * demanava «prepara'm el viatge», s'esperava la descàrrega, arribava a la
 * franja sense cobertura, obria el mapa i el trobava en blanc. La capçalera
 * d'aquest fitxer ja el descriu com «el pitjor error possible en aquesta
 * aplicació». Ara les dues bandes surten d'aquí mateix.
 */
export const BASEMAP: BasemapSource = BASEMAP_SOURCES['carto-dark'];

/** URL d'una tessel·la del mapa base. */
export function basemapTileUrl(z: number, x: number, y: number): string {
  return BASEMAP.urlTemplate.replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

/**
 * Zooms del mapa que es desen i fins a quina distància del punt.
 *
 * La lògica: com més lluny del punt triat, menys detall cal. A 60 km només
 * necessites saber per quina carretera hi vas; als 3 km finals vols veure el
 * camí i on aparcar. Baixar z14 a 60 km serien desenes de milers de
 * tessel·les i centenars de megabytes.
 */
export interface BasemapLevel {
  zoom: number;
  radiusKm: number;
}

export const BASEMAP_LEVELS: BasemapLevel[] = [
  { zoom: 9, radiusKm: 60 },
  { zoom: 10, radiusKm: 40 },
  { zoom: 11, radiusKm: 25 },
  { zoom: 12, radiusKm: 12 },
  { zoom: 13, radiusKm: 6 },
  { zoom: 14, radiusKm: 3 },
];

/**
 * Zooms del RELLEU del mapa que es desen amb la precàrrega, i fins on.
 *
 * És el tram de `BASEMAP_LEVELS` que no passa de `HILLSHADE_MAX_ZOOM`: el
 * relleu ombrejat es mira amb el mateix gest que la cartografia, així que es
 * precarrega amb els mateixos radis. Per sota de z9, MapLibre reescala z9 i
 * el que hi ha és prou (el mateix tall que ja fa la cartografia base).
 */
export const HILLSHADE_LEVELS: BasemapLevel[] = BASEMAP_LEVELS.filter(
  (level) => level.zoom <= HILLSHADE_MAX_ZOOM,
);

/**
 * Pesos mitjans mesurats, només per a l'estimació que s'ensenya ABANS de
 * començar. El pes real es compta byte a byte mentre es baixa.
 *
 * Terrarium: PNG de 256×256 amb tres canals de soroll d'elevació, comprimeix
 * malament; entre 40 i 110 KB segons el relleu. El mapa fosc de CARTO és quasi
 * tot color pla i baixa molt més.
 */
export const AVG_TERRAIN_TILE_BYTES = 70 * 1024;
export const AVG_BASEMAP_TILE_BYTES = 22 * 1024;

/**
 * Peticions simultànies durant la precàrrega.
 *
 * Sis és el que un navegador manté obert per host amb HTTP/1.1. Anar més
 * amunt no accelera i, sobretot, satura la connexió compartida de casa just
 * quan l'usuari vol fer una altra cosa. Amb dades mòbils tampoc convé.
 */
export const PREFETCH_CONCURRENCY = 6;
