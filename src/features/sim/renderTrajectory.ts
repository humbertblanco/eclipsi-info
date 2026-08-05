/**
 * Gràfic de trajectòria: el recorregut del Sol pel cel durant tot l'eclipsi,
 * contra el perfil d'horitzó.
 *
 * És el gràfic que respon la pregunta del projecte: "des d'aquí, el terreny
 * em tapa la totalitat?". Els contactes hi surten marcats i la part de la
 * trajectòria que queda per sota de l'horitzó es dibuixa esmorteïda.
 *
 * TÉ DOS VESTITS I UN SOL DIBUIX. En mode `full` és el gràfic de la pantalla de
 * simulació, amb graella, etiquetes i marcador de l'instant. En mode `mini` no
 * hi queda res d'això: només la silueta del terreny i el camí del Sol, que és
 * la imatge que identifica un punt d'un cop d'ull i la que fa servir la
 * miniatura de l'historial i la targeta compartible. NO hi ha un segon
 * renderitzador — seria la manera segura que la miniatura i el gràfic gran
 * acabessin dient coses diferents del mateix lloc.
 */

import type { EclipseSample, LocalCircumstances } from '../../core/astro/types';
import type { Locale } from '../../i18n';

export interface TrajectoryOptions {
  horizonProfile?: (azimuthDeg: number) => number;
  /** Instant que s'està mostrant a la simulació, per marcar-lo. */
  currentTime?: Date;
  locale: Locale;
  /**
   * Quanta cosa es dibuixa a part de la imatge.
   *
   * `full` (per defecte) és el gràfic de sempre. `mini` treu la graella, les
   * etiquetes dels contactes, el marcador de l'instant i els marges dels eixos:
   * a 56 px d'amplada cap d'aquests elements és llegible, i el que queda —
   * terreny i camí del Sol — és justament el que distingeix un punt d'un altre.
   */
  chrome?: 'full' | 'mini';
  /**
   * Què sabem del terreny que estem dibuixant.
   *
   * `measured` vol dir que la silueta ve d'un perfil calculat de debò.
   * `assumed` vol dir que NO n'hi ha cap i que el que es pinta és l'horitzó pla
   * de reserva; llavors es dibuixa en traç discontinu i apagat.
   *
   * PER QUÈ NO ES DIBUIXA IGUAL. Un horitzó pla i sòlid es llegeix com «aquí no
   * hi ha muntanyes», que és una afirmació que no hem fet i que és optimista
   * per construcció: l'horitzó pla no amaga mai el Sol. Aquesta app existeix
   * per no mentir en aquesta direcció (ESTAT.md §3.5). El traç discontinu diu
   * el que passa de veritat: el terreny d'aquest punt encara no s'ha calculat.
   */
  terrain?: 'measured' | 'assumed';
}

interface Bounds {
  azMin: number;
  azMax: number;
  altMin: number;
  altMax: number;
}

const LABELS = {
  ca: {
    c1: 'C1 inici',
    c2: 'C2 totalitat',
    max: 'màxim',
    c3: 'C3 fi tot.',
    c4: 'C4 final',
    central: 'fase central',
  },
  es: {
    c1: 'C1 inicio',
    c2: 'C2 totalidad',
    max: 'máximo',
    c3: 'C3 fin tot.',
    c4: 'C4 final',
    central: 'fase central',
  },
  en: {
    c1: 'C1 start',
    c2: 'C2 totality',
    max: 'maximum',
    c3: 'C3 end tot.',
    c4: 'C4 end',
    central: 'central phase',
  },
  fr: {
    c1: 'C1 début',
    c2: 'C2 totalité',
    max: 'maximum',
    c3: 'C3 fin tot.',
    c4: 'C4 fin',
    central: 'phase centrale',
  },
} as const;

