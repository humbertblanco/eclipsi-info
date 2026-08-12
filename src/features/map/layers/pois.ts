/**
 * Els punts d'observació OFICIALS sobre el mapa.
 *
 * La dada és `src/data/observation-points/`: els recintes que set administracions
 * han habilitat per veure-hi l'eclipsi, amb qui ho ha anunciat i l'URL on ho
 * diu. Aquesta capa només els pinta i els fa tocables; qui decideix què hi ha
 * dins és el catàleg, i qui ensenya la fitxa és la pantalla.
 *
 * ── QUATRE DECISIONS, I EL PERQUÈ DE CADASCUNA ──────────────────────────────
 *
 * 1. TO `statusInfo`, MAI AMBRE. Un punt oficial és una INFORMACIÓ, no un
 *    veredicte: que una administració hi posi lavabos i policia no diu res de
 *    si des d'allà es veurà la totalitat. Al mapa l'ambre és de la FRANJA i
 *    això no s'hi pot barrejar. El que ens diferencia de la llista de
 *    l'administració és justament que a sobre d'aquest punt hi posem després el
 *    veredicte de relleu — i per fer-ho ha de quedar clar que són dues coses.
 *
 * 2. EL PUNT SENCER TORNA AL QUI EL TOCA. `onPick` no rep un identificador ni
 *    unes coordenades: rep l'`ObservationPoint`. La capçalera de la fitxa ha de
 *    poder ensenyar el nom, LA FONT i l'enllaç sense tornar a buscar res, i la
 *    font sempre visible és una regla d'aquest producte (vegeu la regla 1 de
 *    `catalog.ts`). Amb un identificador, algú acabaria pintant una fitxa sense
 *    font el dia que la cerca fallés.
 *
 * 3. LA COORDENADA ESTIMADA NO ES DIBUIXA COM UNA D'EXACTA. De 280 punts, 108
 *    surten d'un NOM DE LLOC que hem hagut de buscar a OpenStreetMap i poden
 *    ballar un quilòmetre llarg (`precision: 'estimated'`). Pintar-los amb el
 *    mateix disc de sis píxels seria dir amb el dibuix el contrari del que diu
 *    la fitxa. Porten a sota un halo que fa aproximadament UN QUILÒMETRE DE
 *    RADI SOBRE EL TERRENY —creix amb el zoom, com qualsevol cosa mesurada en
 *    metres— i que vol dir exactament «és aquí dins». Vegeu `estimatedHaloPx`.
 *
 * 4. NI TEXT NI ICONES, I NO ÉS PER GUST. L'estil base del mapa (`EclipseMap`)
 *    no declara `glyphs`: és una cartografia rasteritzada i no baixa cap
 *    tipografia. Qualsevol capa `symbol` amb `text-field` no pintaria res i
 *    ompliria la consola d'errors. Els noms van a la fitxa, que és on es poden
 *    llegir de debò. Pel mateix motiu els tres tipus de punt (`official`,
 *    `event`, `observatory`) NO es distingeixen amb tres colors: el tipus no és
 *    cap escala i tres blaus es llegirien com si ho fos. Ho diu la fitxa amb
 *    lletres.
 *
 * ── LA CAPA DE TOC ──────────────────────────────────────────────────────────
 *
 * Hi ha una capa invisible (`pois-hit`) més grossa que el disc. Un cercle de
 * sis píxels és impossible d'encertar amb el dit sobre un mapa que a més
 * s'arrossega; MapLibre consulta la GEOMETRIA dibuixada i no el color, o sigui
 * que un cercle amb opacitat zero segueix atrapant el toc. És el que fa que la
 * fitxa s'obri al primer intent i no al tercer.
 */

import type { FeatureCollection, Point } from 'geojson';
import type {
  GeoJSONSource,
  MapLayerMouseEvent,
  MapLibreMap,
} from 'maplibre-gl';
import type { ObservationPoint } from '../../../data/observation-points/catalog';
import { withAlpha, type Palette } from '../../../styles/palette';

const POI_SOURCE = 'observation-points';
export const POI_HALO_LAYER = 'pois-halo';
export const POI_DOT_LAYER = 'pois-dot';
export const POI_HIT_LAYER = 'pois-hit';

