/**
 * La fletxa «cap on caminar».
 *
 * LA DECISIÓ: EL GRADIENT JA EL SABÍEM I NOMÉS EL DÈIEM AMB LLETRES.
 * `computeDurationGradient` mesura, amb quatre avaluacions de circumstàncies a
 * un quilòmetre, cap a on creix la durada de la fase central, quants segons per
 * quilòmetre en guanyes i quants quilòmetres hi ha fins al màxim. La vista
 * «Durada» de `MapScreen` ho ensenya escrit («+3,0 s/km cap al sud-oest, uns
 * 8 km»), i llegir un rumb en graus i traduir-lo a un lloc del mapa és
 * exactament la feina que un mapa hauria de fer per tu. Això és el dibuix: una
 * fletxa des del teu punt, amb aquell rumb, amb la llargada dels quilòmetres
 * que hi ha fins al millor punt, i el número al costat.
 *
 * LA REGLA QUE MANA SOBRE TOTES: QUAN NO VAL LA PENA MOURE'S, NO ES DIBUIXA
 * RES. Al mig de la franja el gradient és de centèsimes de segon per
 * quilòmetre i el seu rumb és soroll numèric; una fletxa allà seria una ordre
 * inventada, i la gent camina. `moveArrowFrom` és l'únic camí per construir les
 * dades de la capa i retorna null amb `worthMoving` fals o sense rumb — la
 * porta viu aquí i no al cridador perquè no se la pugui saltar per descuit.
 *
 * DUES COSES MÉS QUE EXPLIQUEN EL CODI:
 *
 * 1. LA LLARGADA ÉS DE TERRENY, NO DE PANTALLA. La fletxa és un objecte
 *    geogràfic: si diu vuit quilòmetres, en mesura vuit al mapa i creix en
 *    apropar-s'hi. Amb la franja sencera a la pantalla queda curta —vuit
 *    quilòmetres són tres píxels—, i per això el RÈTOL és de pantalla i es
 *    llegeix sempre: qui mira de lluny llegeix el número, qui s'hi acosta veu
 *    el lloc. El topall existeix perquè l'extrapolació al punt òptim és lineal
 *    sobre una funció que no ho és (ho diu `gradient.ts`): passats uns quants
 *    quilòmetres, la punta ja no és una mesura i no pot fer veure que ho és.
 *
 * 2. LA PUNTA ÉS UN SECTOR ESTRET de `geo/sector`, amb el vèrtex a l'extrem i
 *    l'arc cap enrere. La mateixa geometria provada a Node que fa el con de
 *    visió; aquí no hi ha trigonometria escrita a mà.
 *
 * EL TO ÉS CORONA, NO AMBRE. Al mapa l'ambre és de la franja i prou. La fletxa
 * és un consell, no un veredicte.
 */

import type { FeatureCollection } from 'geojson';
import { Marker, type GeoJSONSource, type MapLibreMap } from 'maplibre-gl';
import type { DurationGradient } from '../../../core/astro/gradient';
import { destinationPoint, sectorRing } from '../../../core/geo/sector';
import type { Palette } from '../../../styles/palette';
import './moveArrow.css';

/** El que cal per dibuixar la fletxa. Només el pot construir `moveArrowFrom`. */
export interface MoveArrowData {
  lat: number;
  lon: number;
  /** Rumb cap on cal moure's, en graus (0 = nord). */
  bearingDeg: number;
  /** Guany, en segons per quilòmetre. */
  secondsPerKm: number;
  /** Quilòmetres fins al punt òptim estimat. Null si no s'ha pogut extrapolar. */
  approxKmToBest: number | null;
  /**
   * El rètol, ja traduït i formatat per qui el mostra: aquesta capa no sap
   * d'idiomes ni de comes decimals. Buit vol dir sense rètol.
   */
  label: string;
}

