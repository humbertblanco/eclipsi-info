/**
 * El relleu ombrejat del mapa, amb les tessel·les d'elevació de l'horitzó.
 *
 * LA DADA JA LA TENÍEM. El model del terreny (terrarium, AWS Open Data) és el
 * que fa possible el veredicte de l'app — quants segons sobreviuen al relleu —
 * i fins ara només es feia servir per calcular, mai per pintar. Aquesta capa
 * l'ensenya: MapLibre descodifica el terrarium a la GPU (`encoding:
 * 'terrarium'`) i n'ombra els vessants, sense cap càlcul nostre.
 *
 * DUES DECISIONS:
 *
 * 1. LA URL SURT DE `offline/config` (`TERRAIN_TILE_TEMPLATE`), com la de la
 *    cartografia base. Són les MATEIXES tessel·les que baixa el perfil
 *    d'horitzó i que desa la precàrrega a `eclipsi-relleu-v1`: un caràcter de
 *    diferència i el relleu del mapa aniria per xarxa al camp amb la memòria
 *    cau plena. Ho vigila `terrain-agreement.test.ts`.
 *
 * 2. LA LLUM VE D'ON SERÀ EL SOL. `hillshade-illumination-direction` rep
 *    l'azimut del Sol al màxim de l'eclipsi del punt de l'usuari: els vessants
 *    que el mapa ensenya foscos són els que estaran d'esquena al Sol aquella
 *    tarda — la mateixa geometria que decideix si una vall veu la totalitat o
 *    no. Amb el Sol a 7° d'altura, l'ombrejat del mapa i la realitat del
 *    terreny expliquen la mateixa història. Sense punt (o sense contactes), es
 *    cau al 315° convencional de la cartografia.
 */

import type { MapLibreMap } from 'maplibre-gl';
import { HILLSHADE_MAX_ZOOM, TERRAIN_TILE_TEMPLATE } from '../../../offline/config';
import { withAlpha, type Palette } from '../../../styles/palette';

const HILLSHADE_SOURCE = 'terrain-dem';
export const HILLSHADE_LAYER = 'hillshade';

/** La llum convencional de la cartografia (nord-oest), per quan no hi ha Sol. */
export const DEFAULT_ILLUMINATION_DEG = 315;

/**
 * Afegeix (o actualitza) el relleu ombrejat. Idempotent, com `applyPath`: es
 * pot cridar a cada render i només crea les coses el primer cop.
 *
 * `beforeId` és la capa de sota de la qual s'ha d'inserir (la franja, si ja
 * hi és): el relleu és context, mai pot tapar la resposta.
 */
export function ensureHillshade(
  map: MapLibreMap,
  palette: Palette,
  illuminationDeg: number | null,
  beforeId?: string,
): void {
  if (map.getSource(HILLSHADE_SOURCE) === undefined) {
    map.addSource(HILLSHADE_SOURCE, {
      type: 'raster-dem',
      tiles: [TERRAIN_TILE_TEMPLATE],
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: HILLSHADE_MAX_ZOOM,
    });
  }

  if (map.getLayer(HILLSHADE_LAYER) === undefined) {
    map.addLayer(
      {
        id: HILLSHADE_LAYER,
        type: 'hillshade',
        source: HILLSHADE_SOURCE,
        paint: {
          /*
           * LA LLUM ANCORADA AL MAPA, NO A LA PANTALLA.
           *
           * El valor per defecte de MapLibre és `viewport`: la direcció de la
           * llum es mesura respecte de la vora de la pantalla i gira amb la
           * càmera. Amb això, l'azimut del Sol que li passem no voldria dir
           * res geogràfic — el ponent del mapa i el ponent de debò només
           * coincidirien per casualitat, i tota la idea d'aquesta capa
           * (ensenyar les ombres del moment de l'eclipsi) seria decoració.
           * Amb `map`, els graus són graus des del nord.
           */
          'hillshade-illumination-anchor': 'map',
          /*
           * L'OMBRA NO POT FER LA FEINA SOBRE UN MAPA JA NEGRE. La
           * cartografia de sota és fosca de mena: enfosquir un vessant no
           * s'hi veu. El que dibuixa el relleu aquí és la LLUM — corona a
           * un terç d'opacitat sobre els vessants encarats al Sol — i
           * l'ombra només aprofundeix les valls. Amb el 0,35 d'exageració i
           * la llum al 10 % que hi havia al primer intent, el Pirineu no es
           * distingia de la plana a la pantalla del portàtil.
           *
           * No és ambre en cap dels tres tons: l'ambre és de la franja, i un
           * relleu càlid competiria amb l'única cosa que ha de cridar.
           */
          'hillshade-exaggeration': 0.6,
          'hillshade-highlight-color': withAlpha(palette.corona100, 0.32),
          'hillshade-shadow-color': withAlpha(palette.bgInset, 0.85),
          'hillshade-accent-color': withAlpha(palette.statusInfo, 0.12),
        },
      },
      beforeId,
    );
  }

  map.setPaintProperty(
    HILLSHADE_LAYER,
    'hillshade-illumination-direction',
    // MapLibre demana [0, 359].
    ((Math.round(illuminationDeg ?? DEFAULT_ILLUMINATION_DEG) % 360) + 360) % 360,
  );
}

/** Treu la capa i la font. Segur de cridar encara que no hi siguin. */
export function removeHillshade(map: MapLibreMap): void {
  if (map.getLayer(HILLSHADE_LAYER) !== undefined) map.removeLayer(HILLSHADE_LAYER);
  if (map.getSource(HILLSHADE_SOURCE) !== undefined) map.removeSource(HILLSHADE_SOURCE);
}
