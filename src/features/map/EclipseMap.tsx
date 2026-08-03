/**
 * Mapa de la franja de centralitat amb MapLibre GL.
 *
 * Dues decisions que expliquen com està fet:
 *
 * 1. Fons de mapa SENSE clau d'API. Estil mínim definit aquí mateix, amb la
 *    cartografia fosca de CARTO sobre dades d'OpenStreetMap. Cap servei de
 *    pagament, cap registre, cap token que caduqui. L'atribució d'OSM és
 *    obligatòria per llicència i és visible sempre, igual que la de les
 *    efemèrides de la NASA.
 *
 * 2. En tocar el mapa, aquí només es marca el punt i s'avisa el pare. Les
 *    circumstàncies i el panell de resultats vivien aquí dins, i NO ELS VEIA
 *    NINGÚ: l'únic consumidor d'aquest component és `MapScreen`, que retalla
 *    tot el que no és el llenç (`.mapscreen__stage`, vegeu `screens.css`) i
 *    pinta la seva pròpia fitxa. Eren ~120 línies de panell invisibles i dues
 *    respostes a la mateixa pregunta. El panell viu ara a la fitxa de
 *    `MapScreen`, que és on es veu — i l'única cosa que aquest component ha de
 *    garantir que es vegi SEMPRE és l'avís de fallada, que per això sura sobre
 *    el llenç en comptes d'anar-hi a sota.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BASEMAP } from '../../offline/config';
import {
  type GeoJSONSource,
  LngLatBounds,
  Marker,
  NavigationControl,
  ScaleControl,
  MapLibreMap,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Ha d'anar abans que es construeixi cap mapa: diu a MapLibre on és el seu
// worker, que amb Vite no és on ell es pensa. Vegeu-hi el perquè.
import './maplibreWorker';
import './map.css';

import { Icon } from '../../ui';
import { readPalette } from '../../styles/palette';
import type { GeoLocation } from '../../core/astro/types';
import { getEclipse } from '../../core/eclipses/catalog';
import type { Locale } from '../../i18n';
import { s } from '../../screens/strings';
import {
  computeEclipsePath,
  eclipsePathToGeoJson,
  ESPENAK_ATTRIBUTION,
  type EclipsePathGeoJson,
} from '../../core/eclipses/path';
import { ensureHillshade, removeHillshade } from './layers/hillshade';
import { applyViewCone, type ViewConeData } from './layers/viewCone';
import { applyHeatmap, removeHeatmap, setBandFillForHeatmap } from './layers/heatmap';
import { applyPois, POI_INTERACTIVE_LAYERS, removePois } from './layers/pois';
import {
  applyViewpoints,
  removeViewpoints,
  VIEWPOINT_INTERACTIVE_LAYERS,
} from './layers/viewpoints';
import { applyClouds, removeClouds } from './layers/clouds';
import { applyEdgeUncertainty } from './layers/edgeUncertainty';
import { applyMoveArrow, type MoveArrowData } from './layers/moveArrow';
import type { HeatCellValue } from '../../core/heat/compute';
import type { HeatViewport } from './useHeatmap';
import type { ObservationPoint } from '../../data/observation-points/catalog';
import type { Viewpoint } from '../../core/places/viewpoints';
import type { ClimCell } from '../../core/weather/climGrid';
import type { CloudMapTexture } from '../../core/weather/mapMode';

interface Props {
  eclipseId: string;
  /**
   * Idioma actiu. Arriba per propietat i no d'un hook perquè aquest component
   * el munta `MapScreen`, que ja el té: passar-lo avall és una línia i evita
   * que el mapa depengui d'un context que als tests no sempre hi és.
   */
  locale: Locale;
  /**
   * Es crida amb el punt tocat. L'elevació arriba a zero: qui té l'estat de
   * l'observador és qui ha de resoldre-la contra el model del terreny, que és
   * una operació de xarxa i no toca fer-la des d'aquí.
   */
  onPickLocation?: (loc: GeoLocation) => void;
  /**
   * On és l'usuari, si ja ho ha dit.
   *
   * Serveix per a l'enquadrament inicial: si el seu punt queda fora de la
   * franja —que és el cas en què el mapa serveix de debò, perquè llavors ha de
   * decidir si s'hi acosta— ha de sortir a la vista juntament amb la banda.
   */
  observer?: GeoLocation | null;
  /**
   * El punt tocat, i el mana el PARE, no un estat intern.
   *
   * La diana ha d'anar lligada a la fitxa que la descriu: si el pare descarta
   * el punt («Torna al teu punt»), una diana òrfena que es queda clavada al
   * mapa diu que encara hi ha alguna cosa seleccionada quan la fitxa ja parla
   * d'una altra. Amb el punt com a propietat, marcador i fitxa no es poden
   * dessincronitzar.
   */
  picked?: GeoLocation | null;
  /**
   * Punt on ENQUADRAR la vista, i res més: mou la càmera del mapa sense tocar
   * ni el punt de l'observador ni la diana. El fa servir la cerca de topònims
   * del panell (`MapScreen`): trobar «Peníscola» pel nom porta la VISTA fins
   * allà, i el gest que canvia el teu punt continua sent un de sol — tocar el
   * mapa.
   *
   * ES REACCIONA A LA IDENTITAT DE L'OBJECTE, no a les coordenades: triar el
   * mateix resultat dues vegades ha de tornar a enquadrar-lo, perquè entremig
   * pots haver arrossegat el mapa a l'altra punta.
   *
   * PORTA EL NOM A SOBRE: enquadrar sense marcar deixava l'usuari buscant a
   * ull què havia trobat la cerca. El marcador és informatiu (blau d'estat,
   * no ambre: no és cap acció ni cap veredicte) i no atrapa el dit — el gest
   * de triar punt continua sent tocar el mapa, també just a sota del rètol.
   */
  focus?: { location: GeoLocation; label: string | null } | null;
  /**
   * Els llocs candidats del cercador («Llocs»), numerats com a la llista.
   *
   * El mapa els ensenya perquè la llista sense mapa és mitja resposta: «11 km
   * cap al sud-oest» només es torna un lloc de debò quan veus QUIN coll o
   * QUINA carena és. El número lliga la xinxeta amb la targeta — mateixa
   * numeració, mateixa lectura. NO atrapen el dit (pointer-events: none): el
   * gest que tria punt continua sent tocar el mapa, i cada targeta ja té el
   * seu «Calcula-ho des d'aquí».
   */
  spots?: { lat: number; lon: number; index: number }[] | null;
  /**
   * Relleu ombrejat amb el model d'elevació de l'horitzó. El commuta el
   * control de capes de `MapScreen`; aquí només s'obeeix.
   */
  hillshade?: boolean;
  /**
   * Azimut del Sol al màxim per il·luminar el relleu des d'on serà de debò.
   * Nul (sense punt o sense contactes): llum cartogràfica estàndard de 315°.
   */
  sunAzimuthDeg?: number | null;
  /**
   * El con de visió del punt triat: cap on miraràs durant l'eclipsi. Nul
   * quan no hi ha punt o la capa està apagada.
   */
  cone?: ViewConeData | null;

  /* --- les capes de dades. Nul vol dir «no la pintis», sempre. --- */

  /** Cel·les del mapa de calor de visibilitat. */
  heatCells?: readonly HeatCellValue[] | null;
  /** Sostre de la rampa del mapa de calor, en segons. */
  heatMaxSec?: number;
  /** L'enquadrament, a cada `moveend`: és el que alimenta el mapa de calor. */
  onViewportChange?: (viewport: HeatViewport) => void;

  /** Punts d'observació oficials, amb la seva font. */
  pois?: readonly ObservationPoint[] | null;
  onPickPoi?: (point: ObservationPoint) => void;
  /** Miradors i cims d'OpenStreetMap. */
  viewpoints?: readonly Viewpoint[] | null;
  onPickViewpoint?: (viewpoint: Viewpoint) => void;

  /** Graella de nuvolositat i quina cara ha de fer (climatologia o previsió). */
  cloudCells?: readonly ClimCell[] | null;
  cloudTexture?: CloudMapTexture;

  /**
   * Amplada de la incertesa del límit de la franja, en km, tal com surt de
   * `computeUncertainty().limitUncertaintyKm` — sense retocar: nul i infinit
   * són valors legítims i ja els tracta la capa.
   *
   * ES PASSA EL NÚMERO I NO LA GEOMETRIA a posta. La banda d'incertesa s'ha de
   * dibuixar damunt dels MATEIXOS trams que el mapa pinta com a vora, i aquells
   * els té aquest component (surten de `eclipsePathToGeoJson`, ja desenrotllats
   * i partits on Web Mercator no els pot projectar). Si el pare n'enviés una
   * còpia pròpia, el dia que les dues divergissin la banda travessaria el mapa
   * sencer — que és exactament la família d'error que va costar la vora taronja
   * surant al Mediterrani.
   */
  edgeUncertaintyKm?: number | null;
  /** La fletxa de cap on caminar per guanyar segons. */
  moveArrow?: MoveArrowData | null;
}

