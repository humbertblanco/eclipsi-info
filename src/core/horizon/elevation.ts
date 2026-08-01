/**
 * Lectura d'elevació del terreny des de les tessel·les terrarium d'AWS Open
 * Data. Sense clau d'API ni compte.
 *
 * Font: https://registry.opendata.aws/terrain-tiles/
 * Codificació terrarium: elevació = (R · 256 + G + B / 256) − 32768 metres.
 *
 * Per què no fem servir l'altitud del GPS: l'error vertical d'un GPS de mòbil
 * és de ±10 a ±30 m, i pot arribar a més. Trenta metres d'error en la teva
 * altitud desplacen l'horitzó visible prou com per canviar el veredicte de si
 * una muntanya et tapa el Sol o no. La posició HORITZONTAL del GPS, en canvi,
 * és bona (±5 m), i amb ella el model del terreny ens dona l'altitud molt
 * millor que el propi GPS.
 *
 * Avís: les tessel·les terrarium són de terreny nu — no hi ha ni edificis ni
 * arbres. Aquest forat entre el model i la realitat es tanca amb el calibratge
 * manual sobre la imatge de la càmera.
 */

const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
export const TILE_SIZE = 256;

/** Zoom 12 dona ~30 m de resolució a latituds ibèriques. */
export const DEFAULT_ZOOM = 12;

export interface TilePixel {
  z: number;
  x: number;
  y: number;
  px: number;
  py: number;
}

/** Identificador d'una tessel·la del piràmide de Web Mercator. */
export interface TileId {
  z: number;
  x: number;
  y: number;
}

export function tileKey(tile: TileId): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

/** Coordenades geogràfiques a tessel·la i píxel dins la tessel·la. */
export function lonLatToTilePixel(lon: number, lat: number, z: number): TilePixel {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;

  const xExact = ((lon + 180) / 360) * n;
  const yExact =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const x = Math.floor(xExact);
  const y = Math.floor(yExact);

  return {
    z,
    x,
    y,
    px: Math.min(TILE_SIZE - 1, Math.floor((xExact - x) * TILE_SIZE)),
    py: Math.min(TILE_SIZE - 1, Math.floor((yExact - y) * TILE_SIZE)),
  };
}

/**
 * Igual que `lonLatToTilePixel` però amb el píxel en coordenades FRACCIONÀRIES.
 * El raycast del perfil d'horitzó mostreja milions de punts que no cauen sobre
 * el centre de cap píxel, i arrodonir cada un d'ells introdueix un serrat de
 * fins a mig píxel (uns 15 m horitzontals) que es nota com a soroll a la
 * silueta del terreny. Amb la fracció podem interpolar.
 */
export function lonLatToTileFraction(
  lon: number,
  lat: number,
  z: number,
): { z: number; x: number; y: number; fx: number; fy: number } {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;

  const xExact = ((lon + 180) / 360) * n;
  const yExact =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const x = Math.floor(xExact);
  const y = Math.floor(yExact);

  return { z, x, y, fx: (xExact - x) * TILE_SIZE, fy: (yExact - y) * TILE_SIZE };
}

/** Cantonades geogràfiques d'una tessel·la: [oest, sud, est, nord] en graus. */
export function tileBoundsLonLat(
  z: number,
  x: number,
  y: number,
): { west: number; south: number; east: number; north: number } {
  const n = 2 ** z;
  const lonAt = (tx: number) => (tx / n) * 360 - 180;
  const latAt = (ty: number) => {
    const t = Math.PI * (1 - (2 * ty) / n);
    return (Math.atan(Math.sinh(t)) * 180) / Math.PI;
  };
  return {
    west: lonAt(x),
    east: lonAt(x + 1),
    north: latAt(y),
    south: latAt(y + 1),
  };
}

/** Descodifica un píxel terrarium a metres. */
export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

const tileCache = new Map<string, Promise<ImageData>>();

/**
 * Tessel·les ja descodificades i disponibles SENSE await.
 *
 * El raycast necessita llegir elevacions de forma síncrona: fer un `await` per
 * cada una dels ~2,5 milions de mostres del perfil costaria més que tot el
 * càlcul junt. Per això el flux és: enumerar les tessel·les que farà falta,
 * baixar-les totes amb `prefetchTiles` (que és on posem la barra de progrés) i
 * només llavors llançar el raycast, que ja no toca la xarxa.
 */
const readyTiles = new Map<string, ImageData>();

/** Vegeu la crida a `fetch` de `loadTile`. */
const TILE_TIMEOUT_MS = 8_000;

