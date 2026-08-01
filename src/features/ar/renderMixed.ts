/**
 * Mixed AR: l'eclipsi compost DINS de la imatge real de la càmera.
 *
 * La diferència amb la superposició esquemàtica és tota la gràcia del
 * producte. L'esquema et diu on passarà; això et diu com es veurà. Apuntes el
 * mòbil cap a ponent des del lloc on penses anar, i veus l'eclipsi damunt de
 * les teves muntanyes, a la seva mida angular real, amb la llum que hi haurà i
 * amb el terreny que tens al davant tapant-lo o no.
 *
 * Repartiment de feina entre les dues capes, que és el que fa que això vagi
 * fluid en un mòbil:
 *
 *  - L'element <video> porta un filtre CSS (brightness/saturate/contrast). El
 *    compon la GPU i és pràcticament gratuït. S'encarrega de la caiguda de
 *    llum global i del viratge metàl·lic, que afecta tota l'escena — muntanyes
 *    incloses, perquè durant un eclipsi s'enfosqueix tot, no només el cel.
 *  - Aquest canvas, transparent, hi afegeix el que és local i ancorat al món:
 *    el tint del cel, la resplendor de 360° a l'horitzó, els discos i la
 *    corona. Res d'això es pot fer amb un filtre.
 */

import type { EclipseSample } from '../../core/astro/types';
import { colorfulness, skyStateFromSample } from '../../core/sky';
import type { Viewport } from './cameraGeometry';
import { projectToScreen, type CameraPointing, type Calibration } from './orientation';
import { renderPhaseTrack } from './renderPhaseTrack';
import { canvasFont, withAlpha, type Palette } from '../../styles/palette';

const DEG = Math.PI / 180;

export interface SkyBody {
  name: string;
  azimuth: number;
  altitude: number;
  /** Magnitud aparent. Com més petita, més brillant. */
  magnitude: number;
}

export interface MixedOptions {
  viewport: Viewport;
  camera: CameraPointing;
  calibration: Calibration;
  /** Perfil d'horitzó del terreny, si ja s'ha calculat. */
  horizonProfile?: (azimuthDeg: number) => number;
  /** Planetes i estrelles brillants, per pintar-los durant la totalitat. */
  bodies?: SkyBody[];
  /**
   * Recorregut sencer de C1 a C4. Si es passa, es dibuixen les fases al llarg
   * del camí perquè es vegi com el Sol es va tapant segons l'hora.
   */
  pathSamples?: EclipseSample[];
  /**
   * Colors i tipografies del sistema de disseny, com a dada.
   *
   * ATENCIÓ AL QUE NO SURT D'AQUÍ. Els degradats del cel eclipsat, la corona,
   * la resplendor de 360° a l'horitzó i el color de la fotosfera són RESULTATS
   * FÍSICS: surten de la fracció de llum que queda, de l'extinció atmosfèrica i
   * de la temperatura de color de la corona, i estan calculats. Substituir-los
   * per tokens de marca faria una imatge més "de la casa" i menys certa, i
   * aquesta pantalla existeix precisament per ensenyar què es veurà. La paleta
   * mana sobre el cromatge —etiquetes, vores, marques—, no sobre la simulació.
   */
  palette: Palette;
  locale?: 'ca' | 'es';
}

/** Filtre CSS que s'aplica a l'element de vídeo. */
export interface LightState {
  cssFilter: string;
  /** Fracció de llum FÍSICA que queda, d'1 a ~1e-5. */
  physicalFraction: number;
  /** Claror PERCEBUDA per un ull adaptat, de 0 a 1. */
  perceived: number;
}

/**
 * Model de llum durant l'eclipsi. El càlcul el fa sencer `core/sky`.
 *
 * El fet perceptiu que aquesta funció ha de transmetre, i que sorprèn gairebé
 * tothom, és que la llum no baixa de manera proporcional. Amb el 95% del Sol
 * tapat encara queden uns 3.300 lux —més que qualsevol interior— i, sobretot,
 * l'ull s'hi ha ajustat: es nota una caiguda d'una vegada i mitja quan la
 * física n'ha caigut trenta. La caiguda de veritat passa en els últims segons
 * abans de C2, quan es passa de centenars de lux al 99% a uns 5 o 7 lux durant
 * la totalitat.
 *
 * Xifres de referència de l'American Astronomical Society: 100.000 lux amb Sol
 * ple, 25.000 al 75%, ~1.000 al 99% i ~5 lux durant la totalitat. El model de
 * `core/sky` les reprodueix (102.600 lx de feix directe al zenit, 24.600 al
 * 75%, 670 al 99% i 5-7 lx a la totalitat); al 99% en dona una mica menys que
 * l'AAS perquè hi entra l'enfosquiment del limbe, que l'escala lineal de l'AAS
 * no té: amb el 99% de l'ÀREA tapada el que queda és la vora fosca del disc i
 * són el 0,58% del flux, no l'1%.
 *
 * PER QUÈ ES COMPARA CONTRA EL MATEIX CEL SENSE ECLIPSI, i no contra el migdia:
 * el filtre representa el que l'eclipsi CANVIA damunt de la imatge de la
 * càmera, no la brillantor absoluta de l'escena, que ni sabem (la càmera fa el
 * seu propi balanç) ni tindria sentit (el vídeo és d'ara, l'eclipsi és d'un
 * altre dia). Per això amb obscuració zero el filtre ha de ser exactament
 * neutre, sigui quina sigui l'altura del Sol.
 */
