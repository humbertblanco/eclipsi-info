/**
 * Barril públic de compartir.
 *
 * QUÈ HI HA AQUÍ DINS: la traducció entre el punt de l'observador i l'URL, en
 * les dues direccions. `parseShareLink` llegeix el que arriba per l'adreça i
 * `buildShareLink` escriu el que hi ha d'anar.
 *
 * NO HI HA CAP COMPONENT NI CAP HOOK, i és a posta. Compartir no és una pantalla:
 * és una propietat de l'URL. Qui llegeix el `location.search` és
 * `state/useObserver.ts` (en arrencar) i qui l'escriu és `App.tsx` (amb
 * `history.replaceState`, mai `pushState`: el punt no és una pàgina i no ha
 * d'omplir el botó d'enrere de l'historial del navegador). Tot el que hi ha en
 * aquest mòdul és pur i es pot provar sense DOM.
 */

export { buildShareLink, parseShareLink, MAX_LABEL_CHARS, SHARE_DECIMALS } from './link';
export type { SharedPoint, ShareLinkParams } from './link';

export {
  READABLE_PLACES,
  buildReadableShareUrl,
  findReadablePlace,
  readablePlacePath,
  readableSlug,
  resolveReadablePlacePath,
} from './readable';
export type { ReadablePlace, ReadablePlaceKind } from './readable';

/* --- la miniatura i la targeta ------------------------------------------- */

export {
  THUMB_HEIGHT,
  THUMB_WIDTH,
  buildThumbnailModel,
  drawThumbnail,
  loadThumbnailModel,
  resolveThumbnailTerrain,
  thumbnailCacheKey,
  thumbnailCacheKeyFor,
} from './thumbnail';
export type { TerrainConfidence, ThumbnailModel } from './thumbnail';

export {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardFileName,
  cardText,
  drawShareCard,
  renderShareCardBlob,
  renderShareCardFile,
  shareCardModelFrom,
} from './card';
export type { CardText, CardTextInput, ShareCardModel } from './card';

export { isAbortError, downloadBlob, shareFileOrDownload } from './shareFile';

export { sh } from './strings';
export type { ShareStringKey } from './strings';

/*
 * L'ÚNIC COMPONENT D'AQUEST MÒDUL.
 *
 * El capçal de sobre deia que aquí no n'hi havia cap perquè compartir era només
 * una propietat de l'URL. Ho segueix essent —qui llegeix l'adreça és
 * `useObserver` i qui l'escriu és `App`—, però el gest de compartir necessita
 * un lloc on viure: sense botó, l'única manera d'enviar el teu punt era copiar
 * la barra d'adreces d'un navegador de mòbil, que la mig amaga.
 */
export { ShareButton } from './ShareButton';
export type { ShareButtonProps, ShareSurface } from './ShareButton';
