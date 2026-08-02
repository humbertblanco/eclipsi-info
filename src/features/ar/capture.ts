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
  ctx.font = `500 ${Math.round(barH * 0.38)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(caption, Math.round(barH * 0.45), outH + barH / 2, outW - barH);

  return canvas;
}

/** `toBlob` amb promesa, JPEG de qualitat alta. */
export function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
  });
}
