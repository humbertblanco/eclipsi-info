/**
 * Els miradors i els cims d'OpenStreetMap sobre el mapa.
 *
 * La dada la cuina `scripts/build-viewpoints.ts` i la valida
 * `core/places/viewpoints.ts`; el fitxer del 2026 són 1.336 llocs i 225 kB ja
 * publicats a `public/data/`. Aquí només es baixa quan cal, s'agrupa i es
 * pinta.
 *
 * ── PER QUÈ LA CÀRREGA ÉS MANDROSA ──────────────────────────────────────────
 *
 * Perquè 225 kB no els pot pagar qui no encén la capa. El JSON viu a `public/`
 * i per tant no entra al paquet passi el que passi, però la PETICIÓ sí que es
 * podria fer sempre, i seria mig segon de xarxa el dia de l'eclipsi amb la
 * cel·la saturada per a una funció que la majoria no obrirà. Es demana el
 * primer cop que s'encén l'interruptor i no abans.
 *
 * No hi ha memòria cau escrita a mà: el service worker ja té regla pròpia per a
 * `/data/*.json` (`StaleWhileRevalidate`, calaix `eclipsi-dades-v1`), o sigui
 * que la segona visita el serveix de disc i sense cobertura també. L'únic que
 * es desa aquí és la PROMESA en memòria, per si algú apaga i encén la capa tres
 * vegades seguides mentre la primera petició encara vola.
 *
 * ── L'AGRUPACIÓ, I PER QUÈ NO PORTA NÚMEROS ─────────────────────────────────
 *
 * Milers de xinxetes són una taca. L'agrupació la fa MapLibre (`cluster: true`
 * a la font), que és codi provat i corre al seu worker. El que no es pot fer és
 * el número a dins del cercle: l'estil base d'aquest mapa és una cartografia
 * rasteritzada i NO declara `glyphs` (vegeu `EclipseMap`), o sigui que no baixa
 * cap tipografia i qualsevol `text-field` no pintaria res mentre omple la
 * consola d'errors. Declarar `glyphs` seria afegir una descàrrega de fonts a
 * una app que ha de funcionar sense cobertura, per a un número que la MIDA del
 * cercle ja diu prou bé: aquí no cal saber si són 43 o 47, cal saber si allà hi
 * ha molta cosa o poca.
 *
 * ── PUNTUACIÓ EN DOS TEMPS ──────────────────────────────────────────────────
 *
 * El veredicte fi d'aquesta app —quants segons de totalitat sobreviuen al
 * relleu vist des d'aquell punt exacte— val tessel·les d'elevació i un perfil
 * de 360°. No es pot regalar per a mil tres-cents punts alhora, i sobretot no
 * s'ha de fingir: un color per lloc convidaria a llegir-lo com si fos el
 * veredicte.
 *
 *  · AL MAPA: res, o com a molt la durada TEÒRICA (`theoreticalSeconds`), que
 *    és aritmètica pura i no mira el terreny. Quan s'hi passa, només fa el disc
 *    una mica més gros. Cap color de veredicte: el to és `corona100`, el mateix
 *    de la línia central i del con de visió — assenyala sense dir res.
 *  · EN TOCAR-NE UN: `onPick` amb el mirador sencer, i la fitxa hi ofereix
 *    «Calcula-ho des d'aquí». Allà és on es paga el càlcul i on el veredicte és
 *    de debò.
 *
 * ── ATRIBUCIÓ ───────────────────────────────────────────────────────────────
 *
 * Les dades són d'OpenStreetMap sota ODbL 1.0. `OSM_ODBL_ATTRIBUTION` ha de
 * sortir a la interfície allà on es pintin, i la porta el fitxer mateix
 * (`file.attribution`) per si algun dia canvia sense que canviï el codi.
 */