export function renderTrajectory(
  ctx: CanvasRenderingContext2D,
  circumstances: LocalCircumstances,
  samples: EclipseSample[],
  width: number,
  height: number,
  options: TrajectoryOptions,
): void {
  if (samples.length === 0) return;

  const mini = options.chrome === 'mini';

  // Els marges dels eixos només serveixen per encabir-hi les etiquetes de graus.
  // Sense graella no hi ha res a encabir i la imatge ocupa el llenç sencer, que
  // és el que fa que una miniatura de 56 px encara ensenyi la carena.
  const pad = mini
    ? { left: 0, right: 0, top: 0, bottom: 0 }
    : { left: 44, right: 14, top: 16, bottom: 30 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const bounds = computeBounds(samples, options);
  const toX = (az: number) =>
    pad.left + ((az - bounds.azMin) / (bounds.azMax - bounds.azMin)) * plotW;
  const toY = (alt: number) =>
    pad.top + (1 - (alt - bounds.altMin) / (bounds.altMax - bounds.altMin)) * plotH;

  ctx.fillStyle = '#0d1016';
  ctx.fillRect(0, 0, width, height);

  const scale = strokeScale(height, options);

  if (!mini) drawGrid(ctx, bounds, toX, toY, pad, plotW, plotH);
  drawTerrain(ctx, bounds, toY, pad, plotW, plotH, options, scale);
  drawSunPath(ctx, samples, toX, toY, options, scale);
  if (mini) return;

  drawContacts(ctx, circumstances, toX, toY, options);

  if (options.currentTime) {
    drawCurrentMarker(ctx, samples, options.currentTime, toX, toY);
  }
}

/**
 * Gruix de traç segons la mida del dibuix.
 *
 * Els gruixos del mode `full` estan triats per a un llenç de 230 px d'alçada
 * (`--h-canvas-traj`). Clavats en una miniatura de 36 px, la línia del Sol en
 * taparia una desena part i la silueta del terreny quedaria amagada sota la
 * seva pròpia vora; a la targeta de 630 px passa el contrari i tot es veu prim
 * i tímid. S'escalen amb l'alçada i es limiten perquè mai desapareguin del tot.
 */
function strokeScale(height: number, options: TrajectoryOptions): number {
  if (options.chrome !== 'mini') return 1;
  return Math.max(0.4, Math.min(3, height / 230));
}

function computeBounds(samples: EclipseSample[], options: TrajectoryOptions): Bounds {
  let azMin = Infinity;
  let azMax = -Infinity;
  let altMax = -Infinity;

  for (const s of samples) {
    azMin = Math.min(azMin, s.sun.azimuth);
    azMax = Math.max(azMax, s.sun.azimuth);
    altMax = Math.max(altMax, s.sun.altitudeApparent);
  }

  // Marge lateral i sostre amb aire perquè la corona (fins a ~3°) hi càpiga.
  const azPad = Math.max(2, (azMax - azMin) * 0.06);

  let terrainMax = 0;
  if (options.horizonProfile) {
    for (let az = azMin - azPad; az <= azMax + azPad; az += 0.5) {
      terrainMax = Math.max(terrainMax, options.horizonProfile(az));
    }
  }

  return {
    azMin: azMin - azPad,
    azMax: azMax + azPad,
    altMin: Math.min(-1.5, -0.5),
    altMax: Math.max(altMax + 3.5, terrainMax + 1.5),
  };
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  bounds: Bounds,
  toX: (az: number) => number,
  toY: (alt: number) => number,
  pad: { left: number; top: number },
  plotW: number,
  plotH: number,
): void {
  ctx.strokeStyle = 'rgba(120,140,170,0.13)';
  ctx.fillStyle = 'rgba(150,170,200,0.75)';
  ctx.font = '10px ui-monospace, monospace';
  ctx.lineWidth = 1;

  const altStep = bounds.altMax - bounds.altMin > 20 ? 5 : 2;
  for (let alt = Math.ceil(bounds.altMin / altStep) * altStep; alt <= bounds.altMax; alt += altStep) {
    const y = toY(alt);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(`${alt}°`, pad.left - 6, y + 3);
  }

  const azStep = bounds.azMax - bounds.azMin > 30 ? 10 : 5;
  for (let az = Math.ceil(bounds.azMin / azStep) * azStep; az <= bounds.azMax; az += azStep) {
    const x = toX(az);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillText(`${az}°`, x, pad.top + plotH + 16);
  }
}

/**
 * Silueta del terreny. Sense perfil DEM, l'horitzó pla del mar a 0°.
 *
 * Amb `terrain: 'assumed'` la mateixa silueta es dibuixa en traç discontinu i
 * amb la tinta baixada: vegeu el perquè a `TrajectoryOptions.terrain`.
 */
function drawTerrain(
  ctx: CanvasRenderingContext2D,
  bounds: Bounds,
  toY: (alt: number) => number,
  pad: { left: number; top: number },
  plotW: number,
  plotH: number,
  options: TrajectoryOptions,
  scale = 1,
): void {
  const assumed = options.terrain === 'assumed';

  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + plotH);

  for (let px = 0; px <= plotW; px++) {
    const az = bounds.azMin + (px / plotW) * (bounds.azMax - bounds.azMin);
    const alt = options.horizonProfile ? options.horizonProfile(az) : 0;
    ctx.lineTo(pad.left + px, toY(alt));
  }

  ctx.lineTo(pad.left + plotW, pad.top + plotH);
  ctx.closePath();
  ctx.fillStyle = options.horizonProfile ? '#1a2430' : '#151b24';
  ctx.fill();
  ctx.strokeStyle = assumed ? 'rgba(140,170,200,0.30)' : 'rgba(140,170,200,0.55)';
  ctx.lineWidth = 1.5 * scale;
  // El patró s'escala amb el traç: a la miniatura, guions de 6 px sobre una
  // línia de 40 es llegirien com una línia contínua mal dibuixada.
  if (assumed) ctx.setLineDash([5 * scale, 4 * scale]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawSunPath(
  ctx: CanvasRenderingContext2D,
  samples: EclipseSample[],
  toX: (az: number) => number,
  toY: (alt: number) => number,
  options: TrajectoryOptions,
  scale = 1,
): void {
  // La trajectòria es dibuixa segment a segment, amb el color codificant
  // l'obscuració: així es veu d'un cop d'ull on és la totalitat i si cau per
  // sota del terreny.
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];

    const terrainAlt = options.horizonProfile
      ? options.horizonProfile(b.sun.azimuth)
      : 0;
    const hidden = b.sun.altitudeApparent < terrainAlt;

    const obsc = b.obscuration;
    let color: string;
    if (obsc >= 0.999) color = '#ff4d4d';
    else if (obsc > 0.9) color = '#ffa640';
    else color = '#ffd966';

    ctx.strokeStyle = hidden ? 'rgba(120,120,130,0.35)' : color;
    ctx.lineWidth = (hidden ? 2 : 3.5) * scale;
    ctx.beginPath();
    ctx.moveTo(toX(a.sun.azimuth), toY(a.sun.altitudeApparent));
    ctx.lineTo(toX(b.sun.azimuth), toY(b.sun.altitudeApparent));
    ctx.stroke();
  }
}

