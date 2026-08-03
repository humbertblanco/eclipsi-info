/**
 * La nuvolositat sobre el mapa: la graella de 0,25° tenyida cel·la a cel·la.
 *
 * La dada i tota la física són de `core/weather` — `climGrid.ts` llegeix i
 * valida la graella, `layers.ts` la puntua, `mapMode.ts` decideix quina font
 * toca. Aquí no es decideix res: es baixa el fitxer i es pinta el que digui.
 *
 * ── LA GRAELLA S'HA DE VEURE GROLLERA, I ÉS LA DECISIÓ PRINCIPAL ────────────
 *
 * Una cel·la fa 0,25°, uns 25 km, i el seu valor és el del CENTRE — no la
 * mitjana del rectangle (ho diu la capçalera de `climGrid.ts` amb totes les
 * lletres). Suavitzar-ho, difuminar-ho o interpolar-ho faria un mapa que sembla
 * una fotografia del cel i que promet un detall que la font no té. Per això:
 *
 *  · rectangles de vores rectes, mai cercles ni degradats radials;
 *  · una retícula fina a sobre que ensenya ON és cada tall, perquè es vegi que
 *    això és una malla i no un núvol;
 *  · cap transició entre cel·les veïnes: el salt de color és el salt de dada.
 *
 * Fer-la bonica seria fer-la mentidera. Qui la miri ha de veure de seguida que
 * la resposta té el gra de 25 km, i que dins d'una cel·la no en sabem res més.
 *
 * ── CLIMATOLOGIA I PREVISIÓ NO PODEN TENIR LA MATEIXA CARA ──────────────────
 *
 * És la regla d'or de `core/weather` portada al mapa, i `mapMode.ts` ja la
 * resol: `CloudMapPlan.texture` val `'hatch'` per a l'estadística i `'solid'`
 * per al model. Aquí es fa de veritat, i amb TRAMA, no amb una etiqueta: el que
 * l'usuari mira és una taca de color, i una taca de color no porta text. A
 * quinze dies vista, algú que veiés el mapa net sobre Sòria pintat igual que
 * una previsió creuria saber què farà el cel. No ho sap ningú.
 *
 * La trama es genera aquí mateix com a imatge de píxels i s'hi registra amb
 * `map.addImage`: no és cap fitxer, no es baixa de cap lloc i per tant funciona
 * sense cobertura com la resta de la capa. Vegeu `hatchImage`.
 *
 * ── UNA SOLA TINTA, `statusCloudy`, I L'OPACITAT COM A XIFRA ────────────────
 *
 * Cap rampa de verd a vermell. Al mapa l'ambre és de la FRANJA i el verd de
 * l'app és el `statusClear` del veredicte de visibilitat; una segona escala de
 * colors competiria amb totes dues i el cop d'ull ja no sabria quina respon la
 * pregunta. Aquí hi ha una sola tinta —el gris blavós dels núvols— i el que
 * canvia és quanta n'hi ha: com més tapat, més tinta. Es llegeix com el que és,
 * un vel sobre el territori.
 *
 * La xifra que mana l'opacitat és la `score` de la cel·la (0-100, «quina part
 * de l'espectacle t'arriba»), que és exactament la mateixa que ensenya la fitxa
 * del punt, i les dues parades intermèdies són els llindars de `bandForScore`.
 * Així el color i la paraula no es poden contradir mai: una cel·la que es veu
 * gairebé neta no pot obrir una fitxa que digui «cel a mitges».
 */

import type { FeatureCollection, Polygon } from 'geojson';
import type { GeoJSONSource, MapLibreMap } from 'maplibre-gl';
import {
  climCellsToGeoJson,
  parseCloudClimGrid,
  type ClimCell,
  type ClimCellProperties,
  type CloudClimGrid,
} from '../../../core/weather/climGrid';
import { BAND_CLEAR_MIN, BAND_PARTIAL_MIN } from '../../../core/weather/layers';
import type { CloudMapTexture } from '../../../core/weather/mapMode';
import { cloudClimDataUrl } from '../../../offline/config';
import { withAlpha, type Palette } from '../../../styles/palette';

const CLOUD_SOURCE = 'cloud-cells';
export const CLOUD_FILL_LAYER = 'clouds-fill';
export const CLOUD_HATCH_LAYER = 'clouds-hatch';
export const CLOUD_GRID_LAYER = 'clouds-grid';
export const CLOUD_HATCH_IMAGE = 'clouds-hatch-pattern';