/**
 * Les capes que atrapen el dit, per a qui escolti el clic GLOBAL del mapa.
 *
 * PER QUÈ FA FALTA EXPORTAR-LES, i és el detall que fa que el gest funcioni.
 * `EclipseMap` té un `map.on('click', …)` que canvia el punt de l'usuari allà
 * on toqui. MapLibre reparteix el MATEIX esdeveniment als escoltadors de capa i
 * als globals, o sigui que tocar una xinxeta obriria la fitxa del punt oficial
 * I mouria el punt de l'usuari a la coordenada del dit: dues respostes per a un
 * sol gest.
 *
 * `event.preventDefault()` no ho arregla tot sol, perquè l'ordre en què es
 * criden els escoltadors depèn de l'ordre en què s'han registrat, i aquí NO és
 * estable: a producció l'estil ja ha carregat dins del constructor i les capes
 * es registren abans que el clic global; en desenvolupament arriba al revés
 * (vegeu el comentari llarg de `style.load` a `EclipseMap`). El que sí que és
 * estable és preguntar-li al mapa què hi ha sota el dit, i per això la llista
 * ha de sortir d'aquí i no escrita a mà a l'altra banda.
 */
export const POI_INTERACTIVE_LAYERS: readonly string[] = [POI_HIT_LAYER];

/** Radi del disc visible, en píxels. */
const DOT_RADIUS_PX = 5.5;

/**
 * Radi de la capa de toc, en píxels.
 *
 * 18 px és el radi que deixa una diana de 36 px de diàmetre, que és el mínim
 * que demanen les guies d'accessibilitat per a un objectiu tàctil. Com que la
 * capa és invisible, fer-la més grossa no embruta res: només fa que dos punts
 * veïns es trepitgin, i per això no s'hi va més amunt.
 */
const HIT_RADIUS_PX = 18;

/**
 * Quant val un quilòmetre en píxels, per a l'halo de la coordenada estimada.
 *
 * A la latitud de la Península (uns 40°) un píxel de Web Mercator val
 * 156.543 · cos(40°) / 2^z metres. D'aquí surt la taula: a z8 un quilòmetre
 * són dos píxels i a z14 en són cent trenta-set. L'expressió és una
 * interpolació exponencial sobre el zoom, que és exactament com creix aquella
 * fórmula, i per això quatre parades hi caben sense error apreciable.
 *
 * AMB UN SOSTRE, i val més dir-lo que amagar-lo: per damunt de z13 l'halo
 * ompliria la pantalla sencera i deixaria de ser informació per ser una taca.
 * Es queda a 96 px. Qui s'ha apropat tant ja llegeix a la fitxa que la ubicació
 * és estimada; el dibuix no hi pot afegir res més.
 */
export function estimatedHaloPx(zoom: number): number {
  const metresPerPixel = (156543.03 * Math.cos((40 * Math.PI) / 180)) / 2 ** zoom;
  return Math.min(96, 1000 / metresPerPixel);
}

/** Propietats que viatgen amb cada xinxeta. Les mínimes per pintar i per trobar. */
interface PoiProperties {
  /** Identificador del punt dins del catàleg: el que torna a buscar el punt sencer. */
  id: string;
  /** 1 si la coordenada és estimada. MapLibre filtra millor amb números que amb text. */
  estimated: number;
  /**
   * 1 si des d'aquell punt l'eclipsi és NOMÉS PARCIAL.
   *
   * El catàleg en té dotze de la Comunitat de Madrid, i haver-los d'obrir per
   * saber-ho seria la pitjor manera d'assabentar-se'n: qui mira el mapa
   * decideix on va MIRANT-LO, i un punt oficial que no veurà la totalitat no
   * es pot pintar igual que un que sí. No és cap veredicte negatiu —per a qui
   * no es pot moure, aquell punt és la resposta bona— i per això es diu amb un
   * anell buit i no amb un color d'alarma.
   */
  partial: number;
}

function poisGeoJson(
  points: readonly ObservationPoint[],
): FeatureCollection<Point, PoiProperties> {
  return {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature',
      properties: {
        id: point.id,
        estimated: point.precision === 'estimated' ? 1 : 0,
        partial: point.phase === 'partial' ? 1 : 0,
      },
      geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
    })),
  };
}

const emptyFeatureCollection: FeatureCollection<Point, PoiProperties> = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * Què fer quan algú toca un punt.
 *
 * Rep l'`ObservationPoint` SENCER (vegeu la decisió 2 de la capçalera): la
 * capçalera de la fitxa n'ha de poder treure el nom, la font i l'enllaç sense
 * anar-los a buscar enlloc.
 */
