/**
 * Render de la simulació del cel.
 *
 * Tot es dibuixa a escala angular REAL: els discos del Sol i de la Lluna tenen
 * el radi angular que els toca (~0,26°) i la seva separació és la separació
 * angular calculada. Res és decoratiu ni està exagerat, perquè l'objectiu és
 * que això es pugui superposar sobre la imatge de la càmera i quadri.
 */

import { discFlattening } from '../../core/astro/refraction';
import type { Atmosphere, EclipseSample } from '../../core/astro/types';

export interface SkyViewOptions {
  /** Amplada del camp de visió del retall, en graus. */
  fovDeg: number;
  atmosphere: Atmosphere;
  /** Dibuixa la línia d'horitzó i el terreny. */
  showHorizon: boolean;
  /**
   * Perfil d'horitzó: altura del terreny en graus per a cada azimut.
   * Si no n'hi ha, es dibuixa l'horitzó pla del mar a 0°.
   */
  horizonProfile?: (azimuthDeg: number) => number;
}

/**
 * Diferència d'azimut normalitzada a l'interval (-180, 180].
 * Sense això, un Sol a 359° i una Lluna a 1° donarien 358° de separació.
 */
function azimuthDelta(a: number, b: number): number {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

/**
 * Color del cel segons quanta llum solar queda.
 *
 * La percepció no és lineal amb l'obscuració: fins al 90% l'ull compensa i
 * amb prou feines notes res. Els últims segons abans de la totalitat és quan
 * cau tot de cop. Per això apliquem una potència alta a l'obscuració en
 * comptes d'un enfosquiment proporcional, que donaria una simulació
 * enganyosa i faria que la gent no entengués per què el 95% "no és res".
 */
function skyColor(sample: EclipseSample): string {
  const alt = sample.sun.altitudeApparent;
  const obsc = sample.obscuration;

  // Base: cel de capvespre segons l'altura del Sol.
  const twilight = Math.max(0, Math.min(1, (alt + 6) / 20));

  // L'enfosquiment per eclipsi només es nota de veritat a partir del ~95%.
  const eclipseDarkening = Math.pow(Math.max(0, obsc), 12);
  const light = twilight * (1 - eclipseDarkening * 0.97);

  const r = Math.round(20 + light * 90);
  const g = Math.round(24 + light * 120);
  const b = Math.round(45 + light * 170);
  return `rgb(${r},${g},${b})`;
}

/** L'enquadrament de sempre: prou per al disc i per als 3° de corona. */
export const BASE_FOV_DEG = 3.2;

/**
 * Sostre del camp de visió, i per què n'hi ha d'haver un.
 *
 * Un penya-segat a tocar pot quedar cinquanta graus per damunt del Sol. Obrir
 * el camp fins a encabir-lo faria el disc solar més petit que un píxel: hauríem
 * canviat un rectangle negre per un rectangle gris, que no és cap millora. A
 * partir d'aquí qui ho ha d'explicar és la frase, no el dibuix.
 */
const MAX_FOV_DEG = 30;

/** Aire per damunt de la carena, perquè no quedi enganxada a la vora. */
const MARGIN_DEG = 1.5;

/**
 * Opacitat dels astres quan el terreny els tapa. El mateix valor que la vista
 * de càmera (`features/ar/renderMixed.ts`), i pel mateix motiu: que es vegi on
 * és el Sol que et perds sense fer creure que el veuràs.
 */
const OCCLUDED_ALPHA = 0.28;

/**
 * Quin camp de visió necessita aquesta vista per no ser un rectangle buit.
 *
 * EL DEFECTE QUE AIXÒ TANCA. La vista tenia 3,2° clavats. A Valdelavilla el
 * Sol surt a 7,08° i la carena és a 12,85°: la línia de terreny queia uns
 * cinc-cents píxels per damunt de la vora superior i el polígon del terreny
 * omplia el llenç sencer, tapant el Sol, la Lluna i la corona que ja s'havien
 * dibuixat. Negre de dalt a baix, sense cap error a la consola, i a l'instant
 * que la vista obre per defecte.
 *
 * El dibuix era correcte —el que tenies al davant era la muntanya— però mut.
 * Amb el camp obert es veuen les dues coses alhora: la carena que et tapa i,
 * a sota, on és el Sol que no veuràs.
 *
 * Torna SEMPRE `BASE_FOV_DEG` quan no hi ha obstacle, perquè un punt amb
 * l'horitzó lliure no ha de canviar d'escala per un arranjament que no el mira.
 */
export function skyFieldOfView(
  sample: EclipseSample,
  horizonProfile: ((azimuthDeg: number) => number) | undefined,
  width: number,
  height: number,
  baseFovDeg: number = BASE_FOV_DEG,
): number {
  if (!horizonProfile || width <= 0 || height <= 0) return baseFovDeg;

  const drop = horizonProfile(sample.sun.azimuth) - sample.sun.altitudeApparent;
  if (!Number.isFinite(drop) || drop <= 0) return baseFovDeg;

  // EL CAMP EL FIXA L'AMPLADA, PERÒ LA CARENA HA DE CABRE EN ALÇADA, i el
  // llenç és clarament apaïsat. Amb `scale = width / fov`, mig camp vertical
  // val `(height / 2) · fov / width` graus; perquè hi càpiga el desnivell cal
  // multiplicar pel quocient de les dues mides. Sense aquest factor el càlcul
  // sortia curt i la carena continuava caient fora per dalt — que és
  // exactament el defecte que això havia d'arreglar.
  const needed = 2 * (drop + MARGIN_DEG) * (width / height);
  return Math.min(MAX_FOV_DEG, Math.max(baseFovDeg, needed));
}

/**
 * Dibuixa el retall del cel al voltant del Sol: els dos discos, la corona si
 * escau, i l'horitzó.
 */
export function renderEclipseSky(
  ctx: CanvasRenderingContext2D,
  sample: EclipseSample,
  width: number,
  height: number,
  options: SkyViewOptions,
): void {
  const { fovDeg, atmosphere } = options;

  // Píxels per grau. El camp de visió es fixa per l'amplada.
  const scale = width / fovDeg;

  ctx.fillStyle = skyColor(sample);
  ctx.fillRect(0, 0, width, height);

  // El Sol va sempre al centre del retall.
  const cx = width / 2;
  const cy = height / 2;

  const sun = sample.sun;
  const moon = sample.moon;

  // Desplaçament de la Lluna respecte al Sol, en graus, sobre el pla tangent.
  // Fem servir altures APARENTS a propòsit: prop de l'horitzó la refracció
  // diferencial comprimeix la separació vertical de veritat, i volem que la
  // simulació mostri això perquè és el que la càmera veurà.
  const dxDeg = azimuthDelta(moon.azimuth, sun.azimuth) * Math.cos((sun.altitudeApparent * Math.PI) / 180);
  const dyDeg = moon.altitudeApparent - sun.altitudeApparent;

  const sunR = sun.angularRadius * scale;
  const moonR = moon.angularRadius * scale;

  // Aplanament dels discos per refracció diferencial. A 2° d'altura ja és un
  // ~8% i és clarament visible.
  const sunFlat = discFlattening(sun.altitudeTrue, sun.angularRadius, atmosphere);
  const moonFlat = discFlattening(moon.altitudeTrue, moon.angularRadius, atmosphere);

  const mx = cx + dxDeg * scale;
  const my = cy - dyDeg * scale;

  const isTotal = sample.separation <= Math.abs(moon.angularRadius - sun.angularRadius);
  const isTotalNotAnnular = isTotal && moon.angularRadius >= sun.angularRadius;

  /*
   * EL TERRENY TAPA EL SOL: QUI VA PRIMER.
   *
   * Amb l'ordre de sempre —astres i després terreny— el polígon de la muntanya
   * els cobria opacs i la vista es quedava sense dir el més important: ON és
   * el Sol que no veuràs. Quan hi ha oclusió s'inverteix l'ordre i els astres
   * es dibuixen a sobre, esmorteïts.
   *
   * El 0,28 no és inventat: és el mateix que fa servir la vista de càmera
   * (`features/ar/renderMixed.ts`) per al mateix cas. Dues pantalles que
   * expliquen la mateixa cosa de dues maneres diferents és el que fa dubtar de
   * totes dues.
   */
  const groundAlt = options.horizonProfile ? options.horizonProfile(sun.azimuth) : 0;
  const occluded = options.showHorizon && sun.altitudeApparent < groundAlt;

  const drawBodies = (): void => {
    if (isTotalNotAnnular) {
      drawCorona(ctx, cx, cy, sunR, scale);
    }
    drawDiscs();
  };

  if (occluded) {
    drawHorizon(ctx, sample, width, height, scale, cy, options);
    ctx.save();
    ctx.globalAlpha = OCCLUDED_ALPHA;
    drawBodies();
    ctx.restore();
    return;
  }

  drawBodies();

  if (options.showHorizon) {
    drawHorizon(ctx, sample, width, height, scale, cy, options);
  }

  function drawDiscs(): void {
  // Disc solar. Durant la totalitat no es dibuixa: només hi ha corona.
  if (!isTotalNotAnnular) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, sunFlat);
    ctx.beginPath();
    ctx.arc(0, 0, sunR, 0, Math.PI * 2);
    // Prop de l'horitzó el Sol s'enrogeix per extinció atmosfèrica.
    const reddening = Math.max(0, Math.min(1, 1 - sun.altitudeApparent / 15));
    const g = Math.round(255 - reddening * 90);
    const b = Math.round(230 - reddening * 200);
    ctx.fillStyle = `rgb(255,${g},${b})`;
    ctx.shadowColor = `rgba(255,${g},${b},0.9)`;
    ctx.shadowBlur = sunR * 0.8;
    ctx.fill();
    ctx.restore();
  }

  // Disc lunar: opac i fosc, per damunt del Sol.
  ctx.save();
  ctx.translate(mx, my);
  ctx.scale(1, moonFlat);
  ctx.beginPath();
  ctx.arc(0, 0, moonR, 0, Math.PI * 2);
  ctx.fillStyle = isTotalNotAnnular ? '#05060a' : 'rgba(8,10,16,0.97)';
  ctx.fill();
  ctx.restore();
  }
}