import type { FeatureCollection, Point } from 'geojson';
import type {
  GeoJSONSource,
  MapLayerMouseEvent,
  MapLibreMap,
} from 'maplibre-gl';
import {
  parseViewpointFile,
  type Viewpoint,
  type ViewpointFile,
} from '../../../core/places/viewpoints';
import { viewpointsDataUrl } from '../../../offline/config';
import { withAlpha, type Palette } from '../../../styles/palette';

const VIEWPOINT_SOURCE = 'viewpoints';
export const VIEWPOINT_CLUSTER_LAYER = 'viewpoints-cluster';
export const VIEWPOINT_DOT_LAYER = 'viewpoints-dot';
export const VIEWPOINT_HIT_LAYER = 'viewpoints-hit';

/**
 * Les capes que atrapen el dit, per a qui escolti el clic GLOBAL del mapa.
 * Vegeu `POI_INTERACTIVE_LAYERS` a `pois.ts`: mateix problema i mateixa
 * solució. Aquí n'hi ha dues perquè un grup també es toca.
 */
export const VIEWPOINT_INTERACTIVE_LAYERS: readonly string[] = [
  VIEWPOINT_HIT_LAYER,
  VIEWPOINT_CLUSTER_LAYER,
];

/**
 * Zoom a partir del qual ja no s'agrupa res.
 *
 * A z11 la cel·la de la malla amb què es va aprimar el fitxer (4 km, vegeu
 * `DEFAULT_RELEVANCE`) ocupa prop de dos-cents píxels: els punts ja no es
 * trepitgen i agrupar-los amagaria coses que hi caben.
 */
const CLUSTER_MAX_ZOOM = 11;

/** Radi d'agrupació en píxels. El de per defecte de MapLibre (50) és massa gros
 *  per a una malla que ja ve aprimada: deixava grups de dos a mig zoom. */
const CLUSTER_RADIUS_PX = 38;

/** Radi de la diana invisible del dit, en píxels. El mateix que als punts oficials. */
const HIT_RADIUS_PX = 18;

/* --------------------------------------------------------- càrrega mandrosa */

export type ViewpointsErrorCode =
  /** No s'ha pogut arribar al fitxer (sense xarxa, 404, servidor caigut). */
  | 'network'
  /** El fitxer ha arribat però no és una graella de miradors llegible. */
  | 'format';

/**
 * Fallada en baixar el catàleg.
 *
 * PORTA CODI I NO FRASE, com `CloudClimGridError`: el text de pantalla el
 * decideix la interfície, que és qui sap l'idioma i el context. Aquí només se
 * sap què ha passat.
 */
export class ViewpointsLoadError extends Error {
  readonly code: ViewpointsErrorCode;

  constructor(message: string, code: ViewpointsErrorCode) {
    super(message);
    this.name = 'ViewpointsLoadError';
    this.code = code;
  }
}

/**
 * Peticions en vol o ja resoltes, per eclipsi.
 *
 * ES DESA LA PROMESA I NO EL RESULTAT: apagar i encendre l'interruptor tres
 * vegades mentre la primera petició encara vola ha de donar UNA petició, no
 * tres. Si falla, l'entrada es treu perquè un reintent pugui tornar-ho a provar
 * de debò — deixar-hi una promesa rebutjada convertiria una caiguda de xarxa de
 * mig segon en una capa morta per a tota la sessió.
 */
const inFlight = new Map<string, Promise<ViewpointFile>>();

export interface LoadViewpointsOptions {
  /** Arrel del desplegament. Al navegador, `import.meta.env.BASE_URL`. */
  baseUrl?: string;
  /** Per cancel·lar si l'usuari apaga la capa abans que arribi. */
  signal?: AbortSignal;
}

/**
 * Baixa (un sol cop) el catàleg de miradors d'un eclipsi.
 *
 * La URL surt d'`offline/config`, com totes les que demana aquesta app: és
 * l'única manera que el service worker i el mapa parlin del mateix fitxer.
 */