async function loadTile(z: number, x: number, y: number): Promise<ImageData> {
  const key = `${z}/${x}/${y}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    // TEMPS D'ESPERA PROPI. `fetch` no en té cap: sota una cobertura dolenta
    // —que és exactament la del turó on es va a veure un eclipsi— la petició
    // pot quedar-se penjada minuts. Aquesta promesa alimenta l'altitud de
    // l'observador, i mentre no es resol l'app no sap a quina altura és. Vuit
    // segons: prou per a una tessel·la de 30 kB en 2G, prou poc per no deixar
    // l'usuari mirant una filadora. En caducar es cau al camí de sempre, que
    // ja sap dir que l'altitud és suposada.
    const response = await fetch(`${TILE_URL}/${key}.png`, {
      mode: 'cors',
      signal: AbortSignal.timeout(TILE_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`No s'ha pogut baixar la tessel·la ${key}: ${response.status}`);
    }
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    // OffscreenCanvas perquè això ha de poder córrer també dins d'un Worker
    // quan calculem el perfil d'horitzó sencer.
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(TILE_SIZE, TILE_SIZE)
        : Object.assign(document.createElement('canvas'), {
            width: TILE_SIZE,
            height: TILE_SIZE,
          });

    const ctx = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) throw new Error('No hi ha context 2D per descodificar la tessel·la');

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const image = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
    readyTiles.set(key, image);
    return image;
  })();

  tileCache.set(key, promise);
  // Si falla, la traiem de la memòria cau perquè un reintent pugui funcionar.
  promise.catch(() => tileCache.delete(key));
  return promise;
}

export interface PrefetchOptions {
  /**
   * Peticions simultànies. Sis és el màxim que un navegador manté obertes cap a
   * un mateix host per HTTP/1.1; demanar-ne més no accelera res i en canvi
   * ofega la resta de la xarxa de l'aplicació.
   */
  concurrency?: number;
  onTileDone?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface PrefetchResult {
  requested: number;
  loaded: number;
  failed: number;
}

/**
 * Baixa un lot de tessel·les i les deixa llestes per a `elevationAtSync`.
 *
 * Les que fallin no aturen el lot: un forat de cobertura degrada el perfil en
 * un sector concret, però és molt millor que no donar cap perfil. Qui crida
 * decideix, a partir de `failed`, si el resultat encara és utilitzable.
 */
export async function prefetchTiles(
  tiles: TileId[],
  options: PrefetchOptions = {},
): Promise<PrefetchResult> {
  const { concurrency = 6, onTileDone, signal } = options;
  const total = tiles.length;
  let done = 0;
  let failed = 0;
  let next = 0;

  const pump = async (): Promise<void> => {
    for (;;) {
      if (signal?.aborted) return;
      const index = next++;
      if (index >= total) return;
      const tile = tiles[index];
      try {
        await loadTile(tile.z, tile.x, tile.y);
      } catch {
        failed++;
      }
      done++;
      onTileDone?.(done, total);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => pump()),
  );

  return { requested: total, loaded: done - failed, failed };
}

/** Cert si la tessel·la ja és descodificada a memòria. */
export function isTileReady(tile: TileId): boolean {
  return readyTiles.has(tileKey(tile));
}

/**
 * Allibera totes les tessel·les descodificades.
 *
 * Un perfil de 150 km de radi en té unes 150 obertes alhora, i cada
 * `ImageData` de 256×256 ocupa 256 KB: prop de 40 MB. Mentre dura el raycast
 * no hi ha manera d'evitar-ho (el mostreig ha de ser síncron), però un cop
 * acabat val més tornar-los al sistema, sobretot al mòbil.
 */
export function releaseTiles(): void {
  tileCache.clear();
  readyTiles.clear();
}

function bilinear(image: ImageData, fx: number, fy: number): number {
  // Els centres dels píxels són a (i+0,5): desplacem abans d'interpolar.
  const u = Math.min(TILE_SIZE - 1, Math.max(0, fx - 0.5));
  const v = Math.min(TILE_SIZE - 1, Math.max(0, fy - 0.5));

  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const x1 = Math.min(TILE_SIZE - 1, x0 + 1);
  const y1 = Math.min(TILE_SIZE - 1, y0 + 1);
  const tx = u - x0;
  const ty = v - y0;

  // Interpolem només dins de la tessel·la: agafar el veí de la tessel·la del
  // costat obligaria a tenir-la baixada per llegir una vora. L'error que
  // introdueix la retenció a la vora és de mig píxel (~15 m horitzontals), molt
  // per sota del soroll del propi model del terreny.
  const at = (x: number, y: number) => {
    const o = (y * TILE_SIZE + x) * 4;
    return decodeTerrarium(image.data[o], image.data[o + 1], image.data[o + 2]);
  };

  const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/**
 * Elevació en metres SENSE await, a partir de les tessel·les ja baixades.
 * Torna `undefined` si la tessel·la corresponent no hi és — qui crida ha de
 * decidir què fa amb el forat, i mai s'ha d'interpretar com a elevació zero.
 */
export function elevationAtSync(
  lon: number,
  lat: number,
  zoom: number = DEFAULT_ZOOM,
): number | undefined {
  const { x, y, fx, fy } = lonLatToTileFraction(lon, lat, zoom);
  const image = readyTiles.get(`${zoom}/${x}/${y}`);
  if (!image) return undefined;
  return bilinear(image, fx, fy);
}

/** Elevació del terreny en metres per a unes coordenades. */
export async function elevationAt(
  lon: number,
  lat: number,
  zoom: number = DEFAULT_ZOOM,
): Promise<number> {
  const { z, x, y, px, py } = lonLatToTilePixel(lon, lat, zoom);
  const image = await loadTile(z, x, y);
  const offset = (py * TILE_SIZE + px) * 4;
  return decodeTerrarium(image.data[offset], image.data[offset + 1], image.data[offset + 2]);
}
