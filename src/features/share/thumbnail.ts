/**
 * La miniatura d'un punt: la silueta del seu horitzó amb el camí del Sol a
 * sobre.
 *
 * EL PROBLEMA QUE RESOL. A l'historial de llocs, una fila que diu «42,1200° N,
 * 1,5700° E» no es distingeix de la del costat. Ni el nom hi ajuda gaire: qui
 * compara un port de muntanya amb el poble de la vall té dues línies de text
 * que es diferencien en una paraula. La imatge que SÍ que les distingeix —i que
 * cap altra aplicació pot dibuixar, perquè cap altra té el perfil d'horitzó del
 * punt— és la carena que tens al davant amb el recorregut del Sol per sobre. És
 * literalment la resposta a la pregunta del projecte, en 56 × 36 píxels.
 *
 * D'ON SURT EL TERRENY. De la memòria cau de perfils que ja existeix
 * (`core/horizon/cache.ts`, IndexedDB), amb la MATEIXA clau que fa servir
 * `useHorizon`. La miniatura no calcula perfils ni baixa cap tessel·la: si el
 * punt no s'ha obert mai, no hi ha res desat i es dibuixa amb l'horitzó pla de
 * reserva, en traç discontinu i apagat (vegeu `resolveThumbnailTerrain`).
 *
 * EL QUE AQUEST FITXER NO FA I NO HA DE FER MAI: desar imatges. L'historial viu
 * a `localStorage` (`state/recentPlaces.ts`) i una sola data-URL de 56 × 36 en
 * PNG ja passa dels 2 kB en base64; vuit entrades se'n mengen una desena part
 * de la quota i, quan salta, el que es perd no és la miniatura sinó
 * l'historial sencer. La miniatura es dibuixa a la vista cada vegada, que costa
 * uns pocs mil·lisegons, i no es guarda enlloc.
 */

import { computeLocalCircumstances } from '../../core/astro/contacts';
import type {
  EclipseSample,
  GeoLocation,
  LocalCircumstances,
} from '../../core/astro/types';
import { horizonCacheKey, readCachedProfile } from '../../core/horizon/cache';
import {
  flatHorizonProfile,
  horizonSampler,
  type HorizonProfile,
} from '../../core/horizon/profile';
import {
  clipRings,
  DEFAULT_AZIMUTH_STEP_DEG,
  DEFAULT_RINGS,
  ringSignature,
  TERRESTRIAL_REFRACTION_K,
} from '../../core/horizon/raycast';
import { MINI_TRAJECTORY_SAMPLES, trajectorySamples } from '../sim/samples';
import { renderTrajectory } from '../sim/renderTrajectory';

/**
 * Mida de la miniatura de l'historial, en píxels de CSS.
 *
 * D'ON SURT. La fila de l'historial ha de fer com a mínim els 44 px de
 * `--tap-min` que documenta `recentPlaces.ts`, i en fa 44 justos amb els seus
 * `--sp-3` (8 px) de coixí a dalt i a baix: queden 28 px d'alçada lliure. Amb
 * 36 px la miniatura faria créixer la fila i el compte de vuit entrades per
 * fulla deixaria de sortir. 28 × 44 manté la fila exactament igual d'alta i
 * encara ensenya la carena, perquè el que la fa reconeixible és la SILUETA i no
 * el detall.
 */
export const THUMB_WIDTH = 44;
export const THUMB_HEIGHT = 28;

/** Què sabem del terreny que s'ha acabat dibuixant. */
export type TerrainConfidence = 'measured' | 'assumed';

export interface ThumbnailModel {
  circumstances: LocalCircumstances;
  samples: EclipseSample[];
  profile: HorizonProfile;
  /**
   * `assumed` vol dir que no hi havia cap perfil desat i que la silueta és
   * l'horitzó pla de reserva. Qui pinti això ho ha de dir amb totes les
   * lletres: la interfície no pot deixar creure que aquell punt s'ha mesurat.
   */
  terrain: TerrainConfidence;
}

/**
 * La clau amb què `useHorizon` desa el perfil d'aquest punt.
 *
 * HA DE SER LA MATEIXA CLAU, i per això surt de les mateixes constants i no
 * d'un text escrit a mà. Si divergissin, la miniatura no trobaria mai el perfil
 * que la pantalla de simulació acaba de calcular per al mateix lloc i dibuixaria
 * sempre l'horitzó pla: un defecte que no peta enlloc i que només es nota
 * mirant amb atenció una imatge de 44 px.
 *
 * `heightAboveGroundM` és zero perquè és el que fa servir la vista: la
 * miniatura no és el lloc on inventar un observador enfilat.
 */