/** Atribució d'OSM, obligatòria per llicència. */
const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

/**
 * Cartografia base fosca de CARTO.
 *
 * DUES RAONS PER NO FER SERVIR LES TESSEL·LES D'OPENSTREETMAP DIRECTAMENT:
 *
 * 1. DE DISSENY. Les d'OSM són clares, i aquesta app es mira al capvespre amb
 *    l'ull adaptat a la foscor. Abans les apagàvem per força bruta amb
 *    `raster-brightness-max: 0.62`, i el resultat era una cartografia enfangada
 *    amb els topònims a mig llegir: no és el mateix apagar un mapa clar que fer
 *    servir un mapa dissenyat per ser fosc. El sistema de disseny especifica
 *    CARTO dark, i el kit de referència també.
 *
 * 2. DE POLÍTICA D'ÚS. La política de tessel·les d'OpenStreetMap prohibeix
 *    explícitament que les aplicacions les consumeixin del seu servidor sense
 *    permís, i bloqueja per volum. Els seus servidors els paga una fundació amb
 *    donacions; no són una API pública.
 *
 * L'atribució d'OpenStreetMap segueix sent obligatòria: les dades són seves,
 * el que canvia és qui serveix les imatges.
 */
const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    basemap: {
      type: 'raster',
      /*
       * UN SOL AMFITRIÓ, I SURT DE `offline/config`.
       *
       * Aquí hi havia les tres còpies amb subdomini rotatiu (a/b/c). Cada una
       * és una URL diferent, i les memòries cau es claven a la URL sencera: el
       * que la precàrrega desava per al viatge no el trobava mai ningú. El
       * rotatiu de subdominis va servir de res des que existeix HTTP/2, que
       * multiplexa sobre una sola connexió.
       */
      tiles: [BASEMAP.urlTemplate],
      tileSize: 256,
      maxzoom: BASEMAP.maxZoom,
      attribution: OSM_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: 'basemap',
      type: 'raster',
      source: 'basemap',
      // Ja és fosca de mena: només se li puja una mica el contrast perquè la
      // franja ambre hi destaqui sense haver d'enfosquir res.
      paint: {
        'raster-contrast': 0.08,
      },
    },
  ],
};