/* --------------------------------------------------------- càrrega mandrosa */

export type CloudGridErrorCode =
  /** No s'ha pogut arribar al fitxer (sense xarxa, 404, encara no generat). */
  | 'network'
  /** Ha arribat però no és una graella llegible o és d'una física antiga. */
  | 'format';

/**
 * Fallada en baixar la graella.
 *
 * PORTA CODI I NO FRASE, com `CloudClimGridError`, i pel mateix motiu: que el
 * fitxer estigui malmès o encara no generat no és cap cosa que l'usuari hagi
 * fet ni pugui arreglar. La resposta honesta és no ensenyar la capa. La causa
 * original es conserva a `cause` per a qui miri la consola.
 */
export class CloudGridLoadError extends Error {
  readonly code: CloudGridErrorCode;

  constructor(message: string, code: CloudGridErrorCode, cause?: unknown) {
    super(message);
    this.name = 'CloudGridLoadError';
    this.code = code;
    this.cause = cause;
  }
}

/** Vegeu `viewpoints.ts`: es desa la promesa, no el resultat, i pel mateix motiu. */
const inFlight = new Map<string, Promise<CloudClimGrid>>();

export interface LoadCloudGridOptions {
  /** Arrel del desplegament. Al navegador, `import.meta.env.BASE_URL`. */
  baseUrl?: string;
  signal?: AbortSignal;
}

/**
 * Baixa (un sol cop) la graella de climatologia de núvols d'un eclipsi.
 *
 * La URL surt d'`offline/config`, com totes les d'aquesta app, perquè el
 * service worker i el mapa han de demanar el mateix fitxer o el calaix
 * `eclipsi-dades-v1` no serveix de res al camp.
 *
 * POT NO EXISTIR ENCARA, i no és cap error del codi: la graella la genera
 * `scripts/build-cloud-clim.ts` amb vuit mil crides a Open-Meteo i hi ha
 * eclipsis del catàleg que encara no la tenen. Un 404 arriba com a `'network'`
 * i la interfície ha de poder no ensenyar la capa sense dir cap disbarat.
 */
export function loadCloudClimGrid(
  eclipseId: string,
  options: LoadCloudGridOptions = {},
): Promise<CloudClimGrid> {
  const cached = inFlight.get(eclipseId);
  if (cached !== undefined) return cached;

  const url = cloudClimDataUrl(eclipseId, options.baseUrl ?? '/');
  const request = fetch(url, { signal: options.signal })
    .then(async (response) => {
      if (!response.ok) {
        throw new CloudGridLoadError(
          `La graella de núvols ha tornat ${response.status}`,
          'network',
        );
      }
      const raw: unknown = await response.json();
      // `parseCloudClimGrid` valida de veritat i llança `CloudClimGridError`
      // amb el seu propi codi (format desconegut, física antiga, columnes
      // desiguals, percentatges impossibles). Tot això, des de fora, és el
      // mateix: el fitxer no es pot pintar.
      return parseCloudClimGrid(raw);
    })
    .catch((error: unknown) => {
      inFlight.delete(eclipseId);
      if (error instanceof CloudGridLoadError) throw error;
      if (error instanceof SyntaxError || error instanceof TypeError) {
        throw new CloudGridLoadError('La graella de núvols no és llegible', 'format', error);
      }
      throw new CloudGridLoadError(String(error), 'format', error);
    });

  inFlight.set(eclipseId, request);
  return request;
}

/** Oblida el que s'ha baixat. Només per a les proves i per a un reintent net. */
export function forgetCloudClimGrid(eclipseId?: string): void {
  if (eclipseId === undefined) inFlight.clear();
  else inFlight.delete(eclipseId);
}

/* ------------------------------------------------------------------ la trama */

/**
 * Els tres canals d'un color de la paleta, en bytes.
 *
 * Fa falta perquè una imatge de píxels es dibuixa amb números i no amb
 * cadenes, i el color ha de SORTIR IGUALMENT DE LA PALETA: escriure aquí el
 * gris blavós a mà seria treure la trama del sistema de disseny i deixar-la
 * enrere el dia que el token canviï. Accepta el que poden tornar els tokens:
 * hexadecimal de 3 o 6 dígits i `rgb()`/`rgba()`.
 *
 * Si no se sap desmuntar, torna `null` i qui crida se'n va sense trama: val
 * més una capa sense textura que una textura d'un color inventat.
 */