/**
 * Corona solar. S'estén fins a uns 3 radis solars, que és el que justifica
 * l'avís de l'IGN: per veure la totalitat sencera necessites uns 3° lliures
 * per damunt de l'obstacle, no només el disc del Sol.
 */
function drawCorona(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  sunR: number,
  scale: number,
): void {
  const outer = sunR + 3 * scale;
  const gradient = ctx.createRadialGradient(cx, cy, sunR * 0.95, cx, cy, outer);
  gradient.addColorStop(0, 'rgba(255,255,245,0.95)');
  gradient.addColorStop(0.08, 'rgba(235,240,255,0.45)');
  gradient.addColorStop(0.3, 'rgba(200,215,255,0.16)');
  gradient.addColorStop(1, 'rgba(160,180,255,0)');

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Serrells radials, que és el que dona a la corona el seu aspecte real.
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    // Longitud pseudoaleatòria però determinista, perquè no parpellegi entre
    // fotogrames mentre l'usuari arrossega la línia temporal.
    const len = sunR * (1.3 + 1.9 * Math.abs(Math.sin(i * 2.399963)));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * sunR, cy + Math.sin(angle) * sunR);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.strokeStyle = 'rgba(215,228,255,0.10)';
    ctx.lineWidth = sunR * 0.16;
    ctx.stroke();
  }
  ctx.restore();
}

function drawHorizon(
  ctx: CanvasRenderingContext2D,
  sample: EclipseSample,
  width: number,
  height: number,
  scale: number,
  cy: number,
  options: SkyViewOptions,
): void {
  const sunAlt = sample.sun.altitudeApparent;
  const sunAz = sample.sun.azimuth;

  ctx.beginPath();
  ctx.moveTo(0, height);

  for (let px = 0; px <= width; px += 2) {
    const azOffset = (px - width / 2) / scale / Math.cos((sunAlt * Math.PI) / 180);
    const az = sunAz + azOffset;
    const horizonAlt = options.horizonProfile ? options.horizonProfile(az) : 0;
    const y = cy + (sunAlt - horizonAlt) * scale;
    ctx.lineTo(px, y);
  }

  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fillStyle = '#0a0c10';
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,140,170,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}
