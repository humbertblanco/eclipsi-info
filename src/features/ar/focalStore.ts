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

/*
 * LA VERSIO DE LA CLAU, I PER QUE VA CANVIAR.
 *
 * L'estimador de focal tenia una fuga: el guany es mesurava contra la focal
 * vella i s'aplicava a la nova, i el camp de visio queia de 50 graus a 25 en
 * tres segons. El 25 es el terra del rang, o sigui un valor DOLENT PERO
 * PLAUSIBLE, i s'escrivia al disc.
 *
 * La fuga es va tapar (vegeu el reinici de l'estimador a ARView), pero el
 * disbarat desat no marxa sol: `loadMeasuredFov` el torna a llegir a cada
 * sessio i l'app arrenca amb l'escala angular 2,5 vegades fora. El simptoma es
 * inconfusible i no s'assembla gens a tremolor: mous el telefon i la
 * superposicio se'n va molt mes de pressa que el paisatge, i els discos surten
 * massa grans.
 *
 * Els valors desats no porten cap marca que permeti distingir un de bo d'un
 * d'enverinat. Canviar la versio de la clau els jubila tots de cop: costa una
 * panoramica de cinquanta graus tornar a mesurar —segons— i garanteix que
 * ningu arrenca amb un calibratge d'abans de l'arreglada. El dia de l'eclipsi
 * no es el dia de descobrir que el telefon guardava un numero dolent de fa
 * mesos.
 */
const PREFIX = 'eclipsi.ar.fov.v2.';

/** Prefix anterior, que es purga en llegir. Vegeu la nota de sobre. */
const LEGACY_PREFIX = 'eclipsi.ar.fov.';

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

/**
 * Esborra els calibratges de la versio anterior.
 *
 * No es deixen morir de vells: son claus de `localStorage` que no llegira mai
 * ningu mes, i en un aparell compartit o amb poca quota fan nosa. Es fa una
 * sola vegada per sessio, la primera que es demana un calibratge.
 */
let purged = false;

function purgeLegacy(): void {
  if (purged) return;
  purged = true;
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null && k.startsWith(LEGACY_PREFIX) && !k.startsWith(PREFIX)) stale.push(k);
    }
    for (const k of stale) localStorage.removeItem(k);
  } catch {
    // Safari en navegacio privada llanca. No passa res: nomes son claus mortes.
  }
}

/** Camp de visió desat per a aquesta resolució, o null. */
export function loadMeasuredFov(width: number, height: number): number | null {
  if (width <= 0 || height <= 0) return null;
  purgeLegacy();
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
