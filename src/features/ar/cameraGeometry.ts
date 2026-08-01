/**
 * Geometria de la càmera: quants píxels de pantalla correspon a un grau de cel.
 *
 * Aquest fitxer arregla un error que invalidava tota la superposició.
 *
 * EL PROBLEMA. El vídeo es mostra amb `object-fit: cover` dins d'un contenidor
 * que gairebé mai té la mateixa relació d'aspecte que el flux de la càmera.
 * `cover` escala la imatge fins que en cobreix tot el contenidor i li retalla
 * el que sobra. Això vol dir que el camp de visió del que l'usuari VEU a la
 * pantalla NO és el camp de visió del sensor: és més estret.
 *
 * Amb un flux típic de 1280×720 (16:9) dins d'un contenidor 3:4, la imatge
 * s'escala per l'alçada i es perd el 58% de l'amplada. Si projectem fent servir
 * el camp de visió del sensor com si fos el de la pantalla, un objecte que
 * hauria de sortir a 25° del centre es dibuixa on li tocaria estar a 60°: surt
 * fora de la pantalla o, pitjor, hi surt però a un lloc equivocat. La corba del
 * recorregut solar quedaria comprimida cap al centre i mai encaixaria amb el
 * cel real.
 *
 * LA SOLUCIÓ. Es treballa amb la distància focal expressada en píxels de
 * pantalla, no amb angles. La focal és una propietat de l'òptica i de l'escala
 * a què es dibuixa la imatge, i el retall no l'altera: retallar només tria quin
 * tros del pla d'imatge es veu. Un cop tens la focal en píxels, la projecció és
 * correcta sigui quin sigui el retall.
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export interface Viewport {
  /** Amplada del canvas en píxels CSS. */
  width: number;
  /** Alçada del canvas en píxels CSS. */
  height: number;
  /**
   * Distància focal en píxels CSS: el radi d'una esfera de projecció gnomònica
   * tal que un punt a angle θ de l'eix òptic cau a `focal · tan(θ)` píxels del
   * centre.
   */
  focalPx: number;
}

export interface VideoFrameInfo {
  /** Amplada intrínseca del flux, en píxels de sensor. */
  videoWidth: number;
  videoHeight: number;
  /** Mida del contenidor on es mostra, en píxels CSS. */
  containerWidth: number;
  containerHeight: number;
}

/**
 * Distància focal en píxels CSS a partir del camp de visió horitzontal del
 * SENSOR i de com s'escala el vídeo amb `object-fit: cover`.
 */
export function focalFromCover(
  frame: VideoFrameInfo,
  sensorFovLongSideDeg: number,
): number {
  const { videoWidth, videoHeight, containerWidth, containerHeight } = frame;

  if (videoWidth <= 0 || videoHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    // Encara no sabem la mida del flux. Aproximació perquè alguna cosa es
    // dibuixi mentre el vídeo no ha carregat; el valor bo arriba de seguida.
    return (
      Math.max(containerWidth, containerHeight) /
      2 /
      Math.tan((sensorFovLongSideDeg / 2) * DEG)
    );
  }

  // `cover`: s'escala fins que cap dels dos costats deixa forat.
  const scale = Math.max(containerWidth / videoWidth, containerHeight / videoHeight);

  // EL COSTAT LLARG, NO L'AMPLADA.
  //
  // Aquí hi havia `videoWidth * scale`, i era un error greu i sempre actiu al
  // mòbil. El camp de visió de referència (66°) és el del costat LLARG del
  // sensor en 4:3, però tant iOS Safari com Chrome Android sovint lliuren el
  // flux ja girat en vertical (720×1280, 1080×1920), i llavors `videoWidth` és
  // el costat CURT. Aplicar-hi els graus del llarg dona una focal molt més
  // petita del que toca i tota la superposició es mou de més.
  //
  // Mesurat amb un contenidor de 360×480 i un flux de 720×1280: la focal
  // sortia 277,2 px quan la real és 492,8 — el 56%. Un objecte a 15° de l'eix
  // es dibuixava a 8,6°, o sigui 6,4° de desviació, que són dotze diàmetres
  // solars. En horitzontal (1280×720) l'error és zero, i per això no es veia
  // provant-ho a l'escriptori.
  //
  // La focal en píxels és la MATEIXA als dos eixos mentre els píxels siguin
  // quadrats, així que amb el costat llarg n'hi ha prou per als dos.
  const displayedLongSide = Math.max(videoWidth, videoHeight) * scale;

  return displayedLongSide / 2 / Math.tan((sensorFovLongSideDeg / 2) * DEG);
}