const BAND_SOURCE = 'eclipse-band';
const LIMITS_SOURCE = 'eclipse-limits';
const CENTER_SOURCE = 'eclipse-center';

/*
 * Els colors del sistema de disseny. MapLibre pinta en WebGL i no veu les
 * variables de CSS; abans es repetien aquí els hexadecimals a pèl i quedaven
 * orfes quan els tokens es movien. Ara surten de la paleta, que els llegeix
 * una vegada del document: canviar un token canvia també el mapa.
 *
 * Un sol accent ambre per pantalla: aquí és la franja, que és l'única cosa del
 * mapa que respon la pregunta del producte. La línia central va en to corona i
 * no en un segon color, i el tipus d'eclipsi (total o anular) es diu amb
 * lletres al panell en comptes de codificar-lo amb un color més.
 */
const PALETTE = readPalette();

/** L'accent ambre (--accent, que és --sun-500). */
const COLOR_BAND = PALETTE.accent;
/** El to corona (--corona-100). */
const COLOR_CENTER = PALETTE.corona100;

/** Marc de referència: Península, Balears i el llindar de l'Estret. */
const IBERIA_BOUNDS = new LngLatBounds([-10.2, 34.8], [4.6, 44.2]);

/**
 * Zoom mínim de l'enquadrament per cerca: prou a prop per reconèixer el nucli
 * i el seu entorn immediat, prou lluny perquè la franja segueixi donant
 * context — que és la pregunta per la qual algú busca un lloc aquí.
 */
const FOCUS_ZOOM = 9;

/**
 * Enquadrament que ensenya LA FRANJA, no el país.
 *
 * PER QUÈ NO N'HI HA PROU AMB LA PENÍNSULA. La franja és una diagonal estreta
 * que en creua un tros; enquadrant tot Espanya, la banda queda com un fil en un
 * racó i el mapa no respon la pregunta que se li fa, que és «per on passa i
 * quant en queda lluny». S'enquadra el tros de franja que cau dins del marc de
 * referència, i si el punt de l'usuari en queda fora —que és el cas
 * interessant, perquè llavors ha de decidir si s'hi acosta— també s'hi inclou.
 *
 * Si la franja no toca la finestra (l'eclipsi del 2027 passa molt al sud), es
 * cau al marc de sempre en comptes d'enquadrar el no-res.
 */
function frameFor(
  geojson: EclipsePathGeoJson,
  observer: GeoLocation | null,
): LngLatBounds {
  const bounds = new LngLatBounds();
  let any = false;

  for (const [lon, lat] of geojson.band.geometry.coordinates[0] ?? []) {
    if (lon < -10.2 || lon > 4.6 || lat < 34.8 || lat > 44.2) continue;
    bounds.extend([lon, lat]);
    any = true;
  }

  if (!any) return IBERIA_BOUNDS;
  if (observer) bounds.extend([observer.lon, observer.lat]);
  return bounds;
}