const ARROW_SOURCE = 'move-arrow';
export const MOVE_ARROW_SHAFT_LAYER = 'move-arrow-shaft';
export const MOVE_ARROW_HEAD_LAYER = 'move-arrow-head';

/**
 * Marges de la llargada, en km.
 *
 * El mínim és perquè una fletxa d'un quilòmetre no és una fletxa sinó un punt;
 * el màxim, perquè l'extrapolació al punt òptim deixa de voler dir res molt
 * abans (`gradient.ts` ja descarta les de més de 400 km, però una de 200 km
 * dibuixada des del teu punt seria una promesa que ningú pot mantenir). Sense
 * extrapolació es dibuixa la de cortesia: la fletxa segueix dient el rumb i el
 * ritme, que és el que sí que sabem.
 */
export const MIN_ARROW_KM = 3;
export const MAX_ARROW_KM = 40;
const DEFAULT_ARROW_KM = 10;

/** Semiangle de la punta, en graus. */
const HEAD_HALF_ANGLE_DEG = 20;

/** Llargada de la punta com a fracció de la fletxa, i els seus marges en km. */
const HEAD_FRACTION = 0.22;
const MIN_HEAD_KM = 0.6;
const MAX_HEAD_KM = 6;

/** Llargada dibuixada de la fletxa, en km. Vegeu els marges de sobre. */
export function moveArrowLengthKm(approxKmToBest: number | null): number {
  if (approxKmToBest === null || !Number.isFinite(approxKmToBest) || approxKmToBest <= 0) {
    return DEFAULT_ARROW_KM;
  }
  return Math.max(MIN_ARROW_KM, Math.min(MAX_ARROW_KM, approxKmToBest));
}

/**
 * Les dades de la fletxa a partir del gradient, o NULL quan no s'ha de dibuixar
 * res: sense gradient, amb `worthMoving` fals, sense rumb o amb un rumb que no
 * és un número. Vegeu la regla de la capçalera.
 */
export function moveArrowFrom(
  location: { lat: number; lon: number } | null,
  gradient: DurationGradient | null,
  label: string,
): MoveArrowData | null {
  if (location === null || gradient === null) return null;
  if (!gradient.worthMoving) return null;
  if (gradient.bearingDeg === null || !Number.isFinite(gradient.bearingDeg)) return null;
  if (!Number.isFinite(gradient.secondsPerKm) || gradient.secondsPerKm <= 0) return null;

  return {
    lat: location.lat,
    lon: location.lon,
    bearingDeg: gradient.bearingDeg,
    secondsPerKm: gradient.secondsPerKm,
    approxKmToBest: gradient.approxKmToBest,
    label,
  };
}

const emptyFeatureCollection = {
  type: 'FeatureCollection' as const,
  features: [],
};

/** On va el rètol: just passada la punta, en el mateix rumb. */
export function moveArrowLabelPoint(arrow: MoveArrowData): { lat: number; lon: number } {
  const lengthKm = moveArrowLengthKm(arrow.approxKmToBest);
  const headKm = Math.max(MIN_HEAD_KM, Math.min(MAX_HEAD_KM, lengthKm * HEAD_FRACTION));
  return destinationPoint(arrow.lat, arrow.lon, arrow.bearingDeg, lengthKm + headKm);
}

function arrowGeoJson(arrow: MoveArrowData): FeatureCollection {
  const lengthKm = moveArrowLengthKm(arrow.approxKmToBest);
  const headKm = Math.max(MIN_HEAD_KM, Math.min(MAX_HEAD_KM, lengthKm * HEAD_FRACTION));
  const tip = destinationPoint(arrow.lat, arrow.lon, arrow.bearingDeg, lengthKm);

  // La punta: sector amb el vèrtex a l'extrem i l'arc cap enrere. Vuit passos
  // basten per a un arc de 40°; amb els 24 per defecte només s'hi guanyarien
  // vèrtexs.
  const back = (arrow.bearingDeg + 180) % 360;
  const head = sectorRing(
    tip.lat,
    tip.lon,
    back - HEAD_HALF_ANGLE_DEG,
    back + HEAD_HALF_ANGLE_DEG,
    headKm,
    8,
  );

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { part: 'shaft' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [arrow.lon, arrow.lat],
            [tip.lon, tip.lat],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { part: 'head' },
        geometry: { type: 'Polygon', coordinates: [head] },
      },
    ],
  };
}

