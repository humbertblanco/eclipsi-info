/**
 * Captura de la vista de la càmera amb la superposició a sobre.
 *
 * TRES CAPES, I UNA TRAMPA. La imatge que l'usuari veu és: (1) el fotograma
 * de vídeo retallat per `object-fit: cover`, (2) ENFOSQUIT PEL FILTRE CSS de
 * l'eclipsi — que viu a l'element de vídeo, no al llenç! — i (3) el llenç de
 * la superposició. Una composició ingènua de vídeo+llenç captura un paisatge
 * lluminós sota una totalitat fosca. Aquí el filtre s'aplica amb
 * `ctx.filter` on el navegador ho suporta, i on no (iOS < 18) s'aproxima amb
 * un vel negre segons la claror percebuda — es perd la saturació i el
 * contrast del filtre, i es diu al comentari en lloc de dissimular-ho.
 *
 * El flux de `getUserMedia` és local: no taca el llenç i `toBlob` funciona.
 * La matemàtica del retall és la mateixa que fa servir el refinador del Sol.
 */

import type { Viewport } from './cameraGeometry';

export interface VisibleRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * El rectangle del fotograma de vídeo que ES VEU sota `object-fit: cover`:
 * escalat fins a no deixar forat i retallat centrat.
 */
export function visibleVideoRect(
  videoWidth: number,
  videoHeight: number,
  viewport: { width: number; height: number },
): VisibleRect {
  const cover = Math.max(viewport.width / videoWidth, viewport.height / videoHeight);
  const sw = viewport.width / cover;
  const sh = viewport.height / cover;
  return {
    sx: (videoWidth - sw) / 2,
    sy: (videoHeight - sh) / 2,
    sw,
    sh,
  };
}

/** Alçada de la tira de peu, proporcional a la imatge i mai il·legible. */
export function captionBarHeight(outputHeight: number): number {
  return Math.max(44, Math.round(outputHeight * 0.055));
}

/** Cos de lletra del peu quan el text hi cap sense estrènyer: el de sempre. */
const CAPTION_FONT_RATIO = 0.38;

/**
 * Fins on es pot abaixar el cos abans que el peu deixi de ser llegible.
 *
 * 0,24 de l'alçada de la barra, I EL NÚMERO ESTÀ MESURAT, no triat. El marc més
 * estret que fa aquesta app és un mòbil de 390 × 844 amb captura a 1080p: dona
 * 499 × 1080, barra de 59 px i 440 px per al text. Amb el topònim més llarg del
 * catàleg de proves —«a 3,1 km de l'Ametlla de Mar · 12.08.2026 · 20:29 ·
 * eclipsi.info»— les amplades són:
 *
 *     22 px → 628      18 px → 514      16 px → 457
 *     20 px → 571      17 px → 486      14 px → 400  ← hi cap
 *
 * O sigui que un sòl de 0,28 (17 px) es quedava curt i el peu seguia
 * estrenyent-se al 86 %: es va provar i no n'hi havia prou. 0,24 dona 14 px,
 * que en una imatge de 1080 d'alt és petit però es llegeix.
 *
 * PER SOTA D'AIXÒ NO S'ABAIXA MÉS. Si algun dia un topònim no hi cap ni a 0,24,
 * el que s'ha d'escurçar és el TEXT —`captureCaption()` ja sap fer un peu sense
 * topònim— i no la lletra: un peu que no es llegeix no és cap peu.
 */
const CAPTION_FONT_MIN_RATIO = 0.24;

/**
 * El cos amb què s'ha de pintar el peu perquè hi càpiga SENSE ESTRÈNYER.
 *
 * PER QUÈ EXISTEIX AQUESTA FUNCIÓ. Aquí hi havia una sola línia:
 *
 *     ctx.fillText(caption, x, y, outW - barH)
 *
 * i el quart argument de `fillText` NO RETALLA: CONDENSA. Un peu que no hi cabia
 * no es tallava, s'aplanava horitzontalment fins que les lletres es tocaven, i
 * ningú no ho podia veure perquè el canvas no es podia provar en aquest
 * repositori (vegeu `tests/dom-setup.ts`).
 *
 * MESURAT el 12-8-2026, un cop es va poder mesurar: amb el peu ja escurçat
 * d'aquell matí, en un marc de 499 × 1080 encara s'estrenyien 32 combinacions
 * de topònim i idioma, entre el 69 % i el 89 %. «a 3,1 km de Valls · 12.08.2026
 * · 20:29 · eclipsi.info» sortia al 86 %.
 *
 * PER QUÈ ENCONGIR I NO RETALLAR. Perquè el que sobra sempre és pel mig —el
 * topònim— i el que es perdria retallant és el final: la marca. Un peu una mica
 * més petit segueix dient-ho tot; un de retallat perd justament allò que fa que
 * la foto es pugui rastrejar fins aquí.
 *
 * I si ni al cos mínim hi cap, es torna el mínim i s'estreny: val més un peu
 * condensat que un de tan petit que no es llegeixi. Aquell cas queda vigilat per
 * `caption-fit.test.tsx`, que el llistarà si algun dia torna a aparèixer.
 */
