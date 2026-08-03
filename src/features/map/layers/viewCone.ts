/**
 * El con de visió: el tros de territori que tindràs davant durant l'eclipsi.
 *
 * Des del punt triat, el sector d'azimuts que recorre el Sol entre el primer
 * contacte i l'últim, amb el rumb del màxim dibuixat com a radi. Respon una
 * pregunta que el mapa sol no respon: «des d'aquí, cap on miraré?» — i, de
 * passada, «què tinc entremig?», perquè el radi arriba fins a l'obstacle que
 * fa d'horitzó en aquell rumb, no fins a un cercle arbitrari.
 *
 * La geometria és de `core/geo/sector` (pura, provada a Node); aquí només es
 * converteix en GeoJSON i capes. To corona, com la línia central: assenyala
 * sense cridar. L'ambre és de la franja i aquest sector no és cap veredicte.
 */

import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, MapLibreMap } from 'maplibre-gl';
import { destinationPoint, sectorRing } from '../../../core/geo/sector';
import type { Palette } from '../../../styles/palette';

/** El que cal saber per dibuixar el con. Ho recull `MapScreen`, que ja ho té. */
export interface ViewConeData {
  lat: number;
  lon: number;
  /** Azimut del Sol al primer contacte, en graus. */
  c1AzimuthDeg: number;
  /** Azimut del Sol al màxim: el radi destacat. */
  maxAzimuthDeg: number;
  /** Azimut del Sol a l'últim contacte. */
  c4AzimuthDeg: number;
  /**
   * Fins on arriba el radi del màxim, en km: la distància de l'obstacle que
   * fa d'horitzó en aquell rumb, si es té el perfil.
   */
  radiusKm: number;
}

const CONE_SOURCE = 'view-cone';
const CONE_FILL_LAYER = 'view-cone-fill';
const CONE_MAX_LAYER = 'view-cone-max';

/**
 * Marges del radi: per sota de 2 km el sector no es veuria (i un perfil buit
 * dona distància zero); per sobre de 80 el dibuix diu més que no pas sap —
 * l'horitzó marí des d'un cim pot quedar a 100 km i el con deixaria de cabre
 * a la vista que l'ha demanat.
 */
export function clampConeRadiusKm(radiusKm: number): number {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return 25;
  return Math.max(2, Math.min(80, radiusKm));
}

function coneGeoJson(cone: ViewConeData): FeatureCollection {
  const radius = clampConeRadiusKm(cone.radiusKm);
  const tip = destinationPoint(cone.lat, cone.lon, cone.maxAzimuthDeg, radius);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { part: 'sector' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            sectorRing(cone.lat, cone.lon, cone.c1AzimuthDeg, cone.c4AzimuthDeg, radius),
          ],
        },
      },
      {
        type: 'Feature',
        properties: { part: 'max' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [cone.lon, cone.lat],
            [tip.lon, tip.lat],
          ],
        },
      },
    ],
  };
}

const emptyFeatureCollection = {
  type: 'FeatureCollection' as const,
  features: [],
};

/**
 * Pinta (o actualitza) el con. Idempotent, com totes les capes d'aquest mapa.
 * Amb `cone` nul, buida les dades en comptes de desmuntar les capes: el con
 * apareix i desapareix seguint el punt sense refer l'estil cada vegada.
 */
export function applyViewCone(
  map: MapLibreMap,
  palette: Palette,
  cone: ViewConeData | null,
): void {
  if (map.getSource(CONE_SOURCE) === undefined) {
    map.addSource(CONE_SOURCE, { type: 'geojson', data: emptyFeatureCollection });

    map.addLayer({
      id: CONE_FILL_LAYER,
      type: 'fill',
      source: CONE_SOURCE,
      filter: ['==', ['get', 'part'], 'sector'],
      paint: { 'fill-color': palette.corona100, 'fill-opacity': 0.12 },
    });
    map.addLayer({
      id: CONE_MAX_LAYER,
      type: 'line',
      source: CONE_SOURCE,
      filter: ['==', ['get', 'part'], 'max'],
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': palette.corona100,
        'line-width': 1.5,
        'line-opacity': 0.55,
        'line-dasharray': [1.5, 2.5],
      },
    });
  }

  (map.getSource(CONE_SOURCE) as GeoJSONSource).setData(
    cone === null ? emptyFeatureCollection : coneGeoJson(cone),
  );
}

/** Treu capes i font. Segur encara que no hi siguin. */
export function removeViewCone(map: MapLibreMap): void {
  for (const layer of [CONE_FILL_LAYER, CONE_MAX_LAYER]) {
    if (map.getLayer(layer) !== undefined) map.removeLayer(layer);
  }
  if (map.getSource(CONE_SOURCE) !== undefined) map.removeSource(CONE_SOURCE);
}