export function thumbnailCacheKey(lat: number, lon: number): string {
  const signature = ringSignature(
    DEFAULT_RINGS,
    DEFAULT_AZIMUTH_STEP_DEG,
    TERRESTRIAL_REFRACTION_K,
    0,
  );
  return horizonCacheKey(lat, lon, signature);
}

/**
 * Variant per a qui hagi retallat el radi del relleu (la pantalla de preparació
 * per anar sense cobertura ho fa). Sense arguments dona el mateix que
 * `thumbnailCacheKey`.
 */
export function thumbnailCacheKeyFor(
  lat: number,
  lon: number,
  options: { maxRangeKm?: number; azimuthStepDeg?: number; heightAboveGroundM?: number } = {},
): string {
  const {
    maxRangeKm,
    azimuthStepDeg = DEFAULT_AZIMUTH_STEP_DEG,
    heightAboveGroundM = 0,
  } = options;
  const rings = maxRangeKm === undefined ? DEFAULT_RINGS : clipRings(maxRangeKm);
  return horizonCacheKey(
    lat,
    lon,
    ringSignature(rings, azimuthStepDeg, TERRESTRIAL_REFRACTION_K, heightAboveGroundM),
  );
}

/**
 * El perfil que s'acabarà dibuixant, i amb quina confiança.
 *
 * Funció pura: se li dona el que hi havia a la memòria cau (o `null`) i decideix.
 * És el punt on es pren la decisió que dona sentit a tota la peça, i per això
 * està separat de tot el que és asíncron i de tot el que és canvas: així es pot
 * provar en entorn Node.
 *
 * L'HORITZÓ PLA ES DIBUIXA, PERÒ NO ES DISFRESSA. `flatHorizonProfile` és
 * optimista per construcció —un horitzó a 0° no amaga mai el Sol— i pintat en
 * traç sòlid es llegeix com «des d'aquí no et tapa res», que és exactament la
 * mentida que aquesta aplicació existeix per no dir (ESTAT.md §3.5: un horitzó
 * a mitges no es publica). Torna `terrain: 'assumed'` perquè qui dibuixi ho
 * pinti discontinu i qui escrigui ho digui.
 */
export function resolveThumbnailTerrain(
  place: GeoLocation,
  cached: HorizonProfile | null,
): { profile: HorizonProfile; terrain: TerrainConfidence } {
  if (cached) return { profile: cached, terrain: 'measured' };
  return {
    profile: flatHorizonProfile(place.lat, place.lon, place.elevation),
    terrain: 'assumed',
  };
}

/**
 * Tot el que fa falta per dibuixar la miniatura d'un punt, amb el perfil ja
 * resolt. Separat del dibuix perquè és la part cara (efemèrides) i la que es
 * pot memoritzar, i perquè no toca el canvas.
 */
export function buildThumbnailModel(
  eclipseId: string,
  place: GeoLocation,
  cached: HorizonProfile | null,
  count: number = MINI_TRAJECTORY_SAMPLES,
): ThumbnailModel {
  const circumstances = computeLocalCircumstances(eclipseId, place);
  const { profile, terrain } = resolveThumbnailTerrain(place, cached);
  return {
    circumstances,
    samples: trajectorySamples(circumstances, place, count),
    profile,
    terrain,
  };
}

/**
 * El model d'un punt, anant a buscar el perfil a la memòria cau.
 *
 * És asíncron perquè la memòria cau és IndexedDB. No llança mai: `readCachedProfile`
 * ja tracta el mode privat, els iframes amb l'emmagatzematge bloquejat i Node,
 * i torna `null`, que aquí vol dir «encara no s'ha calculat».
 */
export async function loadThumbnailModel(
  eclipseId: string,
  place: GeoLocation,
  count: number = MINI_TRAJECTORY_SAMPLES,
): Promise<ThumbnailModel> {
  const cached = await readCachedProfile(thumbnailCacheKey(place.lat, place.lon));
  return buildThumbnailModel(eclipseId, place, cached, count);
}

/**
 * Dibuixa la miniatura.
 *
 * NO HI HA CAP RENDERITZADOR NOU: és `renderTrajectory` en mode `mini`, que
 * treu la graella, les etiquetes i el marcador de l'instant i deixa el terreny
 * i el camí del Sol, que és la imatge. Fer-ne un de propi hauria estat garantir
 * que un dia la miniatura i el gràfic gran ensenyessin corbes diferents del
 * mateix lloc.
 */
export function drawThumbnail(
  ctx: CanvasRenderingContext2D,
  model: ThumbnailModel,
  width: number,
  height: number,
  locale: 'ca' | 'es' = 'ca',
): void {
  renderTrajectory(ctx, model.circumstances, model.samples, width, height, {
    locale,
    chrome: 'mini',
    terrain: model.terrain,
    horizonProfile: horizonSampler(model.profile),
  });
}