export function loadViewpoints(
  eclipseId: string,
  options: LoadViewpointsOptions = {},
): Promise<ViewpointFile> {
  const cached = inFlight.get(eclipseId);
  if (cached !== undefined) return cached;

  const url = viewpointsDataUrl(eclipseId, options.baseUrl ?? '/');
  const request = fetch(url, { signal: options.signal })
    .then(async (response) => {
      if (!response.ok) {
        throw new ViewpointsLoadError(
          `El catàleg de miradors ha tornat ${response.status}`,
          'network',
        );
      }
      const raw: unknown = await response.json();
      const file = parseViewpointFile(raw);
      if (file === null) {
        throw new ViewpointsLoadError('El catàleg de miradors no és llegible', 'format');
      }
      return file;
    })
    .catch((error: unknown) => {
      inFlight.delete(eclipseId);
      if (error instanceof ViewpointsLoadError) throw error;
      // Xarxa caiguda, JSON truncat a mig baixar, avortament: tot això arriba
      // aquí com a coses ben diferents i cap no és cosa que l'usuari pugui
      // arreglar. Se'n diu «network» perquè és el que la interfície ha de dir.
      throw new ViewpointsLoadError(String(error), 'network');
    });

  inFlight.set(eclipseId, request);
  return request;
}

/** Oblida el que s'ha baixat. Només per a les proves i per a un reintent net. */
export function forgetViewpoints(eclipseId?: string): void {
  if (eclipseId === undefined) inFlight.clear();
  else inFlight.delete(eclipseId);
}

/* ------------------------------------------------------------------ pintura */

/** Propietats que viatgen amb cada mirador. Les mínimes per pintar i per trobar. */
interface ViewpointProperties {
  /** Identificador OSM amb prefix de tipus (`n`, `w`, `r`). */
  id: string;
  /** 1 si és un mirador senyalitzat, 0 si és un cim. */
  signposted: number;
  /**
   * Durada teòrica de la fase central en segons, o 0 si no se n'ha demanat cap.
   * TEÒRICA vol dir al nivell del mar i sense mirar el relleu: no és cap
   * veredicte i el dibuix no la pot fer semblar-ho.
   */
  sec: number;
}

export interface ViewpointsOptions {
  /**
   * Durada teòrica per identificador de mirador, si la pantalla l'ha calculada.
   * És barata (aritmètica sobre la trajectòria) i opcional: sense ella tots els
   * discs són iguals, que és la lectura més honesta de totes.
   */
  theoreticalSeconds?: ReadonlyMap<string, number> | null;
  /** Es crida amb el mirador sencer quan algú el toca. */
  onPick?: ((viewpoint: Viewpoint) => void) | null;
  /** Capa per sota de la qual inserir-ho tot. */
  beforeId?: string;
}

function viewpointsGeoJson(
  list: readonly Viewpoint[],
  seconds: ReadonlyMap<string, number> | null,
): FeatureCollection<Point, ViewpointProperties> {
  return {
    type: 'FeatureCollection',
    features: list.map((item) => ({
      type: 'Feature',
      properties: {
        id: item.id,
        signposted: item.kind === 'viewpoint' ? 1 : 0,
        sec: Math.max(0, Math.round(seconds?.get(item.id) ?? 0)),
      },
      geometry: { type: 'Point', coordinates: [item.lon, item.lat] },
    })),
  };
}

const emptyFeatureCollection: FeatureCollection<Point, ViewpointProperties> = {
  type: 'FeatureCollection',
  features: [],
};

/** Vegeu `PoiRegistry` i `LayerEventName`: mateix problema i mateixa solució. */
type LayerEventName = 'click' | 'mouseenter' | 'mouseleave';

interface ViewpointRegistry {
  points: readonly Viewpoint[];
  onPick: ((viewpoint: Viewpoint) => void) | null;
  listeners: Array<[LayerEventName, string, (event: MapLayerMouseEvent) => void]>;
}

const registry = new WeakMap<MapLibreMap, ViewpointRegistry>();

