/**
 * La vora d'incertesa del caire, pintada.
 *
 * LA DECISIÓ: LA RATLLA DURA ÉS UNA MENTIDA, I ES DESMENTEIX DIBUIXANT-LA.
 * Tots els mapes d'eclipsi pinten el límit de la franja com una ratlla d'un
 * píxel. La nostra ratlla no és millor que la seva: `computeUncertainty` diu
 * que la sabem situar amb un error d'uns nou o deu quilòmetres a Espanya
 * (σ = 2″ dividit pel gradient del marge umbral, que allà val ~0,20″/km), i
 * l'ESTAT §5 documenta a més que els nostres dos motors —els elements
 * besselians que dibuixen la franja i el motor de punts que dona el veredicte—
 * discrepen 2,9 km i que la discrepància no es toca a posta. Aquest territori
 * ja el DÈIEM amb lletres («al caire, ves-hi amb marge»); aquesta capa és la
 * que el fa VEURE: una banda que s'esvaeix a banda i banda del límit, amb
 * l'amplada real del dubte. Allà dins, ningú honest no et pot dir sí o no.
 *
 * QUATRE COSES QUE JA HAN COSTAT I QUE EXPLIQUEN EL CODI:
 *
 * 1. LA SEMIAMPLADA NO ES DECIDEIX AQUÍ. Surt d'`edgeBandHalfWidthKm`
 *    (`core/astro/edgeBand.ts`), que és pura i té les seves proves a Node, amb
 *    el terra dels 2,9 km i el sostre dels 40 km escrits allà amb el perquè.
 *    Aquí només es dibuixa el que aquell mòdul diu.
 *
 * 2. LA BANDA ÉS DE POLÍGONS, NO UNA LÍNIA GRUIXUDA I DIFUMINADA. El truc fàcil
 *    seria una capa `line` amb `line-width` per zoom i `line-blur`: MapLibre
 *    mesura l'amplada en píxels de pantalla, i per convertir quilòmetres a
 *    píxels cal fixar una latitud de referència. La franja del 2026 va de 34°
 *    a més de 60°: el cosinus canvia un 40 % d'una punta a l'altra i la banda
 *    mentiria justament on l'usuari no ho pot comprovar. Amb polígons
 *    desplaçats en graus (`geo/polyline`), l'amplada és de terreny a tot arreu.
 *
 * 3. `fill-antialias: false`. Els trams són contigus i comparteixen vora; amb
 *    l'antialiàsing per defecte, MapLibre dibuixa el contorn de cada polígon i
 *    entre tram i tram apareixen ratlles clares — o sigui, cinc límits nous
 *    allà on la capa serveix per dir que no n'hi ha cap de net.
 *
 * 4. NO ÉS AMBRE. Al mapa l'ambre és de la FRANJA i és l'única cosa que hi
 *    crida. La banda va en to corona, com la línia central i el con de visió:
 *    assenyala sense competir. Sobre l'ambre queda com una boira, que és
 *    exactament el que és.
 */

import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, MapLibreMap } from 'maplibre-gl';
import { edgeBandHalfWidthKm, edgeBandSteps } from '../../../core/astro/edgeBand';
import { polylineStripRing, type LonLat } from '../../../core/geo/polyline';
import type { Palette } from '../../../styles/palette';

/** El que cal per pintar la banda. Ho recull qui ja té la franja i el punt. */
export interface EdgeUncertaintyData {
  /**
   * Els trams DIBUIXABLES de la vora de la franja, en ordre GeoJSON
   * ([lon, lat]) i amb la longitud tal com surt de `eclipses/path` — és a dir,
   * desenrotllada i ja partida on el traçat no és dibuixable. És exactament
   * `eclipsePathToGeoJson(...).limits.geometry.coordinates`: si es passés una
   * altra cosa, la banda podria travessar el mapa sencer.
   */
  limitRuns: readonly (readonly LonLat[])[];
  /**
   * `EclipseUncertainty.limitUncertaintyKm` tal com surt del motor, sense
   * retocar: infinit i nul són valors legítims i els tracta `edgeBandHalfWidthKm`.
   */
  limitUncertaintyKm: number | null;
}