export function captionFontPx(
  ctx: Pick<CanvasRenderingContext2D, 'font' | 'measureText'>,
  caption: string,
  barHeightPx: number,
  maxWidthPx: number,
): number {
  const ideal = Math.round(barHeightPx * CAPTION_FONT_RATIO);
  const minim = Math.max(1, Math.round(barHeightPx * CAPTION_FONT_MIN_RATIO));
  for (let px = ideal; px >= minim; px--) {
    ctx.font = `500 ${px}px system-ui, sans-serif`;
    if (ctx.measureText(caption).width <= maxWidthPx) return px;
  }
  /*
   * NI AL MÍNIM HI CAP. Es deixa la lletra al mínim —el bucle ja l'hi ha
   * deixada— i el `maxWidth` de `fillText` farà d'última xarxa estrenyent-la.
   * AQUÍ HI HAVIA UN ERROR: el bucle acabava a `minim + 1` i la funció tornava
   * `minim`, o sigui que el número que es retornava no era el que quedava
   * escrit al context. Ningú no ho hauria vist mai, perquè el valor de retorn
   * no el llegeix el codi de pintar: el que val és `ctx.font`.
   */
  ctx.font = `500 ${minim}px system-ui, sans-serif`;
  return minim;
}

/**
 * Compon la captura: vídeo (amb el fosc de l'eclipsi) + superposició + peu.
 *
 * @param cssFilter el filtre que el vídeo porta en pantalla (`lightState`).
 * @param perceivedLight claror percebuda 0-1, per al vel de recanvi.
 * @param caption text del peu (eclipsi · lloc · hora), ja localitzat.
 */
export function composeCapture(
  video: HTMLVideoElement,
  overlay: HTMLCanvasElement,
  viewport: Viewport,
  cssFilter: string,
  perceivedLight: number,
  caption: string,
): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw <= 0 || vh <= 0) return null;

  const rect = visibleVideoRect(vw, vh, viewport);
  const outW = Math.round(rect.sw);
  const outH = Math.round(rect.sh);
  const barH = captionBarHeight(outH);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH + barH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // El fosc de l'eclipsi. `ctx.filter` es detecta pel valor: si el navegador
  // no el suporta, la propietat es queda a 'none' i es passa al vel.
  let filtered = false;
  if (cssFilter && cssFilter !== 'none') {
    ctx.filter = cssFilter;
    filtered = ctx.filter !== 'none';
  }
  ctx.drawImage(video, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, outW, outH);
  ctx.filter = 'none';
  if (!filtered && perceivedLight < 1) {
    // Aproximació: només la claror. La saturació i el contrast del filtre
    // real es perden — millor un capvespre gris que un migdia fals.
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, Math.min(0.95, 1 - perceivedLight)).toFixed(3)})`;
    ctx.fillRect(0, 0, outW, outH);
  }

  // La superposició: el llenç sencer (mida física amb dpr) sobre el retall.
  ctx.drawImage(overlay, 0, 0, overlay.width, overlay.height, 0, 0, outW, outH);

  // El peu: eclipsi · lloc · hora. Fosc, llegible, sense pretensions.
  ctx.fillStyle = 'rgba(8, 10, 18, 0.92)';
  ctx.fillRect(0, outH, outW, barH);
  ctx.fillStyle = 'rgba(245, 240, 228, 0.92)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  // El cos es tria mesurant, no per proporció fixa: vegeu `captionFontPx`. La
  // crida deixa `ctx.font` a punt; el `maxWidth` de `fillText` es queda com a
  // última xarxa per al cas que ni el cos mínim hi càpiga.
  const maxTextWidth = outW - barH;
  captionFontPx(ctx, caption, barH, maxTextWidth);
  ctx.fillText(caption, Math.round(barH * 0.45), outH + barH / 2, maxTextWidth);

  return canvas;
}

/** `toBlob` amb promesa, JPEG de qualitat alta. */
export function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
  });
}