export type PoiPickHandler = (point: ObservationPoint) => void;

/**
 * L'estat viu de la capa per a un mapa concret.
 *
 * PER QUÈ NO ÉS UNA CLAUSURA DINS DE `applyPois`. Els escoltadors de MapLibre
 * es registren UNA vegada —tornar-los a registrar a cada render obriria una
 * fitxa per cada render acumulat—, però tant la llista de punts com el callback
 * del pare canvien sovint. Si l'escoltador tanqués sobre ells, es quedaria
 * mirant per sempre la llista i el callback del primer render. Amb el registre
 * en un `WeakMap` per mapa, l'escoltador és el mateix i el que llegeix és
 * sempre l'últim. El `WeakMap` a més no reté el mapa: quan React el desmunta i
 * el recol·lector se l'endú, això se'n va amb ell.
 */
/**
 * Els esdeveniments de capa que aquesta capa registra.
 *
 * Escrit com a unió i no com a `string` perquè `map.off()` demana una clau de
 * `MapLayerEventType`: amb `string`, el compilador no deixa desregistrar res i
 * l'escoltador es quedaria enganxat per sempre. Que el tipus ho impedeixi val
 * més que recordar-se'n.
 */
type LayerEventName = 'click' | 'mouseenter' | 'mouseleave';

interface PoiRegistry {
  points: readonly ObservationPoint[];
  onPick: PoiPickHandler | null;
  listeners: Array<[LayerEventName, string, (event: MapLayerMouseEvent) => void]>;
}

const registry = new WeakMap<MapLibreMap, PoiRegistry>();

/** El punter diu que allò es pot tocar. Al mòbil no hi ha punter i no fa res. */
function setCursor(map: MapLibreMap, cursor: string): void {
  const canvas = map.getCanvas?.();
  if (canvas) canvas.style.cursor = cursor;
}

export interface PoiOptions {
  /** Es crida amb el punt sencer quan algú el toca. */
  onPick?: PoiPickHandler | null;
  /**
   * Capa per sota de la qual inserir-ho tot. Els punts oficials van a SOBRE de
   * la franja (són xinxetes, no context), o sigui que normalment no cal.
   */
  beforeId?: string;
}

/**
 * Pinta (o actualitza) els punts oficials. Idempotent: es crida a cada render i
 * només crea les coses el primer cop.
 *
 * Amb una llista buida NO es desmunta res —es buiden les dades—, igual que fa
 * `applyViewCone`: encendre i apagar la capa no ha de refer l'estil, i el 2027
 * i el 2028 encara no tenen cap punt oficial (llista buida legítima, vegeu
 * `catalog.ts`).
 */