const emptyFeatureCollection = {
  type: 'FeatureCollection' as const,
  features: [],
};

/**
 * Aboca la franja al mapa, creant les capes si encara no hi són.
 *
 * Aquesta funció és el punt únic on es toca l'estil, i és idempotent a posta.
 * MapLibre només accepta capes quan l'estil ja ha carregat, i React amb
 * StrictMode munta el component dues vegades: si la creació de les capes i
 * l'assignació de les dades visquessin en efectes separats coordinats per un
 * estat, hi hauria una carrera en què el `load` d'un mapa ja destruït marca com
 * a llest un mapa nou que encara no té les fonts. El resultat és un mapa que
 * carrega però es queda sense franja, i sense cap error a la consola.
 */
function applyPath(map: MapLibreMap, geojson: EclipsePathGeoJson): void {
  if (map.getSource(BAND_SOURCE) === undefined) {
    map.addSource(BAND_SOURCE, { type: 'geojson', data: emptyFeatureCollection });
    map.addSource(LIMITS_SOURCE, { type: 'geojson', data: emptyFeatureCollection });
    map.addSource(CENTER_SOURCE, { type: 'geojson', data: emptyFeatureCollection });

    map.addLayer({
      id: 'band-fill',
      type: 'fill',
      source: BAND_SOURCE,
      paint: { 'fill-color': COLOR_BAND, 'fill-opacity': 0.16 },
    });
    map.addLayer({
      id: 'band-edge',
      type: 'line',
      source: LIMITS_SOURCE,
      paint: { 'line-color': COLOR_BAND, 'line-width': 1.5, 'line-opacity': 0.95 },
    });
    map.addLayer({
      id: 'center-line',
      type: 'line',
      source: CENTER_SOURCE,
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': COLOR_CENTER,
        'line-width': 1.5,
        'line-opacity': 0.85,
        'line-dasharray': [3, 3],
      },
    });
  }

  (map.getSource(BAND_SOURCE) as GeoJSONSource).setData(geojson.band);
  (map.getSource(LIMITS_SOURCE) as GeoJSONSource).setData(geojson.limits);
  (map.getSource(CENTER_SOURCE) as GeoJSONSource).setData(geojson.centerLine);
}

/**
 * Què ha fallat del mapa.
 *
 * ES GUARDA LA CAUSA, NO LA FRASE. El mapa es construeix dins d'un efecte que
 * s'executa una sola vegada, així que una frase ja traduïda hi quedaria clavada
 * a l'idioma que hi havia en aquell instant: canviar de llengua deixava l'avís
 * en català per sempre. Amb la causa, el text el decideix el render.
 */
type MapFailure = { reason: 'webgl'; detail: string } | { reason: 'tiles' };

