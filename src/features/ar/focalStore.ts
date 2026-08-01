/**
 * Memòria del camp de visió mesurat, entre sessions.
 *
 * PER QUÈ. L'ancoratge visual acaba mesurant el camp de visió de l'objectiu,
 * però necessita uns cinquanta graus de panoràmica per convergir. Si no es desa,
 * cada vegada que s'obre l'aplicació es torna a partir d'una conjectura —i a
 * iOS la conjectura pot equivocar-se pel factor 1,8 que hi ha entre la càmera
 * principal i l'ultra-angular. Desant-lo, la segona obertura ja surt calibrada,
 * que és la que compta: la primera es fa a casa i la segona al lloc de
 * l'eclipsi.
 *
 * PER QUÈ INDEXAT PER RESOLUCIÓ. La resolució del flux és el millor indici
 * disponible de QUIN objectiu ens han donat: cap navegador exposa ni el camp de
 * visió ni una identificació fiable de la càmera, i a iOS l'etiqueta del
 * dispositiu sol venir buida. Si el sistema canvia d'objectiu, la resolució
 * canvia amb ell i el valor desat d'aquella resolució ja no s'aplica.
 *
 * PER QUÈ EL CAMP DE VISIÓ I NO LA FOCAL. La focal es mesura en píxels de
 * PANTALLA i depèn de la mida del contenidor; el camp de visió del sensor és
 * una propietat de l'òptica i no canvia mai.
 */

const PREFIX = 'eclipsi.ar.fov.';

/** Límits del que pot ser una càmera de mòbil, sobre el costat llarg. */
const MIN_FOV_DEG = 25;
const MAX_FOV_DEG = 140;

function key(width: number, height: number): string {
  // Es normalitza per costat llarg i curt: el mateix objectiu pot lliurar el
  // flux girat segons com es tingui el telèfon, i és la mateixa òptica.
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  return `${PREFIX}${long}x${short}`;
}

/** Camp de visió desat per a aquesta resolució, o null. */
export function loadMeasuredFov(width: number, height: number): number | null {
  if (width <= 0 || height <= 0) return null;
  try {
    const raw = localStorage.getItem(key(width, height));
    if (raw === null) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < MIN_FOV_DEG || value > MAX_FOV_DEG) return null;
    return value;
  } catch {
    // Safari en navegació privada llança en llegir. No és fatal: es torna a
    // mesurar i prou.
    return null;
  }
}

export function saveMeasuredFov(width: number, height: number, fovDeg: number): void {
  if (width <= 0 || height <= 0) return;
  if (!Number.isFinite(fovDeg) || fovDeg < MIN_FOV_DEG || fovDeg > MAX_FOV_DEG) return;
  try {
    localStorage.setItem(key(width, height), fovDeg.toFixed(2));
  } catch {
    // Quota exhaurida o emmagatzematge bloquejat: es perd el calibratge entre
    // sessions, però la sessió actual segueix igual de bé.
  }
}