export function inkBytes(color: string): [number, number, number] | null {
  const hex = color.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as [
      number,
      number,
      number,
    ];
  }

  const rgb = color.trim().match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[,\s/]+/).filter(Boolean).slice(0, 3).map(Number);
    if (parts.length === 3 && parts.every((v) => Number.isFinite(v))) {
      return parts as [number, number, number];
    }
  }

  return null;
}

/** Costat de la imatge de trama, en píxels de textura. */
const HATCH_SIZE = 16;
/** Període de la ratlla dins de la imatge. Amb `pixelRatio: 2`, 4 px de CSS. */
const HATCH_PERIOD = 8;
/** Gruix de la ratlla, en píxels de textura. */
const HATCH_WIDTH = 2;

/**
 * La trama de la climatologia com a imatge de píxels, sense DOM ni fitxers.
 *
 * Ratlles diagonals a 45°: és el gest universal de «això és una estimació,
 * no una mesura» als mapes de paper, i es reconeix de reüll sense llegir cap
 * llegenda, que és exactament el que demana la regla d'or de `core/weather`.
 *
 * PREMULTIPLICADA: MapLibre espera els canals de color ja multiplicats per
 * l'alfa. Sense això, les vores de cada ratlla surten amb un halo clar sobre
 * fons fosc — que és tot aquest mapa.
 */
export function hatchImage(
  ink: readonly [number, number, number],
  alpha: number,
): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(HATCH_SIZE * HATCH_SIZE * 4);
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);

  for (let y = 0; y < HATCH_SIZE; y++) {
    for (let x = 0; x < HATCH_SIZE; x++) {
      const on = (x + y) % HATCH_PERIOD < HATCH_WIDTH;
      const at = (y * HATCH_SIZE + x) * 4;
      if (!on) continue;
      data[at] = Math.round((ink[0] * a) / 255);
      data[at + 1] = Math.round((ink[1] * a) / 255);
      data[at + 2] = Math.round((ink[2] * a) / 255);
      data[at + 3] = a;
    }
  }

  return { width: HATCH_SIZE, height: HATCH_SIZE, data };
}

/* ------------------------------------------------------------------ pintura */

const emptyFeatureCollection: FeatureCollection<Polygon, ClimCellProperties> = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * L'opacitat de la tinta segons la puntuació de la cel·la.
 *
 * Les dues parades del mig són `BAND_CLEAR_MIN` i `BAND_PARTIAL_MIN` de
 * `core/weather/layers.ts`, importades i no copiades: són els llindars que
 * decideixen la paraula de la fitxa, i el color ha de canviar de règim
 * exactament allà on canvia la paraula.
 *
 * Els extrems no arriben ni a 0 ni a 1 a posta. A dalt, una cel·la de cel net
 * ha de deixar-se veure —si desaparegués, «no hi ha dada» i «cel net» es
 * dibuixarien igual, i són coses molt diferents. A baix, ni la cel·la més
 * tapada no pot amagar la cartografia: sota d'això hi ha la franja, que és la
 * resposta principal del mapa.
 */
function opacityRamp(): unknown[] {
  return [
    'interpolate',
    ['linear'],
    ['get', 'score'],
    0,
    0.55,
    BAND_PARTIAL_MIN,
    0.38,
    BAND_CLEAR_MIN,
    0.18,
    100,
    0.06,
  ];
}

export interface CloudsOptions {
  /**
   * Capa per sota de la qual inserir-ho tot. Els núvols són CONTEXT: van sota
   * la franja, com el relleu ombrejat, i mai la poden tapar.
   */
  beforeId?: string;
}

/**
 * Pinta (o actualitza) les cel·les de nuvolositat. Idempotent: es crida a cada
 * render i només crea les coses el primer cop.
 *
 * `texture` ve de `planCloudMap()` i no es decideix aquí: si aquesta capa
 * tornés a decidir la font, el mapa i la fitxa del punt podrien acabar
 * ensenyant coses diferents el mateix dia, que és el defecte més difícil
 * d'explicar de tots.
 *
 * Les cel·les són `ClimCell` també quan surten d'una previsió viva: la
 * geometria i les propietats han de ser les MATEIXES en els dos modes, perquè
 * l'única cosa que ha de canviar amb la font és la cara.
 */