/**
 * Inversa de `focalFromCover`: quin camp de visió del sensor correspon a una
 * focal mesurada en píxels de pantalla.
 *
 * PER QUÈ CAL. L'ancoratge visual mesura la focal en píxels de PANTALLA, i
 * aquesta xifra depèn de la mida del contenidor: si es gira el telèfon o canvia
 * la disposició, ja no val. El camp de visió del sensor, en canvi, és una
 * propietat de l'òptica i no canvia mai. Convertint-hi la mesura, es pot desar
 * entre sessions i tornar-la a convertir a focal per a qualsevol contenidor —
 * que és el que fa que la segona obertura de l'aplicació ja surti calibrada.
 */
export function sensorFovFromFocal(frame: VideoFrameInfo, focalPx: number): number | null {
  const { videoWidth, videoHeight, containerWidth, containerHeight } = frame;
  if (
    videoWidth <= 0 ||
    videoHeight <= 0 ||
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    !(focalPx > 0)
  ) {
    return null;
  }
  const scale = Math.max(containerWidth / videoWidth, containerHeight / videoHeight);
  const displayedLongSide = Math.max(videoWidth, videoHeight) * scale;
  return 2 * Math.atan(displayedLongSide / 2 / focalPx) * RAD;
}

/** Camp de visió efectiu que l'usuari veu de veritat, per a la interfície. */
export function effectiveFov(viewport: Viewport): { horizontal: number; vertical: number } {
  return {
    horizontal: 2 * Math.atan(viewport.width / 2 / viewport.focalPx) * RAD,
    vertical: 2 * Math.atan(viewport.height / 2 / viewport.focalPx) * RAD,
  };
}

/**
 * Camp de visió del sensor mesurat sobre el COSTAT LLARG, en graus.
 *
 * Que sigui el costat llarg i no "l'horitzontal" és essencial: al mòbil el
 * flux arriba sovint girat en vertical, i llavors l'amplada del vídeo és el
 * costat curt. Referir-ho sempre al costat llarg fa que la conversió sigui
 * independent de com vingui girat.
 *
 * Cap navegador exposa el camp de visió ni la distància focal d'una càmera:
 * l'especificació de Media Capture no ho contempla i `getCapabilities()`
 * tampoc no ho inclou. El que tenim és la resolució del flux i valors típics.
 * L'usuari ho pot afinar amb el control de la interfície, i el calibratge
 * contra la silueta del terreny el resol de manera exacta.
 *
 * Referència: les càmeres principals dels mòbils moderns ronden els 26 mm
 * equivalents, que són uns 65-69° sobre el costat llarg en 4:3.
 *
 * COMPTE: des d'iOS 16.4, `facingMode: environment` pot donar la càmera
 * ULTRA-ANGULAR, que en fa uns 120°. Vegeu el bug 253186 del WebKit.
 */
export const DEFAULT_SENSOR_FOV_DEG = 66;

/**
 * Resol el viewport complet a partir de l'element de vídeo i del canvas.
 * Torna null si encara no hi ha prou informació.
 */
export function viewportFromElements(
  video: HTMLVideoElement | null,
  canvasWidth: number,
  canvasHeight: number,
  sensorFovDeg: number,
): Viewport {
  const frame: VideoFrameInfo = {
    videoWidth: video?.videoWidth ?? 0,
    videoHeight: video?.videoHeight ?? 0,
    containerWidth: canvasWidth,
    containerHeight: canvasHeight,
  };

  return {
    width: canvasWidth,
    height: canvasHeight,
    focalPx: focalFromCover(frame, sensorFovDeg),
  };
}