function setCursor(map: MapLibreMap, cursor: string): void {
  const canvas = map.getCanvas?.();
  if (canvas) canvas.style.cursor = cursor;
}

/**
 * Pinta (o actualitza) els miradors. Idempotent, com totes les capes d'aquest
 * mapa: es crida a cada render i només crea les coses el primer cop.
 *
 * Amb `null` o llista buida es buiden les dades en comptes de desmuntar les
 * capes, perquè encendre i apagar no ha de refer l'estil.
 */
export function applyViewpoints(
  map: MapLibreMap,
  palette: Palette,
  viewpoints: readonly Viewpoint[] | null,
  options: ViewpointsOptions = {},
): void {
  const list = viewpoints ?? [];
  const state = registry.get(map) ?? { points: [], onPick: null, listeners: [] };
  state.points = list;
  state.onPick = options.onPick ?? null;
  registry.set(map, state);

  if (map.getSource(VIEWPOINT_SOURCE) === undefined) {
    map.addSource(VIEWPOINT_SOURCE, {
      type: 'geojson',
      data: emptyFeatureCollection,
      cluster: true,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterRadius: CLUSTER_RADIUS_PX,
    });

    /*
     * EL GRUP: un cercle buit que creix amb el que hi ha a dins.
     *
     * Buit i no ple perquè un disc opac de trenta píxels taparia la
     * cartografia justament allà on hi ha més coses per mirar. Els tres graons
     * (2, 25 i 100 llocs) no són una escala fina: no cal saber quants n'hi ha,
     * cal veure que allà s'hi ha d'entrar.
     */
    map.addLayer(
      {
        id: VIEWPOINT_CLUSTER_LAYER,
        type: 'circle',
        source: VIEWPOINT_SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': withAlpha(palette.corona100, 0.1),
          'circle-stroke-color': withAlpha(palette.corona100, 0.7),
          'circle-stroke-width': 1.25,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            10,
            25,
            15,
            100,
            21,
          ],
        },
      },
      options.beforeId,
    );

    /*
     * EL LLOC SOL.
     *
     * El mirador SENYALITZAT es pinta ple i el cim, buit. La diferència no és
     * decorativa: un `tourism=viewpoint` és un lloc amb accés, sovint amb
     * aparcament i un rètol, i un `natural=peak` és un cim que potser només s'hi
     * arriba a peu i de dia. Qui hi va en cotxe amb temps comptat ho ha de poder
     * distingir sense obrir res. Es diu amb la FORMA i no amb un segon color,
     * perquè la regla d'aquest mapa és un sol accent i aquí ni tan sols n'hi ha
     * cap: `corona100` assenyala i calla.
     */
    map.addLayer(
      {
        id: VIEWPOINT_DOT_LAYER,
        type: 'circle',
        source: VIEWPOINT_SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case',
            ['==', ['get', 'signposted'], 1],
            withAlpha(palette.corona100, 0.85),
            withAlpha(palette.corona100, 0.06),
          ],
          'circle-stroke-color': withAlpha(palette.corona100, 0.8),
          'circle-stroke-width': 1,
          /*
           * LA DURADA TEÒRICA, SI N'HI HA, I NOMÉS COM A MIDA.
           *
           * Sense `theoreticalSeconds` tots els discs fan 4 px i el mapa no diu
           * res de cap lloc, que és la lectura honesta per defecte. Amb ella,
           * els graons són a 60 s i 120 s: prou per veure d'una ullada cap on
           * s'allarga la fase central, massa gruixuts per confondre'ls amb un
           * veredicte. El veredicte de relleu no hi és fins que no el demanes.
           */
          'circle-radius': [
            'case',
            ['>', ['get', 'sec'], 0],
            ['step', ['get', 'sec'], 3.5, 60, 4.5, 120, 5.5],
            4,
          ],
        },
      },
      options.beforeId,
    );

    /* La diana del dit, invisible i a sobre de tot. Vegeu `pois.ts`. */
    map.addLayer(
      {
        id: VIEWPOINT_HIT_LAYER,
        type: 'circle',
        source: VIEWPOINT_SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: { 'circle-radius': HIT_RADIUS_PX, 'circle-opacity': 0 },
      },
      options.beforeId,
    );

    const onPickPoint = (event: MapLayerMouseEvent): void => {
      const current = registry.get(map);
      if (current?.onPick == null) return;
      const id = event.features?.[0]?.properties?.id;
      if (typeof id !== 'string') return;
      const viewpoint = current.points.find((candidate) => candidate.id === id);
      if (viewpoint === undefined) return;
      // Que el clic global del mapa no canviï també el punt de l'usuari: un
      // gest, una cosa. Vegeu la mateixa nota a `pois.ts`.
      event.preventDefault();
      current.onPick(viewpoint);
    };

    /*
     * TOCAR UN GRUP L'OBRE. És el gest que tothom espera d'un mapa agrupat, i
     * sense ell un grup és una taca que no fa res. `getClusterExpansionZoom` és
     * asíncron a MapLibre 6 i pot fallar si la font ja no hi és perquè l'usuari
     * ha apagat la capa mentre s'esperava: la fallada s'empassa a posta, perquè
     * no hi ha res a dir-li a ningú.
     */
    const onClusterClick = (event: MapLayerMouseEvent): void => {
      const feature = event.features?.[0];
      const clusterId = feature?.properties?.cluster_id;
      if (typeof clusterId !== 'number') return;
      event.preventDefault();
      const source = map.getSource(VIEWPOINT_SOURCE) as GeoJSONSource | undefined;
      if (source?.getClusterExpansionZoom === undefined) return;
      void source
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          map.easeTo({ center: event.lngLat, zoom });
        })
        .catch(() => undefined);
    };

    const onEnter = (): void => setCursor(map, 'pointer');
    const onLeave = (): void => setCursor(map, '');

    map.on('click', VIEWPOINT_HIT_LAYER, onPickPoint);
    map.on('click', VIEWPOINT_CLUSTER_LAYER, onClusterClick);
    map.on('mouseenter', VIEWPOINT_HIT_LAYER, onEnter);
    map.on('mouseleave', VIEWPOINT_HIT_LAYER, onLeave);
    map.on('mouseenter', VIEWPOINT_CLUSTER_LAYER, onEnter);
    map.on('mouseleave', VIEWPOINT_CLUSTER_LAYER, onLeave);
    state.listeners = [
      ['click', VIEWPOINT_HIT_LAYER, onPickPoint],
      ['click', VIEWPOINT_CLUSTER_LAYER, onClusterClick],
      ['mouseenter', VIEWPOINT_HIT_LAYER, onEnter],
      ['mouseleave', VIEWPOINT_HIT_LAYER, onLeave],
      ['mouseenter', VIEWPOINT_CLUSTER_LAYER, onEnter],
      ['mouseleave', VIEWPOINT_CLUSTER_LAYER, onLeave],
    ];
  }

  (map.getSource(VIEWPOINT_SOURCE) as GeoJSONSource).setData(
    list.length === 0
      ? emptyFeatureCollection
      : viewpointsGeoJson(list, options.theoreticalSeconds ?? null),
  );
}

/** Treu capes, font i escoltadors. Segur de cridar encara que no hi siguin. */
export function removeViewpoints(map: MapLibreMap): void {
  const state = registry.get(map);
  if (state) {
    for (const [type, layer, handler] of state.listeners) map.off(type, layer, handler);
    registry.delete(map);
  }
  for (const layer of [
    VIEWPOINT_HIT_LAYER,
    VIEWPOINT_DOT_LAYER,
    VIEWPOINT_CLUSTER_LAYER,
  ]) {
    if (map.getLayer(layer) !== undefined) map.removeLayer(layer);
  }
  if (map.getSource(VIEWPOINT_SOURCE) !== undefined) map.removeSource(VIEWPOINT_SOURCE);
}
