/**
 * Overlay de realitat augmentada: el recorregut del Sol durant l'eclipsi
 * dibuixat sobre la imatge de la càmera.
 *
 * Aquesta és la funcionalitat que justifica l'app al camp: vas al lloc on
 * penses veure l'eclipsi, apuntes el mòbil cap a ponent, i veus per on baixarà
 * el Sol, on serà exactament a l'hora de la totalitat, i si el perfil de
 * muntanyes que tens al davant se'l menja abans d'hora.
 */

import type { EclipseSample, LocalCircumstances } from '../../core/astro/types';
import { projectToScreen, type CameraPointing, type Calibration } from './orientation';

import type { Viewport } from "./cameraGeometry";
import { renderPhaseTrack } from './renderPhaseTrack';
import { canvasFont, withAlpha, type Palette } from '../../styles/palette';

export interface OverlayOptions {
  viewport: Viewport;
  camera: CameraPointing;
  calibration: Calibration;
  /** Instant que s'està mirant. Marca el Sol amb la mida angular real. */
  currentTime: Date;
  /** Perfil d'horitzó del model del terreny, si ja s'ha calculat. */
  horizonProfile?: (azimuthDeg: number) => number;
  locale: 'ca' | 'es';
  /**
   * Els colors i les tipografies del sistema de disseny.
   *
   * Arriben com a DADA i no es van a buscar aquí dins: així aquest mòdul no
   * depèn del document, es pot provar amb una paleta sintètica, i canviar un
   * token del sistema canvia també el que es pinta al llenç — que abans no
   * passava, perquè aquí hi havia colors escrits a mà que no eren de la paleta.
   */
  palette: Palette;
}

/**
 * Contorn fosc darrere del text.
 *
 * No és decoració: aquest text va damunt d'una imatge de càmera que tant pot
 * ser cel clar com muntanya a contrallum, i sense contorn desapareix en un dels
 * dos casos. És negre i no un token perquè el que ha de fer és tapar, no tenyir.
 */
const TEXT_OUTLINE = 'rgba(0,0,0,0.65)';

const CONTACT_LABELS = {
  ca: { c1: 'C1', c2: 'C2 · totalitat', max: 'màxim', c3: 'C3', c4: 'C4' },
  es: { c1: 'C1', c2: 'C2 · totalidad', max: 'máximo', c3: 'C3', c4: 'C4' },
} as const;

const fmt = (d: Date, locale: 'ca' | 'es') =>
  d.toLocaleTimeString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    timeZone: 'Europe/Madrid',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  circumstances: LocalCircumstances,
  samples: EclipseSample[],
  options: OverlayOptions,
): void {
  const { width, height } = options.viewport;
  ctx.clearRect(0, 0, width, height);

  drawHorizon(ctx, options);
  drawSunPath(ctx, samples, options);
  drawContacts(ctx, circumstances, options);

  // Les fases al llarg del recorregut substitueixen les antigues marques
  // horàries. Un punt amb una hora al costat no explica res; un disc que es va
  // tapant a mesura que baixa cap a ponent explica l'eclipsi sencer d'una
  // ullada, que és el que l'usuari ha de poder veure al mòbil.
  renderPhaseTrack(ctx, samples, {
    viewport: options.viewport,
    camera: options.camera,
    calibration: options.calibration,
    currentTime: options.currentTime,
    horizonProfile: options.horizonProfile,
    locale: options.locale,
    palette: options.palette,
  });

  drawCurrentSun(ctx, samples, options);
  drawCompass(ctx, options);
}

/**
 * Horitzó. Si tenim el perfil del terreny el dibuixem: és el que permet a
 * l'usuari comprovar d'un cop d'ull que el model quadra amb les muntanyes
 * reals de la imatge, i corregir el desfasament si cal.
 */
