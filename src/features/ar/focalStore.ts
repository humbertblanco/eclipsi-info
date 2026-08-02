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

/**
 * Límits del que pot ser una càmera de mòbil, sobre el costat llarg.
 *
 * S'exporten perquè hi hagi UN sol rang a tota l'app: el control lliscant del
 * panell en tenia un altre (40-130) i un valor desat de 25 a 39,9° es podia
 * carregar i dibuixar però no reproduir ni corregir a mà.
 */
export const MIN_FOV_DEG = 25;
export const MAX_FOV_DEG = 140;

/** El que es desa amb el valor: quantes finestres el sostenen, i de quan és. */
export interface MeasuredFovMeta {
  fovDeg: number;
  /** Finestres de calibratge tancades quan es va desar. 0 = desat antic. */
  windows: number;
  /** Època Unix en mil·lisegons, o null si el valor és del format antic. */
  savedAtMs: number | null;
}

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
  return loadMeasuredFovMeta(width, height)?.fovDeg ?? null;
}

/**
 * El valor desat AMB el seu historial: quantes finestres el sostenien i quan
 * es va escriure. Un valor acabat de mesurar amb el mínim de sis finestres no
 * mereix la mateixa autoritat que un de llarg i convergit, i fins ara no hi
 * havia manera de distingir-los — la clau v2 va jubilar els enverinats, però
 * no va deixar cap marca per no repetir la investigació el proper cop.
 *
 * Es llegeix tant el format nou (JSON `{f, n, t}`) com l'antic (número pelat);
 * l'antic surt amb `windows: 0` i `savedAtMs: null`, que és exactament el que
 * se'n sap.
 */
export function loadMeasuredFovMeta(width: number, height: number): MeasuredFovMeta | null {
  if (width <= 0 || height <= 0) return null;
  purgeLegacy();
  try {
    const raw = localStorage.getItem(key(width, height));
    if (raw === null) return null;

    let fov: number;
    let windows = 0;
    let savedAtMs: number | null = null;
    if (raw.startsWith('{')) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const record = parsed as { f?: unknown; n?: unknown; t?: unknown };
      if (typeof record.f !== 'number') return null;
      fov = record.f;
      if (typeof record.n === 'number' && record.n >= 0) windows = Math.floor(record.n);
      if (typeof record.t === 'number' && record.t > 0) savedAtMs = record.t;
    } else {
      fov = Number(raw);
    }

    if (!Number.isFinite(fov) || fov < MIN_FOV_DEG || fov > MAX_FOV_DEG) return null;
    return { fovDeg: fov, windows, savedAtMs };
  } catch {
    // Safari en navegació privada llança en llegir, o el JSON és brossa. No és
    // fatal: es torna a mesurar i prou.
    return null;
  }
}

export function saveMeasuredFov(
  width: number,
  height: number,
  fovDeg: number,
  windows = 0,
): void {
  if (width <= 0 || height <= 0) return;
  if (!Number.isFinite(fovDeg) || fovDeg < MIN_FOV_DEG || fovDeg > MAX_FOV_DEG) return;
  try {
    localStorage.setItem(
      key(width, height),
      JSON.stringify({ f: Number(fovDeg.toFixed(2)), n: Math.max(0, windows), t: Date.now() }),
    );
  } catch {
    // Quota exhaurida o emmagatzematge bloquejat: es perd el calibratge entre
    // sessions, però la sessió actual segueix igual de bé.
  }
}