export function applyPois(
  map: MapLibreMap,
  palette: Palette,
  points: readonly ObservationPoint[],
  options: PoiOptions = {},
): void {
  const state = registry.get(map) ?? { points: [], onPick: null, listeners: [] };
  state.points = points;
  state.onPick = options.onPick ?? null;
  registry.set(map, state);

  if (map.getSource(POI_SOURCE) === undefined) {
    map.addSource(POI_SOURCE, { type: 'geojson', data: emptyFeatureCollection });

    /*
     * L'HALO DE LA COORDENADA ESTIMADA, A SOTA DE TOT.
     *
     * Filtrat a `estimated == 1`: els 172 punts que porten coordenada publicada
     * no en tenen, i han de continuar sense tenir-ne. Un halo a tot arreu diria
     * que tot és aproximat, que és tan fals com dir que res no ho és.
     */
    map.addLayer(
      {
        id: POI_HALO_LAYER,
        type: 'circle',
        source: POI_SOURCE,
        filter: ['==', ['get', 'estimated'], 1],
        paint: {
          'circle-color': withAlpha(palette.statusInfo, 0.1),
          'circle-stroke-color': withAlpha(palette.statusInfo, 0.28),
          'circle-stroke-width': 1,
          'circle-radius': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            6,
            estimatedHaloPx(6),
            9,
            estimatedHaloPx(9),
            12,
            estimatedHaloPx(12),
            16,
            estimatedHaloPx(16),
          ],
        },
      },
      options.beforeId,
    );

    map.addLayer(
      {
        id: POI_DOT_LAYER,
        type: 'circle',
        source: POI_SOURCE,
        paint: {
          'circle-color': palette.statusInfo,
          /*
           * EL DISC ENCONGEIX QUAN EL MAPA S'ALLUNYA, i no és cosmètica.
           *
           * Amb 5,5 px fixos i els 280 punts del 2026, a escala de país —que
           * és com s'obre el mapa i com es mira en un telèfon de 390 px— la
           * Rioja i Burgos es converteixen en UNA TACA blava sòlida: no s'hi
           * distingeix cap punt, no se'n pot tocar cap i el que hauria de ser
           * contingut passa a ser soroll damunt de la franja, que és la
           * resposta. Mesurat al navegador a 390 px, que és on es fa servir
           * això de debò.
           *
           * A zoom 5 (península sencera) el disc fa 2,2 px i el conjunt es
           * llegeix com una constel·lació: es veu ON hi ha convocatòries sense
           * tapar res. A partir de zoom 9, on ja es tria un lloc concret, el
           * disc torna a la mida de sempre. La capa de TOC no encongeix mai
           * (vegeu `TOUCH_RADIUS_PX`): el dit necessita els seus 36 px de
           * diana encara que el dibuix sigui petit.
           */
          'circle-radius': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            5,
            DOT_RADIUS_PX * 0.4,
            7,
            DOT_RADIUS_PX * 0.62,
            9,
            DOT_RADIUS_PX,
          ],
          /*
           * La vora fosca no és decoració: sense ella el disc blau desapareix
           * sobre el mar de la cartografia fosca de CARTO, que és blau també.
           */
          'circle-stroke-color': withAlpha(palette.bgPage, 0.9),
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.95,
        },
      },
      options.beforeId,
    );

    /*
     * LA DIANA DEL DIT. Invisible i l'última, perquè MapLibre resol el toc amb
     * la capa de més amunt i aquesta ha de guanyar sempre.
     */
    map.addLayer(
      {
        id: POI_HIT_LAYER,
        type: 'circle',
        source: POI_SOURCE,
        paint: { 'circle-radius': HIT_RADIUS_PX, 'circle-opacity': 0 },
      },
      options.beforeId,
    );

    const onClick = (event: MapLayerMouseEvent): void => {
      const current = registry.get(map);
      if (current?.onPick == null) return;
      const id = event.features?.[0]?.properties?.id;
      if (typeof id !== 'string') return;
      const point = current.points.find((candidate) => candidate.id === id);
      if (point === undefined) return;
      /*
       * El clic del mapa NO s'ha de menjar aquest toc. `EclipseMap` escolta el
       * clic global per triar punt; sense aturar la propagació, tocar una
       * xinxeta obriria la fitxa del punt oficial I canviaria el punt de
       * l'usuari a la coordenada del dit, que és una altra. Un gest, una cosa.
       */
      event.preventDefault();
      current.onPick(point);
    };
    const onEnter = (): void => setCursor(map, 'pointer');
    const onLeave = (): void => setCursor(map, '');

    map.on('click', POI_HIT_LAYER, onClick);
    map.on('mouseenter', POI_HIT_LAYER, onEnter);
    map.on('mouseleave', POI_HIT_LAYER, onLeave);
    state.listeners = [
      ['click', POI_HIT_LAYER, onClick],
      ['mouseenter', POI_HIT_LAYER, onEnter],
      ['mouseleave', POI_HIT_LAYER, onLeave],
    ];
  }

  (map.getSource(POI_SOURCE) as GeoJSONSource).setData(
    points.length === 0 ? emptyFeatureCollection : poisGeoJson(points),
  );
}

/** Treu capes, font i escoltadors. Segur de cridar encara que no hi siguin. */
export function removePois(map: MapLibreMap): void {
  const state = registry.get(map);
  if (state) {
    // Els escoltadors es desregistren amb la MATEIXA referència amb què es van
    // registrar; per això es desen. Sense això, tornar a encendre la capa
    // deixaria dos escoltadors i la fitxa s'obriria dues vegades per toc.
    for (const [type, layer, handler] of state.listeners) map.off(type, layer, handler);
    registry.delete(map);
  }
  for (const layer of [POI_HIT_LAYER, POI_DOT_LAYER, POI_HALO_LAYER]) {
    if (map.getLayer(layer) !== undefined) map.removeLayer(layer);
  }
  if (map.getSource(POI_SOURCE) !== undefined) map.removeSource(POI_SOURCE);
}
