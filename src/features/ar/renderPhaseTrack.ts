/**
 * Fases al llarg del recorregut.
 *
 * El problema que resol: a mida angular real el Sol fa mig grau, que en una
 * pantalla de mòbil amb 66° de camp són uns trenta píxels. A aquesta mida la
 * mossegada de la Lluna gairebé no es distingeix, i el recorregut es queda en
 * una corba amb marques horàries que no expliquen res.
 *
 * El que fa falta és veure, al llarg del recorregut, COM es va tapant el Sol
 * segons l'hora: una successió de fases que va de disc sencer a corona i torna
 * a disc, seguint la baixada cap a ponent.
 *
 * L'HONESTEDAT DE L'ESCALA. Aquests indicadors estan ampliats respecte de la
 * mida real, i això s'ha de dir. El que NO està deformat és la geometria: la
 * posició relativa de la Lluna, la mida relativa dels dos discos i l'angle per
 * on entra són exactament els calculats, només multiplicats tots pel mateix
 * factor. La forma de la mossegada, doncs, és la de debò. És el mateix conveni
 * que una icona de fase lunar: mida convencional, geometria certa.
 *
 * El disc del Sol a mida REAL i a la posició real el segueix dibuixant
 * `renderMixed`, que és el que ha de quadrar amb el cel.
 */

import type { EclipseSample } from '../../core/astro/types';
import type { Viewport } from './cameraGeometry';
import { projectToScreen, type CameraPointing, type Calibration } from './orientation';
import { canvasFont, withAlpha, type Palette } from '../../styles/palette';

const DEG = Math.PI / 180;

export interface PhaseTrackOptions {
  viewport: Viewport;
  camera: CameraPointing;
  calibration: Calibration;
  /** Instant que s'està mirant: el seu indicador es dibuixa més gran. */
  currentTime: Date;
  /** Perfil del terreny: les fases amagades es dibuixen esmorteïdes. */
  horizonProfile?: (azimuthDeg: number) => number;
  /** Radi del disc solar als indicadors, en píxels. */
  markerRadiusPx?: number;
  locale: 'ca' | 'es';
  /**
   * Colors i tipografies del sistema de disseny, com a dada.
   *
   * COMPTE amb el que NO ha de sortir d'aquí: el color de la fotosfera i el de
   * la corona són RESULTATS FÍSICS —l'enrogiment per extinció atmosfèrica, la
   * temperatura de color de la corona— i no decisions de disseny. Tenyir-los
   * amb un token de marca seria dibuixar un Sol que no és el que es veurà.
   */
  palette: Palette;
}