export function lightState(sample: EclipseSample): LightState {
  // La mostra ja porta l'altura APARENT del Sol i els dos radis angulars, o
  // sigui que el model pot integrar l'enfosquiment del limbe sobre el tros de
  // fotosfera que queda en comptes d'estimar-lo a partir de l'obscuració. Amb
  // el Sol baix (2026 i 2028) també hi entren la massa d'aire de Kasten &
  // Young i l'extinció, que amb 20 atmosferes al davant no són cap detall.
  const sky = skyStateFromSample(sample);

  // Llum física respecte del mateix cel sense eclipsi. Va d'1 a ~7·10⁻⁵.
  const physicalFraction = sky.lightFraction;

  // Claror percebuda per un ull ja adaptat a la llum que hi ha. No és cap
  // exponent triat a ull: surt de compondre la llei de potència de Stevens amb
  // el fet que el nivell d'adaptació SEGUEIX la llum (`ADAPTATION_FOLLOW`). El
  // resultat és molt més compressiu que l'arrel cúbica —al 95% dona 0,65 i no
  // 0,32— i és el que fa que la simulació digui la veritat: al 95% encara
  // sembla de dia.
  const perceived = sky.eye.perceivedFraction;

  // La brillantor del vídeo ÉS la claror percebuda: cap factor afegit i cap
  // sòl artificial. El model no arriba mai a zero (durant la totalitat encara
  // hi ha la fuita de llum de fora de l'ombra i la corona), o sigui que no cal
  // protegir la imatge de quedar-se negra.
  const brightness = perceived;

  // Viratge metàl·lic: efecte Hunt (menys luminància, menys colorit) més el
  // desplaçament de Purkinje quan l'escena entra al règim mesòpic. Es mesura
  // relatiu al colorit que tindria el mateix cel sense eclipsi, perquè el que
  // ha de despintar la imatge és l'eclipsi i no el capvespre.
  const clearColorfulness = colorfulness(sky.clearSkyIlluminanceLux);
  const saturation =
    clearColorfulness > 0
      ? Math.min(1, sky.eye.colorfulness / clearColorfulness)
      : 1;

  // El contrast puja perquè les ombres es fan nítides: la font de llum s'ha
  // convertit en una mitja lluna prima en comptes d'un disc. Això ho mana la
  // GEOMETRIA (la fracció de flux que queda), no la fotometria, i és l'únic
  // terme d'aquesta funció que el model de llum no calcula.
  const contrast = 1 + 0.35 * (1 - sky.luminousFraction);

  return {
    cssFilter: `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)}) contrast(${contrast.toFixed(3)})`,
    physicalFraction,
    perceived,
  };
}

/** Dibuixa la capa composta sobre el canvas transparent. */
export function renderMixed(
  ctx: CanvasRenderingContext2D,
  sample: EclipseSample,
  options: MixedOptions,
): void {
  const { viewport } = options;
  ctx.clearRect(0, 0, viewport.width, viewport.height);

  const light = lightState(sample);
  const isTotal =
    sample.separation <= Math.abs(sample.moon.angularRadius - sample.sun.angularRadius) &&
    sample.moon.angularRadius >= sample.sun.angularRadius;

  drawSkyTint(ctx, light, options);
  if (light.perceived < 0.35) drawHorizonGlow(ctx, sample, light, options);
  if (isTotal && options.bodies?.length) drawBodies(ctx, options);

  // Les fases al llarg del recorregut van SOTA els discos a mida real: són una
  // ajuda de lectura, i el que ha de quadrar amb el cel és el disc real.
  if (options.pathSamples?.length) {
    renderPhaseTrack(ctx, options.pathSamples, {
      viewport: options.viewport,
      camera: options.camera,
      calibration: options.calibration,
      currentTime: sample.time,
      horizonProfile: options.horizonProfile,
      markerRadiusPx: 11,
      locale: options.locale ?? 'ca',
      palette: options.palette,
    });
  }

  drawDiscs(ctx, sample, isTotal, options);
}

