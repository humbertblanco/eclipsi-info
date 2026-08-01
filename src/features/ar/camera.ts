/**
 * Obertura de la càmera del darrere, amb l'objectiu correcte.
 *
 * EL PROBLEMA. Demanar `facingMode: 'environment'` i acceptar el que et donin
 * no serveix. Des d'iOS 16.4, Safari tria sovint la càmera ULTRA-ANGULAR
 * (WebKit bug 253186), que fa uns 120° de camp en comptes dels ~66° de la
 * principal. Com que cap navegador exposa el camp de visió, l'app no se n'assabenta
 * i projecta amb una focal 2,7 vegades massa petita: la superposició es mou
 * gairebé el triple del que hauria i sembla que el seguiment falli, quan el que
 * falla és l'escala. A l'iPhone 15 el sistema fins i tot canvia d'objectiu a
 * mitja sessió.
 *
 * QUÈ HI PODEM FER. No hi ha cap manera neta de dir "vull la principal" des del
 * web. El que sí que podem fer és:
 *
 *  1. Demanar RESOLUCIÓ ALTA. A la pràctica això ja empeny iOS cap a la càmera
 *     principal, perquè l'ultra-angular sovint no arriba a 1920 de costat llarg.
 *  2. Mirar `getCapabilities()`. El camp de visió no hi és, però el ZOOM sí, i
 *     és un bon delator: si el mínim baixa d'1 (típicament 0,5×), l'objectiu
 *     actiu és l'ultra-angular.
 *  3. Fixar `zoom: 1` quan es pugui, que torna la vista a l'equivalent de la
 *     càmera principal.
 *  4. Dir-ho a la interfície, perquè l'usuari pugui ajustar el camp de visió a
 *     mà si res d'això ha funcionat.
 */

export interface CameraOpenResult {
  stream: MediaStream;
  /** Resolució real del flux. */
  width: number;
  height: number;
  /** Etiqueta del dispositiu, si el navegador la dona. Sovint buida a iOS. */
  label: string;
  /** Rang de zoom que declara l'objectiu, si el navegador l'exposa. */
  zoomRange: { min: number; max: number; current: number } | null;
  /**
   * Cert quan tot apunta que estem a l'ultra-angular. El camp de visió per
   * defecte no serveix i s'ha de calibrar.
   */
  looksUltraWide: boolean;
  /** Camp de visió suggerit sobre el costat llarg, en graus. */
  suggestedFovDeg: number;
}

/** Camp típic de la càmera principal d'un mòbil, sobre el costat llarg. */
const MAIN_LENS_FOV_DEG = 66;
/** Camp típic d'una ultra-angular de mòbil. */
const ULTRA_WIDE_FOV_DEG = 118;

interface ZoomCapableCapabilities extends MediaTrackCapabilities {
  zoom?: { min: number; max: number; step?: number };
}
interface ZoomCapableSettings extends MediaTrackSettings {
  zoom?: number;
}

export async function openRearCamera(): Promise<CameraOpenResult> {
  // Demanar 1920 de costat llarg empeny iOS cap a la càmera principal. És
  // `ideal` i no `exact` a propòsit: amb `exact`, un dispositiu que no hi
  // arribi no obriria càmera de cap manera.
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  });

  const track = stream.getVideoTracks()[0];
  const settings = (track?.getSettings() ?? {}) as ZoomCapableSettings;

  let capabilities: ZoomCapableCapabilities = {};
  try {
    capabilities = (track?.getCapabilities?.() ?? {}) as ZoomCapableCapabilities;
  } catch {
    // Safari antic no l'implementa. No és fatal.
  }

  const zoomCap = capabilities.zoom;
  const zoomRange = zoomCap
    ? { min: zoomCap.min, max: zoomCap.max, current: settings.zoom ?? 1 }
    : null;

  // Un zoom mínim per sota d'1 vol dir que el sistema considera que la vista
  // actual és més ampla que la de referència: és l'ultra-angular.
  const looksUltraWide = zoomRange !== null && zoomRange.min < 0.95;

  // Si podem, tornem a l'equivalent de la càmera principal.
  if (looksUltraWide && zoomRange && zoomRange.max >= 1) {
    try {
      await track.applyConstraints({ advanced: [{ zoom: 1 } as MediaTrackConstraintSet] });
    } catch {
      // Si no ens deixa, ens quedem amb el camp de visió suggerit i el
      // calibratge manual.
    }
  }

  const after = (track?.getSettings?.() ?? settings) as ZoomCapableSettings;
  const zoomNow = after.zoom ?? zoomRange?.current ?? 1;

  // Si hem aconseguit posar el zoom a 1, la vista ja és la de la principal.
  const stillUltraWide = looksUltraWide && zoomNow < 0.95;

  return {
    stream,
    width: after.width ?? 0,
    height: after.height ?? 0,
    label: track?.label ?? '',
    zoomRange,
    looksUltraWide: stillUltraWide,
    suggestedFovDeg: stillUltraWide ? ULTRA_WIDE_FOV_DEG : MAIN_LENS_FOV_DEG,
  };
}

/**
 * Vigila que el sistema no canviï d'objectiu a mitja sessió.
 *
 * A l'iPhone 15 passa sol, i quan passa el calibratge que l'usuari acabava de
 * fer queda invalidat sense que res ho digui. Val més detectar-ho i avisar que
 * seguir dibuixant amb una escala que ja no correspon.
 */
export function watchLensChange(
  stream: MediaStream,
  onChange: (info: { width: number; height: number }) => void,
): () => void {
  const track = stream.getVideoTracks()[0];
  if (!track) return () => {};

  let last = track.getSettings();
  const id = setInterval(() => {
    const now = track.getSettings();
    if (now.width !== last.width || now.height !== last.height) {
      last = now;
      onChange({ width: now.width ?? 0, height: now.height ?? 0 });
    }
  }, 1000);

  return () => clearInterval(id);
}