const EDGE_SOURCE = 'edge-uncertainty';
export const EDGE_UNCERTAINTY_LAYER = 'edge-uncertainty-fill';

/**
 * La ratlla del límit, tal com la registra `EclipseMap.tsx`. La banda va SOTA
 * seu: la boira acompanya la ratlla, no la tapa. Es declara aquí —com fa el
 * mapa de calor amb `band-fill`— perquè un identificador escrit a mà al
 * cablejat és una avaria silenciosa: el dia que canviï el nom, la banda es
 * dibuixaria a sobre i ningú no sabria per què el límit s'ha esborrat.
 */
export const BAND_EDGE_LAYER = 'band-edge';

/**
 * Opacitat al centre de la banda, damunt del límit dibuixat. És un número de
 * calibratge, com l'exageració del relleu: es tria amb el mapa obert. Prou per
 * llegir-hi una boira, poc per no enterrar-hi la cartografia ni discutir-li el
 * cop d'ull a l'ambre de la franja.
 */
export const EDGE_PEAK_OPACITY = 0.26;

const emptyFeatureCollection = {
  type: 'FeatureCollection' as const,
  features: [],
};

function bandGeoJson(data: EdgeUncertaintyData): FeatureCollection {
  const halfWidthKm = edgeBandHalfWidthKm(data.limitUncertaintyKm);
  const steps = edgeBandSteps(halfWidthKm, EDGE_PEAK_OPACITY);

  const features: FeatureCollection['features'] = [];
  for (const run of data.limitRuns) {
    if (run.length < 2) continue;
    for (const step of steps) {
      const ring = polylineStripRing(run, step.fromKm, step.toKm);
      if (ring.length < 4) continue;
      features.push({
        type: 'Feature',
        properties: { opacity: step.opacity },
        geometry: { type: 'Polygon', coordinates: [ring] },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Pinta (o actualitza) la banda de dubte. Idempotent com totes les capes
 * d'aquest mapa: es crida a cada render i només crea les coses el primer cop.
 *
 * Amb `data` nul es buiden les dades en comptes de desmuntar la capa, com fa el
 * con de visió: la banda apareix i desapareix seguint la vista sense refer
 * l'estil. `beforeId` és la capa sota la qual s'insereix — ha d'anar SOTA la
 * línia del límit (`band-edge`), perquè la boira acompanyi la ratlla i no la
 * tapi.
 */
export function applyEdgeUncertainty(
  map: MapLibreMap,
  palette: Palette,
  data: EdgeUncertaintyData | null,
  beforeId?: string,
): void {
  if (map.getSource(EDGE_SOURCE) === undefined) {
    map.addSource(EDGE_SOURCE, { type: 'geojson', data: emptyFeatureCollection });

    map.addLayer(
      {
        id: EDGE_UNCERTAINTY_LAYER,
        type: 'fill',
        source: EDGE_SOURCE,
        paint: {
          // El to el posa la paleta i l'opacitat la porta cada tram a sobre:
          // és el degradat, i ve del perfil pur d'`edgeBand`.
          'fill-color': palette.corona100,
          'fill-opacity': ['get', 'opacity'],
          'fill-antialias': false,
        },
      },
      beforeId,
    );
  }

  (map.getSource(EDGE_SOURCE) as GeoJSONSource).setData(
    data === null ? emptyFeatureCollection : bandGeoJson(data),
  );
}

/** Treu capa i font. Segur encara que no hi siguin. */
export function removeEdgeUncertainty(map: MapLibreMap): void {
  if (map.getLayer(EDGE_UNCERTAINTY_LAYER) !== undefined) {
    map.removeLayer(EDGE_UNCERTAINTY_LAYER);
  }
  if (map.getSource(EDGE_SOURCE) !== undefined) map.removeSource(EDGE_SOURCE);
}