/**
 * Tint del cel. El filtre del vídeo enfosqueix tota la imatge per igual, però
 * el cel s'enfosqueix més que el terra i amb un color diferent, així que hi
 * posem un degradat vertical ancorat a l'horitzó real.
 */
function drawSkyTint(
  ctx: CanvasRenderingContext2D,
  light: LightState,
  options: MixedOptions,
): void {
  const { viewport, camera, calibration } = options;
  const strength = Math.max(0, 1 - light.perceived / 0.6);
  if (strength <= 0.01) return;

  // Y de l'horitzó al centre de la imatge, per ancorar el degradat al món.
  const centerAz = camera.azimuth + calibration.azimuthOffset;
  const horizon = projectToScreen(centerAz, 0, camera, calibration, viewport);
  const horizonY = horizon.visible ? horizon.y : viewport.height;

  // El cel per damunt de l'horitzó, cap a un blau crepuscular fosc.
  const gradient = ctx.createLinearGradient(0, horizonY - viewport.height, 0, horizonY);
  gradient.addColorStop(0, `rgba(6,10,26,${(strength * 0.85).toFixed(3)})`);
  gradient.addColorStop(0.65, `rgba(12,18,40,${(strength * 0.55).toFixed(3)})`);
  gradient.addColorStop(1, `rgba(30,26,44,${(strength * 0.2).toFixed(3)})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

/**
 * Resplendor de 360° a l'horitzó.
 *
 * Durant la totalitat l'ombra de la Lluna fa uns 290 km d'amplada, i per tant
 * en totes direccions, a poc més de cent quilòmetres, encara hi ha ple sol.
 * El resultat és un capvespre taronja que envolta l'observador pels 360°, cosa
 * que no s'assembla a res que es vegi cap altre dia. Amb el Sol ja baix, com
 * passa el 2026 i el 2028, la banda de ponent és a més la del capvespre real i
 * queda especialment intensa.
 */
function drawHorizonGlow(
  ctx: CanvasRenderingContext2D,
  sample: EclipseSample,
  light: LightState,
  options: MixedOptions,
): void {
  const { viewport, camera, calibration, horizonProfile } = options;
  const intensity = Math.max(0, Math.min(1, 1 - light.perceived / 0.35));
  if (intensity <= 0.02) return;

  const centerAz = camera.azimuth + calibration.azimuthOffset;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Es dibuixa com una tira vertical per cada azimut, perquè el degradat ha de
  // seguir la línia de l'horitzó real i no una recta de la pantalla.
  for (let d = -70; d <= 70; d += 1.5) {
    const az = centerAz + d;
    const groundAlt = horizonProfile ? horizonProfile(az) : 0;

    const base = projectToScreen(az, groundAlt, camera, calibration, viewport);
    const top = projectToScreen(az, groundAlt + 9, camera, calibration, viewport);
    if (!base.visible || !top.visible) continue;

    // Més intens en la direcció del Sol, però mai zero: aquesta és tota la
    // gràcia del fenomen.
    const towardSun = Math.cos(((az - sample.sun.azimuth) * DEG) / 1);
    const local = intensity * (0.45 + 0.55 * Math.max(0, towardSun));

    const strip = ctx.createLinearGradient(base.x, base.y, top.x, top.y);
    strip.addColorStop(0, `rgba(255,146,58,${(local * 0.5).toFixed(3)})`);
    strip.addColorStop(0.45, `rgba(255,108,52,${(local * 0.26).toFixed(3)})`);
    strip.addColorStop(1, 'rgba(120,60,90,0)');

    ctx.fillStyle = strip;
    ctx.fillRect(base.x - 8, Math.min(base.y, top.y), 16, Math.abs(base.y - top.y));
  }

  ctx.restore();
}

/** Planetes i estrelles brillants, que només surten durant la totalitat. */
function drawBodies(ctx: CanvasRenderingContext2D, options: MixedOptions): void {
  const { viewport, camera, calibration, bodies = [], palette } = options;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.font = canvasFont(palette, 11, { mono: false });
  ctx.textAlign = 'center';

  for (const body of bodies) {
    if (body.altitude < 0) continue;
    const p = projectToScreen(body.azimuth, body.altitude, camera, calibration, viewport);
    if (!p.visible) continue;

    // Radi segons la magnitud: Venus a -4 es veu clarament, una estrella de
    // magnitud 1 amb prou feines.
    const r = Math.max(1.2, 3.4 - body.magnitude * 0.55);

    const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5);
    halo.addColorStop(0, 'rgba(255,255,255,0.95)');
    halo.addColorStop(0.25, 'rgba(220,235,255,0.35)');
    halo.addColorStop(1, 'rgba(180,205,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = withAlpha(palette.textBody, 0.75);
    ctx.fillText(body.name, p.x, p.y - r * 5 - 4);
  }

  ctx.restore();
}

/**
 * Els discos, a mida angular real i a la posició real.
 *
 * A mida real el Sol fa poc més de mig grau. En una pantalla de mòbil amb uns
 * 66° de camp són uns trenta píxels: petit. Es dibuixa exactament així a
 * propòsit, perquè una de les coses que la gent no s'espera és justament que
 * el Sol eclipsat sigui tan petit al cel. Exagerar-lo faria bonic i enganyaria.
 */
function drawDiscs(
  ctx: CanvasRenderingContext2D,
  sample: EclipseSample,
  isTotal: boolean,
  options: MixedOptions,
): void {
  const { viewport, camera, calibration, horizonProfile, palette } = options;

  const sun = projectToScreen(
    sample.sun.azimuth,
    sample.sun.altitudeApparent,
    camera,
    calibration,
    viewport,
  );
  if (!sun.visible) return;

  const focal = viewport.focalPx;
  const sunR = Math.tan(sample.sun.angularRadius * DEG) * focal;
  const moonR = Math.tan(sample.moon.angularRadius * DEG) * focal;

  const moon = projectToScreen(
    sample.moon.azimuth,
    sample.moon.altitudeApparent,
    camera,
    calibration,
    viewport,
  );

  // Si el terreny ja tapa el Sol, es dibuixa esmorteït i s'avisa: aquesta és
  // literalment la pregunta que l'app ha de contestar.
  const groundAlt = horizonProfile ? horizonProfile(sample.sun.azimuth) : 0;
  const occluded = sample.sun.altitudeApparent < groundAlt;

  ctx.save();
  if (occluded) ctx.globalAlpha = 0.28;

  if (isTotal) {
    drawCorona(ctx, sun.x, sun.y, sunR, focal);
  }

  if (!isTotal) {
    // Fotosfera. Prop de l'horitzó s'enrogeix per extinció.
    const reddening = Math.max(0, Math.min(1, 1 - sample.sun.altitudeApparent / 15));
    const g = Math.round(255 - reddening * 95);
    const b = Math.round(235 - reddening * 205);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(sun.x, sun.y, sunR * 0.8, sun.x, sun.y, sunR * 4);
    halo.addColorStop(0, `rgba(255,${g},${b},0.5)`);
    halo.addColorStop(1, `rgba(255,${g},${b},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sunR * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sunR, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(255,${g},${b})`;
    ctx.fill();
  }

  // Disc lunar: opac. És la silueta de la Lluna nova, que sense eclipsi seria
  // invisible.
  if (moon.visible) {
    ctx.beginPath();
    ctx.arc(moon.x, moon.y, moonR, 0, Math.PI * 2);
    // El disc lunar és una silueta, no un color de marca: ha de ser el negre
    // més profund de què disposa el sistema perquè la corona hi ressalti.
    ctx.fillStyle = isTotal ? palette.bgInset : withAlpha(palette.bgPage, 0.985);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Corona solar.
 *
 * S'estén fins a uns tres graus, que és molt més que el disc. Per això la guia
 * insisteix que no n'hi ha prou de tenir el Sol lliure per damunt de la
 * muntanya: en calen uns graus més, o veuràs la totalitat amb la meitat de la
 * corona amagada darrere el relleu.
 */
function drawCorona(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  sunR: number,
  focal: number,
): void {
  // Tres graus expressats en píxels d'aquesta pantalla.
  const outer = sunR + Math.tan(3 * DEG) * focal;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const gradient = ctx.createRadialGradient(cx, cy, sunR * 0.92, cx, cy, outer);
  gradient.addColorStop(0, 'rgba(255,255,246,0.92)');
  gradient.addColorStop(0.06, 'rgba(238,242,255,0.42)');
  gradient.addColorStop(0.28, 'rgba(198,214,255,0.14)');
  gradient.addColorStop(1, 'rgba(150,175,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.fill();

  // Serpentines. La longitud es deriva de l'índex amb una funció determinista
  // perquè no parpellegin mentre l'usuari arrossega la línia temporal.
  for (let i = 0; i < 56; i++) {
    const angle = (i / 56) * Math.PI * 2;
    const len = sunR + (outer - sunR) * (0.25 + 0.6 * Math.abs(Math.sin(i * 2.399963)));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * sunR, cy + Math.sin(angle) * sunR);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.strokeStyle = 'rgba(216,229,255,0.085)';
    ctx.lineWidth = sunR * 0.2;
    ctx.stroke();
  }

  ctx.restore();
}