export function EclipseMap({
  eclipseId,
  locale,
  onPickLocation,
  observer = null,
  picked = null,
  focus = null,
  spots = null,
  hillshade = false,
  sunAzimuthDeg = null,
  cone = null,
  heatCells = null,
  heatMaxSec = 0,
  onViewportChange,
  pois = null,
  onPickPoi,
  viewpoints = null,
  onPickViewpoint,
  cloudCells = null,
  cloudTexture = 'hatch',
  edgeUncertaintyKm = null,
  moveArrow = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [mapError, setMapError] = useState<MapFailure | null>(null);

  // El handler del clic es registra una sola vegada; el callback del pare pot
  // canviar a cada render, així que hi arriba per referència.
  const onPickRef = useRef(onPickLocation);
  onPickRef.current = onPickLocation;
  const observerRef = useRef(observer);
  observerRef.current = observer;

  const eclipse = getEclipse(eclipseId);

  // La franja només depèn de l'eclipsi. Generar-la val ~30 ms: es memoritza
  // perquè no es refaci a cada clic.
  const geojson = useMemo(
    () => eclipsePathToGeoJson(computeEclipsePath(eclipseId)),
    [eclipseId],
  );

  // El `load` del mapa pot arribar abans o després d'un canvi d'eclipsi; agafa
  // sempre la darrera franja calculada, no la que hi havia quan es va crear.
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  /*
   * Les capes opcionals segueixen el mateix règim que la franja: l'estil pot
   * carregar abans o després que canviïn les propietats, així que l'estat
   * viu en referències i una sola funció (`syncLayers`) el reconcilia, tant
   * des del `style.load` com des dels efectes de canvi.
   */
  const wantedLayers = {
    hillshade,
    sunAzimuthDeg,
    cone,
    heatCells,
    heatMaxSec,
    pois,
    onPickPoi,
    viewpoints,
    onPickViewpoint,
    cloudCells,
    cloudTexture,
    edgeUncertaintyKm,
    moveArrow,
  };
  const layersRef = useRef(wantedLayers);
  layersRef.current = wantedLayers;

  // El callback de l'enquadrament també per referència: es registra un sol cop
  // amb el mapa i el pare el pot canviar a cada render.
  const onViewportRef = useRef(onViewportChange);
  onViewportRef.current = onViewportChange;

  const syncLayers = useCallback((map: MapLibreMap): void => {
    const wanted = layersRef.current;
    if (wanted.hillshade) {
      // Sota la franja: el relleu és context i la resposta va a sobre.
      ensureHillshade(
        map,
        PALETTE,
        wanted.sunAzimuthDeg,
        map.getLayer('band-fill') !== undefined ? 'band-fill' : undefined,
      );
    } else {
      removeHillshade(map);
    }
    applyViewCone(map, PALETTE, wanted.cone);

    /*
     * L'ORDRE DE LES CAPES ÉS LA JERARQUIA DE LA RESPOSTA, i per això es
     * declara aquí i no a cada mòdul:
     *
     *   relleu i núvols  → CONTEXT: van sota la franja i no la poden tapar mai
     *   mapa de calor    → DADA: sota la vora ambre, que és qui diu el veredicte
     *   franja           → LA RESPOSTA, i l'únic ambre de la pantalla
     *   xinxetes         → LLOCS: a sobre de tot, perquè es puguin tocar
     *
     * Amb el mapa de calor encès el farciment ambre baixa de 0,16 a 0,06: a
     * 0,16 embruta tots els verds i els fa il·legibles. La VORA no es toca.
     */
    const underBand = map.getLayer('band-fill') !== undefined ? 'band-fill' : undefined;

    if (wanted.cloudCells !== null) {
      applyClouds(map, PALETTE, wanted.cloudCells, wanted.cloudTexture, {
        beforeId: underBand,
      });
    } else {
      removeClouds(map);
    }

    const heatOn = (wanted.heatCells?.length ?? 0) > 0;
    if (heatOn) {
      applyHeatmap(map, PALETTE, wanted.heatCells ?? [], {
        maxSec: wanted.heatMaxSec,
        beforeId: map.getLayer('band-edge') !== undefined ? 'band-edge' : undefined,
      });
    } else {
      removeHeatmap(map);
    }
    setBandFillForHeatmap(map, heatOn);

    /*
     * La banda d'incertesa es munta AQUÍ amb els trams que aquest component
     * acaba de pintar com a vora: la geometria i la incertesa no poden venir
     * de dues bandes diferents. Vegeu la propietat `edgeUncertaintyKm`.
     */
    applyEdgeUncertainty(
      map,
      PALETTE,
      wanted.edgeUncertaintyKm === null
        ? null
        : {
            limitRuns: geojsonRef.current.limits.geometry.coordinates,
            limitUncertaintyKm: wanted.edgeUncertaintyKm,
          },
      underBand,
    );
    applyMoveArrow(map, PALETTE, wanted.moveArrow);

    // Els oficials per damunt dels miradors: són pocs, curats i porten font.
    if (wanted.viewpoints !== null) {
      applyViewpoints(map, PALETTE, wanted.viewpoints, {
        onPick: wanted.onPickViewpoint ?? null,
      });
    } else {
      removeViewpoints(map);
    }
    if (wanted.pois !== null) {
      applyPois(map, PALETTE, wanted.pois, { onPick: wanted.onPickPoi ?? null });
    } else {
      removePois(map);
    }
  }, []);

  // --- Creació del mapa (una sola vegada) ---
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        // L'estil es clona: MapLibre es reserva el dret de modificar l'objecte
        // que rep, i aquest és una constant compartida entre muntatges.
        style: structuredClone(BASEMAP_STYLE),
        /*
         * NO S'ENQUADRA A LA CONSTRUCCIÓ. MAI.
         *
         * `bounds` + `fitBoundsOptions` es resolen amb la caixa que hi hagi en
         * aquell instant, i al mòbil aquella caixa sovint encara no existeix.
         * Amb amplada zero i un marge de quaranta píxels, l'espai disponible
         * surt negatiu i el centre i el zoom surten indefinits: el mapa neix
         * trencat i no se'n recupera. Es neix amb un centre i un zoom
         * qualssevol però VÀLIDS, i s'enquadra de debò quan la caixa existeix
         * (vegeu l'observador de mida, unes línies més avall).
         */
        center: [-3.5, 40.0],
        zoom: 5,
        // L'atribució per defecte es plega en un botó "i" en pantalles
        // estretes; aquí la volem sempre desplegada perquè és obligatòria.
        attributionControl: {
          compact: false,
          customAttribution: ESPENAK_ATTRIBUTION,
        },
      });
    } catch (err) {
      setMapError({ reason: 'webgl', detail: (err as Error).message });
      return;
    }

    mapRef.current = map;

    /*
     * REDIMENSIONAR QUAN CANVIÏ LA CAIXA, I NO NOMÉS QUAN CANVIÏ LA FINESTRA.
     *
     * MapLibre només escolta el `resize` de la finestra. Al mòbil això no
     * n'hi ha prou i el símptoma és brutal: si el contenidor arriba a existir
     * amb alçada zero —perquè la cadena de flexbox encara no s'ha resolt, o
     * perquè la barra d'adreces del navegador encara s'està plegant— el mapa
     * es construeix amb una transformació degenerada, no demana cap tessel·la
     * i no torna a intentar-ho mai. El resultat és un mapa en blanc, sense cap
     * error a la consola, que a l'escriptori no passa perquè allà la caixa ja
     * té mida des del primer instant.
     *
     * Amb un observador de mida, cada canvi de caixa el reajusta i n'hi ha
     * prou amb un per treure'l del clot.
     */
    /*
     * I L'ENQUADRAMENT ES REFÀ, QUE ÉS LA MEITAT QUE FALTAVA.
     *
     * `resize()` ajusta el llenç però NO toca el centre ni el zoom: els va
     * calcular `fitBounds` a la construcció, contra la caixa que hi havia
     * llavors. Mesurat al navegador amb la pantalla del mapa acabada d'obrir:
     * centre a 10,41° O / 36,78° N i zoom 4,55 —o sigui l'oceà al sud-oest de
     * Portugal— quan l'enquadrament bo de la Península és 2,80° O / 39,66° N a
     * zoom 5,68. La franja quedava fora de la vista i el mapa semblava trencat.
     *
     * Per això no n'hi ha prou d'observar la mida: el primer cop que la caixa
     * té una mida creïble s'ha de tornar a enquadrar. Després ja no, que seria
     * arrabassar-li el mapa a qui l'estigui movent.
     */
    let framed = false;
    const frameIfPossible = (): void => {
      if (framed) return;
      // Marge inclòs: enquadrar contra una caixa que amb prou feines hi cap
      // dona el mateix problema que enquadrar contra una de buida.
      if (container.clientWidth <= 120 || container.clientHeight <= 120) return;
      framed = true;
      map.fitBounds(frameFor(geojsonRef.current, observerRef.current), {
        // Amb la franja enquadrada de costat a costat, setze píxels la
        // deixaven tocant les vores.
        padding: 40,
        duration: 0,
      });
    };

    frameIfPossible();
    let sizeWatcher: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      sizeWatcher = new ResizeObserver(() => {
        map.resize();
        frameIfPossible();
      });
      sizeWatcher.observe(container);
    }

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    // `style.load` arriba tan bon punt l'estil és utilitzable; `load` espera a
    // més que hi hagi tessel·les carregades i, si la xarxa va justa, pot trigar
    // molt o no arribar mai. La franja no ha d'esperar les tessel·les.
    /*
     * L'ESTIL POT HAVER CARREGAT ABANS QUE ARRIBEM AQUÍ, I A PRODUCCIÓ PASSA
     * SEMPRE.
     *
     * Amb `style.load` tot sol, la franja no es dibuixava mai a la compilació
     * de producció —ni fonts, ni capes: la consola deia «the layer 'band-fill'
     * does not exist in the map's style»— mentre que en desenvolupament sí. La
     * diferència és de temps i no de codi: l'estil és un objecte en memòria,
     * no una URL, i amb el paquet ja analitzat MapLibre acaba de carregar-lo
     * DINS del constructor de dalt. Quan s'arriba en aquesta línia, l'esdeveniment
     * ja ha passat i no tornarà. En desenvolupament, la càrrega dels mòduls per
     * separat endarreria prou l'estil perquè l'escoltador hi fos a temps, i per
     * això el defecte només es veia al lloc publicat.
     *
     * Per això s'hi va per les dues bandes: l'escoltador per si encara ha
     * d'arribar, i la crida directa per si ja ha passat. `applyPath` és
     * idempotent a posta —comprova si la font hi és abans de crear res— i es
     * pot cridar dues vegades sense fer cap mal.
     */
    const apply = (): void => {
      applyPath(map, geojsonRef.current);
      syncLayers(map);
      // El primer enquadrament ha d'arribar sense esperar cap gest.
      emitViewport();
    };
    map.on('style.load', apply);
    if (map.isStyleLoaded()) apply();

    /*
     * ELS ERRORS DEL MAPA ES DEIXEN VEURE.
     *
     * No hi havia cap `error`: sense xarxa, o amb el proveïdor de tessel·les
     * caigut, el mapa es quedava negre i no ho deia. Un mapa en blanc és
     * indistingible d'un mapa trencat, i l'usuari no té manera de saber si ha
     * d'esperar, reintentar o mirar-s'ho d'una altra manera.
     *
     * Les tessel·les que fallen no compten: n'hi ha centenars i que en falli
     * alguna als marges és normal. El que es diu és quan falla l'estil, que és
     * quan de veritat no hi ha mapa.
     */
    /*
     * I ES REGISTREN SEMPRE A LA CONSOLA, ENCARA QUE NO ES CANTIN A L'USUARI.
     *
     * Aquest `return` silenciós va amagar durant tot el projecte que el worker
     * de MapLibre no arrencava —vegeu `maplibreWorker.ts`—, i amb ell la franja
     * de totalitat sencera. El detall que ho feia indetectable és de MapLibre:
     * TENIR un escoltador d'`error` desactiva el seu registre per consola per
     * defecte, o sigui que aquest `return` no es limitava a no ensenyar l'error,
     * l'esborrava del mapa. Ara la decisió de no molestar l'usuari amb una
     * tessel·la solta no s'endú també la traça que permet trobar el problema.
     */
    map.on('error', (event) => {
      const source = (event as { sourceId?: string }).sourceId;
      console.error('[mapa]', source ?? '(estil)', (event as { error?: Error }).error ?? event);
      if (source !== undefined) return;
      setMapError({ reason: 'tiles' });
    });

    /*
     * L'ENQUADRAMENT, A CADA `moveend` I NO A CADA `move`.
     *
     * Amb `move` seria un esdeveniment per fotograma. `useHeatmap` ja escanya
     * amb 400 ms, però fer-li arribar seixanta claus per segon és fer treballar
     * React per no res. L'oest i l'est es pincen a ±180°: amb el mapa allunyat,
     * `getBounds()` pot tornar còpies del món (oest a −220°) i la graella
     * descartaria l'enquadrament sencer.
     */
    const emitViewport = (): void => {
      if (onViewportRef.current === undefined) return;
      const b = map.getBounds();
      const west = Math.max(-180, b.getWest());
      const east = Math.min(180, b.getEast());
      if (!(east > west)) return;
      onViewportRef.current({
        bbox: { west, south: b.getSouth(), east, north: b.getNorth() },
        zoom: map.getZoom(),
      });
    };
    map.on('moveend', emitViewport);

    map.on('click', (event) => {
      /*
       * SI EL TOC ANAVA A UNA XINXETA, AQUÍ NO S'HI FA RES.
       *
       * MapLibre reparteix el MATEIX esdeveniment als escoltadors de capa i
       * als globals: sense aquesta porta, tocar un punt oficial obriria la
       * seva fitxa I mouria el punt de l'usuari a la coordenada del dit —
       * dues respostes per a un sol gest. No es pot resoldre amb
       * `defaultPrevented`, perquè l'ordre de crida depèn de l'ordre de
       * registre i aquí NO és estable: a producció l'estil carrega dins del
       * constructor i les capes es registren abans; en desenvolupament, al
       * revés (vegeu el comentari de `style.load`).
       */
      const interactive = [...POI_INTERACTIVE_LAYERS, ...VIEWPOINT_INTERACTIVE_LAYERS].filter(
        (id) => map.getLayer(id) !== undefined,
      );
      if (
        interactive.length > 0 &&
        map.queryRenderedFeatures(event.point, { layers: interactive }).length > 0
      ) {
        return;
      }

      const { lat, lng } = event.lngLat;
      // La longitud pot venir de una còpia del món si l'usuari ha arrossegat
      // fora de ±180°; es normalitza abans de calcular res.
      const lon = ((((lng + 180) % 360) + 360) % 360) - 180;
      onPickRef.current?.({ lat, lon, elevation: 0 });
    });

    return () => {
      sizeWatcher?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- Canvi d'eclipsi ---
  useEffect(() => {
    const map = mapRef.current;
    // Si encara no hi ha font, l'estil no ha carregat i ja se n'encarregarà el
    // handler de `style.load`, que llegeix la franja per referència.
    if (map === null || map.getSource(BAND_SOURCE) === undefined) return;
    applyPath(map, geojson);
  }, [geojson]);

  // --- Les capes opcionals, sincronitzades amb les propietats ---
  useEffect(() => {
    const map = mapRef.current;
    // Mateixa porta que el canvi d'eclipsi: si la franja encara no hi és,
    // l'estil no ha carregat i el `style.load` ja cridarà `syncLayers`.
    if (map === null || map.getSource(BAND_SOURCE) === undefined) return;
    syncLayers(map);
  }, [
    hillshade,
    sunAzimuthDeg,
    cone,
    heatCells,
    heatMaxSec,
    pois,
    onPickPoi,
    viewpoints,
    onPickViewpoint,
    cloudCells,
    cloudTexture,
    edgeUncertaintyKm,
    moveArrow,
    syncLayers,
  ]);

  // --- La diana del punt tocat, sincronitzada amb la propietat ---
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    if (picked === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (markerRef.current === null) {
      const element = document.createElement('div');
      element.className = 'map__pin';
      markerRef.current = new Marker({ element })
        .setLngLat([picked.lon, picked.lat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([picked.lon, picked.lat]);
    }
  }, [picked]);

  // --- L'enquadrament demanat des de fora (la cerca de topònims) ---
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || focus === null) return;
    /*
     * `flyTo` i no `easeTo`: el salt pot ser de centenars de quilòmetres i el
     * vol —allunyar, viatjar, tornar a acostar— és l'única animació que deixa
     * veure per on t'has mogut respecte de la franja. I el zoom no baixa mai
     * del que ja tenies: a qui ha apropat el mapa a mà, una cerca no li ha
     * d'arrabassar l'apropament.
     */
    map.flyTo({
      center: [focus.location.lon, focus.location.lat],
      zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
    });

    /*
     * El rètol es construeix amb `textContent`, mai amb HTML: el nom ve d'un
     * servei extern (Photon) i aquí s'escriu tal qual, sense interpretar-lo.
     * El marcador viu i mor amb el focus: en triar un altre resultat es refà,
     * i en desmuntar la neteja el treu — cap resta penjada sobre el llenç.
     */
    const element = document.createElement('div');
    element.className = 'map__focus';
    if (focus.label !== null && focus.label !== '') {
      const tag = document.createElement('span');
      tag.className = 'map__focustag';
      tag.textContent = focus.label;
      element.append(tag);
    }
    const dot = document.createElement('span');
    dot.className = 'map__focusdot';
    element.append(dot);
    const marker = new Marker({ element, anchor: 'bottom' })
      .setLngLat([focus.location.lon, focus.location.lat])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [focus]);

  // --- Les xinxetes numerades del cercador de llocs ---
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || spots === null || spots.length === 0) return;
    /*
     * Es refan senceres a cada canvi de llista: són quatre o cinc nodes i la
     * llista només canvia quan s'acaba una cerca. Comptabilitzar diferències
     * per estalviar tres createElement seria complexitat sense client.
     */
    const markers = spots.map((spot) => {
      const element = document.createElement('div');
      element.className = 'map__spotpin';
      element.textContent = String(spot.index);
      return new Marker({ element, anchor: 'center' })
        .setLngLat([spot.lon, spot.lat])
        .addTo(map);
    });
    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [spots]);

  const annular = eclipse.kind === 'annular';
  const central = s(annular ? 'map.centralAnnular' : 'map.centralTotal', locale);

  return (
    <div className="map">
      {/*
       * L'AVÍS DE FALLADA SURA DINS DEL MARC DEL LLENÇ, no va a sota.
       *
       * A sota era invisible en l'únic lloc on aquest component es munta:
       * `.mapscreen__stage` retalla tot el que desborda el llenç, i amb el
       * WebGL o les tessel·les caiguts l'usuari veia un rectangle negre mut,
       * indistingible d'un mapa penjat. Superposat al llenç, es veu igual aquí
       * que dins d'un document. `role="alert"` perquè la fallada arriba DESPRÉS
       * de pintar i un lector de pantalla no hi tornarà pas a passar.
       */}
      <div className="map__frame">
        <div className="map__canvas" ref={containerRef} />

        {mapError !== null && (
          <p className="warn map__error" role="alert">
            {mapError.reason === 'webgl'
              ? s('map.webglFailed', locale, { error: mapError.detail })
              : s('map.tilesFailed', locale)}
          </p>
        )}
      </div>

      <div className="map__legend">
        <span className="map__legend-item">
          <span className="map__swatch" aria-hidden="true" />
          {s(annular ? 'map.legendBandAnnular' : 'map.legendBandTotal', locale)}
        </span>
        <span className="map__legend-item">
          <span className="map__swatch map__swatch--line" aria-hidden="true" />
          {s('map.legend.center', locale)}
        </span>
      </div>

      <p className="map__credits">
        {s('map.creditsMap', locale)} {'© '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          {s('map.creditsOsm', locale)}
        </a>
        {' · '}
        {ESPENAK_ATTRIBUTION}
      </p>

      <p className="map__hint">
        <Icon name="crosshair" size={18} aria-hidden="true" />
        <span>{s('map.pickPrompt', locale, { central })}</span>
      </p>
    </div>
  );
}