function drawContacts(
  ctx: CanvasRenderingContext2D,
  circumstances: LocalCircumstances,
  toX: (az: number) => number,
  toY: (alt: number) => number,
  options: TrajectoryOptions,
): void {
  const labels = LABELS[options.locale];
  const { c1, c2, c3, c4 } = circumstances.contacts;

  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';

  const marker = (sample: EclipseSample) => {
    const x = toX(sample.sun.azimuth);
    const y = toY(sample.sun.altitudeApparent);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#e8eef7';
    ctx.fill();
    ctx.strokeStyle = '#0d1016';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return { x, y };
  };

  const label = (text: string, x: number, y: number) => {
    ctx.fillStyle = 'rgba(210,225,245,0.9)';
    ctx.fillText(text, x, y);
  };

  if (c1) {
    const p = marker(c1);
    label(labels.c1, p.x, p.y - 10);
  }
  if (c4) {
    const p = marker(c4);
    label(labels.c4, p.x, p.y - 10);
  }

  // C2 i C3 delimiten la fase central, que en aquests eclipsis dura entre un i
  // dos minuts. A escala de tota la trajectòria els dos punts cauen a pocs
  // píxels l'un de l'altre i les seves etiquetes es trepitgen, així que quan
  // estan massa junts els posem una sola etiqueta comuna a sota de la corba
  // (a sobre hi ha la línia de la trajectòria).
  if (c2 && c3) {
    const p2 = marker(c2);
    const p3 = marker(c3);
    if (Math.abs(p3.x - p2.x) < 60) {
      label(labels.central, (p2.x + p3.x) / 2, Math.max(p2.y, p3.y) + 18);
    } else {
      label(labels.c2, p2.x, p2.y - 10);
      label(labels.c3, p3.x, p3.y - 10);
    }
  } else if (c2) {
    const p = marker(c2);
    label(labels.c2, p.x, p.y - 10);
  } else if (c3) {
    const p = marker(c3);
    label(labels.c3, p.x, p.y - 10);
  }
}

function drawCurrentMarker(
  ctx: CanvasRenderingContext2D,
  samples: EclipseSample[],
  time: Date,
  toX: (az: number) => number,
  toY: (alt: number) => number,
): void {
  const t = time.getTime();
  let nearest = samples[0];
  let bestDiff = Infinity;
  for (const s of samples) {
    const diff = Math.abs(s.time.getTime() - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      nearest = s;
    }
  }

  const x = toX(nearest.sun.azimuth);
  const y = toY(nearest.sun.altitudeApparent);

  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 2;
  ctx.stroke();
}