/**
 * El rètol viu en un `Marker` del DOM i no en una capa de símbols perquè
 * l'estil d'aquest mapa NO té `glyphs`: MapLibre no sap dibuixar text sense un
 * servidor de tipografies, i posar-n'hi un voldria dir demanar lletres per
 * xarxa a una app que ha de funcionar sense cobertura. Amb un element del DOM,
 * a més, el rètol fa servir els tokens del sistema de disseny directament.
 *
 * Un mapa, un rètol: el registre és feble perquè si el mapa mor, el rètol se
 * n'hi vagi amb ell.
 */
const labels = new WeakMap<MapLibreMap, Marker>();

function applyLabel(map: MapLibreMap, arrow: MoveArrowData | null): void {
  // Sense document no hi ha rètol. Passa a les proves de Node, on la geometria
  // sí que es comprova; és l'única part d'aquesta capa que demana un navegador.
  if (typeof document === 'undefined') return;

  const existing = labels.get(map);
  if (arrow === null || arrow.label === '') {
    if (existing !== undefined) {
      existing.remove();
      labels.delete(map);
    }
    return;
  }

  const at = moveArrowLabelPoint(arrow);
  if (existing !== undefined) {
    existing.getElement().textContent = arrow.label;
    existing.setLngLat([at.lon, at.lat]);
    return;
  }

  const element = document.createElement('div');
  element.className = 'map__movetag';
  element.textContent = arrow.label;
  labels.set(map, new Marker({ element, anchor: 'center' }).setLngLat([at.lon, at.lat]).addTo(map));
}

/**
 * Pinta (o actualitza) la fletxa. Idempotent com totes les capes d'aquest mapa.
 * Amb `arrow` nul es buiden les dades i es treu el rètol, sense desmuntar
 * l'estil: la fletxa apareix i desapareix amb la vista i amb el punt.
 */
export function applyMoveArrow(
  map: MapLibreMap,
  palette: Palette,
  arrow: MoveArrowData | null,
): void {
  if (map.getSource(ARROW_SOURCE) === undefined) {
    map.addSource(ARROW_SOURCE, { type: 'geojson', data: emptyFeatureCollection });

    map.addLayer({
      id: MOVE_ARROW_SHAFT_LAYER,
      type: 'line',
      source: ARROW_SOURCE,
      filter: ['==', ['get', 'part'], 'shaft'],
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': palette.corona100,
        'line-width': 2.5,
        'line-opacity': 0.9,
      },
    });
    map.addLayer({
      id: MOVE_ARROW_HEAD_LAYER,
      type: 'fill',
      source: ARROW_SOURCE,
      filter: ['==', ['get', 'part'], 'head'],
      paint: { 'fill-color': palette.corona100, 'fill-opacity': 0.9 },
    });
  }

  (map.getSource(ARROW_SOURCE) as GeoJSONSource).setData(
    arrow === null ? emptyFeatureCollection : arrowGeoJson(arrow),
  );
  applyLabel(map, arrow);
}

/** Treu capes, font i rètol. Segur encara que no hi siguin. */
export function removeMoveArrow(map: MapLibreMap): void {
  applyLabel(map, null);
  for (const layer of [MOVE_ARROW_SHAFT_LAYER, MOVE_ARROW_HEAD_LAYER]) {
    if (map.getLayer(layer) !== undefined) map.removeLayer(layer);
  }
  if (map.getSource(ARROW_SOURCE) !== undefined) map.removeSource(ARROW_SOURCE);
}