export function applyClouds(
  map: MapLibreMap,
  palette: Palette,
  cells: readonly ClimCell[] | null,
  texture: CloudMapTexture,
  options: CloudsOptions = {},
): void {
  if (map.getSource(CLOUD_SOURCE) === undefined) {
    map.addSource(CLOUD_SOURCE, { type: 'geojson', data: emptyFeatureCollection });

    map.addLayer(
      {
        id: CLOUD_FILL_LAYER,
        type: 'fill',
        source: CLOUD_SOURCE,
        paint: {
          'fill-color': palette.statusCloudy,
          'fill-opacity': opacityRamp() as never,
          /*
           * SENSE ANTIALIÀSING A LES VORES INTERIORS. Amb `fill-antialias`
           * actiu, MapLibre dibuixa una vora suau a cada polígon i entre dues
           * cel·les veïnes hi queda un fil més clar: una quadrícula fantasma
           * que no és cap dada. La retícula que sí que es vol la posa la capa
           * de línies, que es controla.
           */
          'fill-antialias': false,
        },
      },
      options.beforeId,
    );

    /*
     * LA TRAMA DE LA CLIMATOLOGIA, en una capa a part i no dins de l'anterior.
     *
     * Perquè les dues coses han de poder dir-se alhora: la trama diu D'ON surt
     * la dada (estadística o model) i l'opacitat de sota diu QUANT tapa. Si la
     * trama substituís el farciment, en mode climatologia el mapa perdria la
     * xifra; si el farciment portés el patró, el patró no es podria apagar
     * quan arribés la previsió sense refer la capa.
     */
    const ink = inkBytes(palette.statusCloudy);
    if (ink !== null && map.hasImage?.(CLOUD_HATCH_IMAGE) !== true) {
      map.addImage(CLOUD_HATCH_IMAGE, hatchImage(ink, 0.55), { pixelRatio: 2 });
    }
    if (ink !== null) {
      map.addLayer(
        {
          id: CLOUD_HATCH_LAYER,
          type: 'fill',
          source: CLOUD_SOURCE,
          layout: { visibility: texture === 'hatch' ? 'visible' : 'none' },
          paint: { 'fill-pattern': CLOUD_HATCH_IMAGE, 'fill-antialias': false },
        },
        options.beforeId,
      );
    }

    /*
     * LA RETÍCULA: el gra de 25 km, dit amb una línia.
     *
     * És la part que fa que això no sembli una fotografia. Va molt apagada
     * —és una nota al peu, no una dada— però hi ha de ser: sense ella, dues
     * cel·les amb puntuacions properes es fonen en una taca contínua i el mapa
     * torna a prometre un detall que no té.
     */
    map.addLayer(
      {
        id: CLOUD_GRID_LAYER,
        type: 'line',
        source: CLOUD_SOURCE,
        paint: {
          'line-color': withAlpha(palette.statusCloudy, 0.35),
          'line-width': 0.5,
        },
      },
      options.beforeId,
    );
  }

  // La cara pot canviar sense refer res: el mateix dia que la previsió entra
  // en horitzó, `planCloudMap` passa de 'hatch' a 'solid' i això és tot el que
  // ha de passar al mapa.
  if (map.getLayer(CLOUD_HATCH_LAYER) !== undefined) {
    map.setLayoutProperty(
      CLOUD_HATCH_LAYER,
      'visibility',
      texture === 'hatch' ? 'visible' : 'none',
    );
  }

  (map.getSource(CLOUD_SOURCE) as GeoJSONSource).setData(
    cells === null || cells.length === 0
      ? emptyFeatureCollection
      : climCellsToGeoJson(cells),
  );
}

/**
 * Treu capes i font. Segur de cridar encara que no hi siguin.
 *
 * LA IMATGE DE LA TRAMA ES QUEDA. És una textura de 16×16 (un kilobyte llarg)
 * i treure-la obligaria a tornar-la a generar cada cop que algú apaga i encén
 * la capa; a més, `removeImage` sobre una imatge que encara referencia una
 * capa a mig desmuntar és una manera coneguda de deixar MapLibre pintant
 * quadrats buits.
 */
export function removeClouds(map: MapLibreMap): void {
  for (const layer of [CLOUD_GRID_LAYER, CLOUD_HATCH_LAYER, CLOUD_FILL_LAYER]) {
    if (map.getLayer(layer) !== undefined) map.removeLayer(layer);
  }
  if (map.getSource(CLOUD_SOURCE) !== undefined) map.removeSource(CLOUD_SOURCE);
}