/** Diferència d'azimut normalitzada a (-180, 180]. */
function azimuthDelta(a: number, b: number): number {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

/** Cert quan el disc lunar cobreix del tot el solar: totalitat de veritat. */
function isTotalPhase(sample: EclipseSample): boolean {
  return (
    sample.separation <=
      Math.abs(sample.moon.angularRadius - sample.sun.angularRadius) &&
    sample.moon.angularRadius >= sample.sun.angularRadius
  );
}

/**
 * Percentatge d'obscuració a l'etiqueta, sense mentir mai.
 *
 * `toFixed(0)` sobre 0,998 imprimeix "100%", i posat al costat d'un disc que
 * es veu negre fa concloure a qualsevol que allà hi ha totalitat. No n'hi ha:
 * queda un fil de fotosfera que és milers de vegades més brillant que la
 * corona, no es fa fosc, i el filtre no es pot treure en cap moment.
 *
 * Fora de la fase central s'afegeixen decimals fins que la xifra deixa de
 * llegir-se com un 100.
 */
function formatPhaseObscuration(sample: EclipseSample): string {
  const pct = Math.max(0, Math.min(1, sample.obscuration)) * 100;
  if (isTotalPhase(sample)) return '100%';
  for (const decimals of [0, 1, 2, 3]) {
    const text = pct.toFixed(decimals);
    if (Number.parseFloat(text) < 100) return `${text.replace('.', ',')}%`;
  }
  return '<100%';
}

const fmt = (d: Date, locale: 'ca' | 'es') =>
  d.toLocaleTimeString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    timeZone: 'Europe/Madrid',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Tria quines mostres mereixen un indicador.
 *
 * Un cada deu minuts durant les fases parcials, que és on no passa gran cosa,
 * i molt més densos al voltant de la fase central, que és on tot passa en
 * segons: entre C2 i C3 hi ha entre un i dos minuts i és justament el tram que
 * l'usuari vol entendre.
 */
function pickSamples(samples: EclipseSample[], currentTime: Date): EclipseSample[] {
  if (samples.length === 0) return [];

  const picked: EclipseSample[] = [];
  let lastMs = -Infinity;

  for (const s of samples) {
    const ms = s.time.getTime();
    // A prop de la totalitat l'obscuració canvia de pressa: cal més densitat.
    const spacingMs = s.obscuration > 0.97 ? 20 * 1000 : 10 * 60 * 1000;
    if (ms - lastMs >= spacingMs) {
      picked.push(s);
      lastMs = ms;
    }
  }

  // L'instant que s'està mirant hi ha de ser sempre, encara que caigui entre
  // dos indicadors.
  const t = currentTime.getTime();
  if (!picked.some((s) => Math.abs(s.time.getTime() - t) < 1000)) {
    let nearest = samples[0];
    let best = Infinity;
    for (const s of samples) {
      const d = Math.abs(s.time.getTime() - t);
      if (d < best) {
        best = d;
        nearest = s;
      }
    }
    picked.push(nearest);
    picked.sort((a, b) => a.time.getTime() - b.time.getTime());
  }

  return picked;
}

export function renderPhaseTrack(
  ctx: CanvasRenderingContext2D,
  samples: EclipseSample[],
  options: PhaseTrackOptions,
): void {
  const {
    viewport,
    camera,
    calibration,
    currentTime,
    horizonProfile,
    markerRadiusPx = 13,
    locale,
    palette,
  } = options;

  const picked = pickSamples(samples, currentTime);
  const currentMs = currentTime.getTime();

  // Hora i percentatge en monoespaiada tabular: són xifres que canvien mentre
  // s'arrossega la línia temporal, i amb amplada variable saltarien.
  ctx.font = canvasFont(palette, 10);
  ctx.textAlign = 'center';

  for (const sample of picked) {
    const p = projectToScreen(
      sample.sun.azimuth,
      sample.sun.altitudeApparent,
      camera,
      calibration,
      viewport,
    );
    if (!p.visible) continue;

    const isCurrent = Math.abs(sample.time.getTime() - currentMs) < 1000;
    const r = isCurrent ? markerRadiusPx * 1.75 : markerRadiusPx;

    const groundAlt = horizonProfile ? horizonProfile(sample.sun.azimuth) : 0;
    const hidden = sample.sun.altitudeApparent < groundAlt;

    drawPhase(ctx, p.x, p.y, r, sample, hidden, isCurrent, palette);

    if (isCurrent) {
      const label = `${fmt(sample.time, locale)} · ${formatPhaseObscuration(sample)}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = withAlpha(palette.bgPage, 0.75);
      ctx.strokeText(label, p.x, p.y - r - 8);
      ctx.fillStyle = palette.textPrimary;
      ctx.fillText(label, p.x, p.y - r - 8);
    }
  }
}

/**
 * Un indicador de fase: el disc solar amb la mossegada de la Lluna a la seva
 * posició relativa real.
 */
function drawPhase(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  sunR: number,
  sample: EclipseSample,
  hidden: boolean,
  isCurrent: boolean,
  palette: Palette,
): void {
  const sun = sample.sun;
  const moon = sample.moon;

  // Factor únic per a tot: el mateix que aplica al radi solar aplica a la
  // separació i al radi lunar. Així la geometria no es deforma.
  const scale = sunR / sun.angularRadius;

  const dxDeg = azimuthDelta(moon.azimuth, sun.azimuth) * Math.cos(sun.altitudeApparent * DEG);
  const dyDeg = moon.altitudeApparent - sun.altitudeApparent;

  const mx = cx + dxDeg * scale;
  const my = cy - dyDeg * scale;
  const moonR = moon.angularRadius * scale;

  const isTotal =
    sample.separation <= Math.abs(moon.angularRadius - sun.angularRadius) &&
    moon.angularRadius >= sun.angularRadius;

  ctx.save();
  if (hidden) ctx.globalAlpha = 0.3;

  if (isTotal) {
    // Corona: un anell fi al voltant del disc negre. A la totalitat no queda
    // fotosfera, i és l'únic moment en què es pot mirar sense filtre.
    const glow = ctx.createRadialGradient(cx, cy, sunR * 0.9, cx, cy, sunR * 2.1);
    glow.addColorStop(0, 'rgba(255,255,246,0.85)');
    glow.addColorStop(0.35, 'rgba(226,235,255,0.28)');
    glow.addColorStop(1, 'rgba(170,195,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, sunR * 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    ctx.fillStyle = palette.bgPage;
    ctx.fill();
  } else {
    // Fotosfera. S'enrogeix a mesura que el Sol baixa, per extinció
    // atmosfèrica: als eclipsis de 2026 i 2028 això és ben visible.
    const reddening = Math.max(0, Math.min(1, 1 - sun.altitudeApparent / 15));
    const g = Math.round(255 - reddening * 95);
    const b = Math.round(235 - reddening * 205);

    ctx.beginPath();
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(255,${g},${b})`;
    ctx.fill();

    // Gruix real de la falç que queda, en píxels: de la vora llunyana del Sol
    // fins a la vora de la Lluna, al llarg de la línia de centres.
    const separationPx = Math.hypot(mx - cx, my - cy);
    const crescentPx = sunR + separationPx - moonR;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    ctx.clip();

    // GARANTIA DE VISIBILITAT. En una parcial molt profunda —el 99,8%, per
    // exemple— la falç que queda fa una fracció de píxel i el disc es dibuixa
    // negre. El gràfic diria «totalitat» quan no n'hi ha, i la conseqüència no
    // és estètica: és que algú es tregui el filtre.
    //
    // Aquí es garanteix un gruix mínim de dos píxels dibuixant un anell dins
    // del disc solar ABANS de posar-hi la Lluna a sobre. La Lluna n'esborra la
    // part que tapa, i queda la falç a la posició i amb la forma correctes,
    // només amb el gruix mínim per poder-se veure.
    //
    // No és exagerar res: hi ha fotosfera de veritat, i el que es dibuixa és
    // exactament on és. L'única llicència és el gruix, i el que hi ha en joc
    // justifica de sobres prendre-se-la.
    if (crescentPx > 0 && crescentPx < 2) {
      ctx.beginPath();
      ctx.arc(cx, cy, sunR - 1, 0, Math.PI * 2);
      ctx.strokeStyle = `rgb(255,${g},${b})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // La Lluna, retallada al disc solar: així la part que en sobresurt no
    // pinta res sobre el cel i queda la falç neta.
    ctx.beginPath();
    ctx.arc(mx, my, moonR, 0, Math.PI * 2);
    ctx.fillStyle = palette.bgPage;
    ctx.fill();
    ctx.restore();
  }

  // Vora: marca l'indicador actiu i separa el disc del fons.
  ctx.beginPath();
  ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
  ctx.strokeStyle = isCurrent
    ? withAlpha(palette.sun400, 0.95)
    : withAlpha(palette.textBody, 0.35);
  ctx.lineWidth = isCurrent ? 2 : 1;
  ctx.stroke();

  ctx.restore();
}