function drawHorizon(ctx: CanvasRenderingContext2D, options: OverlayOptions): void {
  const { camera, calibration, horizonProfile, palette } = options;
  const { viewport } = options;
  const centerAz = camera.azimuth + calibration.azimuthOffset;

  ctx.beginPath();
  let started = false;
  for (let d = -60; d <= 60; d += 1) {
    const az = centerAz + d;
    const alt = horizonProfile ? horizonProfile(az) : 0;
    const p = projectToScreen(az, alt, camera, calibration, viewport);
    if (!p.visible) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(p.x, p.y);
      started = true;
    } else {
      ctx.lineTo(p.x, p.y);
    }
  }
  // Amb perfil del terreny és una dada verificable —"cel lliure"—; sense, és
  // només una referència informativa i va esmorteïda.
  ctx.strokeStyle = horizonProfile
    ? withAlpha(palette.statusClear, 0.85)
    : withAlpha(palette.statusInfo, 0.4);
  ctx.lineWidth = horizonProfile ? 2.5 : 1.5;
  ctx.setLineDash(horizonProfile ? [] : [6, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Recorregut del Sol de C1 a C4. El color codifica l'obscuració, i els trams
 * que queden per sota de l'horitzó real es dibuixen esmorteïts: veure la corba
 * enfonsar-se dins la muntanya és la manera més directa d'entendre que des
 * d'aquell punt no ho veuràs.
 */
function drawSunPath(
  ctx: CanvasRenderingContext2D,
  samples: EclipseSample[],
  options: OverlayOptions,
): void {
  const { camera, calibration, horizonProfile, palette } = options;
  const { viewport } = options;

  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];

    const pa = projectToScreen(a.sun.azimuth, a.sun.altitudeApparent, camera, calibration, viewport);
    const pb = projectToScreen(b.sun.azimuth, b.sun.altitudeApparent, camera, calibration, viewport);
    if (!pa.visible || !pb.visible) continue;

    const terrain = horizonProfile ? horizonProfile(b.sun.azimuth) : 0;
    const hidden = b.sun.altitudeApparent < terrain;

    // Els tres trams del recorregut surten dels colors de VISIBILITAT del
    // sistema, que és on es decideix com es codifica la dada central del
    // producte. Abans hi havia tres taronges diferents escrits a mà —#ff4d4d,
    // #ffa640, #ffd966—, i el sistema n'admet un de càlid: el que distingeix la
    // totalitat de la parcialitat no ha de ser un matís de taronja sinó el salt
    // de l'accent al color de perill.
    const obsc = b.obscuration;
    let color: string;
    if (obsc >= 0.999) color = palette.statusDanger;
    else if (obsc > 0.9) color = palette.statusPartial;
    else color = palette.accentHover;

    ctx.strokeStyle = hidden ? withAlpha(palette.statusCloudy, 0.4) : color;
    ctx.lineWidth = hidden ? 2 : 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
}

function drawContacts(
  ctx: CanvasRenderingContext2D,
  circumstances: LocalCircumstances,
  options: OverlayOptions,
): void {
  const { camera, calibration, locale, palette } = options;
  const { viewport } = options;
  const labels = CONTACT_LABELS[locale];
  const c = circumstances.contacts;

  // C2 i C3 delimiten la totalitat, que és quan es poden treure les ulleres i
  // quan s'han de tornar a posar: van amb el color de perill. C1 i C4 són
  // l'inici i el final de la parcialitat i van amb l'accent.
  const entries: Array<[EclipseSample | undefined, string, string]> = [
    [c.c1, labels.c1, palette.accentHover],
    [c.c2, labels.c2, palette.statusDanger],
    [c.c3, labels.c3, palette.statusDanger],
    [c.c4, labels.c4, palette.accentHover],
  ];

  ctx.font = canvasFont(palette, 12, { weight: 600, mono: false });
  ctx.textAlign = 'center';

  for (const [sample, text, color] of entries) {
    if (!sample) continue;
    const p = projectToScreen(sample.sun.azimuth, sample.sun.altitudeApparent, camera, calibration, viewport);
    if (!p.visible) continue;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = TEXT_OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const caption = `${text} ${fmt(sample.time, locale)}`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = TEXT_OUTLINE;
    ctx.strokeText(caption, p.x, p.y - 12);
    ctx.fillStyle = palette.textPrimary;
    ctx.fillText(caption, p.x, p.y - 12);
  }
}

/**
 * El Sol a l'instant que s'està mirant, amb la seva mida angular REAL i el
 * disc lunar al damunt. A la mida real el Sol fa mig grau: en una pantalla de
 * mòbil amb 66° de camp són uns 30 píxels. Es dibuixa un cercle de guia més
 * gran perquè es pugui localitzar sense haver de mirar el Sol de debò.
 */
function drawCurrentSun(
  ctx: CanvasRenderingContext2D,
  samples: EclipseSample[],
  options: OverlayOptions,
): void {
  const { camera, calibration, currentTime, viewport, palette } = options;
  const focalPx = viewport.focalPx;

  let sample = samples[0];
  let best = Infinity;
  for (const s of samples) {
    const diff = Math.abs(s.time.getTime() - currentTime.getTime());
    if (diff < best) {
      best = diff;
      sample = s;
    }
  }

  const p = projectToScreen(
    sample.sun.azimuth,
    sample.sun.altitudeApparent,
    camera, calibration, viewport);
  if (!p.visible) return;

  const focal = focalPx;
  const sunR = Math.tan(sample.sun.angularRadius * (Math.PI / 180)) * focal;

  // Disc solar a mida real.
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(sunR, 2), 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(palette.accent, 0.9);
  ctx.fill();

  // Disc lunar, també a mida real i a la seva posició relativa real.
  const pm = projectToScreen(
    sample.moon.azimuth,
    sample.moon.altitudeApparent,
    camera, calibration, viewport);
  if (pm.visible) {
    const moonR = Math.tan(sample.moon.angularRadius * (Math.PI / 180)) * focal;
    ctx.beginPath();
    ctx.arc(pm.x, pm.y, Math.max(moonR, 2), 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(palette.bgPage, 0.92);
    ctx.fill();
  }

  // Cercle de guia, molt més gran que el Sol, per poder-lo trobar a la
  // pantalla sense buscar-lo amb els ulls al cel.
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(sunR * 3, 26), 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(palette.accent, 0.55);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Marques de rumb a l'horitzó, per saber cap a on estàs mirant. */
function drawCompass(ctx: CanvasRenderingContext2D, options: OverlayOptions): void {
  const { camera, calibration, palette } = options;
  const { viewport } = options;
  const centerAz = camera.azimuth + calibration.azimuthOffset;

  // Xifres en monoespaiada tabular: els graus canvien contínuament mentre es
  // gira el telèfon, i amb amplada variable ballarien a cada fotograma.
  ctx.font = canvasFont(palette, 11);
  ctx.textAlign = 'center';

  const start = Math.ceil((centerAz - 50) / 10) * 10;
  for (let az = start; az <= centerAz + 50; az += 10) {
    const p = projectToScreen(az, 0, camera, calibration, viewport);
    if (!p.visible) continue;

    const cardinal = CARDINALS[((az % 360) + 360) % 360];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 6);
    ctx.lineTo(p.x, p.y + 6);
    ctx.strokeStyle = cardinal
      ? withAlpha(palette.statusInfo, 0.9)
      : withAlpha(palette.textBody, 0.35);
    ctx.lineWidth = cardinal ? 2 : 1;
    ctx.stroke();

    const text = cardinal ?? `${((az % 360) + 360) % 360}°`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = TEXT_OUTLINE;
    ctx.strokeText(text, p.x, p.y + 20);
    // Era #7dd3fc, que és blau de Tailwind i no del sistema.
    ctx.fillStyle = cardinal ? palette.statusInfo : withAlpha(palette.textBody, 0.65);
    ctx.fillText(text, p.x, p.y + 20);
  }
}

const CARDINALS: Record<number, string | undefined> = {
  0: 'N',
  90: 'E',
  180: 'S',
  270: 'O',
};
